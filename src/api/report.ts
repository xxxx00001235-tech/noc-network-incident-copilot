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

export function generateTeamsReport(deviceId:string):Promise<ReportResponse>{
  return apiRequest<ReportResponse>(`/api/ai/teams-report/${encodeURIComponent(deviceId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_type:'initial'})});
}
