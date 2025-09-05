// save-load.module.js
// 「ユーザー直下3スロットのセーブ/ロード」と、そのモーダルUIのバインドを担当。
// 依存は initSaveLoad(deps) で注入する（DBや現在の座席/UIDなど）。

import {
  doc, collection, setDoc, getDocs, writeBatch,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// deps の型（参考）:
// {
//   db,
//   getState: () => ({ CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID }),
//   CARD_W, CARD_H,
//   centerOfDeck, tinyOffset,
//   postLog?: (msg: string) => void,
// }
let _deps = null;

function slDocPath(slot, uid){
  return `users/${uid}/saves/slot${slot}`;
}

async function fetchMyCardsFromFirestore(){
  const { db, getState } = _deps;
  const { CURRENT_ROOM, CURRENT_PLAYER } = getState();
  const base = collection(db, `rooms/${CURRENT_ROOM}/cards`);
  const q = query(base, where('ownerSeat', '==', CURRENT_PLAYER));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function stripSavableFields(src){
  const fields = [
    'type','count','tokenText',
    'x','y','zIndex','faceUp','rotation',
    'visibleToAll','imageUrl','fullUrl'
  ];
  const out = {};
  for (const k of fields) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

async function saveToSlot(slot){
  const { db, getState, postLog } = _deps;
  const { CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID } = getState();
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID){
    alert('ルームに参加してから実行してください'); return;
  }
  try{
    const cards = await fetchMyCardsFromFirestore();
    const baseRef = doc(db, slDocPath(slot, CURRENT_UID));
    await setDoc(baseRef, {
      updatedAt: serverTimestamp(),
      count: cards.length,
      lastRoomId: CURRENT_ROOM
    }, { merge: true });

    // 既存スロットを全削除 → 新規保存（バッチ）
    const cardsCol = collection(db, `${slDocPath(slot, CURRENT_UID)}/cards`);
    const oldSnap = await getDocs(cardsCol);
    let batch = writeBatch(db), n = 0;
    for (const d of oldSnap.docs){
      batch.delete(d.ref);
      if(++n >= 450){ await batch.commit(); batch = writeBatch(db); n=0; }
    }
    if (n>0) await batch.commit();

    batch = writeBatch(db); n = 0;
    for (const c of cards){
      const refDoc = doc(cardsCol);
      batch.set(refDoc, stripSavableFields(c));
      if(++n >= 450){ await batch.commit(); batch = writeBatch(db); n=0; }
    }
    if (n>0) await batch.commit();

    alert(`SLOT ${slot} に ${cards.length} 枚保存しました。`);
    postLog?.(`SLOT ${slot} に ${cards.length} 枚保存しました`);
  }catch(e){
    console.error('SAVE ERROR', e?.code, e?.message, e);
    alert(`セーブに失敗しました（${e?.code||'unknown'}）。コンソールの詳細を確認してください。`);
  }
}

async function loadFromSlot(slot){
  const { db, getState, CARD_W, CARD_H, centerOfDeck, tinyOffset, postLog } = _deps;
  const { CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID } = getState();
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID){
    alert('ルームに参加してから実行してください'); return;
  }
  try{
    const cardsCol = collection(db, `${slDocPath(slot, CURRENT_UID)}/cards`);
    const snap = await getDocs(cardsCol);
    if (snap.empty){ alert(`SLOT ${slot} は空です。`); return; }

    // 現在ルームに生成（追加）。所有者は現在の自分。
    const baseCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    let batch = writeBatch(db), n = 0, i = 0;
    const z0 = Date.now() % 10000;

    // 座席のデッキ中央を基準に（少しずつズラす）
    const basePos = centerOfDeck(CURRENT_PLAYER, CARD_W, CARD_H);

    for (const d of snap.docs){
      const s = d.data() || {};
      const payload = {
        x: basePos.x + tinyOffset(i),
        y: basePos.y + tinyOffset(i),
        zIndex: (typeof s.zIndex==='number'? s.zIndex:1) + 1 + i + z0,
        faceUp: (s.faceUp!==false),
        rotation: (typeof s.rotation==='number'? s.rotation:0),
        visibleToAll: (s.visibleToAll!==false),
        ...(s.type ? { type: s.type } : {}),
        ...(typeof s.count==='number' ? { count: s.count } : {}),
        ...(typeof s.tokenText==='string' ? { tokenText: s.tokenText } : {}),
        imageUrl: s.imageUrl || '',
        fullUrl:  s.fullUrl  || '',
        ownerUid:  CURRENT_UID,
        ownerSeat: CURRENT_PLAYER,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(doc(baseCards), payload);
      if(++n >= 450){ await batch.commit(); batch = writeBatch(db); n=0; }
      i++;
    }
    if (n>0) await batch.commit();

    alert(`SLOT ${slot} から ${snap.size} 枚ロードしました。`);
    postLog?.(`SLOT ${slot} から ${snap.size} 枚ロードしました`);
  }catch(e){
    console.error(e);
    alert('ロードに失敗しました。通信状況をご確認ください。');
  }
}

// ==== 3スロット選択モーダル制御 ====
// （元の openSaveLoadDialog / bindSLModal と同等の動作）
let SL_MODE = null; // 'save' | 'load'

async function updateSlotPreviews(){
  // 必要最低限：件数の表示だけ（詳細プレビューが不要なら拡張しない）
  const { db, getState } = _deps;
  const { CURRENT_UID } = getState();
  const slots = [1,2,3];
  for (const s of slots){
    const el = document.querySelector(`[data-slot-count="${s}"]`);
    if (!el) continue;
    const col = collection(db, `${slDocPath(s, CURRENT_UID)}/cards`);
    const snap = await getDocs(col);
    el.textContent = `${snap.size} 枚`;
  }
}

function openSaveLoadDialog(mode){
  SL_MODE = mode;
  const modal = document.getElementById('save-load-modal');
  const title = document.getElementById('sl-title');
  if (!modal || !title) return;
  title.textContent = (mode==='save') ? '保存先スロットを選択' : 'ロード元スロットを選択';
  if (mode === 'load') updateSlotPreviews();
  modal.style.display = 'flex';
}

// 起動時にイベントを束ねる
function bindSLModal(){
  const modal = document.getElementById('save-load-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.sl-close');
  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });

  // スロット選択
  const slotBtns = Array.from(modal.querySelectorAll('[data-slot]'));
  slotBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const slot = parseInt(btn.getAttribute('data-slot'), 10);
      if (!slot || slot < 1 || slot > 3) return;
      modal.style.display = 'none';
      if (SL_MODE === 'save') await saveToSlot(slot);
      else                    await loadFromSlot(slot);
    });
  });
}

export function initSaveLoad(deps){
  _deps = deps;
  // HTMLのonclickから呼べるように公開（互換維持）
  window.openSaveLoadDialog = openSaveLoadDialog;
  // モーダルの各イベントをセット
  bindSLModal();
}

export { openSaveLoadDialog }; // 必要なら他モジュールから直接呼ぶ
