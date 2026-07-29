import { apiRequest } from '../lib/apiClient';

export interface MaintenanceOwner {
  username: string;
  email: string;
}

export interface MaintenanceDetails {
  status: string;
  start_time: string;
  end_time: string;
  description: string;
  owner: MaintenanceOwner;
}

export interface MaintenanceResponse {
  status: string;
  device_id: string;
  under_maintenance: boolean;
  maintenance: MaintenanceDetails | null;
}

export function fetchMaintenance(deviceId: string): Promise<MaintenanceResponse> {
  return apiRequest<MaintenanceResponse>(`/api/maintenance/${encodeURIComponent(deviceId)}`);
}
