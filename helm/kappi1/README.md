# Kappi1 Helm Chart

This Helm chart deploys the Kappi1 application (SSH Script Runner) to a Kubernetes cluster. The application consists of:

- **MongoDB**: Database for storing application data
- **Backend**: FastAPI application serving the REST API
- **Frontend**: React application served via Nginx
- **Nginx**: Reverse proxy handling routing between frontend and backend

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- kubectl configured to access your cluster
- Docker images built and pushed to a container registry (or available locally)

## Installation

### 1. Build and Push Docker Images

First, build and push your Docker images to a container registry:

```bash
# Build backend image
cd backend
docker build -f Dockerfile.prod -t <registry>/kappi1-backend:latest .
docker push <registry>/kappi1-backend:latest

# Build frontend image
cd frontend
docker build -f Dockerfile.prod -t <registry>/kappi1-frontend:latest .
docker push <registry>/kappi1-frontend:latest
```

### 2. Create Secrets

Generate encryption keys and create secrets:

```bash
# Generate encryption key
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate JWT secret (use a strong random string)
openssl rand -base64 32
```

### 3. Install the Chart

#### Option A: Using values.yaml with overrides

```bash
# Create a custom values file
cat > my-values.yaml <<EOF
backend:
  image:
    repository: <registry>/kappi1-backend
    tag: latest
  env:
    ENCRYPTION_KEY: "your-encryption-key-here"
    JWT_SECRET_KEY: "your-jwt-secret-here"

frontend:
  image:
    repository: <registry>/kappi1-frontend
    tag: latest

nginx:
  service:
    type: LoadBalancer
    # Or use ClusterIP if you have an Ingress controller
    # type: ClusterIP
EOF

# Install the chart
helm install kappi1 ./helm/kappi1 -f my-values.yaml
```

#### Option B: Using --set flags

```bash
helm install kappi1 ./helm/kappi1 \
  --set backend.image.repository=<registry>/kappi1-backend \
  --set backend.image.tag=latest \
  --set backend.env.ENCRYPTION_KEY="your-encryption-key" \
  --set backend.env.JWT_SECRET_KEY="your-jwt-secret" \
  --set frontend.image.repository=<registry>/kappi1-frontend \
  --set frontend.image.tag=latest
```

#### Option C: Using Secrets (Recommended for Production)

```bash
# Create secrets manually
kubectl create secret generic kappi1-secrets \
  --from-literal=encryption-key="your-encryption-key" \
  --from-literal=jwt-secret-key="your-jwt-secret"

# Install with secrets reference
helm install kappi1 ./helm/kappi1 \
  --set backend.image.repository=<registry>/kappi1-backend \
  --set frontend.image.repository=<registry>/kappi1-frontend \
  --set secrets.encryptionKey="your-encryption-key" \
  --set secrets.jwtSecretKey="your-jwt-secret"
```

## Configuration

### Key Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mongodb.enabled` | Enable MongoDB deployment | `true` |
| `mongodb.persistence.enabled` | Enable persistent storage for MongoDB | `true` |
| `mongodb.persistence.size` | MongoDB storage size | `10Gi` |
| `backend.enabled` | Enable backend deployment | `true` |
| `backend.replicaCount` | Number of backend replicas | `2` |
| `backend.image.repository` | Backend image repository | `kappi1-backend` |
| `backend.env.ENCRYPTION_KEY` | Encryption key for passwords | `""` (required) |
| `backend.env.JWT_SECRET_KEY` | JWT secret key | `""` (required) |
| `frontend.enabled` | Enable frontend deployment | `true` |
| `frontend.replicaCount` | Number of frontend replicas | `2` |
| `frontend.image.repository` | Frontend image repository | `kappi1-frontend` |
| `nginx.enabled` | Enable Nginx deployment | `true` |
| `nginx.service.type` | Nginx service type | `LoadBalancer` |
| `ingress.enabled` | Enable Ingress (alternative to LoadBalancer) | `false` |

### Using External MongoDB

If you want to use an external MongoDB instance:

```yaml
mongodb:
  enabled: false

backend:
  env:
    MONGO_URL: "mongodb://external-mongodb-host:27017"
```

### Using Ingress Instead of LoadBalancer

```yaml
nginx:
  enabled: false
  service:
    type: ClusterIP

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: kappi1.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kappi1-tls
      hosts:
        - kappi1.example.com
```

## Upgrading

```bash
# Update values and upgrade
helm upgrade kappi1 ./helm/kappi1 -f my-values.yaml

# Or with --set
helm upgrade kappi1 ./helm/kappi1 \
  --set backend.image.tag=v1.1.0 \
  --set frontend.image.tag=v1.1.0
```

## Uninstallation

```bash
helm uninstall kappi1
```

**Note:** This will remove all resources including persistent volumes. To keep data, delete the StatefulSet manually and keep the PVCs.

## Accessing the Application

After installation, get the service URL:

```bash
# If using LoadBalancer
kubectl get svc kappi1-nginx

# If using Ingress
kubectl get ingress kappi1
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=kappi1
```

### View Logs

```bash
# Backend logs
kubectl logs -l app.kubernetes.io/component=backend

# Frontend logs
kubectl logs -l app.kubernetes.io/component=frontend

# Nginx logs
kubectl logs -l app.kubernetes.io/component=nginx
```

### Check Services

```bash
kubectl get svc -l app.kubernetes.io/name=kappi1
```

### Debug Backend Connection

```bash
# Port forward to backend
kubectl port-forward svc/kappi1-backend 8001:8001

# Test API
curl http://localhost:8001/api/hosts
```

## Production Considerations

1. **Secrets Management**: Use a secrets management system (e.g., Sealed Secrets, External Secrets Operator, Vault)
2. **Resource Limits**: Adjust resource requests/limits based on your workload
3. **High Availability**: Ensure multiple replicas and proper pod disruption budgets
4. **Monitoring**: Add Prometheus metrics and Grafana dashboards
5. **Logging**: Configure centralized logging (e.g., ELK, Loki)
6. **Backup**: Set up regular MongoDB backups
7. **SSL/TLS**: Configure TLS certificates for production
8. **Network Policies**: Enable network policies for better security

## Values File Example

See `values.yaml` for all available configuration options. A production-ready example:

```yaml
backend:
  replicaCount: 3
  image:
    repository: registry.example.com/kappi1-backend
    tag: v1.0.0
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  env:
    ENCRYPTION_KEY: "..." # From secret
    JWT_SECRET_KEY: "..." # From secret

frontend:
  replicaCount: 2
  image:
    repository: registry.example.com/kappi1-frontend
    tag: v1.0.0

mongodb:
  persistence:
    storageClass: "fast-ssd"
    size: 50Gi

nginx:
  service:
    type: ClusterIP

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: kappi1.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kappi1-tls
      hosts:
        - kappi1.example.com
```

## Support

For issues and questions, please refer to the main project repository.

