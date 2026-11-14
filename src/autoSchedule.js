import{dateFor,daysBetween}from'./dates.js';
import{taskFinish,taskDays,nextWorkday,workDistance,shiftWorkdays}from'./workdays.js';
// Move overlap-connected blocks as a unit. Never create new overlaps or alter
// existing relative spacing inside a block. Locked/completed blocks stay fixed.
function compact(tasks){
 if(!tasks.length)return{tasks:[],changes:[],daysSaved:0,pinnedBlocks:0};
 const sorted=[...tasks].sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 const blocks=[];
 for(const t of sorted){
  if(!Number.isInteger(t.day)||!Number.isInteger(t.duration)||t.duration<1)throw Error('Each step needs a valid starting day and duration.');
  const last=blocks.at(-1);
  if(last&&t.day<last.end){last.tasks.push(t);last.end=Math.max(last.end,t.day+t.duration);last.pinned ||= !!(t.locked||t.completed)}
  else blocks.push({start:t.day,end:t.day+t.duration,tasks:[t],pinned:!!(t.locked||t.completed)});
 }
 let cursor=blocks[0].start;const days=new Map();
 for(const block of blocks){const start=block.pinned?block.start:cursor;const shift=start-block.start;for(const t of block.tasks)days.set(t.id,t.day+shift);cursor=block.end+shift;}
 const next=tasks.map(t=>days.get(t.id)===t.day?t:{...t,day:days.get(t.id)});
 const changes=next.filter((t,i)=>t.day!==tasks[i].day).map(t=>({id:t.id,name:t.name,from:tasks.find(x=>x.id===t.id).day,to:t.day}));
 const oldEnd=Math.max(...tasks.map(t=>t.day+t.duration));const newEnd=Math.max(...next.map(t=>t.day+t.duration));
 return{tasks:next,changes,daysSaved:oldEnd-newEnd,pinnedBlocks:blocks.filter(b=>b.pinned).length};
}

export function autoSchedule(tasks,base,rules=[]){
 const paired=new Set(rules.flatMap(r=>[r.source,r.target]));
 if(!tasks.length)return compact(tasks);
 const origin=nextWorkday(dateFor(base,Math.min(...tasks.map(t=>t.day))));
 const virtual=tasks.map(t=>({...t,day:workDistance(origin,dateFor(base,t.day))+1,duration:Math.max(1,workDistance(dateFor(base,t.day),taskFinish(t,base))+1),locked:!!(paired.has(t.id)||t.locked||t.allowNonWorking||t.calendarDuration)}));
 const result=compact(virtual);
 const next=tasks.map((t,i)=>result.tasks[i].day===virtual[i].day?t:{...t,day:daysBetween(base,shiftWorkdays(origin,result.tasks[i].day-1))+1});
 const intersects=(a,b)=>a.filter(d=>b.includes(d)).length;const oldDays=tasks.map(t=>taskDays(t,base)),newDays=next.map(t=>taskDays(t,base));
 for(let i=0;i<tasks.length;i++)for(let j=i+1;j<tasks.length;j++)if(intersects(oldDays[i],oldDays[j])!==intersects(newDays[i],newDays[j]))return{tasks,changes:[],daysSaved:0,pinnedBlocks:result.pinnedBlocks,reason:'Fixed non-working-day exceptions prevent safe compression. No changes proposed.'};
 const changes=next.filter((t,i)=>t.day!==tasks[i].day).map(t=>({id:t.id,name:t.name,from:tasks.find(x=>x.id===t.id).day,to:t.day}));
 const oldEnd=tasks.map(t=>taskFinish(t,base)).sort().at(-1),newEnd=next.map(t=>taskFinish(t,base)).sort().at(-1);
 return{tasks:next,changes,daysSaved:daysBetween(newEnd,oldEnd),pinnedBlocks:result.pinnedBlocks};
}
