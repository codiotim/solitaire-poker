# Firebase Setup Guide

Follow these steps to enable the global leaderboard:

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it "solitaire-poker" (or anything you like)
4. Disable Google Analytics (optional)
5. Click "Create project"

## 2. Set Up Firestore Database

1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location (choose closest to your users)
5. Click "Enable"

## 3. Configure Security Rules

1. In Firestore, go to the "Rules" tab
2. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{document} {
      allow read: if true;
      allow write: if request.resource.data.name is string 
                   && request.resource.data.name.size() <= 20
                   && request.resource.data.score is number
                   && request.resource.data.score >= 0;
    }
  }
}
```

3. Click "Publish"

## 4. Get Your Firebase Config

1. Click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon (</>) to add a web app
5. Register app with nickname "solitaire-poker-web"
6. Copy the `firebaseConfig` object

## 5. Update firebase-config.js

Replace the placeholder values in `firebase-config.js` with your actual Firebase config values.

## 6. Test Locally

Open `index.html` in your browser and test:
- Play a complete game
- Submit your score with a name
- View the leaderboard

## 7. Deploy

Commit and push your changes to GitHub. GitHub Pages will automatically deploy the updated version.

**Important:** Your Firebase API key will be public (visible in the source code). This is normal for web apps. The security rules protect your database from abuse.
