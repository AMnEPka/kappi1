#!/bin/bash
set -e

echo "===================================="
echo "Saving Docker Images for Offline Transfer"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Navigate to project root
cd "$(dirname "$0")/.."

# Create export directory
EXPORT_DIR="./docker-images"
mkdir -p "$EXPORT_DIR"

echo -e "${YELLOW}Saving images to: $EXPORT_DIR${NC}"
echo ""

# Save backend image
echo -e "${YELLOW}Saving backend image...${NC}"
docker save ssh-runner-backend:latest | gzip > "$EXPORT_DIR/backend.tar.gz"
if [ $? -eq 0 ]; then
    SIZE=$(du -h "$EXPORT_DIR/backend.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Backend image saved (Size: $SIZE)${NC}"
else
    echo -e "${RED}✗ Failed to save backend image${NC}"
    exit 1
fi

# Save frontend image
echo -e "${YELLOW}Saving frontend image...${NC}"
docker save ssh-runner-frontend:latest | gzip > "$EXPORT_DIR/frontend.tar.gz"
if [ $? -eq 0 ]; then
    SIZE=$(du -h "$EXPORT_DIR/frontend.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Frontend image saved (Size: $SIZE)${NC}"
else
    echo -e "${RED}✗ Failed to save frontend image${NC}"
    exit 1
fi

# Save MongoDB image
echo -e "${YELLOW}Saving MongoDB image...${NC}"
docker save mongo:6.0 | gzip > "$EXPORT_DIR/mongodb.tar.gz"
if [ $? -eq 0 ]; then
    SIZE=$(du -h "$EXPORT_DIR/mongodb.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ MongoDB image saved (Size: $SIZE)${NC}"
else
    echo -e "${RED}✗ Failed to save MongoDB image${NC}"
    exit 1
fi

# Save Nginx image
echo -e "${YELLOW}Saving Nginx image...${NC}"
docker save nginx:alpine | gzip > "$EXPORT_DIR/nginx.tar.gz"
if [ $? -eq 0 ]; then
    SIZE=$(du -h "$EXPORT_DIR/nginx.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Nginx image saved (Size: $SIZE)${NC}"
else
    echo -e "${RED}✗ Failed to save Nginx image${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}All images saved successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"

echo ""
echo "Saved files:"
ls -lh "$EXPORT_DIR"

echo ""
TOTAL_SIZE=$(du -sh "$EXPORT_DIR" | cut -f1)
echo -e "${YELLOW}Total size: $TOTAL_SIZE${NC}"

echo ""
echo -e "${YELLOW}Transfer these files to your offline host:${NC}"
echo "  - $EXPORT_DIR/*.tar.gz"
echo ""
echo -e "${YELLOW}On the offline host, run: ./scripts/load-images.sh${NC}"
