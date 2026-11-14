import React,{useState,useEffect,useCallback}from'react';
import Scheduler from './main';
import{dateFor}from'./dates';
import{taskFinish}from'./workdays';
export default function RolePreview({role,projects,api,onExit}){
 const[jobs,setJobs]=useState(null),[error,setError]=useState(''),[vendor,setVendor]=useState(''),[selected,setSelected]=useState('');
 useEffect(()=>{let active=true;Promise.all(projects.filter(p=>!p.archived).map(p=>api('project&id='+encodeURIComponent(p.id)))).then(rows=>{if(active)setJobs(structuredClone(rows))}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[projects,api]);
 const update=useCallback(state=>setJobs(rows=>rows.map(p=>p.id===selected?{...p,state}:p)),[selected]);
 if(error)return <section className="cloud-card"><p role="alert">{error}</p><button onClick={onExit}>Return to Admin</button></section>;
 if(!jobs)return <p className="cloud-card" role="status">Loading preview…</p>;
 const vendors=[...new Set(jobs.flatMap(p=>p.state.vendors.map(v=>v.name.trim())).filter(Boolean))].sort();
 const current=jobs.find(p=>p.id===selected);
 if(role==='pjm'&&current)return <><button className="preview-back" onClick={()=>setSelected('')}>← PJM jobs</button><Scheduler key={current.id} initialState={current.state} onStateChange={update} onBeforeAction={async()=>{}} onNavigate={()=>setSelected('')} externalStatus="Preview only · live schedule unchanged" scheduleLabel={current.name} settingsPanel={<p>Preview changes are temporary. Team administration is available in Admin view.</p>}/></>;
 return <main className="cloud-home"><section className="cloud-card"><h1>{role==='vendor'?'Vendor tasks':'PJM workspace'}</h1><p>{role==='vendor'?'View assigned work and mark tasks complete.':'Open a job to interact with its schedule, dates and task completions.'}</p>{role==='vendor'&&<label>Preview vendor<select value={vendor} onChange={e=>setVendor(e.target.value)}><option value="">Select a vendor</option>{vendors.map(v=><option key={v}>{v}</option>)}</select></label>}
 {role==='pjm'?jobs.map(p=><button className="preview-job" key={p.id} onClick={()=>setSelected(p.id)}><strong>{p.name}</strong><span>{p.state.project.address||'Address not set'}</span><small>{p.state.tasks.filter(t=>t.completed).length} / {p.state.tasks.length} complete</small></button>):vendor?jobs.map(p=>{const ids=new Set(p.state.vendors.filter(v=>v.name.trim()===vendor).map(v=>v.id));const tasks=p.state.tasks.filter(t=>ids.has(t.vendorId));if(!tasks.length)return null;return <section className="preview-job" key={p.id}><h2>{p.name}</h2><p>{p.state.project.address}</p>{tasks.map(t=><label className="preview-task" key={t.id}><input type="checkbox" checked={!!t.completed} onChange={e=>{const completed=e.target.checked;setJobs(rows=>rows.map(j=>j.id===p.id?{...j,state:{...j.state,tasks:j.state.tasks.map(x=>x.id===t.id?{...x,completed}:x)}}:j))}}/><span><strong>{t.name}</strong><small>{dateFor(p.state.base,t.day)} – {taskFinish(t,p.state.base)}</small>{t.note&&<small>{t.note}</small>}</span></label>)}</section>}):<p>Select a vendor to see only their assigned tasks.</p>}
 {!jobs.length&&<p>No active jobs to preview.</p>}{role==='vendor'&&!vendors.length&&<p>Add vendors and assign tasks in Admin to populate this view.</p>}
 </section></main>
}
