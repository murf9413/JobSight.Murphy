import template from './providedTemplate.json' with {type:'json'};
import{dateFor,daysBetween}from'./dates.js';
import{nextWorkday}from'./workdays.js';
export function digDate(state){const dig=state.tasks.find(t=>t.id==='1')||state.tasks.find(t=>/excavat|dig.*start/i.test(t.name));return dig?dateFor(state.base,dig.day):state.base}
export function revertTemplate(state,base){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(base)||!Number.isFinite(Date.parse(base)))throw Error('Choose a valid dig date.');
 const seen=new Set();const tasks=template.map(t=>{seen.add(t.id);const old=state.tasks.find(x=>x.id===t.id);if(old?.locked)return{...old,day:daysBetween(base,dateFor(state.base,old.day))+1};return{...t,callout:old?.callout||'',note:old?.note||'',vendorId:old?.vendorId||'',completed:old?.completed||false,day:t.day===1?1:daysBetween(base,t.allowNonWorking?dateFor(base,t.day):nextWorkday(dateFor(base,t.day)))+1}});
 for(const t of state.tasks)if(t.locked&&!seen.has(t.id))tasks.push({...t,day:daysBetween(base,dateFor(state.base,t.day))+1});
 return{...state,base,tasks,rules:[],ducTemplate:{base,tasks:template}};
}
