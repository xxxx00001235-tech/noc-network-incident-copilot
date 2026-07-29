import { apiRequest } from '../lib/apiClient';
import type { AnalysisResponse } from './analysis';

export interface ReportResponse {
  status: string;
  device_id: string;
  report: string;
  analysis: AnalysisResponse;
}

export function fetchReport(deviceId: string): Promise<ReportResponse> {
  return apiRequest<ReportResponse>(`/api/report/${encodeURIComponent(deviceId)}`);
}
