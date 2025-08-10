#!/bin/bash


set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}🗑️  Textile Inventory Infrastructure Cleanup${NC}"
echo -e "${RED}===========================================${NC}"

read -p "$(echo -e ${YELLOW}Are you sure you want to destroy all infrastructure? This cannot be undone. [y/N]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Cleanup cancelled.${NC}"
    exit 0
fi

echo -e "${YELLOW}🚨 Starting infrastructure cleanup...${NC}"

cd infrastructure/terraform

terraform init

echo -e "${YELLOW}🗑️  Destroying Terraform-managed resources...${NC}"
terraform destroy -auto-approve

echo -e "${GREEN}✅ Infrastructure cleanup completed${NC}"

read -p "$(echo -e ${YELLOW}Do you want to delete ECR repository and images? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Cleaning up ECR repository...${NC}"
    
    AWS_REGION=${AWS_REGION:-us-east-1}
    ECR_REPOSITORY_NAME="textile-inventory-app"
    
    aws ecr batch-delete-image \
        --repository-name $ECR_REPOSITORY_NAME \
        --image-ids imageTag=latest \
        --region $AWS_REGION || true
    
    echo -e "${GREEN}✅ ECR cleanup completed${NC}"
fi

echo -e "${GREEN}🎉 All cleanup operations completed!${NC}"
