import { apiRequest } from '../lib/apiClient';

export interface AnalysisDiagnosis {
  likely_cause: string;
  confidence: number;
  recommendation: string | string[];
}

export interface AnalysisResponse {
  status: string;
  device_id: string;
  alarm: Record<string, unknown>;
  diagnosis: AnalysisDiagnosis;
  maintenance: Record<string, unknown> | null;
  topology: Record<string, unknown> | null;
}

export function fetchAnalysis(deviceId: string): Promise<AnalysisResponse> {
  return apiRequest<AnalysisResponse>(`/api/analyze/${encodeURIComponent(deviceId)}`);
}
