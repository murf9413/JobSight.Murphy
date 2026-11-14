import {NextResponse} from 'next/server';
import {createSupabaseServer} from '../../../lib/supabase/server';
import {safeReturnTo} from '../../../server/auth-path';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code');
 if(code){const supabase=await createSupabaseServer();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeReturnTo(url.searchParams.get('next')),url.origin));}
 return NextResponse.redirect(new URL('/login?error=verification',url.origin));
}
