import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { exit } from 'process';

// --- Configuration ---
const email = 'bhavana.veera@saap.co.in';
const password = 'T@skui';
const name = 'Bhavana Veera';
const role = 'admin';
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
// --- End Configuration ---

async function createAdminUser() {
  try {
    // 1. Initialize Firebase Admin SDK
    const serviceAccount = JSON.parse(await readFile(pathToFileURL(serviceAccountPath)));
    
    const projectId = serviceAccount.project_id;
    if (!projectId) {
      throw new Error("Project ID not found in service account file.");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${projectId}.firebaseio.com`
    });

    const auth = admin.auth();
    const db = admin.firestore();

    console.log('Firebase Admin SDK initialized.');

    let userRecord;
    
    // 2. Check if user exists
    try {
      // Try to get the user by email
      userRecord = await auth.getUserByEmail(email);
      console.log(`User ${email} already exists with UID: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // If user doesn't exist, create a new one
        console.log(`Creating new user for email: ${email}...`);
        userRecord = await auth.createUser({
          email: email,
          password: password,
          displayName: name,
        });
        console.log('Successfully created new user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // 3. Create or update profile in Firestore
    console.log(`Creating/Updating profile document in Firestore for UID: ${userRecord.uid}...`);
    const profileRef = db.collection('profiles').doc(userRecord.uid);
    const profileData = {
      user_id: userRecord.uid,
      email: email,
      name: name,
      role: 'admin',  // Force role to be 'admin' for this script
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Use set with merge to update if exists or create if not
    await profileRef.set(profileData, { merge: true });
    console.log('Profile document updated in Firestore with admin role');

    // 4. Set custom claims for admin role
    console.log('Setting custom claims...');
    try {
      // Set custom claims - this is the source of truth for admin status
      const customClaims = { 
        role: 'admin',
        admin: true,
        updatedAt: Date.now()
      };
      
      // Revoke all refresh tokens to force re-authentication
      await auth.revokeRefreshTokens(userRecord.uid);
      
      // Set the custom claims
      await auth.setCustomUserClaims(userRecord.uid, customClaims);
      
      // Verify the claims were set
      const updatedUser = await auth.getUser(userRecord.uid);
      console.log('Updated user custom claims:', updatedUser.customClaims);
      
      // Force token refresh by updating the user
      await auth.updateUser(userRecord.uid, {
        email: email,
        emailVerified: true,
        displayName: name
      });
      
      // Update the profile to ensure it matches the claims
      await profileRef.set({
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log('Successfully set admin claims and updated user profile');
      
    } catch (error) {
      console.error('Error setting admin claims:', error);
      throw error;
    }

    console.log('Successfully created/updated admin profile in Firestore.');
    console.log('\nAdmin setup completed successfully!');
    exit(0);

  } catch (error) {
    console.error('An error occurred:');
    if (error.code === 'auth/email-already-exists') {
      console.error('The email address is already in use by another account.');
    } else if (error.code === 'auth/user-not-found') {
      console.error('The specified user was not found.');
    } else if (error.code === 'ENOENT') {
      console.error(`Service account key file not found at '${serviceAccountPath}'.`);
      console.error('Please download it from your Firebase project settings and place it in the root directory.');
    } else {
      console.error(error);
    }
    exit(1);
  }
}

// Run the function
createAdminUser();
