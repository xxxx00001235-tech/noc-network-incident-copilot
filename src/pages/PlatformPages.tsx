import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, Edit3, Expand, FlaskConical, MapPin, Plus, Radio, RotateCcw, Save, Server, ShieldCheck, Trash2, Wrench, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchLatestAlarm } from '../api/alarms';
import { fetchMaintenance, type MaintenanceResponse } from '../api/maintenance';
import { fetchTopology, type TopologyApiNode, type TopologyDeviceReference, type TopologyResponse } from '../api/topology';
import { regions, topologyLinks, topologyNodes } from '../data/mockData';
import { useNocStore } from '../store/useNocStore';
import type { Device, Role } from '../types';
import { Badge, Card, Empty, Status } from '../components/common/UI';
import { DiagnosisPanel } from '../components/diagnosis/DiagnosisPanel';

function topologyRefId(reference:TopologyDeviceReference|null|undefined){
 if(typeof reference==='string')return reference;
 return reference?.device_id||reference?.id||'';
}
function topologyNodeId(node:TopologyApiNode){return node.device_id||node.id||''}
function topologyDeviceStatus(status?:string):Device['status']{
 const value=status?.toLowerCase();
 if(['down','fault','incident','critical'].includes(value||''))return'incident';
 if(['maintenance','maintaining'].includes(value||''))return'maintenance';
 if(['unknown','affected','warning'].includes(value||''))return'unknown';
 return'normal';
}
export function TopologyPage(){
 const devices=useNocStore(s=>s.devices);
 const[selected,setSelected]=useState('SW-TP-NG-001');
 const[apiTopology,setApiTopology]=useState<TopologyResponse|null>(null);
 const[syncState,setSyncState]=useState<'loading'|'success'|'error'>('loading');
 const[syncMessage,setSyncMessage]=useState('正在取得最新告警與拓樸資料…');
 const[maintenanceData,setMaintenanceData]=useState<MaintenanceResponse|null>(null);
 const[maintenanceState,setMaintenanceState]=useState<'loading'|'success'|'error'>('loading');
 const[maintenanceMessage,setMaintenanceMessage]=useState('正在查詢設備維護狀態…');
 const[maintenanceRefresh,setMaintenanceRefresh]=useState(0);
 const syncTopology=useCallback(async()=>{
  setSyncState('loading');setSyncMessage('正在取得最新告警與拓樸資料…');
  try{
   const alarm=await fetchLatestAlarm();
   const topology=await fetchTopology(alarm.deviceId);
   setApiTopology(topology);
   const faultId=topologyRefId(topology.fault_device)||alarm.deviceId;
   setSelected(faultId);
   setSyncState('success');setSyncMessage(`已同步 ${alarm.deviceName}（${alarm.deviceId}）拓樸`);
  }catch(error){
   setApiTopology(null);
   setSelected('SW-TP-NG-001');
   setSyncState('error');setSyncMessage(`${error instanceof Error?error.message:'拓樸同步失敗'}；目前顯示原有模擬拓樸`);
  }
 },[]);
 useEffect(()=>{void syncTopology()},[syncTopology]);
 useEffect(()=>{
  let active=true;
  setMaintenanceData(null);setMaintenanceState('loading');setMaintenanceMessage('正在查詢設備維護狀態…');
  void fetchMaintenance(selected).then(response=>{
   if(!active)return;
   setMaintenanceData(response);setMaintenanceState('success');
   setMaintenanceMessage(response.under_maintenance?'已同步 FastAPI 維護資料':'此設備目前沒有維護作業');
  }).catch(error=>{
   if(!active)return;
   setMaintenanceData(null);setMaintenanceState('error');
   setMaintenanceMessage(`${error instanceof Error?error.message:'維護資料載入失敗'}；保留原有模擬資料`);
  });
  return()=>{active=false};
 },[selected,maintenanceRefresh]);
 const faultId=topologyRefId(apiTopology?.fault_device);
 const affectedIds=useMemo(()=>new Set(apiTopology?.affected_device_ids||[]),[apiTopology]);
 const shownNodes=useMemo(()=>{
  if(!apiTopology?.nodes?.length)return topologyNodes;
  const columns=Math.min(3,Math.max(1,Math.ceil(Math.sqrt(apiTopology.nodes.length))));
  const rows=Math.ceil(apiTopology.nodes.length/columns);
  return apiTopology.nodes.map((node,index)=>{
   const id=topologyNodeId(node);const mock=topologyNodes.find(x=>x.deviceId===id);
   const column=index%columns,row=Math.floor(index/columns);
   return{id,deviceId:id,x:node.x??mock?.x??((column+1)/(columns+1))*100,y:node.y??mock?.y??(rows===1?50:12+(row/(rows-1))*76)};
  }).filter(node=>node.id);
 },[apiTopology]);
 const shownLinks=useMemo(()=>apiTopology?.links?.length?apiTopology.links.map((link,index)=>({id:link.id||`api-link-${index}`,source:link.source,target:link.target,backup:link.backup})):topologyLinks,[apiTopology]);
 const shownDevices=useMemo(()=>{
  if(!apiTopology?.nodes?.length)return devices;
  const map=new Map(devices.map(device=>[device.id,{...device,downstream:[...device.downstream]}]));
  const responseUpstream=apiTopology.upstream.map(topologyRefId).filter(Boolean);
  const responseDownstream=apiTopology.downstream.map(topologyRefId).filter(Boolean);
  apiTopology.nodes.forEach(node=>{
   const id=topologyNodeId(node);if(!id)return;
   const current=map.get(id);
   const linkedUpstream=shownLinks.find(link=>link.target===id)?.source;
   const linkedDownstream=shownLinks.filter(link=>link.source===id).map(link=>link.target);
   map.set(id,{
    id,
    name:node.device_name||node.name||current?.name||id,
    ip:node.ip||current?.ip||'—',
    type:node.device_type||node.type||current?.type||'NOC 設備',
    region:node.region||current?.region||'Lab',
    site:node.site||current?.site||'FastAPI 拓樸',
    status:id===faultId?'incident':topologyDeviceStatus(node.status||current?.status),
    alarms:id===faultId?Math.max(1,current?.alarms||0):current?.alarms||0,
    upstream:linkedUpstream||(id===faultId?responseUpstream[0]:undefined)||current?.upstream,
    downstream:linkedDownstream.length?linkedDownstream:(id===faultId&&responseDownstream.length?responseDownstream:current?.downstream||[]),
    backup:current?.backup,
    maintenance:current?.maintenance,
    cpu:current?.cpu,
   });
  });
  return[...map.values()];
 },[apiTopology,devices,faultId,shownLinks]);
 const selectedApiMaintenance=maintenanceData?.device_id===selected&&maintenanceData.under_maintenance?maintenanceData.maintenance:null;
 const effectiveDevices=useMemo(()=>{
  if(!selectedApiMaintenance)return shownDevices;
  return shownDevices.map(device=>device.id===selected?{...device,status:'maintenance' as const,maintenance:{
   type:'維護作業',
   content:selectedApiMaintenance.description,
   start:selectedApiMaintenance.start_time,
   end:selectedApiMaintenance.end_time,
   owner:selectedApiMaintenance.owner.username,
   ticket:'FastAPI',
   impact:'拓樸節點維護',
   note:`負責人：${selectedApiMaintenance.owner.username}${selectedApiMaintenance.owner.email?` · ${selectedApiMaintenance.owner.email}`:''}`,
  }}:device);
 },[selected,selectedApiMaintenance,shownDevices]);
 const d=effectiveDevices.find(x=>x.id===selected);
 const selectedAffected=affectedIds.has(selected)&&selected!==faultId&&!selectedApiMaintenance;
 return <div className="page"><div className="page-title"><div><span className="eyebrow">NETWORK TOPOLOGY</span><h1>網路拓樸</h1><p>查看上游、障礙節點、下游影響與備援路徑。</p></div><button className="btn primary" onClick={()=>void syncTopology()} disabled={syncState==='loading'}><RotateCcw className={syncState==='loading'?'spin':''}/>重新整理</button></div><div className={`api-state ${syncState}`}>{syncState==='loading'?<RotateCcw className="spin"/>:syncState==='success'?<CheckCircle2/>:<AlertTriangle/>}<span><b>{syncState==='loading'?'拓樸同步中':syncState==='success'?'拓樸同步成功':'FastAPI 拓樸無法載入'}</b><small>{syncMessage}</small></span></div><div className="legend-row topology-legend"><span><i className="normal"/>正常</span><span><i className="incident"/>障礙</span><span><i style={{background:'#ff9f43'}}/>受影響</span><span><i className="maintenance"/>維護</span><span><i className="unknown"/>未知</span><span><i className="backup"/>備援路徑</span></div><div className="split"><Card className="topology-canvas"><div className="topology">{shownLinks.map(l=>{const a=shownNodes.find(n=>n.id===l.source),b=shownNodes.find(n=>n.id===l.target);if(!a||!b)return null;return <svg key={l.id}><line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} className={l.backup?'backup':''}/></svg>})}{shownNodes.map(n=>{const x=effectiveDevices.find(device=>device.id===n.deviceId);if(!x)return null;const isMaintenance=x.status==='maintenance',isFault=x.id===faultId&&!isMaintenance,isAffected=affectedIds.has(x.id)&&!isFault&&!isMaintenance;const nodeStatus=isMaintenance?'maintenance':isFault?'incident':x.status;return <button key={n.id} style={{left:`${n.x}%`,top:`${n.y}%`,...(isAffected?{borderColor:'#ff9f43',boxShadow:'0 0 18px #ff9f4333'}:{})}} className={`node ${nodeStatus} ${selected===x.id?'selected':''}`} onClick={()=>setSelected(x.id)}><Server/><b>{x.name}</b><small>{x.type} · {x.ip}</small><em style={isAffected?{color:'#ff9f43'}:undefined}>{isMaintenance?x.maintenance?.type||'維護':isFault?'障礙':isAffected?'受影響':x.status==='unknown'?'未知':'正常'}</em></button>})}</div></Card><Card title="節點詳細資訊" action={<button className="btn small" onClick={()=>setMaintenanceRefresh(value=>value+1)} disabled={maintenanceState==='loading'}><RotateCcw className={maintenanceState==='loading'?'spin':''}/>更新維護狀態</button>}><div className={`api-state ${maintenanceState}`}>{maintenanceState==='loading'?<RotateCcw className="spin"/>:maintenanceState==='success'?<CheckCircle2/>:<AlertTriangle/>}<span><b>{maintenanceState==='loading'?'維護狀態載入中':maintenanceState==='success'?'維護狀態已同步':'維護 API 無法載入'}</b><small>{maintenanceMessage}</small></span></div>{d?<><div className="detail-head"><h2>{d.name}</h2>{selectedAffected?<Badge tone="warning">受影響</Badge>:<Status status={d.status}/>}</div><dl className="detail-grid"><dt>設備類型</dt><dd>{d.type}</dd><dt>IP 位址</dt><dd>{d.ip}</dd><dt>區域／局名</dt><dd>{d.region}／{d.site}</dd><dt>作用中告警</dt><dd>{d.alarms}</dd><dt>上游設備</dt><dd>{d.upstream??'—'}</dd><dt>下游設備</dt><dd>{d.downstream.join('、')||'—'}</dd><dt>備援設備</dt><dd>{d.backup??'—'}</dd></dl>{selectedAffected&&<div className="maintenance-note"><b>下游受影響設備</b><br/>此節點位於障礙設備下游，狀態由 FastAPI 拓樸分析標示。</div>}{d.maintenance&&<div className="maintenance-note"><b>{d.maintenance.type}</b><br/>{d.maintenance.content}<br/>{d.maintenance.start}–{d.maintenance.end}<br/>{d.maintenance.note}</div>}</>:<Empty/>}</Card></div></div>
}
export function RegionMapPage(){
 const setFilter=useNocStore(s=>s.setRegionFilter),nav=useNavigate();const[selected,setSelected]=useState('台北');const r=regions.find(x=>x.name===selected)!;return <div className="page"><div className="page-title"><div><span className="eyebrow">REGIONAL AWARENESS</span><h1>NOC 區域地圖</h1><p>簡化台灣區域監控圖，不使用外部地圖服務。</p></div></div><div className="split equal"><Card title="台灣區域監控"><div className="taiwan-map">{regions.map((x,i)=><button key={x.name} className={`${selected===x.name?'active':''} ${x.critical?'critical':''}`} style={{top:`${7+i*12}%`,left:`${44+(i%3-1)*8}%`}} onClick={()=>setSelected(x.name)}><MapPin/>{x.name}<small>C{x.critical} / M{x.major}</small></button>)}</div></Card><Card title={`${r.name} 區域概況`}><div className="region-stats"><div><AlertTriangle/><span>Critical<b>{r.critical}</b></span></div><div><Bell/><span>Major<b>{r.major}</b></span></div><div><Server/><span>設備總數<b>{r.devices}</b></span></div><div><XCircle/><span>障礙數量<b>{r.incidents}</b></span></div><div><Wrench/><span>維護數量<b>{r.maintenance}</b></span></div></div>{selected==='台北'&&<><h3>台北局名</h3><div className="site-list">{['南港','信義','松山','中山','大同'].map((x,i)=><button key={x}>{x}<Badge tone={i===0?'critical':i===1?'maintenance':'normal'}>{i===0?'1 障礙':i===1?'1 維護':'正常'}</Badge></button>)}</div></>}<button className="btn primary wide" onClick={()=>{setFilter(selected);nav('/alarms')}}>篩選此區域告警</button></Card></div></div>
}
const labKinds=['Interface Down','CPU High','Memory High','Device Down','Power Supply Failure','Temperature High','Optical LOS','Packet Loss','Link Flapping'];
export function LabPage(){
 const simulate=useNocStore(s=>s.simulateAlarm),recover=useNocStore(s=>s.recoverLab),reset=useNocStore(s=>s.resetLab),alarms=useNocStore(s=>s.alarms),selected=useNocStore(s=>s.selectedAlarmId);const a=alarms.find(x=>x.id===selected&&x.deviceId==='SW-LAB-001');
 return <div className="page"><div className="page-title"><div><span className="eyebrow">SAFE SIMULATION LAB</span><h1>SNMP Lab 模擬實驗室</h1><p>在瀏覽器內安全產生告警，不執行真實 SNMP 或網路查測。</p></div></div><Card title="模擬 Agent" action={<Badge tone="normal"><Radio/> UP</Badge>}><div className="agent-grid">{[['Device','SW-LAB-001'],['IP','192.0.2.161'],['Version','SNMP v2c'],['Community','public'],['Port','161'],['最後輪詢','剛剛']].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div></Card><Card title="產生模擬告警"><div className="lab-buttons">{labKinds.map(x=><button className="btn" key={x} onClick={()=>simulate(x)}><FlaskConical/>{x}</button>)}<button className="btn" onClick={()=>simulate(labKinds[Math.floor(Math.random()*labKinds.length)])}><RotateCcw/>隨機產生告警</button></div><div className="form-actions"><button className="btn success" onClick={recover}><CheckCircle2/>模擬恢復</button><button className="btn danger" onClick={()=>confirm('確定重設所有 Lab 資料？')&&reset()}><Trash2/>重設 Lab</button></div></Card>{a&&<div className="split equal"><Card title="最新 Lab 告警"><Badge tone={a.severity.toLowerCase()}>{a.severity}</Badge><h2>{a.content}</h2><p>{a.id} · {a.time}</p><p>已同步更新 Dashboard、設備狀態、事件與時間軸。</p></Card><DiagnosisPanel alarm={a}/></div>}</div>
}
export function DevicesPage(){
 const role=useNocStore(s=>s.currentUser?.role),devices=useNocStore(s=>s.devices),add=useNocStore(s=>s.addDevice),update=useNocStore(s=>s.updateDevice),remove=useNocStore(s=>s.deleteDevice),notify=useNocStore(s=>s.notify);const[edit,setEdit]=useState<Device|null>(null);
 const save=(e:FormEvent)=>{e.preventDefault();if(!edit)return;devices.some(d=>d.id===edit.id)?update(edit):add(edit);notify('設備資料已儲存');setEdit(null)};
 if(role!=='admin')return <NoPermission/>;
 return <div className="page"><div className="page-title"><div><span className="eyebrow">ASSET MANAGEMENT</span><h1>設備管理</h1><p>管理模擬設備、拓樸關聯與維護狀態。</p></div><button className="btn primary" onClick={()=>setEdit({id:'',name:'',ip:'',type:'Router',region:'台北',site:'',status:'normal',alarms:0,downstream:[]})}><Plus/>新增設備</button></div><Card><div className="table-wrap"><table><thead><tr><th>設備</th><th>類型</th><th>IP</th><th>區域／局名</th><th>狀態</th><th>上游</th><th>操作</th></tr></thead><tbody>{devices.map(d=><tr key={d.id}><td><b>{d.name}</b></td><td>{d.type}</td><td>{d.ip}</td><td>{d.region}／{d.site}</td><td><Status status={d.status}/></td><td>{d.upstream??'—'}</td><td><button className="icon" onClick={()=>setEdit({...d})}><Edit3/></button><button className="icon danger" onClick={()=>confirm(`確定刪除 ${d.name}？此動作無法復原。`)&&remove(d.id)}><Trash2/></button></td></tr>)}</tbody></table></div></Card>{edit&&<div className="modal-backdrop"><form className="modal card form-grid" onSubmit={save}><div className="card-head"><h2>{devices.some(d=>d.id===edit.id)?'編輯設備':'新增設備'}</h2><button type="button" className="icon" onClick={()=>setEdit(null)}><XCircle/></button></div>{[['name','設備名稱'],['ip','IP 位址'],['region','區域'],['site','局名'],['upstream','上游設備'],['backup','備援設備']].map(([k,l])=><label key={k}>{l}<input required={['name','ip','region','site'].includes(k)} value={String(edit[k as keyof Device]??'')} onChange={e=>setEdit({...edit,[k]:e.target.value,id:k==='name'&&!edit.id?e.target.value:edit.id})}/></label>)}<label>設備類型<select value={edit.type} onChange={e=>setEdit({...edit,type:e.target.value})}>{['Router','Core Switch','Distribution Switch','Access Switch','Firewall','Server','Optical Device','Wireless Controller','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>設備狀態<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value as Device['status']})}><option value="normal">正常</option><option value="incident">障礙</option><option value="maintenance">維護</option><option value="unknown">未知</option></select></label><div className="form-actions"><button type="button" className="btn" onClick={()=>setEdit(null)}>取消</button><button className="btn primary"><Save/>儲存</button></div></form></div>}</div>
}
export function AccountsPage(){
 const role=useNocStore(s=>s.currentUser?.role),users=useNocStore(s=>s.users),review=useNocStore(s=>s.reviewUser),setRole=useNocStore(s=>s.setUserRole);if(role!=='admin')return <NoPermission/>;return <div className="page"><div className="page-title"><div><span className="eyebrow">ACCESS GOVERNANCE</span><h1>帳號管理</h1><p>審核申請、停用帳號與調整角色。</p></div></div><Card><div className="table-wrap"><table><thead><tr><th>使用者</th><th>部門</th><th>角色</th><th>狀態</th><th>操作</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b><small>{u.employeeId} · {u.email}</small></td><td>{u.department}</td><td><select value={u.role} onChange={e=>setRole(u.id,e.target.value as Role)}><option value="operator">一線人員</option><option value="engineer">設備管理員</option><option value="admin">系統管理員</option></select></td><td><Badge tone={u.status==='啟用'?'normal':u.status==='等待審核'?'maintenance':'critical'}>{u.status}</Badge></td><td><button className="btn small success" onClick={()=>review(u.id,'啟用')}><CheckCircle2/>核准</button><button className="btn small" onClick={()=>review(u.id,'拒絕')}><XCircle/>拒絕</button><button className="btn small danger" onClick={()=>confirm('確定停用此帳號？')&&review(u.id,'停用')}>停用</button></td></tr>)}</tbody></table></div></Card></div>
}
function NoPermission(){return <div className="page"><Card className="no-permission"><ShieldCheck/><h1>此功能需要系統管理員權限</h1><p>可使用右上角 Demo 角色切換器切換為系統管理員。</p></Card></div>}
export function SettingsPage(){return <div className="page"><div className="page-title"><div><span className="eyebrow">SYSTEM SETTINGS</span><h1>系統設定</h1><p>展示用設定皆只儲存在此瀏覽器。</p></div></div><Card title="模擬環境保護"><div className="settings-list">{['禁止真實 Ping / Traceroute','禁止連接 SNMP Agent','禁止串接 Teams API','使用規則式 AI 假資料','localStorage 本機保存'].map(x=><label key={x}><span><ShieldCheck/><b>{x}</b></span><input type="checkbox" defaultChecked disabled/></label>)}</div></Card></div>}
export function WallboardPage(){
 const alarms=useNocStore(s=>s.alarms),devices=useNocStore(s=>s.devices),incidents=useNocStore(s=>s.incidents);const[time,setTime]=useState(new Date());useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[]);const count=(s:string)=>alarms.filter(a=>a.severity===s&&a.status!=='已恢復').length;
 return <div className="wallboard"><header><div><span>NOC LIVE WALLBOARD</span><h1>網路營運即時戰情</h1></div><time>{time.toLocaleDateString('zh-TW')} <b>{time.toLocaleTimeString('zh-TW')}</b></time><button className="btn" onClick={()=>document.documentElement.requestFullscreen()}><Expand/>全螢幕</button></header><div className="wall-stats">{[['CRITICAL',count('Critical'),'critical'],['MAJOR',count('Major'),'major'],['MINOR',count('Minor'),'minor'],['維護設備',devices.filter(d=>d.status==='maintenance').length,'maintenance'],['正常設備',devices.filter(d=>d.status==='normal').length,'normal']].map(([l,v,t])=><div className={String(t)} key={String(l)}><span>{l}</span><b>{v}</b></div>)}</div><div className="wall-grid"><section><h2>目前重大事件</h2>{incidents.filter(i=>i.severity==='Critical').map(i=><div className="wall-event" key={i.id}><Badge tone="critical">Critical</Badge><div><h3>{i.title}</h3><p>{i.id} · {i.deviceId}</p></div><strong>{i.affectedDevices}<small>影響設備</small></strong><Badge tone="info">{i.status}</Badge></div>)}</section><section><h2>區域告警分布</h2>{regions.map(r=><div className="wall-region" key={r.name}><span>{r.name}</span><i style={{width:`${Math.max(4,(r.critical*2+r.major)*14)}%`}}/><b>C{r.critical} M{r.major}</b></div>)}</section></div><div className="ticker"><b>即時事件</b><div><span>09:05 SW-TP-NG-001 Device Down</span><span>09:08 Optical LOS Detected</span><span>09:12 Engineer Acknowledged</span><span>09:27 Link Recovered</span></div></div></div>
}
