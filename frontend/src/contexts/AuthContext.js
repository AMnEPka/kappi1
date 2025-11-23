import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../config/api';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  //console.log('🔍 useAuth context:', context); 
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const logout = () => {
    console.log('🔍 Logging out...');
    localStorage.removeItem('token');
    setUser(null);
    setPermissions([]);
    // Редирект на логин
    window.location.href = '/login';
  };

const getBackendUrl = () => {
  // Для продакшена или если задана переменная окружения
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Для разработки - используем тот же хост, где работает фронтенд
  const currentHost = window.location.hostname;
  const currentPort = window.location.port;
  
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:8001';
  } else {
    // Для доступа с других устройств в сети
    return `http://${currentHost}:8001`;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);  

  console.log('🔍 AuthProvider mounted - initial user:', user);
  console.log('🔍 Token in localStorage:', localStorage.getItem('token'));



  // УБРАЛИ весь useEffect с интерцепторами - они теперь в api.js

  // Check if user is logged in on mount
  useEffect(() => {
    console.log('🔍 AuthProvider useEffect - checking token');
    const token = localStorage.getItem('token');
    console.log('🔍 Token found:', !!token);
    
    if (token) {
      console.log('🔍 Fetching user immediately...');
      fetchCurrentUser();
    } else {
      console.log('🔍 No token, setting loading false');
      setLoading(false);
    }
  }, []);

	const login = async (username, password) => {
		try {
			console.log('🔍 Login started with API URL:', api.defaults.baseURL);

			const response = await api.post('/api/auth/login', {
				username,
				password
			});

			console.log('✅ Login successful:', response.data);
			
			const { access_token, user: userData } = response.data;
			
			localStorage.setItem('token', access_token);
			//setUser(userData);

      console.log('🔍 Before fetchCurrentUser...');
      await fetchCurrentUser();
      console.log('🔍 After fetchCurrentUser - this should show!');
			
			console.log('🔍 Redirecting to home page...');
			try {
        window.location.href = '/';
      } catch (error) {
        console.error('❌ Redirect failed:', error);
        // Fallback редирект
        window.location.replace('/');
      }
			
			return { success: true };
		} catch (error) {
			console.error('❌ Login failed:', error);
			console.error('❌ Error details:', {
				message: error.message,
				code: error.code,
				url: error.config?.url
			});
			return { 
				success: false, 
				error: error.response?.data?.detail || 'Ошибка входа' 
			};
		}
	};

 // Редирект после обновления состояния
  useEffect(() => {
    if (shouldRedirect && user) {
      console.log('🔍 Performing redirect...');
      window.location.href = '/';
      setShouldRedirect(false);
    }
  }, [shouldRedirect, user]);  

	const fetchCurrentUser = async () => {
  try {
    console.log('🔍 Fetching current user...');
    const response = await api.get('/api/auth/me');
    console.log('✅ Current user fetch response DATA STRUCTURE:', {
      fullResponse: response.data,
      userObject: response.data.user,
      permissionsArray: response.data.permissions,
      hasUser: !!response.data.user,
      hasPermissions: !!response.data.permissions
    });
    
    // ✅ ПРАВИЛЬНО: устанавливаем user и permissions отдельно
    // Устанавливаем правильные данные
    if (response.data.user) {
      setUser(response.data.user);
    } else {
      setUser(response.data); // fallback если структура другая
    }

    setPermissions(response.data.permissions || []);
    
  } catch (error) {
    console.error('❌ Failed to fetch current user:', error);
    if (error.response?.status === 401) {
      logout(); 
    } else {
      localStorage.removeItem('token');
      setUser(null);
      setPermissions([]); // ← тоже сбрасываем permissions
    }
  } finally {
    setLoading(false);
    console.log('🔍 Loading set to false');
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
	
	const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions([]);
    window.location.href = '/login';
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

  console.log('🔍 AuthContext value functions:', {
  hasPermission: typeof hasPermission,
  hasAnyPermission: typeof hasAnyPermission
});

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading, 
      permissions,
      hasPermission,
      hasAnyPermission,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin || false,
      fetchCurrentUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};