#!/bin/bash

# Firebase Deployment Script
# This script builds and deploys the application to Firebase Hosting

set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Check if .env.production exists
if [ -f .env.production ]; then
  echo "📝 Loading environment variables from .env.production..."
  export $(cat .env.production | grep -v '^#' | xargs)
else
  echo "⚠️  Warning: .env.production not found. Make sure environment variables are set!"
  echo "   You can create .env.production from .env.local.example"
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI is not installed. Install it with: npm install -g firebase-tools"
  exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
  echo "❌ Not logged in to Firebase. Run: firebase login"
  exit 1
fi

# Build the Next.js application
echo "🔨 Building Next.js application..."
npm run build

# Check if build was successful
if [ ! -d "out" ]; then
  echo "❌ Build failed! 'out' directory not found."
  exit 1
fi

# Deploy to Firebase
echo "🌐 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌍 Your app should be live at: https://$(firebase use --quiet).web.app"
