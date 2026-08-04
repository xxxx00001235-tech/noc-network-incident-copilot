import { apiRequest } from '../lib/apiClient';

export interface AnalysisDiagnosis {
  likely_cause: string;
  root_cause?: string;
  confidence: number;
  recommendation: string | string[];
  suggested_actions?: string[];
  impacted_devices?: string[];
  generated_at?: string;
}

export interface AiTimelineEvent { stage:string; actor:string; time:string; detail:string }

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

export function fetchAiTimeline(deviceId:string):Promise<{status:string;device_id:string;events:AiTimelineEvent[]}>{
  return apiRequest(`/api/ai/timeline/${encodeURIComponent(deviceId)}`);
}
