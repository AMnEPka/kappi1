# Quick Start Guide

This guide will help you quickly deploy Kappi1 to your Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.0+
- kubectl configured
- Docker images built and available

## Step 1: Build and Push Images

```bash
# Set your registry
export REGISTRY="your-registry.com/your-org"

# Build backend
cd backend
docker build -f Dockerfile.prod -t $REGISTRY/kappi1-backend:latest .
docker push $REGISTRY/kappi1-backend:latest

# Build frontend
cd ../frontend
docker build -f Dockerfile.prod -t $REGISTRY/kappi1-frontend:latest .
docker push $REGISTRY/kappi1-frontend:latest
```

## Step 2: Generate Secrets

```bash
# Generate encryption key
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "JWT_SECRET=$JWT_SECRET"
```

## Step 3: Install with Helm

```bash
# From project root
cd helm/kappi1

# Install the chart
helm install kappi1 . \
  --set backend.image.repository=$REGISTRY/kappi1-backend \
  --set frontend.image.repository=$REGISTRY/kappi1-frontend \
  --set backend.env.ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --set backend.env.JWT_SECRET_KEY="$JWT_SECRET"
```

## Step 4: Wait for Deployment

```bash
# Watch pods come up
kubectl get pods -w

# Check services
kubectl get svc
```

## Step 5: Access the Application

### Option A: LoadBalancer (Default)

```bash
# Get the external IP
kubectl get svc kappi1-nginx

# Access via the external IP
# http://<EXTERNAL-IP>
```

### Option B: Port Forward

```bash
# Forward nginx service
kubectl port-forward svc/kappi1-nginx 8080:80

# Access at http://localhost:8080
```

### Option C: Ingress

If you have an Ingress controller:

```bash
# Install with Ingress enabled
helm install kappi1 . \
  --set backend.image.repository=$REGISTRY/kappi1-backend \
  --set frontend.image.repository=$REGISTRY/kappi1-frontend \
  --set backend.env.ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --set backend.env.JWT_SECRET_KEY="$JWT_SECRET" \
  --set nginx.enabled=false \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kappi1.example.com
```

## Troubleshooting

### Pods not starting?

```bash
# Check pod status
kubectl get pods

# View pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

### Backend can't connect to MongoDB?

```bash
# Check MongoDB is running
kubectl get pods -l app.kubernetes.io/component=mongodb

# Check MongoDB service
kubectl get svc kappi1-mongodb

# Test connection
kubectl exec -it <backend-pod> -- curl http://kappi1-mongodb:27017
```

### Images not found?

Make sure:
1. Images are pushed to the registry
2. Image pull secrets are configured if using private registry
3. Image names match in values.yaml

## Next Steps

- Review `values.yaml` for all configuration options
- Set up monitoring and logging
- Configure backups for MongoDB
- Set up SSL/TLS certificates
- Review security settings

For more details, see [README.md](README.md).

