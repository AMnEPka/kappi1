import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label } from '@/components/ui/md3';
import { toast } from 'sonner';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Заполните все поля');
      return;
    }

    setLoading(true);
    
    const result = await login(username, password);
    
    setLoading(false);

    if (result.success) {
      toast.success('Вход выполнен успешно');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="md3-login-page">
      <Card className="md3-login-card" elevation={3}>
        <CardHeader className="md3-login-header">
          <div className="md3-login-logo">
            <img
              src="/logo.svg" 
              alt="OSIB Logo"
              className="md3-login-logo-img"
            />
          </div>
          <CardTitle className="md3-login-title">Инструмент автоматизации ОСИБ</CardTitle>
          <CardDescription className="md3-login-description">Вход в систему</CardDescription>
        </CardHeader>
        <CardContent className="md3-login-content">
          <form onSubmit={handleSubmit} className="md3-login-form">
            <div className="md3-login-field">
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите логин"
                disabled={loading}
                allowAutoComplete={true}
              />
            </div>

            <div className="md3-login-field">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                disabled={loading}
                allowAutoComplete={true}
              />
            </div>
            
            <Button 
              type="submit" 
              variant="filled"
              size="lg"
              className="md3-login-button" 
              disabled={loading}
            >
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          <div className="md3-login-hint">
            <p>По умолчанию:</p>
            <p className="md3-login-hint-credentials">admin / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
