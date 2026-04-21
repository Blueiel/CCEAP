const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;
const keyFileCandidates = ['serviceAccountKey.json', 'serviceAccountkey.json'];
const resolvedKeyFile = keyFileCandidates.find((fileName) =>
  fs.existsSync(path.join(__dirname, fileName))
);

if (!resolvedKeyFile) {
  console.error('❌ Failed to find a service account key file in scripts/.');
  console.error('   Expected one of: serviceAccountKey.json, serviceAccountkey.json');
  process.exit(1);
}

try {
  serviceAccount = require(`./${resolvedKeyFile}`);
} catch (error) {
  console.error(`❌ Failed to load scripts/${resolvedKeyFile}.`);
  console.error('   Download a valid Firebase Admin SDK key JSON and save it in scripts/.');
  console.error('   Details:', error.message);
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@scholr.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'securePassword123';
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Admin';
const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://scholr2026-default-rtdb.asia-southeast1.firebasedatabase.app';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const createAdmin = async () => {
  try {
    let user;
    try {
      user = await admin.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
      });
      console.log('✅ Auth user created:', user.uid);
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        user = await admin.auth().getUserByEmail(ADMIN_EMAIL);
        console.log('ℹ️ Auth user already exists:', user.uid);
      } else {
        throw error;
      }
    }

    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    console.log('✅ Role set to admin');

    await admin.database().ref(`users/${user.uid}`).set({
      uid: user.uid,
      email: ADMIN_EMAIL,
      fullName: ADMIN_DISPLAY_NAME,
      role: 'admin',
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });
    console.log('✅ Saved to Realtime Database');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

createAdmin();