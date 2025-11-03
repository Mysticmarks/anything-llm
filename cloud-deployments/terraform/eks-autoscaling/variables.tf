variable "region" {
  description = "AWS region where the EKS control plane and worker nodes will run."
  type        = string
}

variable "cluster_name" {
  description = "Name of the EKS cluster."
  type        = string
  default     = "anythingllm-prod"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.29"
}

variable "vpc_cidr" {
  description = "CIDR range for the VPC that will host the cluster."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across."
  type        = number
  default     = 3
}

variable "private_subnet_cidrs" {
  description = "Custom CIDR blocks for private subnets. Leave empty to auto-generate."
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "Custom CIDR blocks for public subnets. Leave empty to auto-generate."
  type        = list(string)
  default     = []
}

variable "node_instance_types" {
  description = "Instance types to use for the managed node group."
  type        = list(string)
  default     = ["m6i.xlarge"]
}

variable "node_capacity_type" {
  description = "Capacity type for the managed node group (ON_DEMAND or SPOT)."
  type        = string
  default     = "ON_DEMAND"
}

variable "node_desired_size" {
  description = "Desired number of worker nodes."
  type        = number
  default     = 3
}

variable "node_min_size" {
  description = "Minimum number of worker nodes for cluster autoscaling."
  type        = number
  default     = 3
}

variable "node_max_size" {
  description = "Maximum number of worker nodes for cluster autoscaling."
  type        = number
  default     = 9
}

variable "node_disk_size" {
  description = "EBS volume size (GiB) to attach to each worker node."
  type        = number
  default     = 100
}

variable "node_labels" {
  description = "Kubernetes labels applied to nodes in the default node group."
  type        = map(string)
  default     = {}
}

variable "node_taints" {
  description = "Optional taints to apply to nodes in the default node group."
  type = list(object({
    key    = string
    value  = string
    effect = string
  }))
  default = []
}

variable "tags" {
  description = "Additional AWS resource tags to apply."
  type        = map(string)
  default     = {}
}

variable "namespace" {
  description = "Kubernetes namespace where AnythingLLM will be deployed."
  type        = string
  default     = "anythingllm"
}

variable "namespace_labels" {
  description = "Labels to apply to the workload namespace when it is created."
  type        = map(string)
  default     = {}
}

variable "create_namespace" {
  description = "Whether Terraform should create the workload namespace."
  type        = bool
  default     = true
}

variable "helm_release_name" {
  description = "Name of the Helm release for AnythingLLM."
  type        = string
  default     = "anythingllm"
}

variable "app_min_replicas" {
  description = "Baseline replica count for the AnythingLLM deployment."
  type        = number
  default     = 2
}

variable "app_max_replicas" {
  description = "Maximum replica count enforced by the HPA."
  type        = number
  default     = 6
}

variable "app_target_cpu" {
  description = "CPU utilization target percentage for the HPA."
  type        = number
  default     = 65
}

variable "app_target_memory" {
  description = "Memory utilization target percentage for the HPA."
  type        = number
  default     = 70
}

variable "app_config" {
  description = "Optional override for AnythingLLM configuration values."
  type        = map(any)
  default     = {}
}

variable "app_env_from" {
  description = "List of envFrom blocks to inject into the AnythingLLM pods."
  type        = list(any)
  default     = []
}

variable "persistent_volume_size" {
  description = "PersistentVolumeClaim size for AnythingLLM storage."
  type        = string
  default     = "100Gi"
}

variable "persistent_volume_storage_class" {
  description = "Storage class name to bind for AnythingLLM storage. Leave empty to use the cluster default."
  type        = string
  default     = ""
}

variable "service_type" {
  description = "Kubernetes Service type exposed by the chart (e.g., LoadBalancer, ClusterIP)."
  type        = string
  default     = "LoadBalancer"
}

variable "enable_metrics" {
  description = "Enable ServiceMonitor and Grafana dashboard provisioning for AnythingLLM."
  type        = bool
  default     = true
}

variable "helm_additional_values" {
  description = "Extra YAML documents to append to the AnythingLLM Helm values."
  type        = list(string)
  default     = []
}

variable "enable_metrics_server" {
  description = "Install the Kubernetes metrics-server via Helm."
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Install the Kubernetes cluster-autoscaler via Helm and configure IRSA bindings."
  type        = bool
  default     = true
}

variable "metrics_server_chart_version" {
  description = "Version of the metrics-server chart to deploy."
  type        = string
  default     = "3.12.1"
}

variable "cluster_autoscaler_chart_version" {
  description = "Version of the cluster-autoscaler chart to deploy."
  type        = string
  default     = "9.42.0"
}
