# AWS Deployment Guide - Textile Inventory Management System

This guide provides step-by-step instructions for deploying the Textile Inventory Management System to AWS using ECS Fargate with Application Load Balancer.

## 🏗️ Architecture Overview

The deployment uses the following AWS services:
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: Public-facing load balancer with health checks
- **ECR**: Container image registry
- **VPC**: Custom VPC with public subnets across 2 AZs
- **Secrets Manager**: Secure storage for API keys and database credentials
- **CloudWatch**: Logging and monitoring
- **IAM**: Roles and policies for secure access

## 📋 Prerequisites

### Required Tools
- AWS CLI v2 installed and configured
- Docker installed and running
- Terraform >= 1.0 installed
- Git

### Required AWS Permissions
Your AWS user/role needs permissions for:
- ECS (Fargate, services, task definitions)
- ECR (repositories, images)
- VPC (subnets, security groups, load balancers)
- IAM (roles, policies)
- Secrets Manager
- CloudWatch Logs

### Required Environment Variables
Set these environment variables before deployment:

```bash
# AWS Credentials (if not using AWS CLI profiles)
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_SESSION_TOKEN="your-session-token"  # If using temporary credentials

# Application Configuration
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/textile-inventory?retryWrites=true&w=majority"
export HUGGINGFACE_API_KEY="hf_your_api_key_here"
export JWT_SECRET="your-secure-jwt-secret"

# Optional: Override defaults
export AWS_REGION="us-east-1"
export S3_BUCKET_NAME="partho-inventory-images"
```

## 🚀 Quick Deployment

### Option 1: Automated Deployment Script

```bash
# Make the script executable
chmod +x scripts/build-and-deploy.sh

# Run the deployment
./scripts/build-and-deploy.sh
```

This script will:
1. Validate environment variables
2. Build and push Docker image to ECR
3. Deploy infrastructure with Terraform
4. Update ECS service
5. Perform health checks

### Option 2: Manual Step-by-Step Deployment

#### Step 1: Configure Terraform Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values
```

#### Step 2: Build and Push Docker Image

```bash
# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t textile-inventory-app:latest .

# Tag for ECR
docker tag textile-inventory-app:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/textile-inventory-app:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/textile-inventory-app:latest
```

#### Step 3: Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply
```

#### Step 4: Get Application URL

```bash
# Get the application URL
terraform output application_url
```

## 🔧 Configuration Details

### Environment Variables in Production

The application uses the following environment variables in the ECS task:

- `NODE_ENV=production`
- `PORT=3000`
- `AWS_REGION` - Set from Terraform variable
- `S3_BUCKET_NAME` - Set from Terraform variable
- `MONGODB_URI` - Retrieved from AWS Secrets Manager
- `HUGGINGFACE_API_KEY` - Retrieved from AWS Secrets Manager
- `JWT_SECRET` - Retrieved from AWS Secrets Manager

### AWS Resource Tagging

All resources are tagged with:
- `owner=partho.bardhan`
- `purpose=training`
- `expire-on=2025-09-15`

### Security Configuration

- **VPC**: Custom VPC with public subnets in 2 AZs
- **Security Groups**: 
  - ALB: Allows HTTP (80) and HTTPS (443) from internet
  - ECS Tasks: Allows port 3000 from ALB only
- **IAM**: Least privilege roles for ECS tasks
- **Secrets**: Stored in AWS Secrets Manager, not in environment variables

## 📊 Monitoring and Logs

### CloudWatch Logs
Application logs are available in CloudWatch:
- Log Group: `/ecs/textile-inventory`
- Stream Prefix: `ecs`

### Health Checks
- **Load Balancer**: Checks `/api/health` endpoint
- **Docker**: Built-in health check using curl

### Monitoring Commands

```bash
# View ECS service status
aws ecs describe-services --cluster textile-inventory-cluster --services textile-inventory-service

# View CloudWatch logs
aws logs tail /ecs/textile-inventory --follow

# Check load balancer health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

## 🔄 Updates and Maintenance

### Deploying Code Changes

1. Build and push new Docker image:
```bash
docker build -t textile-inventory-app:latest .
docker tag textile-inventory-app:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/textile-inventory-app:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/textile-inventory-app:latest
```

2. Force ECS service update:
```bash
aws ecs update-service --cluster textile-inventory-cluster --service textile-inventory-service --force-new-deployment
```

### Scaling the Application

```bash
# Scale to 2 instances
aws ecs update-service --cluster textile-inventory-cluster --service textile-inventory-service --desired-count 2
```

### Updating Secrets

```bash
# Update MongoDB URI
aws secretsmanager update-secret --secret-id textile-inventory/mongodb-uri --secret-string "new-connection-string"

# Update Hugging Face API Key
aws secretsmanager update-secret --secret-id textile-inventory/huggingface-api-key --secret-string "new-api-key"
```

## 🗑️ Cleanup

To destroy all AWS resources:

```bash
# Using the cleanup script
chmod +x scripts/destroy-infrastructure.sh
./scripts/destroy-infrastructure.sh

# Or manually with Terraform
cd infrastructure/terraform
terraform destroy
```

## 🐛 Troubleshooting

### Common Issues

1. **ECS Task Fails to Start**
   - Check CloudWatch logs for error messages
   - Verify secrets are properly configured
   - Ensure Docker image is valid

2. **Health Check Failures**
   - Verify application is listening on port 3000
   - Check security group allows traffic from ALB
   - Ensure `/api/health` endpoint is responding

3. **Database Connection Issues**
   - Verify MongoDB Atlas URI is correct
   - Check network connectivity from ECS tasks
   - Ensure MongoDB Atlas allows connections from AWS

4. **AI Service Failures**
   - Verify Hugging Face API key is valid
   - Check API rate limits and quotas
   - Review AI service logs in CloudWatch

### Debugging Commands

```bash
# Get ECS task details
aws ecs list-tasks --cluster textile-inventory-cluster --service-name textile-inventory-service
aws ecs describe-tasks --cluster textile-inventory-cluster --tasks <task-arn>

# Check load balancer targets
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# View recent logs
aws logs tail /ecs/textile-inventory --since 1h
```

## 📈 Cost Estimation

Estimated monthly costs (us-east-1):
- **ECS Fargate**: ~$20-35 (0.5 vCPU, 1GB RAM)
- **Application Load Balancer**: ~$16
- **CloudWatch Logs**: ~$5-10
- **S3 Storage**: ~$5-15 (depending on image volume)
- **Data Transfer**: ~$5-15
- **Secrets Manager**: ~$1
- **Total**: ~$50-95/month

## 🔐 Security Best Practices

- ✅ No hard-coded secrets in code or containers
- ✅ Secrets stored in AWS Secrets Manager
- ✅ Non-root user in Docker container
- ✅ Least privilege IAM roles
- ✅ VPC with proper security groups
- ✅ HTTPS termination at load balancer (when SSL configured)
- ✅ Container image scanning enabled in ECR

## 📞 Support

For issues with this deployment:
1. Check CloudWatch logs first
2. Review this documentation
3. Check AWS service status
4. Contact the development team

---

**Note**: This deployment maintains all existing functionality including MongoDB Atlas integration, S3 image storage, and Hugging Face AI services while providing a scalable, secure AWS infrastructure.
