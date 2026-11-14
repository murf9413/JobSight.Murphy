import{constructionDUC}from'../src/duc.js';
import{statusTasks}from'../src/jobStatus.js';
import{communityKey,sharedState,seedDirectory}from'../src/communityVendors.js';
import{weekTasks,monday}from'../src/jobs.js';
import{HttpError,requireValue,label,validateState,authorize,checkMutation}from'./validation.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const now=()=>new Date().toISOString();
async function hash(token){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function handleCloud(request,db,user){try{
 if(!user)return json({error:'Sign in to use cloud workspaces.'},401);
 const q=(s,...v)=>db.prepare(s).bind(...v),first=(s,...v)=>q(s,...v).first(),all=async(s,...v)=>(await q(s,...v).all()).results;
 const member=async(id,level='read')=>{const row=await first('SELECT role FROM members WHERE company_id=? AND user_id=?',id,user.userId);authorize(row?.role,level);return row.role};
 const project=async(id,level='read')=>{const p=await first('SELECT * FROM projects WHERE id=?',id);requireValue(p,'Project not found.',404);p.role=await member(p.company_id,level);return p};
 const shared=async(companyId,name)=>{const key=communityKey(name);if(!key)return null;const row=await first('SELECT data,revision FROM community_vendors WHERE company_id=? AND community=?',companyId,key);return row?{...JSON.parse(row.data),revision:row.revision}:null};
 const hydrate=async(companyId,state)=>sharedState(state,await shared(companyId,state.project.community));
 const url=new URL(request.url),action=url.searchParams.get('action')||'list';
 if(request.method==='GET'){
  if(action==='list')return json({user:{email:user.email,name:user.displayName},companies:await all('SELECT c.*,m.role FROM companies c JOIN members m ON c.id=m.company_id WHERE m.user_id=? ORDER BY c.created_at',user.userId),projects:(await all("SELECT p.data,p.id,p.company_id,p.name,p.revision,p.updated_at,json_extract(p.data,'$.project.lot') AS lot,json_extract(p.data,'$.project.address') AS address,json_extract(p.data,'$.project.permit') AS permit,json_extract(p.data,'$.project.unit') AS unit,json_extract(p.data,'$.project.community') AS community,coalesce(json_extract(p.data,'$.project.archived'),0) AS archived,m.role FROM projects p JOIN members m ON p.company_id=m.company_id WHERE m.user_id=? ORDER BY p.updated_at DESC",user.userId)).map(({data,...p})=>({...p,...Object.fromEntries(['pjm','psrDate','product','basementType'].map(k=>[k,JSON.parse(data).project[k]||''])),startDate:JSON.parse(data).base,statusTasks:statusTasks(JSON.parse(data)),duc:constructionDUC(JSON.parse(data))}))});
  if(action==='project'){const p=await project(url.searchParams.get('id'));return json({id:p.id,name:p.name,role:p.role,revision:p.revision,companyId:p.company_id,state:await hydrate(p.company_id,JSON.parse(p.data))})}
  if(action==='week'){const id=url.searchParams.get('company');await member(id);const start=url.searchParams.get('start');requireValue(/^\d{4}-\d{2}-\d{2}$/.test(start)&&!isNaN(Date.parse(start))&&new Date(start+'T00:00:00Z').toISOString().slice(0,10)===start,'Choose a valid week.');const rows=await all('SELECT id,name,data FROM projects WHERE company_id=?',id);return json({events:weekTasks(await Promise.all(rows.map(async p=>({...p,state:await hydrate(id,JSON.parse(p.data))}))),monday(start))})}
  if(action==='communityVendors'){const companyId=url.searchParams.get('company');await member(companyId);const name=label(url.searchParams.get('community'));const current=await shared(companyId,name);const rows=await all('SELECT data FROM projects WHERE company_id=?',companyId);const states=rows.map(p=>JSON.parse(p.data)).filter(s=>communityKey(s.project.community)===communityKey(name));const seed=seedDirectory(states);if(current){const known=new Set(current.tasks.map(t=>t.name.trim().toLowerCase().replace(/\s+/g,' ')));return json({...current,tasks:[...current.tasks,...seed.tasks.filter(t=>!known.has(t.name.trim().toLowerCase().replace(/\s+/g,' '))).map(t=>({...t,vendorId:''}))]})}return json({...seed,revision:0})}
  if(action==='team'){const id=url.searchParams.get('id');await member(id,'owner');return json({members:await all('SELECT user_id,email,role FROM members WHERE company_id=?',id),invites:await all('SELECT id,email,role,expires_at FROM invites WHERE company_id=? AND accepted_by IS NULL AND expires_at>?',id,now())})}
  if(action==='history'){const p=await project(url.searchParams.get('id'));return json({versions:await all('SELECT id,revision,saved_at,saved_by FROM snapshots WHERE project_id=? ORDER BY revision DESC LIMIT 50',p.id)})}
  throw new HttpError(404,'Unknown request.');
 }
 requireValue(request.method==='POST','Method not allowed.',405);checkMutation(request);const raw=await request.text();requireValue(raw.length<=900000,'Request too large.',413);let b;try{b=JSON.parse(raw)}catch{throw new HttpError(400,'Invalid JSON.')}
 if(action==='company'){
  const count=await first('SELECT COUNT(*) AS n FROM members WHERE user_id=? AND role=?',user.userId,'owner');requireValue(count.n<20,'Workspace limit reached.');
  const id=crypto.randomUUID(),name=label(b.name),time=now();await db.batch([q('INSERT INTO companies(id,name,created_at) VALUES(?,?,?)',id,name,time),q('INSERT INTO members(company_id,user_id,email,role,joined_at) VALUES(?,?,?,?,?)',id,user.userId,user.email.toLowerCase(),'owner',time)]);return json({id});
 }
 if(action==='saveCommunityVendors'){
  await member(b.companyId,'edit');const key=communityKey(label(b.community));requireValue(Number.isInteger(b.revision)&&b.revision>=0,'Invalid shared directory revision.');
  const checked=validateState({version:1,workweekVersion:1,base:'2026-01-01',project:{lot:'',address:''},rules:[],vendors:b.vendors,tasks:b.tasks});
  const ids=new Set(checked.vendors.map(v=>v.id));requireValue(checked.tasks.every(t=>!t.vendorId||ids.has(t.vendorId)),'Choose a directory vendor for every assignment.');
  const data=JSON.stringify({vendors:checked.vendors,tasks:checked.tasks.map(t=>({id:t.id,name:t.name,type:t.type,day:1,duration:1,vendorId:t.vendorId||''}))});
  const result=b.revision===0?await q('INSERT OR IGNORE INTO community_vendors(company_id,community,data,revision,updated_at) VALUES(?,?,?,1,?) RETURNING revision',b.companyId,key,data,now()).all():await q('UPDATE community_vendors SET data=?,revision=revision+1,updated_at=? WHERE company_id=? AND community=? AND revision=? RETURNING revision',data,now(),b.companyId,key,b.revision).all();
  const revision=result.results?.[0]?.revision;
  requireValue(revision,'Community vendors changed elsewhere. Close and reopen this panel before saving.',409);return json({revision});
 }
 if(action==='createProject'){
  await member(b.companyId,'edit');const count=await first('SELECT COUNT(*) AS n FROM projects WHERE company_id=?',b.companyId);requireValue(count.n<100,'Project limit reached.');
  const id=crypto.randomUUID();await q('INSERT INTO projects(id,company_id,name,data,revision,updated_at,updated_by) VALUES(?,?,?,?,?,?,?)',id,b.companyId,label(b.name),JSON.stringify(validateState(await hydrate(b.companyId,validateState(b.state)))),1,now(),user.email).run();return json({id,revision:1});
 }
 if(action==='save'||action==='restore'){
  const p=await project(b.id,'edit');requireValue(Number.isInteger(b.revision),'Missing project revision.');
  let data;if(action==='restore'){const snap=await first('SELECT data FROM snapshots WHERE id=? AND project_id=?',b.snapshotId,p.id);requireValue(snap,'Backup not found.',404);data=JSON.stringify(validateState(JSON.parse(snap.data)))}else data=JSON.stringify(validateState(await hydrate(p.company_id,validateState(b.state))));
  const permitted="EXISTS (SELECT 1 FROM members WHERE company_id=projects.company_id AND user_id=? AND role IN ('owner','editor'))";
  const results=await db.batch([
   q("INSERT INTO snapshots(id,project_id,revision,data,saved_at,saved_by) SELECT ?,id,revision,data,updated_at,updated_by FROM projects WHERE id=? AND revision=? AND "+permitted,crypto.randomUUID(),p.id,b.revision,user.userId),
   q('UPDATE projects SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND '+permitted+' RETURNING revision',data,now(),user.email,p.id,b.revision,user.userId),
   q('DELETE FROM snapshots WHERE project_id=? AND id NOT IN (SELECT id FROM snapshots WHERE project_id=? ORDER BY revision DESC LIMIT 50)',p.id,p.id)
  ]);
  requireValue(results[1].results?.length,'This project changed elsewhere. Download your changes, then reload the cloud version before editing.',409);
  return json({revision:results[1].results[0].revision,...(action==='restore'?{state:JSON.parse(data)}:{})});
 }
 if(action==='invite'){
  await member(b.companyId,'owner');const email=label(b.email,254).toLowerCase();requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email.');requireValue(['editor','viewer'].includes(b.role),'Choose Editor or Viewer.');
  const count=await first('SELECT COUNT(*) AS n FROM invites WHERE company_id=? AND accepted_by IS NULL AND expires_at>?',b.companyId,now());requireValue(count.n<30,'Revoke old invitations before creating more.');
  const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),expires=new Date(Date.now()+7*86400000).toISOString();
  await q('INSERT INTO invites(id,company_id,email,role,token_hash,expires_at,created_by) VALUES(?,?,?,?,?,?,?)',id,b.companyId,email,b.role,await hash(token),expires,user.userId).run();
  return json({url:url.origin+'/?invite='+encodeURIComponent(token),email,expiresAt:expires});
 }
 if(action==='join'){
  requireValue(typeof b.token==='string'&&b.token.length<200,'Invalid invitation.');const i=await first('SELECT * FROM invites WHERE token_hash=?',await hash(b.token));
  requireValue(i&&!i.accepted_by&&i.expires_at>now(),'Invitation has expired or was already used.',410);requireValue(i.email===user.email.toLowerCase(),'Sign in with the email address this invitation was sent to.',403);
  await db.batch([q("INSERT OR IGNORE INTO members(company_id,user_id,email,role,joined_at) SELECT company_id,?,?,role,? FROM invites WHERE id=? AND accepted_by IS NULL AND expires_at>?",user.userId,user.email.toLowerCase(),now(),i.id,now()),q('UPDATE invites SET accepted_by=? WHERE id=? AND accepted_by IS NULL',user.userId,i.id)]);
  return json({companyId:i.company_id});
 }
 if(action==='revoke'){await member(b.companyId,'owner');await q('DELETE FROM invites WHERE id=? AND company_id=?',b.inviteId,b.companyId).run();return json({ok:true})}
 if(action==='member'){
  await member(b.companyId,'owner');const target=await first('SELECT role FROM members WHERE company_id=? AND user_id=?',b.companyId,b.userId);requireValue(target&&target.role!=='owner','The workspace owner cannot be removed or demoted.');
  if(b.role==='remove')await q('DELETE FROM members WHERE company_id=? AND user_id=?',b.companyId,b.userId).run();else{requireValue(['editor','viewer'].includes(b.role),'Invalid role.');await q('UPDATE members SET role=? WHERE company_id=? AND user_id=?',b.role,b.companyId,b.userId).run()}return json({ok:true});
 }
 throw new HttpError(404,'Unknown request.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Cloud request failed',e.message);return json({error:'Cloud service unavailable. Your unsaved changes are still on this screen. Try again.'},503)}}
