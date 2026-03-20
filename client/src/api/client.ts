import { API_BASE } from '../constants/dataSources';

export interface SwipePayload {
  career_id: number;
  direction: 'left' | 'right';
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
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

  async submitSwipe(careerId: number, direction: 'left' | 'right'): Promise<void> {
    await this.post('/api/swipes', { career_id: careerId, direction });
  }

  async getCareers(params?: Record<string, string | number>): Promise<unknown> {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return this.get(`/api/roi${queryString}`);
  }
}

export const apiClient = new ApiClient();
