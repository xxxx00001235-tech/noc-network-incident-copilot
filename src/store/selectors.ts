import type { Alarm, Device, Incident, Region, Severity } from '../types';

const inactiveStatuses = new Set(['UP','CLOSED','RECOVERED','RESOLVED','已恢復','事件關閉','結報完成']);

export function isFormalAlarm(alarm:Alarm) {
  return !alarm.id.startsWith('LAB-') && !alarm.id.startsWith('ALM-DEMO-') && !/SNMP Lab|Scenario Control/i.test(alarm.source);
}

export function isActiveAlarm(alarm:Alarm) {
  return isFormalAlarm(alarm) && alarm.severity !== 'Normal' && !inactiveStatuses.has(alarm.status.trim().toUpperCase());
}

export interface NocStatistics {
  criticalCount:number; majorCount:number; minorCount:number; warningCount:number;
  activeAlarmCount:number; maintenanceCount:number; normalDeviceCount:number;
  affectedDeviceCount:number; todayIncidentCount:number;
}

export function deriveStatistics(alarms:Alarm[],devices:Device[],incidents:Incident[]):NocStatistics {
  const active=alarms.filter(isActiveAlarm);
  const count=(severity:Severity)=>active.filter(alarm=>alarm.severity===severity).length;
  const affectedIds=new Set(active.map(alarm=>alarm.deviceId));
  const today=new Date().toDateString();
  return {
    criticalCount:count('Critical'), majorCount:count('Major'), minorCount:count('Minor'), warningCount:count('Warning'),
    activeAlarmCount:active.length,
    maintenanceCount:devices.filter(device=>device.status==='maintenance').length,
    normalDeviceCount:devices.filter(device=>device.status!=='maintenance'&&!affectedIds.has(device.id)).length,
    affectedDeviceCount:affectedIds.size,
    todayIncidentCount:incidents.filter(incident=>{const parsed=new Date(incident.started);return !Number.isNaN(parsed.getTime())&&parsed.toDateString()===today}).length,
  };
}

export function deriveRegions(alarms:Alarm[],devices:Device[],incidents:Incident[]):Region[] {
  const formal=alarms.filter(isFormalAlarm);
  const names=new Set([...devices.map(device=>device.region),...formal.map(alarm=>alarm.region)].filter(Boolean));
  const active=formal.filter(isActiveAlarm);
  return [...names].sort((a,b)=>a.localeCompare(b,'zh-TW')).map(name=>({
    name,
    critical:active.filter(alarm=>alarm.region===name&&alarm.severity==='Critical').length,
    major:active.filter(alarm=>alarm.region===name&&alarm.severity==='Major').length,
    devices:devices.filter(device=>device.region===name).length,
    incidents:incidents.filter(incident=>active.some(alarm=>alarm.incidentId===incident.id&&alarm.region===name)).length,
    maintenance:devices.filter(device=>device.region===name&&device.status==='maintenance').length,
  }));
}
