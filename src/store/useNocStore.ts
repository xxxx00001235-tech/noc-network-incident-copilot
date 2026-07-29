import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { alarms as seedAlarms, devices as seedDevices, incidents as seedIncidents, users as seedUsers } from '../data/mockData';
import type { Alarm, Device, Incident, IncidentStatus, Role, User } from '../types';

type Theme = 'dark'|'light'|'ai';
interface NocState {
  currentUser:User|null; users:User[]; alarms:Alarm[]; devices:Device[]; incidents:Incident[];
  selectedAlarmId:string; theme:Theme; toast:string; regionFilter:string;
  login:(username:string,password:string)=>boolean; logout:()=>void; switchRole:(role:Role)=>void;
  setTheme:(theme:Theme)=>void; selectAlarm:(id:string)=>void; notify:(text:string)=>void; clearToast:()=>void;
  upsertAlarm:(alarm:Alarm)=>void;
  setRegionFilter:(region:string)=>void; updateIncident:(id:string,status:IncidentStatus,note:string)=>void;
  addTimeline:(id:string,text:string)=>void; addDevice:(device:Device)=>void; updateDevice:(device:Device)=>void; deleteDevice:(id:string)=>void;
  reviewUser:(id:string,status:User['status'])=>void; setUserRole:(id:string,role:Role)=>void; register:(user:User)=>void;
  simulateAlarm:(kind:string)=>void; recoverLab:()=>void; resetLab:()=>void;
}
const now = () => new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
export const useNocStore = create<NocState>()(persist((set,get)=>({
  currentUser:null, users:seedUsers, alarms:seedAlarms, devices:seedDevices, incidents:seedIncidents,
  selectedAlarmId:seedAlarms[0].id, theme:'dark', toast:'', regionFilter:'',
  login:(username,password)=>{
    const user=get().users.find(u=>u.username===username&&u.password===password&&u.status==='啟用');
    if(user) set({currentUser:user}); return Boolean(user);
  },
  logout:()=>set({currentUser:null}),
  switchRole:(role)=>{const user=get().users.find(u=>u.role===role&&u.status==='啟用'); if(user)set({currentUser:user});},
  setTheme:(theme)=>set({theme}), selectAlarm:(selectedAlarmId)=>set({selectedAlarmId}),
  upsertAlarm:(alarm)=>set(s=>({alarms:s.alarms.some(item=>item.id===alarm.id)?s.alarms.map(item=>item.id===alarm.id?alarm:item):[alarm,...s.alarms]})),
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
}),{name:'noc-copilot-state',partialize:s=>({currentUser:s.currentUser,users:s.users,alarms:s.alarms,devices:s.devices,incidents:s.incidents,selectedAlarmId:s.selectedAlarmId,theme:s.theme})}));
