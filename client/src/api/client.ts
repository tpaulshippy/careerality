import { API_BASE } from '../constants/dataSources';
import { getUserId } from '../utils/userId';
import { CareerROI, RoiResponse, LikedResponse } from '../types';

export interface SwipePayload {
  career_id: number;
  user_id: string;
  direction: 'left' | 'right';
  feedback?: string;
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'ApiTimeoutError';
  }
}

class ApiClient {
  private baseUrl: string;
  private readonly defaultTimeoutMs: number = 15000;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { signal } = options;
    let externalAbort = false;
    const onExternalAbort = () => {
      externalAbort = true;
      controller.abort();
    };
    if (signal) {
      if (signal.aborted) onExternalAbort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return response.json() as Promise<T>;
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        if (externalAbort) throw err;
        throw new ApiTimeoutError();
      }
      throw err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitSwipe(careerId: number, direction: 'left' | 'right', feedback?: string): Promise<void> {
    const userId = await getUserId();
    const payload: SwipePayload = { career_id: careerId, user_id: userId, direction };
    if (feedback) payload.feedback = feedback;
    await this.post('/api/swipes', payload);
  }

  async searchCareers(query: string, signal?: AbortSignal): Promise<RoiResponse> {
    const queryString = '?' + new URLSearchParams({ q: query }).toString();
    return this.request<RoiResponse>(`/api/roi/search${queryString}`, { method: 'GET', signal });
  }

  async getCareers(params?: Record<string, string | number>): Promise<RoiResponse> {
    const userId = await getUserId();
    const allParams = { ...params, user_id: userId };
    const queryString = '?' + new URLSearchParams(
      Object.entries(allParams).map(([k, v]) => [k, String(v)])
    ).toString();
    return this.get<RoiResponse>(`/api/roi${queryString}`);
  }

  async searchCareers(query: string, areaCode?: string): Promise<RoiResponse> {
    const params: Record<string, string> = { q: query };
    if (areaCode) params.area = areaCode;
    const queryString = '?' + new URLSearchParams(params).toString();
    return this.get<RoiResponse>(`/api/roi/search${queryString}`);
  }

  async getStates(): Promise<{ states: { area_code: string; area_name: string }[] }> {
    return this.get<{ states: { area_code: string; area_name: string }[] }>('/api/areas/states');
  }

  async getCareerInArea(occupationCode: string, areaCode: string): Promise<CareerROI> {
    const code = encodeURIComponent(occupationCode);
    return this.get<CareerROI>(`/api/roi/${code}?area=${encodeURIComponent(areaCode)}`);
  }

  async getLikedCareers(): Promise<LikedResponse> {
    const userId = await getUserId();
    const queryString = '?' + new URLSearchParams({ user_id: userId }).toString();
    return this.get<LikedResponse>(`/api/swipes/liked${queryString}`);
  }

  async removeSwipe(swipeId: number): Promise<void> {
    const userId = await getUserId();
    const queryString = '?' + new URLSearchParams({ user_id: userId }).toString();
    await this.request(`/api/swipes/${swipeId}${queryString}`, { method: 'DELETE' });
  }

  async deleteAllSwipes(): Promise<{ deleted: number }> {
    const userId = await getUserId();
    const queryString = '?' + new URLSearchParams({ user_id: userId }).toString();
    return this.request(`/api/swipes/destroy_all${queryString}`, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
