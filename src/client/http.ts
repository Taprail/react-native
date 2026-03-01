import type { TaprailConfig, ApiResponse } from '../types';
import { TaprailError, type TaprailErrorCode } from '../types/errors';

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
  params?: Record<string, string | number | undefined>;
}

export async function request<T>(
  config: TaprailConfig,
  options: RequestOptions,
): Promise<T> {
  const baseUrl = config.baseUrl ?? 'https://api.taprail.io';
  const tierPrefix = `/v1/${config.tier}`;
  const url = new URL(`${tierPrefix}${options.path}`, baseUrl);

  if (options.params) {
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined) url.searchParams.set(key, String(val));
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeout ?? 15000,
  );

  try {
    const response = await fetch(url.toString(), {
      method: options.method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const json: ApiResponse<T> = await response.json();

    if (!response.ok || !json.success) {
      const code = mapStatusToCode(response.status);
      throw new TaprailError(code, json.message, response.status);
    }

    return json.data as T;
  } catch (error) {
    if (error instanceof TaprailError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new TaprailError('TIMEOUT', 'Request timed out');
    }
    throw new TaprailError('NETWORK', (error as Error).message);
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapStatusToCode(status: number): TaprailErrorCode {
  switch (status) {
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 400: return 'BAD_REQUEST';
    case 404: return 'NOT_FOUND';
    default: return 'INTERNAL';
  }
}
