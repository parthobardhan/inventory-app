# EC2 Deployment Guide - Textile Inventory Management System

This guide provides step-by-step instructions for deploying the Textile Inventory Management System to AWS using EC2 with Application Load Balancer.

## 🏗️ Architecture Overview

The EC2 deployment uses the following AWS services:
- **EC2**: Single instance running Node.js application directly
- **Application Load Balancer**: Public-facing load balancer with health checks
- **VPC**: Custom VPC with public subnets across 2 AZs
- **S3**: Image storage with CORS configuration
- **IAM**: Roles and policies for S3 access
- **CloudWatch**: Logging and monitoring

## 📋 Prerequisites

### Required Tools
- AWS CLI v2 installed and configured
- Terraform >= 1.0 installed
- Git

### Required AWS Permissions
Your AWS user/role needs permissions for:
- EC2 (instances, security groups, load balancers)
- VPC (subnets, security groups, internet gateways)
- IAM (roles, policies, instance profiles)
- S3 (buckets, objects)
- CloudWatch Logs

### Required Environment Variables
Set these environment variables before deployment:

```bash
# AWS Credentials
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Application Configuration
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/textile-inventory?retryWrites=true&w=majority"
export HUGGINGFACE_API_KEY="hf_your_api_key_here"

# Optional: Override defaults
export AWS_REGION="us-east-1"
```

## 🚀 Quick Deployment

### Automated Deployment Script

```bash
# Make the script executable
chmod +x scripts/deploy-ec2.sh

# Run the deployment
./scripts/deploy-ec2.sh
```

This script will:
1. Validate environment variables
2. Create Terraform configuration
3. Deploy AWS infrastructure
4. Wait for application startup
5. Perform health checks
6. Provide the public URL

## 🔧 Manual Step-by-Step Deployment

### Step 1: Navigate to EC2 Terraform Directory

```bash
cd infrastructure/terraform-ec2
```

### Step 2: Configure Terraform Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
cat > terraform.tfvars << EOF
aws_region = "us-east-1"
instance_type = "t3.small"
mongodb_uri = "${MONGODB_URI}"
huggingface_api_key = "${HUGGINGFACE_API_KEY}"
jwt_secret = "textile-inventory-jwt-secret-$(date +%s)"
s3_bucket_name = "textile-inventory-images-$(date +%s)"
EOF
```

### Step 3: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply
```

### Step 4: Get Application URL

```bash
# Get the application URL
terraform output application_url
```

## 📊 Configuration Details

### Environment Variables in Production

The application uses the following environment variables on the EC2 instance:

- `NODE_ENV=production`
- `PORT=3000`
- `AWS_REGION` - Set from Terraform variable
- `S3_BUCKET_NAME` - Set from Terraform variable
- `MONGODB_URI` - Set from Terraform variable
- `HUGGINGFACE_API_KEY` - Set from Terraform variable
- `JWT_SECRET` - Set from Terraform variable

### Security Configuration

- **VPC**: Custom VPC with public subnets in 2 AZs
- **Security Groups**: 
  - ALB: Allows HTTP (80) and HTTPS (443) from internet
  - EC2: Allows port 3000 from ALB only, SSH (22) for management
- **IAM**: EC2 instance profile with S3 access permissions
- **S3**: Bucket with CORS configuration for web access

### Application Startup

The application is configured as a systemd service:
- Service name: `textile-inventory`
- Working directory: `/opt/textile-inventory`
- Automatic restart on failure
- Logs available via journalctl

## 📊 Monitoring and Logs

### Application Logs

```bash
# SSH to EC2 instance
ssh ec2-user@<ec2-public-ip>

# View application logs
sudo journalctl -u textile-inventory -f

# Check application status
sudo systemctl status textile-inventory
```

### Health Checks
- **Load Balancer**: Checks `/api/health` endpoint every 30 seconds
- **Application**: Built-in health endpoint at `/api/health`

### Monitoring Commands

```bash
# Check EC2 instance status
aws ec2 describe-instances --filters "Name=tag:Name,Values=textile-inventory-app"

# Check load balancer health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# View application URL
terraform output application_url
```

## 🔄 Updates and Maintenance

### Deploying Code Changes

1. SSH to the EC2 instance:
```bash
ssh ec2-user@<ec2-public-ip>
```

2. Update the application:
```bash
cd /opt/textile-inventory
sudo git pull origin main
sudo npm install --production
sudo systemctl restart textile-inventory
```

### Scaling Considerations

For higher traffic, consider:
- Using an Auto Scaling Group with multiple EC2 instances
- Implementing a CI/CD pipeline for automated deployments
- Using Amazon ECS or EKS for container orchestration
- Adding CloudFront CDN for static assets

### Updating Environment Variables

1. SSH to EC2 instance
2. Edit the environment file:
```bash
sudo nano /opt/textile-inventory/.env
```
3. Restart the service:
```bash
sudo systemctl restart textile-inventory
```

## 🗑️ Cleanup

To destroy all AWS resources:

```bash
# Using the cleanup script
chmod +x scripts/destroy-ec2.sh
./scripts/destroy-ec2.sh

# Or manually with Terraform
cd infrastructure/terraform-ec2
terraform destroy
```

## 🐛 Troubleshooting

### Common Issues

1. **Application Fails to Start**
   ```bash
   # Check application logs
   sudo journalctl -u textile-inventory -f
   
   # Check environment variables
   cat /opt/textile-inventory/.env
   
   # Restart service
   sudo systemctl restart textile-inventory
   ```

2. **Health Check Failures**
   ```bash
   # Test health endpoint locally
   curl http://localhost:3000/api/health
   
   # Check if application is listening
   sudo netstat -tlnp | grep 3000
   
   # Check security groups
   aws ec2 describe-security-groups --group-ids <security-group-id>
   ```

3. **Database Connection Issues**
   ```bash
   # Test MongoDB connection
   node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(err => console.error(err));"
   ```

4. **S3 Upload Failures**
   ```bash
   # Check IAM permissions
   aws sts get-caller-identity
   
   # Test S3 access
   aws s3 ls s3://<bucket-name>
   ```

### Debugging Commands

```bash
# Check EC2 instance details
aws ec2 describe-instances --instance-ids <instance-id>

# View user data script execution
sudo cat /var/log/cloud-init-output.log

# Check system logs
sudo journalctl -xe

# Monitor resource usage
top
df -h
free -m
```

## 📈 Cost Estimation

Estimated monthly costs (us-east-1):
- **EC2 t3.small**: ~$15-20
- **Application Load Balancer**: ~$16
- **S3 Storage**: ~$5-15 (depending on image volume)
- **Data Transfer**: ~$5-15
- **CloudWatch Logs**: ~$2-5
- **Total**: ~$45-75/month

## 🔐 Security Best Practices

- ✅ Environment variables stored securely on EC2 instance
- ✅ Non-root application execution
- ✅ Least privilege IAM roles
- ✅ VPC with proper security groups
- ✅ SSH access restricted (can be further limited to specific IPs)
- ✅ Regular security updates via package manager
- ✅ S3 bucket with appropriate CORS configuration

## 🚀 Performance Optimization

- Configure Node.js clustering for multi-core usage
- Implement connection pooling for MongoDB
- Use CloudFront CDN for static assets
- Configure appropriate timeout values
- Monitor and optimize database queries
- Implement caching strategies

## 📞 Support

For issues with this deployment:
1. Check application logs: `sudo journalctl -u textile-inventory -f`
2. Review this documentation
3. Check AWS service status
4. Contact the development team

---

**Note**: This EC2 deployment provides a simpler alternative to ECS Fargate with easier debugging and maintenance while maintaining all core functionality including MongoDB Atlas integration, S3 image storage, and Hugging Face AI services.
