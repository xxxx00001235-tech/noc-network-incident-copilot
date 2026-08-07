import type { Contact, User } from '../types';

// Local authentication fallback and responsibility contacts. Alarm, incident,
// device, and statistics data intentionally do not live in this module.
export const users:User[] = [
  {id:'u1',username:'operator',password:'NocLocal!2026',name:'林怡君',employeeId:'D001',email:'operator@noc.local',teams:'operator@noc.local',phone:'0900-000-001',department:'NOC',role:'operator',status:'啟用'},
  {id:'u2',username:'engineer',password:'NocLocal!2026',name:'Kevin Wang',employeeId:'D002',email:'engineer@noc.local',teams:'kevin.wang@example.com',phone:'0900-000-002',department:'網路工程',role:'engineer',status:'啟用'},
  {id:'u3',username:'admin',password:'NocLocal!2026',name:'系統管理員',employeeId:'D003',email:'admin@noc.local',teams:'admin@noc.local',phone:'0900-000-003',department:'資訊處',role:'admin',status:'啟用'},
  {id:'u4',username:'pending',password:'NocLocal!2026',name:'測試申請者',employeeId:'D004',email:'pending@noc.local',teams:'pending@noc.local',phone:'0900-000-004',department:'維運',role:'operator',status:'等待審核'},
];

export const contacts:Contact[] = [
  {id:'c1',priority:1,name:'xxxx00001235',role:'負責設備：台北南港核心路由器',phone:'未設定',teams:'xxxx00001235@gmail.com',status:'主要聯絡人',deviceId:'RTR-TP-NG-CORE-001'},
  {id:'c2',priority:2,name:'jeff',role:'負責設備：台北南港匯聚交換器',phone:'未設定',teams:'jeffwwe8177616@gmail.com',status:'主要聯絡人',deviceId:'SW-TP-NG-DIST-001'},
  {id:'c3',priority:3,name:'稚深',role:'負責設備：台北南港接取設備',phone:'未設定',teams:'xxxx000159874@gmail.com',status:'主要聯絡人',deviceId:'OLT-TP-NG-ACCESS-001'},
];
