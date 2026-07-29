import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Clipboard, Copy, ExternalLink, Filter, GitBranch, MessageSquarePlus, Phone, Plus, RefreshCw, Search, Send, ShieldAlert, Trash2, UserCheck, WifiOff, X } from 'lucide-react';
import { contacts, topologyLinks, topologyNodes } from '../data/mockData';
import { useNocStore } from '../store/useNocStore';
import type { Alarm, IncidentStatus } from '../types';
import { Badge, Card, Empty, severityTone, Status } from '../components/common/UI';
import { DiagnosisPanel } from '../components/diagnosis/DiagnosisPanel';
import { TestRunner } from '../components/testing/TestRunner';
import { fetchAnalysis, type AnalysisResponse } from '../api/analysis';
import { fetchLatestAlarm } from '../api/alarms';
import { fetchReport, type ReportResponse } from '../api/report';
import { ApiError } from '../lib/apiClient';

export function AlarmPage(){
 const alarms=useNocStore(s=>s.alarms),upsertAlarm=useNocStore(s=>s.upsertAlarm),selectedId=useNocStore(s=>s.selectedAlarmId),select=useNocStore(s=>s.selectAlarm),regionFilter=useNocStore(s=>s.regionFilter),setRegion=useNocStore(s=>s.setRegionFilter); const [q,setQ]=useState(''),[sev,setSev]=useState(''),[status,setStatus]=useState(''); const [liveAlarm,setLiveAlarm]=useState<Alarm|null>(null),[loading,setLoading]=useState(true),[apiError,setApiError]=useState('');
 const loadLatest=async()=>{setLoading(true);setApiError('');try{const alarm=await fetchLatestAlarm();setLiveAlarm(alarm);upsertAlarm(alarm)}catch(error){setApiError(error instanceof ApiError?error.message:'無法取得最新告警')}finally{setLoading(false)}};
 useEffect(()=>{void loadLatest()},[]);
 const displayAlarms=liveAlarm?[liveAlarm,...alarms.filter(a=>a.id!==liveAlarm.id)]:alarms;
 const filtered=displayAlarms.filter(a=>(!q||Object.values(a).join(' ').toLowerCase().includes(q.toLowerCase()))&&(!sev||a.severity===sev)&&(!regionFilter||a.region===regionFilter)&&(!status||a.status===status)); const selected=displayAlarms.find(a=>a.id===selectedId)??filtered[0];
 return <div className="page"><div className="page-title"><div><span className="eyebrow">ALARM COMMAND CENTER</span><h1>告警中心</h1><p>篩選、判讀並追蹤所有告警；FastAPI 無法連線時仍保留原有展示資料。</p></div><Badge tone="critical">{displayAlarms.filter(a=>a.status!=='已恢復').length} 筆作用中</Badge></div>
 <div className={`api-state ${apiError?'error':liveAlarm?'success':'loading'}`}>{loading?<><RefreshCw className="spin"/>正在讀取 NOC Lab 最新告警…</>:apiError?<><WifiOff/><span><b>FastAPI 暫時無法連線</b><small>{apiError}，目前顯示原有告警資料。</small></span><button className="btn small" onClick={()=>void loadLatest()}><RefreshCw/>重新連線</button></>:<><Check/><span><b>FastAPI 最新告警已同步</b><small>{liveAlarm?.deviceName} · {liveAlarm?.updated}</small></span><button className="btn small" onClick={()=>void loadLatest()}><RefreshCw/>重新整理</button></>}</div>
 <div className="toolbar"><label className="search"><Search/><input placeholder="搜尋設備、IP、告警內容…" value={q} onChange={e=>setQ(e.target.value)}/></label><Filter/><select value={sev} onChange={e=>setSev(e.target.value)}><option value="">所有嚴重度</option>{['Critical','Major','Minor','Warning','Normal'].map(x=><option key={x}>{x}</option>)}</select><select value={regionFilter} onChange={e=>setRegion(e.target.value)}><option value="">所有區域</option>{[...new Set(alarms.map(a=>a.region))].map(x=><option key={x}>{x}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">所有狀態</option>{[...new Set(alarms.map(a=>a.status))].map(x=><option key={x}>{x}</option>)}</select></div>
 <div className="split"><Card className="alarm-list" title={`告警列表（${filtered.length}）`}>{filtered.length?filtered.map(a=><button className={`alarm-item ${selected?.id===a.id?'selected':''}`} key={a.id} onClick={()=>select(a.id)}><div className={`sev-line ${severityTone(a.severity)}`}/><div><span><Badge tone={severityTone(a.severity)}>{a.severity}</Badge><b>{a.deviceName}</b></span><strong>{a.content}</strong><small>{a.id} · {a.region}/{a.site} · {a.time}</small></div><Status status={a.maintenance?'maintenance':a.status==='已恢復'?'normal':'incident'}/></button>):<Empty text="沒有符合條件的告警"/>}</Card>
 <aside className="right-stack">{selected&&<AlarmDetail alarm={selected}/>}<AlarmDiagnosis alarm={selected}/></aside></div></div>
}
function AlarmDiagnosis({alarm}:{alarm?:Alarm}){
 const[analysis,setAnalysis]=useState<AnalysisResponse|null>(null),[analysisState,setAnalysisState]=useState<'idle'|'loading'|'success'|'error'>('idle'),[analysisError,setAnalysisError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  if(!alarm){setAnalysis(null);setAnalysisState('idle');return()=>{active=false}}
  setAnalysis(null);setAnalysisState('loading');setAnalysisError('');
  void fetchAnalysis(alarm.deviceId).then(response=>{if(!active)return;setAnalysis(response);setAnalysisState('success')}).catch(error=>{if(!active)return;setAnalysis(null);setAnalysisState('error');setAnalysisError(error instanceof ApiError?error.message:'無法取得 AI 分析')});
  return()=>{active=false};
 },[alarm?.deviceId,alarm?.id,refresh]);
 return <DiagnosisPanel alarm={alarm} analysis={analysis} analysisState={analysisState} analysisError={analysisError} onRefresh={()=>setRefresh(value=>value+1)}/>;
}
function AlarmDetail({alarm}:{alarm:Alarm}){const device=useNocStore(s=>s.devices.find(d=>d.id===alarm.deviceId));return <Card title="告警詳細資料"><div className="detail-head"><Badge tone={severityTone(alarm.severity)}>{alarm.severity}</Badge><Status status={device?.status??'unknown'}/></div><h3>{alarm.content}</h3><dl className="detail-grid"><dt>設備</dt><dd>{alarm.deviceName}</dd><dt>IP 位址</dt><dd>{alarm.ip}</dd><dt>類型</dt><dd>{alarm.deviceType}</dd><dt>區域／局名</dt><dd>{alarm.region}／{alarm.site}</dd><dt>來源</dt><dd>{alarm.source}</dd><dt>負責人</dt><dd>{alarm.owner}</dd></dl>{device?.maintenance&&<div className="maintenance-note"><b>{device.maintenance.type}</b><br/>{device.maintenance.content}<br/>{device.maintenance.start}–{device.maintenance.end} · {device.maintenance.ticket}<br/>{device.maintenance.note}</div>}</Card>}

const states:IncidentStatus[]=['收到告警','AI 分析完成','查測中','等待設備管理員','確認原因','初報完成','持續追蹤','設備恢復','結報完成','事件關閉'];
const fastApiReportDeviceIds=new Set(['RTR-TP-NG-CORE-001','SW-TP-NG-DIST-001','OLT-TP-NG-ACCESS-001']);
export function IncidentsPage(){
 const incidents=useNocStore(s=>s.incidents),alarms=useNocStore(s=>s.alarms),update=useNocStore(s=>s.updateIncident),add=useNocStore(s=>s.addTimeline),notify=useNocStore(s=>s.notify);const[selected,setSelected]=useState(incidents[0]?.id??'');const[note,setNote]=useState('');const i=incidents.find(x=>x.id===selected)??incidents[0];const alarm=alarms.find(a=>a.incidentId===i?.id);
 const notification=(type:'初報'|'續報'|'結報')=>type==='初報'?`【網路障礙初報】\n事件編號：${i.id}\n發生時間：${i.started}\n障礙設備：${i.deviceId}\n告警內容：${alarm?.content}\n影響範圍：${i.affectedDevices} 台下游設備\n初步判斷：${i.cause}\n處理進度：${i.status}\n下次更新：30 分鐘內`:type==='續報'?`【網路障礙續報】\n事件編號：${i.id}\n目前原因：${i.cause}\n處理進度：${i.status}\n目前影響：${i.affectedDevices} 台設備\n預計恢復：評估中`:`【網路障礙結報】\n事件編號：${i.id}\n障礙原因：${i.cause}\n處理方式：更換 SFP 光模組\n影響設備：${i.affectedDevices} 台\n目前狀態：服務已恢復，告警已清除`;
 const [report,setReport]=useState<'初報'|'續報'|'結報'>('初報'); const [custom,setCustom]=useState('');
 const[apiReport,setApiReport]=useState<ReportResponse|null>(null),[reportState,setReportState]=useState<'idle'|'loading'|'success'|'error'>('idle'),[reportError,setReportError]=useState(''),[reportRefresh,setReportRefresh]=useState(0);
 const reportDeviceId=alarm?.deviceId||i?.deviceId||'';
 useEffect(()=>{
  let active=true;
  if(!reportDeviceId){setApiReport(null);setReportState('idle');return()=>{active=false}}
  setApiReport(null);setReportState('loading');setReportError('');
  void(async()=>{
   try{
    const targetDeviceId=fastApiReportDeviceIds.has(reportDeviceId)?reportDeviceId:(await fetchLatestAlarm()).deviceId;
    const response=await fetchReport(targetDeviceId);
    if(!active)return;
    setApiReport(response);setReportState('success');
   }catch(error){
    if(!active)return;
    setApiReport(null);setReportState('error');setReportError(error instanceof ApiError?error.message:'無法取得事件初報');
   }
  })();
  return()=>{active=false};
 },[reportDeviceId,reportRefresh]);
 if(!i)return <div className="page"><Empty text="目前沒有事件"/></div>;
 const generatedReport=report==='初報'&&apiReport?.report?apiReport.report:notification(report);
 return <div className="page"><div className="page-title"><div><span className="eyebrow">INCIDENT LIFECYCLE</span><h1>事件中心</h1><p>從告警接收到結報關閉，全程留下紀錄。</p></div></div><div className="incident-tabs">{incidents.map(x=><button key={x.id} className={x.id===i.id?'active':''} onClick={()=>setSelected(x.id)}><Badge tone={severityTone(x.severity)}>{x.severity}</Badge><b>{x.title}</b><small>{x.id}</small></button>)}</div>
 <Card title={i.title} action={<Badge tone="info">{i.status}</Badge>}><div className="stepper">{states.map((s,n)=>{const current=states.indexOf(i.status);return <div className={n<current?'done':n===current?'current':''} key={s}><i>{n<current?<Check size={14}/>:n+1}</i><span>{s}</span></div>})}</div><div className="toolbar"><select value={i.status} onChange={e=>update(i.id,e.target.value as IncidentStatus,'')} >{states.map(s=><option key={s}>{s}</option>)}</select><input placeholder="狀態更新備註" value={note} onChange={e=>setNote(e.target.value)}/><button className="btn" onClick={()=>{update(i.id,i.status,note||'新增處理備註');setNote('')}}>更新紀錄</button></div></Card>
 <div className="split equal"><Card title="事件時間軸" action={<button className="btn small" onClick={()=>{const t=prompt('輸入時間軸紀錄');if(t)add(i.id,t)}}><MessageSquarePlus/>新增</button>}><div className="timeline">{i.timeline.length?i.timeline.map(t=><div key={t.id}><i/><time>{t.time}</time><span><b>{t.text}</b><small>{t.actor}{t.from&&` · ${t.from} → ${t.to}`}</small></span></div>):<Empty/>}</div></Card>
 <Card title="Teams 通報產生器">{reportState!=='idle'&&<div className={`api-state ${reportState}`}>{reportState==='loading'?<RefreshCw className="spin"/>:reportState==='success'?<Check/>:<WifiOff/>}<span><b>{reportState==='loading'?'事件初報載入中':reportState==='success'?'FastAPI 事件初報已同步':'FastAPI 事件初報無法載入'}</b><small>{reportState==='error'?`${reportError}，目前顯示原有模擬初報。`:reportState==='success'?`${apiReport?.device_id} · 即時報告`:'正在產生選取設備報告…'}</small></span>{reportState!=='loading'&&<button className="btn small" onClick={()=>setReportRefresh(value=>value+1)}><RefreshCw/>重新整理</button>}</div>}<div className="segment">{(['初報','續報','結報'] as const).map(x=><button className={report===x?'active':''} onClick={()=>{setReport(x);setCustom('')}} key={x}>{x}</button>)}</div><textarea rows={12} value={custom||generatedReport} onChange={e=>setCustom(e.target.value)}/><div className="form-actions"><button className="btn primary" onClick={()=>navigator.clipboard.writeText(custom||generatedReport).then(()=>notify(`已複製${report}`))}><Copy/>一鍵複製</button><button className="btn" onClick={()=>add(i.id,`已產生並記錄${report}`)}><Clipboard/>加入時間軸</button></div><p className="disclaimer">僅產生模擬文字，不連接 Microsoft Teams API。</p></Card></div>
 <div className="split equal"><TestRunner incidentId={i.id}/><ContactPanel incidentId={i.id}/></div></div>
}
function ContactPanel({incidentId}:{incidentId:string}){const notify=useNocStore(s=>s.notify),add=useNocStore(s=>s.addTimeline);return <Card title="設備管理員聯絡資訊"><div className="contacts">{contacts.map(c=><div key={c.id}><b>第{['一','二','三'][c.priority-1]}順位 · {c.name}</b><span>{c.role} · {c.status}</span><small><Phone/> {c.phone}<br/><Send/> {c.teams}</small><div><button className="btn small" onClick={()=>navigator.clipboard.writeText(`${c.name}\n${c.phone}\n${c.teams}`).then(()=>notify('已複製聯絡資訊'))}><Copy/>複製</button><button className="btn small" onClick={()=>{add(incidentId,`已通知第${c.priority}順位 ${c.name}`);notify('通知時間已記錄')}}><UserCheck/>標記已通知</button></div></div>)}</div><p className="disclaimer">所有姓名與聯絡資訊皆為展示用假資料。</p></Card>}

export function DiagnosisPage(){const alarms=useNocStore(s=>s.alarms),id=useNocStore(s=>s.selectedAlarmId),select=useNocStore(s=>s.selectAlarm);const a=alarms.find(x=>x.id===id)??alarms[0];return <div className="page"><div className="page-title"><div><span className="eyebrow">RULE-BASED COPILOT</span><h1>AI 診斷工作台</h1><p>依模擬告警與查測規則產生可解釋的處理建議。</p></div></div><div className="toolbar"><select value={a?.id} onChange={e=>select(e.target.value)}>{alarms.map(x=><option value={x.id} key={x.id}>{x.id} · {x.deviceName}</option>)}</select></div><div className="split equal"><DiagnosisPanel alarm={a}/><TestRunner incidentId={a?.incidentId}/></div></div>}
