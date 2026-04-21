const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { onValueWritten } = require('firebase-functions/v2/database');

initializeApp();

exports.processDeletionQueue = onValueWritten('/deletionQueue/{uid}', async (event) => {
  const uid = event.params.uid;
  const db = getDatabase();
  const before = event.data.before.exists() ? event.data.before.val() : null;
  const after = event.data.after.exists() ? event.data.after.val() : null;

  if (!after) {
    return;
  }

  const beforeStatus = (before?.status || '').toString();
  const afterStatus = (after?.status || '').toString();

  if (afterStatus !== 'pending' || beforeStatus === 'pending' || beforeStatus === 'processing') {
    return;
  }

  try {
    await event.data.after.ref.update({
      status: 'processing',
      startedAt: Date.now(),
    });

    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    await db.ref(`users/${uid}`).remove();

    await event.data.after.ref.remove();
  } catch (error) {
    await event.data.after.ref.update({
      status: 'failed',
      failedAt: Date.now(),
      error: error?.message || 'Unknown error',
    });
    throw error;
  }
});
