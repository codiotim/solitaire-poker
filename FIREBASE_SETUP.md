# Firebase Setup Guide

Your Firebase config is already set up! Just need to enable Firestore:

## Set Up Firestore Database

1. In your Firebase console left sidebar, find and click **"Build"** or **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"**
4. Select a location (choose closest to your users, e.g., us-central)
5. Click **"Enable"**

## Configure Security Rules

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

3. Click **"Publish"**

## That's it!

Your `firebase-config.js` is already configured. Once you publish the security rules above, the leaderboard will work!

## Test It

Open the live site: https://codiotim.github.io/solitaire-poker/

- Play a complete game (win all 4 rounds)
- Enter your name and submit your score
- Click the 🏆 Leaderboard button to see all scores

**Note:** Your Firebase API key is public in the code. This is normal for web apps. The security rules protect your database from abuse.
