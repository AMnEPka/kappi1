import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import api, { 
  setTokens, 
  clearTokens, 
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  logoutApi 
} from '../config/api';

const AuthContext = createContext(null);

const USER_DATA_KEY = 'user_data';
const SILENT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const saveUserToStorage = (userData, perms) => {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify({ user: userData, permissions: perms }));
  } catch (_) { /* quota exceeded — non-critical */ }
};

const getUserFromStorage = () => {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Instant restore: if we have a cached user in localStorage, show it immediately
  // so there's no flash of "unauthorized" while the /me request is in flight.
  const cached = getAccessToken() ? getUserFromStorage() : null;

  const [user, setUser] = useState(cached?.user || null);
  const [permissions, setPermissions] = useState(cached?.permissions || []);
  const [loading, setLoading] = useState(!cached?.user);
  const silentRefreshRef = useRef(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/me');
      
      const userData = response.data.user || response.data;
      const perms = response.data.permissions || [];

      setUser(userData);
      setPermissions(perms);
      saveUserToStorage(userData, perms);
      
    } catch (error) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        // Definitive auth failure — server explicitly rejected the token.
        clearTokens();
        setUser(null);
        setPermissions([]);
        localStorage.removeItem(USER_DATA_KEY);
      }
      // Network errors (server unavailable, timeout, DNS) — do NOT touch tokens.
      // The token is likely still valid; wiping it would force an unnecessary re-login.
      // The user will keep seeing the cached profile until the server comes back.
    } finally {
      setLoading(false);
    }
  }, []);

  // Verify session on mount — refresh cached data from the server
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser]);

  // Silent refresh every 6 hours to keep the session alive during long idle periods
  useEffect(() => {
    if (!user) {
      if (silentRefreshRef.current) {
        clearInterval(silentRefreshRef.current);
        silentRefreshRef.current = null;
      }
      return;
    }

    silentRefreshRef.current = setInterval(async () => {
      const rt = getRefreshToken();
      if (!rt) return;
      try {
        await refreshAccessToken();
        console.log('✅ Silent 6h token refresh succeeded');
      } catch (e) {
        // Non-critical: the per-request interceptor and 20s timer still act as safety nets
        console.warn('⚠️ Silent 6h token refresh failed (non-critical):', e?.message);
      }
    }, SILENT_REFRESH_INTERVAL_MS);

    return () => {
      if (silentRefreshRef.current) {
        clearInterval(silentRefreshRef.current);
        silentRefreshRef.current = null;
      }
    };
  }, [user]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { access_token, refresh_token } = response.data;
      
      setTokens(access_token, refresh_token);
      
      await fetchCurrentUser();
      
      window.location.href = '/';
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Ошибка входа' 
      };
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.warn('Logout API error:', error);
    }
    
    localStorage.removeItem(USER_DATA_KEY);
    setUser(null);
    setPermissions([]);
    window.location.href = '/login';
  };

  const logoutAllSessions = async () => {
    try {
      const response = await api.post('/api/auth/logout-all');
      clearTokens();
      localStorage.removeItem(USER_DATA_KEY);
      setUser(null);
      setPermissions([]);
      window.location.href = '/login';
      return response.data;
    } catch (error) {
      console.error('Logout all sessions error:', error);
      clearTokens();
      localStorage.removeItem(USER_DATA_KEY);
      setUser(null);
      setPermissions([]);
      window.location.href = '/login';
      throw error;
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return permissionList.some(p => permissions.includes(p));
  };

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    logoutAllSessions,
    hasPermission,
    hasAnyPermission,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
    fetchCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
