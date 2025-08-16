// api/close-room.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length === 0) {
    const projectId   = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    initAdmin();
    const db = getFirestore();
    const auth = getAuth();

    const { roomId, idToken } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!roomId) return res.status(400).json({ error: 'roomId required' });

    // Beacon ではヘッダを付けられないため、ボディで受け取る
    if (!idToken) return res.status(401).json({ error: 'idToken required' });

    const decoded = await auth.verifyIdToken(idToken).catch(() => null);
    if (!decoded?.uid) return res.status(401).json({ error: 'invalid token' });

    const roomRef = db.doc(`rooms/${roomId}`);
    const snap = await roomRef.get();
    if (!snap.exists) return res.status(200).json({ ok: true, note: 'already removed' });

    const room = snap.data() as any;
    if (room?.hostUid !== decoded.uid) {
      return res.status(403).json({ error: 'forbidden: not room host' });
    }

    // まず閉鎖フラグ（監視側が停止できるように）
    await roomRef.set({ roomClosed: true, closedAt: FieldValue.serverTimestamp() }, { merge: true });

    // サブコレ削除（cards, seats など）
    const subCols = await roomRef.listCollections();
    for (const col of subCols) {
      const docs = await col.listDocuments();
      // バッチ分割
      for (let i = 0; i < docs.length; i += 450) {
        const batch = db.batch();
        for (const d of docs.slice(i, i + 450)) batch.delete(d);
        await batch.commit();
      }
    }

    // ルーム本体を最後に削除
    await roomRef.delete();

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[close-room] error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}