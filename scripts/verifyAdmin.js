import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exit } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const email = 'bhavana@gmail.com';

async function verifyAndFixAdmin() {
  try {
    // Check if service account is provided via environment variable
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      });
    }

    const auth = getAuth();
    const db = getFirestore();

    // 1. Get the user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log('User found:', userRecord.uid);

    // 2. Update the user's profile in Firestore
    const profileRef = db.collection('profiles').doc(userRecord.uid);
    await profileRef.set(
      {
        role: 'admin',
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    console.log('Updated profile with admin role');

    // 3. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      admin: true
    });
    console.log('Set custom claims');

    // 4. Verify the claims were set
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('Updated user custom claims:', updatedUser.customClaims);

    // 5. Force token refresh
    await auth.revokeRefreshTokens(userRecord.uid);
    console.log('Revoked refresh tokens to force re-authentication');

    console.log('\nAdmin verification and update completed successfully!');
    exit(0);
  } catch (error) {
    console.error('Error:', error);
    exit(1);
  }
}

verifyAndFixAdmin();
