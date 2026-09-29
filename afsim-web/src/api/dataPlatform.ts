// ============================================================
// Data Platform - Unified API Client
// 通用 HTTP 客户端，支持自定义 baseUrl 和请求配置
// ============================================================

const API_BASE =
  (import.meta as any).env?.VITE_DATA_API_URL || 'http://localhost:8080/api/v1';

export class DataPlatformClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE;
  }

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return response.blob() as unknown as T;
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${path}${qs}`, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const dataPlatform = new DataPlatformClient();

// ============================================================
// Equipment-specific types and API
// ============================================================

export interface LockInfo {
  locked: boolean;
  locked_by?: string;
  error?: string;
}

export interface VersionEntry {
  version: number;
  author: string;
  timestamp: string;
  message: string;
}

export interface VersionHistory {
  versions: VersionEntry[];
}

export interface RollbackResponse {
  id: string;
  version: number;
  [key: string]: unknown;
}

// Equipment API methods using the data platform client
export const equipmentDataApi = {
  /** Get lock status for an equipment */
  async getLockStatus(id: string): Promise<LockInfo> {
    return dataPlatform.get<LockInfo>(`/equipment/${id}/lock`);
  },

  /** Acquire lock on an equipment */
  async acquireLock(id: string): Promise<{ success: boolean; locked_by: string; error?: string }> {
    return dataPlatform.post(`/equipment/${id}/lock`);
  },

  /** Release lock on an equipment */
  async releaseLock(id: string): Promise<void> {
    return dataPlatform.delete(`/equipment/${id}/lock`);
  },

  /** Get version history for an equipment */
  async getVersionHistory(id: string): Promise<VersionHistory> {
    return dataPlatform.get<VersionHistory>(`/equipment/${id}/versions`);
  },

  /** Rollback equipment to a specific version */
  async rollbackVersion(id: string, version: number): Promise<RollbackResponse> {
    return dataPlatform.post<RollbackResponse>(`/equipment/${id}/versions/${version}/rollback`);
  },

  /** Compare two versions */
  async compareVersions(id: string, v1: number, v2: number): Promise<unknown[]> {
    return dataPlatform.get<unknown[]>(`/equipment/${id}/versions/compare`, {
      v1: String(v1),
      v2: String(v2),
    });
  },
};
