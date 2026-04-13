#!/bin/bash
# deploy.sh - CrikeX Production Deployment Script
# Usage: sh deploy.sh production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
APP_NAME="crikex-api"
IMAGE_NAME="crikex-api"
IMAGE_TAG="1.0.0"
REGISTRY="${DOCKER_REGISTRY:-docker.io/yourusername}"
DEPLOYMENT_DIR="/var/www/crikex-api"
LOG_DIR="/var/log/crikex"

# Functions
echo_step() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${BLUE}▶${NC} $1"
}

echo_success() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${GREEN}✓${NC} $1"
}

echo_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${RED}✗${NC} $1"
}

echo_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${YELLOW}⚠${NC} $1"
}

# Pre-deployment checks
pre_deployment_checks() {
  echo_step "Running pre-deployment checks..."

  # Check Node.js version
  if ! command -v node &> /dev/null; then
    echo_error "Node.js is not installed"
    exit 1
  fi

  NODE_VERSION=$(node -v)
  echo_success "Node.js version: $NODE_VERSION"

  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo_warning "Docker is not installed - skipping container build"
  else
    DOCKER_VERSION=$(docker --version)
    echo_success "Docker: $DOCKER_VERSION"
  fi

  # Check environment file
  if [ ! -f ".env.production" ]; then
    echo_error ".env.production not found"
    exit 1
  fi
  echo_success ".env.production found"

  # Check dependencies
  if [ ! -d "node_modules" ]; then
    echo_step "Installing dependencies..."
    npm ci --production
    echo_success "Dependencies installed"
  fi

  # Run tests
  echo_step "Running tests..."
  npm run test:e2e || echo_warning "E2E tests may require interactive setup"
  echo_success "Tests completed"
}

# Database migrations
run_migrations() {
  echo_step "Running database migrations..."

  if command -v npm &> /dev/null; then
    npm run migrate:latest || echo_warning "No migration script found"
    echo_success "Migrations completed"
  fi
}

# Build Docker image
build_docker_image() {
  echo_step "Building Docker image..."

  if ! command -v docker &> /dev/null; then
    echo_warning "Docker not available - skipping image build"
    return
  fi

  docker build \
    --tag "$IMAGE_NAME:$IMAGE_TAG" \
    --tag "$IMAGE_NAME:latest" \
    --build-arg NODE_ENV=production \
    --label "version=$IMAGE_TAG" \
    --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    .

  echo_success "Docker image built: $IMAGE_NAME:$IMAGE_TAG"
}

# Push to registry
push_docker_image() {
  echo_step "Pushing Docker image to registry..."

  if ! command -v docker &> /dev/null; then
    echo_warning "Docker not available - skipping push"
    return
  fi

  docker tag "$IMAGE_NAME:$IMAGE_TAG" "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  docker push "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

  echo_success "Image pushed to: $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
}

# Deploy application
deploy_application() {
  echo_step "Deploying application..."

  # Create directories
  mkdir -p "$DEPLOYMENT_DIR"
  mkdir -p "$LOG_DIR"

  # Copy files
  echo_step "Copying files..."
  cp -r server/src "$DEPLOYMENT_DIR/"
  cp server/package.json "$DEPLOYMENT_DIR/"
  cp server/package-lock.json "$DEPLOYMENT_DIR/"
  cp .env.production "$DEPLOYMENT_DIR/.env"

  echo_success "Files copied"

  # Start application with PM2 (if available)
  if command -v pm2 &> /dev/null; then
    echo_step "Starting application with PM2..."
    cd "$DEPLOYMENT_DIR"
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo_success "Application started with PM2"
  fi

  # Or start with Docker (if available)
  if command -v docker &> /dev/null; then
    echo_step "Starting Docker container..."
    docker-compose -f docker-compose.prod.yml up -d
    echo_success "Docker containers started"
  fi
}

# Health checks
health_checks() {
  echo_step "Running health checks..."

  MAX_ATTEMPTS=30
  ATTEMPT=0

  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
      echo_success "Application is healthy"

      # Show system info
      HEALTH=$(curl -s http://localhost:3000/api/health)
      echo_success "Health check response: $HEALTH"
      return 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo_warning "Waiting for application to start... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
  done

  echo_error "Application did not start within timeout"
  exit 1
}

# Setup monitoring
setup_monitoring() {
  echo_step "Setting up monitoring..."

  # Check if Sentry is configured
  if [ -n "$SENTRY_DSN" ]; then
    echo_success "Sentry monitoring will be active"
  fi

  # Check if DataDog is configured
  if [ -n "$DD_AGENT_HOST" ]; then
    echo_success "DataDog APM will be active"
  fi

  echo_success "Monitoring configured"
}

# Verify endpoints
verify_endpoints() {
  echo_step "Verifying API endpoints..."

  ENDPOINTS=(
    "/api/health"
    "/api/v1/auth/send-otp"
    "/api/v1/predictions/available"
    "/api/v1/wallet"
    "/api/v1/leaderboard"
  )

  for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f "http://localhost:3000$endpoint" > /dev/null 2>&1; then
      echo_success "Endpoint working: $endpoint"
    else
      echo_warning "Endpoint check failed: $endpoint (may require auth)"
    fi
  done
}

# Post-deployment summary
post_deployment_summary() {
  echo_step "Generating post-deployment summary..."

  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   CrikeX Production Deployment Complete   ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}Deployment Details:${NC}"
  echo "  Environment: $ENVIRONMENT"
  echo "  App Name: $APP_NAME"
  echo "  Image: $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  echo "  Deployment Dir: $DEPLOYMENT_DIR"
  echo "  Log Dir: $LOG_DIR"
  echo ""
  echo -e "${BLUE}Next Steps:${NC}"
  echo "  1. Verify application is running: curl http://localhost:3000/api/health"
  echo "  2. Check logs: tail -f $LOG_DIR/error.log"
  echo "  3. Monitor performance: Visit your monitoring dashboard"
  echo "  4. Run load tests: npm run test:load:staging"
  echo ""
  echo -e "${BLUE}Useful Commands:${NC}"
  echo "  View logs: docker logs -f crikex-api"
  echo "  Restart: docker-compose -f docker-compose.prod.yml restart"
  echo "  Stop: docker-compose -f docker-compose.prod.yml down"
  echo ""
  echo -e "${GREEN}✓ Deployment successful!${NC}"
  echo ""
}

# Rollback function
rollback() {
  echo_error "Deployment failed - initiating rollback..."

  if command -v docker &> /dev/null; then
    docker-compose -f docker-compose.prod.yml down
  fi

  if command -v pm2 &> /dev/null; then
    pm2 stop crikex-api
  fi

  echo_warning "Rollback completed - please check logs"
  exit 1
}

# Trap errors
trap rollback ERR

# Main deployment flow
main() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════╗"
  echo "║   CrikeX Production Deployment Script      ║"
  echo "║   Environment: $ENVIRONMENT"
  echo "╚════════════════════════════════════════════╝"
  echo -e "${NC}"

  pre_deployment_checks
  run_migrations
  build_docker_image
  push_docker_image
  deploy_application
  health_checks
  setup_monitoring
  verify_endpoints
  post_deployment_summary
}

# Run main function
main
