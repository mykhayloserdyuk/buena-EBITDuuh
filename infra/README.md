# Infrastructure

GKE-based stack for Buena. A single `terraform apply` provisions the full production environment on Google Cloud — cluster, storage, databases, GitOps, ingress, and TLS.

Can be bootstrapped standalone or as part of the full monorepo. See the [root README](../README.md) for the full picture.

---

## Resource map

```
Google Cloud Project: bigberlin-hack26ber-3239  (europe-west3)
│
└── GKE Cluster: buena-cluster
    │
    ├── Node Pool: buena-node-pool
    │   └── 1× e2-standard-2  (50 GB disk)
    │
    ├── Namespace: ingress-nginx
    │   └── [Helm] ingress-nginx v4.10.1
    │       └── LoadBalancer Service  ← single external IP for all traffic
    │
    ├── Namespace: cert-manager
    │   └── [Helm] cert-manager v1.15.3
    │       └── ClusterIssuer: letsencrypt-prod  (ACME HTTP-01)
    │
    ├── Namespace: flux-system
    │   ├── [Helm] flux2 v2.13.0
    │   │   ├── image-reflector-controller
    │   │   └── image-automation-controller
    │   ├── GitRepository → github.com/…/buena-EBITDuuh (main)
    │   ├── Kustomization → ./infra/k8s/
    │   ├── ImageRepository: buena-backend  (ghcr.io)
    │   ├── ImageRepository: buena-frontend (ghcr.io)
    │   ├── ImagePolicy: buena-backend  (semver >=0.0.0)
    │   ├── ImagePolicy: buena-frontend (semver >=0.0.0)
    │   └── ImageUpdateAutomation → commits updated tags to main
    │
    └── Namespace: buena
        │
        ├── Secrets
        │   ├── minio-credentials      (root-user / root-password)
        │   ├── mongo-credentials      (username / password / uri)
        │   ├── buena-app-secrets      (MODEL_PROVIDER, MODEL_NAME,
        │   │                           GEMINI_API_KEY, MONGO_URI)
        │   ├── ghcr-credentials       (dockerconfigjson for ghcr.io)
        │   └── github-actions-token   (long-lived K8s SA token)
        │
        ├── MinIO  (object storage)
        │   ├── Deployment: minio  (minio/minio:RELEASE.2024-11-07)
        │   ├── Service: LoadBalancer  :9000 (API)  :9001 (console)
        │   └── PVC: minio-data  (10 Gi)
        │
        ├── MongoDB  (document store)
        │   ├── Deployment: mongo  (mongo:7.0)
        │   ├── Service: LoadBalancer  :27017
        │   └── PVC: mongo-data  (10 Gi)
        │
        ├── ServiceAccount: github-actions
        │   ├── Role: get/list/create pods, exec, portforward, get secrets
        │   └── RoleBinding → github-actions SA
        │
        └── Kustomize manifests (./k8s/)
            ├── Deployment: backend   (FastAPI  :8000)
            ├── Deployment: frontend  (Next.js  :3000→:80)
            └── Ingress  → ingress-nginx → letsencrypt-prod TLS
```

---

## Bootstrap

```sh
cd infra
cp .env.example .env
# Fill in required variables (see .env.example)

terraform init
terraform plan
terraform apply
```

**Required variables** (set in `infra/.env` as `TF_VAR_*`):

| Variable | Description |
|----------|-------------|
| `ghcr_username` | GitHub username owning the GHCR packages |
| `pat` | GitHub PAT with `repo` + `write:packages` scopes |
| `gemini_api_key` | Google Gemini API key |
| `model_provider` | `GEMINI` or `OPENAI` |
| `model_name` | e.g. `gemini-2.0-flash` or `gpt-4o` |
| `mongo_uri` | MongoDB connection URI |
| `letsencrypt_email` | Email for TLS certificate notifications |

---

## Connect to the cluster

```sh
gcloud container clusters get-credentials buena-cluster \
  --region europe-west3 \
  --project bigberlin-hack26ber-3239
```

---

## MinIO

### Get credentials

```sh
kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-user}' | base64 -d && echo

kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-password}' | base64 -d && echo
```

### Access console

```sh
kubectl get svc minio -n buena
# Open http://<EXTERNAL-IP>:9001
```

Or port-forward:

```sh
kubectl port-forward svc/minio 9000:9000 9001:9001 -n buena
# API:     http://localhost:9000
# Console: http://localhost:9001
```

### Use `mc` CLI

```sh
MINIO_IP=$(kubectl get svc minio -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MINIO_USER=$(kubectl get secret minio-credentials -n buena -o jsonpath='{.data.root-user}' | base64 -d)
MINIO_PASS=$(kubectl get secret minio-credentials -n buena -o jsonpath='{.data.root-password}' | base64 -d)

mc alias set buena http://$MINIO_IP:9000 $MINIO_USER $MINIO_PASS
mc ls buena
```

---

## MongoDB

### Get credentials

```sh
kubectl get secret mongo-credentials -n buena \
  -o jsonpath='{.data.uri}' | base64 -d && echo
```

### Connect with `mongosh`

```sh
MONGO_IP=$(kubectl get svc mongo -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MONGO_PASS=$(kubectl get secret mongo-credentials -n buena -o jsonpath='{.data.password}' | base64 -d)
mongosh "mongodb://buena-admin:$MONGO_PASS@$MONGO_IP:27017/buena?authSource=admin"
```

Or port-forward:

```sh
kubectl port-forward svc/mongo 27017:27017 -n buena
mongosh "mongodb://buena-admin:<password>@localhost:27017/buena?authSource=admin"
```

---

## GitHub Actions — raw-data sync

The workflow `.github/workflows/sync-raw-data.yml` triggers on any push to `raw-data/**`. It authenticates to GKE via a long-lived K8s SA token, port-forwards MinIO, and mirrors `raw-data/` into the `raw-data` bucket.

### Required GitHub repository secrets

| Secret | How to get it |
|--------|--------------|
| `GKE_SA_TOKEN` | `kubectl get secret github-actions-token -n buena -o jsonpath='{.data.token}' \| base64 -d` |
| `GKE_CA_CERT` | `kubectl get secret github-actions-token -n buena -o jsonpath='{.data.ca\.crt}' \| base64 -d \| base64` |
| `GKE_SERVER` | `kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'` |

---

## GitOps flow

```
Push image tag to GHCR
        │
        ▼
Flux ImageReflector polls GHCR (every 1m)
        │
        ▼
ImagePolicy matches new semver tag
        │
        ▼
ImageUpdateAutomation commits updated tag to main
        │
        ▼
Flux Kustomization syncs ./infra/k8s/ (every 1m)
        │
        ▼
Deployment rolling update on GKE
```

---

## Status

| Component | Status |
|-----------|--------|
| GKE cluster | Running |
| Node pool | Running |
| MinIO | Running · 10 Gi PVC attached |
| MongoDB | Running · 10 Gi PVC attached |
| Flux GitOps | Active · auto image updates enabled |
| ingress-nginx | Running · external LoadBalancer |
| cert-manager | Running · Let's Encrypt TLS |
| GitHub Actions SA | Configured · RBAC for port-forward + secret read |
