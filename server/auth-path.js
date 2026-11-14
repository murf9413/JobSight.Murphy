export function safeReturnTo(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '/';
 try{const u=new URL(value,'https://jobsight.invalid');return u.origin==='https://jobsight.invalid'&&!u.pathname.startsWith('/auth/')?u.pathname+u.search+u.hash:'/'}catch{return '/'}
}
