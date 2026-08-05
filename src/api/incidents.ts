import { apiRequest } from '../lib/apiClient';

export type IncidentStatus = 'OPEN'|'ACKNOWLEDGED'|'IN_PROGRESS'|'RECOVERED'|'CLOSED';
export interface ApiIncident {
  incident_id:string; device_id:string; alarm_type:string; severity:string; status:IncidentStatus;
  start_time:string; acknowledged_time:string|null; recovered_time:string|null; closed_time:string|null;
  duration_seconds:number|null; operator_id:number|null; engineer_id:number|null;
  root_cause:string|null; resolution:string|null; created_at:string; updated_at:string;
  timeline:Array<{id:number;event_type:string;from_status:string|null;to_status:string;note:string|null;created_at:string;actor:{username:string;name:string|null}|null}>;
}
const query=(path:string,params?:URLSearchParams)=>apiRequest<ApiIncident[]>(`${path}${params?.size?`?${params}`:''}`);
export const fetchActiveIncidents=(params?:URLSearchParams)=>query('/api/incidents/active',params);
export const fetchIncidentHistory=(params?:URLSearchParams)=>query('/api/incidents/history',params);
