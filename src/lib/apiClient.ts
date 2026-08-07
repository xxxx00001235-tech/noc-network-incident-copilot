export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status; }
}

const backendStatusEvent = 'noc-backend-status';
const demoSafeModeMessage = '資料服務暫時離線，正在重新連線';
const configuredBaseUrl = import.meta.env.VITE_FASTAPI_BASE_URL?.trim();
const localFallbackBaseUrl = 'http://127.0.0.1:8000';

function resolveFastApiBaseUrl() {
  const candidate = configuredBaseUrl || (import.meta.env.PROD ? '' : localFallbackBaseUrl);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const privateHostname = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || /^192\.168\./.test(url.hostname);
    const securePageMismatch = window.location.protocol === 'https:' && url.protocol !== 'https:';
    const invalidProductionUrl = import.meta.env.PROD && (url.protocol !== 'https:' || privateHostname);
    if (!['http:', 'https:'].includes(url.protocol) || securePageMismatch || invalidProductionUrl) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const resolvedFastApiBaseUrl = resolveFastApiBaseUrl();
const fastApiBaseUrl = resolvedFastApiBaseUrl;
let backendAvailable = resolvedFastApiBaseUrl !== null;

function setBackendAvailable(available: boolean, reason?: unknown) {
  if (!available && reason) console.warn(demoSafeModeMessage, reason);
  if (backendAvailable === available) return;
  backendAvailable = available;
  window.dispatchEvent(new CustomEvent(backendStatusEvent, { detail: { available } }));
}

export function isBackendAvailable() { return backendAvailable; }
export function reportBackendUnavailable(reason?: unknown) { setBackendAvailable(false, reason); }

type RequestOptions = RequestInit & { timeoutMs?: number; baseUrl?: string };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!resolvedFastApiBaseUrl) {
    setBackendAvailable(false);
    return Promise.reject(new ApiError(demoSafeModeMessage));
  }
  const { timeoutMs = 8000, signal, headers, baseUrl = fastApiBaseUrl, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, { once: true });
  try {
    let role = 'operator';
    try { role = JSON.parse(localStorage.getItem('noc-copilot-state') || '{}')?.state?.currentUser?.role || role; } catch { /* least privilege */ }
    const token = localStorage.getItem('noc-access-token');
    const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...requestInit,
      headers: { Accept: 'application/json', 'X-NOC-Role': role, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) {
      let detail = '';
      try { const body = await response.json() as { detail?: string }; detail = body.detail ? `：${body.detail}` : ''; } catch { /* status remains useful */ }
      throw new ApiError(`API 請求失敗（${response.status}）${detail}`, response.status);
    }
    setBackendAvailable(true);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    setBackendAvailable(false, error);
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(`${demoSafeModeMessage}（請求逾時）`);
    throw new ApiError(demoSafeModeMessage);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

export { backendStatusEvent, demoSafeModeMessage, fastApiBaseUrl };
