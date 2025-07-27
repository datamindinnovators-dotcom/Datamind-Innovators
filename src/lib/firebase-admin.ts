
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { seedInitialTextbooks } from './textbook-actions';

// This file is intended for server-side use with the Firebase Admin SDK.

// IMPORTANT: To make this work, you need to set up a service account and
// environment variables.
// 1. Go to your Firebase project settings -> Service accounts.
// 2. Click "Generate new private key" and save the JSON file.
// 3. DO NOT commit this file to your repository.
// 4. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path
//    of your downloaded service account key file.
//
// OR, you can set the individual environment variables:
// FIREBASE_PROJECT_ID
// FIREBASE_CLIENT_EMAIL
// FIREBASE_PRIVATE_KEY

try {
    if (!admin.apps.length) {
        const initializeAndSeed = () => {
            // Seed data after initialization
             seedInitialTextbooks();
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
             admin.initializeApp({
                credential: admin.credential.applicationDefault(),
             });
             initializeAndSeed();
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
             initializeAndSeed();
        } else {
             console.warn("Firebase Admin SDK not initialized. Missing credentials.");
        }
    }
} catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
}

const db = admin.apps.length ? getFirestore() : null;

// Storage is no longer needed as we are storing images as base64 in Firestore.
export { db };
