import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Copy, LoaderCircle, Play, RotateCcw, XCircle } from 'lucide-react';
import type { TestResult } from '../../types';
import { useNocStore } from '../../store/useNocStore';
import { Card } from '../common/UI';
const seed:TestResult[]=[
 {id:'1',name:'Ping 測試',status:'等待',result:'目標無回應',explanation:'目標設備可能離線'},
 {id:'2',name:'Traceroute 路由追蹤',status:'等待',result:'第 8 Hop Timeout',explanation:'封包中斷於區域交換器'},
 {id:'3',name:'SNMP 狀態查詢',status:'等待',result:'No Response',explanation:'設備離線或 Agent 無回應'},
 {id:'4',name:'Interface 介面狀態',status:'等待',result:'Down / LOS',explanation:'上行介面偵測不到光訊號'},
 {id:'5',name:'Optical Power 光功率',status:'等待',result:'-40 dBm',explanation:'光功率異常'},
 {id:'6',name:'CPU 使用率',status:'等待',result:'12%',explanation:'非運算資源問題'},
 {id:'7',name:'Memory 使用率',status:'等待',result:'38%',explanation:'記憶體正常'},
 {id:'8',name:'設備溫度',status:'等待',result:'41°C',explanation:'溫度正常'},
 {id:'9',name:'上游設備檢查',status:'等待',result:'可達',explanation:'上游核心路由器正常'},
 {id:'10',name:'下游影響判斷',status:'等待',result:'12 台不可達',explanation:'確認為群聚性影響'},
];
export function TestRunner({incidentId}:{incidentId?:string}){
 const [items,setItems]=useState(seed); const [running,setRunning]=useState(false); const notify=useNocStore(s=>s.notify); const addTimeline=useNocStore(s=>s.addTimeline);
 useEffect(()=>{if(!running)return;
  const activeIdx=items.findIndex(x=>x.status==='執行中');
  if(activeIdx>=0){const t=setTimeout(()=>setItems(v=>v.map((x,i)=>i===activeIdx?{...x,status:activeIdx<5||activeIdx===9?'失敗':'成功'}:x)),380);return()=>clearTimeout(t)}
  const nextIdx=items.findIndex(x=>x.status==='等待');
  if(nextIdx<0){setRunning(false);notify('模擬查測完成：疑似光纖或 SFP 異常');return}
  setItems(v=>v.map((x,i)=>i===nextIdx?{...x,status:'執行中'}:x));
 },[items,running,notify]);
 const start=()=>{setItems(seed.map(item=>({...item})));setRunning(true); if(incidentId)addTimeline(incidentId,'開始一鍵模擬查測')};
 const copy=()=>navigator.clipboard.writeText(items.map(x=>`${x.name}：${x.result}（${x.explanation}）`).join('\n')).then(()=>notify('已複製查測結果'));
 return <Card title="一鍵模擬查測" action={<button className="btn primary" onClick={start} disabled={running}>{running?<LoaderCircle className="spin" size={16}/>:<Play size={16}/>} {items.some(x=>x.status!=='等待')?'重新查測':'開始查測'}</button>}>
  <div className="test-list">{items.map(x=><div className="test-row" key={x.id}>{x.status==='等待'?<Circle/>:x.status==='執行中'?<LoaderCircle className="spin"/>:x.status==='成功'?<CheckCircle2 className="ok"/>:<XCircle className="bad"/>}<div><b>{x.name}</b><small>{x.status==='等待'?'等待執行':x.status==='執行中'?'執行中…':`${x.result} · ${x.explanation}`}</small></div></div>)}</div>
  {items.every(x=>x.status!=='等待'&&x.status!=='執行中')&&<div className="result-box"><b>綜合判斷：疑似光纖中斷或 SFP 異常</b><p>下一步：確認維護作業 → 聯絡設備管理員 → 檢查上游介面與光模組。</p><button className="btn" onClick={copy}><Copy size={15}/>複製結果</button><button className="btn" onClick={start}><RotateCcw size={15}/>重新查測</button></div>}
 </Card>
}
