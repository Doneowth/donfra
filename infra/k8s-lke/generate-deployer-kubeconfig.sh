#!/bin/bash
# Generate a namespace-scoped kubeconfig for donfra-eng
# Usage: ./generate-deployer-kubeconfig.sh > deployer-kubeconfig.yaml

set -e

NAMESPACE="donfra-eng"
SA_NAME="donfra-deployer"
SECRET_NAME="donfra-deployer-token"

# Get cluster info from current context
CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
CLUSTER_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CLUSTER_CA=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

# Get token from ServiceAccount secret
SA_TOKEN=$(kubectl get secret ${SECRET_NAME} -n ${NAMESPACE} -o jsonpath='{.data.token}' | base64 -d)

if [ -z "$SA_TOKEN" ]; then
    echo "Error: Could not get token. Make sure you've applied 99-deploy-rbac.yaml first:" >&2
    echo "  kubectl apply -f infra/k8s-lke/99-deploy-rbac.yaml" >&2
    exit 1
fi

# Generate kubeconfig
cat <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: ${CLUSTER_NAME}
    cluster:
      server: ${CLUSTER_SERVER}
      certificate-authority-data: ${CLUSTER_CA}
contexts:
  - name: donfra-deployer@${CLUSTER_NAME}
    context:
      cluster: ${CLUSTER_NAME}
      namespace: ${NAMESPACE}
      user: donfra-deployer
current-context: donfra-deployer@${CLUSTER_NAME}
users:
  - name: donfra-deployer
    user:
      token: ${SA_TOKEN}
EOF
