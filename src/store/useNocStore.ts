import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { alarms as seedAlarms, incidents as seedIncidents, users as seedUsers } from '../data/mockData';
import { canonicalDeviceId, deviceById, devices as seedDevices } from '../data/inventory';
import type { Alarm, DemoScenario, Device, Incident, IncidentStatus, Role, User } from '../types';
import type { AlarmSocketState } from '../api/alarmSocket';

type Theme = 'dark'|'light'|'ai';
interface NocState {
  currentUser:User|null; users:User[]; alarms:Alarm[]; devices:Device[]; incidents:Incident[];
  selectedAlarmId:string; theme:Theme; toast:string; regionFilter:string; realtimeState:AlarmSocketState; unreadAlarmCount:number; activeDemoScenario:DemoScenario|null; activeDemoIncidentId:string;
  login:(username:string,password:string)=>boolean; logout:()=>void; switchRole:(role:Role)=>void;
  setTheme:(theme:Theme)=>void; selectAlarm:(id:string)=>void; notify:(text:string)=>void; clearToast:()=>void;
  syncAlarm:(alarm:Alarm)=>void;
  receiveRealtimeAlarm:(alarm:Alarm)=>void; acknowledgeAlarms:()=>void;
  setRealtimeState:(state:AlarmSocketState)=>void;
  setRegionFilter:(region:string)=>void; updateIncident:(id:string,status:IncidentStatus,note:string)=>void;
  addTimeline:(id:string,text:string)=>void; addDevice:(device:Device)=>void; updateDevice:(device:Device)=>void; deleteDevice:(id:string)=>void;
  reviewUser:(id:string,status:User['status'])=>void; setUserRole:(id:string,role:Role)=>void; register:(user:User)=>void;
  simulateAlarm:(kind:string)=>void; recoverLab:()=>void; resetLab:()=>void; triggerDemo:(scenario:DemoScenario)=>void; resetDemo:()=>void;
}
const now = () => new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
const demoIds={alarm:'ALM-DEMO-S4-1',incident:'INC-DEMO-S4-1'};
const demoScenarios:Record<DemoScenario,{deviceId:string;severity:Alarm['severity'];content:string;cause:string;affectedDevices:number;affectedUsers:number;maintenance:boolean;timeline:string[]}>= {
  'core-router-failure':{deviceId:'RTR-CORE-001',severity:'Critical',content:'台北南港核心路由器失聯',cause:'核心路由器上行介面異常，導致南港核心路徑中斷',affectedDevices:5,affectedUsers:820,maintenance:false,timeline:['監控系統偵測核心路由器失聯','AI 完成關聯告警分析並識別核心路徑影響','已產生 Teams 障礙初報草稿']},
  'olt-access-failure':{deviceId:'OLT-HC-001',severity:'Major',content:'OLT Access 光訊號異常',cause:'OLT PON 介面偵測 Optical LOS，Access 服務降級',affectedDevices:28,affectedUsers:356,maintenance:false,timeline:['監控系統偵測 OLT Access 異常','AI 判斷為光訊號或上游光纖異常','已產生 Teams 障礙初報草稿']},
  'maintenance-event':{deviceId:'RTR-TP-NG-BACKUP-001',severity:'Warning',content:'計畫性維護事件進行中',cause:'設備處於既定維護時段，告警判定為維護相關事件',affectedDevices:1,affectedUsers:0,maintenance:true,timeline:['維護事件已依 Device Inventory 啟動','AI 已比對既有維護資訊','已產生 Teams 維護初報草稿']},
};
export const useNocStore = create<NocState>()(persist((set,get)=>({
  currentUser:null, users:seedUsers, alarms:seedAlarms, devices:seedDevices, incidents:seedIncidents,
  selectedAlarmId:seedAlarms[0].id, theme:'dark', toast:'', regionFilter:'', realtimeState:'connecting', unreadAlarmCount:0, activeDemoScenario:null, activeDemoIncidentId:'',
  login:(username,password)=>{
    const user=get().users.find(u=>u.username===username&&u.password===password&&u.status==='啟用');
    if(user) set({currentUser:user}); return Boolean(user);
  },
  logout:()=>set({currentUser:null}),
  switchRole:(role)=>{const user=get().users.find(u=>u.role===role&&u.status==='啟用'); if(user)set({currentUser:user});},
  setTheme:(theme)=>set({theme}), selectAlarm:(selectedAlarmId)=>set({selectedAlarmId}),
  setRealtimeState:(realtimeState)=>set({realtimeState}),
  syncAlarm:(alarm)=>set(s=>{
    const canonicalId=canonicalDeviceId(alarm.deviceId);
    const inventoryDevice=deviceById.get(canonicalId);
    alarm={...alarm,deviceId:canonicalId,deviceName:inventoryDevice?.name??canonicalId,ip:inventoryDevice?.ip??alarm.ip,deviceType:inventoryDevice?.type??alarm.deviceType,region:inventoryDevice?.region??alarm.region,site:inventoryDevice?.site??alarm.site};
    const existingIncident=s.incidents.find(item=>item.id===alarm.incidentId);
    const incident:Incident=existingIncident?{
      ...existingIncident,
      title:`${alarm.deviceName}：${alarm.content}`,
      severity:alarm.severity,
    }:{
      id:alarm.incidentId,
      title:`${alarm.deviceName}：${alarm.content}`,
      deviceId:alarm.deviceId,
      severity:alarm.severity,
      status:'收到告警',
      affectedDevices:1,
      affectedUsers:0,
      cause:'等待 FastAPI AI 分析',
      started:alarm.time,
      timeline:[{id:crypto.randomUUID(),time:now(),actor:'FastAPI',text:`同步告警：${alarm.content}`}],
    };
    const existingDevice=s.devices.find(item=>item.id===alarm.deviceId);
    const device:Device={
      id:alarm.deviceId,
      name:alarm.deviceName,
      ip:alarm.ip,
      type:alarm.deviceType,
      region:alarm.region,
      site:alarm.site,
      status:alarm.status==='已恢復'?'normal':'incident',
      alarms:alarm.status==='已恢復'?0:1,
      downstream:existingDevice?.downstream??[],
      upstream:existingDevice?.upstream,
      backup:existingDevice?.backup,
      maintenance:existingDevice?.maintenance,
      cpu:existingDevice?.cpu,
    };
    return{
      alarms:s.alarms.some(item=>item.id===alarm.id)?s.alarms.map(item=>item.id===alarm.id?alarm:item):[alarm,...s.alarms],
      incidents:existingIncident?s.incidents.map(item=>item.id===incident.id?incident:item):[incident,...s.incidents],
      devices:s.devices.some(item=>item.id===device.id)?s.devices.map(item=>item.id===device.id?device:item):[device,...s.devices],
      selectedAlarmId:alarm.id,
    };
  }),
  receiveRealtimeAlarm:(alarm)=>{
    get().syncAlarm(alarm);
    set(s=>({unreadAlarmCount:s.unreadAlarmCount+1,toast:`新告警｜${alarm.severity}｜${alarm.deviceName}：${alarm.content}`}));
  },
  acknowledgeAlarms:()=>set({unreadAlarmCount:0}),
  notify:(toast)=>set({toast}), clearToast:()=>set({toast:''}), setRegionFilter:(regionFilter)=>set({regionFilter}),
  updateIncident:(id,status,note)=>set(s=>({incidents:s.incidents.map(i=>i.id===id?{...i,status,timeline:[...i.timeline,{id:crypto.randomUUID(),time:now(),actor:s.currentUser?.name??'系統',text:note||`狀態更新為「${status}」`,from:i.status,to:status}]}:i)})),
  addTimeline:(id,text)=>set(s=>({incidents:s.incidents.map(i=>i.id===id?{...i,timeline:[...i.timeline,{id:crypto.randomUUID(),time:now(),actor:s.currentUser?.name??'系統',text}]}:i)})),
  addDevice:(device)=>set(s=>({devices:[...s.devices,device]})),
  updateDevice:(device)=>set(s=>({devices:s.devices.map(d=>d.id===device.id?device:d)})),
  deleteDevice:(id)=>set(s=>({devices:s.devices.filter(d=>d.id!==id)})),
  reviewUser:(id,status)=>set(s=>({users:s.users.map(u=>u.id===id?{...u,status}:u)})),
  setUserRole:(id,role)=>set(s=>({users:s.users.map(u=>u.id===id?{...u,role}:u)})),
  register:(user)=>set(s=>({users:[...s.users,user]})),
  simulateAlarm:(kind)=>{
    const id=`LAB-${Date.now()}`, incidentId=`INC-LAB-${Date.now()}`;
    const alarm:Alarm={id,time:new Date().toLocaleString('zh-TW'),severity:kind.includes('CPU')||kind.includes('Memory')?'Major':'Critical',region:'台北',site:'模擬實驗室',deviceId:'SW-LAB-001',deviceName:'SW-LAB-001',ip:'192.0.2.161',deviceType:'Access Switch',content:kind,source:'SNMP Lab',status:'待處理',owner:'未指派',maintenance:false,updated:now(),incidentId};
    const incident:Incident={id:incidentId,title:`Lab 模擬：${kind}`,deviceId:'SW-LAB-001',severity:alarm.severity,status:'收到告警',affectedDevices:1,affectedUsers:10,cause:'待 AI 模擬判斷',started:alarm.time,timeline:[{id:crypto.randomUUID(),time:now(),actor:'SNMP Lab',text:`產生 ${kind} 模擬告警`}]};
    const lab:Device={id:'SW-LAB-001',name:'SW-LAB-001',ip:'192.0.2.161',type:'Access Switch',region:'台北',site:'模擬實驗室',status:'incident',alarms:1,downstream:[]};
    set(s=>({alarms:[alarm,...s.alarms],incidents:[incident,...s.incidents],devices:[lab,...s.devices.filter(d=>d.id!==lab.id)],selectedAlarmId:id,toast:`已產生 ${kind} 模擬告警`}));
  },
  recoverLab:()=>set(s=>({devices:s.devices.map(d=>d.id==='SW-LAB-001'?{...d,status:'normal',alarms:0}:d),alarms:s.alarms.map(a=>a.deviceId==='SW-LAB-001'?{...a,status:'已恢復'}:a),toast:'Lab 設備已模擬恢復'})),
  resetLab:()=>set(s=>({devices:s.devices.filter(d=>d.id!=='SW-LAB-001'),alarms:s.alarms.filter(a=>a.deviceId!=='SW-LAB-001'),incidents:s.incidents.filter(i=>i.deviceId!=='SW-LAB-001'),selectedAlarmId:seedAlarms[0].id,toast:'Lab 已重設'})),
  triggerDemo:(scenario)=>set(s=>{
    const config=demoScenarios[scenario],inventoryDevice=deviceById.get(config.deviceId);
    if(!inventoryDevice)return{toast:'Demo 情境無法啟動：Device Inventory 找不到指定設備'};
    const timestamp=new Date().toLocaleString('zh-TW');
    const alarm:Alarm={id:demoIds.alarm,time:timestamp,severity:config.severity,region:inventoryDevice.region,site:inventoryDevice.site,deviceId:inventoryDevice.id,deviceName:inventoryDevice.name,ip:inventoryDevice.ip,deviceType:inventoryDevice.type,content:config.content,source:'NOC Demo Control',status:config.maintenance?'維護中':'處理中',owner:'NOC Demo Operator',maintenance:config.maintenance,updated:now(),incidentId:demoIds.incident};
    const incident:Incident={id:demoIds.incident,title:`${inventoryDevice.name}：${config.content}`,deviceId:inventoryDevice.id,severity:config.severity,status:'初報完成',affectedDevices:config.affectedDevices,affectedUsers:config.affectedUsers,cause:config.cause,started:timestamp,timeline:config.timeline.map((text,index)=>({id:`DEMO-TL-${index}`,time:now(),actor:index===0?'NOC Demo Control':index===1?'AI Copilot':'Teams 通報產生器',text}))};
    return{activeDemoScenario:scenario,activeDemoIncidentId:incident.id,selectedAlarmId:alarm.id,alarms:[alarm,...s.alarms.filter(item=>item.id!==demoIds.alarm)],incidents:[incident,...s.incidents.filter(item=>item.id!==demoIds.incident)],devices:s.devices.map(device=>{const original=deviceById.get(device.id);if(device.id===inventoryDevice.id)return{...device,status:config.maintenance?'maintenance':'incident',alarms:1};return original&&Object.values(demoScenarios).some(item=>item.deviceId===device.id)?{...original}:device}),unreadAlarmCount:s.unreadAlarmCount+1,toast:`Demo 已啟動：${config.content}`};
  }),
  resetDemo:()=>set(s=>({activeDemoScenario:null,activeDemoIncidentId:'',alarms:s.alarms.filter(item=>item.id!==demoIds.alarm),incidents:s.incidents.filter(item=>item.id!==demoIds.incident),devices:s.devices.map(device=>{const original=deviceById.get(device.id);return original&&Object.values(demoScenarios).some(config=>config.deviceId===device.id)?{...original}:device}),selectedAlarmId:s.selectedAlarmId===demoIds.alarm?(s.alarms.find(item=>item.id!==demoIds.alarm)?.id??seedAlarms[0].id):s.selectedAlarmId,toast:'Demo Mode 已重設，設備狀態已還原'})),
}),{
  name:'noc-copilot-state',
  version:3,
  partialize:s=>({currentUser:s.currentUser,users:s.users,alarms:s.alarms,devices:s.devices,incidents:s.incidents,selectedAlarmId:s.selectedAlarmId,theme:s.theme}),
  migrate:persisted=>{
    const state=persisted as Partial<NocState>;
    const alarms=(state.alarms??seedAlarms).map(alarm=>{const id=canonicalDeviceId(alarm.deviceId);const device=deviceById.get(id);return {...alarm,deviceId:id,deviceName:device?.name??id,ip:device?.ip??alarm.ip,deviceType:device?.type??alarm.deviceType,region:device?.region??alarm.region,site:device?.site??alarm.site}});
    const incidents=(state.incidents??seedIncidents).map(incident=>({...incident,deviceId:canonicalDeviceId(incident.deviceId)}));
    return {currentUser:state.currentUser??null,users:state.users??seedUsers,devices:seedDevices,alarms,incidents,selectedAlarmId:state.selectedAlarmId??seedAlarms[0].id,theme:state.theme??'dark'};
  },
  merge:(persisted,current)=>({...current,...persisted as Partial<NocState>,devices:seedDevices,toast:'',regionFilter:'',realtimeState:'connecting',unreadAlarmCount:0,activeDemoScenario:null,activeDemoIncidentId:''}),
}));
