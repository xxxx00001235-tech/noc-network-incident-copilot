import { useState } from 'react';
import { AlertTriangle, ChevronDown, Network, Play, RotateCcw, Wrench, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNocStore } from '../../store/useNocStore';
import type { DemoScenario } from '../../types';

const scenarios:{id:DemoScenario;title:string;device:string;description:string;icon:typeof Network}[]=[
 {id:'core-router-failure',title:'台北南港核心路由器故障',device:'RTR-CORE-001',description:'Critical · 核心路徑中斷',icon:Network},
 {id:'olt-access-failure',title:'OLT Access 異常',device:'OLT-HC-001',description:'Major · Optical LOS',icon:AlertTriangle},
 {id:'maintenance-event',title:'維護事件',device:'RTR-TP-NG-BACKUP-001',description:'Warning · 計畫性維護',icon:Wrench},
];

export function DemoControlPanel(){
 const[open,setOpen]=useState(false),active=useNocStore(s=>s.activeDemoScenario),trigger=useNocStore(s=>s.triggerDemo),reset=useNocStore(s=>s.resetDemo),navigate=useNavigate();
 const activeTitle=scenarios.find(item=>item.id===active)?.title;
 const run=(scenario:DemoScenario)=>{trigger(scenario);setOpen(false);navigate('/alarms')};
 return <div className="demo-control">
  <button className={`demo-trigger ${active?'active':''}`} onClick={()=>setOpen(value=>!value)} aria-expanded={open}><Play/>{active?'Demo 執行中':'Demo Control'}<ChevronDown/></button>
  {open&&<div className="demo-panel" role="dialog" aria-label="Demo Control Panel"><header><div><small>SPRINT 4-1</small><b>一鍵障礙展示模式</b></div><button className="icon" onClick={()=>setOpen(false)} aria-label="關閉"><X/></button></header>
   {active&&<div className="demo-active"><i/><span><b>目前情境：{activeTitle}</b><small>告警、拓樸、AI 診斷、時間軸與 Teams 初報已同步</small></span></div>}
   <div className="demo-scenarios">{scenarios.map(({id,title,device,description,icon:Icon})=><button key={id} className={active===id?'selected':''} onClick={()=>run(id)}><Icon/><span><b>{title}</b><small>{device} · {description}</small></span><Play/></button>)}</div>
   <footer><span>僅使用現有 Device Inventory</span><button className="btn small" disabled={!active} onClick={()=>{reset();setOpen(false)}}><RotateCcw/>重設 Demo</button></footer>
  </div>}
 </div>;
}
