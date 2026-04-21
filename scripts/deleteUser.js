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

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://scholr2026-default-rtdb.asia-southeast1.firebasedatabase.app';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = { uid: '', email: '' };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--uid') {
      parsed.uid = (args[index + 1] || '').trim();
      index += 1;
    }
    if (arg === '--email') {
      parsed.email = (args[index + 1] || '').trim().toLowerCase();
      index += 1;
    }
  }

  return parsed;
};

const resolveUid = async ({ uid, email }) => {
  if (uid) {
    return uid;
  }

  if (email) {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord.uid;
  }

  throw new Error('Provide --uid <value> or --email <value>.');
};

const permanentlyDeleteUser = async () => {
  const params = parseArgs();

  try {
    const uid = await resolveUid(params);

    try {
      await admin.auth().deleteUser(uid);
      console.log(`✅ Deleted Auth user: ${uid}`);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        console.log(`ℹ️ Auth user already missing: ${uid}`);
      } else {
        throw error;
      }
    }

    await admin.database().ref(`users/${uid}`).remove();
    await admin.database().ref(`deletionQueue/${uid}`).remove();
    console.log(`✅ Deleted DB user/profile and queue entries for: ${uid}`);
  } catch (error) {
    console.error('❌ Failed to permanently delete user:', error?.message || error);
    process.exitCode = 1;
  }
};

permanentlyDeleteUser();