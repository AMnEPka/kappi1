import axios from 'axios';

// API Configuration
const API_URL = process.env.REACT_APP_BACKEND_URL || '/';
// Определяем WS URL динамически на основе текущего хоста
const getDefaultWsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};
const WS_URL = process.env.REACT_APP_WS_URL || getDefaultWsUrl();

export const api = axios.create({
  baseURL: API_URL,
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];
let tokenRefreshInterval = null;

// Decode JWT token to get expiration time
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

// Get token expiration time in milliseconds
const getTokenExpirationTime = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  // exp is in seconds, convert to milliseconds
  return decoded.exp * 1000;
};

// Check if token needs refresh (refresh 1 minute before expiration)
const shouldRefreshToken = (token) => {
  if (!token) return false;
  const expTime = getTokenExpirationTime(token);
  if (!expTime) return false;
  const now = Date.now();
  const timeUntilExpiry = expTime - now;
  // Refresh if token expires in less than 1 minute (60000 ms)
  return timeUntilExpiry < 60000 && timeUntilExpiry > 0;
};

// Setup automatic token refresh
const setupTokenRefresh = () => {
  // Clear existing interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }

  // Check token every 30 seconds
  tokenRefreshInterval = setInterval(async () => {
    const token = getAccessToken();
    if (!token) {
      // No token, clear interval
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
      }
      return;
    }

    // Check if token needs refresh
    if (shouldRefreshToken(token) && !isRefreshing) {
      console.log('🔄 Auto-refreshing token before expiration...');
      try {
        await refreshAccessToken();
        console.log('✅ Token auto-refreshed successfully');
      } catch (error) {
        console.error('❌ Auto token refresh failed:', error);
        // Don't logout on auto-refresh failure, let the 401 handler deal with it
      }
    }
  }, 30000); // Check every 30 seconds
};

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
  // Setup automatic token refresh when tokens are set
  if (accessToken) {
    setupTokenRefresh();
  }
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('user');
  // Clear token refresh interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
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
  // Restart token refresh interval with new token
  setupTokenRefresh();
  return access_token;
};

// Logout and redirect
const forceLogout = (reason = 'session_expired') => {
  clearTokens();
  const currentPath = window.location.pathname + window.location.search;
  window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}&reason=${reason}`;
};

// Request interceptor - add token to all requests and check if refresh needed
api.interceptors.request.use(
  async (config) => {
    const token = getAccessToken();
    if (token) {
      // Check if token needs refresh before making request
      if (shouldRefreshToken(token) && !isRefreshing) {
        try {
          const newToken = await refreshAccessToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          return config;
        } catch (error) {
          console.warn('Token refresh in request interceptor failed, using existing token:', error);
        }
      }
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

// Initialize token refresh on module load if token exists
if (typeof window !== 'undefined') {
  const token = getAccessToken();
  if (token) {
    setupTokenRefresh();
  }
}

export default api;
