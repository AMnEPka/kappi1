#!/bin/bash
set -e

echo "===================================="
echo "Loading Docker Images from Archive"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Navigate to project root
cd "$(dirname "$0")/.."

IMAGES_DIR="./docker-images"

if [ ! -d "$IMAGES_DIR" ]; then
    echo -e "${RED}Error: Images directory not found: $IMAGES_DIR${NC}"
    echo "Please ensure docker-images folder is in the project root"
    exit 1
fi

echo -e "${YELLOW}Loading images from: $IMAGES_DIR${NC}"
echo ""

# Load backend image
if [ -f "$IMAGES_DIR/backend.tar.gz" ]; then
    echo -e "${YELLOW}Loading backend image...${NC}"
    gunzip -c "$IMAGES_DIR/backend.tar.gz" | docker load
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend image loaded${NC}"
    else
        echo -e "${RED}✗ Failed to load backend image${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ backend.tar.gz not found${NC}"
    exit 1
fi

# Load frontend image
if [ -f "$IMAGES_DIR/frontend.tar.gz" ]; then
    echo -e "${YELLOW}Loading frontend image...${NC}"
    gunzip -c "$IMAGES_DIR/frontend.tar.gz" | docker load
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend image loaded${NC}"
    else
        echo -e "${RED}✗ Failed to load frontend image${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ frontend.tar.gz not found${NC}"
    exit 1
fi

# Load MongoDB image
if [ -f "$IMAGES_DIR/mongodb.tar.gz" ]; then
    echo -e "${YELLOW}Loading MongoDB image...${NC}"
    gunzip -c "$IMAGES_DIR/mongodb.tar.gz" | docker load
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ MongoDB image loaded${NC}"
    else
        echo -e "${RED}✗ Failed to load MongoDB image${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ mongodb.tar.gz not found${NC}"
    exit 1
fi

# Load Nginx image
if [ -f "$IMAGES_DIR/nginx.tar.gz" ]; then
    echo -e "${YELLOW}Loading Nginx image...${NC}"
    gunzip -c "$IMAGES_DIR/nginx.tar.gz" | docker load
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Nginx image loaded${NC}"
    else
        echo -e "${RED}✗ Failed to load Nginx image${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ nginx.tar.gz not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}All images loaded successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"

echo ""
echo "Loaded images:"
docker images | grep -E "ssh-runner-backend|ssh-runner-frontend|mongo.*6.0|nginx.*alpine"

echo ""
echo -e "${YELLOW}Next step: Run the application${NC}"
echo "  docker compose -f docker-compose.offline.yml up -d"
