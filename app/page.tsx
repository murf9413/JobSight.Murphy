import CloudShell from '../src/CloudShell';
import{getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath}from'./chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <CloudShell user={user?{email:user.email,name:user.displayName}:null} signIn={chatGPTSignInPath('/')} signOut={chatGPTSignOutPath('/')}/>}
