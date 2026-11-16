import {createHash,randomBytes} from 'node:crypto';
import {constructionDUC} from '../src/duc.js';
import {statusTasks} from '../src/jobStatus.js';
import {weekTasks,monday} from '../src/jobs.js';
import {seedDirectory} from '../src/communityVendors.js';
import {HttpError,requireValue,label,validateState,checkMutation} from './validation.js';
const reads=new Set(['list','project','week','communityVendors','team','history','vendorJobs','vendorInbox','audit']);
const writes=new Set(['company','join','createProject','save','restore','saveCommunityVendors','invite','revoke','member','vendorAction','readVendorUpdate']);
const hash=token=>createHash('sha256').update(token).digest('hex');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export async function handleSupabaseCloud(request,supabase,user){try{
 if(!user)return json({error:'Sign in to use JobSight.'},401);
 const url=new URL(request.url),action=url.searchParams.get('action')||'list';let payload,token;
 if(request.method==='GET'){
  requireValue(reads.has(action),'Unknown request.',404);payload=Object.fromEntries(url.searchParams);delete payload.action;
  if(action==='communityVendors'){payload.communityName=payload.community;delete payload.community;payload.companyId=url.searchParams.get('company');}
  if(action==='week'){const start=payload.start;requireValue(/^\d{4}-\d{2}-\d{2}$/.test(start)&&!isNaN(Date.parse(start))&&new Date(start+'T00:00:00Z').toISOString().slice(0,10)===start,'Choose a valid week.');}
 }else{
  requireValue(request.method==='POST','Method not allowed.',405);checkMutation(request);requireValue(writes.has(action),'Unknown request.',404);
  const raw=await request.text();requireValue(raw.length<=900000,'Request is too large.',413);try{payload=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON.');}
  requireValue(payload&&typeof payload==='object'&&!Array.isArray(payload),'Invalid request.');
  if(['save','createProject'].includes(action))payload.state=validateState(payload.state);
  if(['company','createProject'].includes(action))payload.name=label(payload.name);
  if(['save','restore','saveCommunityVendors'].includes(action))requireValue(Number.isInteger(payload.revision)&&payload.revision>=0,'Missing revision.');
  if(action==='saveCommunityVendors'){
   payload.community=label(payload.community);
   const s=validateState({version:1,workweekVersion:1,base:'2026-01-01',project:{lot:'',address:''},tasks:payload.tasks,vendors:payload.vendors,rules:[]});
   const ids=new Set(s.vendors.map(v=>v.id));requireValue(s.tasks.every(t=>!t.vendorId||ids.has(t.vendorId)),'Choose a valid directory vendor.');
  }
  if(action==='invite'){token=randomBytes(32).toString('hex');payload.tokenHash=hash(token);payload.email=label(payload.email,254).toLowerCase();}
  if(action==='join'){requireValue(typeof payload.token==='string'&&/^[a-f0-9]{64}$/.test(payload.token),'Invalid invitation.');payload={tokenHash:hash(payload.token)};}
 }
 const {data,error}=await supabase.rpc('jobsight_api',{action,payload});
 if(error){const status=/^PT\d{3}$/.test(error.code)?Number(error.code.slice(2)):error.code==='42501'?403:400;return json({error:status>=500?'Cloud service unavailable.':/^PT\d{3}$/.test(error.code)?error.message:'The request could not be processed. Check the fields and retry.'},status);}
 if(action==='list')return json({...data,user:{email:user.email,name:user.email},projects:data.projects.map(({state,...p})=>({...p,...Object.fromEntries(['lot','address','permit','unit','community','pjm','psrDate','product','basementType','archived'].map(k=>[k,state.project[k]??''])),startDate:state.base,statusTasks:statusTasks(state),duc:constructionDUC(state)}))});
 if(action==='week')return json({events:weekTasks(data.projects,monday(payload.start))});
 if(action==='communityVendors'){
  const seed=seedDirectory(data.states);if(!data.directory)return json({...seed,revision:0});
  const key=t=>t.name.trim().toLowerCase().replace(/\s+/g,' '),known=new Set(data.directory.tasks.map(key));
  return json({...data.directory,tasks:[...data.directory.tasks,...seed.tasks.filter(t=>!known.has(key(t))).map(t=>({...t,vendorId:''}))]});
 }
 if(action==='invite')return json({...data,url:url.origin+'/?invite='+token});
 return json(data);
}catch(e){return json({error:e instanceof HttpError?e.message:'Cloud service is unavailable. Try again.'},e instanceof HttpError?e.status:503);}}
