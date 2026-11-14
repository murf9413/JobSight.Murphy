import {dateFor} from './dates.js';
import {taskFinish} from './workdays.js';

// Send only the dates and labels needed by the dashboard, never full task notes.
export function statusTasks(state) {
 return (state.tasks || []).map(t => ({name:t.name,start:dateFor(state.base,t.day),finish:taskFinish(t,state.base),completed:!!t.completed}));
}
export function jobStatus(tasks=[],today) {
 const pending=tasks.filter(t=>!t.completed);
 const upcoming=pending.filter(t=>t.finish>=today).sort((a,b)=>a.start.localeCompare(b.start));
 const closing=tasks.filter(t=>/^(closing|close)\b/i.test(t.name)).sort((a,b)=>a.finish.localeCompare(b.finish)).at(-1);
 return {next:upcoming[0]||null,overdue:pending.filter(t=>t.finish<today).length,closing:closing?.finish||null};
}
