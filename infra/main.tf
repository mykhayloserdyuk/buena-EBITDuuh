terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.45"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

locals {
  project_id  = "bigberlin-hack26ber-3239"
  region      = "europe-west3"
  github_repo = "${var.ghcr_username}/buena-EBITDuuh"
}

provider "google" {
  project = local.project_id
  region  = local.region
}

# ---------------------------------------------------------------------------
# Enable required APIs
# ---------------------------------------------------------------------------

resource "google_project_service" "container" {
  project            = local.project_id
  service            = "container.googleapis.com"
  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# GKE cluster
# ---------------------------------------------------------------------------

resource "google_container_cluster" "main" {
  name     = "buena-cluster"
  project  = local.project_id
  location = local.region

  remove_default_node_pool = true
  initial_node_count       = 1

  deletion_protection = false

  depends_on = [google_project_service.container]
}

resource "google_container_node_pool" "main" {
  name       = "buena-node-pool"
  project    = local.project_id
  location   = local.region
  cluster    = google_container_cluster.main.name
  node_count = 1

  node_config {
    machine_type = "e2-standard-2"
    disk_size_gb = 50
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    labels = {
      app        = "buena-ebitduuh"
      managed-by = "terraform"
    }
  }
}

# ---------------------------------------------------------------------------
# Kubernetes provider — wired to the GKE cluster above
# ---------------------------------------------------------------------------

data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.main.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.main.master_auth[0].cluster_ca_certificate)
}

# ---------------------------------------------------------------------------
# Namespace
# ---------------------------------------------------------------------------

resource "kubernetes_namespace" "buena" {
  metadata {
    name = "buena"
  }

  depends_on = [google_container_node_pool.main]
}

# ---------------------------------------------------------------------------
# MinIO — blob / object storage
# ---------------------------------------------------------------------------

resource "kubernetes_persistent_volume_claim" "minio" {
  metadata {
    name      = "minio-data"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  wait_until_bound = false

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }
}

resource "kubernetes_secret" "minio_credentials" {
  metadata {
    name      = "minio-credentials"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  data = {
    root-user     = "buena-admin"
    root-password = "buena-minio-secret-2026"
  }
}

resource "kubernetes_deployment" "minio" {
  metadata {
    name      = "minio"
    namespace = kubernetes_namespace.buena.metadata[0].name
    labels    = { app = "minio" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "minio" }
    }

    template {
      metadata {
        labels = { app = "minio" }
      }

      spec {
        container {
          name  = "minio"
          image = "minio/minio:RELEASE.2024-11-07T00-52-20Z"
          args  = ["server", "/data", "--console-address", ":9001"]

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-user"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-password"
              }
            }
          }

          port {
            container_port = 9000
            name           = "api"
          }

          port {
            container_port = 9001
            name           = "console"
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.minio.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "minio" {
  metadata {
    name      = "minio"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  spec {
    selector = { app = "minio" }
    type     = "LoadBalancer"

    port {
      name        = "api"
      port        = 9000
      target_port = 9000
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

# ---------------------------------------------------------------------------
# MongoDB standalone
# ---------------------------------------------------------------------------

resource "kubernetes_persistent_volume_claim" "mongo" {
  metadata {
    name      = "mongo-data"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  wait_until_bound = false

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }
}

resource "kubernetes_secret" "mongo_credentials" {
  metadata {
    name      = "mongo-credentials"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  data = {
    username = "buena-admin"
    password = "buena-mongo-secret-2026"
    uri      = "mongodb://buena-admin:buena-mongo-secret-2026@mongo.buena.svc.cluster.local:27017/buena?authSource=admin"
  }
}

resource "kubernetes_deployment" "mongo" {
  metadata {
    name      = "mongo"
    namespace = kubernetes_namespace.buena.metadata[0].name
    labels    = { app = "mongo" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "mongo" }
    }

    template {
      metadata {
        labels = { app = "mongo" }
      }

      spec {
        container {
          name  = "mongo"
          image = "mongo:7.0"

          env {
            name = "MONGO_INITDB_ROOT_USERNAME"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongo_credentials.metadata[0].name
                key  = "username"
              }
            }
          }

          env {
            name = "MONGO_INITDB_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongo_credentials.metadata[0].name
                key  = "password"
              }
            }
          }

          port {
            container_port = 27017
          }

          volume_mount {
            name       = "data"
            mount_path = "/data/db"
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.mongo.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "mongo" {
  metadata {
    name      = "mongo"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  spec {
    selector = { app = "mongo" }
    type     = "LoadBalancer"

    port {
      port        = 27017
      target_port = 27017
    }
  }
}

# ---------------------------------------------------------------------------
# Kubernetes SA for GitHub Actions — authenticates directly against the cluster
# ---------------------------------------------------------------------------

resource "kubernetes_service_account" "github_actions" {
  metadata {
    name      = "github-actions"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }
}

# RBAC — allow the SA to port-forward and exec into pods
resource "kubernetes_role" "github_actions" {
  metadata {
    name      = "github-actions"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  rule {
    api_groups = [""]
    resources  = ["pods", "pods/exec", "pods/portforward", "services/portforward"]
    verbs      = ["get", "list", "create"]
  }

  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get"]
  }
}

resource "kubernetes_role_binding" "github_actions" {
  metadata {
    name      = "github-actions"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.github_actions.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.github_actions.metadata[0].name
    namespace = kubernetes_namespace.buena.metadata[0].name
  }
}

# Long-lived token for the K8s SA — store as a Secret and use in GitHub Actions
resource "kubernetes_secret" "github_actions_token" {
  metadata {
    name      = "github-actions-token"
    namespace = kubernetes_namespace.buena.metadata[0].name
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account.github_actions.metadata[0].name
    }
  }

  type = "kubernetes.io/service-account-token"
}

# ---------------------------------------------------------------------------
# Helm provider — wired to the same GKE cluster
# ---------------------------------------------------------------------------

provider "helm" {
  kubernetes {
    host                   = "https://${google_container_cluster.main.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(google_container_cluster.main.master_auth[0].cluster_ca_certificate)
  }
}

provider "kubectl" {
  host                   = "https://${google_container_cluster.main.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.main.master_auth[0].cluster_ca_certificate)
  load_config_file       = false
}

# ---------------------------------------------------------------------------
# App secrets — single source of truth in infra/.env, managed by Terraform.
# Deployments reference these via secretKeyRef; never hardcoded in manifests.
# ---------------------------------------------------------------------------

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
}

variable "model_provider" {
  description = "LLM provider (e.g. GEMINI, OPENAI)"
  type        = string
}

variable "model_name" {
  description = "LLM model name (e.g. gemini-2.0-flash, gpt-4o)"
  type        = string
}

variable "mongo_uri" {
  description = "MongoDB connection URI"
  type        = string
  sensitive   = true
}

resource "kubernetes_secret" "buena_app_secrets" {
  metadata {
    name      = "buena-app-secrets"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  data = {
    MODEL_PROVIDER = var.model_provider
    MODEL_NAME     = var.model_name
    GEMINI_API_KEY = var.gemini_api_key
    MONGO_URI      = var.mongo_uri
  }

  depends_on = [kubernetes_namespace.buena]
}

# ---------------------------------------------------------------------------
# GHCR image pull secret — lets the cluster pull from ghcr.io/${var.ghcr_username}
# ---------------------------------------------------------------------------

variable "pat" {
  description = "GitHub PAT (scopes: repo + write:packages) — used for GHCR image pulls and Flux git read access."
  type        = string
  sensitive   = true
}

variable "ghcr_username" {
  description = "GitHub username that owns the PAT and the GHCR packages (set via TF_VAR_ghcr_username)."
  type        = string
}

resource "kubernetes_secret" "ghcr_credentials" {
  metadata {
    name      = "ghcr-credentials"
    namespace = kubernetes_namespace.buena.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "ghcr.io" = {
          username = var.ghcr_username
          password = var.pat
          auth     = base64encode("${var.ghcr_username}:${var.pat}")
        }
      }
    })
  }

  depends_on = [kubernetes_namespace.buena]
}

# Patch default service accounts to use the pull secret
resource "kubernetes_default_service_account" "buena" {
  metadata {
    namespace = kubernetes_namespace.buena.metadata[0].name
  }
  image_pull_secret {
    name = kubernetes_secret.ghcr_credentials.metadata[0].name
  }
}

# ---------------------------------------------------------------------------
# Flux bootstrap via Helm
# ---------------------------------------------------------------------------

resource "kubernetes_namespace" "flux_system" {
  metadata {
    name = "flux-system"
  }

  depends_on = [google_container_node_pool.main]
}

resource "helm_release" "flux" {
  name       = "flux"
  repository = "https://fluxcd-community.github.io/helm-charts"
  chart      = "flux2"
  version    = "2.13.0"
  namespace  = kubernetes_namespace.flux_system.metadata[0].name

  # Enable image reflector + automation controllers for auto image tag updates
  set {
    name  = "imageAutomationController.create"
    value = "true"
  }
  set {
    name  = "imageReflectorController.create"
    value = "true"
  }

  depends_on = [kubernetes_namespace.flux_system]
}


# GitRepository + Kustomization applied after Flux CRDs exist
resource "kubernetes_secret" "flux_github_credentials" {
  metadata {
    name      = "flux-github-credentials"
    namespace = "flux-system"
  }

  # PAT — needs repo (read) scope
  # on the ${var.ghcr_username}/buena-EBITDuuh repository
  data = {
    username = var.ghcr_username
    password = var.pat
  }

  depends_on = [kubernetes_namespace.flux_system]
}

resource "kubectl_manifest" "flux_git_repository" {
  yaml_body = yamlencode({
    apiVersion = "source.toolkit.fluxcd.io/v1"
    kind       = "GitRepository"
    metadata = {
      name      = "buena"
      namespace = "flux-system"
    }
    spec = {
      interval  = "1m"
      url       = "https://github.com/${local.github_repo}"
      ref       = { branch = "main" }
      secretRef = { name = "flux-github-credentials" }
    }
  })

  depends_on = [helm_release.flux, kubernetes_secret.flux_github_credentials]
}

resource "kubectl_manifest" "flux_kustomization" {
  yaml_body = yamlencode({
    apiVersion = "kustomize.toolkit.fluxcd.io/v1"
    kind       = "Kustomization"
    metadata = {
      name      = "buena-app"
      namespace = "flux-system"
    }
    spec = {
      interval        = "1m"
      path            = "./infra/k8s"
      prune           = true
      sourceRef       = { kind = "GitRepository", name = "buena" }
      targetNamespace = "buena"
    }
  })

  depends_on = [kubectl_manifest.flux_git_repository]
}

# ---------------------------------------------------------------------------
# Flux Image Automation — watches GHCR for new semver tags, patches manifests,
# commits back to main so the Kustomization above picks up the change.
# ---------------------------------------------------------------------------

# flux-system needs its own copy of the GHCR pull secret for image scanning
resource "kubernetes_secret" "ghcr_credentials_flux" {
  metadata {
    name      = "ghcr-credentials"
    namespace = "flux-system"
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "ghcr.io" = {
          username = var.ghcr_username
          password = var.pat
          auth     = base64encode("${var.ghcr_username}:${var.pat}")
        }
      }
    })
  }

  depends_on = [kubernetes_namespace.flux_system]
}

resource "kubectl_manifest" "image_repository_backend" {
  yaml_body = yamlencode({
    apiVersion = "image.toolkit.fluxcd.io/v1beta2"
    kind       = "ImageRepository"
    metadata = {
      name      = "buena-backend"
      namespace = "flux-system"
    }
    spec = {
      image    = "ghcr.io/${var.ghcr_username}/buena-backend"
      interval = "1m"
      secretRef = { name = "ghcr-credentials" }
    }
  })

  depends_on = [helm_release.flux, kubernetes_secret.ghcr_credentials_flux]
}

resource "kubectl_manifest" "image_policy_backend" {
  yaml_body = yamlencode({
    apiVersion = "image.toolkit.fluxcd.io/v1beta2"
    kind       = "ImagePolicy"
    metadata = {
      name      = "buena-backend"
      namespace = "flux-system"
    }
    spec = {
      imageRepositoryRef = { name = "buena-backend" }
      policy = {
        semver = { range = ">=0.0.0" }
      }
    }
  })

  depends_on = [kubectl_manifest.image_repository_backend]
}

resource "kubectl_manifest" "image_repository_frontend" {
  yaml_body = yamlencode({
    apiVersion = "image.toolkit.fluxcd.io/v1beta2"
    kind       = "ImageRepository"
    metadata = {
      name      = "buena-frontend"
      namespace = "flux-system"
    }
    spec = {
      image    = "ghcr.io/${var.ghcr_username}/buena-frontend"
      interval = "1m"
      secretRef = { name = "ghcr-credentials" }
    }
  })

  depends_on = [helm_release.flux, kubernetes_secret.ghcr_credentials_flux]
}

resource "kubectl_manifest" "image_policy_frontend" {
  yaml_body = yamlencode({
    apiVersion = "image.toolkit.fluxcd.io/v1beta2"
    kind       = "ImagePolicy"
    metadata = {
      name      = "buena-frontend"
      namespace = "flux-system"
    }
    spec = {
      imageRepositoryRef = { name = "buena-frontend" }
      policy = {
        semver = { range = ">=0.0.0" }
      }
    }
  })

  depends_on = [kubectl_manifest.image_repository_frontend]
}

resource "kubectl_manifest" "image_update_automation" {
  yaml_body = yamlencode({
    apiVersion = "image.toolkit.fluxcd.io/v1beta1"
    kind       = "ImageUpdateAutomation"
    metadata = {
      name      = "buena"
      namespace = "flux-system"
    }
    spec = {
      interval = "1m"
      sourceRef = {
        kind = "GitRepository"
        name = "buena"
      }
      git = {
        checkout = { ref = { branch = "main" } }
        commit = {
          author = {
            name  = "flux"
            email = "flux@buena"
          }
          messageTemplate = "chore: update images to {{range .Updated.Images}}{{.}} {{end}}"
        }
        push = { branch = "main" }
      }
      update = {
        strategy = "Setters"
        path      = "./infra/k8s"
      }
    }
  })

  depends_on = [
    kubectl_manifest.flux_git_repository,
    kubectl_manifest.image_policy_backend,
    kubectl_manifest.image_policy_frontend,
  ]
}
