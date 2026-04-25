output "raw_data_bucket_name" {
  description = "Bucket that receives files from raw-data/."
  value       = google_storage_bucket.raw_data.name
}

output "raw_data_bucket_url" {
  description = "GCS URL for the raw-data bucket."
  value       = "gs://${google_storage_bucket.raw_data.name}"
}

output "raw_data_sync_service_account_email" {
  description = "Service account used by the manual GitHub raw-data sync workflow."
  value       = google_service_account.raw_data_sync.email
}
