// MSW request handlers for API mocking
import { http, HttpResponse } from 'msw';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const handlers = [
  // Auth endpoints
  http.post(`${BASE_URL}/api/auth/login`, async ({ request }) => {
    const body = await request.json();
    const { username, password } = body;
    
    if (username === 'admin' && password === 'admin123') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token-' + Date.now(),
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        }
      }, { status: 200 });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),
  
  http.get(`${BASE_URL}/api/auth/me`, () => {
    return HttpResponse.json({
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: ['admin']
    }, { status: 200 });
  }),
  
  // Hosts endpoints
  http.get(`${BASE_URL}/api/hosts`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'prod-server-01',
        hostname: '192.168.1.100',
        port: 22,
        connection_type: 'ssh',
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'windows-prod-01',
        hostname: '192.168.1.50',
        port: 5985,
        connection_type: 'winrm',
        created_at: new Date().toISOString()
      }
    ], { status: 200 });
  }),
  
  http.post(`${BASE_URL}/api/hosts`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: '3',
      name: body.name,
      hostname: body.hostname,
      port: body.port,
      connection_type: body.connection_type,
      created_at: new Date().toISOString()
    }, { status: 201 });
  }),
  
  // Projects endpoints
  http.get(`${BASE_URL}/api/projects`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Security Audit 2024',
        description: 'Monthly security audit',
        hosts: ['1', '2'],
        created_at: new Date().toISOString(),
        created_by: 'admin'
      }
    ], { status: 200 });
  }),
];

