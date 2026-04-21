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
  const parsed = { uid: '', email: '', password: '' };

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
    if (arg === '--password') {
      parsed.password = (args[index + 1] || '').trim();
      index += 1;
    }
  }

  return parsed;
};

const generatePassword = () => {
  const suffix = Math.random().toString(36).slice(-6);
  return `Scholr@${suffix}9!`;
};

const resolveUser = async ({ uid, email }) => {
  if (uid) {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  }

  if (email) {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord;
  }

  throw new Error('Provide --uid <value> or --email <value>.');
};

const resetPassword = async () => {
  const params = parseArgs();

  try {
    const userRecord = await resolveUser(params);
    const nextPassword = params.password || generatePassword();

    if (nextPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    await admin.auth().updateUser(userRecord.uid, {
      password: nextPassword,
    });

    console.log('✅ Password reset successful.');
    console.log(`UID: ${userRecord.uid}`);
    console.log(`Email: ${userRecord.email || 'N/A'}`);
    console.log(`Temporary Password: ${nextPassword}`);
    console.log('ℹ️ Ask the user to log in and change this password immediately.');
  } catch (error) {
    console.error('❌ Failed to reset password:', error?.message || error);
    process.exitCode = 1;
  }
};

resetPassword();
