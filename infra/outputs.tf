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
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "Base64-encoded cluster CA certificate — set as K8S_CA in GitHub Actions secrets."
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "minio_external_ip" {
  description = "MinIO external LoadBalancer IP (available after GCP provisions it)."
  value       = try(kubernetes_service.minio.status[0].load_balancer[0].ingress[0].ip, "pending")
}

output "mongo_external_ip" {
  description = "MongoDB external LoadBalancer IP (available after GCP provisions it)."
  value       = try(kubernetes_service.mongo.status[0].load_balancer[0].ingress[0].ip, "pending")
}

output "frontend_external_ip" {
  description = "Frontend external LoadBalancer IP — run after Flux has reconciled: kubectl get svc frontend -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
  value       = "kubectl get svc frontend -n buena -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
}

output "github_actions_token_command" {
  description = "Command to extract the K8s SA token — copy into the K8S_TOKEN GitHub Actions secret."
  value       = "kubectl get secret github-actions-token -n buena -o jsonpath='{.data.token}' | base64 -d"
}

output "github_actions_ca_command" {
  description = "Command to extract the cluster CA cert — copy into the K8S_CA GitHub Actions secret."
  value       = "kubectl get secret github-actions-token -n buena -o jsonpath='{.data.ca\\.crt}'"
}

