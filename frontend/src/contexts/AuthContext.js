import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { 
  setTokens, 
  clearTokens, 
  getAccessToken, 
  logoutApi 
} from '../config/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { access_token, refresh_token, user: userData } = response.data;
      
      // Store both tokens
      setTokens(access_token, refresh_token);
      
      // Fetch full user data with permissions
      await fetchCurrentUser();
      
      // Redirect to home page
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

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      
      // Set user and permissions
      if (response.data.user) {
        setUser(response.data.user);
      } else {
        setUser(response.data);
      }

      setPermissions(response.data.permissions || []);
      
    } catch (error) {
      console.error('❌ Failed to fetch current user:', error);
      // Don't logout here - the api interceptor handles 401
      if (error.response?.status !== 401) {
        clearTokens();
        setUser(null);
        setPermissions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout API to invalidate refresh token
      await logoutApi();
    } catch (error) {
      console.warn('Logout API error:', error);
    }
    
    setUser(null);
    setPermissions([]);
    window.location.href = '/login';
  };

  const logoutAllSessions = async () => {
    try {
      const response = await api.post('/api/auth/logout-all');
      clearTokens();
      setUser(null);
      setPermissions([]);
      window.location.href = '/login';
      return response.data;
    } catch (error) {
      console.error('Logout all sessions error:', error);
      clearTokens();
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
