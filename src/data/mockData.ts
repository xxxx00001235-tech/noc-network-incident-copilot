import type { Alarm, Contact, Device, Incident, Region, TopologyLink, TopologyNode, User } from '../types';

export const users:User[] = [
  {id:'u1',username:'operator',password:'123456',name:'林怡君',employeeId:'D001',email:'operator@demo.local',teams:'operator@demo.local',phone:'0900-000-001',department:'NOC',role:'operator',status:'啟用'},
  {id:'u2',username:'engineer',password:'123456',name:'Kevin Wang',employeeId:'D002',email:'engineer@demo.local',teams:'kevin.wang@example.com',phone:'0900-000-002',department:'網路工程',role:'engineer',status:'啟用'},
  {id:'u3',username:'admin',password:'123456',name:'系統管理員',employeeId:'D003',email:'admin@demo.local',teams:'admin@demo.local',phone:'0900-000-003',department:'資訊處',role:'admin',status:'啟用'},
  {id:'u4',username:'pending',password:'123456',name:'測試申請者',employeeId:'D004',email:'pending@demo.local',teams:'pending@demo.local',phone:'0900-000-004',department:'維運',role:'operator',status:'等待審核'},
];
export const devices:Device[] = [
  {id:'internet',name:'Internet',ip:'203.0.113.1',type:'Internet',region:'全區',site:'外部',status:'normal',alarms:0,downstream:['RTR-CORE-001']},
  {id:'RTR-CORE-001',name:'RTR-CORE-001',ip:'192.0.2.1',type:'Core Router',region:'台北',site:'核心機房',status:'normal',alarms:0,upstream:'internet',downstream:['SW-TP-NG-001'],backup:'RTR-TP-XY-001'},
  {id:'SW-TP-NG-001',name:'SW-TP-NG-001',ip:'10.10.1.1',type:'Core Switch',region:'台北',site:'南港',status:'incident',alarms:2,upstream:'RTR-CORE-001',downstream:['SW-NG-DIST-01','SW-NG-DIST-02']},
  {id:'SW-NG-DIST-01',name:'SW-NG-DIST-01',ip:'10.10.2.1',type:'Distribution Switch',region:'台北',site:'南港',status:'unknown',alarms:1,upstream:'SW-TP-NG-001',downstream:['AP-NG-01']},
  {id:'SW-NG-DIST-02',name:'SW-NG-DIST-02',ip:'10.10.2.2',type:'Distribution Switch',region:'台北',site:'南港',status:'unknown',alarms:1,upstream:'SW-TP-NG-001',downstream:[]},
  {id:'AP-NG-01',name:'AP-NG-01',ip:'10.10.3.10',type:'Access Switch',region:'台北',site:'南港',status:'unknown',alarms:0,upstream:'SW-NG-DIST-01',downstream:[]},
  {id:'RTR-TP-XY-001',name:'RTR-TP-XY-001',ip:'10.20.1.1',type:'Router',region:'台北',site:'信義',status:'maintenance',alarms:0,downstream:[],maintenance:{type:'韌體升級',content:'例行韌體安全更新',start:'01:00',end:'03:00',owner:'Amy Chen',ticket:'CHG-20260725-008',impact:'信義備援路徑',note:'作業期間由主路徑承載'}},
  {id:'SW-TY-001',name:'SW-TY-001',ip:'10.30.1.1',type:'Distribution Switch',region:'桃園',site:'桃園',status:'incident',alarms:1,downstream:[],cpu:94},
  {id:'OLT-HC-001',name:'OLT-HC-001',ip:'10.40.1.1',type:'Optical Device',region:'新竹',site:'科學園區',status:'incident',alarms:1,downstream:[]},
];
export const alarms:Alarm[] = [
  {id:'ALM-260725-001',time:'2026-07-25 09:00',severity:'Critical',region:'台北',site:'南港',deviceId:'SW-TP-NG-001',deviceName:'SW-TP-NG-001',ip:'10.10.1.1',deviceType:'Core Switch',content:'設備無回應、上游介面 Optical LOS',source:'SNMP Trap',status:'處理中',owner:'林怡君',maintenance:false,updated:'09:12',incidentId:'INC-20260725-001'},
  {id:'ALM-260725-002',time:'2026-07-25 08:42',severity:'Major',region:'桃園',site:'桃園',deviceId:'SW-TY-001',deviceName:'SW-TY-001',ip:'10.30.1.1',deviceType:'Distribution Switch',content:'CPU High 94%',source:'模擬輪詢',status:'待處理',owner:'未指派',maintenance:false,updated:'08:55',incidentId:'INC-20260725-002'},
  {id:'ALM-260725-003',time:'2026-07-25 08:31',severity:'Critical',region:'新竹',site:'科學園區',deviceId:'OLT-HC-001',deviceName:'OLT-HC-001',ip:'10.40.1.1',deviceType:'Optical Device',content:'Optical LOS，影響下游 28 台',source:'模擬 Trap',status:'待處理',owner:'未指派',maintenance:false,updated:'08:31',incidentId:'INC-20260725-003'},
  {id:'ALM-260725-004',time:'2026-07-25 01:10',severity:'Warning',region:'台北',site:'信義',deviceId:'RTR-TP-XY-001',deviceName:'RTR-TP-XY-001',ip:'10.20.1.1',deviceType:'Router',content:'設備重新啟動',source:'維護監控',status:'維護已確認',owner:'Amy Chen',maintenance:true,updated:'01:12',incidentId:'INC-20260725-004'},
];
export const incidents:Incident[] = [
 {id:'INC-20260725-001',title:'台北南港核心交換器中斷',deviceId:'SW-TP-NG-001',severity:'Critical',status:'查測中',affectedDevices:12,affectedUsers:240,cause:'疑似 SFP 光模組異常',started:'2026-07-25 09:00',timeline:[
  {id:'t1',time:'09:00',actor:'系統',text:'收到 Critical 告警'},
  {id:'t2',time:'09:01',actor:'AI Copilot',text:'初步判斷為上游光纖或光模組異常'},
  {id:'t3',time:'09:05',actor:'林怡君',text:'已通知第一順位設備管理員'},
 ]},
 {id:'INC-20260725-002',title:'桃園交換器 CPU 過高',deviceId:'SW-TY-001',severity:'Major',status:'收到告警',affectedDevices:1,affectedUsers:20,cause:'待確認',started:'2026-07-25 08:42',timeline:[]},
 {id:'INC-20260725-003',title:'新竹光纖訊號中斷',deviceId:'OLT-HC-001',severity:'Critical',status:'收到告警',affectedDevices:28,affectedUsers:410,cause:'疑似光纖中斷',started:'2026-07-25 08:31',timeline:[]},
];
export const contacts:Contact[] = [
 {id:'c1',priority:1,name:'Kevin Wang',role:'設備管理員',phone:'0900-111-111',teams:'kevin.wang@example.com',status:'可聯絡',deviceId:'SW-TP-NG-001'},
 {id:'c2',priority:2,name:'Amy Chen',role:'區域工程師',phone:'0900-222-222',teams:'amy.chen@example.com',status:'可聯絡',deviceId:'SW-TP-NG-001'},
 {id:'c3',priority:3,name:'David Lin',role:'主管',phone:'0900-333-333',teams:'david.lin@example.com',status:'待命',deviceId:'SW-TP-NG-001'},
];
export const topologyNodes:TopologyNode[] = devices.slice(0,6).map((d,i)=>({id:d.id,deviceId:d.id,x:[50,50,50,25,75,25][i],y:[5,23,42,65,65,88][i]}));
export const topologyLinks:TopologyLink[] = [{id:'l1',source:'internet',target:'RTR-CORE-001'},{id:'l2',source:'RTR-CORE-001',target:'SW-TP-NG-001'},{id:'l3',source:'SW-TP-NG-001',target:'SW-NG-DIST-01'},{id:'l4',source:'SW-TP-NG-001',target:'SW-NG-DIST-02'},{id:'l5',source:'SW-NG-DIST-01',target:'AP-NG-01'},{id:'l6',source:'RTR-TP-XY-001',target:'SW-TP-NG-001',backup:true}];
export const regions:Region[] = [
 {name:'台北',critical:1,major:0,devices:148,incidents:1,maintenance:1},{name:'新北',critical:0,major:1,devices:96,incidents:1,maintenance:0},{name:'桃園',critical:0,major:1,devices:72,incidents:1,maintenance:0},{name:'新竹',critical:1,major:0,devices:64,incidents:1,maintenance:0},{name:'台中',critical:0,major:0,devices:88,incidents:0,maintenance:1},{name:'台南',critical:0,major:1,devices:55,incidents:1,maintenance:0},{name:'高雄',critical:0,major:0,devices:79,incidents:0,maintenance:0},
];
