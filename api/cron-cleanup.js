// api/cron-cleanup.js
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const projectId   = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({ project_id: projectId, client_email: clientEmail, private_key: privateKey })
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(json) });
    } else {
      throw new Error('Missing Firebase admin credentials in env vars.');
    }
  }
}

/**
 * サブコレクションを含めてルームを完全に削除する
 */
async function deleteRoomHard(db, roomId) {
  const roomRef = db.doc(`rooms/${roomId}`);

  // サブコレクションを列挙して削除
  const subCols = await roomRef.listCollections();
  for (const col of subCols) {
    const docs = await col.listDocuments();
    // Batch 削除 (Firestore の制限 500件以内)
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach(d => batch.delete(d));
      await batch.commit();
    }
  }

  // 親ドキュメントを削除
  await roomRef.delete();
}

module.exports = async (req, res) => {
  // Vercel Cron は GET リクエストで送られる
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // セキュリティチェック (Vercel Cron のシークレットヘッダーがあれば確認可能)
  // 現時点では簡易的に実行を許可
  
  try {
    initAdmin();
    const db = admin.firestore();
    const auth = admin.auth();
    const now = admin.firestore.Timestamp.now();

    console.log('[Cleanup] Starting hourly cleanup...');

    // 1. 期限切れのルームを検索 (expiresAt < now)
    const expiredRoomsSnap = await db.collection('rooms')
      .where('expiresAt', '<', now)
      .limit(100) // 一度に処理する上限を設定
      .get();

    if (expiredRoomsSnap.empty) {
      console.log('[Cleanup] No expired rooms found.');
      res.status(200).json({ ok: true, message: 'No expired rooms.' });
      return;
    }

    const deletedRoomIds = [];
    const hostUidsToCheck = new Set();

    for (const doc of expiredRoomsSnap.docs) {
      const data = doc.data();
      const roomId = doc.id;
      
      console.log(`[Cleanup] Deleting room: ${roomId}`);
      await deleteRoomHard(db, roomId);
      deletedRoomIds.push(roomId);

      // ホストが匿名ユーザーだった場合、UIDを記録
      if (data.hostIsAnonymous === true && data.hostUid) {
        hostUidsToCheck.add(data.hostUid);
      }
    }

    // 2. 匿名アカウントの掃除
    const deletedUserUids = [];
    for (const uid of hostUidsToCheck) {
      // そのUIDが他に「有効な（期限切れでない）」ルームを持っているか確認
      const otherRoomsSnap = await db.collection('rooms')
        .where('hostUid', '==', uid)
        .limit(1)
        .get();

      if (otherRoomsSnap.empty) {
        // 他にルームがなければアカウントを削除
        console.log(`[Cleanup] Deleting anonymous user: ${uid}`);
        
        try {
          // Firebase Auth から削除
          await auth.deleteUser(uid).catch(e => {
            if (e.code === 'auth/user-not-found') return; // 既にない場合は無視
            throw e;
          });

          // Firestore のユーザーデータも削除
          await db.doc(`users/${uid}`).delete();
          
          deletedUserUids.push(uid);
        } catch (err) {
          console.warn(`[Cleanup] Failed to delete user ${uid}:`, err.message);
        }
      } else {
        console.log(`[Cleanup] User ${uid} still has active rooms. Skipping account deletion.`);
      }
    }

    res.status(200).json({
      ok: true,
      deletedRooms: deletedRoomIds.length,
      deletedUsers: deletedUserUids.length,
      roomIds: deletedRoomIds,
      userUids: deletedUserUids
    });

  } catch (e) {
    console.error('[Cleanup] Error:', e);
    res.status(500).json({ error: e.message });
  }
};
