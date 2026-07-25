import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { DeviceStatus, Severity } from '../../types';

export function Card({title,children,action,className=''}:{title?:string;children:ReactNode;action?:ReactNode;className?:string}){
 return <section className={`card ${className}`}>{(title||action)&&<header className="card-head"><h2>{title}</h2>{action}</header>}{children}</section>;
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
export const severityTone=(s:Severity)=>s.toLowerCase();
export const statusLabel:Record<DeviceStatus,string>={normal:'正常',incident:'障礙',maintenance:'維護',unknown:'未知'};
export function Status({status}:{status:DeviceStatus}){return <Badge tone={status}>{status==='incident'?<AlertTriangle size={13}/>:status==='normal'?<CheckCircle2 size={13}/>:<Info size={13}/>} {statusLabel[status]}</Badge>}
export function Empty({text='目前沒有資料'}:{text?:string}){return <div className="empty"><Info size={28}/><p>{text}</p></div>}
