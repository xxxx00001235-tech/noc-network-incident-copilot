import type { Alarm, Contact, Incident, Region, User } from '../types';

export const users:User[] = [
  {id:'u1',username:'operator',password:'123456',name:'林怡君',employeeId:'D001',email:'operator@demo.local',teams:'operator@demo.local',phone:'0900-000-001',department:'NOC',role:'operator',status:'啟用'},
  {id:'u2',username:'engineer',password:'123456',name:'Kevin Wang',employeeId:'D002',email:'engineer@demo.local',teams:'kevin.wang@example.com',phone:'0900-000-002',department:'網路工程',role:'engineer',status:'啟用'},
  {id:'u3',username:'admin',password:'123456',name:'系統管理員',employeeId:'D003',email:'admin@demo.local',teams:'admin@demo.local',phone:'0900-000-003',department:'資訊處',role:'admin',status:'啟用'},
  {id:'u4',username:'pending',password:'123456',name:'測試申請者',employeeId:'D004',email:'pending@demo.local',teams:'pending@demo.local',phone:'0900-000-004',department:'維運',role:'operator',status:'等待審核'},
];
export { devices, topologyLinks, topologyNodes } from './inventory';
export const alarms:Alarm[] = [
  {id:'ALM-260725-001',time:'2026-07-25 09:00',severity:'Critical',region:'台北',site:'南港',deviceId:'SW-TP-NG-001',deviceName:'SW-TP-NG-001',ip:'10.10.1.1',deviceType:'Core Switch',content:'設備無回應、上游介面 Optical LOS',source:'SNMP Trap',status:'處理中',owner:'林怡君',maintenance:false,updated:'09:12',incidentId:'INC-20260725-001'},
  {id:'ALM-260725-002',time:'2026-07-25 08:42',severity:'Major',region:'桃園',site:'桃園',deviceId:'SW-TY-001',deviceName:'SW-TY-001',ip:'10.30.1.1',deviceType:'Distribution Switch',content:'CPU High 94%',source:'模擬輪詢',status:'待處理',owner:'未指派',maintenance:false,updated:'08:55',incidentId:'INC-20260725-002'},
  {id:'ALM-260725-003',time:'2026-07-25 08:31',severity:'Critical',region:'新竹',site:'科學園區',deviceId:'OLT-HC-001',deviceName:'OLT-HC-001',ip:'10.40.1.1',deviceType:'Optical Device',content:'Optical LOS，影響下游 28 台',source:'模擬 Trap',status:'待處理',owner:'未指派',maintenance:false,updated:'08:31',incidentId:'INC-20260725-003'},
  {id:'ALM-260725-004',time:'2026-07-25 01:10',severity:'Warning',region:'台北',site:'信義',deviceId:'RTR-TP-NG-BACKUP-001',deviceName:'RTR-TP-NG-BACKUP-001',ip:'10.20.1.1',deviceType:'Router',content:'設備重新啟動',source:'維護監控',status:'維護已確認',owner:'Amy Chen',maintenance:true,updated:'01:12',incidentId:'INC-20260725-004'},
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
 {id:'c1',priority:1,name:'xxxx00001235',role:'負責設備：台北南港核心路由器',phone:'未設定',teams:'xxxx00001235@gmail.com',status:'模擬負責人',deviceId:'RTR-CORE-001'},
 {id:'c2',priority:2,name:'jeff',role:'負責設備：台北南港匯聚交換器',phone:'未設定',teams:'jeffwwe8177616@gmail.com',status:'模擬負責人',deviceId:'SW-TP-NG-001'},
 {id:'c3',priority:3,name:'稚深',role:'負責設備：台北南港接取設備',phone:'未設定',teams:'xxxx000159874@gmail.com',status:'模擬負責人',deviceId:'OLT-HC-001'},
];
export const regions:Region[] = [
 {name:'台北',critical:1,major:0,devices:148,incidents:1,maintenance:1},{name:'新北',critical:0,major:1,devices:96,incidents:1,maintenance:0},{name:'桃園',critical:0,major:1,devices:72,incidents:1,maintenance:0},{name:'新竹',critical:1,major:0,devices:64,incidents:1,maintenance:0},{name:'台中',critical:0,major:0,devices:88,incidents:0,maintenance:1},{name:'台南',critical:0,major:1,devices:55,incidents:1,maintenance:0},{name:'高雄',critical:0,major:0,devices:79,incidents:0,maintenance:0},
];
