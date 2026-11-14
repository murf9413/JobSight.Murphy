import {createSupabaseServer} from '../../../lib/supabase/server';
import {handleSupabaseCloud} from '../../../server/supabase-cloud.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(request:Request){
 try{const supabase=await createSupabaseServer();const {data:{user},error}=await supabase.auth.getUser();return handleSupabaseCloud(request,supabase,error?null:user);}
 catch{return Response.json({error:'Cloud service is unavailable. Try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;
export const POST=handle;
