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
  }
}

locals {
  project_id  = "bigberlin-hack26ber-3239"
  region      = "europe-west3"
  github_repo = "mykhayloserdyuk/buena-EBITDuuh"
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
