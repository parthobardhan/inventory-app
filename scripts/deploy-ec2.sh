#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AWS EC2 Deployment for Textile Inventory App${NC}"

if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: Please run this script from the root of the inventory-app repository${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Checking environment variables...${NC}"
required_vars=("AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "MONGODB_URI" "HUGGINGFACE_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    echo -e "${YELLOW}💡 Please set these variables and try again:${NC}"
    echo "export AWS_ACCESS_KEY_ID=your_access_key"
    echo "export AWS_SECRET_ACCESS_KEY=your_secret_key"
    echo "export MONGODB_URI=your_mongodb_uri"
    echo "export HUGGINGFACE_API_KEY=your_huggingface_key"
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"

cd infrastructure/terraform-ec2

if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}📝 Creating terraform.tfvars from environment variables...${NC}"
    cat > terraform.tfvars << EOF
aws_region = "us-east-1"
instance_type = "t3.small"
mongodb_uri = "${MONGODB_URI}"
huggingface_api_key = "${HUGGINGFACE_API_KEY}"
jwt_secret = "textile-inventory-jwt-secret-$(date +%s)"
s3_bucket_name = "textile-inventory-images-$(date +%s)"
EOF
    echo -e "${GREEN}✅ Created terraform.tfvars${NC}"
fi

echo -e "${YELLOW}🔧 Initializing Terraform...${NC}"
terraform init

echo -e "${YELLOW}🔍 Validating Terraform configuration...${NC}"
terraform validate

echo -e "${YELLOW}📋 Planning Terraform deployment...${NC}"
terraform plan -out=tfplan

echo -e "${YELLOW}❓ Do you want to proceed with the deployment? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
    exit 0
fi

echo -e "${GREEN}🚀 Deploying infrastructure...${NC}"
terraform apply tfplan

echo -e "${GREEN}📊 Deployment completed! Getting outputs...${NC}"
APPLICATION_URL=$(terraform output -raw application_url)
LOAD_BALANCER_DNS=$(terraform output -raw load_balancer_dns)
EC2_PUBLIC_IP=$(terraform output -raw ec2_public_ip)
S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name)

echo -e "${GREEN}🎉 Deployment Summary:${NC}"
echo -e "📱 Application URL: ${GREEN}${APPLICATION_URL}${NC}"
echo -e "🌐 Load Balancer DNS: ${LOAD_BALANCER_DNS}"
echo -e "🖥️  EC2 Public IP: ${EC2_PUBLIC_IP}"
echo -e "🪣 S3 Bucket: ${S3_BUCKET_NAME}"

echo -e "${YELLOW}⏳ Waiting for application to start (this may take 2-3 minutes)...${NC}"
sleep 180

echo -e "${YELLOW}🏥 Performing health check...${NC}"
for i in {1..10}; do
    if curl -s "${APPLICATION_URL}/api/health" > /dev/null; then
        echo -e "${GREEN}✅ Application is healthy and responding!${NC}"
        echo -e "${GREEN}🌟 You can now access your application at: ${APPLICATION_URL}${NC}"
        exit 0
    else
        echo -e "${YELLOW}⏳ Attempt $i/10: Application not ready yet, waiting 30 seconds...${NC}"
        sleep 30
    fi
done

echo -e "${RED}⚠️  Health check failed after 10 attempts${NC}"
echo -e "${YELLOW}💡 The application might still be starting up. You can:${NC}"
echo -e "   1. Check the application manually at: ${APPLICATION_URL}"
echo -e "   2. SSH to the EC2 instance: ssh ec2-user@${EC2_PUBLIC_IP}"
echo -e "   3. Check application logs: sudo journalctl -u textile-inventory -f"

exit 1
