#!/bin/bash

# PoolVisual Production Deployment Script
# This script handles the complete deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="poolvisual"
DOCKER_REGISTRY="your-registry.com"
VERSION=${1:-latest}
ENVIRONMENT=${2:-production}

echo -e "${GREEN}🚀 Starting PoolVisual deployment...${NC}"
echo -e "Version: ${VERSION}"
echo -e "Environment: ${ENVIRONMENT}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${YELLOW}📋 Checking dependencies...${NC}"
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

# Check environment variables
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"
required_vars=(
    "DATABASE_URL"
    "JWT_SECRET"
    "SESSION_SECRET"
    "RESEND_API_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Environment variable $var is not set${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All environment variables are set${NC}"

# Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION} .
docker build -t ${DOCKER_REGISTRY}/${APP_NAME}:latest .

echo -e "${GREEN}✅ Docker image built successfully${NC}"

# Push to registry (if not local)
if [ "$DOCKER_REGISTRY" != "localhost" ]; then
    echo -e "${YELLOW}📤 Pushing image to registry...${NC}"
    docker push ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}
    docker push ${DOCKER_REGISTRY}/${APP_NAME}:latest
    echo -e "${GREEN}✅ Image pushed successfully${NC}"
fi

# Run database migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
docker run --rm \
    --env-file .env.${ENVIRONMENT} \
    ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION} \
    npm run db:push

echo -e "${GREEN}✅ Database migrations completed${NC}"

# Deploy with Docker Compose
echo -e "${YELLOW}🚀 Deploying application...${NC}"
docker-compose -f docker-compose.${ENVIRONMENT}.yml down
docker-compose -f docker-compose.${ENVIRONMENT}.yml up -d

echo -e "${GREEN}✅ Application deployed successfully${NC}"

# Health check
echo -e "${YELLOW}🏥 Performing health check...${NC}"
sleep 30

for i in {1..10}; do
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Waiting for application to start... (attempt $i/10)${NC}"
        sleep 10
    fi
done

if [ $i -eq 10 ]; then
    echo -e "${RED}❌ Health check failed after 10 attempts${NC}"
    echo -e "${YELLOW}📋 Checking logs...${NC}"
    docker-compose -f docker-compose.${ENVIRONMENT}.yml logs --tail=50
    exit 1
fi

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "Application is available at: https://yourdomain.com"
echo -e "Health check: https://yourdomain.com/health"
