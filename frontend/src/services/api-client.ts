const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.example.com';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, data?: unknown, message?: string) {
    super(message || `Request failed with status ${status}`);
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json().catch(() => ({}));
      } catch {
        errorData = {};
      }

      throw new ApiError(
        response.status,
        errorData,
        `Request failed with status ${response.status}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return {} as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or other errors
    throw new ApiError(0, undefined, 'Network error or request failed');
  }
}

