import { apiRequest } from '../lib/apiClient';

export type DeviceStatus = 'normal' | 'incident' | 'maintenance' | 'unknown';

export interface DeviceStatusResponse {
  device_id: string;
  status: DeviceStatus;
  updated_at: string;
}

export interface AlarmHistoryEntry {
  id: number;
  device_id: string;
  alarm: string;
  status: string;
  severity: string;
  device_status: DeviceStatus;
  created_at: string;
}

export interface DashboardStatistics {
  total_devices: number;
  normal_devices: number;
  incident_devices: number;
  maintenance_devices: number;
  unknown_devices: number;
  total_alarms: number;
  active_alarms: number;
  critical_alarms: number;
}

export function fetchDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
  return apiRequest(`/api/devices/${encodeURIComponent(deviceId)}/status`);
}

export function fetchAlarmHistory(deviceId?: string, limit = 100): Promise<AlarmHistoryEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (deviceId) params.set('device_id', deviceId);
  return apiRequest(`/api/alarms/history?${params}`);
}

export function fetchDashboardStatistics(): Promise<DashboardStatistics> {
  return apiRequest('/api/dashboard/statistics');
}
