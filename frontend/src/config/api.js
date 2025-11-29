import axios from 'axios';

// Dynamically construct API URL based on current host
// This works from localhost and any host in local network
const { protocol, hostname } = window.location;
const API_URL = process.env.REACT_APP_BACKEND_URL || `${protocol}//${hostname}:8001`;

console.log('🚀 API URL configured:', API_URL); 

export const api = axios.create({
  baseURL: API_URL,
});

// Переменная для отслеживания редиректа
let isRedirecting = false;

// Request interceptor - add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔐 Interceptor adding token:', token ? 'present' : 'missing');
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
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      console.log('Unauthorized request - token expired, redirecting to login...');
      
      // Защита от множественных редиректов
      isRedirecting = true;
      
      // Очищаем данные авторизации
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Останавливаем все последующие запросы
      if (error.config?.url?.includes('/auth/')) {
        return Promise.reject(error);
      }
      
      // Редирект на страницу логина с информацией о причине
      setTimeout(() => {
        const currentPath = window.location.pathname + window.location.search;
        const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}&reason=session_expired`;
        window.location.href = loginUrl;
      }, 100);
      
      return Promise.reject(new Error('Session expired'));
    }
    return Promise.reject(error);
  }
);

export default api;