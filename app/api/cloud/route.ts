import{env}from'cloudflare:workers';
import{getChatGPTUser}from'../../chatgpt-auth';
import{handleCloud}from'../../../server/cloud.js';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleCloud(request,env.DB,await getChatGPTUser())}
export async function POST(request:Request){return handleCloud(request,env.DB,await getChatGPTUser())}
