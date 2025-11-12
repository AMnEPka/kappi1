import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Setup axios interceptors
  useEffect(() => {
    // Request interceptor - add token to all requests
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle 401 errors (auto logout)
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - logout
          localStorage.removeItem('token');
          setUser(null);
          setPermissions([]);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Fetch current user
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
      setUser(response.data.user);
      setPermissions(response.data.permissions || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      // Token is invalid, clear it
      logout();
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password
      });

      const { access_token, user: userData } = response.data;
      
      // Save token (interceptor will automatically add it to requests)
      localStorage.setItem('token', access_token);
      
      // Set user data
      setUser(userData);
      
      // Fetch permissions
      await fetchCurrentUser();
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Ошибка входа' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions([]);
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
    hasPermission,
    hasAnyPermission,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
