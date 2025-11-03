terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.30"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.12"
    }
  }
}

provider "aws" {
  region = var.region
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  private_subnet_cidrs = length(var.private_subnet_cidrs) > 0 ? var.private_subnet_cidrs : [for index in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, index)]
  public_subnet_cidrs  = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : [for index in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, index + var.az_count)]
  tags = merge({
    Project   = var.cluster_name
    ManagedBy = "terraform"
  }, var.tags)
}

data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  private_subnets = local.private_subnet_cidrs
  public_subnets  = local.public_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.24.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    eks-pod-identity-agent = { most_recent = true }
  }

  eks_managed_node_groups = {
    primary = {
      instance_types = var.node_instance_types
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_desired_size
      disk_size      = var.node_disk_size
      labels         = var.node_labels
      taints         = var.node_taints
      capacity_type  = var.node_capacity_type
    }
  }

  enable_irsa = true

  tags = local.tags
}

data "aws_eks_cluster" "this" {
  name = module.eks.cluster_name
}

data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.this.endpoint
  token                  = data.aws_eks_cluster_auth.this.token
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.this.endpoint
    token                  = data.aws_eks_cluster_auth.this.token
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
  }
}

resource "kubernetes_namespace" "workload" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = var.namespace_labels
  }

  depends_on = [module.eks]
}

module "cluster_autoscaler_irsa" {
  count   = var.enable_cluster_autoscaler ? 1 : 0
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "5.33.1"

  role_name = "${var.cluster_name}-cluster-autoscaler"

  cluster_autoscaler_cluster_names = [module.eks.cluster_name]
  attach_cluster_autoscaler_policy = true

  oidc_providers = {
    eks = {
      provider_arn = module.eks.oidc_provider_arn
    }
  }

  tags = local.tags
}

locals {
  cluster_autoscaler_role_arn = try(module.cluster_autoscaler_irsa[0].iam_role_arn, null)
  anythingllm_values = merge({
    replicaCount = var.app_min_replicas
    autoscaling = {
      enabled                           = true
      minReplicas                       = var.app_min_replicas
      maxReplicas                       = var.app_max_replicas
      targetCPUUtilizationPercentage    = var.app_target_cpu
      targetMemoryUtilizationPercentage = var.app_target_memory
    }
    persistentVolume = {
      size         = var.persistent_volume_size
      storageClass = var.persistent_volume_storage_class
    }
    service = {
      type = var.service_type
    }
    metrics = {
      enabled  = var.enable_metrics
      path     = "/metrics"
      portName = "http"
      serviceMonitor = {
        enabled   = var.enable_metrics
        namespace = var.namespace
      }
      grafanaDashboard = {
        enabled   = var.enable_metrics
        namespace = var.namespace
      }
    }
  },
  length(var.app_config) > 0 ? { config = var.app_config } : {},
  length(var.app_env_from) > 0 ? { envFrom = var.app_env_from } : {})

  namespace_dependencies = var.create_namespace ? [kubernetes_namespace.workload[0]] : []
  cluster_autoscaler_annotations = local.cluster_autoscaler_role_arn != null ? {
    "eks.amazonaws.com/role-arn" = local.cluster_autoscaler_role_arn
  } : {}
}

resource "helm_release" "metrics_server" {
  count      = var.enable_metrics_server ? 1 : 0
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = var.metrics_server_chart_version
  namespace  = "kube-system"

  values = [
    yamlencode({
      args = ["--kubelet-insecure-tls"]
    })
  ]

  depends_on = [module.eks]
}

resource "helm_release" "cluster_autoscaler" {
  count      = var.enable_cluster_autoscaler ? 1 : 0
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = var.cluster_autoscaler_chart_version
  namespace  = "kube-system"

  values = [
    yamlencode({
      awsRegion = var.region
      autoDiscovery = {
        clusterName = module.eks.cluster_name
      }
      rbac = {
        serviceAccount = {
          create      = true
          name        = "cluster-autoscaler"
          annotations = local.cluster_autoscaler_annotations
        }
      }
      extraArgs = {
        "skip-nodes-with-local-storage" = "false"
        "skip-nodes-with-system-pods"   = "false"
        "balance-similar-node-groups"   = "true"
        expander                         = "least-waste"
      }
      podDisruptionBudget = {
        maxUnavailable = 1
      }
    })
  ]

  depends_on = [module.eks]
}

resource "helm_release" "anythingllm" {
  name             = var.helm_release_name
  chart            = "${path.module}/../../helm/charts/anythingllm"
  namespace        = var.namespace
  create_namespace = false

  values = concat([
    yamlencode(local.anythingllm_values)
  ], var.helm_additional_values)

  depends_on = concat([module.eks], local.namespace_dependencies)
}
