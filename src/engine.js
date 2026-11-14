import{applyRules,taskArea}from'./rules.js';
import {daysBetween,dateFor} from './dates.js';
import {taskFinish,workDistance,shiftWorkdays,nextWorkday} from './workdays.js';
export function descendants(tasks,id){const set=new Set();const visit=p=>tasks.filter(t=>t.parent===p).forEach(t=>{if(!set.has(t.id)){set.add(t.id);visit(t.id)}});visit(id);return set;}
export function updateTask(tasks,id,patch,base,scope='all',rules=[]){
 const old=tasks.find(t=>t.id===id);if(!old)throw Error('Step not found');const next={...old,...patch};
 if(!next.name.trim()||!Number.isInteger(next.day)||!Number.isInteger(next.duration)||next.duration<1)throw Error('Enter a name and a positive whole-day duration.');
 const changed=next.day!==old.day||next.duration!==old.duration||!!next.allowNonWorking!==!!old.allowNonWorking||!!next.workHolidays!==!!old.workHolidays;
 if(old.locked&&next.locked&&changed)throw Error('Unlock this step before changing its schedule.');
 if(!changed)return tasks.map(t=>t.id===id?next:t);
 delete next.calendarDuration;
 if(!base)throw Error('A project start date is required.');
 const delta=workDistance(taskFinish(old,base),taskFinish(next,base));
 const shifted=tasks.map(t=>{if(t.id===id)return next;if(t.locked||t.day<old.day||delta===0||scope==='none'||(scope!=='all'&&taskArea(t).toLowerCase()!==scope))return t;const start=nextWorkday(shiftWorkdays(dateFor(base,t.day),delta));return{...t,day:daysBetween(base,start)+1,allowNonWorking:false,calendarDuration:false}});
 return applyRules(shifted,rules,base,{preferredId:id,requirePreferred:true});
}
export function deleteTask(tasks,id){if(tasks.find(t=>t.id===id)?.locked)throw Error('Unlock this step before deleting it.');return tasks.filter(t=>t.id!==id).map(t=>t.parent===id?{...t,parent:''}:t)}
export function rebaseTasks(tasks,oldBase,newBase){const delta=workDistance(oldBase,nextWorkday(newBase));return tasks.map(t=>t.locked?{...t,day:daysBetween(newBase,dateFor(oldBase,t.day))+1}:{...t,day:daysBetween(newBase,nextWorkday(shiftWorkdays(dateFor(oldBase,t.day),delta)))+1,allowNonWorking:false,calendarDuration:false})}
