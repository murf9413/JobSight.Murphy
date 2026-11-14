-- JobSight uses a narrowly scoped RPC boundary. Application tables are private,
-- RLS-protected, and have no direct anon/authenticated grants. Every RPC action
-- resolves the caller from auth.uid() and checks current database membership.
create schema if not exists jobsight_private;
revoke all on schema jobsight_private from public, anon;
grant usage on schema jobsight_private to authenticated;

create table jobsight_private.bootstrap_admins (email text primary key check (email=lower(email)));
create table jobsight_private.companies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table jobsight_private.members (
 company_id uuid not null references jobsight_private.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, email text not null,
 role text not null check(role in ('admin','pjm','vendor')), vendor_ids text[] not null default '{}',
 joined_at timestamptz not null default now(), primary key(company_id,user_id),
 check(role <> 'vendor' or cardinality(vendor_ids)>0)
);
create index members_user on jobsight_private.members(user_id);
create table jobsight_private.projects (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references jobsight_private.companies(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), data jsonb not null,
 revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now(), updated_by text not null,
 check(octet_length(data::text)<=1000000), check(jsonb_typeof(data->'tasks')='array')
);
create index projects_company on jobsight_private.projects(company_id);
create table jobsight_private.snapshots (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references jobsight_private.projects(id) on delete cascade,
 revision integer not null, data jsonb not null, saved_at timestamptz not null, saved_by text not null,
 unique(project_id,revision)
);
create table jobsight_private.community_vendors (
 company_id uuid not null references jobsight_private.companies(id) on delete cascade,
 community text not null, data jsonb not null, revision integer not null default 1,
 updated_at timestamptz not null default now(), primary key(company_id,community), check(octet_length(data::text)<=1000000)
);
create table jobsight_private.invites (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references jobsight_private.companies(id) on delete cascade,
 email text not null, role text not null check(role in ('admin','pjm','vendor')), vendor_ids text[] not null default '{}',
 token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz not null default now()+interval '7 days',
 created_by uuid not null references auth.users(id), accepted_by uuid references auth.users(id),
 check(role <> 'vendor' or cardinality(vendor_ids)>0)
);
create index invites_company on jobsight_private.invites(company_id);
create table jobsight_private.vendor_updates (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references jobsight_private.projects(id) on delete cascade,
 step_id text not null, vendor_id text not null, user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('accept','note','nudge')), body text not null default '' check(length(body)<=5000),
 schedule_signature text not null, created_at timestamptz not null default now(), read_at timestamptz, read_by uuid references auth.users(id)
);
create index vendor_updates_step on jobsight_private.vendor_updates(project_id,step_id,created_at);
create table jobsight_private.audit_log (
 id bigint generated always as identity primary key, company_id uuid references jobsight_private.companies(id) on delete cascade,
 user_id uuid not null, action text not null, target_id text, created_at timestamptz not null default now()
);
create index audit_company_time on jobsight_private.audit_log(company_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['bootstrap_admins','companies','members','projects','snapshots','community_vendors','invites','vendor_updates','audit_log'] loop
  execute format('alter table jobsight_private.%I enable row level security',t);
  execute format('revoke all on jobsight_private.%I from public, anon, authenticated',t);
 end loop;
end $$;

create function jobsight_private.hydrate(s jsonb, cid uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare shared jsonb; vendors jsonb; steps jsonb;
begin
 select data into shared from jobsight_private.community_vendors where company_id=cid and community=lower(btrim(s#>>'{project,community}'));
 if shared is null then return s; end if;
 select coalesce(jsonb_agg(v.v),'[]') into vendors from (
  select distinct on (v->>'id') v from (
   select v,1 as priority from jsonb_array_elements(coalesce(s->'vendors','[]')) v
   union all select v,2 from jsonb_array_elements(shared->'vendors') v
  ) x order by v->>'id',priority desc
 ) v;
 select coalesce(jsonb_agg(case when coalesce((t->>'vendorOverride')::boolean,false) then t
  when a.value is not null then t||jsonb_build_object('vendorId',coalesce(a.value->>'vendorId','')) else t end order by ord),'[]') into steps
 from jsonb_array_elements(s->'tasks') with ordinality t(t,ord)
 left join lateral (select value from jsonb_array_elements(shared->'tasks') where
  regexp_replace(lower(btrim(value->>'name')),'\s+',' ','g')=regexp_replace(lower(btrim(t->>'name')),'\s+',' ','g') limit 1) a on true;
 return s||jsonb_build_object('vendors',vendors,'tasks',steps);
end $$;

create function jobsight_private.step_signature(s jsonb,t jsonb) returns text
language sql immutable set search_path='' as $$
 select md5(jsonb_build_array(s->'base',t->'day',t->'duration',t->'vendorId',t->'confirmed',t->'workHolidays',t->'allowNonWorking')::text)
$$;

create function jobsight_private.valid_schedule(s jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare t jsonb;
begin
 if s is null or s->>'version' is distinct from '1' or s->>'workweekVersion' is distinct from '1'
 or jsonb_typeof(s->'project') is distinct from 'object'
 or jsonb_typeof(s->'tasks') is distinct from 'array'
 or jsonb_typeof(s->'vendors') is distinct from 'array'
 or jsonb_typeof(s->'rules') is distinct from 'array'
 or not coalesce((s->>'base') ~ '^\d{4}-\d{2}-\d{2}$',false)
 then return false; end if;
 perform (s->>'base')::date;
 if jsonb_array_length(s->'tasks')>2000 or jsonb_array_length(s->'vendors')>1000 or jsonb_array_length(s->'rules')>5000 or octet_length(s::text)>1000000 then return false; end if;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(s->'tasks') x) then return false; end if;
 for t in select value from jsonb_array_elements(s->'tasks') loop
  if not coalesce(length(t->>'id') between 1 and 100,false)
   or not coalesce(length(btrim(t->>'name')) between 1 and 200,false)
   or not coalesce((t->>'day')::integer between -36500 and 36500,false)
   or not coalesce((t->>'duration')::integer between 1 and 365,false)
   or not coalesce(t->>'type' in ('Labor','Delivery','Inspection','Exterior','Utility','Milestone'),false)
   or length(coalesce(t->>'note',''))>10000 or length(coalesce(t->>'callout',''))>300 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function jobsight_private.api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); mail text; cid uuid; rid uuid; role_name text; p jobsight_private.projects%rowtype;
 invite_row jobsight_private.invites%rowtype; member_row jobsight_private.members%rowtype;
 result jsonb; state jsonb; step jsonb; feedback jsonb; row_data jsonb; items jsonb:='[]';
 next_role text; target uuid; valid_vendors text[]; ids text[]; current_rev integer; name_value text;
begin
 if uid is null then raise sqlstate 'PT401' using message='Sign in to use JobSight.'; end if;
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null and (banned_until is null or banned_until<now());
 if mail is null then raise sqlstate 'PT403' using message='Verify your email before opening JobSight.'; end if;
 if octet_length(payload::text)>1100000 then raise sqlstate 'PT400' using message='Request is too large.'; end if;

 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',m.role,'created_at',c.created_at) order by c.created_at),'[]') into result
  from jobsight_private.companies c join jobsight_private.members m on m.company_id=c.id where m.user_id=uid;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'company_id',q.company_id,'revision',q.revision,'updated_at',q.updated_at,'role',m.role,'state',jobsight_private.hydrate(q.data,q.company_id))),'[]') into items
  from jobsight_private.projects q join jobsight_private.members m on m.company_id=q.company_id where m.user_id=uid and m.role in ('admin','pjm');
  return jsonb_build_object('companies',result,'projects',items,'canCreateCompany',exists(select 1 from jobsight_private.bootstrap_admins where email=mail));
 end if;
 if action='company' then
  if not exists(select 1 from jobsight_private.bootstrap_admins where email=mail) then raise sqlstate 'PT403' using message='Ask your Admin for a workspace invitation.'; end if;
  if (select count(*) from jobsight_private.companies where created_by=uid)>=20 then raise sqlstate 'PT400' using message='Workspace limit reached.'; end if;
  name_value:=btrim(payload->>'name');
  if name_value is null or length(name_value) not between 1 and 120 then raise sqlstate 'PT400' using message='Enter a company name.'; end if;
  insert into jobsight_private.companies(name,created_by) values(name_value,uid) returning id into cid;
  insert into jobsight_private.members(company_id,user_id,email,role) values(cid,uid,mail,'admin');
  result:=jsonb_build_object('id',cid);
 elsif action='join' then
  select * into invite_row from jobsight_private.invites where token_hash=payload->>'tokenHash' for update;
  if not found or invite_row.accepted_by is not null or invite_row.expires_at<=now() then raise sqlstate 'PT410' using message='Invitation expired or already used.'; end if;
  if invite_row.email<>mail then raise sqlstate 'PT403' using message='Sign in with the invited email address.'; end if;
  cid:=invite_row.company_id;
  insert into jobsight_private.members(company_id,user_id,email,role,vendor_ids) values(cid,uid,mail,invite_row.role,invite_row.vendor_ids) on conflict(company_id,user_id) do nothing;
  update jobsight_private.invites set accepted_by=uid where id=invite_row.id;
  result:=jsonb_build_object('companyId',cid);
 else
  if action in ('project','save','restore','history','vendorAction') then
   select * into p from jobsight_private.projects where id=(payload->>'id')::uuid for update;
   if not found then raise sqlstate 'PT404' using message='Project not found.'; end if;
   cid:=p.company_id;rid:=p.id;
  else cid:=coalesce(payload->>'companyId',payload->>'company',payload->>'id')::uuid;
  end if;
  select * into member_row from jobsight_private.members where company_id=cid and user_id=uid;
  if not found then raise sqlstate 'PT404' using message='Workspace not found.'; end if;
  role_name:=member_row.role;
  if action in ('team','invite','revoke','member','audit') and role_name<>'admin' then raise sqlstate 'PT403' using message='Admin access required.'; end if;
  if role_name='vendor' and action not in ('vendorJobs','vendorAction') then raise sqlstate 'PT403' using message='This action is not available to Vendors.'; end if;

  if action='project' then
   state:=jobsight_private.hydrate(p.data,cid);
   select jsonb_set(state,'{tasks}',coalesce(jsonb_agg(t||jsonb_build_object(
    'acceptedFor',case when coalesce((t->>'confirmed')::boolean,false) and exists(select 1 from jobsight_private.vendor_updates v where v.project_id=p.id and v.step_id=t->>'id' and v.kind='accept' and v.schedule_signature=jobsight_private.step_signature(state,t)) then jobsight_private.step_signature(state,t) else null end,
    'unreadVendorNotes',exists(select 1 from jobsight_private.vendor_updates v where v.project_id=p.id and v.step_id=t->>'id' and v.kind='note' and v.read_at is null)
   ) order by ord),'[]')) into state from jsonb_array_elements(state->'tasks') with ordinality x(t,ord);
   select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at),'[]') into feedback from jobsight_private.vendor_updates v where project_id=p.id;
   return jsonb_build_object('id',p.id,'name',p.name,'role',role_name,'revision',p.revision,'companyId',cid,'state',state,'feedback',feedback);
  elsif action='week' then
   select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'state',jobsight_private.hydrate(q.data,cid))),'[]') into items from jobsight_private.projects q where company_id=cid;
   return jsonb_build_object('projects',items);
  elsif action='communityVendors' then
   select data||jsonb_build_object('revision',revision) into result from jobsight_private.community_vendors where company_id=cid and community=lower(btrim(payload->>'communityName'));
   select coalesce(jsonb_agg(data),'[]') into items from jobsight_private.projects where company_id=cid and lower(btrim(data#>>'{project,community}'))=lower(btrim(payload->>'communityName'));
   return jsonb_build_object('directory',result,'states',items);
  elsif action='history' then
   select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision,'saved_at',s.saved_at,'saved_by',s.saved_by) order by s.revision desc),'[]') into result from jobsight_private.snapshots s where project_id=p.id;
   return jsonb_build_object('versions',result);
  elsif action='team' then
   select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'email',email,'role',role,'vendor_ids',vendor_ids)),'[]') into result from jobsight_private.members where company_id=cid;
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'vendor_ids',vendor_ids,'expires_at',expires_at)),'[]') into items from jobsight_private.invites where company_id=cid and accepted_by is null and expires_at>now();
   select coalesce(jsonb_agg(v),'[]') into feedback from (select distinct v->>'id' as id,v->>'name' as name from jobsight_private.projects q cross join lateral jsonb_array_elements(jobsight_private.hydrate(q.data,cid)->'vendors') v where q.company_id=cid) v;
   return jsonb_build_object('members',result,'invites',items,'vendors',feedback,'ownerId',(select created_by from jobsight_private.companies where id=cid));
  elsif action='audit' then
   select coalesce(jsonb_agg(to_jsonb(a)),'[]') into result from (select a.action,a.target_id,a.user_id,a.created_at from jobsight_private.audit_log a where a.company_id=cid order by a.created_at desc limit 100) a;
   return jsonb_build_object('events',result);
  elsif action='createProject' then
   if (select count(*) from jobsight_private.projects where company_id=cid)>=100 then raise sqlstate 'PT400' using message='Project limit reached.'; end if;
   if not jobsight_private.valid_schedule(payload->'state') then raise sqlstate 'PT400' using message='Invalid schedule format.'; end if;
   state:=jobsight_private.hydrate(payload->'state',cid);
   insert into jobsight_private.projects(company_id,name,data,updated_by) values(cid,btrim(payload->>'name'),state,mail) returning id into rid;
   result:=jsonb_build_object('id',rid,'revision',1);
  elsif action in ('save','restore') then
   if p.revision is distinct from (payload->>'revision')::integer then raise sqlstate 'PT409' using message='This schedule changed elsewhere. Reload before saving.'; end if;
   if action='restore' then
    select data into state from jobsight_private.snapshots where id=(payload->>'snapshotId')::uuid and project_id=p.id;
    if not found then raise sqlstate 'PT404' using message='Backup not found.'; end if;
   else state:=payload->'state'; end if;
   if not jobsight_private.valid_schedule(state) then raise sqlstate 'PT400' using message='Invalid schedule format.'; end if;
   state:=jobsight_private.hydrate(state,cid);
   insert into jobsight_private.snapshots(project_id,revision,data,saved_at,saved_by) values(p.id,p.revision,p.data,p.updated_at,p.updated_by);
   update jobsight_private.projects set data=state,revision=revision+1,updated_at=now(),updated_by=mail where id=p.id;
   delete from jobsight_private.snapshots where project_id=p.id and id not in (select id from jobsight_private.snapshots where project_id=p.id order by revision desc limit 50);
   result:=jsonb_build_object('revision',p.revision+1);
   if action='restore' then result:=result||jsonb_build_object('state',state); end if;
  elsif action='saveCommunityVendors' then
   -- Serialize directory creation and revision checks for this company.
   perform 1 from jobsight_private.companies where id=cid for update;
   name_value:=lower(btrim(payload->>'community'));
   select revision into current_rev from jobsight_private.community_vendors where company_id=cid and community=name_value for update;
   if coalesce(current_rev,0) is distinct from (payload->>'revision')::integer then raise sqlstate 'PT409' using message='Shared directory changed. Reopen before saving.'; end if;
   insert into jobsight_private.community_vendors(company_id,community,data,revision) values(cid,name_value,jsonb_build_object('vendors',payload->'vendors','tasks',payload->'tasks'),coalesce(current_rev,0)+1)
   on conflict(company_id,community) do update set data=excluded.data,revision=excluded.revision,updated_at=now();
   result:=jsonb_build_object('revision',coalesce(current_rev,0)+1);
  elsif action='invite' then
   next_role:=payload->>'role'; ids:=array(select jsonb_array_elements_text(coalesce(payload->'vendorIds','[]')));
   if next_role not in ('admin','pjm','vendor') then raise sqlstate 'PT400' using message='Choose Admin, PJM, or Vendor.'; end if;
   if next_role='vendor' then
    select array_agg(distinct v->>'id') into valid_vendors from jobsight_private.projects q cross join lateral jsonb_array_elements(jobsight_private.hydrate(q.data,cid)->'vendors') v where q.company_id=cid;
    if cardinality(ids)=0 or not ids<@coalesce(valid_vendors,'{}') then raise sqlstate 'PT400' using message='Choose assigned vendors from the directory.'; end if;
   else ids:='{}'; end if;
   if (select count(*) from jobsight_private.invites where company_id=cid and accepted_by is null and expires_at>now())>=30 then raise sqlstate 'PT400' using message='Revoke old invitations before creating more.'; end if;
   name_value:=lower(btrim(payload->>'email'));
   if name_value is null or length(name_value)>254 or name_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise sqlstate 'PT400' using message='Enter a valid email.'; end if;
   insert into jobsight_private.invites(company_id,email,role,vendor_ids,token_hash,created_by) values(cid,name_value,next_role,ids,payload->>'tokenHash',uid) returning id,expires_at into invite_row.id,invite_row.expires_at;
   result:=jsonb_build_object('id',invite_row.id,'email',name_value,'expiresAt',invite_row.expires_at);
  elsif action='revoke' then
   delete from jobsight_private.invites where id=(payload->>'inviteId')::uuid and company_id=cid;
   result:='{"ok":true}';
  elsif action='member' then
   target:=(payload->>'userId')::uuid;next_role:=payload->>'role';
   if target=(select created_by from jobsight_private.companies where id=cid) or target=uid then raise sqlstate 'PT403' using message='The workspace owner and your own access cannot be changed here.'; end if;
   if next_role='remove' then delete from jobsight_private.members where company_id=cid and user_id=target;
   elsif next_role in ('admin','pjm') then update jobsight_private.members set role=next_role,vendor_ids='{}' where company_id=cid and user_id=target;
   else raise sqlstate 'PT400' using message='To change Vendor assignments, remove access and issue a new invitation.'; end if;
   result:='{"ok":true}';
  elsif action='vendorJobs' then
   for p in select * from jobsight_private.projects where company_id=cid loop
    state:=jobsight_private.hydrate(p.data,cid);
    if coalesce((state#>>'{project,archived}')::boolean,false) then continue; end if;
    select coalesce(jsonb_agg(t),'[]') into result from jsonb_array_elements(state->'tasks') t
     where coalesce((t->>'confirmed')::boolean,false) and (role_name<>'vendor' or t->>'vendorId'=any(member_row.vendor_ids));
    if jsonb_array_length(result)=0 then continue; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'step_id',v.step_id,'kind',v.kind,'body',v.body,'created_at',v.created_at,'read_at',v.read_at,'schedule_signature',v.schedule_signature)),'[]') into feedback
     from jobsight_private.vendor_updates v where project_id=p.id and (role_name<>'vendor' or v.vendor_id=any(member_row.vendor_ids));
    -- Only job metadata and assigned confirmed steps leave the RPC for Vendors.
    items:=items||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'base',state->'base','project',jsonb_build_object('lot',state#>>'{project,lot}','unit',state#>>'{project,unit}','address',state#>>'{project,address}','community',state#>>'{project,community}','pjm',state#>>'{project,pjm}','permit',state#>>'{project,permit}','product',state#>>'{project,product}','basementType',state#>>'{project,basementType}'),'tasks',(select jsonb_agg(t||jsonb_build_object('scheduleSignature',jobsight_private.step_signature(state,t),'vendorName',(select v->>'name' from jsonb_array_elements(state->'vendors') v where v->>'id'=t->>'vendorId' limit 1))) from jsonb_array_elements(result) t),'feedback',feedback));
   end loop;
   return jsonb_build_object('jobs',items,'role',role_name);
  elsif action='vendorAction' then
   if role_name<>'vendor' then raise sqlstate 'PT403' using message='Use a Vendor account to accept or nudge work.'; end if;
   state:=jobsight_private.hydrate(p.data,cid);
   select t into step from jsonb_array_elements(state->'tasks') t where t->>'id'=payload->>'stepId';
   if step is null or not coalesce((step->>'confirmed')::boolean,false) or not coalesce(step->>'vendorId'=any(member_row.vendor_ids),false) or coalesce((state#>>'{project,archived}')::boolean,false) then raise sqlstate 'PT403' using message='This step is not available to your Vendor account.'; end if;
   if payload->>'scheduleSignature' is distinct from jobsight_private.step_signature(state,step) then raise sqlstate 'PT409' using message='This step changed. Refresh before responding.'; end if;
   if coalesce((step->>'completed')::boolean,false) then raise sqlstate 'PT409' using message='This step is already complete.'; end if;
   if payload->>'kind' not in ('note','accept','nudge') then raise sqlstate 'PT403' using message='Vendors cannot complete or reschedule steps.'; end if;
   if payload->>'kind'='note' and length(btrim(coalesce(payload->>'body',''))) not between 1 and 5000 then raise sqlstate 'PT400' using message='Enter a note of 1–5,000 characters.'; end if;
   insert into jobsight_private.vendor_updates(project_id,step_id,vendor_id,user_id,kind,body,schedule_signature) values(p.id,step->>'id',step->>'vendorId',uid,payload->>'kind',case when payload->>'kind'='note' then btrim(payload->>'body') else '' end,jobsight_private.step_signature(state,step));
   result:='{"ok":true}';
  elsif action='vendorInbox' then
   select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'projectId',q.id,'projectName',q.name,'stepId',v.step_id,'kind',v.kind,'body',v.body,'created_at',v.created_at,'read_at',v.read_at,'stepName',t->>'name','completed',coalesce((t->>'completed')::boolean,false)) order by v.created_at desc),'[]') into result
   from jobsight_private.vendor_updates v join jobsight_private.projects q on q.id=v.project_id
   cross join lateral jsonb_array_elements(jobsight_private.hydrate(q.data,cid)->'tasks') t
   where q.company_id=cid and t->>'id'=v.step_id and v.kind in ('note','nudge') and v.read_at is null;
   return jsonb_build_object('updates',result);
  elsif action='readVendorUpdate' then
   update jobsight_private.vendor_updates v set read_at=now(),read_by=uid from jobsight_private.projects q where v.project_id=q.id and q.company_id=cid and v.id=(payload->>'updateId')::uuid;
   result:='{"ok":true}';
  else raise sqlstate 'PT404' using message='Unknown request.';
  end if;
 end if;
 insert into jobsight_private.audit_log(company_id,user_id,action,target_id) values(cid,uid,action,coalesce(rid::text,payload->>'userId',payload->>'inviteId'));
 return result;
end $$;

-- The exposed wrapper has no elevated privileges. The private implementation is
-- the only definer function, with explicit identity + tenant + action checks.
create function public.jobsight_api(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select jobsight_private.api(action,payload) $$;
revoke all on all functions in schema jobsight_private from public,anon,authenticated;
grant execute on function jobsight_private.api(text,jsonb) to authenticated;
revoke all on function public.jobsight_api(text,jsonb) from public,anon;
grant execute on function public.jobsight_api(text,jsonb) to authenticated;
revoke all on all sequences in schema jobsight_private from public,anon,authenticated;
