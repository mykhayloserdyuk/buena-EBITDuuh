# Infrastructure

GKE-based stack for `buena-EBITDuuh`. Manages a GKE cluster with MinIO (blob storage) and MongoDB, both running as Kubernetes deployments with credentials stored as K8s secrets. GitHub Actions uses Workload Identity to sync `raw-data/` into MinIO without any long-lived keys.

## What was built

| Resource | Details |
|---|---|
| GKE cluster | `buena-cluster` · `europe-west3` · 1× `e2-standard-2` node |
| Namespace | `buena` |
| MinIO | Deployment + ClusterIP service · API `:9000` · Console `:9001` |
| MongoDB | Deployment + ClusterIP service · `:27017` |
| K8s secrets | `minio-credentials`, `mongo-credentials` |
| GCP SA | `buena-github-actions` · `roles/container.developer` |
| Workload Identity | K8s SA `github-actions` → GCP SA, pool enabled on cluster |
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

Credentials live in the `minio-credentials` K8s secret:

```sh
kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-user}' | base64 -d

kubectl get secret minio-credentials -n buena \
  -o jsonpath='{.data.root-password}' | base64 -d
```

Access the API or console locally via port-forward:

```sh
kubectl port-forward svc/minio 9000:9000 9001:9001 -n buena
# API:     http://localhost:9000
# Console: http://localhost:9001
```

## MongoDB

The full connection URI is stored in the `mongo-credentials` secret:

```sh
kubectl get secret mongo-credentials -n buena \
  -o jsonpath='{.data.uri}' | base64 -d
# mongodb://buena-admin:<password>@mongo.buena.svc.cluster.local:27017/buena?authSource=admin
```

Connect from a pod inside the cluster:

```sh
kubectl run mongo-shell --rm -it --image=mongo:7.0 -n buena -- \
  mongosh "$(kubectl get secret mongo-credentials -n buena \
    -o jsonpath='{.data.uri}' | base64 -d)"
```

Or forward the port locally:

```sh
kubectl port-forward svc/mongo 27017:27017 -n buena
mongosh "mongodb://buena-admin:<password>@localhost:27017/buena?authSource=admin"
```

## GitHub Actions — raw-data sync

The workflow `.github/workflows/sync-raw-data.yml` triggers on any push to `main` that touches `raw-data/**`. It:

1. Authenticates to GCP via Workload Identity (no long-lived keys)
2. Gets GKE credentials
3. Reads MinIO credentials from the K8s secret
4. Port-forwards MinIO and mirrors `raw-data/` into the `raw-data` bucket

### Required repository secrets

| Secret | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/611499754652/locations/global/workloadIdentityPools/bigberlin-hack26ber-3239.svc.id.goog/providers/<provider-name>` |
| `GCP_SA_EMAIL` | `buena-github-actions@bigberlin-hack26ber-3239.iam.gserviceaccount.com` |

> **Note:** The Workload Identity Provider resource is not yet created — you need to set up a Workload Identity Pool + OIDC provider for GitHub in GCP IAM before the action will work. See [GitHub's guide](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account).

## Status

| Component | Status |
|---|---|
| GKE cluster | ✅ Running |
| Node pool | ✅ Running |
| MinIO pod | ✅ Running |
| MongoDB pod | ✅ Running |
| Workload Identity on cluster | ✅ Enabled |
| IAM binding for GitHub Actions SA | ✅ Applied |
| GitHub Actions workflow | ✅ Created — needs WI provider secret configured |
