import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import type { DeviceStatus, Severity } from '../../types';

export function Card({title,children,action,className=''}:{title?:string;children:ReactNode;action?:ReactNode;className?:string}){
 return <section className={`card ${className}`}>{(title||action)&&<header className="card-head"><h2>{title}</h2>{action}</header>}{children}</section>;
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
export const severityTone=(s:Severity)=>s.toLowerCase();
export const statusLabel:Record<DeviceStatus,string>={normal:'正常',incident:'障礙',maintenance:'維護',unknown:'未知'};
export function Status({status}:{status:DeviceStatus}){return <Badge tone={status}>{status==='incident'?<AlertTriangle size={13}/>:status==='normal'?<CheckCircle2 size={13}/>:<Info size={13}/>} {statusLabel[status]}</Badge>}
export function Empty({text='目前沒有資料'}:{text?:string}){return <div className="empty"><Info size={28}/><p>{text}</p></div>}
export function PageSkeleton(){return <div className="page page-skeleton" aria-busy="true" aria-label="頁面載入中"><div className="skeleton skeleton-kicker"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-copy"/><div className="skeleton-stats">{Array.from({length:4},(_,i)=><div className="skeleton-card" key={i}><i className="skeleton"/><span><b className="skeleton"/><small className="skeleton"/></span></div>)}</div><div className="skeleton-panels"><div className="skeleton skeleton-panel"/><div className="skeleton skeleton-panel"/></div></div>}
type ErrorBoundaryState={error:Error|null};
export class ErrorBoundary extends Component<{children:ReactNode},ErrorBoundaryState>{
 state:ErrorBoundaryState={error:null};
 static getDerivedStateFromError(error:Error){return{error}}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('NOC UI error',error,info.componentStack)}
 render(){if(!this.state.error)return this.props.children;return <div className="error-boundary" role="alert"><div className="error-boundary-icon"><AlertTriangle/></div><span className="eyebrow">SYSTEM RECOVERY</span><h1>畫面暫時無法顯示</h1><p>介面發生未預期錯誤，告警資料不受影響。請重新載入後再試。</p><details><summary>技術資訊</summary><code>{this.state.error.message}</code></details><button className="btn primary" onClick={()=>window.location.reload()}><RefreshCw/>重新載入</button></div>}
}
