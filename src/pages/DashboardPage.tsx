import { AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Clock3, Server, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useNocStore } from '../store/useNocStore';
import { Badge, Card } from '../components/common/UI';
import { LocalMonitorCard } from '../components/monitoring/LocalMonitorCard';
const hourly=[{h:'06',n:2},{h:'07',n:4},{h:'08',n:8},{h:'09',n:14},{h:'10',n:7},{h:'11',n:5},{h:'12',n:3}];
const weekly=[{d:'7/19',n:5},{d:'7/20',n:8},{d:'7/21',n:6},{d:'7/22',n:11},{d:'7/23',n:7},{d:'7/24',n:9},{d:'7/25',n:4}];
export function DashboardPage(){
 const alarms=useNocStore(s=>s.alarms);const devices=useNocStore(s=>s.devices);const incidents=useNocStore(s=>s.incidents);const nav=useNavigate();
 const ai=useNocStore(s=>s.aiDiagnosis);
 const count=(s:string)=>alarms.filter(a=>a.severity===s&&a.status!=='已恢復').length; const pie=[{name:'Critical',value:count('Critical'),c:'#ff4d61'},{name:'Major',value:count('Major'),c:'#ff9f43'},{name:'Minor',value:count('Minor'),c:'#f6c85f'},{name:'Warning',value:count('Warning'),c:'#51a8ff'}];
 const stats:Array<[string,number,LucideIcon,string]>=[['Critical 告警',count('Critical'),AlertTriangle,'critical'],['Major 告警',count('Major'),AlertTriangle,'major'],['維護設備',devices.filter(d=>d.status==='maintenance').length,Wrench,'maintenance'],['正常設備',devices.filter(d=>d.status==='normal').length,CheckCircle2,'normal'],['今日事件',incidents.length,Clock3,'info'],['尚未處理',incidents.filter(i=>i.status==='收到告警').length,Server,'neutral']];
 return <div className="page"><div className="page-title"><div><span className="eyebrow">OPERATIONS OVERVIEW</span><h1>儀表板</h1><p>掌握全區告警、事件與設備健康狀態。</p></div><div className="live"><i/> 即時模擬資料</div></div>
  <div className="stats">{stats.map(([l,v,I,t])=><Card key={l} className="stat"><div className={`stat-icon ${t}`}><I size={20}/></div><div><span>{l}</span><strong>{v}</strong></div><small>較前一小時 <b>+1</b></small></Card>)}</div>
  <div className="grid charts"><Card title="告警嚴重度分布"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={pie} dataKey="value" innerRadius={55} outerRadius={83}>{pie.map(x=><Cell key={x.name} fill={x.c}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="legend-row">{pie.map(x=><span key={x.name}><i style={{background:x.c}}/>{x.name} {x.value}</span>)}</div></Card>
  <Card title="每小時告警數量"><ResponsiveContainer width="100%" height={250}><BarChart data={hourly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="h"/><YAxis/><Tooltip/><Bar dataKey="n" fill="#28c5c7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></Card>
  <Card title="最近七天事件趨勢"><ResponsiveContainer width="100%" height={250}><LineChart data={weekly}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="d"/><YAxis/><Tooltip/><Line type="monotone" dataKey="n" stroke="#8a7dff" strokeWidth={3}/></LineChart></ResponsiveContainer></Card></div>
  <LocalMonitorCard/>
  <Card title="AI Copilot 即時摘要" action={<button className="link-btn" onClick={()=>nav('/diagnosis')}>開啟診斷<ArrowUpRight/></button>}><div className="dashboard-ai"><Bot/><div><small>Likely Root Cause</small><strong>{ai?.root_cause||ai?.likely_cause||'等待下一筆即時告警分析'}</strong></div><span><b>{ai?Math.round(ai.confidence*100):'--'}%</b> Confidence</span><span><b>{ai?.impacted_devices?.length??0}</b> Impacted Devices</span></div></Card>
  <Card title="目前重大事件" action={<button className="link-btn" onClick={()=>nav('/incidents')}>查看所有事件 <ArrowUpRight/></button>}><div className="major-events">{incidents.filter(i=>i.severity==='Critical').map(i=><button key={i.id} onClick={()=>nav('/incidents')}><div><Badge tone="critical">Critical</Badge><strong>{i.title}</strong><small>{i.id} · {i.started}</small></div><div className="event-impact"><span>影響設備 <b>{i.affectedDevices}</b></span><span>模擬使用者 <b>{i.affectedUsers}</b></span><Badge tone="info">{i.status}</Badge></div></button>)}</div></Card>
 </div>
}
