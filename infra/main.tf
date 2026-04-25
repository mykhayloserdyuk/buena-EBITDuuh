terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.45"
    }
  }
}

locals {
  project_id           = "bigberlin-hack26ber-3239"
  region               = "europe-west3"
  bucket_location      = "EU"
  raw_data_bucket_name = "buena-ebitduuh-raw-data"
  sync_service_account = "github-raw-data-sync"
}

provider "google" {
  project = local.project_id
  region  = local.region
}

resource "google_storage_bucket" "raw_data" {
  name                        = local.raw_data_bucket_name
  project                     = local.project_id
  location                    = local.bucket_location
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age                = 30
      with_state         = "ARCHIVED"
      num_newer_versions = 3
    }

    action {
      type = "Delete"
    }
  }

  labels = {
    app          = "buena-ebitduuh"
    environment  = "dev"
    "managed-by" = "terraform"
  }
}

resource "google_service_account" "raw_data_sync" {
  project      = local.project_id
  account_id   = local.sync_service_account
  display_name = "GitHub raw-data sync"
}

resource "google_storage_bucket_iam_member" "raw_data_sync_object_admin" {
  bucket = google_storage_bucket.raw_data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.raw_data_sync.email}"
}
