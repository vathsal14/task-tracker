import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

async function fixAdminRole() {
  try {
    // Initialize Firebase Admin SDK
    const serviceAccount = JSON.parse(await readFile('./serviceAccountKey.json'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    const auth = admin.auth();
    const db = admin.firestore();

    // Find the admin user by email
    const adminEmail = 'bhavana@gmail.com';
    const user = await auth.getUserByEmail(adminEmail);
    
    console.log(`Found user: ${user.email} (${user.uid})`);

    // Set custom claims
    const customClaims = {
      role: 'admin',
      admin: true,
      updatedAt: Date.now()
    };

    console.log('Setting custom claims:', customClaims);
    await auth.setCustomUserClaims(user.uid, customClaims);

    // Update the profile in Firestore
    const profileRef = db.collection('profiles').doc(user.uid);
    await profileRef.set({
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Admin role and claims have been updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing admin role:', error);
    process.exit(1);
  }
}

fixAdminRole();
