# AnythingLLM production-ready EKS deployment

This Terraform configuration provisions a highly-available Amazon EKS cluster, enables node autoscaling, and deploys the AnythingLLM Helm chart with built-in horizontal pod autoscaling, disruption budgets, and observability hooks.

## Features

- **Scalable control plane and workers** – builds a multi-AZ VPC, managed node group, and wires in cluster-autoscaler with an IAM role for service accounts (IRSA).
- **Application-level resiliency** – installs the AnythingLLM Helm chart with rolling updates, an HPA, and a PodDisruptionBudget for graceful drain behaviour.
- **Observability pipeline** – optionally installs the Kubernetes metrics-server, enables ServiceMonitor/Grafana dashboards in the chart, and exposes ready-to-consume metrics for Prometheus/Grafana.
- **Configurable storage** – defaults to a RWX volume so multiple replicas can safely share workspace data; override the storage class/size to match your environment.

## Prerequisites

- Terraform `>= 1.5`
- AWS credentials with permission to create VPC, IAM, and EKS resources
- A DNS and TLS strategy for the exposed LoadBalancer service (AWS ACM, external-dns, etc.)
- Optional: a Prometheus stack (Prometheus Operator / kube-prometheus-stack) if you want ServiceMonitor integration

## Usage

```bash
cd cloud-deployments/terraform/eks-autoscaling
terraform init
terraform apply \
  -var="region=us-east-1" \
  -var="cluster_name=anythingllm-prod" \
  -var="app_config={DISABLE_TELEMETRY=\"true\"}" \
  -var="persistent_volume_storage_class=efs-sc"
```

Key tunables include:

- `node_*` variables to size the worker pool.
- `app_min_replicas`, `app_max_replicas`, `app_target_cpu`, `app_target_memory` to control the HorizontalPodAutoscaler.
- `enable_metrics` to toggle ServiceMonitor/Grafana provisioning (leave enabled when Prometheus/Grafana are installed).
- `helm_additional_values` to append extra YAML snippets (e.g., custom ingress or affinity rules).

After `terraform apply` completes, inspect the outputs for the cluster endpoint, namespace, and autoscaling summary:

```bash
terraform output
```

Destroy the stack when finished:

```bash
terraform destroy -var="region=us-east-1"
```

> **Note:** The AnythingLLM chart expects a storage class capable of `ReadWriteMany` access when you run multiple replicas. On AWS, the EFS CSI driver is a common choice.
