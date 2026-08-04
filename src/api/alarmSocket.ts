import { demoSafeModeMessage, fastApiBaseUrl, isBackendAvailable, reportBackendUnavailable } from '../lib/apiClient';
import { normalizeFastApiAlarm, type FastApiAlarm, type LatestAlarmResponse } from './alarms';
import type { Alarm } from '../types';
import type { AnalysisDiagnosis } from './analysis';

export type AlarmSocketState = 'connecting' | 'connected' | 'disconnected';

function socketUrl() {
  const base = new URL(fastApiBaseUrl, window.location.href);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  if (window.location.protocol === 'https:' && base.protocol !== 'wss:') return null;
  base.pathname = `${base.pathname.replace(/\/$/, '')}/ws/alarms`;
  base.search = '';
  return base.toString();
}

function parseAlarm(payload: unknown): Alarm | null {
  if (!payload || typeof payload !== 'object') return null;
  const message = payload as Record<string, unknown>;
  if (message.type === 'ping' || message.type === 'connected') return null;
  const envelope = (message.type === 'alarm' && message.data ? message.data : message) as Record<string, unknown>;
  if ('deviceId' in envelope && 'deviceName' in envelope && 'content' in envelope) return envelope as unknown as Alarm;
  const source = (envelope.alarm ?? envelope) as FastApiAlarm;
  if (!source?.device_id || !source?.device_name || !source?.alarm) return null;
  return normalizeFastApiAlarm({
    status: String(envelope.status ?? 'ok'),
    source_file: typeof envelope.source_file === 'string' ? envelope.source_file : undefined,
    alarm: source,
  } satisfies LatestAlarmResponse);
}

export function connectAlarmSocket(options: {
  onAlarm: (alarm: Alarm) => void;
  onDiagnosis?: (diagnosis: AnalysisDiagnosis) => void;
  onState: (state: AlarmSocketState) => void;
}) {
  let socket: WebSocket | null = null;
  let retryTimer = 0;
  let retryCount = 0;
  let stopped = false;

  const connect = () => {
    if (stopped) return;
    if (!isBackendAvailable()) {
      options.onState('disconnected');
      console.warn(demoSafeModeMessage);
      return;
    }
    options.onState('connecting');
    const url = socketUrl();
    if (!url) {
      options.onState('disconnected');
      console.warn(demoSafeModeMessage);
      return;
    }
    try {
      socket = new WebSocket(url);
    } catch (error) {
      options.onState('disconnected');
      reportBackendUnavailable(error);
      return;
    }
    socket.onopen = () => {
      retryCount = 0;
      options.onState('connected');
    };
    socket.onmessage = event => {
      try {
        const payload=JSON.parse(String(event.data)) as Record<string,unknown>;
        const diagnosis=payload.ai_diagnosis as AnalysisDiagnosis|undefined;
        if(diagnosis) options.onDiagnosis?.(diagnosis);
        const alarm = parseAlarm(payload);
        if (alarm) options.onAlarm(alarm);
      } catch {
        // Ignore malformed frames; a later valid alarm must still be received.
      }
    };
    socket.onclose = () => {
      if (stopped) return;
      options.onState('disconnected');
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryCount++, 5));
      retryTimer = window.setTimeout(connect, delay);
    };
    socket.onerror = event => {
      reportBackendUnavailable(event);
      socket?.close();
    };
  };

  connect();
  return () => {
    stopped = true;
    window.clearTimeout(retryTimer);
    socket?.close();
  };
}
