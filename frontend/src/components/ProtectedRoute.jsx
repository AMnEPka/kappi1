import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Проверяем что user существует и имеет id
  const isAuthenticated = !!(user && user.id);

  console.log('🔍 ProtectedRoute user check:', {
    user,
    hasUser: !!user,
    hasUserId: !!(user && user.id),
    isAuthenticated
  });  

  if (loading) {
    console.log('🔄 ProtectedRoute: Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('🚫 ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  console.log('✅ ProtectedRoute: User authenticated, rendering children');
  return children;
}
