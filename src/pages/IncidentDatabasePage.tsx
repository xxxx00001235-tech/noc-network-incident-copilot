import { useEffect, useMemo, useState } from 'react';
import { fetchActiveIncidents, fetchIncidentHistory, type ApiIncident } from '../api/incidents';
import { Badge, Card, Empty } from '../components/common/UI';

function IncidentTable({items}:{items:ApiIncident[]}){
  if(!items.length)return <Empty text="沒有符合條件的事件"/>;
  return <div className="table-wrap"><table><thead><tr><th>事件</th><th>設備</th><th>嚴重度</th><th>狀態</th><th>開始／結束</th><th>處理人員</th></tr></thead><tbody>{items.map(item=><tr key={item.incident_id}><td><b>{item.alarm_type}</b><small>{item.incident_id}</small></td><td>{item.device_id}</td><td><Badge tone={item.severity.toLowerCase()}>{item.severity}</Badge></td><td>{item.status}</td><td>{new Date(item.start_time).toLocaleString('zh-TW')}<small>{item.closed_time?new Date(item.closed_time).toLocaleString('zh-TW'):'—'}{item.duration_seconds!=null?` · ${item.duration_seconds}s`:''}</small></td><td>{item.operator_id??'—'} / {item.engineer_id??'—'}</td></tr>)}</tbody></table></div>;
}

export function IncidentDatabasePage(){
  const[active,setActive]=useState<ApiIncident[]>([]),[history,setHistory]=useState<ApiIncident[]>([]),[deviceId,setDeviceId]=useState(''),[status,setStatus]=useState(''),[dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState(''),[error,setError]=useState('');
  const params=useMemo(()=>{const value=new URLSearchParams();if(deviceId)value.set('device_id',deviceId);if(status)value.set('status',status);if(dateFrom)value.set('date_from',new Date(dateFrom).toISOString());if(dateTo)value.set('date_to',new Date(`${dateTo}T23:59:59`).toISOString());return value},[deviceId,status,dateFrom,dateTo]);
  useEffect(()=>{let mounted=true;Promise.all([fetchActiveIncidents(params),fetchIncidentHistory(params)]).then(([nextActive,nextHistory])=>{if(mounted){setActive(nextActive);setHistory(nextHistory);setError('')}}).catch(reason=>{if(mounted)setError(reason instanceof Error?reason.message:'事件資料讀取失敗')});return()=>{mounted=false}},[params]);
  return <div className="page"><div className="page-title"><div><span className="eyebrow">INCIDENT LIFECYCLE</span><h1>事件中心</h1><p>作用中事件與已恢復／結案歷史皆由 SQLite 提供。</p></div><Badge tone="critical">{active.length} 筆作用中</Badge></div><div className="toolbar"><input placeholder="device_id" value={deviceId} onChange={event=>setDeviceId(event.target.value)}/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="">全部狀態</option>{['OPEN','ACKNOWLEDGED','IN_PROGRESS','RECOVERED','CLOSED'].map(value=><option key={value}>{value}</option>)}</select><input type="date" value={dateFrom} onChange={event=>setDateFrom(event.target.value)}/><input type="date" value={dateTo} onChange={event=>setDateTo(event.target.value)}/></div>{error&&<p className="disclaimer">{error}</p>}<Card title="Active Incidents"><IncidentTable items={active}/></Card><Card title="Incident History"><IncidentTable items={history}/></Card></div>;
}
