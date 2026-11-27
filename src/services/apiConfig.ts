/**
 * MITRA DRISHTI — Centralized API Configuration & Base URL Resolution
 * Supports deployed backend URLs (Vercel, Render, Railway, AWS) and local clinical server instances.
 */

const STORAGE_KEY = 'mitra_drishti_api_url';

function resolveDefaultBaseUrl(): string {
  // Check Vite environment variables
  const envUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    '';

  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Check localStorage runtime override (for clinic operators configuring custom server address)
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }

  return '';
}

let currentBaseUrl: string = resolveDefaultBaseUrl();

/**
 * Returns the currently active backend API base URL (empty string indicates same-origin relative calls).
 */
export function getApiBaseUrl(): string {
  return currentBaseUrl;
}

/**
 * Allows dynamic configuration of the backend API URL at runtime.
 */
export function setApiBaseUrl(url: string | null): void {
  if (url && url.trim()) {
    currentBaseUrl = url.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, currentBaseUrl);
    }
  } else {
    currentBaseUrl = '';
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Transforms an API path (e.g., '/api/detect/predict') into a fully-qualified URL
 * using the configured backend URL if available, or a clean relative path.
 */
export function apiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!currentBaseUrl) {
    return cleanEndpoint;
  }
  return `${currentBaseUrl}${cleanEndpoint}`;
}
