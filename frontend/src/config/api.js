import axios from 'axios';

// API Configuration
const API_URL = process.env.REACT_APP_BACKEND_URL || '/';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:415/ws';

export const api = axios.create({
  baseURL: API_URL,
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

// Process queued requests after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Token management functions
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('user');
};

// Refresh access token using refresh token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(`${API_URL}/api/auth/refresh`, {
    refresh_token: refreshToken
  });

  const { access_token } = response.data;
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  return access_token;
};

// Logout and redirect
const forceLogout = (reason = 'session_expired') => {
  clearTokens();
  const currentPath = window.location.pathname + window.location.search;
  window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}&reason=${reason}`;
};

// Request interceptor - add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry for auth endpoints (login, refresh, logout)
    if (originalRequest?.url?.includes('/auth/login') || 
        originalRequest?.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        
        processQueue(null, newToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        processQueue(refreshError, null);
        
        // Refresh failed - logout user
        forceLogout('session_expired');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// API helper for logout with refresh token invalidation
export const logoutApi = async () => {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await api.post('/api/auth/logout', { refresh_token: refreshToken });
    } catch (error) {
      console.warn('Logout API call failed, clearing tokens anyway:', error);
    }
  }
  clearTokens();
};

// API helper to logout from all sessions
export const logoutAllSessionsApi = async () => {
  try {
    const response = await api.post('/api/auth/logout-all');
    clearTokens();
    return response.data;
  } catch (error) {
    clearTokens();
    throw error;
  }
};

// API helper to get active sessions
export const getActiveSessionsApi = async () => {
  const response = await api.get('/api/auth/sessions');
  return response.data;
};

export default api;
