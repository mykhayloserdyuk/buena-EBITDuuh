output "gke_cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.main.name
}

output "gke_cluster_region" {
  description = "GKE cluster region."
  value       = google_container_cluster.main.location
}

output "gke_cluster_endpoint" {
  description = "GKE API server endpoint."
  value       = "https://${google_container_cluster.main.endpoint}"
}

output "minio_external_ip" {
  description = "MinIO external LoadBalancer IP (available after GCP provisions it)."
  value       = try(kubernetes_service.minio.status[0].load_balancer[0].ingress[0].ip, "pending")
}

output "mongo_external_ip" {
  description = "MongoDB external LoadBalancer IP (available after GCP provisions it)."
  value       = try(kubernetes_service.mongo.status[0].load_balancer[0].ingress[0].ip, "pending")
}

output "github_actions_token_command" {
  description = "Command to extract the K8s SA token for use in GitHub Actions."
  value       = "kubectl get secret github-actions-token -n buena -o jsonpath='{.data.token}' | base64 -d"
}

output "github_actions_ca_command" {
  description = "Command to extract the cluster CA cert for use in GitHub Actions."
  value       = "kubectl get secret github-actions-token -n buena -o jsonpath='{.data.ca\\.crt}' | base64 -d | base64"
}
