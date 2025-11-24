import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;

console.log('🚀 API URL configured:', API_URL); 

export const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor - add token to all requests
api.interceptors.request.use(
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
api.interceptors.response.use(
  (response) => response,
  (error) => {
   if (error.response?.status === 401) {
      console.log('Unauthorized request - token might be expired');
      // Не делаем редирект здесь - пусть компоненты обрабатывают это
    }
    return Promise.reject(error);
  }
);

export default api;