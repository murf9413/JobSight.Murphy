import {NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {createSupabaseServer} from '../../../lib/supabase/server';
import {safeReturnTo} from '../../../server/auth-path';
export async function GET(request:Request){
 const url=new URL(request.url),token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 if(token_hash&&type&&['signup','invite','recovery','email','email_change'].includes(type)){
  const supabase=await createSupabaseServer();const {error}=await supabase.auth.verifyOtp({token_hash,type:type as EmailOtpType});
  if(!error)return NextResponse.redirect(new URL(safeReturnTo(url.searchParams.get('next')),url.origin));
 }
 return NextResponse.redirect(new URL('/login?error=verification',url.origin));
}
