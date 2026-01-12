import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

/**
 * Firebase Admin SDK Configuration
 * Handles initialization and provides Firebase services
 */

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Check if service account file exists
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Firebase service account file not found at: ${serviceAccountPath}\n` +
        'Please create this file with your Firebase Admin SDK credentials.\n' +
        'See: firebase-service-account.template.json for the required format.'
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Optional: Add your Firebase project configuration
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.auth(firebaseApp);
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.messaging(firebaseApp);
}

export default {
  initialize: initializeFirebase,
  getAuth: getFirebaseAuth,
  getMessaging: getFirebaseMessaging,
};
