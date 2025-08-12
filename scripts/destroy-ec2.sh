#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}🗑️  AWS EC2 Infrastructure Destruction Script${NC}"

if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: Please run this script from the root of the inventory-app repository${NC}"
    exit 1
fi

cd infrastructure/terraform-ec2

if [ ! -f "terraform.tfstate" ]; then
    echo -e "${YELLOW}⚠️  No Terraform state found. Nothing to destroy.${NC}"
    exit 0
fi

echo -e "${YELLOW}📋 Planning destruction...${NC}"
terraform plan -destroy

echo -e "${RED}⚠️  WARNING: This will destroy ALL infrastructure created by Terraform!${NC}"
echo -e "${RED}❓ Are you sure you want to proceed? Type 'yes' to confirm:${NC}"
read -r response
if [[ "$response" != "yes" ]]; then
    echo -e "${YELLOW}⏹️  Destruction cancelled${NC}"
    exit 0
fi

echo -e "${RED}💥 Destroying infrastructure...${NC}"
terraform destroy -auto-approve

echo -e "${GREEN}✅ Infrastructure destroyed successfully${NC}"
echo -e "${YELLOW}💡 Remember to also clean up any manual resources if needed${NC}"
