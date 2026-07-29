import type { Alarm, Severity } from '../types';
import { apiRequest } from '../lib/apiClient';

interface FastApiAlarm {
  time?: string;
  device_id: string;
  device_name: string;
  location?: string;
  ip?: string;
  device_type?: string;
  alarm: string;
  status: string;
  owner?: string;
  email?: string;
  severity?: string;
}

interface LatestAlarmResponse {
  status: string;
  source_file?: string;
  alarm: FastApiAlarm;
}

function normalizeSeverity(value: string | undefined, status: string): Severity {
  const severity = value?.toLowerCase();
  if (severity === 'critical') return 'Critical';
  if (severity === 'major') return 'Major';
  if (severity === 'minor') return 'Minor';
  if (severity === 'warning') return 'Warning';
  if (severity === 'normal') return 'Normal';
  return status.toUpperCase() === 'DOWN' ? 'Critical' : 'Warning';
}

function locationParts(location = '') {
  const regionMatch = location.match(/^(台北|新北|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)/);
  return {
    region: regionMatch?.[1] || 'Lab',
    site: location || 'NOC Lab',
  };
}

export async function fetchLatestAlarm(): Promise<Alarm> {
  const response = await apiRequest<LatestAlarmResponse>('/api/alarms/latest');
  const source = response.alarm;
  const location = locationParts(source.location);
  const id = response.source_file
    ? `FASTAPI-${response.source_file.replace(/^alarm_|\.json$/g, '')}`
    : `FASTAPI-${source.device_id}-${source.time || 'latest'}`;

  return {
    id,
    time: source.time || new Date().toLocaleString('zh-TW'),
    severity: normalizeSeverity(source.severity, source.status),
    region: location.region,
    site: location.site,
    deviceId: source.device_id,
    deviceName: source.device_name,
    ip: source.ip || '—',
    deviceType: source.device_type || 'NOC Lab 設備',
    content: source.alarm,
    source: 'FastAPI /api/alarms/latest',
    status: source.status.toUpperCase() === 'DOWN' ? '作用中' : source.status,
    owner: source.owner || '未指派',
    maintenance: false,
    updated: source.time || new Date().toLocaleString('zh-TW'),
    incidentId: `INC-${id}`,
  };
}
