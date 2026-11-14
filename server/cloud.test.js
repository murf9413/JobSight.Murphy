import{test}from'node:test';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync,readdirSync}from'node:fs';import{handleCloud}from'./cloud.js';import{initialTasks}from'../src/data.js';import{migrateSchedule}from'../src/workdays.js';
function setup(){
 const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
 const db={prepare(sql){return{bind(...args){return{first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>({results:[],meta:sqlite.prepare(sql).run(...args)}),raw:()=>({results:sqlite.prepare(sql).all(...args)})}}}},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.raw());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const owner={userId:'owner',email:'owner@example.com',displayName:'Owner'},other={userId:'other',email:'other@example.com',displayName:'Other'};
 const call=async(action,body,user=owner,origin='https://jobsight.test')=>{const response=await handleCloud(new Request('https://jobsight.test/api/cloud?action='+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',Origin:origin}:undefined,body:body?JSON.stringify(body):undefined}),db,user);return{status:response.status,data:await response.json()}};
 const state=migrateSchedule({version:1,base:'2026-10-19',tasks:initialTasks,rules:[],vendors:[],project:{lot:'4',address:'Test address',unit:'A'}});
 return{sqlite,call,state,owner,other};
}
test('anonymous and cross-origin writes are rejected',async()=>{const{call}=setup();assert.equal((await call('list',null,null)).status,401);assert.equal((await call('company',{name:'Bad'},undefined,'https://attacker.test')).status,403)});
test('company isolation, invitation email matching, role enforcement and revocation',async()=>{
 const{call,state,other}=setup();const c=(await call('company',{name:'Company A'})).data.id;const p=(await call('createProject',{companyId:c,name:'Lot4',state})).data.id;
 assert.equal((await call('project&id='+p,null,other)).status,404);assert.deepEqual((await call('list',null,other)).data.projects,[]);
 const i=(await call('invite',{companyId:c,email:other.email,role:'viewer'})).data;
 const token=new URL(i.url).searchParams.get('invite');assert.equal((await call('join',{token})).status,403);
 assert.equal((await call('join',{token},other)).status,200);assert.equal((await call('join',{token},other)).status,410);
 assert.equal((await call('project&id='+p,null,other)).status,200);assert.equal((await call('save',{id:p,revision:1,state},other)).status,403);
 assert.equal((await call('team&id='+c,null,other)).status,403);assert.equal((await call('invite',{companyId:c,email:'new@example.com',role:'editor'},other)).status,403);
 await call('member',{companyId:c,userId:other.userId,role:'editor'});assert.equal((await call('save',{id:p,revision:1,state},other)).status,200);
 assert.equal((await call('member',{companyId:c,userId:'owner',role:'remove'})).status,400);
 await call('member',{companyId:c,userId:other.userId,role:'remove'});assert.equal((await call('project&id='+p,null,other)).status,404);
});
test('optimistic revisions prevent overwrite; backups and restore preserve previous data',async()=>{
 const{call,state}=setup();const c=(await call('company',{name:'A'})).data.id;const p=(await call('createProject',{companyId:c,name:'A',state})).data.id;
 const changed={...state,project:{...state.project,lot:'5'}};
 assert.equal((await call('save',{id:p,revision:1,state:changed})).data.revision,2);
 assert.equal((await call('save',{id:p,revision:1,state})).status,409);
 const h=(await call('history&id='+p)).data.versions;assert.equal(h.length,1);
 const restored=await call('restore',{id:p,revision:2,snapshotId:h[0].id});assert.equal(restored.data.revision,3);assert.equal(restored.data.state.project.lot,'4');
 assert.equal((await call('history&id='+p)).data.versions.length,2);
});
test('revoked and expired invitations do not grant access',async()=>{
 const{call,other,sqlite}=setup();const c=(await call('company',{name:'A'})).data.id;
 const inv=await call('invite',{companyId:c,email:other.email,role:'editor'});const token=new URL(inv.data.url).searchParams.get('invite');
 sqlite.exec("UPDATE invites SET expires_at='2000-01-01'");assert.equal((await call('join',{token},other)).status,410);
 const second=await call('invite',{companyId:c,email:other.email,role:'editor'});const id=(await call('team&id='+c)).data.invites[0].id;await call('revoke',{companyId:c,inviteId:id});
 assert.equal((await call('join',{token:new URL(second.data.url).searchParams.get('invite')},other)).status,410);
});
test('invalid schedule rejected; snapshot history is bounded to 50',async()=>{
 const{call,state}=setup();const c=(await call('company',{name:'A'})).data.id;const p=(await call('createProject',{companyId:c,name:'A',state})).data.id;
 assert.equal((await call('save',{id:p,revision:1,state:{...state,tasks:[{id:'bad'}]}})).status,400);
 for(let r=1;r<=53;r++)assert.equal((await call('save',{id:p,revision:r,state})).status,200);
 assert.equal((await call('history&id='+p)).data.versions.length,50);
});
test('dashboard exposes job metadata; community feed is restricted to company membership and respects archive status',async()=>{
 const{call,state,other}=setup();state.project={...state.project,community:'Birkdale',permit:'P-004',lot:'4',unit:'A'};
 const c=(await call('company',{name:'A'})).data.id;const p=(await call('createProject',{companyId:c,name:'Lot4',state})).data.id;
 const list=(await call('list')).data.projects;assert.equal(list[0].permit,'P-004');assert.equal(list[0].community,'Birkdale');assert.equal(list[0].lot,'4');
 assert.equal((await call('week&company='+c+'&start=2026-10-19',null,other)).status,404);
 assert.equal((await call('week&company='+c+'&start=invalid')).status,400);
 assert.ok((await call('week&company='+c+'&start=2026-10-19')).data.events.length>0);
 await call('save',{id:p,revision:1,state:{...state,project:{...state.project,archived:true}}});
 assert.equal((await call('list')).data.projects[0].archived,1);
 assert.deepEqual((await call('week&company='+c+'&start=2026-10-19')).data.events,[]);
});
test('community vendors synchronize existing and new jobs, retain explicit overrides, and enforce revision / access',async()=>{
 const{call,state,other}=setup();state.project.community='Birkdale';const c=(await call('company',{name:'Builders'})).data.id;
 const p=(await call('createProject',{companyId:c,name:'First',state})).data.id;
 const seed=(await call('communityVendors&company='+c+'&community=Birkdale')).data;
 const vendor={id:'shared-v',name:'Concrete Co',email:'crew@example.com'};const assignments=seed.tasks.map((t,i)=>({...t,vendorId:i===0?vendor.id:''}));
 const payload={companyId:c,community:'Birkdale',revision:0,vendors:[vendor],tasks:assignments};
 assert.equal((await call('saveCommunityVendors',payload,other)).status,404);
 assert.equal((await call('saveCommunityVendors',payload)).data.revision,1);
 assert.equal((await call('saveCommunityVendors',payload)).status,409);
 let opened=(await call('project&id='+p)).data;assert.equal(opened.state.tasks[0].vendorId,vendor.id);assert.equal(opened.state.vendors[0].name,vendor.name);
 const newJob=(await call('createProject',{companyId:c,name:'Second',state})).data.id;
 assert.equal((await call('project&id='+newJob)).data.state.tasks[0].vendorId,vendor.id);
 opened.state.tasks[0]={...opened.state.tasks[0],vendorId:'',vendorOverride:true};await call('save',{id:p,revision:opened.revision,state:opened.state});
 assert.equal((await call('project&id='+p)).data.state.tasks[0].vendorId,'');
 assert.equal((await call('saveCommunityVendors',{...payload,revision:1,vendors:[{...vendor,name:'Updated Concrete'}]})).data.revision,2);
 assert.equal((await call('project&id='+newJob)).data.state.vendors[0].name,'Updated Concrete');
 assert.equal((await call('saveCommunityVendors',{...payload,revision:1})).status,409);
 const otherCommunity={...state,project:{...state.project,community:'Other'}};const isolated=(await call('createProject',{companyId:c,name:'Third',state:otherCommunity})).data.id;assert.notEqual((await call('project&id='+isolated)).data.state.tasks[0].vendorId,vendor.id);
 const inv=(await call('invite',{companyId:c,email:other.email,role:'viewer'})).data;await call('join',{token:new URL(inv.url).searchParams.get('invite')},other);
 assert.equal((await call('communityVendors&company='+c+'&community=Birkdale',null,other)).status,200);assert.equal((await call('saveCommunityVendors',{...payload,revision:2},other)).status,403);
});
