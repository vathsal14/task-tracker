const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// --- Configuration ---
const email = 'bhavana@gmail.com';
const password = '123321';
const name = 'Bhavana';
const role = 'admin';
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
// --- End Configuration ---

async function createAdmin() {
  try {
    // 1. Initialize Firebase Admin SDK
    const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
    
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

    // 2. Create user in Firebase Authentication
    console.log(`Creating user for email: ${email}...`);
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
    });
    console.log('Successfully created new user:', userRecord.uid);

    // 3. Create profile in Firestore
    console.log(`Creating profile document in Firestore for UID: ${userRecord.uid}...`);
    const profileRef = db.collection('profiles').doc(userRecord.uid);
    await profileRef.set({
      user_id: userRecord.uid,
      email: email,
      name: name,
      role: role,
    });

    console.log('Successfully created admin profile in Firestore.');
    console.log('\nAdmin user created successfully!');
    process.exit(0);

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.error('Error: The email address is already in use by another account.');
    } else if (error.code === 'ENOENT') {
      console.error(`Error: Service account key file not found at '${serviceAccountPath}'.`);
      console.error('Please download it from your Firebase project settings and place it in the root directory.');
    } else {
      console.error('An unexpected error occurred:');
      console.error(error);
    }
    process.exit(1);
  }
}

createAdmin();
