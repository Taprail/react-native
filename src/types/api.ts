export type TaprailTier = 'infra' | 'platform';

export interface TaprailConfig {
  /** Your API key (test or live). Sent as Bearer token. */
  apiKey: string;
  /** API tier determines available endpoints. */
  tier: TaprailTier;
  /** Base URL override. Defaults to 'https://api.taprail.io'. */
  baseUrl?: string;
  /** Request timeout in ms. Defaults to 15000. */
  timeout?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
