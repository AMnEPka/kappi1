// hooks/useApiLoader.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/config/api';

/**
 * Хук для загрузки множества API-ресурсов с AbortController
 * 
 * @param {Array<{key: string, url: string, enabled?: boolean}>} endpoints - массив эндпоинтов
 * @param {Array} deps - зависимости для перезагрузки
 * @returns {{data: Object, loading: boolean, error: Error|null, refetch: Function}}
 * 
 * @example
 * const { data, loading, error, refetch } = useApiLoader([
 *   { key: 'categories', url: '/api/categories' },
 *   { key: 'scripts', url: '/api/scripts', enabled: true },
 * ], []);
 * 
 * // data.categories, data.scripts
 */
export const useApiLoader = (endpoints, deps = []) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async () => {
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    setLoading(true);
    setError(null);
    
    try {
      const enabledEndpoints = endpoints.filter(ep => ep.enabled !== false);
      
      const results = await Promise.all(
        enabledEndpoints.map(({ url }) => 
          api.get(url, { signal }).catch(err => {
            // Игнорируем отменённые запросы
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
              return { data: null, canceled: true };
            }
            throw err;
          })
        )
      );
      
      // Проверяем, не был ли запрос отменён
      if (signal.aborted) return;
      
      const newData = {};
      enabledEndpoints.forEach(({ key }, index) => {
        if (!results[index].canceled) {
          newData[key] = results[index].data;
        }
      });
      
      setData(prev => ({ ...prev, ...newData }));
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setError(err);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [JSON.stringify(endpoints)]);

  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [...deps, fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

/**
 * Хук для одиночного API-запроса с AbortController
 */
export const useApiRequest = (url, options = {}) => {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(url, { 
        signal: abortControllerRef.current.signal 
      });
      setData(response.data);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, setData };
};

export default useApiLoader;

