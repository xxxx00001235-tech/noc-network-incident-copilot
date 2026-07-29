import { apiRequest } from '../lib/apiClient';

export interface TopologyApiNode {
  id?: string;
  device_id?: string;
  device_name?: string;
  name?: string;
  ip?: string;
  device_type?: string;
  type?: string;
  status?: string;
  region?: string;
  site?: string;
  x?: number;
  y?: number;
}

export type TopologyDeviceReference = string | TopologyApiNode;

export interface TopologyApiLink {
  id?: string;
  source: string;
  target: string;
  backup?: boolean;
}

export interface TopologyResponse {
  status: string;
  fault_device: TopologyDeviceReference | null;
  upstream: TopologyDeviceReference[];
  downstream: TopologyDeviceReference[];
  affected_device_ids: string[];
  nodes: TopologyApiNode[];
  links: TopologyApiLink[];
}

export function fetchTopology(deviceId: string): Promise<TopologyResponse> {
  return apiRequest<TopologyResponse>(`/api/topology/${encodeURIComponent(deviceId)}`);
}
