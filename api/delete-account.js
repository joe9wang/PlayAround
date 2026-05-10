// api/delete-account.js
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const projectId   = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert({ project_id: projectId, client_email: clientEmail, private_key: privateKey }) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(json) });
    } else {
      throw new Error('Missing Firebase admin credentials in env vars.');
    }
  }
}

async function deleteRecursive(docRef) {
  const subCols = await docRef.listCollections();
  for (const col of subCols) {
    const docs = await col.listDocuments();
    // Batch delete in chunks of 450
    for (let i = 0; i < docs.length; i += 450) {
      const batch = admin.firestore().batch();
      docs.slice(i, i + 450).forEach(d => batch.delete(d));
      await batch.commit();
    }
  }
  await docRef.delete();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    initAdmin();
    const db = admin.firestore();
    const auth = admin.auth();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { idToken } = body;

    if (!idToken) {
      res.status(401).json({ error: 'idToken required' });
      return;
    }

    // Verify token
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    console.log(`[delete-account] Starting deletion for UID: ${uid}`);

    // 1. Delete rooms hosted by user
    const roomsSnap = await db.collection('rooms').where('hostUid', '==', uid).get();
    for (const roomDoc of roomsSnap.docs) {
      console.log(`[delete-account] Deleting room: ${roomDoc.id}`);
      await deleteRecursive(roomDoc.ref);
    }

    // 2. Delete save slots (1-10)
    for (let slot = 1; slot <= 10; slot++) {
      const slotRef = db.doc(`users/${uid}/saves/slot${slot}`);
      const slotSnap = await slotRef.get();
      if (slotSnap.exists) {
        console.log(`[delete-account] Deleting slot: ${slot}`);
        await deleteRecursive(slotRef);
      }
    }

    // 3. Delete user document
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      console.log(`[delete-account] Deleting user doc: ${uid}`);
      await deleteRecursive(userRef);
    }

    // 4. Delete Auth user
    await auth.deleteUser(uid);
    console.log(`[delete-account] Auth user deleted: ${uid}`);

    res.status(200).json({ ok: true, message: 'Account and all data deleted successfully.' });
  } catch (e) {
    console.error('[delete-account] FATAL ERROR:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
};
