import{portalURL}from'../src/taskTools.js';
import{ruleGroups}from'../src/rules.js';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export function requireValue(ok,message,status=400){if(!ok)throw new HttpError(status,message)}
export function label(v,max=120){requireValue(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,'Enter a valid name.');return v.trim()}
export function validateState(p){
 requireValue(p&&p.version===1&&p.workweekVersion===1&&/^\d{4}-\d{2}-\d{2}$/.test(p.base)&&!isNaN(Date.parse(p.base)),'Invalid schedule format.');
 requireValue(Array.isArray(p.tasks)&&p.tasks.length<=2000&&Array.isArray(p.rules)&&p.rules.length<=5000&&Array.isArray(p.vendors)&&p.vendors.length<=1000,'Invalid schedule lists.');
 if(p.ducTemplate!==undefined){requireValue(p.ducTemplate&&typeof p.ducTemplate==='object'&&!('ducTemplate' in p.ducTemplate),'Invalid DUC template.');validateState({...p,base:p.ducTemplate.base,tasks:p.ducTemplate.tasks,rules:[],ducTemplate:undefined});}
 const ids=new Set();for(const t of p.tasks){requireValue(t&&typeof t.id==='string'&&t.id.length<=100&&!ids.has(t.id),'Duplicate or invalid step ID.');ids.add(t.id);label(t.name,200);requireValue(Number.isInteger(t.day)&&Math.abs(t.day)<=36500&&Number.isInteger(t.duration)&&t.duration>=1&&t.duration<=365,'Invalid step date or duration.');requireValue(['Labor','Delivery','Inspection','Exterior','Utility','Milestone'].includes(t.type),'Invalid step type.');requireValue(!t.note||typeof t.note==='string'&&t.note.length<=10000,'Step note is too long.');requireValue(t.callout===undefined||typeof t.callout==='string'&&t.callout.length<=300,'Step callout is too long.');for(const field of ['workHolidays','vendorOverride','confirmed'])requireValue(t[field]===undefined||typeof t[field]==='boolean','Invalid step option.');}
 requireValue(!p.project?.portalUrl||typeof p.project.portalUrl==='string'&&p.project.portalUrl.length<=2000&&!!portalURL(p.project.portalUrl),'Invalid building portal link.');
 for(const v of p.vendors){requireValue(v&&typeof v.id==='string'&&v.id.length<=100&&typeof v.name==='string'&&v.name.length<=200,'Invalid vendor.');for(const field of ['email','phone','trade','contact'])requireValue(v[field]===undefined||typeof v[field]==='string'&&v[field].length<=500,'Invalid vendor details.')}
 for(const field of ['permit','community','pjm','product','basementType','psrDate'])requireValue(p.project?.[field]===undefined||typeof p.project[field]==='string'&&p.project[field].length<=120,'Invalid job details.');
 requireValue(p.project?.archived===undefined||typeof p.project.archived==='boolean','Invalid job status.');
 requireValue(p.project?.unit===undefined||typeof p.project.unit==='string'&&p.project.unit.length<=30,'Invalid unit label.');
 requireValue(p.project&&typeof p.project.lot==='string'&&p.project.lot.length<=100&&typeof p.project.address==='string'&&p.project.address.length<=500,'Invalid project details.');
 try{ruleGroups(p.tasks,p.rules)}catch(e){throw new HttpError(400,e.message)}
 requireValue(JSON.stringify(p).length<=800000,'Schedule is too large.');
 return p;
}
export function canEdit(role){return role==='owner'||role==='editor'}
export function authorize(role,needed='read'){requireValue(!!role,'Workspace not found.',404);requireValue(needed==='read'||needed==='edit'&&canEdit(role)||needed==='owner'&&role==='owner','Your workspace role does not allow this action.',403)}
export function checkMutation(request){const u=new URL(request.url);requireValue(request.headers.get('origin')===u.origin,'Invalid request origin.',403);requireValue(request.headers.get('content-type')?.startsWith('application/json'),'JSON is required.',415)}
