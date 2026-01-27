"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeFirebase = initializeFirebase;
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirebaseMessaging = getFirebaseMessaging;
var firebase_admin_1 = __importDefault(require("firebase-admin"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
/**
 * Firebase Admin SDK Configuration
 * Handles initialization and provides Firebase services
 */
var firebaseApp = null;
function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }
    try {
        // Check if service account file exists
        var serviceAccountPath = path_1.default.join(process.cwd(), 'firebase-service-account.json');
        if (!fs_1.default.existsSync(serviceAccountPath)) {
            throw new Error("Firebase service account file not found at: ".concat(serviceAccountPath, "\n") +
                'Please create this file with your Firebase Admin SDK credentials.\n' +
                'See: firebase-service-account.template.json for the required format.');
        }
        var serviceAccount = JSON.parse(fs_1.default.readFileSync(serviceAccountPath, 'utf8'));
        firebaseApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            // Optional: Add your Firebase project configuration
            databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        console.log('✅ Firebase Admin SDK initialized successfully');
        return firebaseApp;
    }
    catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error);
        throw error;
    }
}
function getFirebaseAuth() {
    if (!firebaseApp) {
        throw new Error('Firebase not initialized. Call initializeFirebase() first.');
    }
    return firebase_admin_1.default.auth(firebaseApp);
}
function getFirebaseMessaging() {
    if (!firebaseApp) {
        throw new Error('Firebase not initialized. Call initializeFirebase() first.');
    }
    return firebase_admin_1.default.messaging(firebaseApp);
}
exports.default = {
    initialize: initializeFirebase,
    getAuth: getFirebaseAuth,
    getMessaging: getFirebaseMessaging,
};
