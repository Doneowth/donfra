#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploying Donfra to LKE ===${NC}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Cannot connect to Kubernetes cluster. Please check your kubeconfig.${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Step 1: Creating namespace...${NC}"
kubectl apply -f "$SCRIPT_DIR/00-namespace.yaml"

echo -e "${YELLOW}Step 2: Creating secrets...${NC}"
kubectl apply -f "$SCRIPT_DIR/01-secrets.yaml"

echo -e "${YELLOW}Step 3: Creating configmaps...${NC}"
kubectl apply -f "$SCRIPT_DIR/02-configmaps.yaml"
kubectl apply -f "$SCRIPT_DIR/02-postgres-init.yaml"

echo -e "${YELLOW}Step 4: Deploying PostgreSQL...${NC}"
kubectl apply -f "$SCRIPT_DIR/03-postgres.yaml"

echo -e "${YELLOW}Step 5: Deploying Redis...${NC}"
kubectl apply -f "$SCRIPT_DIR/04-redis.yaml"

echo -e "${YELLOW}Step 6: Deploying LiveKit...${NC}"
kubectl apply -f "$SCRIPT_DIR/05-livekit.yaml"

echo -e "${YELLOW}Waiting for database to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n donfra-eng --timeout=120s || true

echo -e "${YELLOW}Step 7: Deploying API...${NC}"
kubectl apply -f "$SCRIPT_DIR/06-api.yaml"

echo -e "${YELLOW}Step 8: Deploying WebSocket server...${NC}"
kubectl apply -f "$SCRIPT_DIR/07-ws.yaml"

echo -e "${YELLOW}Step 9: Deploying UI with LoadBalancer...${NC}"
# kubectl apply -f "$SCRIPT_DIR/08-ui.yaml"
echo -e "SKIP UI"

echo -e "${GREEN}=== Deployment complete! ===${NC}"
echo ""
echo -e "${YELLOW}Checking pod status...${NC}"
kubectl get pods -n donfra-eng

echo ""
echo -e "${YELLOW}Checking services...${NC}"
kubectl get svc -n donfra-eng

echo ""
echo -e "${YELLOW}Waiting for LoadBalancer IP...${NC}"
echo "Run this command to get the external IP when ready:"
echo -e "${GREEN}kubectl get svc ui -n donfra-eng -w${NC}"
echo ""
echo "Once you have the external IP, update the following in 02-configmaps.yaml:"
echo "  - BASE_URL"
echo "  - FRONTEND_URL"
echo "  - GOOGLE_REDIRECT_URL"
echo "  - LIVEKIT_PUBLIC_URL"
echo ""
echo "Then re-apply: kubectl apply -f 02-configmaps.yaml && kubectl rollout restart deployment -n donfra-eng"
