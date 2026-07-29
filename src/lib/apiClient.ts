export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const configuredBaseUrl = import.meta.env.VITE_FASTAPI_BASE_URL?.trim();
const fastApiBaseUrl = (configuredBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, signal, headers, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${fastApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...requestInit,
      headers: {
        Accept: 'application/json',
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
  }
}

export { fastApiBaseUrl };
