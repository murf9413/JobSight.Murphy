import{useState,useEffect}from'react';
import{today}from'./dates';
import{createVendorDemo,vendorTrades}from'./vendorDemo';
export default function useVendorDemo(scope='demo'){
 const[base]=useState(today),[data,setData]=useState(()=>createVendorDemo(today())),[loaded,setLoaded]=useState(false),[storageError,setStorageError]=useState('');
 const key='jobsight-shared-role-demo-v2:'+scope;
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved?.data&&Object.keys(vendorTrades).every(k=>Array.isArray(saved.data[k])))setData(saved.data)}catch{setStorageError('Browser storage is unavailable. Sample changes may not survive switching views.')}setLoaded(true)},[key]);
 useEffect(()=>{if(loaded)try{sessionStorage.setItem(key,JSON.stringify({base,data}))}catch{setStorageError('Sample changes could not be saved in this browser.')}},[data,loaded,key,base]);
 return{base,data,setData,storageError};
}
