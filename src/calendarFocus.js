import{dateFor,addDays}from'./dates.js';
import{taskFinish}from'./workdays.js';
export function weekStart(date){const d=new Date(date+'T00:00:00Z').getUTCDay();return addDays(date,-((d+6)%7))}
export function openingDate(tasks,base,today){const dig=tasks.find(t=>t.id==='1')||tasks.find(t=>/excavat|dig.*start/i.test(t.name));const start=dig?dateFor(base,dig.day):base;const closing=tasks.filter(t=>/^(closing|close)\b/i.test(t.name)).sort((a,b)=>a.day-b.day).at(-1);const finished=closing?.completed||(tasks.length>0&&tasks.every(t=>t.completed));if(finished)return closing?taskFinish(closing,base):tasks.map(t=>taskFinish(t,base)).sort().at(-1);return today<start?start:today}
export const isOverdue=(task,base,today)=>!task.completed&&taskFinish(task,base)<today;
export function focusRange(bounds,date){return{start:date<bounds.start?date:bounds.start,end:date>=bounds.end?addDays(date,7):bounds.end}}
