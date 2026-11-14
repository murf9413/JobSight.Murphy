import {NextResponse} from 'next/server';
import {createSupabaseServer} from '../../../lib/supabase/server';
export async function POST(request:Request){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return new Response('Invalid origin',{status:403});
 const supabase=await createSupabaseServer();await supabase.auth.signOut();
 return NextResponse.redirect(new URL('/login',url.origin),303);
}
