import type {Metadata} from 'next';
import '../src/style.css';
export const metadata:Metadata={title:'JobSight · Construction scheduling',description:'Construction schedules, private company workspaces, and coordinated teams.'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
