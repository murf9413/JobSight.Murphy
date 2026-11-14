import test from 'node:test';
import assert from 'node:assert/strict';
import {statusTasks,jobStatus} from './jobStatus.js';
test('dashboard status respects working finish, overdue work, completed work and closing',()=>{
 const tasks=statusTasks({base:'2026-10-19',tasks:[{id:'1',name:'Excavate',day:1,duration:1,completed:true},{id:'2',name:'Soil',day:2,duration:1},{id:'3',name:'Walls',day:3,duration:5},{id:'4',name:'Closing',day:30,duration:1}]});
 const result=jobStatus(tasks,'2026-10-22');assert.equal(result.overdue,1);assert.equal(result.next.name,'Walls');assert.equal(result.next.finish,'2026-10-27');assert.equal(result.closing,'2026-11-17');
 assert.deepEqual(jobStatus([],'2026-10-22'),{next:null,overdue:0,closing:null});
 assert.equal(jobStatus(tasks.map(t=>({...t,completed:true})),'2026-12-01').overdue,0);
});
