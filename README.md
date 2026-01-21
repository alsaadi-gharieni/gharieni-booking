# Gharieni Booking System

A simple event booking system built with Next.js and Firestore.

## Features

- **Admin Dashboard**: Create events with title, description, date, and time slots
- **Public Booking**: Shareable links for users to book time slots
- **Booking Management**: View all bookings and availability for each event
- **Real-time Availability**: See which slots are available or booked

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Firestore Database
4. Get your Firebase configuration from Project Settings

### 3. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Set up Firestore Security Rules

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

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Note**: This project uses static export (`output: 'export'`) for Firebase Hosting. During development, `npm run dev` works normally. To preview the built static site locally, use:

```bash
npm run build
npm run preview
```

## Usage

### Admin Flow

1. Navigate to `/admin` to access the admin dashboard
2. Click "Create New Event" to create an event
3. Fill in the event details:
   - Title and description
   - Event date
   - Start and end times
   - Slot duration (15, 30, 45, or 60 minutes)
   - Optional company logo URL
4. Click "Create Event"
5. Copy the shareable link from the event card
6. View bookings and availability in the dashboard

### User Flow

1. Click on the shareable link (format: `/book?eventId=abc123`)
2. View event details and company logo
3. Select a date and available time slot
4. Fill in name, email, phone number, and optional note
5. Confirm booking

## Project Structure

```
├── app/
│   ├── admin/           # Admin dashboard and event creation
│   ├── book/            # Public booking pages
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── lib/
│   ├── firebase.ts      # Firebase initialization
│   └── firestore.ts     # Firestore operations
└── types/
    └── index.ts         # TypeScript type definitions
```

## Technologies Used

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Firebase Firestore**: Database
- **React Hot Toast**: Notifications
- **date-fns**: Date formatting

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Firebase Hosting.

Quick deployment:
```bash
# Set environment variables (or use .env.production)
export NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
# ... set other variables

# Build and deploy
npm run build
firebase deploy --only hosting
```

## Future Enhancements

- Email notifications for bookings
- Calendar integration
- Export bookings to CSV
- Email reminders for upcoming bookings
