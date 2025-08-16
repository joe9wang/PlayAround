// api/close-room.js
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length === 0) {
    // どちらか一方の方式でOK。A: 分割3変数 / B: JSON一括
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

async function deleteRoomHard(db, roomId) {
  const roomRef = db.doc(`rooms/${roomId}`);

  // 先に閉鎖フラグ
  await roomRef.set({ roomClosed: true, closedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  // サブコレ削除（cards, seats など）
  const subCols = await roomRef.listCollections();
  for (const col of subCols) {
    const docs = await col.listDocuments();
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 450)) batch.delete(d);
      await batch.commit();
    }
  }

  // 親 doc を最後に削除
  await roomRef.delete();
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
    const { roomId, idToken } = body;
    if (!roomId) { res.status(400).json({ error: 'roomId required' }); return; }
    if (!idToken) { res.status(401).json({ error: 'idToken required' }); return; }

    const decoded = await auth.verifyIdToken(idToken).catch(() => null);
    if (!decoded || !decoded.uid) { res.status(401).json({ error: 'invalid token' }); return; }

    const roomRef = db.doc(`rooms/${roomId}`);
    const snap = await roomRef.get();
    if (!snap.exists) { res.status(200).json({ ok: true, note: 'already removed' }); return; }

    const data = snap.data() || {};
    if (data.hostUid !== decoded.uid) {
      res.status(403).json({ error: 'forbidden: not room host' });
      return;
    }

    await deleteRoomHard(db, roomId);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[close-room]', e);
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};