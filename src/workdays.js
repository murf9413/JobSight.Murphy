import{addDays,daysBetween,dateFor}from'./dates.js';
const cache=new Map();
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const weekday=d=>new Date(d+'T00:00:00Z').getUTCDay();
export const weekend=d=>[0,6].includes(weekday(d));
function holidays(y){if(cache.has(y))return cache.get(y);const map={};const nth=(m,w,n)=>{let d=iso(y,m,1);return addDays(d,(w-weekday(d)+7)%7+7*(n-1))};for(const year of[y-1,y,y+1])for(const[m,d,name]of[[1,1,"New Year's Day"],[6,19,'Juneteenth'],[7,4,'Independence Day'],[11,11,'Veterans Day'],[12,25,'Christmas Day']]){const date=iso(year,m,d);map[date]=name;const w=weekday(date);if(w===6)map[addDays(date,-1)]=name+' (observed)';if(w===0)map[addDays(date,1)]=name+' (observed)'}for(const[m,w,n,name]of[[1,1,3,'Martin Luther King Jr. Day'],[2,1,3,"Washington’s Birthday"],[9,1,1,'Labor Day'],[10,1,2,'Columbus Day'],[11,4,4,'Thanksgiving']])map[nth(m,w,n)]=name;let memorial=iso(y,5,31);map[addDays(memorial,-((weekday(memorial)+6)%7))]='Memorial Day';cache.set(y,map);return map}
export const holiday=d=>holidays(Number(d.slice(0,4)))[d]||'';
export const workday=d=>!weekend(d)&&!holiday(d);
export function nextWorkday(d){while(!workday(d))d=addDays(d,1);return d}
export function shiftWorkdays(d,n){const direction=n<0?-1:1;for(let i=0;i<Math.abs(n);i++){do{d=addDays(d,direction)}while(!workday(d))}return d}
export function workDistance(a,b){if(a===b)return 0;const dir=a<b?1:-1;let count=0,d=a;while(d!==b){d=addDays(d,dir);if(workday(dir>0?d:addDays(d,1)))count+=dir}return count}
export function taskDays(t,base){const start=dateFor(base,t.day);if(t.calendarDuration)return Array.from({length:t.duration},(_,i)=>addDays(start,i));const dates=[start];for(let i=1;i<t.duration;i++)dates.push(t.allowNonWorking?addDays(dates.at(-1),1):(()=>{let d=addDays(dates.at(-1),1);while(weekend(d)||(!t.workHolidays&&holiday(d)))d=addDays(d,1);return d})());return dates}
export const taskFinish=(t,base)=>taskDays(t,base).at(-1);
export const taskEnd=(t,base)=>addDays(taskFinish(t,base),1);
export function exceptions(t,base){return taskDays(t,base).filter(d=>!workday(d)).map(d=>`${d}: ${holiday(d)||'Weekend'}`)}
export function migrateSchedule(p){if(p.workweekVersion===1)return p;const base=nextWorkday(p.base);const tasks=p.tasks.map(t=>{if(t.locked||t.completed)return{...t,day:daysBetween(base,dateFor(p.base,t.day))+1,calendarDuration:true};return{...t,day:daysBetween(base,shiftWorkdays(base,t.day-1))+1,cascade:true}});return{...p,base,tasks,workweekVersion:1}}
