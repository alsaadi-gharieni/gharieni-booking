# Firebase Deployment Guide

This guide explains how to deploy the Gharieni Booking System to Firebase Hosting.

## Prerequisites

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

## Setup Steps

### 1. Initialize Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Firestore Database
4. Get your Firebase configuration from Project Settings > General > Your apps

### 2. Configure Environment Variables

#### For Local Development:

1. Copy the example environment file:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and add your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

#### For Production Deployment:

**Option 1: Using Firebase Hosting Environment Variables (Recommended)**

Since Firebase Hosting serves static files, environment variables need to be set at build time. You can:

1. Set environment variables in your CI/CD pipeline or local machine before building
2. Use Firebase Functions if you need server-side environment variables

**Option 2: Build with Environment Variables (Recommended)**

Create a `.env.local` file in your project root with your Firebase configuration:

```bash
# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EOF
```

Then use the deployment script:

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

Or manually:

```bash
# Set environment variables (Linux/Mac)
export NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project_id.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project_id.appspot.com"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"
export NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# Build the project
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

**Option 3: Using .env.production file**

Create a `.env.production` file with your production values, and Next.js will use it during build:

```bash
cp .env.local.example .env.production
# Edit .env.production with production values
npm run build
firebase deploy --only hosting
```

### 3. Configure Firebase Project

1. Update `.firebaserc` with your Firebase project ID:
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

### 4. Set Up Firestore Security Rules

In Firebase Console, go to Firestore Database > Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to events
    match /events/{eventId} {
      allow read: if true;
      allow write: if false; // Only allow writes from admin (you may want to add authentication)
    }
    
    // Allow read/write access to bookings
    match /bookings/{bookingId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false; // Only allow creates, not updates/deletes
    }
  }
}
```

**Note**: For production, you should add proper authentication. These rules allow public access for simplicity.

### 5. Deploy

1. Build the Next.js application:
```bash
npm run build
```

2. Deploy to Firebase Hosting:
```bash
firebase deploy --only hosting
```

Or deploy everything (hosting + Firestore rules):
```bash
firebase deploy
```

## Deployment Script

You can create a deployment script to automate the process:

Create `deploy.sh`:
```bash
#!/bin/bash

# Load environment variables from .env.production
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
fi

# Build the project
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run it:
```bash
./deploy.sh
```

## CI/CD Integration

### GitHub Actions Setup

The project includes GitHub Actions workflows for automatic deployment:

1. **`.github/workflows/firebase-hosting-merge.yml`** - Deploys to production on merge to `main`
2. **`.github/workflows/firebase-hosting-pull-request.yml`** - Creates preview deployments for pull requests

#### Setting Up GitHub Secrets

For the workflows to work, you need to add the following secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add each of these:

   - `NEXT_PUBLIC_FIREBASE_API_KEY` - Your Firebase API Key
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Your Firebase Auth Domain (e.g., `project-id.firebaseapp.com`)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase Project ID
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Your Firebase Storage Bucket (e.g., `project-id.appspot.com`)
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase Messaging Sender ID
   - `NEXT_PUBLIC_FIREBASE_APP_ID` - Your Firebase App ID
   - `FIREBASE_SERVICE_ACCOUNT_GHARIENI_BOOKING` - Your Firebase Service Account JSON (already set by Firebase CLI)

#### Getting Firebase Configuration Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) > **General** tab
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** > **Web** (</> icon)
6. Copy the configuration values from the `firebaseConfig` object

#### Workflow Details

The workflows are already configured and will:
- Install dependencies
- Build the Next.js app with environment variables from GitHub Secrets
- Deploy to Firebase Hosting automatically

**Note**: The workflows use the secrets you configure in GitHub, so make sure all required secrets are set before pushing to trigger a deployment.

## Environment Variables Management

### Local Development
- Use `.env.local` (gitignored)
- Copy from `.env.local.example`

### Production
- Set environment variables before building
- Use `.env.production` file
- Or use CI/CD secrets (GitHub Actions, etc.)

### Important Notes

1. **NEXT_PUBLIC_ prefix**: All environment variables used in the browser must start with `NEXT_PUBLIC_`
2. **Build-time variables**: These variables are embedded at build time, not runtime
3. **Security**: Never commit `.env.local` or `.env.production` with real credentials to git
4. **Firebase Hosting**: Serves static files, so all environment variables must be available at build time

## Troubleshooting

### Environment variables not working in production

1. Make sure variables start with `NEXT_PUBLIC_`
2. Rebuild the application after changing environment variables
3. Check that variables are set before running `npm run build`

### Build fails

1. Check that all required environment variables are set
2. Verify Firebase configuration values are correct
3. Check Firestore rules are properly configured

### Deployment fails

1. Verify Firebase CLI is installed and logged in: `firebase login`
2. Check `.firebaserc` has the correct project ID
3. Ensure `firebase.json` is properly configured

## Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
