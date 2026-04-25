# Infrastructure

GKE-based stack for `buena-EBITDuuh`. Manages a GKE cluster with MinIO (blob storage) and MongoDB, both running as Kubernetes deployments with credentials stored as K8s secrets and data persisted on GCP Persistent Disks. GitHub Actions uses a K8s ServiceAccount token to sync `raw-data/` into MinIO.

## What was built

| Resource | Details |
|---|---|
| GKE cluster | `buena-cluster` · `europe-west3` · 1× `e2-standard-2` node |
| Namespace | `buena` |
| MinIO | Deployment + LoadBalancer service · API `:9000` · Console `:9001` · 10Gi PVC |
| MongoDB | Deployment + LoadBalancer service · `:27017` · 10Gi PVC |
| K8s secrets | `minio-credentials`, `mongo-credentials` |
| K8s SA | `github-actions` · RBAC for pod exec / port-forward / secret read |
| GitHub Action | `.github/workflows/sync-raw-data.yml` · triggers on `raw-data/**` push |

## Terraform

```sh
cd infra
terraform init
terraform plan
terraform apply
```

## Connect to the cluster locally

```sh
gcloud container clusters get-credentials buena-cluster \
  --region europe-west3 \
  --project bigberlin-hack26ber-3239
```

## MinIO

### Retrieve credentials from the K8s secret

```sh
kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-user}' | base64 -d && echo

kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-password}' | base64 -d && echo
```

### Access the console (browser GUI)

The service is a `LoadBalancer` — get the external IP and open it in a browser:

```sh
kubectl get svc minio -n buena
# Open http://<EXTERNAL-IP>:9001 in your browser
# Login with the credentials retrieved above
```

Or port-forward locally:

```sh
kubectl port-forward svc/minio 9000:9000 9001:9001 -n buena
# API:     http://localhost:9000
# Console: http://localhost:9001
```

### Use the MinIO CLI (`mc`)

```sh
# Install: brew install minio/stable/mc
MINIO_IP=$(kubectl get svc minio -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MINIO_USER=$(kubectl get secret minio-credentials -n buena -o jsonpath='{.data.root-user}' | base64 -d)
MINIO_PASS=$(kubectl get secret minio-credentials -n buena -o jsonpath='{.data.root-password}' | base64 -d)

mc alias set buena http://$MINIO_IP:9000 $MINIO_USER $MINIO_PASS
mc ls buena
```

### Persistence

MinIO data is stored on a 10Gi GCP Persistent Disk via PVC `minio-data`. Data survives pod restarts and crashes.

## MongoDB

### Retrieve credentials from the K8s secret

```sh
# Username
kubectl get secret mongo-credentials -n buena \
  -o jsonpath='{.data.username}' | base64 -d && echo

# Password
kubectl get secret mongo-credentials -n buena \
  -o jsonpath='{.data.password}' | base64 -d && echo

# Full connection URI (for use inside the cluster)
kubectl get secret mongo-credentials -n buena \
  -o jsonpath='{.data.uri}' | base64 -d && echo
```

### Connect with MongoDB Compass (GUI)

Get the external IP and connect:

```sh
kubectl get svc mongo -n buena
# Use: mongodb://buena-admin:<password>@<EXTERNAL-IP>:27017/?authSource=admin
```

Or dynamically:

```sh
MONGO_IP=$(kubectl get svc mongo -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MONGO_PASS=$(kubectl get secret mongo-credentials -n buena -o jsonpath='{.data.password}' | base64 -d)
echo "mongodb://buena-admin:$MONGO_PASS@$MONGO_IP:27017/?authSource=admin"
```

### Connect with `mongosh`

```sh
MONGO_IP=$(kubectl get svc mongo -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MONGO_PASS=$(kubectl get secret mongo-credentials -n buena -o jsonpath='{.data.password}' | base64 -d)
mongosh "mongodb://buena-admin:$MONGO_PASS@$MONGO_IP:27017/buena?authSource=admin"
```

Or port-forward locally:

```sh
kubectl port-forward svc/mongo 27017:27017 -n buena
mongosh "mongodb://buena-admin:<password>@localhost:27017/buena?authSource=admin"
```

### Connect from inside the cluster

```sh
kubectl run mongo-shell --rm -it --image=mongo:7.0 -n buena -- \
  mongosh "$(kubectl get secret mongo-credentials -n buena \
    -o jsonpath='{.data.uri}' | base64 -d)"
```

### Persistence

MongoDB data is stored on a 10Gi GCP Persistent Disk via PVC `mongo-data`. Data survives pod restarts and crashes.

## GitHub Actions — raw-data sync

The workflow `.github/workflows/sync-raw-data.yml` triggers on any push to `main` that touches `raw-data/**`. It:

1. Authenticates to the GKE cluster using a long-lived K8s SA token
2. Reads MinIO credentials from the `minio-credentials` K8s secret
3. Port-forwards MinIO and mirrors `raw-data/` into the `raw-data` bucket

### Retrieve the GitHub Actions SA token and CA cert

These need to be stored as GitHub repository secrets:

```sh
# K8s SA token (set as GKE_SA_TOKEN in GitHub)
kubectl get secret github-actions-token -n buena \
  -o jsonpath='{.data.token}' | base64 -d && echo

# Cluster CA certificate (set as GKE_CA_CERT in GitHub)
kubectl get secret github-actions-token -n buena \
  -o jsonpath='{.data.ca\.crt}' | base64 -d | base64

# Cluster API server endpoint (set as GKE_SERVER in GitHub)
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' && echo
```

### Required repository secrets

| Secret | Value |
|---|---|
| `GKE_SA_TOKEN` | Output of the token command above |
| `GKE_CA_CERT` | Output of the CA cert command above |
| `GKE_SERVER` | GKE API server endpoint (e.g. `https://34.179.176.221`) |

## Status

| Component | Status |
|---|---|
| GKE cluster | Running |
| Node pool | Running |
| MinIO pod | Running · persistent volume attached |
| MongoDB pod | Running · persistent volume attached |
| GitHub Actions SA | Configured · RBAC for port-forward + secret read |
| GitHub Actions workflow | Created — needs GKE_SA_TOKEN / GKE_CA_CERT / GKE_SERVER secrets configured |
