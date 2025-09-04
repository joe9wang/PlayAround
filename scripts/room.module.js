// ルーム関連のDB操作をここに集約
// game.module.js からは import して使います
//
// 依存：Firebase Firestore（db は呼び出し側から受け取ります）
import {
  doc, collection, getDocs, writeBatch, deleteDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * 席を解放する（ホストなら seats/{seat} を削除、非ホストはフィールドをクリア）
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomId
 * @param {number} seat
 * @param {string|null} currentUid
 * @param {string|null} hostUid
 */
export async function releaseSeat(db, roomId, seat, currentUid, hostUid){
  try{
    const isHost = !!(hostUid && currentUid && hostUid === currentUid);
    if (isHost){
      await deleteDoc(doc(db, `rooms/${roomId}/seats/${seat}`));
    }else{
      await setDoc(
        doc(db, `rooms/${roomId}/seats/${seat}`),
        { claimedByUid: null, displayName: '', heartbeatAt: null, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }catch(e){
    if (e?.code !== 'permission-denied' && e?.code !== 'not-found') {
      console.warn('releaseSeat error', e);
    }
  }
}

/**
 * ルームを「閉鎖」状態にしつつ、cards/chat/seats を一括削除（親docは残す）
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomId
 */
export async function cleanupAndCloseRoom(db, roomId){
  // cards
  {
    const cardsCol  = collection(db, `rooms/${roomId}/cards`);
    const cardsSnap = await getDocs(cardsCol);
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of cardsSnap.docs) {
      batch.delete(doc(db, `rooms/${roomId}/cards/${docSnap.id}`));
      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
    if (count > 0) await batch.commit();
  }

  // chat
  {
    const chatCol  = collection(db, `rooms/${roomId}/chat`);
    const chatSnap = await getDocs(chatCol);
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of chatSnap.docs) {
      batch.delete(doc(db, `rooms/${roomId}/chat/${docSnap.id}`));
      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
    if (count > 0) await batch.commit();
  }

  // seats
  {
    const seatsCol  = collection(db, `rooms/${roomId}/seats`);
    const seatsSnap = await getDocs(seatsCol);
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of seatsSnap.docs) {
      batch.delete(doc(db, `rooms/${roomId}/seats/${docSnap.id}`));
      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
    if (count > 0) await batch.commit();
  }

  // roomClosed を立てる
  await setDoc(doc(db, `rooms/${roomId}`), { roomClosed: true, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * ルームを完全削除（サブコレ削除→roomClosed フラグ→親 doc 削除。失敗時は tombstone 互換の閉鎖フラグ）
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomId
 */
export async function cleanupAndDeleteRoom(db, roomId){
  await cleanupAndCloseRoom(db, roomId);
  try{
    await deleteDoc(doc(db, `rooms/${roomId}`));
  }catch(e){
    console.warn('delete room doc failed', e);
    // tombstone 互換（TTL等は親側設定に依存）
    await setDoc(doc(db, `rooms/${roomId}`), {
      roomClosed: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}


