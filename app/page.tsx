import CloudShell from '../src/CloudShell';
import {createSupabaseServer} from '../lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Page(){
 const supabase=await createSupabaseServer();
 const {data:{user}}=await supabase.auth.getUser();
 return <CloudShell user={user?{id:user.id,email:user.email||'',name:user.email||''}:null} signIn="/login" signOut="/auth/signout"/>;
}
