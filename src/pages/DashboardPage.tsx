import { AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Clock3, Server, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useNocStore } from '../store/useNocStore';
import { Badge, Card } from '../components/common/UI';
import { deriveStatistics, isActiveAlarm, isFormalAlarm } from '../store/selectors';

export function DashboardPage(){
 const alarms=useNocStore(s=>s.alarms);const devices=useNocStore(s=>s.devices);const incidents=useNocStore(s=>s.incidents);const nav=useNavigate();
 const ai=useNocStore(s=>s.aiDiagnosis);const realtimeState=useNocStore(s=>s.realtimeState);const formalAlarms=alarms.filter(isFormalAlarm);
 const summary=deriveStatistics(formalAlarms,devices,incidents);
 const pie=[{name:'Critical',value:summary.criticalCount,c:'#ff4d61'},{name:'Major',value:summary.majorCount,c:'#ff9f43'},{name:'Minor',value:summary.minorCount,c:'#f6c85f'},{name:'Warning',value:summary.warningCount,c:'#51a8ff'}];
 const hourly=[...Array(7)].map((_,index)=>{const date=new Date(Date.now()-(6-index)*3600_000);const h=date.getHours().toString().padStart(2,'0');return{h,n:formalAlarms.filter(alarm=>{const parsed=new Date(alarm.time);return !Number.isNaN(parsed.getTime())&&parsed.getHours()===date.getHours()}).length}});
 const weekly=[...Array(7)].map((_,index)=>{const date=new Date(Date.now()-(6-index)*86400_000);const d=`${date.getMonth()+1}/${date.getDate()}`;return{d,n:incidents.filter(incident=>{const parsed=new Date(incident.started);return !Number.isNaN(parsed.getTime())&&parsed.toDateString()===date.toDateString()}).length}});
 const displayTime=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:parsed.toLocaleString('zh-TW')};
 const stats:Array<[string,number,LucideIcon,string]>=[['Critical 告警',summary.criticalCount,AlertTriangle,'critical'],['Major 告警',summary.majorCount,AlertTriangle,'major'],['維護設備',summary.maintenanceCount,Wrench,'maintenance'],['正常設備',summary.normalDeviceCount,CheckCircle2,'normal'],['今日事件',summary.todayIncidentCount,Clock3,'info'],['影響設備',summary.affectedDeviceCount,Server,'neutral']];
 return <div className="page"><div className="page-title"><div><span className="eyebrow">OPERATIONS OVERVIEW</span><h1>儀表板</h1><p>告警、事件與設備狀態全部取自共用即時資料。</p></div><div className="live"><i className={realtimeState}/> {realtimeState==='connected'?'即時資料服務已連線':'正在重新連線'}</div></div>
  <div className="stats">{stats.map(([label,value,Icon,tone])=><Card key={label} className="stat"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong></div><small>共用即時資料統計</small></Card>)}</div>
  <div className="grid charts"><Card title="告警嚴重度分布"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={pie} dataKey="value" innerRadius={55} outerRadius={83}>{pie.map(item=><Cell key={item.name} fill={item.c}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="legend-row">{pie.map(item=><span key={item.name}><i style={{background:item.c}}/>{item.name} {item.value}</span>)}</div></Card>
  <Card title="每小時告警數量"><ResponsiveContainer width="100%" height={250}><BarChart data={hourly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="h"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="n" fill="#28c5c7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></Card>
  <Card title="最近七天事件趨勢"><ResponsiveContainer width="100%" height={250}><LineChart data={weekly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="d"/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="n" stroke="#8a7dff" strokeWidth={3}/></LineChart></ResponsiveContainer></Card></div>
  <Card title="AI Copilot 即時摘要" action={<button className="link-btn" onClick={()=>nav('/diagnosis')}>開啟診斷<ArrowUpRight/></button>}><div className="dashboard-ai"><Bot/><div><small>Likely Root Cause</small><strong>{ai?.root_cause||ai?.likely_cause||'等待目前告警分析結果'}</strong></div><span><b>{ai?Math.round(ai.confidence*100):'--'}%</b> Confidence</span><span><b>{ai?.impacted_devices?.length??summary.affectedDeviceCount}</b> Impacted Devices</span></div></Card>
  <Card title="目前重大事件" action={<button className="link-btn" onClick={()=>nav('/incidents')}>查看所有事件 <ArrowUpRight/></button>}><div className="major-events">{incidents.filter(incident=>incident.severity==='Critical'&&alarms.some(alarm=>alarm.incidentId===incident.id&&isActiveAlarm(alarm))).map(incident=><button key={incident.id} onClick={()=>nav('/incidents')}><div><Badge tone="critical">Critical</Badge><strong>{incident.title}</strong><small>{incident.id} · {displayTime(incident.started)}</small></div><div className="event-impact"><span>影響設備 <b>{incident.affectedDevices}</b></span><Badge tone="info">{incident.status}</Badge></div></button>)}</div></Card>
 </div>
}
