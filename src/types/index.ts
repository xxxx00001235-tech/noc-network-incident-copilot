export type Role = 'operator' | 'engineer' | 'admin';
export type Severity = 'Critical' | 'Major' | 'Minor' | 'Warning' | 'Normal';
export type DeviceStatus = 'normal' | 'incident' | 'maintenance' | 'unknown';
export type IncidentStatus = '收到告警'|'AI 分析完成'|'查測中'|'等待設備管理員'|'確認原因'|'初報完成'|'持續追蹤'|'設備恢復'|'結報完成'|'事件關閉';
export interface User { id:string; username:string; password:string; name:string; employeeId:string; email:string; teams:string; phone:string; department:string; role:Role; status:'啟用'|'等待審核'|'拒絕'|'停用' }
export interface Maintenance { type:string; content:string; start:string; end:string; owner:string; ticket:string; impact:string; note:string }
export interface Device { id:string; name:string; ip:string; type:string; region:string; site:string; status:DeviceStatus; alarms:number; upstream?:string; downstream:string[]; backup?:string; maintenance?:Maintenance; cpu?:number }
export interface Alarm { id:string; time:string; severity:Severity; region:string; site:string; deviceId:string; deviceName:string; ip:string; deviceType:string; content:string; source:string; status:string; owner:string; maintenance:boolean; updated:string; incidentId:string }
export interface TimelineEvent { id:string; time:string; actor:string; text:string; from?:string; to?:string }
export interface Incident { id:string; title:string; deviceId:string; severity:Severity; status:IncidentStatus; affectedDevices:number; affectedUsers:number; cause:string; started:string; timeline:TimelineEvent[] }
export interface Contact { id:string; priority:number; name:string; role:string; phone:string; teams:string; status:string; deviceId:string }
export interface DiagnosticResult { rootCause:string; confidence:number; evidence:string[]; impact:string; steps:string[]; contact:string; maintenanceLikely:boolean; risk:string }
export interface TestResult { id:string; name:string; status:'等待'|'執行中'|'成功'|'失敗'; result:string; explanation:string }
export interface TopologyNode { id:string; deviceId:string; x:number; y:number }
export interface TopologyLink { id:string; source:string; target:string; backup?:boolean }
export interface Region { name:string; critical:number; major:number; devices:number; incidents:number; maintenance:number }
export interface SnmpAgent { id:string; deviceId:string; ip:string; version:string; community:string; port:number; status:'UP'|'DOWN'; lastPoll:string }
export interface NotificationTemplate { type:'初報'|'續報'|'結報'; content:string }
