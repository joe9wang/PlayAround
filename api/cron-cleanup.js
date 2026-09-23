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
    const nowMs = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    console.log('[Cleanup] Starting cleanup job...');

    // 1. 期限切れのルームを検索 (expiresAt < now) して削除
    const expiredRoomsSnap = await db.collection('rooms')
      .where('expiresAt', '<', now)
      .limit(100)
      .get();

    const deletedRoomIds = [];
    if (!expiredRoomsSnap.empty) {
      for (const doc of expiredRoomsSnap.docs) {
        const roomId = doc.id;
        console.log(`[Cleanup] Deleting expired room: ${roomId}`);
        await deleteRoomHard(db, roomId);
        deletedRoomIds.push(roomId);
      }
    }

    // 2. 現在アクティブな（有効期限内の）ルームの hostUid を収集
    const activeRoomsSnap = await db.collection('rooms').get();
    const activeHostUids = new Set();
    activeRoomsSnap.docs.forEach(doc => {
      const data = doc.data();
      const expiresAt = data.expiresAt;
      // 期限が未来、または無期限（ログインユーザーの部屋など）
      if (!expiresAt || expiresAt.toMillis() > nowMs) {
        if (data.hostUid) {
          activeHostUids.add(data.hostUid);
        }
      }
    });

    // 3. 作成後24時間以上経過し、アクティブな部屋を持たない匿名ユーザーを抽出して一括削除
    const anonUidsToDelete = [];
    let pageToken;
    do {
      const listResult = await auth.listUsers(1000, pageToken);
      for (const u of listResult.users) {
        const isAnon = (!u.providerData || u.providerData.length === 0) && !u.email && !u.phoneNumber;
        if (!isAnon) continue;

        const createdAtMs = new Date(u.metadata.creationTime).getTime();
        const isOlderThan24h = (nowMs - createdAtMs) > ONE_DAY_MS;

        if (isOlderThan24h && !activeHostUids.has(u.uid)) {
          anonUidsToDelete.push(u.uid);
        }
      }
      pageToken = listResult.pageToken;
    } while (pageToken);

    console.log(`[Cleanup] Found ${anonUidsToDelete.length} inactive anonymous users to delete.`);

    let deletedAuthUsersCount = 0;
    if (anonUidsToDelete.length > 0) {
      // Firebase Auth から一括削除 (最大1000件ずつ)
      for (let i = 0; i < anonUidsToDelete.length; i += 1000) {
        const chunk = anonUidsToDelete.slice(i, i + 1000);
        const delResult = await auth.deleteUsers(chunk);
        deletedAuthUsersCount += (delResult.successCount || 0);
      }

      // Firestore の users/{uid} レコードも一括削除 (最大400件ずつ)
      for (let i = 0; i < anonUidsToDelete.length; i += 400) {
        const chunk = anonUidsToDelete.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach(uid => {
          batch.delete(db.doc(`users/${uid}`));
        });
        await batch.commit();
      }
    }

    res.status(200).json({
      ok: true,
      deletedRooms: deletedRoomIds.length,
      deletedRoomIds,
      deletedAnonymousUsers: deletedAuthUsersCount
    });

  } catch (e) {
    console.error('[Cleanup] Error:', e);
    res.status(500).json({ error: e.message });
  }
};
