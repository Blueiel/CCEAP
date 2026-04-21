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

const db = admin.database();

const deleteAuthUserIfExists = async (uid) => {
  try {
    await admin.auth().deleteUser(uid);
    return { deleted: true, reason: 'deleted' };
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return { deleted: false, reason: 'already-missing' };
    }
    throw error;
  }
};

const processDeletionQueue = async () => {
  try {
    const queueSnapshot = await db.ref('deletionQueue').get();

    if (!queueSnapshot.exists()) {
      console.log('ℹ️ No queued deletions found.');
      return;
    }

    const queued = queueSnapshot.val() || {};
    const pendingEntries = Object.entries(queued).filter(([, value]) => value?.status === 'pending');

    if (pendingEntries.length === 0) {
      console.log('ℹ️ No pending deletion requests found.');
      return;
    }

    console.log(`ℹ️ Processing ${pendingEntries.length} pending deletion request(s)...`);

    for (const [uid, request] of pendingEntries) {
      try {
        const authResult = await deleteAuthUserIfExists(uid);
        await db.ref(`users/${uid}`).remove();

        await db.ref(`deletionQueue/${uid}`).remove();

        console.log(`✅ Deleted ${uid} (${request?.email || 'no-email'}) from Auth and users.`);
      } catch (error) {
        await db.ref(`deletionQueue/${uid}`).update({
          status: 'failed',
          processedAt: admin.database.ServerValue.TIMESTAMP,
          error: error?.message || 'Unknown error',
        });
        console.error(`❌ Failed deleting ${uid}: ${error?.message || error}`);
      }
    }

    console.log('✅ Deletion queue processing complete.');
  } catch (error) {
    console.error('❌ Unable to process deletion queue:', error?.message || error);
    process.exitCode = 1;
  }
};

processDeletionQueue();