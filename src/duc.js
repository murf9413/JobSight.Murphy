import template from './providedTemplate.json' with {type:'json'};
import {dateFor,daysBetween} from './dates.js';
import {taskFinish} from './workdays.js';
// Compare elapsed calendar days, including weekends, using the same start date.
export function constructionSpan(tasks,base){
 if(!base||!tasks?.length)return null;
 const startStep=tasks.find(t=>/dig|excavat|start date|start of construction/i.test(t.name));
 const endSteps=tasks.filter(t=>/^(closing|close|end of construction|construction complete)\b/i.test(t.name));
 const start=startStep?dateFor(base,startStep.day):tasks.map(t=>dateFor(base,t.day)).sort()[0];
 const finish=(endSteps.length?endSteps:tasks).map(t=>taskFinish(t,base)).sort().at(-1);
 const days=daysBetween(start,finish);
 return Number.isFinite(days)&&days>=0?{start,finish,days}:null;
}
export function constructionDUC(state){
 const actual=constructionSpan(state.tasks,state.base);
 const baseline=constructionSpan(state.ducTemplate?.tasks||template,state.ducTemplate?.base||state.base);
 if(!actual||!baseline)return null;
 return {value:baseline.days-actual.days,allowed:baseline.days,actual:actual.days,start:actual.start,finish:actual.finish,projected:!state.tasks.filter(t=>/^(closing|close|end of construction|construction complete)\b/i.test(t.name)).some(t=>t.completed)&&!state.tasks.every(t=>t.completed)};
}
