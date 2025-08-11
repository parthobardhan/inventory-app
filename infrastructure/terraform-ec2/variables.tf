variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "key_pair_name" {
  description = "AWS Key Pair name for SSH access"
  type        = string
  default     = null
}

variable "s3_bucket_name" {
  description = "S3 bucket name for image storage"
  type        = string
  default     = "textile-inventory-images-ec2"
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "huggingface_api_key" {
  description = "Hugging Face API key for AI services"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
  default     = "textile-inventory-jwt-secret-2025"
}
