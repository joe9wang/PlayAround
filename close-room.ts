// /api/close-room.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Vercel の環境変数にサービスアカウントJSONをそのまま文字列で入れておく
// 例: FIREBASE_SERVICE_ACCOUNT_KEY = { "type": "...", "project_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", "client_email": "...", ... }
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)),
  });
}
const db = admin.firestore();

async function cleanupAndDeleteRoom(roomId: string) {
  const cardsSnap = await db.collection(`rooms/${roomId}/cards`).get();
  const seatsSnap = await db.collection(`rooms/${roomId}/seats`).get();

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = db.batch(), count = 0;
  const del = (ref: FirebaseFirestore.DocumentReference) => {
    batch.delete(ref); count++;
    if (count >= 450) { batches.push(batch); batch = db.batch(); count = 0; }
  };

  cardsSnap.forEach(d => del(d.ref));
  seatsSnap.forEach(d => del(d.ref));
  if (count) batches.push(batch);
  for (const b of batches) await b.commit();

  // 復活防止のフラグ（通知にも使える）
  await db.doc(`rooms/${roomId}`).set({ roomClosed: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  // 親 doc 削除（失敗したら tombstone + TTL）
  await db.doc(`rooms/${roomId}`).delete().catch(async (e) => {
    console.warn('parent delete failed', e);
    await db.doc(`rooms/${roomId}`).set({
      roomClosed: true, tombstone: true,
      ttl: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600_000)) // 1h
    }, { merge: true });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { roomId, token } = req.body || {};
    if (!roomId || !token) return res.status(400).json({ error: 'roomId/token required' });

    // IDトークン検証
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // ホスト確認
    const roomRef = db.doc(`rooms/${roomId}`);
    const snap = await roomRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'room not found' });
    const data = snap.data()!;
    if (data.hostUid !== uid) return res.status(403).json({ error: 'forbidden: not host' });

    // 削除実行
    await cleanupAndDeleteRoom(roomId);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'internal' });
  }
}