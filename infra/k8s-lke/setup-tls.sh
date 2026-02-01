#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Setting up HTTPS/TLS with cert-manager + Cloudflare ===${NC}"

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl not found${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Install NGINX Ingress Controller
echo -e "${YELLOW}Step 1: Installing NGINX Ingress Controller...${NC}"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/cloud/deploy.yaml

echo -e "${YELLOW}Waiting for Ingress Controller to be ready...${NC}"
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s || echo "Timeout waiting for ingress controller, continuing..."

# Step 2: Install cert-manager
echo -e "${YELLOW}Step 2: Installing cert-manager...${NC}"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.yaml

echo -e "${YELLOW}Waiting for cert-manager to be ready...${NC}"
sleep 10
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=180s || echo "Timeout waiting for cert-manager, continuing..."

# Step 3: Apply Cloudflare secret
echo -e "${YELLOW}Step 3: Applying Cloudflare API token secret...${NC}"
if grep -q "YOUR_CLOUDFLARE_API_TOKEN_HERE" "$SCRIPT_DIR/09-cloudflare-secret.yaml"; then
    echo -e "${RED}ERROR: Please update 09-cloudflare-secret.yaml with your Cloudflare API token first!${NC}"
    echo -e "${YELLOW}Edit the file and replace YOUR_CLOUDFLARE_API_TOKEN_HERE with your actual token.${NC}"
    exit 1
fi
kubectl apply -f "$SCRIPT_DIR/09-cloudflare-secret.yaml"

# Step 4: Apply Ingress and Certificate
echo -e "${YELLOW}Step 4: Applying Ingress and Certificate...${NC}"
kubectl apply -f "$SCRIPT_DIR/09-ingress-tls.yaml"

# Step 5: Change UI service to ClusterIP (Ingress will handle external traffic)
echo -e "${YELLOW}Step 5: Changing UI service to ClusterIP...${NC}"
kubectl patch svc ui -n donfra-eng -p '{"spec": {"type": "ClusterIP"}}'

echo -e "${GREEN}=== TLS Setup Complete ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Get the Ingress LoadBalancer IP:"
echo -e "   ${GREEN}kubectl get svc -n ingress-nginx${NC}"
echo ""
echo "2. Update your Cloudflare DNS:"
echo "   Point donfra.dev A record to the Ingress LoadBalancer IP"
echo ""
echo "3. Check certificate status:"
echo -e "   ${GREEN}kubectl get certificate -n donfra-eng${NC}"
echo -e "   ${GREEN}kubectl describe certificate donfra-tls -n donfra-eng${NC}"
echo ""
echo "4. Check Ingress status:"
echo -e "   ${GREEN}kubectl get ingress -n donfra-eng${NC}"
