import React from 'react';
export default function DUC({metric,detail=false}){
 const value=metric?.value,label=value==null?'—':value>0?'+'+value:String(value);
 const explanation=metric?`${metric.allowed} template days − ${metric.actual} construction days (${metric.start} to ${metric.finish}). Calendar days. ${metric.projected?'Projected from scheduled finish.':'Completed schedule.'}`:'DUC unavailable: construction dates are missing or invalid.';
 return <span className={'duc '+(value>0?'duc-positive':value<0?'duc-negative':'duc-neutral')} title={explanation} aria-label={'DUC '+label+'. '+explanation}><strong>DUC {label}</strong>{detail&&<small>{metric?`${metric.allowed} allowed − ${metric.actual} construction days${metric.projected?' · projected':''}`:'Dates unavailable'}</small>}</span>;
}
