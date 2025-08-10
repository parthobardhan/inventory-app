#!/bin/bash


set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY_NAME="textile-inventory-app"
IMAGE_TAG=${IMAGE_TAG:-latest}

echo -e "${GREEN}🚀 Starting Textile Inventory App Deployment${NC}"

check_env_vars() {
    echo -e "${YELLOW}📋 Checking environment variables...${NC}"
    
    required_vars=("AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "MONGODB_URI" "HUGGINGFACE_API_KEY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -ne 0 ]]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo -e "${YELLOW}Please set these variables before running the deployment.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
}

get_aws_account_id() {
    echo -e "${YELLOW}🔍 Getting AWS account ID...${NC}"
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [[ -z "$AWS_ACCOUNT_ID" ]]; then
        echo -e "${RED}❌ Failed to get AWS account ID. Check your AWS credentials.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS Account ID: $AWS_ACCOUNT_ID${NC}"
}

ecr_login() {
    echo -e "${YELLOW}🔐 Logging in to Amazon ECR...${NC}"
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    echo -e "${GREEN}✅ Successfully logged in to ECR${NC}"
}

build_image() {
    echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
    docker build -t $ECR_REPOSITORY_NAME:$IMAGE_TAG .
    
    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG"
    docker tag $ECR_REPOSITORY_NAME:$IMAGE_TAG $ECR_URI
    
    echo -e "${GREEN}✅ Docker image built and tagged: $ECR_URI${NC}"
}

push_image() {
    echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
    docker push $ECR_URI
    echo -e "${GREEN}✅ Image pushed to ECR successfully${NC}"
}

deploy_infrastructure() {
    echo -e "${YELLOW}🏗️  Deploying infrastructure with Terraform...${NC}"
    
    cd infrastructure/terraform
    
    terraform init
    
    terraform plan \
        -var="mongodb_uri=$MONGODB_URI" \
        -var="huggingface_api_key=$HUGGINGFACE_API_KEY" \
        -var="aws_region=$AWS_REGION"
    
    echo -e "${YELLOW}🚀 Applying Terraform configuration...${NC}"
    terraform apply -auto-approve \
        -var="mongodb_uri=$MONGODB_URI" \
        -var="huggingface_api_key=$HUGGINGFACE_API_KEY" \
        -var="aws_region=$AWS_REGION"
    
    echo -e "${GREEN}📋 Deployment completed! Getting outputs...${NC}"
    APPLICATION_URL=$(terraform output -raw application_url)
    LOAD_BALANCER_DNS=$(terraform output -raw load_balancer_dns)
    
    cd ../..
    
    echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
    echo -e "${GREEN}🌐 Application URL: $APPLICATION_URL${NC}"
    echo -e "${GREEN}🔗 Load Balancer DNS: $LOAD_BALANCER_DNS${NC}"
}

update_service() {
    echo -e "${YELLOW}🔄 Updating ECS service...${NC}"
    
    aws ecs update-service \
        --cluster textile-inventory-cluster \
        --service textile-inventory-service \
        --force-new-deployment \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ ECS service update initiated${NC}"
    
    echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
    aws ecs wait services-stable \
        --cluster textile-inventory-cluster \
        --services textile-inventory-service \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ Deployment completed successfully${NC}"
}

health_check() {
    echo -e "${YELLOW}🏥 Performing health check...${NC}"
    
    if [[ -n "$APPLICATION_URL" ]]; then
        sleep 30
        
        if curl -f "$APPLICATION_URL/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed, but deployment may still be starting${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Application URL not available for health check${NC}"
    fi
}

main() {
    echo -e "${GREEN}🎯 Textile Inventory Management System - AWS Deployment${NC}"
    echo -e "${GREEN}=================================================${NC}"
    
    check_env_vars
    get_aws_account_id
    ecr_login
    build_image
    push_image
    deploy_infrastructure
    update_service
    health_check
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Your application is available at: $APPLICATION_URL${NC}"
    echo -e "${GREEN}📊 Monitor logs in CloudWatch: /ecs/textile-inventory${NC}"
}

main "$@"
