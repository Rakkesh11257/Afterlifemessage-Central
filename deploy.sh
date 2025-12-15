#!/bin/bash

# Deployment script for AfterLife Message Platform
# Usage: ./deploy.sh [dev|prod] [frontend|backend|full]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
}

# Check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
}

# Validate environment
validate_environment() {
    local env=$1
    if [[ "$env" != "dev" && "$env" != "prod" ]]; then
        print_error "Invalid environment. Use 'dev' or 'prod'"
        echo "Usage: ./deploy.sh [dev|prod] [frontend|backend|full]"
        exit 1
    fi
}

# Validate component
validate_component() {
    local component=$1
    if [[ "$component" != "frontend" && "$component" != "backend" && "$component" != "full" ]]; then
        print_error "Invalid component. Use 'frontend', 'backend', or 'full'"
        echo "Usage: ./deploy.sh [dev|prod] [frontend|backend|full]"
        exit 1
    fi
}

# Deploy backend
deploy_backend() {
    local env=$1
    print_status "Deploying backend to $env environment..."
    
    cd backend
    if serverless deploy --stage $env; then
        print_success "Backend deployed successfully to $env"
    else
        print_error "Backend deployment failed"
        exit 1
    fi
    cd ..
}

# Deploy frontend
deploy_frontend() {
    local env=$1
    print_status "Deploying frontend to $env environment..."
    
    # Build for the specific environment
    if [[ "$env" == "dev" ]]; then
        npm run build:dev
    else
        npm run build:prod
    fi
    
    # Deploy to S3
    local bucket="afterlifemessage-$env"
    if aws s3 sync build/ s3://$bucket --delete; then
        print_success "Frontend deployed successfully to $env"
        print_status "Website URL: http://$bucket.s3-website.ap-south-1.amazonaws.com"
    else
        print_error "Frontend deployment failed"
        exit 1
    fi
}

# Main deployment function
deploy() {
    local env=$1
    local component=$2
    
    print_status "Starting deployment to $env environment..."
    
    case $component in
        "backend")
            deploy_backend $env
            ;;
        "frontend")
            deploy_frontend $env
            ;;
        "full")
            deploy_backend $env
            deploy_frontend $env
            ;;
    esac
    
    print_success "Deployment completed successfully!"
}

# Main script
main() {
    # Check arguments
    if [[ $# -ne 2 ]]; then
        print_error "Invalid number of arguments"
        echo "Usage: ./deploy.sh [dev|prod] [frontend|backend|full]"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh dev frontend    # Deploy frontend to development"
        echo "  ./deploy.sh prod backend    # Deploy backend to production"
        echo "  ./deploy.sh dev full        # Deploy both to development"
        echo "  ./deploy.sh prod full       # Deploy both to production"
        exit 1
    fi
    
    local env=$1
    local component=$2
    
    # Validate inputs
    validate_environment $env
    validate_component $component
    
    # Check prerequisites
    check_aws_cli
    check_aws_credentials
    
    # Confirm deployment
    if [[ "$env" == "prod" ]]; then
        echo ""
        print_warning "You are about to deploy to PRODUCTION environment!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Start deployment
    deploy $env $component
}

# Run main function with all arguments
main "$@" 