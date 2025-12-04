#!/bin/bash
set -e

echo "===================================="
echo "Building Docker Images for Offline Deployment"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/.."

echo -e "${YELLOW}Step 1: Building Backend Image...${NC}"
docker build -t ssh-runner-backend:latest -f backend/Dockerfile.prod backend/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend image built successfully${NC}"
else
    echo -e "${RED}✗ Backend image build failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Building Frontend Image...${NC}"
docker build -t ssh-runner-frontend:latest -f frontend/Dockerfile.prod frontend/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend image built successfully${NC}"
else
    echo -e "${RED}✗ Frontend image build failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Pulling MongoDB Image...${NC}"
docker pull mongo:6.0
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MongoDB image pulled successfully${NC}"
else
    echo -e "${RED}✗ MongoDB image pull failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4: Pulling Nginx Image...${NC}"
docker pull nginx:alpine
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx image pulled successfully${NC}"
else
    echo -e "${RED}✗ Nginx image pull failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}All images built successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"

echo ""
echo "Built images:"
docker images | grep -E "ssh-runner-backend|ssh-runner-frontend|mongo.*6.0|nginx.*alpine"

echo ""
echo -e "${YELLOW}Next step: Run ./scripts/save-images.sh to export images${NC}"
