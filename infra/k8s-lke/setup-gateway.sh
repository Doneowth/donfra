#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Setting up Gateway API + Envoy Gateway + cert-manager ===${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl not found${NC}"
    exit 1
fi

# Check helm
if ! command -v helm &> /dev/null; then
    echo -e "${RED}helm not found. Please install helm first:${NC}"
    echo "curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    exit 1
fi

# Step 1: Install Gateway API CRDs
echo -e "${YELLOW}Step 1: Installing Gateway API CRDs...${NC}"
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml

# Step 2: Install Envoy Gateway
echo -e "${YELLOW}Step 2: Installing Envoy Gateway...${NC}"
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.2.4 \
  -n envoy-gateway-system \
  --create-namespace \
  --wait

# Step 3: Install cert-manager
echo -e "${YELLOW}Step 3: Installing cert-manager...${NC}"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.yaml

echo -e "${YELLOW}Waiting for cert-manager...${NC}"
sleep 15
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=180s || true

# Step 4: Apply Cloudflare secret
echo -e "${YELLOW}Step 4: Applying Cloudflare API token...${NC}"
if grep -q "YOUR_CLOUDFLARE_API_TOKEN_HERE" "$SCRIPT_DIR/09-cloudflare-secret.yaml"; then
    echo -e "${RED}ERROR: Update 09-cloudflare-secret.yaml with your Cloudflare API token first!${NC}"
    exit 1
fi
kubectl apply -f "$SCRIPT_DIR/09-cloudflare-secret.yaml"

# Step 5: Apply Gateway API resources
echo -e "${YELLOW}Step 5: Applying Gateway API configuration...${NC}"
kubectl apply -f "$SCRIPT_DIR/10-gateway-api.yaml"

# Step 6: Change UI service to ClusterIP
echo -e "${YELLOW}Step 6: Changing UI service to ClusterIP...${NC}"
kubectl patch svc ui -n donfra-eng -p '{"spec": {"type": "ClusterIP"}}' 2>/dev/null || true

echo -e "${GREEN}=== Gateway API Setup Complete ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Get the Gateway LoadBalancer IP:"
echo -e "   ${GREEN}kubectl get gateway donfra-gateway -n donfra-eng${NC}"
echo ""
echo "2. Check Gateway status:"
echo -e "   ${GREEN}kubectl describe gateway donfra-gateway -n donfra-eng${NC}"
echo ""
echo "3. Check Certificate status:"
echo -e "   ${GREEN}kubectl get certificate -n donfra-eng${NC}"
echo ""
echo "4. Update Cloudflare DNS:"
echo "   Point donfra.dev A record to the Gateway IP"
echo ""
echo "5. Verify routes:"
echo -e "   ${GREEN}kubectl get httproute -n donfra-eng${NC}"
