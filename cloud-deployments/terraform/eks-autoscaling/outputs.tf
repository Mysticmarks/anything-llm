output "cluster_name" {
  description = "Name of the EKS cluster created by this stack."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Public API endpoint for the EKS cluster."
  value       = module.eks.cluster_endpoint
}

output "node_group_autoscaling" {
  description = "Effective autoscaling configuration applied to the primary managed node group."
  value = {
    desired = var.node_desired_size
    min     = var.node_min_size
    max     = var.node_max_size
  }
}

output "anythingllm_release" {
  description = "Helm release name responsible for deploying AnythingLLM."
  value       = helm_release.anythingllm.name
}

output "anythingllm_namespace" {
  description = "Namespace where the AnythingLLM workload is running."
  value       = var.namespace
}

output "cluster_autoscaler_role_arn" {
  description = "IAM role ARN used by the cluster-autoscaler service account (if enabled)."
  value       = local.cluster_autoscaler_role_arn
}
