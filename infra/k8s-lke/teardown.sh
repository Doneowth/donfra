#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Tearing down Donfra from LKE ===${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Deleting all resources in donfra-eng namespace...${NC}"
kubectl delete -f "$SCRIPT_DIR/08-ui.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/07-ws.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/06-api.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/05-livekit.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/04-redis.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/03-postgres.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/02-postgres-init.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/02-configmaps.yaml" --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/01-secrets.yaml" --ignore-not-found

echo -e "${YELLOW}Delete namespace? This will remove all remaining resources.${NC}"
read -p "Delete namespace donfra-eng? (y/N): " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    kubectl delete -f "$SCRIPT_DIR/00-namespace.yaml" --ignore-not-found
    echo -e "${GREEN}Namespace deleted.${NC}"
else
    echo -e "${YELLOW}Namespace preserved.${NC}"
fi

echo -e "${GREEN}=== Teardown complete ===${NC}"
