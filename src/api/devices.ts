import { apiRequest } from '../lib/apiClient';
import type { DeviceStatus } from '../types';

export type DeviceLayer = 'Core' | 'Distribution' | 'Access';
export interface DeviceOwner { id:number; username:string; email:string }
export interface ApiDevice {
  id:number; device_id:string; device_name:string; ip:string; device_type:string;
  layer:DeviceLayer; region:string; site:string; location?:string|null;
  status:DeviceStatus; owner_user_id?:number|null; backup_owner_user_id?:number|null;
  owner?:DeviceOwner|null; backup_owner?:DeviceOwner|null; description?:string|null;
  created_at:string; updated_at:string;
}
export type DeviceInput = Omit<ApiDevice, 'id'|'owner'|'backup_owner'|'created_at'|'updated_at'>;
export interface DeviceFilters { keyword?:string; region?:string; status?:string; device_type?:string }

export function fetchDevices(filters:DeviceFilters={}):Promise<ApiDevice[]> {
  const query=new URLSearchParams();
  Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value)});
  return apiRequest(`/api/devices${query.size?`?${query}`:''}`);
}
export const createDevice=(device:DeviceInput)=>apiRequest<ApiDevice>('/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(device)});
export const updateDevice=(deviceId:string,device:Partial<DeviceInput>)=>apiRequest<ApiDevice>(`/api/devices/${encodeURIComponent(deviceId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(device)});
export const deleteDevice=(deviceId:string)=>apiRequest<void>(`/api/devices/${encodeURIComponent(deviceId)}`,{method:'DELETE'});
