#!/bin/bash

# Deployment script for Firebase Hosting
# This script ensures environment variables are set before building

echo "🚀 Starting deployment process..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your Firebase configuration:"
    echo ""
    echo "NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key"
    echo "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain"
    echo "NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id"
    echo "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket"
    echo "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id"
    echo "NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id"
    exit 1
fi

# Load environment variables from .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Verify required variables are set
REQUIRED_VARS=(
    "NEXT_PUBLIC_FIREBASE_API_KEY"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    "NEXT_PUBLIC_FIREBASE_APP_ID"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '   %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

echo "✅ Environment variables loaded"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf .next out

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Firebase
echo "🚀 Deploying to Firebase..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed!"
    exit 1
fi
