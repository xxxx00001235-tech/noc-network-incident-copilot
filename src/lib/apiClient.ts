export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const configuredBaseUrl = import.meta.env.VITE_FASTAPI_BASE_URL?.trim();
const fallbackBaseUrl = import.meta.env.PROD
  ? window.location.origin
  : 'http://192.168.176.130:8000';
const fastApiBaseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/+$/, '');
const fastApiUrl = new URL(fastApiBaseUrl, window.location.href);

if (window.location.protocol === 'https:' && fastApiUrl.protocol !== 'https:') {
  throw new Error('VITE_FASTAPI_BASE_URL must use HTTPS on a secure page.');
}

if (import.meta.env.PROD) {
  const privateHostname = fastApiUrl.hostname === 'localhost'
    || fastApiUrl.hostname === '127.0.0.1'
    || /^192\.168\./.test(fastApiUrl.hostname);
  if (fastApiUrl.protocol !== 'https:' || privateHostname) {
    throw new Error('VITE_FASTAPI_BASE_URL must be a public HTTPS URL in production.');
  }
}

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, signal, headers, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, { once: true });

  try {
    let role = 'operator';
    try { role = JSON.parse(localStorage.getItem('noc-copilot-state') || '{}')?.state?.currentUser?.role || role; } catch { /* use least-privileged role */ }
    const response = await fetch(`${fastApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...requestInit,
      headers: {
        Accept: 'application/json',
        'X-NOC-Role': role,
        ...headers,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json() as { detail?: string };
        detail = body.detail ? `：${body.detail}` : '';
      } catch {
        // The HTTP status is still useful when the response body is not JSON.
      }
      throw new ApiError(`API 回應失敗（${response.status}）${detail}`, response.status);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('連線逾時，請確認 FastAPI 是否正在執行');
    }
    throw new ApiError('無法連接 FastAPI，請確認虛擬機、IP 位址與 CORS 設定');
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

export { fastApiBaseUrl };
