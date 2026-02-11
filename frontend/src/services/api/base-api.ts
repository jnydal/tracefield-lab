import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.example.com';

// Normalized error shape
export interface ApiErrorShape {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
}

// Transient error status codes that should be retried
const TRANSIENT_ERROR_STATUSES = [502, 503, 504];
const MAX_RETRIES = 2;

// Callback for auth state clearing - set by app initialization
let authClearHandler: (() => void) | null = null;

export function setAuthClearHandler(handler: () => void) {
  authClearHandler = handler;
}

// Default user-facing messages per status when response body has no message
function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 0:
      return 'Nettverksfeil. Sjekk tilkoblingen og prøv igjen.';
    case 400:
      return 'Ugyldig forespørsel. Sjekk at alle felt er fylt ut riktig.';
    case 409:
      return 'E-post er allerede i bruk. Vennligst velg en annen.';
    case 401:
      return 'Du må logge inn på nytt.';
    case 403:
      return 'Du har ikke tilgang.';
    case 404:
      return 'Fant ikke forespurt ressurs.';
    case 422:
      return 'Data kunne ikke valideres. Sjekk at informasjonen er riktig.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Serverfeil. Vennligst prøv igjen senere.';
    default:
      return status >= 500
        ? 'Serverfeil. Vennligst prøv igjen senere.'
        : 'Noe gikk galt. Vennligst prøv igjen.';
  }
}

// Normalize error from various sources into consistent shape
function normalizeError(
  error: unknown,
  status?: number
): ApiErrorShape {
  const errorStatus = status ?? 500;
  const defaultMessage = defaultMessageForStatus(errorStatus);

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check if it already has our normalized shape
    if (typeof errorObj.status === 'number' && typeof errorObj.message === 'string') {
      return errorObj as unknown as ApiErrorShape;
    }

    // Try to extract message from common error shapes (API uses "error" per OpenAPI ErrorResponse)
    const message =
      (typeof errorObj.message === 'string' && errorObj.message) ||
      (typeof errorObj.error === 'string' && errorObj.error) ||
      (typeof errorObj.detail === 'string' && errorObj.detail) ||
      (Array.isArray(errorObj.detail)
        ? (errorObj.detail as unknown[]).map((d) => (typeof d === 'string' ? d : (d as { msg?: string })?.msg ?? '')).filter(Boolean).join('. ') || defaultMessage
        : defaultMessage);

    return {
      status: errorStatus,
      code: typeof errorObj.code === 'string' ? errorObj.code : undefined,
      message: message || defaultMessage,
      details: errorObj.details || errorObj,
    };
  }

  return {
    status: errorStatus,
    message: typeof error === 'string' ? error : defaultMessage,
  };
}

// Base query with retry logic for transient errors
const baseQueryWithRetry: BaseQueryFn<
  string | FetchArgs,
  unknown,
  ApiErrorShape
> = async (args, api, extraOptions) => {
  const baseQuery = fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      // Add consistent headers
      headers.set('Content-Type', 'application/json');
      
      return headers;
    },
  });

  const result = await baseQuery(args, api, extraOptions);
  
  // Retry logic for transient errors (network errors and 5xx server errors)
  if (result.error) {
    const fetchError = result.error as FetchBaseQueryError;
    const retryCount = (extraOptions as { retryCount?: number })?.retryCount ?? 0;
    
    // Check if it's a network error (no status) or transient server error
    const isNetworkError = fetchError.status === 'FETCH_ERROR' || fetchError.status === 'PARSING_ERROR';
    const isTransientError = 
      typeof fetchError.status === 'number' && 
      TRANSIENT_ERROR_STATUSES.includes(fetchError.status);
    
    if ((isNetworkError || isTransientError) && retryCount < MAX_RETRIES) {
      // Exponential backoff: wait 2^retryCount * 100ms
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retryCount) * 100)
      );
      
      // Retry with incremented count
      return baseQueryWithRetry(
        args,
        api,
        { ...extraOptions, retryCount: retryCount + 1 }
      );
    }
  }

  // Normalize errors
  if (result.error) {
    const fetchError = result.error as FetchBaseQueryError;
    
    // Determine status: network errors get 0, parsing errors get 500, HTTP errors use their status
    let status = 500;
    if (typeof fetchError.status === 'number') {
      status = fetchError.status;
    } else if (fetchError.status === 'FETCH_ERROR') {
      status = 0; // Network error
    } else if (fetchError.status === 'PARSING_ERROR') {
      status = 500; // Parsing error
    }
    
    const data = 'data' in fetchError ? fetchError.data : undefined;
    const normalizedError = normalizeError(data, status);
    
    // Handle 401/403 - clear auth and redirect
    if (status === 401 || status === 403) {
      // Clear auth state via handler (set by app initialization)
      if (authClearHandler) {
        authClearHandler();
      }
      
      // Reset RTK Query cache
      api.dispatch(baseApi.util.resetApiState());
      
      // Redirect to login if not already there
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/login')) {
          window.location.href = `/login?returnTo=${encodeURIComponent(
            currentPath + window.location.search
          )}`;
        }
      }
    }
    
    return {
      error: normalizedError,
    };
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: [
    'Auth',
    'Datasets',
    'EntityMappings',
    'FeatureDefinitions',
    'AnalysisJobs',
    'AnalysisResults',
    'Profile',
    'Messages',
    'Search',
    'Subscriptions',
  ],
  endpoints: () => ({}),
});

