import{addDays}from'./dates.js';
import{taskDays,nextWorkday}from'./workdays.js';
import{rebaseTasks}from'./engine.js';
import{applyRules}from'./rules.js';
export const communityName=p=>p.community?.trim()||'Unassigned community';
export function monday(date){const d=new Date(date+'T00:00:00Z').getUTCDay();return addDays(date,-((d+6)%7))}
export function duplicateSchedule(source,details,start){
 const copy=structuredClone(source),base=nextWorkday(start);
 const clean=copy.tasks.map(t=>({...t,locked:false,completed:false,confirmed:false,acceptedFor:null,note:'',callout:'',vendorOverride:false}));
 const tasks=applyRules(rebaseTasks(clean,copy.base,base),copy.rules||[],base);
 return{...copy,base,tasks,project:{pjm:details.pjm||'',psrDate:details.psrDate||'',product:details.product||'',basementType:details.basementType||'',lot:details.lot||'',address:details.address||'',permit:details.permit||'',unit:details.unit||'A',community:details.community||'',archived:false}};
}
export function weekTasks(projects,start){
 const end=addDays(start,6),events=[];
 for(const p of projects){const state=p.state;if(state.project.archived)continue;
 for(const t of state.tasks){const dates=taskDays(t,state.base).filter(d=>d>=start&&d<=end);if(!dates.length)continue;
 const vendor=state.vendors.find(v=>v.id===t.vendorId);
 for(const date of dates)events.push({projectId:p.id,projectName:p.name,taskId:t.id,date,name:t.name,type:t.type,completed:!!t.completed,locked:!!t.locked,note:!!t.note?.trim(),lot:state.project.lot,unit:state.project.unit||'A',address:state.project.address,community:communityName(state.project),vendor:vendor?.name?.trim()||'Unassigned'});
 }}return events.sort((a,b)=>a.date.localeCompare(b.date)||a.lot.localeCompare(b.lot,undefined,{numeric:true})||a.name.localeCompare(b.name));
}
