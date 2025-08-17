// api/takeover-room.js
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          project_id: process.env.FIREBASE_PROJECT_ID,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    } else {
      throw new Error('Missing Firebase admin credentials.');
    }
  }
}

const SEAT_STALE_MS = 60_000; // 既存のSEAT_STALE_MSに合わせる（必要に応じて調整）

async function isSomeoneAlive(db, roomId) {
  const seats = [1, 2, 3, 4];
  for (const n of seats) {
    const ref = db.doc(`rooms/${roomId}/seats/${n}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const d = snap.data() || {};
    const hb = d.heartbeatAt && d.heartbeatAt.toMillis ? d.heartbeatAt.toMillis() : 0;
    const alive = !!d.claimedByUid && (Date.now() - hb) <= SEAT_STALE_MS;
    if (alive) return true;
  }
  return false;
}


// --- 追加：サブコレを完全初期化するユーティリティ ---
async function deleteCollection(db, collPath, pageSize = 450) {
  const collRef = db.collection(collPath);
  while (true) {
    const snap = await collRef.limit(pageSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < pageSize) break;
  }
}

async function resetSeatsAndCards(db, roomId) {
  // 1) seats / cards を全削除
  await deleteCollection(db, `rooms/${roomId}/seats`);
  await deleteCollection(db, `rooms/${roomId}/cards`);

  // 2) seats を4席ぶん作り直す（最小項目：必要に応じて既存スキーマに合わせて増やしてOK）
  const batch = db.batch();
  for (const n of [1,2,3,4]) {
    const ref = db.doc(`rooms/${roomId}/seats/${n}`);
    batch.set(ref, {
      claimedByUid: null,
      heartbeatAt: null,
      // 必要なら初期表示用の追加フィールドをここに
    }, { merge: false });
  }
  await batch.commit();
}




module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  try {
    initAdmin();
    const db = admin.firestore();
    const auth = admin.auth();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { roomId, idToken } = body;
    if (!roomId) { res.status(400).json({ error: 'roomId required' }); return; }
    if (!idToken) { res.status(401).json({ error: 'idToken required' }); return; }

    const decoded = await auth.verifyIdToken(idToken).catch(() => null);
    if (!decoded?.uid) { res.status(401).json({ error: 'invalid token' }); return; }
    const uid = decoded.uid;

    const roomRef = db.doc(`rooms/${roomId}`);
    const roomSnap = await roomRef.get();

    // すでに存在しないなら、新規作成として初期化
    if (!roomSnap.exists) {
      await roomRef.set({
        hostUid: uid,
        hostSeat: null,
        roomClosed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      await resetSeatsAndCards(db, roomId);
      res.status(200).json({ ok: true, created: true });
      return;
    }

    const room = roomSnap.data() || {};
    // すでに自分がホストならOK
    if (room.hostUid === uid) {
      res.status(200).json({ ok: true, alreadyHost: true });
      return;
    }

    // 他人のホストでも「誰も生きていなければ」乗っ取り許可
    const alive = await isSomeoneAlive(db, roomId);
    if (alive) { res.status(403).json({ error: 'room still active' }); return; }

    // 乗っ取り：ホスト交代 + seats/cards を毎回初期化
    await roomRef.set({
      hostUid: uid,
      hostSeat: null,
      roomClosed: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await resetSeatsAndCards(db, roomId);

    res.status(200).json({ ok: true, takeover: true, reset: true });
  } catch (e) {
    console.error('[takeover-room]', e);
    res.status(500).json({ error: e?.message || String(e) });
  }
};
