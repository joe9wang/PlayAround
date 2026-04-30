

//test git

// ====================================================================

// BatriTable index.js (inlined) — Annotated Edition

// 

// 目次（大項目）

//  1) Firebase 初期化と App Check

//  2) Auth / Firestore / Storage 初期化

//  3) DOM要素参照 (UI)

//  4) アプリ全体の状態管理

//  5) バッチ書き込みキュー

//  6) ストレージ/プレビュー/各種ユーティリティ

//  7) ホスト監視・ハートビート

//  8) ロビー/座席管理（HP含む）

//  9) フィールド構成切替（カード/ボード）

// 10) セッション開始と購読

// 11) カードDOM生成/状態適用

// 12) ルーム終了/削除ユーティリティ

// 13) 画像アップロードとサムネ生成

// 14) ドラッグ/パン/ズーム

// 15) 一括操作・生成ユーティリティ（ダイス/トークン/カウンタ）

// 16) ルーム終了ボタン制御

// 17) フィールド初期化

// 

// ※ 本ファイルは機能を変更せずに可読性向上のためコメントを追加しています。

// ==================================================================== */



// ===== Centralized imports from new modules =====

import {

  app, auth, db, storage,

  // Auth

  signInAnonymously, onAuthStateChanged,

  GoogleAuthProvider,

  EmailAuthProvider, createUserWithEmailAndPassword,

  signInWithEmailAndPassword, sendPasswordResetEmail,

  signInWithPopup, linkWithPopup, signInWithCredential, linkWithCredential,

  signInWithRedirect, linkWithRedirect, getRedirectResult,

  signOut, updateProfile, onIdTokenChanged, getIdToken,

  // Firestore

  doc, setDoc, getDoc, updateDoc, onSnapshot,

  serverTimestamp, runTransaction, deleteDoc, collection, limit,

  addDoc, where, query, getDocs, writeBatch, Timestamp, orderBy, getCountFromServer,

  // Storage

  ref, uploadString, uploadBytes, getDownloadURL

} from './firebase.init.js';



import {

  state, CARD_W, CARD_H, HOST_STALE_MS, SEAT_STALE_MS, HOST_HEARTBEAT_MS, SEAT_HEARTBEAT_MS,

  ROOM_PING_MS, WRITE_FLUSH_MS, MAX_BATCH_OPS, ROOM_EMPTY_GRACE_MS,

  ACTIVE_WINDOW_MS, IDLE_KEEPALIVE_MS

} from './state.js';



import { t, applyI18n, initI18n, setLang, getLang } from './i18n.js';



import {

  initHP, renderHPPanel, subscribeHP, detachHPListener,

  hpDocPath, hpValues, localHpEditAt

} from './hp.js';

import { cleanupAndCloseRoom, cleanupAndDeleteRoom, releaseSeat } from './room.module.js';

import { fetchPremiumStatus, premiumBadgeHTML, getLimits } from './premium.js';



// ===== プレミアム状態グローバル =====

let IS_PREMIUM = false;



// ===============================

// Firebase 初期化 → firebase.init.js に移動済み

// auth, db, storage はすべて firebase.init.js から import

// ===============================



// === IDトークンを保持（sendBeacon でサーバーに本人確認を渡す） ===

let AUTH_ID_TOKEN = null;

onIdTokenChanged(auth, async (user) => {

  try {

    AUTH_ID_TOKEN = user ? await getIdToken(user, /*forceRefresh*/ true) : null;

  } catch (e) {

    console.warn('[auth] getIdToken failed', e);

    AUTH_ID_TOKEN = null;

  }

});













// db は firebase.init.js から import 済み







// ▼ Googleリダイレクト方式の結果を回収（ログイン/リンクの完了）

(async () => {

  try {

    const res = await getRedirectResult(auth);

    if (res && res.user) {

      // displayName 未設定ならフォームの名前を反映（任意）

      const cu = res.user;

      const name = (newPlayerNameInput?.value || playerNameInput?.value || '').trim();

      if (cu && !cu.displayName && name) await updateProfile(cu, { displayName: name });

      alert('ログインしました。');

    }

  } catch (e) {

    console.warn('[RedirectSignIn] failed', e);

    // ここでは黙ってUIだけ整える（必要なら alert を出してもOK）

  }

})();









// storage は firebase.init.js から import 済み







// ▼ロビーのログインUI参照

const logoutBtn = document.getElementById('logout-google');

const mypageBtn = document.getElementById('btn-mypage');

const whoamiSpan = document.getElementById('whoami');

const lobbyPremiumBadge = document.getElementById('lobby-premium-badge');

const authFormArea = document.getElementById('auth-form-area');

const authLoggedinArea = document.getElementById('auth-loggedin-area');



// まだ匿名で遊べるままにする（既存のまま）





// ===============================

// DOM要素参照 (UI)

// ===============================

// 画面各所の要素を取得して保管します。

// ===== DOM refs

const joinRoomInput = document.getElementById('join-room-id');

const playerNameInput = document.getElementById('player-name');

const joinRoomPassInput = document.getElementById('join-room-pass');

const newRoomIdInput = document.getElementById('new-room-id');

const newPlayerNameInput = document.getElementById('new-player-name');

const newRoomPassInput = document.getElementById('new-room-pass');

const createRoomBtn = document.getElementById('create-room-btn');

const startBtn = document.getElementById('start-btn');

const pickModeCardBtn = document.getElementById('pick-mode-card');

const pickModeBoardBtn = document.getElementById('pick-mode-board');

const lobby = document.getElementById('lobby');

const endRoomBtn = document.getElementById('end-room-btn');
const hostSaveRoomBtn = document.getElementById('host-save-room-btn');
const hostLoadRoomBtn = document.getElementById('host-load-room-btn');
const hostOtherOpsSaveBtn = document.getElementById('host-otherops-save-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const seatButtons = Array.from(document.querySelectorAll('.seat-grid:not(#create-seat-grid) .seat-btn'));

const sessionIndicator = document.getElementById('session-indicator');
const authIndicator = document.getElementById('auth-indicator');





// Host-only toggle: 他プレイヤーのカード操作

const hostOtherOpsWrap = document.getElementById('host-otherops');

const toggleOtherOpsInput = document.getElementById('toggle-other-ops');

const toggleOtherOpsText = document.getElementById('toggle-other-ops-text');

const btnModeCard = document.getElementById('btn-mode-card');
const btnModeBoard = document.getElementById('btn-mode-board');

const hostCardWInput = document.getElementById('host-card-w');
const hostCardHInput = document.getElementById('host-card-h');



function applyOtherOpsUI() {
  const on = !!(CURRENT_ROOM_META?.allowOthersMove || CURRENT_ROOM_META?.allowOtherOps);
  if (toggleOtherOpsInput) toggleOtherOpsInput.checked = on;
  if (toggleOtherOpsText) toggleOtherOpsText.textContent = on ? 'ON' : 'OFF';
}

function applyCardSizeUI() {
  const w = CURRENT_ROOM_META?.cardWidth || 120;
  const h = CURRENT_ROOM_META?.cardHeight || 160;
  if (hostCardWInput) hostCardWInput.value = w;
  if (hostCardHInput) hostCardHInput.value = h;
  document.documentElement.style.setProperty('--card-w', `${w}px`);
  document.documentElement.style.setProperty('--card-h', `${h}px`);
}

function applyBoardSizeUI() {
  const w = CURRENT_ROOM_META?.boardWidth;
  const h = CURRENT_ROOM_META?.boardHeight;
  const x = CURRENT_ROOM_META?.boardX;
  const y = CURRENT_ROOM_META?.boardY;
  const layout = document.getElementById('board-layout');
  if (layout) {
    if (w !== undefined) layout.style.width = w + 'px';
    if (h !== undefined) layout.style.height = h + 'px';
    if (x !== undefined) layout.style.left = x + 'px';
    if (y !== undefined) layout.style.top = y + 'px';
  }
}

async function updateCardSize(w, h) {
  const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID);
  if (!isHost) return;
  try {
    await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { 
      cardWidth: parseInt(w, 10), 
      cardHeight: parseInt(h, 10),
      updatedAt: serverTimestamp() 
    }, { merge: true });
  } catch (e) { console.warn('Update card size failed', e); }
}



toggleOtherOpsInput?.addEventListener('change', async () => {

  // ホストだけ変更可能（UIはホストにしか表示しないが二重ガード）

  const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID && CURRENT_ROOM_META?.hostSeat === CURRENT_PLAYER);

  if (!isHost) { applyOtherOpsUI(); return; }

  const val = !!toggleOtherOpsInput.checked;

  toggleOtherOpsText.textContent = val ? 'ON' : 'OFF';

  try {

    await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { allowOthersMove: val, updatedAt: serverTimestamp() }, { merge: true });

  } catch (e) { console.warn('toggle allowOthersMove failed', e); }

});

hostCardWInput?.addEventListener('change', () => updateCardSize(hostCardWInput.value, hostCardHInput.value));
hostCardHInput?.addEventListener('change', () => updateCardSize(hostCardWInput.value, hostCardHInput.value));

let CURRENT_LAYOUT_SELECTION = 'standard';
window.selectLayoutOption = function(type) {
  CURRENT_LAYOUT_SELECTION = type;
  const opts = document.querySelectorAll('#field-layout-modal .layout-option');
  opts.forEach(opt => {
    const isActive = opt.id === `layout-opt-${type}`;
    opt.classList.toggle('active', isActive);
    
    // 枠線の色を更新
    const wrap = opt.querySelector('.layout-preview-wrap');
    if (wrap) {
      wrap.style.borderColor = isActive ? '#2d8' : '#eee';
    }
    
    // 文字の色を更新
    const label = opt.querySelector('.layout-label');
    if (label) {
      label.style.color = isActive ? '#2d8' : '#555';
    }

    const overlay = opt.querySelector('.selection-overlay');
    if (overlay) overlay.style.opacity = isActive ? '1' : '0';
  });
};

let PENDING_FIELD_MODE = 'card';

async function clearAreas() {
  if (!CURRENT_ROOM) return;
  try {
    const areasRef = collection(db, `rooms/${CURRENT_ROOM}/areas`);
    const snap = await getDocs(areasRef);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Failed to clear areas:', e);
  }
}

btnModeCard?.addEventListener('click', () => {
  const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID);
  if (!isHost) { alert('ホスト専用機能です。'); return; }
  
  PENDING_FIELD_MODE = 'card';
  const currentLayout = CURRENT_ROOM_META?.fieldLayout || 'standard';
  window.selectLayoutOption(currentLayout);

  const simpleImg = document.getElementById('layout-img-simple');
  const standardImg = document.getElementById('layout-img-standard');
  if (simpleImg) simpleImg.src = 'image/Field_simple_type.png';
  if (standardImg) standardImg.src = 'image/Field_standard_type.png';

  const modal = document.getElementById('field-layout-modal');
  if (modal) modal.style.display = 'flex';
});

btnModeBoard?.addEventListener('click', () => {
  const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID);
  if (!isHost) { alert('ホスト専用機能です。'); return; }
  
  PENDING_FIELD_MODE = 'board';
  const currentLayout = CURRENT_ROOM_META?.fieldLayout || 'standard';
  window.selectLayoutOption(currentLayout);

  const simpleImg = document.getElementById('layout-img-simple');
  const standardImg = document.getElementById('layout-img-standard');
  if (simpleImg) simpleImg.src = 'image/board simple.png';
  if (standardImg) standardImg.src = 'image/board standard.png';

  const modal = document.getElementById('field-layout-modal');
  if (modal) modal.style.display = 'flex';
});

document.getElementById('field-layout-cancel')?.addEventListener('click', () => {
  const modal = document.getElementById('field-layout-modal');
  if (modal) modal.style.display = 'none';
});

document.getElementById('field-layout-ok')?.addEventListener('click', async () => {
  const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID);
  if (!isHost) return;
  
  const modal = document.getElementById('field-layout-modal');
  if (modal) modal.style.display = 'none';
  
  const msg = PENDING_FIELD_MODE === 'board' ? 'ボードゲームモードに変更します。よろしいですか？\n（追加されたエリアはすべて削除されます）' : 'カードゲームモードに変更します。よろしいですか？\n（追加されたエリアはすべて削除されます）';
  if (!confirm(msg)) return;

  try {
    await clearAreas();
    await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { fieldMode: PENDING_FIELD_MODE, fieldLayout: CURRENT_LAYOUT_SELECTION, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.error(e);
  }
});





// サイドバー折り畳み（左=操作パネル, 右=プレビュー）





// ===== サイドバー折り畳み（左=操作パネル, 右=プレビュー） =====

const toggleLeftBtn = document.getElementById('toggle-left');

const toggleRightBtn = document.getElementById('toggle-right');



// localStorage に保持（リロードしても状態維持）

const LS_COLLAPSE_LEFT = 'pa:collapse-left';

const LS_COLLAPSE_RIGHT = 'pa:collapse-right';



function applyCollapseState() {

  const left = localStorage.getItem(LS_COLLAPSE_LEFT) === '1';

  const right = localStorage.getItem(LS_COLLAPSE_RIGHT) === '1';

  document.body.classList.toggle('collapse-left', left);

  document.body.classList.toggle('collapse-right', right);

  // ボタンの矢印を状態に合わせる

  if (toggleLeftBtn) toggleLeftBtn.textContent = left ? '▶' : '◀';

  if (toggleRightBtn) toggleRightBtn.textContent = right ? '◀' : '▶';

  // アクセシビリティ（ご参考）

  if (toggleLeftBtn) toggleLeftBtn.setAttribute('aria-pressed', left ? 'true' : 'false');

  if (toggleRightBtn) toggleRightBtn.setAttribute('aria-pressed', right ? 'true' : 'false');

}



// ===== 外付けハンドル（折り畳み時だけ見える） =====

const edgeLeft = document.getElementById('edge-left');

const edgeRight = document.getElementById('edge-right');



edgeLeft?.addEventListener('click', () => {

  // 左サイド折り畳み中 → 展開

  localStorage.setItem(LS_COLLAPSE_LEFT, '0');

  applyCollapseState();

});

edgeRight?.addEventListener('click', () => {

  // 右サイド折り畳み中 → 展開

  localStorage.setItem(LS_COLLAPSE_RIGHT, '0');

  applyCollapseState();

});



function toggleLeft() {

  const left = !(localStorage.getItem(LS_COLLAPSE_LEFT) === '1');

  localStorage.setItem(LS_COLLAPSE_LEFT, left ? '1' : '0');

  applyCollapseState();

}

function toggleRight() {

  const right = !(localStorage.getItem(LS_COLLAPSE_RIGHT) === '1');

  localStorage.setItem(LS_COLLAPSE_RIGHT, right ? '1' : '0');

  applyCollapseState();

}



toggleLeftBtn?.addEventListener('click', toggleLeft);

toggleRightBtn?.addEventListener('click', toggleRight);



// キーボードショートカット（任意）： [ を左、 ] を右

window.addEventListener('keydown', (e) => {

  if (e.key === '[') toggleLeft();

  if (e.key === ']') toggleRight();

});



// 初期反映

applyCollapseState();













// ===============================

// アプリ全体の状態管理

// ===============================

// 現在のルーム/座席/UID 等のランタイム状態。クォータ対策のための各種周期定数もここで定義。

// ===== State

// --- セッション関連 ---

// CURRENT_ROOM: 参加中のルームID（null のとき未参加）

// CURRENT_ROOM_META: ルームdocの内容（hostUid/hostSeat/fieldMode など）

// CURRENT_PLAYER: 自分の座席番号 (1..4)

// CURRENT_UID: Firebase Auth UID

//

// --- 監視/購読ハンドル ---

// unsubscribeRoomDoc / unsubscribeSeats / unsubscribeCards: Firestore 購読解除用

// hostWatchTimer / heartbeatTimer / hostHeartbeatTimer: setInterval のID

//

// --- 書き込み最適化 ---

// WRITE_FLUSH_MS: バッチコミット間隔（ms）

// MAX_BATCH_OPS: 1バッチで行う最大オペレーション数

// pendingPatches: パス→patch を一時保持するMap

let CURRENT_ROOM = null;

let CURRENT_ROOM_META = null;

let unsubscribeRoomDoc = null;

let CURRENT_PLAYER = null; // 1..4

let CURRENT_UID = null;





// ===============================

// セーブ / ロード（ユーザー直下 3スロット）

//  保存: users/{UID}/saves/slot{1|2|3}/cards/*

//  ロード: 指定スロットから現在ルームへ生成（所有者は現在の自分に付替え）

// ===============================

function slDocPath(slot) {

  return `users/${CURRENT_UID}/saves/slot${slot}`;

}



async function fetchMyCardsFromFirestore() {

  // 自分のカードだけをDBから取得（正のソース）

  const base = collection(db, `rooms/${CURRENT_ROOM}/cards`);

  const q = query(base, where('ownerSeat', '==', CURRENT_PLAYER));

  const snap = await getDocs(q);

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));

}



function stripSavableFields(src) {

  // 保存対象フィールドを限定

  const fields = [

    'type', 'count', 'tokenText', 'scaleLevel',

    'x', 'y', 'zIndex', 'faceUp', 'rotation',

    'visibleToAll', 'imageUrl', 'fullUrl'

  ];

  const out = {};

  for (const k of fields) {

    if (src[k] !== undefined) out[k] = src[k];

  }

  return out;

}



async function saveToSlot(slot) {



  console.log("UID check", CURRENT_UID, auth.currentUser?.uid);

  console.log('[DEBUG saveToSlot] IS_PREMIUM =', IS_PREMIUM, ', slot =', slot);



  // ===== カードリスト保存: プレミアム限定 =====

  if (!IS_PREMIUM) {

    console.warn('[DEBUG saveToSlot] BLOCKED by premium gate. IS_PREMIUM =', IS_PREMIUM);

    alert('カードリスト保存はプレミアム会員限定の機能です。');

    return;

  }



  await ensureAuthReady();

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください'); return;

  }

  try {

    const cards = await fetchMyCardsFromFirestore();

    const baseRef = doc(db, slDocPath(slot));

    // メタ情報を保存（件数・最終ルーム）

    await setDoc(baseRef, {

      updatedAt: serverTimestamp(),

      count: cards.length,

      lastRoomId: CURRENT_ROOM

    }, { merge: true });



    // 既存スロットを全削除 → 新規保存（バッチ）

    const cardsCol = collection(db, `${slDocPath(slot)}/cards`);

    const oldSnap = await getDocs(cardsCol);

    let batch = writeBatch(db), n = 0;

    for (const d of oldSnap.docs) {

      batch.delete(d.ref); if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();



    batch = writeBatch(db); n = 0;

    for (const c of cards) {

      const refDoc = doc(cardsCol); // 新規ID

      batch.set(refDoc, stripSavableFields(c));

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();

    alert(`SLOT ${slot} に ${cards.length} 枚保存しました。`);

    // ★セーブ完了ログ

    postLog(`SLOT ${slot} に ${cards.length} 枚保存しました`);

  } catch (e) {

    console.error('SAVE ERROR', e?.code, e?.message, e);

    alert(`セーブに失敗しました（${e?.code || 'unknown'}）。コンソールの詳細を確認してください。`);

  }

}



function tinyOffset(i) { return (i % 7) * 6; } // 重なり回避の微小ズレ



async function loadFromSlot(slot) {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください'); return;

  }

  try {

    console.log("[LoadDebug] Starting loadFromSlot", { slot, CURRENT_ROOM, CURRENT_PLAYER });
    
    // 現在の描画コンテナを特定
    const fieldContainer = document.getElementById('board-play') || document.getElementById('field');
    console.log("[LoadDebug] Target container:", fieldContainer?.id);

    const cardsCol = collection(db, `${slDocPath(slot)}/cards`);
    const snap = await getDocs(cardsCol);

    if (snap.empty) { 
      console.warn("[LoadDebug] Slot is empty", slot);
      alert(`SLOT ${slot} は空です。`); 
      return; 
    }

    console.log("[LoadDebug] Found cards:", snap.size);

    // 現在ルームに生成（追加）。所有者は現在の自分。

    const baseCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    let batch = writeBatch(db), n = 0, i = 0;

    const z0 = Date.now() % 10000;



    //▼この座席のデッキ中央を基準にする
    const basePos = centerOfDeck(CURRENT_PLAYER, CARD_W, CARD_H);
    console.log("[LoadDebug] Calculated basePos:", basePos);

    // デバッグ用: 座標が極端な場合は 0,0 にリセットして見えるようにする
    if (basePos.x < -5000 || basePos.x > 5000) basePos.x = 100;
    if (basePos.y < -5000 || basePos.y > 5000) basePos.y = 100;



    for (const d of snap.docs) {

      const s = d.data() || {};

      const payload = {

        //▼保存時の x,y は使わず「デッキ中央」にまとめて出す

        x: basePos.x + tinyOffset(i),

        y: basePos.y + tinyOffset(i),

        zIndex: (typeof s.zIndex === 'number' ? s.zIndex : 1) + 1 + i + z0,

        faceUp: (s.faceUp !== false),

        rotation: (typeof s.rotation === 'number' ? s.rotation : 0),

        visibleToAll: (s.visibleToAll !== false),

        ...(s.type ? { type: s.type } : {}),

        ...(typeof s.count === 'number' ? { count: s.count } : {}),

        ...(typeof s.tokenText === 'string' ? { tokenText: s.tokenText } : {}),

        ...(typeof s.scaleLevel === 'number' ? { scaleLevel: s.scaleLevel } : {}),

        imageUrl: s.imageUrl || '',

        fullUrl: s.fullUrl || '',

        ownerUid: CURRENT_UID,

        ownerSeat: CURRENT_PLAYER,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),

      };

      batch.set(doc(baseCards), payload);

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

      i++;

    }

    if (n > 0) await batch.commit();

    alert(`SLOT ${slot} から ${snap.size} 枚ロードしました。`);

    // ★ロード完了ログ

    postLog(`SLOT ${slot} から ${snap.size} 枚ロードしました`);

  } catch (e) {

    console.error(e);

    alert('ロードに失敗しました。通信状況をご確認ください。');

  }

}



// ==== 3スロット選択モーダル制御 ====

let SL_MODE = null; // 'save' | 'load'
let SL_TARGET_SLOT = null;
let SL_OFFICIAL_TYPE = null; // 'trump' | 'chess'

function openSaveLoadDialog(mode) {
  SL_MODE = mode;
  SL_TARGET_SLOT = null;
  SL_OFFICIAL_TYPE = null;
  const modal = document.getElementById('save-load-modal');
  if (!modal) return;

  // ビューの初期化
  const selectionView = document.getElementById('sl-selection-view');
  const confirmView = document.getElementById('sl-confirm-view');
  if (selectionView) selectionView.style.display = 'block';
  if (confirmView) confirmView.style.display = 'none';

  // タブの初期化
  const tabs = document.getElementById('sl-tabs');
  if (tabs) {
    // 保存時はマイセットのみにするためタブを隠す
    tabs.style.display = (mode === 'save') ? 'none' : 'flex';
    switchSLTab('myset');
  }

  const title = document.getElementById('sl-title');
  if (title) {
    title.textContent = (mode === 'save') ? '保存先を選択' : 'ロードするセットを選択';
  }

  // プレビューの更新
  updateSlotPreviews();

  modal.style.display = 'flex';
}

function switchSLTab(target) {
  const modal = document.getElementById('save-load-modal');
  if (!modal) return;

  // ボタンのスタイル更新
  modal.querySelectorAll('.sl-tab').forEach(btn => {
    const active = btn.dataset.target === target;
    btn.classList.toggle('active', active);
    btn.style.background = active ? '#fff' : 'none';
    btn.style.boxShadow = active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none';
    btn.style.color = active ? '#000' : '#666';
  });

  // コンテンツの表示更新
  modal.querySelectorAll('.sl-tab-pane').forEach(pane => {
    pane.style.display = (pane.id === `sl-tab-content-${target}`) ? 'block' : 'none';
  });
}

window.openSaveLoadDialog = openSaveLoadDialog;



// 起動時にイベントを束ねる

(function bindSLModal() {
  const modal = document.getElementById('save-load-modal');
  if (!modal) return;

  // 背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // キャンセル
  document.getElementById('sl-cancel')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // タブ切り替え
  modal.querySelectorAll('.sl-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSLTab(btn.dataset.target));
  });

  // スロット選択（マイセット統合ボタン）
  modal.querySelectorAll('.slot-item-btn:not(.official-btn)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slot = parseInt(btn.dataset.slot, 10);
      SL_TARGET_SLOT = slot;
      SL_OFFICIAL_TYPE = null;

      if (SL_MODE === 'save') {
        modal.style.display = 'none';
        await saveToSlot(slot);
      } else {
        showLoadConfirmation(slot);
      }
    });
  });

  // 公式セット選択
  modal.querySelectorAll('.official-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.official;
      SL_OFFICIAL_TYPE = type;
      SL_TARGET_SLOT = null;
      showOfficialConfirmation(type);
    });
  });

  // 確認画面の「いいえ」
  document.getElementById('sl-confirm-no')?.addEventListener('click', () => {
    const selectionView = document.getElementById('sl-selection-view');
    const confirmView = document.getElementById('sl-confirm-view');
    if (selectionView) selectionView.style.display = 'block';
    if (confirmView) confirmView.style.display = 'none';
  });

  // 確認画面の「はい」
  document.getElementById('sl-confirm-yes')?.addEventListener('click', async () => {
    modal.style.display = 'none';
    if (SL_TARGET_SLOT) {
      await loadFromSlot(SL_TARGET_SLOT);
    } else if (SL_OFFICIAL_TYPE) {
      await loadOfficialSet(SL_OFFICIAL_TYPE);
    }
  });
})();

async function showLoadConfirmation(slot) {
  const selectionView = document.getElementById('sl-selection-view');
  const confirmView = document.getElementById('sl-confirm-view');
  const confirmTitle = document.getElementById('sl-confirm-title');
  const detailsList = document.getElementById('sl-confirm-details');

  if (!confirmView || !confirmTitle || !detailsList) return;

  confirmTitle.textContent = `マイセット${slot} をロードしますか？`;
  detailsList.innerHTML = '<div style="padding:20px; color:#666; text-align:center;">読み込み中...</div>';
  
  if (selectionView) selectionView.style.display = 'none';
  confirmView.style.display = 'block';

  try {
    const cardsRef = collection(db, `${slDocPath(slot)}/cards`);
    const snap = await getDocs(cardsRef);
    
    if (snap.empty) {
      detailsList.innerHTML = '<div style="padding:20px; color:#aaa; text-align:center;">カードが含まれていません。</div>';
      return;
    }

    detailsList.innerHTML = '';
    for (const d of snap.docs) {
      const s = d.data() || {};
      let url = s.fullUrl;
      if (!url && s.imageUrl) url = await storageDownloadURL(s.imageUrl);
      if (!url) continue;

      const item = document.createElement('div');
      item.className = 'sl-detail-item';
      const img = document.createElement('img');
      img.src = url;
      img.crossOrigin = 'anonymous';
      item.appendChild(img);
      detailsList.appendChild(item);
    }
  } catch (e) {
    console.error('Failed to load confirmation details', e);
    detailsList.innerHTML = '<div style="padding:20px; color:red; text-align:center;">データの取得に失敗しました。</div>';
  }
}

async function showOfficialConfirmation(type) {
  const selectionView = document.getElementById('sl-selection-view');
  const confirmView = document.getElementById('sl-confirm-view');
  const confirmTitle = document.getElementById('sl-confirm-title');
  const detailsList = document.getElementById('sl-confirm-details');

  if (!confirmView || !confirmTitle || !detailsList) return;

  const label = (type === 'trump') ? 'トランプ (54枚)' : 'チェス (32枚)';
  confirmTitle.textContent = `${label} をロードしますか？`;
  detailsList.innerHTML = '<div style="padding:20px; color:#666; text-align:center;">セット内容を準備中...</div>';
  
  if (selectionView) selectionView.style.display = 'none';
  confirmView.style.display = 'block';

  // 簡易プレビュー（既存のパスにあわせる）
  const previews = (type === 'trump') 
    ? [`${TRUMP_IMG_BASE}/spade_A.png`, `${TRUMP_IMG_BASE}/heart_A.png`, `${TRUMP_IMG_BASE}/diamond_A.png`, `${TRUMP_IMG_BASE}/club_A.png`]
    : ['chess/w_king.png', 'chess/w_queen.png', 'chess/b_king.png', 'chess/b_queen.png'];

  detailsList.innerHTML = '';
  // 候補のパス（複数試す）
  const candidates = (type === 'trump') 
    ? ['spade_A.png', 'heart_A.png', 'diamond_A.png', 'club_A.png']
    : ['White_king.png', 'White_queen.png', 'Black_king.png', 'Black_queen.png'];

  const baseFolders = (type === 'trump') 
    ? ['image/Trump', 'TrumpPicture', 'trump', 'Trump', 'images/Trump'] 
    : ['image/Chess', 'Chess', 'chess', 'ChessSet'];

  for (const file of candidates) {
    let url = null;
    for (const folder of baseFolders) {
      try {
        const fullPath = `${folder}/${file}`;
        console.log("[PreviewDebug] Trying path:", fullPath);
        url = await storageDownloadURL(fullPath);
        if (url) {
          console.log("[PreviewDebug] SUCCESS! Found URL for:", fullPath);
          break;
        }
      } catch(e) {}
    }
    
    if (url) {
      const item = document.createElement('div');
      item.className = 'sl-detail-item';
      const img = document.createElement('img');
      img.src = url;
      img.crossOrigin = 'anonymous';
      item.appendChild(img);
      detailsList.appendChild(item);
    }
  }
  const msg = document.createElement('div');
  msg.style.cssText = "grid-column: 1/-1; text-align:center; padding:10px; color:#888; font-size:12px;";
  msg.textContent = (type === 'trump') ? "全54枚のカードがロードされます" : "白黒各16枚、計32枚の駒がロードされます";
  detailsList.appendChild(msg);
}

async function loadOfficialSet(type) {
  try {
    const baseCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    let batch = writeBatch(db), n = 0, i = 0;
    const z0 = Date.now() % 10000;
    const basePos = centerOfDeck(CURRENT_PLAYER, CARD_W, CARD_H);

    const cardList = [];
    if (type === 'trump') {
      const SUITS = ['spade', 'heart', 'diamond', 'club'];
      const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      for (const s of SUITS) {
        for (const r of RANKS) {
          cardList.push({ path: `${TRUMP_IMG_BASE}/${s}_${r}.png`, back: TRUMP_BACK_URL });
        }
      }
      cardList.push({ path: JOKER_URL, back: TRUMP_BACK_URL });
      cardList.push({ path: JOKER_URL, back: TRUMP_BACK_URL });
    } else if (type === 'chess') {
      const colors = ['White', 'Black'];
      const pieces = ['king', 'queen', 'rook', 'rook', 'bishop', 'bishop', 'knight', 'knight', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
      for (const c of colors) {
        for (const p of pieces) {
          cardList.push({ path: `image/Chess/${c}_${p}.png`, type: 'image-token' });
        }
      }
    }

    for (const c of cardList) {
      const payload = {
        x: basePos.x + (i % 10) * 2,
        y: basePos.y + Math.floor(i / 10) * 2,
        zIndex: 1000 + i + z0,
        faceUp: (type === 'trump' ? false : true),
        imageUrl: c.path,
        fullUrl: c.path,
        backImageUrl: c.back || '',
        type: c.type || 'normal',
        ownerUid: CURRENT_UID,
        ownerSeat: CURRENT_PLAYER,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(doc(baseCards), payload);
      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
      i++;
    }

    if (n > 0) await batch.commit();
    postLog(`公式セット「${type}」をロードしました`);
  } catch (e) {
    console.error(e);
    alert('公式セットのロードに失敗しました');
  }
}





// ▼ 追加：スロットのプレビューを描画（各最大5枚）

async function updateSlotPreviews() {

  try {

    await ensureAuthReady();

    const wrap = document.querySelector('#save-load-modal .sl-grid');

    if (!wrap) return;

    const boxes = Array.from(wrap.querySelectorAll('.slot-preview'));

    for (const box of boxes) {

      const slot = parseInt(box.dataset.slot, 10);

      // プレースホルダ

      box.innerHTML = '<span class="empty">読み込み中…</span>';

      try {

        // users/{UID}/saves/slot{n}/cards から最大5件

        const cardsRef = collection(db, `${slDocPath(slot)}/cards`);

        const snap = await getDocs(query(cardsRef, limit(5)));

        if (snap.empty) {

          box.innerHTML = '<span class="empty">空き</span>';

          continue;

        }

        // まとめて描画してリフローを減らす

        const frag = document.createDocumentFragment();

        let added = 0;

        for (const d of snap.docs) {

          const s = d.data() || {};

          // 保存されているURLは fullUrl を優先、なければ Storage 経由で解決

          let url = s.fullUrl;

          if (!url && s.imageUrl) url = await storageDownloadURL(s.imageUrl);

          if (!url) continue;

          const img = document.createElement('img'); img.crossOrigin = 'anonymous';

          img.src = url;

          img.alt = '';

          frag.appendChild(img);

          added++;

        }

        if (added === 0) {

          box.innerHTML = '<span class="empty">画像なし</span>';

        } else {

          box.innerHTML = '';

          // ← 正: frag を box に追加（wrap ではない）

          box.appendChild(frag);

        }

      } catch (e) {

        console.warn('preview fetch failed', e);

        box.innerHTML = '<span class="empty">取得失敗</span>';

      }

    }

  } catch (e) {

    console.warn('updateSlotPreviews error', e);

  }

}





let hostWatchTimer = null;



let ACTIVE_MODE = 'join'; // 'join' | 'create'

let IS_ROOM_CREATOR = false;



// ===== Quota care: intervals — 定数は state.js から import 済み =====

let __roomPingAt = 0;







// CARD_W, CARD_H は state.js から import 済み



// WRITE_FLUSH_MS, MAX_BATCH_OPS は state.js から import 済み

const pendingPatches = new Map();

let flushTimer = null;





// === アクティビティ検知（操作がある時だけ頻繁にHB） ===

// ACTIVE_WINDOW_MS imported from state.js

// IDLE_KEEPALIVE_MS imported from state.js

let lastActivityAt = Date.now();

let lastSeatHBWriteAt = 0;



['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach(evt => {

  window.addEventListener(evt, () => { lastActivityAt = Date.now(); }, { passive: true });

});







// ===============================

// バッチ書き込みキュー

// ===============================

// Firestore 書き込み回数を抑えるために、更新を一時キューに積んで一定間隔でまとめて commit します。/**

// コレクションパスを組み立てるヘルパ

// @param {string} roomId - ルームID

// @param {string} sub - サブコレ名（cards/seatsなど）

// @param {string} id - ドキュメントID

// @returns {string} Firestore ドキュメントパス

//



function pathFor(roomId, sub, id) { return `rooms/${roomId}/${sub}/${id}`; }



function queueUpdate(path, patch) {

  // serverTimestampはここで付けない：無駄な書き込み増を防ぐ

  const prev = pendingPatches.get(path) || {};

  pendingPatches.set(path, { ...prev, ...patch });

  if (!flushTimer) flushTimer = setTimeout(flushWrites, WRITE_FLUSH_MS);

}



async function flushWrites() {

  flushTimer = null;

  if (pendingPatches.size === 0) return;

  // 複数バッチに分割

  const entries = Array.from(pendingPatches.entries());

  pendingPatches.clear();

  for (let i = 0; i < entries.length; i += MAX_BATCH_OPS) {

    const batch = writeBatch(db);

    const slice = entries.slice(i, i + MAX_BATCH_OPS);

    for (const [path, patch] of slice) {

      batch.update(doc(db, path), patch);

    }

    try { await batch.commit(); } catch (e) { console.warn('batch commit failed', e); }

  }

}





// Storage の安全なダウンロードURLを取得（SDK 任せ）

// ===============================

// ストレージ: 安全なダウンロードURL取得ユーティリティ

// ===============================/**

// Storage の安全なダウンロードURLを取得する（失敗時は null）

// @param {string} path - gs:// or relative path

// @returns {Promise<string} null>|ダウンロードURL

//



async function storageDownloadURL(path) {

  try {

    console.log("[StorageDebug] Requesting:", path, "Bucket:", storage.app.options.storageBucket);
    return await getDownloadURL(ref(storage, path));

  } catch (e) {

    console.warn('[Storage] getDownloadURL failed:', path, e.code || e.message);

    return null;

  }

}









// --- Helper functions for dynamic player count ---

function getPlayerSeatsCount() {

  if (CURRENT_ROOM_META?.playerCount) return CURRENT_ROOM_META.playerCount;

  const newPlayerCountSelect = document.getElementById('new-player-count');

  if (newPlayerCountSelect && newPlayerCountSelect.value) return parseInt(newPlayerCountSelect.value, 10) || 4;

  return 4;

}

function getPlayerSeatsArray() {

  const c = getPlayerSeatsCount();

  return Array.from({ length: c }, (_, i) => i + 1);

}



// === Helper: 他人の手札内かどうか（プレビュー用マスク判定） ===

function isOtherPlayersHandCard(el) {

  try {

    if (!el) return false;

    const viewerSeat = CURRENT_PLAYER;

    const left = parseFloat(el.style.left) || 0;

    const top = parseFloat(el.style.top) || 0;

    for (const s of getPlayerSeatsArray()) {

      const hb = getHandBoundsForSeat(s);

      if (hb && isCenterInsideRect(left, top, hb)) {

        return String(s) !== String(viewerSeat);

      }

    }

  } catch (_) { }

  return false;

}









async function sha256Hex(str) {

  const data = new TextEncoder().encode(str);

  const buf = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

}





function updateCardBatched(cardId, patch) {
  if (!CURRENT_ROOM) return;
  if (typeof markLocal === 'function') markLocal(cardId);
  queueUpdate(pathFor(CURRENT_ROOM, 'cards', cardId), patch);
}

function updateSeatBatched(seat, patch) {

  if (!CURRENT_ROOM) return;

  queueUpdate(pathFor(CURRENT_ROOM, 'seats', seat), patch);

}



// ===== Presence / host alive



// ROOM_EMPTY_GRACE_MS imported from state.js



function isHostAlive(roomMeta) {

  if (!roomMeta?.hostUid) return false;

  if (CURRENT_UID && roomMeta.hostUid === CURRENT_UID) return true;

  const now = Date.now();

  const t = roomMeta.hostHeartbeatAt?.toMillis?.() ?? 0;

  if (now - t < HOST_STALE_MS) return true;

  const hostSeat = roomMeta.hostSeat;

  if (hostSeat) {

    const d = currentSeatMap[hostSeat];

    const hb = d?.heartbeatAt?.toMillis?.();

    if (hb && (now - hb) < SEAT_STALE_MS) return true;

  }

  const pc = roomMeta?.playerCount || 10;

  const seats = Array.from({ length: pc }, (_, i) => i + 1);

  for (const s of seats) {

    const d = currentSeatMap[s];

    const hb = d?.heartbeatAt?.toMillis?.();

    if (d?.claimedByUid === roomMeta.hostUid && hb && (now - hb) < SEAT_STALE_MS) return true;

  }

  return false;

}



// 初回の認証状態が確定してから匿名化を判断する

let __initialAuthResolved = false;

onAuthStateChanged(auth, (user) => {

  // 初回：復元が無い（user === null）と確定したときだけ匿名でサインイン

  if (!__initialAuthResolved) {

    __initialAuthResolved = true;

    if (!user) {

      signInAnonymously(auth).catch(console.error);

      return; // この後もう一度 onAuthStateChanged が来る

    }

  }



  if (!user) return; // ここに来るのは稀だが安全のため

  CURRENT_UID = user.uid;



  // ロビーのボタン表示を更新（元のロジックを踏襲）

  updateAuthIndicator(user);

  if (user.isAnonymous) {

    // 未ログイン（匿名）→ フォームを表示、ログインUI非表示

    IS_PREMIUM = false; // 匿名ユーザーはプレミアム不可

    document.body.classList.remove('premium-user');

    if (authFormArea) authFormArea.style.display = '';

    if (authLoggedinArea) authLoggedinArea.style.display = 'none';



    if (lobbyPremiumBadge) { lobbyPremiumBadge.style.display = 'none'; lobbyPremiumBadge.innerHTML = ''; }



    // マイページ表示用の情報はクリア

    localStorage.removeItem('pa:googleUid');

    localStorage.removeItem('pa:displayName');

    localStorage.removeItem('pa:photoURL');



  } else {

    // ログイン済み → フォーム非表示、ユーザー情報表示

    if (authFormArea) authFormArea.style.display = 'none';

    if (authLoggedinArea) authLoggedinArea.style.display = '';



    if (whoamiSpan) {
      whoamiSpan.style.display = '';
      whoamiSpan.textContent = `ログイン中：${user.email || user.displayName || 'No Name'}`;
    }

    fetchPremiumStatus(user.uid).then(status => {
      IS_PREMIUM = !!status.premium;
      document.body.classList.toggle('premium-user', IS_PREMIUM);
      if (lobbyPremiumBadge) {
        lobbyPremiumBadge.style.display = 'none';
        lobbyPremiumBadge.innerHTML = '';
        if (status.premium) {
          lobbyPremiumBadge.innerHTML = premiumBadgeHTML(status.premium);
          lobbyPremiumBadge.style.display = '';
        }
      }
    }).catch(console.error);



    // ▼プロバイダ情報を保存（マイページで使う）

    localStorage.setItem('pa:email', user.email || '');

    localStorage.setItem('pa:displayName', user.displayName || '');

    localStorage.setItem('pa:photoURL', user.photoURL || '');

    if (CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === user.uid && CURRENT_ROOM_META.hostIsAnonymous) {
      updateDoc(doc(db, `rooms/${CURRENT_ROOM}`), {
        hostIsAnonymous: false,
        hostDisplayName: user.displayName || CURRENT_ROOM_META.hostDisplayName,
        hostPhotoURL: user.photoURL || null,
        updatedAt: serverTimestamp()
      }).catch(console.warn);
    }



  }

});





// ===== i18n → i18n.js に移動済み =====

// t(), applyI18n() は i18n.js から import 済み

initI18n();









// Googleプロバイダ

const google = new GoogleAuthProvider();



// ログインは login.html で行うため、ここではログアウトのみ



// ログアウト → すぐ匿名に戻してプレイ継続可

logoutBtn?.addEventListener('click', async () => {

  try {

    logoutBtn.disabled = true;

    await signOut(auth);

    await signInAnonymously(auth);

    alert('ログアウトしました。');

  } catch (e) {

    console.warn(e);

    alert('ログアウトに失敗しました。');

  } finally {

    logoutBtn.disabled = false;

  }

});



























function isCenterInsideRect(x, y, rect) {

  const cx = x + CARD_W / 2;

  const cy = y + CARD_H / 2;

  return cx >= rect.minX && cx <= rect.minX + rect.width && cy >= rect.minY && cy <= rect.minY + rect.height;

}













function isBoardMode() {

  const m = CURRENT_ROOM_META?.fieldMode;

  // 'board' と 'trump' をボード系モードとして扱う

  return (m === 'board' || m === 'trump');

}



function rectFromEl(el) {

  if (!el) return null;

  const fieldRect = field.getBoundingClientRect();

  const r = el.getBoundingClientRect();

  const minX = (r.left - fieldRect.left) / zoom;

  const minY = (r.top - fieldRect.top) / zoom;

  const width = r.width / zoom;

  const height = r.height / zoom;

  return { minX, minY, width, height };

}





// === レイアウト安定待ち（中央デッキの矩形が正しく測れるまで待つ） ===

async function waitForBoardDeckRect(maxWaitMs = 1000) {

  const start = performance.now();

  // 2フレーム待ち → 計測 → 必要なら繰り返し

  while (performance.now() - start < maxWaitMs) {

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const r = getDeckBoundsForSeat(1); // board/trump は共有デッキ

    if (r && r.width > 0 && r.height > 0) return r;

  }

  // 最悪でも null 返し（呼び出し側でフォールバック）

  return null;

}









// === 操作権限（ドラッグ/表裏）判定 ===

function isMyCard(cardEl) { return cardEl?.dataset?.ownerSeat === String(CURRENT_PLAYER); }

function allowOperateOthers() { 
  return !!(CURRENT_ROOM_META?.allowOthersMove || CURRENT_ROOM_META?.allowOtherOps); 
}

/**
 * 「かるた方式」: 他人の操作が許可されている場合、触れた瞬間に所有権を自分に移す
 * これにより同期の競合（引き戻し）を防ぎ、スムーズな操作を可能にする
 */
function maybeTakeOwnership(cardEl) {
  if (CURRENT_PLAYER === 'spectator') return; // 観戦者は操作権を奪えない
  if (allowOperateOthers() && !isMyCard(cardEl)) {
    const cardId = cardEl.dataset.cardId;
    if (!cardId) return;

    // Firestoreを更新
    updateCardBatched(cardId, { ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER });

    // DOMも即座に書き換えて、後続の権限チェックをパスさせる
    cardEl.dataset.ownerUid = CURRENT_UID;
    cardEl.dataset.ownerSeat = String(CURRENT_PLAYER);
    cardEl.setAttribute('data-owner', 'me');
    
    console.log(`[Karuta] 奪取成功: ${cardId}`);
  }
}

// kind: 'move' | 'flip' | 'delete' | 'rotate'

function canOperateCard(cardEl, kind) {
  if (CURRENT_PLAYER === 'spectator') return false;
  if (isMyCard(cardEl)) return true;

  if (allowOperateOthers()) {
    // 共有ONでも破壊的操作は不可のまま
    if (kind === 'delete' || kind === 'rotate') return false;
    return true; // move / flip を許可
  }

  return false;
}











function getHandBoundsForSeat(seat) {

  if (isBoardMode()) {

    const el = document.getElementById(`board-hand-${seat}`);

    return rectFromEl(el);

  } else {

    const hand = document.querySelector(`.player-${seat} .hand-area`);

    return rectFromEl(hand);

  }

}



function getDeckBoundsForSeat(seat) {

  const mode = CURRENT_ROOM_META?.fieldMode;

  if (mode === 'board' || mode === 'trump') {
    // ボードモード時は .board-hand-N を探す
    const el = document.querySelector(`#board-hand-${seat}`);
    if (el) return rectFromEl(el);
    
    // なければ共有エリアの中央
    const shared = document.querySelector('#board-play');
    if (shared) return rectFromEl(shared);
  }

  // 通常モードは .player-N .deck-area
  const deck = document.querySelector(`.player-${seat} .deck-area`);
  if (deck) return rectFromEl(deck);

  return null;
}





function getDiscardBoundsForSeat(seat) {

  const mode = CURRENT_ROOM_META?.fieldMode;

  if (mode === 'board' || mode === 'trump') {

    // 共有レイアウトの中央・捨て札

    const el = document.querySelector('#board-center .center-discard');

    return rectFromEl(el);

  }

  // 通常レイアウト（各プレイヤーの右列上段の縦スタックの上側）

  const el = document.querySelector(`.player-${seat} .discard-area`);

  return rectFromEl(el);

}





function getMainPlayBoundsForSeat(seat) {

  if (isBoardMode()) {

    // ボードモードでは角ハンド＆中央以外＝共有プレイエリア

    const el = document.getElementById('board-play');

    return rectFromEl(el);

  } else {

    const main = document.querySelector(`.player-${seat} .main-play-area`);

    return rectFromEl(main);

  }

}









// ===============================

// プレビュー画像の制御

// ===============================

// 選択カードのプレビュー表示/非表示を一元管理。

// 右側プレビューを表示/非表示する

// @param {string} src - 画像URL（空/undefinedで非表示）

//



function setPreview(src) {

  if (typeof src === 'string' && src.trim().length > 0) {

    if (typeof previewZoom !== 'undefined') {

      previewZoom = 1;

      previewPanX = 0;

      previewPanY = 0;

      applyPreviewTransform();

    }

    previewImg.src = src;

    previewImg.style.display = 'block';

  } else {

    previewImg.removeAttribute('src');   // ← これで “undefined:1” リクエストが出ない

    previewImg.style.display = 'none';

    if (typeof previewZoom !== 'undefined') {

      previewImg.style.transform = '';

    }

  }

}







// 座席のメインプレイ中央（w,h 指定版）

// 座席のプレイエリア中央座標を（幅/高さを考慮して）求める

// @param {number} seat - 座席(1..4)

// @param {number} w - 要素幅

// @param {number} h - 要素高

// @returns {object} {x:number,y:number}

//



function centerOfMainPlay(seat, w, h) {

  const b = getMainPlayBoundsForSeat(seat);

  if (!b) return { x: 0, y: 0 };

  const x = Math.round(b.minX + (b.width - w) / 2);

  const y = Math.round(b.minY + (b.height - h) / 2);

  return { x, y };

}





function centerOfDeck(seat, w, h) {
  const b = getDeckBoundsForSeat(seat);
  
  // 取得できない、または非表示要素の場合は安全なデフォルト位置を返す
  if (!b || (b.width === 0 && b.height === 0)) {
    console.warn("[LoadDebug] Could not get bounds for seat:", seat, "using fallback.");
    return { x: 400, y: 300 }; // 画面中央付近に出す
  }

  const x = Math.round(b.minX + (b.width - (w || 0)) / 2);
  const y = Math.round(b.minY + (b.height - (h || 0)) / 2);
  return { x, y };
}





function getCardsInsideRect(rect) {

  const cards = [];

  const rectRight = rect.minX + rect.width;

  const rectBottom = rect.minY + rect.height;



  document.querySelectorAll('.card').forEach(el => {

    const id = el.dataset.cardId;

    const left = parseFloat(el.style.left) || 0;

    const top = parseFloat(el.style.top) || 0;

    

    const cardRight = left + CARD_W;

    const cardBottom = top + CARD_H;



    const isInside = (left < rectRight && cardRight > rect.minX && top < rectBottom && cardBottom > rect.minY);

    

    if (isInside) {

      cards.push({ id, el });

    }

  });

  return cards;

}

function shuffleArray(arr) {

  for (let i = arr.length - 1; i > 0; i--) {

    const j = (Math.random() * (i + 1)) | 0;

    [arr[i], arr[j]] = [arr[j], arr[i]];

  }

  return arr;

}

function randomPointInDeck(seat) {

  const b = getDeckBoundsForSeat(seat);

  if (!b) return { x: Math.random() * 500 | 0, y: Math.random() * 500 | 0 };

  const maxX = Math.max(b.minX, b.minX + b.width - CARD_W);

  const maxY = Math.max(b.minY, b.minY + b.height - CARD_H);

  const x = b.minX + Math.random() * (maxX - b.minX);

  const y = b.minY + Math.random() * (maxY - b.minY);

  return { x: Math.round(x), y: Math.round(y) };

}





// ===============================

// ホスト監視

// ===============================

// ホスト不在・ルーム終了を検知して参加者を安全に退室させます。

// ホストが不在/ルーム終了になったかを定期確認し、必要なら強制退室させる

//



function startHostWatch() {

  stopHostWatch();

  hostWatchTimer = setInterval(async () => {

    if (!CURRENT_ROOM_META) return;

    const meta = CURRENT_ROOM_META;

    const roomId = (CURRENT_ROOM || (joinRoomInput?.value || '').trim() || null);



    // 既存: セッション中のゲストを安全に退室させる（ロビーでもwatchは回しつつ、kickはセッション中のみ）

    if (CURRENT_ROOM) {

      const iAmHost = !!(meta?.hostUid && CURRENT_UID && meta.hostUid === CURRENT_UID);

      const closed = !!meta?.roomClosed;

      const hostHere = isHostAlive(meta);

      if (!iAmHost && closed) {

        try {

          if (CURRENT_ROOM && CURRENT_PLAYER)

            releaseSeat(db, CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);

        } catch (_) { }

        if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; }

        if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; }

        if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; }

        if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }

        CURRENT_ROOM = null;

        CURRENT_PLAYER = null;

        stopHostWatch();

        sessionIndicator.textContent = 'ROOM: - / PLAYER: -';

        if (lobby) lobby.style.display = 'flex';

        alert('ホストがルームを終了したため、このルームは終了しました。');

        return;

      }

    }



    // 追加: 全席不在が続いていたら部屋を自動削除（ロビー表示中でも動く）

    if (roomId) {

      const empty = isRoomEmpty(); // 既存の空室判定

      const lastPingMs = meta?.lastSeatPing?.toMillis?.() ?? 0;

      const idleMs = lastPingMs ? (Date.now() - lastPingMs) : Number.POSITIVE_INFINITY;

      if (empty && idleMs > ROOM_EMPTY_GRACE_MS) {

        try { await cleanupAndDeleteRoom(db, roomId); }

        catch (e) { console.warn('auto delete failed', e?.code || e); }

      }

    }

  }, 5000); // 5秒ごと

}



function stopHostWatch() { if (hostWatchTimer) { clearInterval(hostWatchTimer); hostWatchTimer = null; } }











// ダイス画像（72x72）を作る関数（重複定義がないことを確認！）

// ===============================

// SVGジェネレータ: ダイス画像/カウンター画像

// ===============================/**

// ダイス目 (1..6) のSVG画像 DataURL を生成

// @param {number} n - 1..6

// @returns {string} data:image/svg+xml;...

//



function svgDiceDataUrl(n) {

  const size = 72, r = 8, pipR = 6;

  const pip = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="${pipR}" fill="#111"/>`;

  const g = [size * 0.22, size * 0.5, size * 0.78];

  const patterns = {

    1: [[1, 1]],

    2: [[0, 0], [2, 2]],

    3: [[0, 0], [1, 1], [2, 2]],

    4: [[0, 0], [0, 2], [2, 0], [2, 2]],

    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],

    6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],

  };

  const pips = (patterns[n] || []).map(([i, j]) => pip(g[i], g[j])).join('');

  const svg =

    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">

      <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${r}" ry="${r}" fill="#fff" stroke="#111" stroke-width="2"/>

      ${pips}

    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

}









//

// プレイエリア内のランダム座標（左上）を返す

// @param {number} seat - number

// @returns {object} {x,y}

//



function randomPointInMainPlay(seat) {

  const b = getMainPlayBoundsForSeat(seat);

  if (!b) return { x: Math.random() * 500 | 0, y: Math.random() * 500 | 0 };

  const maxX = Math.max(b.minX, b.minX + b.width - CARD_W);

  const maxY = Math.max(b.minY, b.minY + b.height - CARD_H);

  const x = b.minX + Math.random() * (maxX - b.minX);

  const y = b.minY + Math.random() * (maxY - b.minY);

  return { x: Math.round(x), y: Math.round(y) };

}











// ===============================

// 認証準備

// ===============================

// UID 初期化完了を待つ Promise。

// Auth UID が利用可能になるのを待つ Promise を返す

// @returns {Promise<void>} 

//



async function ensureAuthReady(timeoutMs = 8000) {

  // すでに確定していれば即帰る

  const uNow = auth.currentUser;

  if (uNow && CURRENT_UID !== uNow.uid) CURRENT_UID = uNow.uid;

  if (CURRENT_UID) return;



  // ユーザーが居なければ匿名サインインを強制（モバイルSafari等の遅延対策）

  if (!auth.currentUser) {

    try { await signInAnonymously(auth); } catch (_) { }

  }



  // onAuthStateChanged で UID が来るのを待つ（タイムアウト付き）

  await new Promise((resolve, reject) => {

    const off = onAuthStateChanged(auth, (u) => {

      if (u) { 
        CURRENT_UID = u.uid; 
        renderSeatAvailability(); // UIDが決まったので座席表示を更新
        off(); 
        resolve(); 
      }

    });

    setTimeout(() => { try { off(); } catch { }; reject(new Error('auth-timeout')); }, timeoutMs);

  });

}







// ===============================

// ロビー/座席管理

// ===============================

// 座席の空き状況やホスト在席を購読し、UI へ反映。

// ===== seats & lobby

let unsubscribeSeats = null;





const currentSeatMap = { 1: null, 2: null, 3: null, 4: null };



// === HP（本人マスター） ===

// モジュールへ移管（状態は hp.js で export して参照可能）





function isSeatStale(data) {
  if (!data || !data.heartbeatAt) return true;
  const hb = data.heartbeatAt?.toMillis ? data.heartbeatAt.toMillis() : 0;
  return (Date.now() - hb) > SEAT_STALE_MS;
}







// 追加: 全席が空(=生きていない)かを判定

function isRoomEmpty() {
  if (IS_ROOM_CREATOR) return false;

  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(s => {
    const d = currentSeatMap[s];
    return !d || isSeatStale(d) || !d.claimedByUid;
  });
}

function renderSeatAvailability() {
  const hostHere = isHostAlive(CURRENT_ROOM_META);
  const roomEmpty = isRoomEmpty();

  seatButtons.forEach(btn => {

    const val = btn.dataset.seat;

    const seat = val === 'spectator' ? 'spectator' : parseInt(val, 10);

    if (seat === 'spectator') return; // 観戦ボタンは状態表示(seat-note)がないためスキップ

    const note = btn.querySelector('.seat-note');

    const data = currentSeatMap[seat];
    const isMe = data && data.claimedByUid === CURRENT_UID;
    const alive = data && !isSeatStale(data) && !!data.claimedByUid && !isMe;

    if (isMe) {
      if (note) note.textContent = `(あなたの席)`;
      btn.disabled = false;
      btn.classList.add('free');
      btn.classList.add('is-me');
    } else if (alive) {
      if (note) note.textContent = data.displayName || `SEAT${seat}`;
      btn.disabled = true;
      btn.classList.remove('free');
      btn.classList.remove('is-me');
    } else {
      note.textContent = '空席';
      btn.disabled = false;
      btn.classList.add('free');
      btn.classList.remove('is-me');
    }

  });

  // validateLobby();
}







// renderHPPanel は hp.js へ移管





// ===== area colors (no change in write count; low frequency)

// 特殊エリア(special)・捨て札(discard)を追加

const DEFAULT_AREA_COLORS = {

  deck: '#ff9900',

  main: '#22dd88',

  hand: '#228be6',

  special: '#9c27b0',

  discard: '#cc6666'

};





function getSeatAreaColor(seat, zone) {

  const ac = currentSeatMap[seat]?.areaColors || {};

  return ac[zone] || DEFAULT_AREA_COLORS[zone];

}

function renderAreaColors() {

  const currentSeats = Object.keys(currentSeatMap).map(Number);

  const seatsToCheck = currentSeats.length > 0 ? currentSeats : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const seat of seatsToCheck) {

    const root = document.querySelector(`.player-${seat}`);

    if (!root) continue;



    const deck = root.querySelector('.deck-area');

    const main = root.querySelector('.main-play-area');

    const hand = root.querySelector('.hand-area');

    const special = root.querySelector('.special-area');

    const discard = root.querySelector('.discard-area');



    if (deck) deck.style.backgroundColor = getSeatAreaColor(seat, 'deck');

    if (main) main.style.backgroundColor = getSeatAreaColor(seat, 'main');

    if (hand) hand.style.backgroundColor = getSeatAreaColor(seat, 'hand');

    if (special) special.style.backgroundColor = getSeatAreaColor(seat, 'special');

    if (discard) discard.style.backgroundColor = getSeatAreaColor(seat, 'discard');



  }

}

async function triggerAreaColorPicker(el, seat, key) {

  if (seat !== CURRENT_PLAYER) return;

  if (!CURRENT_ROOM) return;



  const input = document.createElement('input');

  input.type = 'color';

  input.value = getSeatAreaColor(seat, key);

  input.style.position = 'fixed';

  input.style.left = '-9999px';

  document.body.appendChild(input);



  input.addEventListener('change', async () => {

    const picked = input.value;

    el.style.background = picked;

    const prev = (currentSeatMap[seat]?.areaColors) || {};

    const next = { ...prev, [key]: picked };

    updateSeatBatched(seat, { areaColors: next, updatedAt: serverTimestamp() });

    input.remove();

  }, { once: true });



  input.click();

}



function bindAreaColorHandlers() {

  const currentSeats = Object.keys(currentSeatMap).map(Number);

  const seatsToCheck = currentSeats.length > 0 ? currentSeats : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const seat of seatsToCheck) {

    const root = document.querySelector(`.player-${seat}`);

    if (!root) continue;



    [

      { el: root.querySelector('.deck-area'), key: 'deck' },

      { el: root.querySelector('.main-play-area'), key: 'main' },

      { el: root.querySelector('.hand-area'), key: 'hand' },

      { el: root.querySelector('.special-area'), key: 'special' },

      { el: root.querySelector('.discard-area'), key: 'discard' },

    ].forEach(({ el, key }) => {

      if (!el || el.__colorHandlerBound) return;

      el.__colorHandlerBound = true;

      el.classList.add('zone-colorable');

      el.addEventListener('dblclick', async (ev) => {

        ev.stopPropagation();

        triggerAreaColorPicker(el, seat, key);

      });

    });

  }

}



function renderFieldLabels() {

  for (const s of getPlayerSeatsArray()) {

    // --- カード用: 既存の .player-label を更新 ---

    {

      const area = document.querySelector(`.player-${s}`);

      const seatEl = area?.querySelector('.player-label .label-seat');

      const nameEl = area?.querySelector('.player-label .label-name');

      if (seatEl) seatEl.textContent = `SEAT${s}`;

      if (nameEl) {

        const seatData = currentSeatMap[s] || null;

        const displayName = seatData?.displayName || '';

        const isHostSeat = (CURRENT_ROOM_META?.hostSeat === s);

        nameEl.textContent = displayName ? `${displayName}${isHostSeat ? '（ホスト）' : ''}` : '';

      }

    }



    // --- 追加: ボード / トランプ用の .board-name を更新 ---

    {

      const handEl = document.getElementById(`board-hand-${s}`);

      const seatElB = handEl?.querySelector('.board-name .label-seat');

      const nameElB = handEl?.querySelector('.board-name .label-name');

      if (seatElB) seatElB.textContent = `SEAT${s}`;

      if (nameElB) {

        const seatData = currentSeatMap[s] || null;

        const displayName = seatData?.displayName || '';

        const isHostSeat = (CURRENT_ROOM_META?.hostSeat === s);

        nameElB.textContent = displayName ? `${displayName}${isHostSeat ? '（ホスト）' : ''}` : '';

      }

    }

  }

}





// ==== 追加: フィールドモードの適用（DOM切替） ====

// ===============================

// フィールド構成切替 (カード/ボード)

// ===============================

// roomMeta.fieldMode に応じて DOM を切替え。

function applyFieldModeLayout() {
  const m = CURRENT_ROOM_META?.fieldMode;
  // 'board', 'trump', 'chess' をボード系DOMにマップ
  const mode = (m === 'board' || m === 'trump' || m === 'chess') ? 'board' : 'card';
  const fieldRoot = document.getElementById('field');
  if (!fieldRoot) return;

  fieldRoot.classList.toggle('mode-card', mode === 'card');
  fieldRoot.classList.toggle('mode-board', mode === 'board');

  const pc = getPlayerSeatsCount();
  const layout = CURRENT_ROOM_META?.fieldLayout || 'standard';

  // ボードレイアウトへのクラス適用
  const boardLayoutEl = document.getElementById('board-layout');
  if (boardLayoutEl) {
    boardLayoutEl.classList.toggle('layout-simple', layout === 'simple');
    boardLayoutEl.classList.toggle('layout-standard', layout === 'standard');
    boardLayoutEl.classList.toggle('layout-playonly', layout === 'playonly');
    
    // Chess などのプレイエリア背景画像の設定
    const boardPlayEl = document.getElementById('board-play');
    if (boardPlayEl) {
      if (m === 'chess') {
        boardPlayEl.style.backgroundImage = "url('image/Chess/ChessBoard.png')";
        boardPlayEl.style.backgroundSize = "contain";
        boardPlayEl.style.backgroundRepeat = "no-repeat";
        boardPlayEl.style.backgroundPosition = "center";
        // チェス盤は正方形なので、アスペクト比を維持するためのスタイルが必要かもしれません
      } else {
        boardPlayEl.style.backgroundImage = "";
      }
    }
  }

  // Hide or show `.player-area` nodes dynamically
  for (let i = 1; i <= 10; i++) {
    const el = document.querySelector(`.player-${i}`);
    if (el) {
      el.style.display = (mode === 'card' && i <= pc) ? '' : 'none';
      if (mode === 'card') {
        el.classList.toggle('layout-simple', layout === 'simple');
        el.classList.toggle('layout-standard', layout === 'standard');
      }
    }
  }

  // ボードモードでの手札表示制御 (playonly の場合は非表示)
  if (mode === 'board') {
    const isPlayOnly = (layout === 'playonly');
    for (let i = 1; i <= 10; i++) {
      const handEl = document.getElementById(`board-hand-${i}`);
      if (handEl) {
        handEl.style.display = (isPlayOnly || i > pc) ? 'none' : 'block';
      }
    }
  }

  // ホストの場合、ボードレイアウトの各エリアをリサイズ可能にする
  if (mode === 'board') {
    const isHost = CURRENT_UID && CURRENT_ROOM_META?.hostUid === CURRENT_UID;
    console.log('[ResizeDebug] applyFieldModeLayout - mode:board, isHost:', isHost);
    if (isHost) {
      const areaSelectors = ['#board-play', '.board-hand', '#board-center', '.center-deck', '.center-discard', '.dynamic-area'];
      const targets = document.querySelectorAll(areaSelectors.join(','));
      console.log(`[ResizeDebug] Found ${targets.length} target elements for resizing`);
      targets.forEach(el => {
        const id = el.id || el.dataset.areaId;
        if (id) makeAreaResizable(el, id);
      });
    }
  }
}

// ===============================

// ハートビート

// ===============================

// ホスト/座席の存活を定期更新し、他クライアントが監視できるようにします。

// ===== heartbeats (rate-limited)

let heartbeatTimer = null;

let hostHeartbeatTimer = null;


/**
 * 盤面の簡易プレビュー（スクリーンショット）を生成する
 */
async function generateBoardPreview() {
  try {
    const field = document.getElementById('field') || document.getElementById('game-field');
    if (!field) {
      console.warn('[Preview] フィールド要素 (#field / #game-field) が見つかりません');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const fieldRect = field.getBoundingClientRect();
    const zoomVal = typeof zoom !== 'undefined' ? zoom : 1;

    // 色取得ヘルパー: 透明なら親を遡る、または子から探す
    const getEffectiveBackgroundColor = (el) => {
      // 1. 本人の色を確認
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;

      // 2. 子要素から「一番面積の大きい背景色」を探す（フィールド自体が透明なケース対策）
      const children = Array.from(el.querySelectorAll('div'));
      let bestBg = null;
      let maxArea = 0;
      for (const child of children) {
        const cStyle = window.getComputedStyle(child);
        const cBg = cStyle.backgroundColor;
        if (cBg && cBg !== 'rgba(0, 0, 0, 0)' && cBg !== 'transparent') {
          const area = child.offsetWidth * child.offsetHeight;
          if (area > maxArea) {
            maxArea = area;
            bestBg = cBg;
          }
        }
      }
      if (bestBg) return bestBg;

      // 3. 親を遡る
      let current = el.parentElement;
      while (current && current !== document.body) {
        const pStyle = window.getComputedStyle(current);
        const pBg = pStyle.backgroundColor;
        if (pBg && pBg !== 'rgba(0, 0, 0, 0)' && pBg !== 'transparent') return pBg;
        current = current.parentElement;
      }
      return '#2ecc71'; // 最終手段の緑
    };

    // 1. フィールド背景の決定
    const actualFieldBg = getEffectiveBackgroundColor(field);
    ctx.fillStyle = actualFieldBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 描画対象エリアの収集（ボードレイアウト用セレクターを追加）
    const selectors = [
      '.player-area', '.shared-play-area', '.deck-area', '.discard-area', '.special-area', 
      '.hand-area', '.main-play-area', '.zone', '.zone-area', '.field-background',
      '#board-play', '.board-hand', '.center-deck', '.center-discard', '#board-center',
      '[class*="hand-area"]', '[class*="play-area"]', '[class*="player-slot"]', '[id*="board"]'
    ];
    const rawAreas = Array.from(document.querySelectorAll(selectors.join(',')));
    const areas = [...new Set(rawAreas)].filter(el => {
      // 非表示の要素は除外
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    });
    
    console.log(`[Preview] 有効なエリア候補数: ${areas.length}`);

    const getRelativePos = (el) => {
      const r = el.getBoundingClientRect();
      return {
        l: (r.left - fieldRect.left) / zoomVal,
        t: (r.top - fieldRect.top) / zoomVal,
        w: r.width / zoomVal,
        h: r.height / zoomVal
      };
    };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const validAreas = [];

    areas.forEach(el => {
      const pos = getRelativePos(el);
      if (pos.w < 2 || pos.h < 2) return; 
      
      validAreas.push({ el, pos });
      minX = Math.min(minX, pos.l); minY = Math.min(minY, pos.t);
      maxX = Math.max(maxX, pos.l + pos.w); maxY = Math.max(maxY, pos.t + pos.h);
    });

    const cardEls = Array.from(document.querySelectorAll('.card:not(.template)'));
    cardEls.forEach(el => {
      const pos = getRelativePos(el);
      minX = Math.min(minX, pos.l); minY = Math.min(minY, pos.t);
      maxX = Math.max(maxX, pos.l + pos.w); maxY = Math.max(maxY, pos.t + pos.h);
    });

    if (minX === Infinity) {
      console.warn('[Preview] 描画対象が見つかりません');
      return null;
    }

    const margin = 30;
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;
    const width = maxX - minX;
    const height = maxY - minY;

    const scale = Math.min(canvas.width / width, canvas.height / height);
    const offsetX = (canvas.width - width * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - height * scale) / 2 - minY * scale;

    // エリア描画
    validAreas.forEach(({ el, pos }) => {
      const style = window.getComputedStyle(el);
      const drawX = pos.l * scale + offsetX;
      const drawY = pos.t * scale + offsetY;
      const drawW = pos.w * scale;
      const drawH = pos.h * scale;

      const bgColor = style.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      const border = style.borderStyle;
      if (border && border !== 'none') {
        ctx.strokeStyle = style.borderColor || 'rgba(255,255,255,0.2)';
        ctx.lineWidth = Math.max(1, 1 * scale);
        if (border === 'dashed' || border === 'dotted') ctx.setLineDash([2, 2]);
        ctx.strokeRect(drawX, drawY, drawW, drawH);
        ctx.setLineDash([]);
      }
    });

    // カード描画
    cardEls.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    cardEls.forEach(el => {
      const pos = getRelativePos(el);
      const drawX = pos.l * scale + offsetX;
      const drawY = pos.t * scale + offsetY;
      const drawW = pos.w * scale;
      const drawH = pos.h * scale;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(drawX + 1, drawY + 1, drawW, drawH);

      if (el.dataset.faceUp === 'true') {
        const img = el.querySelector('img');
        if (img && img.complete && img.naturalWidth > 0) {
          try {
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          } catch (e) {
            ctx.fillStyle = '#333'; ctx.fillRect(drawX, drawY, drawW, drawH);
          }
        } else {
          ctx.fillStyle = '#333'; ctx.fillRect(drawX, drawY, drawW, drawH);
        }
      } else {
        ctx.fillStyle = '#000'; // 裏面を黒に
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      const input = el.querySelector('.token-input');
      if (input && input.value) {
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(6, 8 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(input.value.slice(0, 10), drawX + drawW/2, drawY + drawH/2, drawW * 0.9);
      }
      
      const num = el.querySelector('.num-val');
      if (num) {
        ctx.fillStyle = '#d32f2f';
        ctx.font = `bold ${Math.max(8, 14 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(num.textContent, drawX + drawW/2, drawY + drawH/2);
      }
    });

    console.log(`[Preview] 生成完了 (エリア:${validAreas.length}, カード:${cardEls.length}, 色:${actualFieldBg})`);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (e) {
    console.error('[Preview] プレビュー生成エラー:', e);
    return null;
  }
}

let lastScreenshotTime = 0;
const SCREENSHOT_INTERVAL_MS = 60000; // 1分ごと（テストのため短縮）

// [HB] host heartbeat

function startHostHeartbeat(roomId) {
  if (hostHeartbeatTimer) return;

  hostHeartbeatTimer = setInterval(async () => {
    try {
      if (!CURRENT_ROOM || CURRENT_ROOM !== roomId) return;
      if (CURRENT_ROOM_META?.roomClosed) return;

      // 統計情報の取得
      const [cardsCountSnap, chatCountSnap] = await Promise.all([
        getCountFromServer(collection(db, `rooms/${roomId}/cards`)),
        getCountFromServer(collection(db, `rooms/${roomId}/chat`))
      ]).catch(e => { console.warn('count fetch failed', e); return [null, null]; });

      const updatePayload = {
        hostHeartbeatAt: serverTimestamp(),
        lastSeatPing: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (cardsCountSnap) updatePayload.cardsCount = cardsCountSnap.data().count;
      if (chatCountSnap) updatePayload.chatCount = chatCountSnap.data().count;

      // 定期的なプレビュー画像生成とアップロード（1分おき）
      const now = Date.now();
      if (now - lastScreenshotTime > SCREENSHOT_INTERVAL_MS) {
        console.log('[Preview] プレビュー生成を開始します...');
        lastScreenshotTime = now;
        const dataUrl = await generateBoardPreview();
        if (dataUrl) {
          try {
            console.log('[Preview] 画像生成成功、アップロード中...');
            const previewRef = ref(storage, `rooms/${roomId}/preview.jpg`);
            await uploadString(previewRef, dataUrl, 'data_url');
            const url = await getDownloadURL(previewRef);
            updatePayload.previewUrl = url;
            console.log('[Preview] アップロード完了:', url);
          } catch (err) {
            console.error('[Preview] アップロード失敗:', err);
          }
        } else {
          console.warn('[Preview] 画像生成に失敗しました（要素が見つかりません）');
        }
      }

      await updateDoc(doc(db, `rooms/${roomId}`), updatePayload);

    } catch (e) { console.warn('host HB failed', e); }
  }, HOST_HEARTBEAT_MS);

}

function stopHostHeartbeat() { if (hostHeartbeatTimer) { clearInterval(hostHeartbeatTimer); hostHeartbeatTimer = null; } }

function updateAuthIndicator(user) {
  if (!authIndicator) return;
  if (!user || user.isAnonymous) {
    authIndicator.innerHTML = `
      <a href="./login.html" class="login-btn">ログイン</a>
    `;
  } else {
    const photo = user.photoURL;
    const name = user.displayName || user.email || 'Player';
    const initial = name.charAt(0).toUpperCase();
    authIndicator.innerHTML = `
      <a href="./mypage.html" class="avatar-btn" title="マイページへ">
        ${photo ? `<img src="${photo}" alt="Avatar">` : initial}
      </a>
    `;
  }
}



// detachHPListener は hp.js へ移管





initHP({

  db, doc, setDoc, onSnapshot, serverTimestamp, ensureAuthReady,

  document, alert: (m) => alert(m),

  getState: () => ({

    CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID, CURRENT_ROOM_META, currentSeatMap

  })

});





function loadSeatStatus(rid) {

  detachHPListener(); // ★ ルーム切替時にHP購読を解除（hp.js）

  if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; }

  const roomId = rid || CURRENT_ROOM || '';



  CURRENT_ROOM_META = null;

  IS_ROOM_CREATOR = false;

  stopHostHeartbeat();

  stopHostWatch();

  renderFieldLabels();



  if (!roomId) { return; }



  unsubscribeRoomDoc = onSnapshot(doc(db, `rooms/${roomId}`), snap => {

    // ルームdocが削除された（exists=false）→ 即退室（参加者側）

    if (!snap.exists()) {

      CURRENT_ROOM_META = null;

      // いま実プレイ中で、この roomId に居るなら強制退室

      if (CURRENT_ROOM === roomId && (!lobby || lobby.style.display === 'none')) {

        try {

          if (CURRENT_ROOM && CURRENT_PLAYER)

            releaseSeat(db, CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);

        } catch (_) { }

        try { if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; } } catch (_) { }

        try { if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; } } catch (_) { }

        try { if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; } } catch (_) { }

        try { if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; } } catch (_) { }

        CURRENT_ROOM = null;

        CURRENT_PLAYER = null;

        stopHostWatch();

        sessionIndicator.textContent = 'ROOM: - / PLAYER: -';

        if (lobby) lobby.style.display = 'flex';

        alert('ホストがルームを削除しました。');

      }

      renderFieldLabels(); renderAreaColors(); updateEndRoomButtonVisibility(); updateLeaveRoomButtonVisibility(); renderHPPanel();

      return;

    }

    // 存在する場合の通常処理

    CURRENT_ROOM_META = snap.data();



    // 匿名ホストからGoogle/メールログインにアップグレードした場合、ルームを無期限化（expiresAtを削除）
    if (CURRENT_ROOM_META?.expiresAt && auth.currentUser && !auth.currentUser.isAnonymous && CURRENT_ROOM_META.hostUid === CURRENT_UID) {
      updateDoc(doc(db, `rooms/${roomId}`), { expiresAt: null, updatedAt: serverTimestamp() }).catch(e => console.warn('Room upgrade failed', e));
    }



    // UI反映

    applyOtherOpsUI();
    applyCardSizeUI();
    applyBoardSizeUI();

    applyFieldModeLayout();

    IS_ROOM_CREATOR = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);

    if (IS_ROOM_CREATOR && CURRENT_ROOM_META?.needsInitialization) {
      // Clear flag first to avoid multiple triggers
      updateDoc(doc(db, `rooms/${roomId}`), { needsInitialization: false });
      initializeOfficialGame(CURRENT_ROOM_META.fieldMode, roomId);
    }

    if (IS_ROOM_CREATOR) startHostHeartbeat(roomId);

    startHostWatch(); // 追加: ロビー中も空室監視/自動削除を回す

    renderFieldLabels(); renderAreaColors(); updateEndRoomButtonVisibility(); updateLeaveRoomButtonVisibility(); renderHPPanel();

  });





// ※ ここで updatedAt を書かない（以前は軽く触るだけで1書き込み発生していた）



  // seat docs listen

  const seatDocs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => doc(db, `rooms/${roomId}/seats/${n}`));

  const unsubs = seatDocs.map((ref, idx) => onSnapshot(ref, snap => {



    // 既存の currentSeatMap 更新はそのまま残してください

    if (snap.exists()) {

      const d = snap.data() || {};

      // 互換重視なら Object.assign を使う（spreadが苦手な環境でもOK）

      currentSeatMap[idx + 1] = Object.assign(

        {},

        currentSeatMap[idx + 1] || {},

        {

          displayName: d.displayName || '',

          claimedByUid: d.claimedByUid || null,

          heartbeatAt: d.heartbeatAt || null,

          areaColors: d.areaColors || {},

          // 追加: 背面画像URL（オーナーが選択したもの）

          backImageUrl: d.backImageUrl || null,

        }

      );

    } else {

      currentSeatMap[idx + 1] = null;

    }



    // === ここから追加：全席の占有/生存状況を判定し、idle 監視の基準時刻を更新 ===

    try {

      const now = Date.now();

      // fresh := 「座っていて、かつ heartbeat が STALE ではない」

      const isFresh = (d) => {

        if (!d) return false;

        const hb =

          d.heartbeatAt && typeof d.heartbeatAt.toMillis === 'function'

            ? d.heartbeatAt.toMillis()

            : 0;

        return !!d.claimedByUid && (now - hb) < SEAT_STALE_MS;

      };

      // 現在の全席の状態から、誰かが“生存”しているかを判定

      const someoneFresh = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some(n => isFresh(currentSeatMap[n]));

      if (someoneFresh) {

        // 最後に“だれか座っていた”時刻を更新（この変数名はあなたの実装に合わせて）

        if (typeof lastNonEmptyAt !== 'undefined') lastNonEmptyAt = now;

      }

    } catch (e) {

      console.warn('idle-watch check error', e);

    }



    renderAreaColors();

    renderSeatAvailability();

    updateSessionIndicator();

    renderHPPanel();   //座席更新が入ったらHPパネルも即リフレッシュ（hp.js）

    // 追加: その席のカード裏背景を再適用

    refreshCardBacksForSeat(idx + 1);



  }));

  unsubscribeSeats = () => unsubs.forEach(fn => fn());

}









//startBtn.addEventListener('click', async (ev) => {

// UID 未確定で開始に失敗するのを防ぐ

//await ensureAuthReady();













// subscribeHP は hp.js へ移管













// ===============================

// 座席の取得/解放

// ===============================

// トランザクションで安全に座席を確保/解放します。

// 座席をトランザクションで確保（古い/空き/自分なら上書き）

// @param {string} roomId - string

// @param {number} seat - number

// @returns {Promise<boolean>} 成功可否

//



async function claimSeat(roomId, seat) {

  if (seat === 'spectator') return true;

  const seatRef = doc(db, `rooms/${roomId}/seats/${seat}`);

  const displayName = localStorage.getItem('pa:last-player-name') || 'Guest';

  const color = '#22aaff';

  try {

    const success = await runTransaction(db, async (tx) => {

      const snap = await tx.get(seatRef);

      if (!snap.exists()) {

        tx.set(seatRef, { claimedByUid: CURRENT_UID, displayName, color, claimedAt: serverTimestamp(), heartbeatAt: serverTimestamp() });

        return true;

      }

      const data = snap.data();

      const stale = isSeatStale(data);

      if (!data.claimedByUid || stale || data.claimedByUid === CURRENT_UID) {

        tx.set(seatRef, { claimedByUid: CURRENT_UID, displayName, color, claimedAt: serverTimestamp(), heartbeatAt: serverTimestamp() });

        return true;

      }

      return false;

    });

    return success;

  } catch (e) { console.error('claimSeat error', e); return false; }

}





// === 背面画像関連 ===

function seatBackUrl(seat) {

  const s = currentSeatMap && currentSeatMap[seat];

  return (s && typeof s.backImageUrl === 'string' && s.backImageUrl) ? s.backImageUrl : null;

}



// 席ごとの裏面URL（未設定ならデフォルトのトランプ裏面にフォールバック）

function getSeatBackUrl(seat) {

  const url = seatBackUrl(seat);

  return url || TRUMP_BACK_URL;

}



function applyCardBackStyle(card) {
  if (card.classList.contains('memo')) {
    card.style.backgroundColor = '#fff';
    card.style.backgroundImage = '';
    card.classList.remove('has-back');
    return;
  }

  // 裏面の背景を適用（カード固有の背面画像 > 席の設定 > 黒）

  const cardBackUrl = card.dataset.backImageUrl || null;
  const seat = parseInt(card.dataset.ownerSeat || '0', 10);
  const url = cardBackUrl || seatBackUrl(seat);

  card.style.backgroundColor = '#000';

  if (url) {

    card.classList.add('has-back');

    card.style.backgroundImage = `url("${url}")`;

  } else {

    card.classList.remove('has-back');

    card.style.backgroundImage = '';

  }

}

function refreshCardBacksForSeat(seat) {

  // 指定席の全カードについて、裏向きなら背面を塗り直す

  cardDomMap.forEach((el) => {

    if (parseInt(el.dataset.ownerSeat || '0', 10) !== seat) return;
    if (el.classList.contains('memo')) return;

    const img = el.querySelector('img');

    const isFaceUp = !!img && img.style.display !== 'none';

    if (!isFaceUp) applyCardBackStyle(el);

  });

}







async function startHeartbeat(roomId, seat) {

  stopHeartbeat();

  if (seat === 'spectator') return;

  heartbeatTimer = setInterval(async () => {

    try {



      const now = Date.now();



      // 直近の操作が無い → 完全スキップ（ただし5分に1回は維持）

      const active = (now - lastActivityAt) < ACTIVE_WINDOW_MS;

      const needIdleKeepAlive = (now - lastSeatHBWriteAt) > IDLE_KEEPALIVE_MS;

      if (active || needIdleKeepAlive) {

        updateSeatBatched(seat, { heartbeatAt: serverTimestamp() });

        lastSeatHBWriteAt = now;

      }



      // ルーム直下の更新はホストのみ（ルール準拠）

      if (now - __roomPingAt > ROOM_PING_MS) {

        __roomPingAt = now;

        const iAmHost = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);

        if (iAmHost) {

          // 部屋のHBはホストだけが更新

          await setDoc(doc(db, `rooms/${roomId}`), { hostHeartbeatAt: serverTimestamp() }, { merge: true });

        }

        // 非ホストは rooms 直下には一切書かない

      }



    } catch (e) { console.warn('HB error', e); }

  }, SEAT_HEARTBEAT_MS);

}



function stopHeartbeat() { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } }



// ===== Cards / UI

const field = document.getElementById("field");

const container = document.getElementById("container");

const previewImg = document.getElementById("preview-img");

const previewInfo = document.getElementById("preview-info");

const previewTop = document.getElementById("preview-top");



let previewZoom = 1;

let previewPanX = 0;

let previewPanY = 0;

let isPreviewDragging = false;

let previewDragStartX = 0;

let previewDragStartY = 0;



window.applyPreviewTransform = function() {

  if (previewImg) {

    previewImg.style.transform = `translate(${previewPanX}px, ${previewPanY}px) scale(${previewZoom})`;

    previewImg.style.transformOrigin = 'center';

  }

};



if (previewTop) {

  previewTop.addEventListener('wheel', (e) => {

    e.preventDefault();

    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;

    previewZoom = Math.max(0.5, Math.min(5, previewZoom + zoomDelta));

    applyPreviewTransform();

  }, { passive: false });



  previewTop.addEventListener('mousedown', (e) => {

    if (e.button !== 0) return;

    isPreviewDragging = true;

    previewDragStartX = e.clientX - previewPanX;

    previewDragStartY = e.clientY - previewPanY;

  });



  window.addEventListener('mousemove', (e) => {

    if (!isPreviewDragging) return;

    previewPanX = e.clientX - previewDragStartX;

    previewPanY = e.clientY - previewDragStartY;

    applyPreviewTransform();

  });



  window.addEventListener('mouseup', () => {

    isPreviewDragging = false;

  });



  previewTop.addEventListener('touchstart', (e) => {

    if (e.touches.length !== 1) return;

    isPreviewDragging = true;

    previewDragStartX = e.touches[0].clientX - previewPanX;

    previewDragStartY = e.touches[0].clientY - previewPanY;

  }, { passive: true });

  window.addEventListener('touchmove', (e) => {

    if (!isPreviewDragging || e.touches.length !== 1) return;

    previewPanX = e.touches[0].clientX - previewDragStartX;

    previewPanY = e.touches[0].clientY - previewDragStartY;

    applyPreviewTransform();

  }, { passive: true });

  window.addEventListener('touchend', () => {

    isPreviewDragging = false;

  });

}

const uploadCard = document.getElementById("upload-card");

const fileInputCard = document.getElementById("file-input-card");

const uploadToken = document.getElementById("upload-token");

const fileInputToken = document.getElementById("file-input-token");

const fieldSizeOptions = document.getElementById("field-size-options");



const fullImageStore = new Map(); // key: cardId, value: dataURL(full)



let unsubscribeCards = null;

let handlersBound = false;





// ==== 退室通知: タブ閉じ/アプリ終了時のみ ====

let __lifecycleBound = false;

function bindLifecycleHandlers() {

  if (__lifecycleBound) return; __lifecycleBound = true;



  // 退室処理（「タブ閉じ/終了」のみで呼ぶ）

  const leaveSafely = async (reason) => {

    try {

      if (!CURRENT_ROOM || !CURRENT_PLAYER) return;

      // 心拍を止めてから解放（race低減）

      try { stopHeartbeat(); } catch (_) { }

      // ★ タブ閉じ時も、できる限り自分のカードを先に消す（非ホストのみ）

      try { await deleteMyCardsSilently(); } catch (_) { }

      // できるだけ早く席を解放（非同期ベストエフォート）

      // Firestore 書き込みはタイミング次第で完了しない可能性もあるが、

      // pagehide の段階なら概ね実行時間が確保される。

      await releaseSeat(db, CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);

    } catch (e) {

      console.warn('[leaveSafely] failed', e);

    }

  };



  // iOS/Safari/Discord内ブラウザ含め「ページを去る」タイミング

  // - pagehide: iOSでホームへスワイプ/タブを閉じる/インアプリブラウザ閉じ で発火

  // - beforeunload: 伝統的なタブ閉じやナビゲーション

  // - freeze: BFCache へ入る直前（Safari/Chrome系の一部）

  window.addEventListener('pagehide', (e) => { leaveSafely('pagehide'); }, { once: true });

  window.addEventListener('beforeunload', (e) => { leaveSafely('beforeunload'); }, { once: true });

  document.addEventListener?.('freeze', () => { leaveSafely('freeze'); }, { once: true });



}



















// ===============================

// セッション開始

// ===============================



function updateSessionIndicator() {
  if (!CURRENT_ROOM || !CURRENT_PLAYER) {
    sessionIndicator.innerHTML = '<div>ROOM: -</div><div>PLAYER: -</div><div>SEAT: -</div>';
    return;
  }
  let pName = localStorage.getItem('pa:last-player-name') || 'Guest';
  let seatDisplay = '観戦';
  if (CURRENT_PLAYER !== 'spectator') {
    const seatData = currentSeatMap[CURRENT_PLAYER];
    if (seatData && seatData.displayName) pName = seatData.displayName;
    seatDisplay = `${CURRENT_PLAYER}`; // SEATを省く
  }

  // 残り時間の計算
  let expiryText = '';
  if (CURRENT_ROOM_META?.expiresAt) {
    try {
      const exp = CURRENT_ROOM_META.expiresAt.toMillis();
      const diffMs = exp - Date.now();
      const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
      if (diffHrs > 0) {
        expiryText = ` (${diffHrs}時間後に削除)`;
      } else {
        expiryText = ` (間もなく削除)`;
      }
    } catch (e) { console.warn('Expiry calculation error', e); }
  }

  sessionIndicator.innerHTML = `
    <div>ROOM: ${CURRENT_ROOM}${expiryText}</div>
    <div>PLAYER: ${pName}</div>
    <div>SEAT: ${seatDisplay}</div>
  `;
  
  // 1分ごとに表示を更新するためのタイマー（まだなければ設定）
  if (!window._indicatorTimerId) {
    window._indicatorTimerId = setInterval(() => {
      updateSessionIndicator();
    }, 60000);
  }
  
  const sitBtn = document.getElementById('sit-seat-btn');
  const leaveBtn = document.getElementById('leave-seat-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');

  if (CURRENT_PLAYER === 'spectator') {
    if (sitBtn) {
      sitBtn.style.display = 'block';
      sitBtn.classList.add('pulse-yellow');
    }
    if (leaveBtn) leaveBtn.style.display = 'none';
  } else {
    if (sitBtn) {
      sitBtn.style.display = 'none';
      sitBtn.classList.remove('pulse-yellow');
    }
    if (leaveBtn) leaveBtn.style.display = 'block';
  }
}





// ルーム/座席が決まった後の購読開始やUI初期化。

// 購読開始/ハートビート開始/UI初期化など、参加開始時の初期化

// @param {string} roomId - string

// @param {number} playerId - number

//



function startSession(roomId, playerId) {

  CURRENT_ROOM = roomId; CURRENT_PLAYER = playerId;

  document.body.classList.toggle('is-spectator', CURRENT_PLAYER === 'spectator');

  updateEndRoomButtonVisibility();

  updateSessionIndicator();

  if (lobby) lobby.style.display = 'none';

  startHeartbeat(roomId, playerId);

  if (IS_ROOM_CREATOR) startHostHeartbeat(roomId);





  if (joinRoomInput) joinRoomInput.value = CURRENT_ROOM;

  loadSeatStatus(roomId);



  // 離脱時の多重実行防止

  let __leavingOnce = false;

  const __onLeave = () => {

    if (__leavingOnce) return;

    __leavingOnce = true;



    // 先に全タイマー/購読を停止してから DB を触る

    try { stopHostHeartbeat(); } catch (_) { }

    try { stopHeartbeat(); } catch (_) { }

    try { stopHostWatch(); } catch (_) { }







    try { releaseSeat(db, roomId, playerId, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null); } catch (_) { }

  };



  // PCブラウザ向け

  window.addEventListener('beforeunload', (e) => {
    // 完全にページを去る時だけ購読解除などを試みる（ただし、リロード時は即時完了しない可能性あり）
    stopHeartbeat();
    stopHostHeartbeat();
  });

  // iOS Safari 等のモバイル向け

  window.addEventListener('pagehide', (e) => {
    stopHeartbeat();
    stopHostHeartbeat();
  }, { once: true });









  initializePlayField();



  // 再入室時に前のDOMが残らないよう、まず強制クリア

  clearFieldDOM();

  initializePlayField();



  subscribeCards();

  subscribeChat();          // ←追加：チャット購読を開始

  bindChatUIOnce();         // ←追加：送信ボタン/Enter送信を有効化

  subscribeHP(roomId);      // HPの購読開始

  subscribeAreas();         // エリア背景画像の同期

  bindAreaContextMenuOnce(); // エリア右クリックメニューの初期化

  bindTokenContextMenuOnce(); // トークン用右クリックメニューの初期化



  startHostWatch();

  renderAreaColors();

  renderHPPanel();





  // タブ/ウィンドウの終了時通知をバインド

  bindLifecycleHandlers();



}





// ===== チャット＆操作ログ =====

let unsubscribeChat = null;

let chatUIBound = false;



// 画面下部にシステム行を追記する小さなユーティリティ

function appendSystemLine(text) {

  const listEl = document.getElementById('chat-log');

  if (!listEl) return;

  const el = document.createElement('div');

  el.className = 'sys';

  el.style.cssText = 'color:#a00;font-size:12px;margin:4px 0;';

  el.textContent = text;

  listEl.appendChild(el);

  listEl.scrollTop = listEl.scrollHeight;

}





function myDisplayName() {

  try {

    const seatData = (typeof CURRENT_PLAYER === 'number' && currentSeatMap) ? (currentSeatMap[CURRENT_PLAYER] || {}) : {};

    const nameFromSeat = seatData.displayName;

    const fallback = document.getElementById('new-player-name')?.value;

    return nameFromSeat || fallback || `SEAT${CURRENT_PLAYER || '-'}`;

  } catch (_) {

    return `SEAT${CURRENT_PLAYER || '-'}`;

  }

}



async function postChat(text) {

  if (!text || !CURRENT_ROOM || !CURRENT_PLAYER) return;

  try {

    const payload = {
      type: 'chat',
      text: String(text).slice(0, 500),
      seat: CURRENT_PLAYER,
      name: myDisplayName(),
      createdAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/chat`), payload);

  } catch (e) {

    console.warn('chat send failed', e);

    if (e?.code === 'permission-denied') {

      appendSystemLine('チャット送信が許可されていません（権限）');

      // 入力UIを無効化

      document.getElementById('chat-input')?.setAttribute('disabled', '');

      document.getElementById('chat-send')?.setAttribute('disabled', '');

    }

  }

}



async function postLog(text) {

  if (!text || !CURRENT_ROOM || !CURRENT_PLAYER) return;

  try {

    const payload = {
      type: 'log',
      text: String(text),
      seat: CURRENT_PLAYER,
      name: myDisplayName(),
      createdAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/chat`), payload);

  } catch (e) {

    console.warn('log failed', e);

    if (e?.code === 'permission-denied') {

      appendSystemLine('操作ログの書き込みが許可されていません（権限）');

    }

  }

}



function bindChatUIOnce() {

  if (chatUIBound) return;

  const input = document.getElementById('chat-input');

  const send = document.getElementById('chat-send');



  // 送信ボタン

  send?.addEventListener('click', async () => {

    const text = (input?.value || '').trim();

    if (!text) return;

    await postChat(text);

    if (input) input.value = '';

  });



  // Enter 送信（Shift+Enter で改行）

  input?.addEventListener('keydown', (e) => {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault();

      send?.click();

    }

  });



  chatUIBound = true;

}



function renderChatDoc(d) {

  const data = d.data() || {};

  const wrap = document.createElement('div');

  wrap.className = (data.type === 'log') ? 'log' : 'chat';

  wrap.style.margin = '4px 0';



  const t = data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date();

  const hh = String(t.getHours()).padStart(2, '0');

  const mm = String(t.getMinutes()).padStart(2, '0');



  const head = document.createElement('div');

  head.style.fontSize = '11px';

  head.style.color = (data.type === 'log') ? '#888' : '#666';

  // ログでもプレイヤー名を表示（name が無ければ seat から P番号を推定）

  const who = data.name || (typeof data.seat === 'number' ? `SEAT${data.seat}` : '');

  head.textContent = `[${hh}:${mm}] ${who}`;



  const body = document.createElement('div');

  body.style.whiteSpace = 'pre-wrap';

  body.textContent = data.text || '';



  wrap.appendChild(head);

  wrap.appendChild(body);

  return wrap;

}



function subscribeChat() {

  try { unsubscribeChat?.(); } catch (_) { }

  const listEl = document.getElementById('chat-log');

  if (!CURRENT_ROOM || !listEl) return;



  listEl.innerHTML = '';

  const q = query(

    collection(db, `rooms/${CURRENT_ROOM}/chat`),

    orderBy('createdAt', 'asc'),

    limit(200)

  );

  unsubscribeChat = onSnapshot(q, (snap) => {

    const nearBottom = (listEl.scrollTop + listEl.clientHeight) > (listEl.scrollHeight - 40);

    snap.docChanges().forEach(ch => {

      if (ch.type === 'added') {

        listEl.appendChild(renderChatDoc(ch.doc));

      }

    });

    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;

  }, (err) => {

    console.warn('chat subscribe error', err?.code, err);

    if (err?.code === 'permission-denied') {

      appendSystemLine('このプロジェクトの Firestore ルールでチャットの閲覧が許可されていません。');

      document.getElementById('chat-input')?.setAttribute('disabled', '');

      document.getElementById('chat-send')?.setAttribute('disabled', '');

    } else {

      appendSystemLine('チャットの読み込みに失敗しました。コンソールをご確認ください。');

    }

  });

}











// ===============================

// カード購読/反映

// ===============================

// cards サブコレクションのスナップショットを購読し、DOMへ反映。

// cards コレクションを購読し、変更を DOM に反映

//



function subscribeCards() {

  if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; }

  const qCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);

  unsubscribeCards = onSnapshot(qCards, snap => {

    snap.docChanges().forEach(change => {

      const data = change.doc.data();

      const id = change.doc.id;

      if (change.type === 'removed') {

        const el = cardDomMap.get(id); if (el) { el.remove(); cardDomMap.delete(id); }

        // ★ 追加: サーバ側の削除を見たらローカル抑止フラグも掃除

        localDeleteMap.delete(id);

        return;

      }

      upsertCardFromRemote(id, data);

    });

  });

}



const cardDomMap = new Map();

const localChangeMap = new Map();

function markLocal(id) { localChangeMap.set(id, Date.now()); setTimeout(() => localChangeMap.delete(id), 800); }

function isLocalRecent(id) { const t = localChangeMap.get(id); return t && (Date.now() - t < 800); }

// ★ 追加: 直近でローカル削除したIDを覚えて、再生成を抑止

const localDeleteMap = new Map(); // id -> timestamp

function markLocalDelete(id) { localDeleteMap.set(id, Date.now()); setTimeout(() => localDeleteMap.delete(id), 2000); }

function isLocallyDeleted(id) { const t = localDeleteMap.get(id); return t && (Date.now() - t < 2000); }





// ==== 追加: フィールド上の描画カードを強制的に全消去 ====

function clearFieldDOM() {

  try {

    // .card 要素を全削除

    document.querySelectorAll('.card').forEach(el => el.remove());

  } catch (_) { }

  // 管理用マップや選択状態も掃除

  try { cardDomMap.clear(); } catch (_) { }

  try { selectedCard?.classList?.remove?.('selected'); } catch (_) { }

  try { selectedCard = null; } catch (_) { }

  try { typeof setPreview === 'function' && setPreview(); } catch (_) { }

}





function upsertCardFromRemote(id, data) {

  let el = cardDomMap.get(id) || document.querySelector(`[data-card-id="${id}"]`);

  const exists = !!el;

  // ★ 追加: 直近にローカルで削除したIDは一定時間は無視して再生成しない

  if (!exists && (isLocallyDeleted(id))) {

    return;

  }

  if (!exists && !isLocalRecent(id)) {
    console.log("[LoadDebug] Creating new card DOM for:", id);
    el = createCardDom(id, data.imageUrl, data);

    if (el) {

      cardDomMap.set(id, el);

      // z-index問題を回避するため常に field に追加
      field.appendChild(el);

      console.log(`[LoadDebug] Card appended to field:`, id, "at", data.x, data.y);

    } else {

      console.error("[LoadDebug] Failed to create card DOM for:", id);

    }

  }

  if (el) applyCardState(el, data);

}



// ===============================

// カードDOM生成

// ===============================

// カードの種類に応じたDOM（通常/トークン/ダイス/数値カウンタ）を生成。

// カードの種類に応じた DOM を新規生成する（副作用：イベントバインド）

// @param {string} cardId - string

// @param {string} imageSrc - string

// @param {object} state - object

// @returns {HTMLElement} 生成したカード要素

//



function createCardDom(cardId, imageSrc, state) {

  const card = document.createElement("div");

  card.className = "card";

  if (state?.type === 'counter') card.classList.add('counter');







  if (state?.type === 'image-token') {

    card.classList.add('image-token');

  }



  if (state?.type === 'dice') {

    card.classList.add('dice');     // 小さめ正方形の見た目はCSSで

    // coin だけは丸く見せたいのでフラグでクラス付与

    if (state?.diceKind === 'coin') card.classList.add('is-coin');

    card.style.cursor = 'pointer';

    card.dataset.cardId = cardId;

    card.dataset.ownerUid = state?.ownerUid || '';

    card.dataset.ownerSeat = state?.ownerSeat ? String(state.ownerSeat) : '';

    card.setAttribute(

      'data-owner',

      (card.dataset.ownerSeat && card.dataset.ownerSeat !== String(CURRENT_PLAYER)) ? 'other' : 'me'

    );



    // ←← ここが重要：img を作って貼る

    const img = document.createElement('img'); img.crossOrigin = 'anonymous';

    img.src = imageSrc;

    img.decoding = 'async';

    img.loading = 'lazy';

    card.appendChild(img);



    // クリックで自分のダイスだけ削除

    card.addEventListener('click', async (e) => {

      e.stopPropagation();

      if (card.dataset.ownerSeat !== String(CURRENT_PLAYER)) return;

      try {

        const id = card.dataset.cardId;

        await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));

        markLocal(id);

        markLocalDelete(id);

      } catch (e) {

        console.warn('delete dice failed', e);

      }

    });



    // 右クリックでも自分のダイスだけ削除

    card.addEventListener('contextmenu', async (e) => {

      e.preventDefault();

      e.stopPropagation();

      if (card.dataset.ownerSeat !== String(CURRENT_PLAYER)) return;

      try {

        const id = card.dataset.cardId;

        await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));

        markLocal(id);

        markLocalDelete(id);

      } catch (e) {

        console.warn('delete dice failed', e);

      }

    });



    card.addEventListener('dblclick', e => e.preventDefault());





    // === 長押し（モバイル）で右クリック相当の処理 ===

    async function handleLongPressOnCard(card, state) {

      const cardId = card.dataset.cardId;

      const isCounter = (state?.type === 'counter') || card.classList.contains('counter');

      const isToken = (state?.type === 'token') || card.classList.contains('token');

      const isNumCtr = (state?.type === 'numcounter') || card.classList.contains('numcounter');

      if (isCounter || isToken || isNumCtr) {

        if (!canOperateCard(card, 'delete')) return;

        try { await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${cardId}`)); } catch (e) { console.warn(e); }

        return;

      }

      // 通常カード：表裏トグル

      if (!canOperateCard(card, 'flip')) return;

      if (state?.type === 'memo' || card.classList.contains('memo')) return;

      const isFaceUp = card.dataset.faceUp === 'true';
      const nextFaceUp = !isFaceUp;

      card.dataset.faceUp = nextFaceUp ? 'true' : 'false';

      const imgEl = card.querySelector('img');



      if (imgEl) {

        if (nextFaceUp) {

          imgEl.style.display = 'block';

          card.style.backgroundColor = '#fff';

          if (selectedCard === card) {

            const full = card.dataset.fullUrl || fullImageStore.get(cardId);

            setPreview(full || imgEl.src);

          }

        } else {

          imgEl.style.display = 'none';

          // 席に設定された背面画像を適用（なければ黒）

          applyCardBackStyle(card);

          if (selectedCard === card) {

            const back = seatBackUrl(parseInt(card.dataset.ownerSeat || '0', 10));

            setPreview(back || '');

          }

        }

      }



      const tokenEl = card.querySelector('.token-input');

      if (tokenEl) { tokenEl.style.display = nextFaceUp ? 'block' : 'none'; }

      updateCardBatched(cardId, { faceUp: nextFaceUp });

    }







    // ダイスはドラッグ不可：makeDraggable は呼ばない

    return card;

  }







  card.dataset.cardId = cardId;

  card.dataset.ownerUid = state?.ownerUid || '';

  card.dataset.ownerSeat = state?.ownerSeat ? String(state.ownerSeat) : '';

  card.setAttribute('data-owner', (card.dataset.ownerSeat && card.dataset.ownerSeat !== String(CURRENT_PLAYER)) ? 'other' : 'me');



  const img = document.createElement('img'); img.crossOrigin = 'anonymous';

  img.decoding = 'async';

  img.loading = 'lazy';

 

  if (typeof imageSrc === 'string' && imageSrc.trim().length > 0) {

    img.src = imageSrc;

  } else {

    // 未定義/空なら src を付けない（/undefined リクエスト回避）

    img.removeAttribute('src');

    img.style.display = 'none'; // URLが入るまで非表示

  }

  card.appendChild(img);





  // token / memo UI
  let tokenInput = null;
  if (state?.type === 'token' || state?.type === 'memo') {
    card.classList.add(state.type);
    tokenInput = document.createElement('textarea');
    tokenInput.className = 'token-input';
    tokenInput.value = typeof state.tokenText === 'string' ? state.tokenText : '';
    img.style.display = 'none';

    const editable = (card.dataset.ownerSeat === String(CURRENT_PLAYER));
    tokenInput.readOnly = !editable;
    tokenInput.disabled = !editable;

    if (editable) {
      let tmr = null;
      const commit = () => {
        tmr = null;
        const id = card.dataset.cardId;
        const text = tokenInput.value.slice(0, 2000);
        updateCardBatched(id, { tokenText: text });
      };
      tokenInput.addEventListener('input', () => { if (tmr) clearTimeout(tmr); tmr = setTimeout(commit, 500); });
      tokenInput.addEventListener('blur', commit);

      if (state.type === 'memo') {
        let rszTmr = null;
        const rszObserver = new ResizeObserver(entries => {
          // ドラッグ開始時のisLocalRecentでスキップすると手動リサイズが保存されないためコメントアウト
          // if (isLocalRecent(cardId)) return; 
          if (rszTmr) clearTimeout(rszTmr);
          rszTmr = setTimeout(() => {
            const entry = entries[0];
            if (entry) {
              const { width, height } = entry.contentRect;
              updateCardBatched(cardId, { width: Math.round(width), height: Math.round(height) });
            }
          }, 1000);
        });
        rszObserver.observe(card);
      }
    }
    card.appendChild(tokenInput);
  }



  if (state?.type !== 'dice') {

    makeDraggable(card);

  }







  // token UI の直後あたりに追加

  if (state?.type === 'numcounter') {

    card.classList.add('numcounter');

    // 画像は使わない

    if (img) img.style.display = 'none';



    const wrap = document.createElement('div');

    wrap.className = 'nc-wrap';



    const input = document.createElement('input');

    input.type = 'number';

    input.step = '1';

    input.className = 'nc-input';

    input.value = Number.isFinite(state?.count) ? state.count : 0;



    wrap.appendChild(input);











    card.appendChild(wrap);



    // 自分のもののみ編集可

    const editable = (card.dataset.ownerSeat === String(CURRENT_PLAYER));

    input.disabled = !editable;



    if (editable) {

      const commit = (next) => {

        const n = Number.isFinite(next) ? Math.trunc(next) : 0;

        input.value = n;

        updateCardBatched(cardId, { count: n });

      };

      input.addEventListener('change', () => commit(parseInt(input.value, 10)));

    }



    // ドラッグは可（ダイス以外は既定で makeDraggable 済）

  }













  card.addEventListener("click", async e => {

    e.stopPropagation();

    // 表示上だけ最前面へ（サーバーへzIndexは書かない：無駄書き減）

    const newZ = getMaxZIndex() + 1;

    card.style.zIndex = newZ;

    updateOverlapBadges(); //Z順変更で最新化



    if (selectedCard) {

      if (!card.classList.contains("selected")) {

        // 選択されていないカードをクリックしたときのみ、他を解除してこれ単体を選択

        document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));

        card.classList.add("selected");

      }

    } else {

      card.classList.add("selected");

    }

    selectedCard = card;



    const isToken = card.classList.contains('token');





    // プレビュー：他人の手札 or 裏向き → 席ごとの裏画像（無ければ黒）、それ以外は表画像

    if (isToken) {

      setPreview(); // トークンはプレビューなし

    } else {

      const isFaceUp = card.dataset.faceUp === 'true';

      const full = card.dataset.fullUrl || fullImageStore.get(cardId);

      const thumbEl = card.querySelector('img');

      const frontSrc = full || (thumbEl && thumbEl.src) || '';

      const otherHand = isOtherPlayersHandCard(card); /* 判定関数 */

      const ownerSeat = parseInt(card.dataset.ownerSeat || '0', 10);   // ★ 追加：宣言

      const seatBack = getSeatBackUrl(ownerSeat) || TRUMP_BACK_URL;    // ★ 席の裏→無ければ黒

      const previewSrc = (!isFaceUp || otherHand) ? seatBack : frontSrc;

      setPreview(previewSrc);

    }



    const ownerPlayerNum = card.dataset.ownerSeat ? `SEAT${card.dataset.ownerSeat}` : "?";

    if (isToken) {

      const t = card.querySelector('.token-input')?.value || '';

      previewInfo.textContent = `カードのオーナー: ${ownerPlayerNum} / あなた: P${CURRENT_PLAYER || "?"}\n内容: ${t ? t.slice(0, 200) : '(未記入)'}`;

    } else {

      previewInfo.textContent = `カードのオーナー: ${ownerPlayerNum} / あなた: P${CURRENT_PLAYER || "?"}`;

    }

  });



  // 右クリックで表裏トグル（自分のカードのみ／カウンターは除外）

  // 右クリック：

  //   - 自分の「トークン / カウンター」なら削除

  //   - それ以外の自分のカードは表裏トグル

  card.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    maybeTakeOwnership(card);



    const isCounter = (state?.type === 'counter') || card.classList.contains('counter');

    const isTextToken = (state?.type === 'token') || card.classList.contains('token') || card.classList.contains('memo');
    const isImageToken = (state?.type === 'image-token') || card.classList.contains('image-token');
    const isToken = isTextToken || isImageToken;

    const isNumCtr = (state?.type === 'numcounter') || card.classList.contains('numcounter');

    

    if (isToken) {

      if (!canOperateCard(card, 'delete')) return;

      if (typeof globalThis.showTokenContextMenu === 'function') {

        globalThis.showTokenContextMenu(e, card.dataset.cardId);

      }

      return;

    }

    

    if (isCounter || isNumCtr) {

      if (!canOperateCard(card, 'delete')) return;

      try {
        const id = card.dataset.cardId;
        await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));
        markLocal(id);
        markLocalDelete(id);
      } catch (err) {
        console.warn('delete token/counter failed', err);
      }

      return;

    }



    if (!canOperateCard(card, 'flip')) return;



    const isSelected = card.classList.contains('selected');

    const cardsToFlip = isSelected 
      ? Array.from(document.querySelectorAll('.card.selected')).filter(el => !el.classList.contains('memo'))
      : (card.classList.contains('memo') ? [] : [card]);



    const nextFaceUp = !(card.dataset.faceUp === 'true');



    cardsToFlip.forEach(c => {
      maybeTakeOwnership(c);
      if (!canOperateCard(c, 'flip')) return;

      

      c.dataset.faceUp = nextFaceUp ? 'true' : 'false';

      const imgEl = c.querySelector('img');

      const cId = c.dataset.cardId;



      if (imgEl) {

        if (nextFaceUp) {

          imgEl.style.display = 'block';

          c.style.backgroundColor = '#fff';

        } else {

          imgEl.style.display = 'none';

          applyCardBackStyle(c);

        }

      }



      const tokenEl = c.querySelector('.token-input');

      if (tokenEl) {

        if (nextFaceUp) { tokenEl.style.display = 'block'; c.style.backgroundColor = '#fff'; }

        else { tokenEl.style.display = 'none'; c.style.backgroundColor = '#000'; }

      }



      updateCardBatched(cId, { faceUp: nextFaceUp });

    });



    if (selectedCard && (selectedCard === card || cardsToFlip.includes(selectedCard))) {

      const isUp = selectedCard.dataset.faceUp === 'true';

      const fUrl = selectedCard.dataset.fullUrl || fullImageStore.get(selectedCard.dataset.cardId);

      const tEl = selectedCard.querySelector('img');

      const fSrc = fUrl || (tEl && tEl.src) || '';

      const isOther = isOtherPlayersHandCard(selectedCard);

      const oSeat = parseInt(selectedCard.dataset.ownerSeat || '0', 10);

      const sBack = seatBackUrl(oSeat) || TRUMP_BACK_URL;

      const pSrc = (!isUp || isOther) ? sBack : fSrc;

      setPreview(pSrc);

    }

  });













  // ダブルクリックで90°回転（自分のカードのみ）

  card.addEventListener("dblclick", async (e) => {
    e.stopPropagation();

    // かるた方式: 触れた瞬間に所有権を奪う
    maybeTakeOwnership(card);

    

    if (card.classList.contains('memo')) return;

    const isSelected = card.classList.contains('selected');

    const cardsToRotate = isSelected 

      ? Array.from(document.querySelectorAll('.card.selected')) 

      : [card];



    const currentStyle = card.style.transform || '';

    const match = currentStyle.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);

    const current = match ? parseFloat(match[1]) : (typeof state?.rotation === 'number' ? state.rotation : 0);

    const next = ((current + 270) % 360 + 360) % 360;



    cardsToRotate.forEach(c => {
      // かるた方式: 選択カード全取得
      maybeTakeOwnership(c);
      if (!canOperateCard(c, 'rotate')) return;

      if (c.classList.contains('numcounter')) return;



      const cId = c.dataset.cardId;

      const cStyle = c.style.transform || '';

      const matchScale = cStyle.match(/scale\(([^)]+)\)/);

      const currentScale = matchScale ? matchScale[1] : 1;

      

      c.style.transform = `rotate(${next}deg) scale(${currentScale})`;

      updateCardBatched(cId, { rotation: next });

    });

  });





// === 長押し（0.5s）で右クリック相当（モバイル）

  {

    let lpTimer = null, lpFired = false;

    const LP_MS = 500;

    const clearLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };

    card.addEventListener('touchstart', (ev) => {

      if (ev.touches.length !== 1) return;

      lpFired = false;

      clearLP();

      lpTimer = setTimeout(() => {

        lpFired = true;

        handleLongPressOnCard(card, state);

      }, LP_MS);

    }, { passive: true });

    const cancelLP = () => clearLP();

    card.addEventListener('touchend', cancelLP);

    card.addEventListener('touchcancel', cancelLP);

  }















  return card;

}



// ===============================

// カード状態の適用

// ===============================

// Firestore 上のデータを DOM に反映。表示制御や旧URLからの移行も実施。

// Firestore データの内容を既存カードDOMへ適用（表裏表示や移行処理含む）

// @param {HTMLElement} card - HTMLElement

// @param {object} data - object

//



function applyCardState(card, data) {
  if (!card || !data) return;
  // デバッグ：実際にセットされているURLを確認
  if (data.imageUrl && !card.dataset.debugLogged) {
     console.log("[CardDebug] Applying state for card:", data.imageUrl, "current src:", card.querySelector('img')?.src);
     card.dataset.debugLogged = "true";
  }

  card.dataset.ownerUid = data.ownerUid || '';

  card.dataset.ownerSeat = (data.ownerSeat != null) ? String(data.ownerSeat) : '';

  card.setAttribute('data-owner', (card.dataset.ownerSeat && card.dataset.ownerSeat !== String(CURRENT_PLAYER)) ? 'other' : 'me');



  card.style.left = `${data.x || 0}px`;

  card.style.top = `${data.y || 0}px`;

  if (data.zIndex) {

    // 互換性確保：古いデータ(z-index < 300)は300以上のレイヤーに底上げする

    const z = parseInt(data.zIndex, 10);

    card.style.zIndex = (z < 300) ? (z + 300) : z;

  }



  const rot = (typeof data.rotation === 'number') ? data.rotation : 0;

  const scaleLevel = (typeof data.scaleLevel === 'number') ? data.scaleLevel : 0;

  const scaleOffset = Math.pow(1.2, scaleLevel);

  card.style.transform = `rotate(${rot}deg) scale(${scaleOffset})`;



  card.dataset.faceUp = data.faceUp ? 'true' : 'false';
  if (data.backImageUrl) { card.dataset.backImageUrl = data.backImageUrl; }

  const img = card.querySelector('img');

  if (data.fullUrl) { card.dataset.fullUrl = data.fullUrl; }





  if (img) {
    const isMemo = (data.type === 'memo');
    if (isMemo) {
      img.style.display = 'none';
      card.style.backgroundColor = '#fff';
    } else {
      if (data.faceUp) {
        img.style.display = 'block';
        card.style.backgroundColor = '#fff';
        card.classList.remove('has-back');
        card.style.backgroundImage = '';
      } else {
        img.style.display = 'none';
        applyCardBackStyle(card);
      }
    }

    

    // 拡大時(scaleLevel >= 1)は高画質版(fullUrl)を使用する

    const isHighResNeeded = (scaleLevel >= 1) && data.fullUrl;

    // Apply width/height for image-token (e.g. chess pieces)
    if (data.type === 'image-token' && data.width) {
      card.style.setProperty('width', `${data.width}px`, 'important');
      card.style.setProperty('height', `${data.height || data.width}px`, 'important');
    }

    const targetSrc = isHighResNeeded ? data.fullUrl : data.imageUrl;

    if (targetSrc && img.src !== targetSrc) { 

      img.src = targetSrc; 

    }

  }







  // --- ここから追加：旧形式URL（/o?name= を含む）を安全なURLへ自動移行 ---

  if (data?.imageUrl && /\/o\?name=/.test(data.imageUrl)) {

    (async () => {

      try {

        const id = card.dataset.cardId;

        // 既存の保存規約：rooms/{ROOM}/cards/{ID}/(thumb|full).jpg

        const base = `rooms/${CURRENT_ROOM}/cards/${id}`;

        const thumbRef = ref(storage, `${base}/thumb.jpg`);

        const fullRef = ref(storage, `${base}/full.jpg`);

        const [thumbUrl, fullUrl] = await Promise.all([

          getDownloadURL(thumbRef),

          getDownloadURL(fullRef),

        ]);

        if (img) img.src = thumbUrl;

        card.dataset.fullUrl = fullUrl;

        await updateDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), {

          imageUrl: thumbUrl,

          fullUrl,

          updatedAt: serverTimestamp()

        });

        console.log('[migrate] fixed legacy imageUrl for', id);

      } catch (e) {

        console.warn('[migrate] failed to fix legacy url', e);

      }

    })();

  }

  // --- 追加ここまで ---





  if (data.type === 'numcounter') {

    card.classList.add('numcounter');

    const input = card.querySelector('.nc-input');

    if (input) {

      const v = Number.isFinite(data.count) ? data.count : 0;

      if (String(input.value) !== String(v)) input.value = v;

      const editable = (card.dataset.ownerSeat === String(CURRENT_PLAYER));

      input.disabled = !editable;

    }

    const img2 = card.querySelector('img');

    if (img2) img2.style.display = 'none';

  }









  if (data.type === 'token' || data.type === 'memo') {
    card.classList.add(data.type);
    const tokenInput = card.querySelector('.token-input');
    if (tokenInput) {
      if (typeof data.tokenText === 'string' && tokenInput.value !== data.tokenText) {
        tokenInput.value = data.tokenText;
      }
      if (data.type === 'memo') {
        if (data.width) card.style.width = `${data.width}px`;
        if (data.height) card.style.height = `${data.height}px`;
        if (data.fontSize) tokenInput.style.fontSize = `${data.fontSize}px`;
      }
      const isFaceUp = (data.type === 'memo') ? true : data.faceUp;
      if (isFaceUp) {
        tokenInput.style.display = 'block';
        card.style.backgroundColor = '#fff';
        card.style.backgroundImage = '';
        card.classList.remove('has-back');
      } else {
        tokenInput.style.display = 'none';
        applyCardBackStyle(card);
      }
      const editable = (card.dataset.ownerSeat === String(CURRENT_PLAYER));
      tokenInput.readOnly = !editable;
      tokenInput.disabled = !editable;
    }
    const img2 = card.querySelector('img');
    if (img2) img2.style.display = 'none';
  }





  try {

    const viewerSeat = CURRENT_PLAYER;

    const x = parseFloat(card.style.left) || 0;

    const y = parseFloat(card.style.top) || 0;

    let insideSeat = null;

    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {

      const hb = getHandBoundsForSeat(s);

      if (hb && isCenterInsideRect(x, y, hb)) { insideSeat = s; break; }

    }

    if (insideSeat && String(viewerSeat) !== String(insideSeat) && data.type !== 'memo') {

      const img = card.querySelector('img');

      if (img) { img.style.display = 'none'; card.style.backgroundColor = '#000'; }

      const tokenInput2 = card.querySelector('.token-input');

      if (tokenInput2) { tokenInput2.style.display = 'none'; card.style.backgroundColor = '#000'; }

      // ★選択中でもプレビューは「その席の裏面」

      if (selectedCard === card) {

        const seatData = currentSeatMap?.[insideSeat] || null;

        const back = seatData?.backImageUrl || TRUMP_BACK_URL;

        setPreview(back);

      }

    }

  } catch (_) { }

}



// ===============================

// ルーム終了/削除ユーティリティ

// ===============================

// cards/seats の一括削除と roomClosed フラグの設定、必要に応じて親docも削除。

// cards/seats を一括削除し roomClosed を立てる

// @param {string} roomId - string

//











async function resetRoomState(roomId) {

  try {

    const cardsCol = collection(db, `rooms/${roomId}/cards`);

    const cardsSnap = await getDocs(cardsCol);

    let batch = writeBatch(db); let n = 0;

    for (const d of cardsSnap.docs) {

      batch.delete(doc(db, `rooms/${roomId}/cards/${d.id}`));

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();



    const seatsCol = collection(db, `rooms/${roomId}/seats`);

    const seatsSnap = await getDocs(seatsCol);

    batch = writeBatch(db); n = 0;

    for (const d of seatsSnap.docs) {

      batch.delete(doc(db, `rooms/${roomId}/seats/${d.id}`));

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();





    // ルームを初期化するときもチャットを空にしておく

    const chatCol = collection(db, `rooms/${roomId}/chat`);

    const chatSnap = await getDocs(chatCol);

    batch = writeBatch(db); n = 0;

    for (const d of chatSnap.docs) {

      batch.delete(doc(db, `rooms/${roomId}/chat/${d.id}`));

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();







    await setDoc(doc(db, `rooms/${roomId}`), { roomClosed: false, updatedAt: serverTimestamp() }, { merge: true });

  } catch (e) {

    console.warn('resetRoomState failed', e);

  }

}











// ===== queued update API (replaces updateDoc direct calls)

async function updateCard(cardId, patch) {

  // 互換用（今は使っていない）— 直接書かない

  updateCardBatched(cardId, patch);

}



// ===============================

// アップロードとサムネ生成

// ===============================

// 画像のサムネイル生成、Storage アップロード、Firestore への反映を並列/分割で実行。

// ===== Uploads: parallel & thumbnails

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

const THUMB_MAX_W = 240;

const THUMB_MAX_H = 320;

const PARALLEL = Math.max(2, Math.min(6, Math.floor((navigator.hardwareConcurrency || 8) / 2))); // 少し下げる

const BATCH_INSERT = 12;



const fileQueue = [];

let processing = false;



function bindUploadHandlers() {

  const bindBox = (boxEl, inputEl, kind) => {

    if (!boxEl || !inputEl) return;

    boxEl.addEventListener("click", () => inputEl.click());

    boxEl.addEventListener("dragover", e => { e.preventDefault(); boxEl.style.backgroundColor = "#eef"; });

    boxEl.addEventListener("dragleave", () => { boxEl.style.backgroundColor = "#fff"; });

    boxEl.addEventListener("drop", e => { e.preventDefault(); boxEl.style.backgroundColor = "#fff"; handleFiles(e.dataTransfer.files, kind); });

    inputEl.addEventListener("change", e => {

      if (e.target.files.length > 0) {

        handleFiles(e.target.files, kind);

        e.target.value = ''; // 同じファイルを連続で選択できるようにリセット

      }

    });

  };

  bindBox(uploadCard, fileInputCard, 'card');

  bindBox(uploadToken, fileInputToken, 'image-token');

}



function handleFiles(files, kind = 'card') {

  if (CURRENT_PLAYER === 'spectator') {

    alert('観戦モードではカードを追加できません。');

    return;

  }



  const limits = getLimits(IS_PREMIUM);

  const maxBytes = limits.maxImageMB * 1024 * 1024;



  const imgs = [...files].filter(f => f.type.startsWith('image/'));



  // ===== 画像サイズ制限 =====

  const oversized = imgs.filter(f => f.size > maxBytes);

  const valid = imgs.filter(f => f.size <= maxBytes);

  if (oversized.length > 0) {

    alert(`${oversized.length}枚の画像が${limits.maxImageMB}MBの上限を超えています。\n超過した画像はスキップされます。${IS_PREMIUM ? '' : '\nプレミアム会員は20MBまでアップロード可能です。'}`);

  }



  // ===== 枚数制限（現在の枚数 + キュー + 新規） =====

  const currentCount = document.querySelectorAll(`#game-field .card[data-owner="${CURRENT_PLAYER}"]`).length;

  const afterCount = currentCount + fileQueue.length + valid.length;

  if (afterCount > limits.cardsPerRoom) {

    const remaining = Math.max(0, limits.cardsPerRoom - currentCount - fileQueue.length);

    alert(`カード枚数の上限（${limits.cardsPerRoom}枚）を超えます。\n追加可能: ${remaining}枚${IS_PREMIUM ? '' : '\nプレミアム会員は500枚まで利用可能です。'}`);

    // 上限まで追加可能な分だけ入れる

    for (const f of valid.slice(0, remaining)) fileQueue.push({ file: f, kind });

  } else {

    for (const f of valid) fileQueue.push({ file: f, kind });

  }



  if (!processing && fileQueue.length > 0) processQueue();

}



async function fileToThumbAndFull(file) {

  const bmp = await createImageBitmap(file);

  const sw = bmp.width, sh = bmp.height;

  const scale = Math.min(THUMB_MAX_W / sw, THUMB_MAX_H / sh, 1);

  const tw = Math.max(1, Math.round(sw * scale));

  const th = Math.max(1, Math.round(sh * scale));



  const canvas = document.createElement('canvas');

  canvas.width = tw; canvas.height = th;

  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;

  ctx.imageSmoothingQuality = 'low';

  ctx.drawImage(bmp, 0, 0, tw, th);

  const thumbDataUrl = canvas.toDataURL('image/webp', 0.8);


  const fullDataUrl = await new Promise((res, rej) => {

    const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(fr.result); fr.readAsDataURL(file);

  });

  try { bmp.close?.(); } catch (_) { }

  return { thumbDataUrl, fullDataUrl };

}



async function processQueue() {

  processing = true;

  // ★ アップロード完了合計

  let totalUploaded = 0;

  try {

    while (fileQueue.length) {

      const chunk = fileQueue.splice(0, BATCH_INSERT);

      const groups = [];

      for (let i = 0; i < chunk.length; i += PARALLEL) groups.push(chunk.slice(i, i + PARALLEL));



      const frag = document.createDocumentFragment();



      for (const group of groups) {

        const results = await Promise.all(group.map(async ({ file, kind }) => {

          const { thumbDataUrl, fullDataUrl } = await fileToThumbAndFull(file);

          if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) return null;



          const isSimple = CURRENT_ROOM_META?.fieldLayout === 'simple';

          const isToken = kind === 'image-token';

          const pos = (isSimple || isToken) ? randomPointInMainPlay(CURRENT_PLAYER) : randomPointInDeck(CURRENT_PLAYER);

          const { x, y } = pos;



          const typeData = kind === 'image-token' ? { type: 'image-token' } : {};



          // 1) まず Firestore にメタだけ作る（URLはあとで埋める）

          const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

          const refDoc = await addDoc(baseCol, {

            ...typeData,

            x, y, zIndex: 1, faceUp: true,

            ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER, rotation: 0,

            visibleToAll: true,

            createdAt: serverTimestamp(), updatedAt: serverTimestamp()

          });

          const cardId = refDoc.id;



          // 2) Storage へ thumb/full をアップロード

          const objBase = `rooms/${CURRENT_ROOM}/cards/${cardId}`;

          const fullRef = ref(storage, `${objBase}/full.jpg`);

          const thumbRef = ref(storage, `${objBase}/thumb.jpg`);

          // data URL を直接アップロード（クライアント生成）

          await Promise.all([

            uploadString(fullRef, fullDataUrl, 'data_url'),

            uploadString(thumbRef, thumbDataUrl, 'data_url'),

          ]);

          const [fullUrl, thumbUrl] = await Promise.all([

            getDownloadURL(fullRef),

            getDownloadURL(thumbRef),

          ]);



          // 3) Firestore のカードに URL を反映

          const payload = {
            imageUrl: thumbUrl,
            fullUrl: fullUrl,
            updatedAt: serverTimestamp()
          };
          if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

          await updateDoc(refDoc, payload);



          // 4) DOM 生成（即時プレビュー用に thumb を使い、full は data 属性へ）

          markLocal(cardId);

          let el = cardDomMap.get(cardId);

          if (!el) {

            el = createCardDom(cardId, thumbUrl, {

              ...typeData,

              x, y, zIndex: 1, faceUp: true,

              ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER, rotation: 0

            });

            el.dataset.fullUrl = fullUrl;

            cardDomMap.set(cardId, el);

            applyCardState(el, {

              ...typeData,

              x, y, zIndex: 1, faceUp: true,

              imageUrl: thumbUrl, fullUrl,

              ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER, rotation: 0

            });

            frag.appendChild(el);

          }

          return true;







        }));

        // ★ このグループで成功した数を合算

        totalUploaded += results.filter(Boolean).length;

        await nextFrame();

      }

      if (frag.childNodes.length) field.appendChild(frag);

      await nextFrame();

    }

  } finally {

    processing = false;

    // ★追加: 合計が1枚以上ならログ出力（投稿者名は postLog 側で seat/name を付与）

    if (totalUploaded > 0) {

      postLog(`画像を${totalUploaded}枚読み込みました`);

    }

  }

}



// ===== Existing UI ops (batching applied)

// ===============================

// ドラッグ/パン/ズーム

// ===============================

// カードドラッグとフィールドのパン/ズーム（マウス/タッチ）を制御。

// カードをドラッグ可能にする（マウス/タッチ対応）

// @param {HTMLElement} card - HTMLElement

//



function makeDraggable(card) {

  const DRAG_THRESHOLD = 5;

  let isDragging = false;

  let startClientX = 0, startClientY = 0;

  let grabOffsetX = 0, grabOffsetY = 0;

  

  let selectedCards = [];

  let initialPositions = new Map();



  card.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    
    // かるた方式: 触れたカード（および選択中の全カード）の所有権を奪う
    if (card.classList.contains('selected')) {
      Array.from(document.querySelectorAll('.card.selected')).forEach(c => maybeTakeOwnership(c));
    } else {
      maybeTakeOwnership(card);
    }

    if (!canOperateCard(card, 'move')) return;

    // メモのリサイズハンドルを操作している場合はドラッグを開始しない
    if (card.classList.contains('memo')) {
      const cardRect = card.getBoundingClientRect();
      const isResizeArea = (e.clientX > cardRect.right - 25 && e.clientY > cardRect.bottom - 25);
      if (isResizeArea) return;
    }

    if (e.detail > 1) return;



    const rect = field.getBoundingClientRect();

    const mouseX = (e.clientX - rect.left - panOffsetX) / zoom;

    const mouseY = (e.clientY - rect.top - panOffsetY) / zoom;



    startClientX = e.clientX;

    startClientY = e.clientY;

    grabOffsetX = mouseX - (parseFloat(card.style.left || '0') || 0);

    grabOffsetY = mouseY - (parseFloat(card.style.top || '0') || 0);



    if (card.classList.contains('selected')) {

      selectedCards = Array.from(document.querySelectorAll('.card.selected'));

      initialPositions.clear();

      selectedCards.forEach(c => {

        initialPositions.set(c.dataset.cardId, {

          left: parseFloat(c.style.left) || 0,

          top: parseFloat(c.style.top) || 0,

          zIndex: parseInt(c.style.zIndex) || 0

        });

      });

    } else {

      selectedCards = [card];

      initialPositions.clear();

      initialPositions.set(card.dataset.cardId, {

        left: parseFloat(card.style.left) || 0,

        top: parseFloat(card.style.top) || 0,

        zIndex: parseInt(card.style.zIndex) || 0

      });

    }



    const onMove = (e2) => {

      const dx = (e2.clientX - startClientX) / zoom;

      const dy = (e2.clientY - startClientY) / zoom;

      

      if (!isDragging) {

        if (Math.hypot(e2.clientX - startClientX, e2.clientY - startClientY) < DRAG_THRESHOLD) return;

        isDragging = true;

        

        const newZBase = getMaxZIndex() + 1;

        selectedCards.forEach((c, idx) => {

          c.style.cursor = "grabbing";

          c.style.zIndex = newZBase + idx;

        });

      }



      selectedCards.forEach(c => {

        const init = initialPositions.get(c.dataset.cardId);

        if (init) {

          c.style.left = `${init.left + dx}px`;

          c.style.top = `${init.top + dy}px`;

        }

      });

    };



    const onUp = async () => {

      document.removeEventListener("mousemove", onMove);

      document.removeEventListener("mouseup", onUp);

      

      selectedCards.forEach(c => {

        c.style.cursor = "grab";

      });



      if (!isDragging) return;

      isDragging = false;



      selectedCards.forEach(c => {

        const id = c.dataset.cardId;

        const x = parseFloat(c.style.left) || 0;

        const y = parseFloat(c.style.top) || 0;

        const zIndex = parseInt(c.style.zIndex) || 1;

        const updateData = { x, y, zIndex };
        if (c.style.width) updateData.width = Math.round(parseFloat(c.style.width));
        if (c.style.height) updateData.height = Math.round(parseFloat(c.style.height));
        updateCardBatched(id, updateData);

      });

      updateOverlapBadges();

    };



    document.addEventListener("mousemove", onMove);

    document.addEventListener("mouseup", onUp);

  });





  card.addEventListener('touchstart', (e) => {
    // かるた方式: 触れたカード（および選択中の全カード）の所有権を奪う
    if (card.classList.contains('selected')) {
      Array.from(document.querySelectorAll('.card.selected')).forEach(c => maybeTakeOwnership(c));
    } else {
      maybeTakeOwnership(card);
    }

    if (!canOperateCard(card, 'move')) return;

    if (e.touches.length !== 1) return;

    e.preventDefault();

    const t = e.touches[0];

    const rect = field.getBoundingClientRect();

    const mouseX = (t.clientX - rect.left - panOffsetX) / zoom;

    const mouseY = (t.clientY - rect.top - panOffsetY) / zoom;



    startClientX = t.clientX;

    startClientY = t.clientY;

    grabOffsetX = mouseX - (parseFloat(card.style.left || '0') || 0);

    grabOffsetY = mouseY - (parseFloat(card.style.top || '0') || 0);

    isDragging = false;



    if (card.classList.contains('selected')) {

      selectedCards = Array.from(document.querySelectorAll('.card.selected'));

      initialPositions.clear();

      selectedCards.forEach(c => {

        initialPositions.set(c.dataset.cardId, {

          left: parseFloat(c.style.left) || 0,

          top: parseFloat(c.style.top) || 0,

          zIndex: parseInt(c.style.zIndex) || 0

        });

      });

    } else {

      selectedCards = [card];

      initialPositions.clear();

      initialPositions.set(card.dataset.cardId, {

        left: parseFloat(card.style.left) || 0,

        top: parseFloat(card.style.top) || 0,

        zIndex: parseInt(card.style.zIndex) || 0

      });

    }



    const onMove = (ev) => {

      if (ev.touches.length !== 1) return;

      ev.preventDefault();

      const tt = ev.touches[0];

      const dx = (tt.clientX - startClientX) / zoom;

      const dy = (tt.clientY - startClientY) / zoom;



      if (!isDragging) {

        if (Math.hypot(tt.clientX - startClientX, tt.clientY - startClientY) < 5) return;

        isDragging = true;

        const newZBase = getMaxZIndex() + 1;

        selectedCards.forEach((c, idx) => {

          c.style.cursor = "grabbing";

          c.style.zIndex = newZBase + idx;

        });

      }



      selectedCards.forEach(c => {

        const init = initialPositions.get(c.dataset.cardId);

        if (init) {

          c.style.left = `${init.left + dx}px`;

          c.style.top = `${init.top + dy}px`;

        }

      });

    };

    const onEnd = async () => {

      document.removeEventListener('touchmove', onMove, { passive: false });

      document.removeEventListener('touchend', onEnd);

      document.removeEventListener('touchcancel', onEnd);

      

      selectedCards.forEach(c => {

        c.style.cursor = "grab";

      });



      if (!isDragging) return;

      isDragging = false;

      

      selectedCards.forEach(c => {

        const id = c.dataset.cardId;

        const x = parseFloat(c.style.left) || 0;

        const y = parseFloat(c.style.top) || 0;

        const zIndex = parseInt(c.style.zIndex) || 1;

        const updateData = { x, y, zIndex };
        if (c.style.width) updateData.width = Math.round(parseFloat(c.style.width));
        if (c.style.height) updateData.height = Math.round(parseFloat(c.style.height));
        updateCardBatched(id, updateData);

      });

      updateOverlapBadges();

    };

    document.addEventListener('touchmove', onMove, { passive: false });

    document.addEventListener('touchend', onEnd);

    document.addEventListener('touchcancel', onEnd);

  }, { passive: false });

}



function getMaxZIndex() { let max = 300; document.querySelectorAll(".card").forEach(c => { const z = parseInt(c.style.zIndex) || 0; if (z > max) max = z; }); return max; }

function getMinZIndex() { let min = 1000000; let found = false; document.querySelectorAll(".card").forEach(c => { const z = parseInt(c.style.zIndex); if (!isNaN(z)) { if (z < min) min = z; found = true; } }); return found ? min : 300; }



// ★ added: 重なり判定 & バッジ更新 =========================

function rectOfCard(el) {

  const left = parseFloat(el.style.left) || 0;

  const top = parseFloat(el.style.top) || 0;

  const w = el.offsetWidth || 0;

  const h = el.offsetHeight || 0;

  return { l: left, t: top, r: left + w, b: top + h };

}

function intersects(a, b) {

  // 面積が正に重なるかどうか（辺が接するだけは“重なり”とみなさない）

  return (a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);

}

function unionFind(n) {

  const p = Array(n).fill(0).map((_, i) => i);

  const f = i => p[i] === i ? i : (p[i] = f(p[i]));

  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) p[b] = a; };

  return { find: f, unite: u, parent: p };

}

function ensureBadge(el) {

  let b = el.querySelector('.overlap-badge');

  if (!b) {

    b = document.createElement('div');

    b.className = 'overlap-badge';

    el.appendChild(b);

  }

  return b;

}

function clearBadge(el) {

  const b = el.querySelector('.overlap-badge');

  if (b) b.remove();

}



// 画面上のカードを重なりクラスタごとに分け、各クラスタの「最前面の通常カード」に通常カード枚数を表示

window.updateOverlapBadges = function () {

  const all = Array.from(document.querySelectorAll('.card'));

  if (all.length === 0) return;



  // まず全ての既存バッジを消す（必要なものだけ後で付ける）

  all.forEach(clearBadge);



  // 「通常カード」判定（※各種トークン/ダイス/各種カウンターはバッジ対象外・カウント対象外）

  const isReal = (el) => !(

    el.classList.contains('token') ||

    el.classList.contains('image-token') ||

    el.classList.contains('dice') ||
    el.classList.contains('counter') ||
    el.classList.contains('numcounter') ||
    el.classList.contains('memo')
  );



  // 位置とZ

  const rects = all.map(rectOfCard);

  const zList = all.map(el => parseInt(el.style.zIndex || '1', 10) || 1);



  // Union-Find で重なりクラスタ化（※ブリッジ防止のため、判定は全要素で行う）

  const uf = unionFind(all.length);

  for (let i = 0; i < all.length; i++) {

    for (let j = i + 1; j < all.length; j++) {

      if (intersects(rects[i], rects[j])) uf.unite(i, j);

    }

  }



  // root -> indices

  const groups = new Map();

  for (let i = 0; i < all.length; i++) {

    const r = uf.find(i);

    if (!groups.has(r)) groups.set(r, []);

    groups.get(r).push(i);

  }



  // 各グループごとに、通常カードのみを数え、最前面の「通常カード」にだけ表示

  groups.forEach((idxList) => {

    const realIdx = idxList.filter(i => isReal(all[i]));

    if (realIdx.length <= 1) return; // 0 or 1 枚なら表示しない



    // 最前面の「通常カード」を選ぶ（zIndex 高い順・同値はDOM後勝ち）

    realIdx.sort((a, b) => (zList[a] - zList[b]) || (a - b));

    const hostIndex = realIdx[realIdx.length - 1];

    const hostEl = all[hostIndex];



    const badge = ensureBadge(hostEl);

    badge.textContent = String(realIdx.length); // ← 通常カード枚数のみ

  });

}





// ===========================================================









// ===============================

// 一括操作 (自分のカードのみ)

// ===============================

// 表裏/回転/削除などの一括操作を実装。

// 自分のカードをすべて裏向きにする（バッチ書き込み）

//



window.faceDownAll = async function () {

  const batch = writeBatch(db);

  let count = 0;

  for (const [id, el] of cardDomMap) {

    if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
    if (el.classList.contains('memo')) continue;

    el.dataset.faceUp = 'false';

    const imgEl = el.querySelector('img'); if (imgEl) imgEl.style.display = 'none';

    el.style.backgroundColor = '#000';

    batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { faceUp: false });

    if (++count >= 450) { await batch.commit(); count = 0; }

  }

  if (count > 0) await batch.commit();

  setPreview();

  //postLog('自分のカードをすべて裏にしました');

}



window.faceUpAll = async function () {

  const batch = writeBatch(db);

  let count = 0;

  for (const [id, el] of cardDomMap) {
    if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
    if (el.classList.contains('memo')) continue;
    el.dataset.faceUp = 'true';

    const imgEl = el.querySelector('img'); if (imgEl) imgEl.style.display = 'block';

    el.style.backgroundColor = '#fff';

    batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { faceUp: true });

    if (++count >= 450) { await batch.commit(); count = 0; }

  }

  if (count > 0) await batch.commit();

  //postLog('自分のカードをすべて表にしました');

}



window.resetMyCardRotation = async function () {

  if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  const batch = writeBatch(db);

  let count = 0;

  for (const [id, el] of cardDomMap) {
    if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
    if (el.classList.contains('memo')) continue;
    el.style.transform = 'rotate(0deg)';

    batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { rotation: 0 });

    if (++count >= 450) { await batch.commit(); count = 0; }

  }

  if (count > 0) await batch.commit();

};









// ===============================

// 数値カウンター生成（入力＋±ボタン）

// ===============================

// ===============================

// ユーティリティ生成

// ===============================

// 数値カウンタ、ダイス、+/- カウンタ、トークン等の生成。

// 数値カウンター（入力型）を生成して自エリア中央に配置

//



window.spawnNumberCounter = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください'); return;

  }

  try {

    const W = 110, H = 60;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, W, H);

    const z = getMaxZIndex() + 50;

    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    await addDoc(baseCol, {

      type: 'numcounter',

      count: 0,               // 初期値

      imageUrl: '',           // 画像は使わない（DOMでUIを構成）

      fullUrl: '',

      x, y, zIndex: z,

      faceUp: true,

      ownerUid: CURRENT_UID,

      ownerSeat: CURRENT_PLAYER,

      rotation: 0,

      visibleToAll: true,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp()

    });



  } catch (e) {

    console.error(e);

    alert('数値カウンター作成に失敗しました。');

  }

};















// ▼ 置換：6面ダイス処理（中央配置・単一化・最前面・3秒CD）

let lastDiceAt = 0;

/**

 * 6面ダイスを1つだけ生成（3秒クールダウン、クリック/右クリックで自分のもののみ削除）

 */



window.rollD6 = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください'); return;

  }

  disableDiceButtons(3000);

  const now = Date.now();

  if (now - lastDiceAt < 3000) return; // 早押しガード

  lastDiceAt = now;



  const btn = document.getElementById('roll-d6-btn');

  if (btn) btn.disabled = true;

  setTimeout(() => { if (btn) btn.disabled = false; }, 3000);



  try {

    // 1) 既存の自分のダイスを削除（常に1つだけにする）

    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    const qOld = query(baseCol, where('type', '==', 'dice'), where('ownerSeat', '==', CURRENT_PLAYER));

    const oldSnap = await getDocs(qOld);

    if (!oldSnap.empty) {

      const batch = writeBatch(db);

      oldSnap.forEach(d => batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${d.id}`)));

      await batch.commit();

    }



    // 2) 新しい出目

    const val = (Math.random() * 6 | 0) + 1;

    const imgUrl = svgDiceDataUrl(val);



    // 3) プレイエリア中央に72x72を置く

    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);



    // 4) 一番手前（既存カード群より十分高いz）

    const z = getMaxZIndex() + 100;



    // 5) 追加

    await addDoc(baseCol, {

      type: 'dice',

      diceValue: val,

      imageUrl: imgUrl,

      fullUrl: imgUrl,

      x, y, zIndex: z,

      faceUp: true,

      ownerUid: CURRENT_UID,

      ownerSeat: CURRENT_PLAYER,

      rotation: 0,

      visibleToAll: true,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp()

    });

    postLog(`6面ダイスを振りました → ${val}`);

  } catch (e) {

    console.error(e);

    alert('ダイス作成に失敗しました。ネットワーク状態を確認してもう一度お試しください。');

  }

};





// === 追加: ダイス/コイン系ボタンを一時的に無効化するユーティリティ ===

function setDiceButtonsDisabled(disabled) {

  ['roll-d4-btn', 'roll-d6-btn', 'roll-d10-btn', 'roll-d20-btn', 'roll-d100-btn', 'flip-coin-btn'].forEach(id => {

    const el = document.getElementById(id);

    if (el) el.disabled = disabled;

  });

}

function disableDiceButtons(ms = 3000) {

  setDiceButtonsDisabled(true);

  setTimeout(() => setDiceButtonsDisabled(false), ms);

}







// ==== 数字表示の汎用ダイスSVG（D10/D20用） ====

function svgNumberDiceDataUrl(n) {

  const size = 72, r = 8;

  const svg = `

    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">

      <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${r}" ry="${r}" fill="#fff" stroke="#111" stroke-width="2"/>

      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"

            font-size="${n >= 100 ? 26 : n >= 10 ? 34 : 40}" font-family="ui-sans-serif, system-ui" fill="#111" font-weight="700">${n}</text>

    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

}



// ==== コインSVG（オモテ／ウラ）：背景を一切敷かず、完全な丸＋透過 ====

function svgCoinDataUrl(face) { // face: 'オモテ' or 'ウラ'

  const size = 72;

  const svg = `

    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">

      <defs><filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/></filter></defs>

      <!-- 余白なし：丸のみ。背景は透明 -->

      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="#ffd54f" stroke="#111" stroke-width="2" filter="url(#s)"/>

      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"

            font-size="24" font-family="ui-sans-serif, system-ui" fill="#111" font-weight="700">${face}</text>

    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

}



// ==== 既存の自分ダイスを一旦削除して1つに揃える ====

async function resetMyDiceIfAny() {

  const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

  const qOld = query(baseCol, where('type', '==', 'dice'), where('ownerSeat', '==', CURRENT_PLAYER));

  const snap = await getDocs(qOld);

  if (!snap.empty) {

    const batch = writeBatch(db);

    snap.forEach(d => batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${d.id}`)));

    await batch.commit();

  }

}



// ==== D10 ====

window.rollD10 = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  disableDiceButtons(3000);

  try {

    await resetMyDiceIfAny();



    const val = (Math.random() * 10 | 0) + 1;

    const imgUrl = svgNumberDiceDataUrl(val);



    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);

    const z = getMaxZIndex() + 100;



    const payload = {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), payload);

    postLog(`10面ダイスを振りました → ${val}`);

  } catch (e) {

    console.error(e); alert('10面ダイスの作成に失敗しました。');

  }

};



// ==== D20 ====

window.rollD20 = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  disableDiceButtons(3000);

  try {

    await resetMyDiceIfAny();



    const val = (Math.random() * 20 | 0) + 1;

    const imgUrl = svgNumberDiceDataUrl(val);

    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);

    const z = getMaxZIndex() + 100;



    const payload = {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), payload);

    postLog(`20面ダイスを振りました → ${val}`);

  } catch (e) {

    console.error(e); alert('20面ダイスの作成に失敗しました。');

  }

};



// ==== D4 ====

window.rollD4 = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  disableDiceButtons(3000);

  try {

    await resetMyDiceIfAny();

    const val = (Math.random() * 4 | 0) + 1;

    const imgUrl = svgNumberDiceDataUrl(val);

    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);

    const z = getMaxZIndex() + 100;

    const payload = {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), payload);

    postLog(`4面ダイスを振りました → ${val}`);

  } catch (e) {

    console.error(e); alert('4面ダイスの作成に失敗しました。');

  }

};



// ==== D100 ====

window.rollD100 = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  disableDiceButtons(3000);

  try {

    await resetMyDiceIfAny();

    const val = (Math.random() * 100 | 0) + 1;

    const imgUrl = svgNumberDiceDataUrl(val);

    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);

    const z = getMaxZIndex() + 100;

    const payload = {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), payload);

    postLog(`100面ダイスを振りました → ${val}`);

  } catch (e) {

    console.error(e); alert('100面ダイスの作成に失敗しました。');

  }

};



// ==== コイン ====

window.flipCoin = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  disableDiceButtons(3000);

  try {

    await resetMyDiceIfAny();



    const isHeads = Math.random() < 0.5;

    const faceJP = isHeads ? 'オモテ' : 'ウラ';

    const val = isHeads ? 1 : 2;   // 便宜的に 1=表, 2=裏
    const imgUrl = svgCoinDataUrl(faceJP);



    const SIZE = 72;

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);

    const z = getMaxZIndex() + 100;



    const payload = {
      type: 'dice',          // 既存の .card.dice の見た目/削除挙動に合わせる
      diceKind: 'coin',      // ← コイン判定用フラグを保存
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), payload);

    postLog(`コイントス → ${faceJP}`);

  } catch (e) {

    console.error(e); alert('コインの作成に失敗しました。');

  }

};













// ===============================

// カウンター生成（+1 / +10 / -1 / -10 など）

// ===============================

function svgCounterDataUrl(label) {

  const size = 60;

  const svg = `

    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">

      <defs>

        <filter id="s">

          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/>

        </filter>

      </defs>

      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="#ffffff" stroke="#111" stroke-width="2" filter="url(#s)"/>

      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="22" font-family="ui-sans-serif, system-ui" fill="#111" font-weight="700">${label}</text>

    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

}

//

// ラベル付き丸型カウンター (+1/-1 など) を生成

// @param {string} label - 表示ラベル

//





// ===============================

// ★追加: トランプ初期化（中央デッキに 52 枚を裏向きで積む）

// 画像配置に合わせて TrumpPicture/<suit>_<rank>.png を使用

// 例: TrumpPicture/spade_A.png, TrumpPicture/heart_10.png など

// ===============================

const TRUMP_IMG_BASE = 'image/Trump';
const TRUMP_BACK_URL = `${TRUMP_IMG_BASE}/back.png`;
const JOKER_URL = `${TRUMP_IMG_BASE}/joker.png`;

async function initializeOfficialGame(mode, roomId) {
  if (mode === 'trump') {
    await spawnTrumpDeck(roomId);
  } else if (mode === 'chess') {
    await spawnChessSet(roomId);
  }
}

function centerOfBoardDeck(w, h) {
  const r = getDeckBoundsForSeat(1); 
  if (!r) return { x: 0, y: 0 };
  const x = Math.round(r.minX + (r.width - w) / 2);
  const y = Math.round(r.minY + (r.height - h) / 2);
  return { x, y };
}

function buildTrumpFrontUrl(suit, rank) {
  const url = `${TRUMP_IMG_BASE}/${suit}_${rank}.png`;
  console.log("[TrumpDebug] Generated front URL:", url);
  return url;
}

async function spawnTrumpDeck(roomId) {
  const SUITS = ['spade', 'heart', 'diamond', 'club'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  await waitForBoardDeckRect();
  const { x, y } = centerOfBoardDeck(CARD_W, CARD_H);
  let z = getMaxZIndex() + 1;

  const col = collection(db, `rooms/${roomId}/cards`);
  let batch = writeBatch(db);
  let count = 0;

  // 52 cards
  for (const s of SUITS) {
    for (const r of RANKS) {
      const url = buildTrumpFrontUrl(s, r);
      const ref = doc(col);
      batch.set(ref, {
        imageUrl: url,
        fullUrl: url,
        backImageUrl: TRUMP_BACK_URL,
        x, y, zIndex: z++,
        faceUp: false,
        ownerUid: null,
        ownerSeat: null,
        rotation: 0,
        visibleToAll: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
    }
  }

  // 2 Jokers
  for (let j = 0; j < 2; j++) {
    const ref = doc(col);
    batch.set(ref, {
      imageUrl: JOKER_URL,
      fullUrl: JOKER_URL,
      backImageUrl: TRUMP_BACK_URL,
      x, y, zIndex: z++,
      faceUp: false,
      ownerUid: null,
      ownerSeat: null,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) await batch.commit();
}

async function spawnChessSet(roomId) {
  const col = collection(db, `rooms/${roomId}/cards`);
  let batch = writeBatch(db);
  let count = 0;
  let z = getMaxZIndex() + 1;

  // Wait for board layout to settle
  await new Promise(resolve => setTimeout(resolve, 800)); 

  const boardEl = document.getElementById('board-play');
  if (!boardEl) { console.error('board-play not found'); return; }
  const fieldRoot = document.getElementById('field');
  if (!fieldRoot) { console.error('field not found'); return; }

  const boardRect = boardEl.getBoundingClientRect();
  const fieldRect = fieldRoot.getBoundingClientRect();
  const zVal = typeof zoom !== 'undefined' ? zoom : 1;

  // Account for board-play's CSS border (background paints inside the border)
  const scaleX = boardRect.width / boardEl.offsetWidth;
  const scaleY = boardRect.height / boardEl.offsetHeight;
  const borderL = boardEl.clientLeft * scaleX;
  const borderT = boardEl.clientTop * scaleY;
  const paddingBoxLeft = boardRect.left + borderL;
  const paddingBoxTop = boardRect.top + borderT;
  const paddingBoxW = boardEl.clientWidth * scaleX;
  const paddingBoxH = boardEl.clientHeight * scaleY;

  // Convert to field CSS coordinates
  const boardInFieldX = (paddingBoxLeft - fieldRect.left) / zVal;
  const boardInFieldY = (paddingBoxTop - fieldRect.top) / zVal;
  const boardW = paddingBoxW / zVal;
  const boardH = paddingBoxH / zVal;

  // Chess board image uses background-size:contain + center → fits to smaller dimension
  const boardSize = Math.min(boardW, boardH);
  const tileSize = boardSize / 8;
  const offsetX = boardInFieldX + (boardW - boardSize) / 2;
  const offsetY = boardInFieldY + (boardH - boardSize) / 2;

  const PIECES = [
    { type: 'rook', files: [0, 7] },
    { type: 'knight', files: [1, 6] },
    { type: 'bishop', files: [2, 5] },
    { type: 'queen', files: [3] },
    { type: 'king', files: [4] }
  ];

  const spawnPiece = (type, color, file, rank) => {
    const fileName = `${color}_${type}.png`; 
    const url = `image/Chess/${fileName}`;
    const pieceSize = tileSize * 0.8;
    const centerOffset = (tileSize - pieceSize) / 2;
    const x = offsetX + file * tileSize + centerOffset;
    const y = offsetY + (7 - rank) * tileSize + centerOffset;
    
    const ref = doc(col);
    batch.set(ref, {
      type: 'image-token',
      imageUrl: url,
      fullUrl: url,
      x, y, zIndex: z++,
      width: pieceSize,
      height: pieceSize,
      faceUp: true,
      ownerUid: null,
      ownerSeat: null,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    if (++count >= 450) { 
      // Note: We can't await inside a non-async callback, but forEach is fine if we manage batches.
    }
  };

  // Black pieces (rank 7, 6)
  PIECES.forEach(p => p.files.forEach(f => spawnPiece(p.type, 'Black', f, 7)));
  for (let f = 0; f < 8; f++) spawnPiece('pawn', 'Black', f, 6);

  // White pieces (rank 0, 1)
  PIECES.forEach(p => p.files.forEach(f => spawnPiece(p.type, 'White', f, 0)));
  for (let f = 0; f < 8; f++) spawnPiece('pawn', 'White', f, 1);

  if (count > 0) await batch.commit();
}







window.spawnCounter = async function (label) {

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください'); return;

  }

  try {

    const imgUrl = svgCounterDataUrl(label || '+1');

    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, 60, 60); // 自エリア中央付近

    const z = getMaxZIndex() + 50;

    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    const payload = {
      type: 'counter',
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(baseCol, payload);

  } catch (e) {

    console.error(e);

    alert('カウンター作成に失敗しました。');

  }

};



// ===============================

// テキストトークン生成（メモ用カード）

// ===============================

// テキストトークン用の薄枠サムネSVGを生成

// @returns {string} data:image/svg+xml;...

//



function blankTokenThumb() {

  // 120x160 の薄枠だけ付けたサムネ（imgは非表示になるが念のため）

  const w = 120, h = 160;

  const svg = `

    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">

      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="10" ry="10"

            fill="#ffffff" stroke="#ddd" stroke-width="2"/>

    </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

}

//

// テキストトークン（メモ）を生成して自エリア内のランダム位置へ配置

//



window.spawnMemo = async function () {
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {
    alert('ルームに参加してから実行してください'); return;
  }
  try {
    const { x, y } = randomPointInMainPlay(CURRENT_PLAYER);
    const z = getMaxZIndex() + 20;
    const imgUrl = blankTokenThumb();
    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    const payload = {
      type: 'memo',
      tokenText: '',
      imageUrl: imgUrl,
      fullUrl: imgUrl,
      x, y, zIndex: z,
      width: 200,
      height: 150,
      fontSize: 20,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (CURRENT_ROOM_META?.expiresAt) payload.expiresAt = CURRENT_ROOM_META.expiresAt;

    await addDoc(baseCol, payload);

  } catch (e) {
    console.error(e);
    alert('メモ作成に失敗しました。');
  }
};









window.deleteMyCards = async function () {

  if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

  if (!confirm('本当に自分の全カードを削除しますか？この操作は取り消せません。')) return;

  try {

    const cardsCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    const q = query(cardsCol, where('ownerUid', '==', CURRENT_UID));

    const snap = await getDocs(q);

    if (snap.empty) { alert('削除対象のカードはありません'); return; }

    let batch = writeBatch(db);

    let count = 0;

    const removedIds = [];

    for (const docSnap of snap.docs) {

      batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${docSnap.id}`));

      removedIds.push(docSnap.id);

      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }

    }

    if (count > 0) await batch.commit();

    removedIds.forEach(id => {

      const el = cardDomMap.get(id);

      if (el) { el.remove(); cardDomMap.delete(id); }

      fullImageStore.delete(id);

    });

    if (previewImg) { setPreview(); }

    alert(`削除しました（${removedIds.length}枚）`);

    postLog('自分のカードを全削除しました');

  } catch (e) {

    console.error(e);

    alert('削除に失敗しました。ネットワーク状況を確認して再度お試しください。');

  }

};



const cardListModal = document.getElementById('card-list-modal');

const cardListGrid = document.getElementById('card-list-grid');

const cardListClose = document.getElementById('card-list-close');







// === 自分の全カードを自分のデッキエリア（ボード/トランプ時は共有デッキ）へ集める ===

window.collectMyCardsToDeck = async function () {

  try {

    if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

      alert('ルームに参加してから実行してください');

      return;

    }



    // デッキ矩形を取得（ボード/トランプ時は中央の共有デッキ）。未計測なら待機してから再取得

    let deckRect = getDeckBoundsForSeat(CURRENT_PLAYER);

    if (!deckRect || deckRect.width <= 0 || deckRect.height <= 0) {

      if (isBoardMode()) deckRect = await waitForBoardDeckRect(1000);

      if (!deckRect || deckRect.width <= 0 || deckRect.height <= 0) {

        alert('デッキエリアが見つかりません');

        return;

      }

    }



    // 画面上に存在する「自分のカード」だけを列挙

    const mine = [];

    for (const [id, el] of cardDomMap) {

      if (el?.dataset?.ownerSeat === String(CURRENT_PLAYER)) {

        mine.push({ id, el });

      }

    }

    if (mine.length === 0) {

      alert('自分のカードがありません');

      return;

    }



    // ランダム配置：各カードをデッキエリア内のランダム座標へ（重なり回避はしない）

    // 既存の最大Zより上に順番に積む

    const baseZ = getMaxZIndex() + 1;

    let i = 0;

    for (const { id } of mine) {

      const { x, y } = randomPointInDeck(CURRENT_PLAYER);

      updateCardBatched(id, { x, y, zIndex: baseZ + i });

      i++;

    }



    // flush は既存のバッファリングに任せる（即時に確定させたい場合は明示的 flush を呼ぶ実装に変更可）

    // 裏表はそのまま（faceUp は更新しない）

  } catch (e) {

    console.error(e);

    alert('カードの移動に失敗しました。ネットワーク状況を確認して再度お試しください。');

  }

};



//集める前に確認ダイアログを出す（削除と同じ体験）

window.confirmCollectMyCardsToDeck = async function () {

  // 削除と同様、参加チェック → 確認 の順に

  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

    alert('ルームに参加してから実行してください');

    return;

  }

  const ok = confirm('自分の全カードをデッキエリアに集めます。よろしいですか？\n（裏表はそのまま）');

  if (!ok) return;

  await collectMyCardsToDeck(); // 既存の本体を呼ぶ

  postLog('自分のカードをデッキに集めました');

};















// === 指定カード削除（自分のカード限定） ===

window.deleteSelectedMine = async function () {

  try {

    if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

    const cards = getCurrentlySelectedCards();

    if (cards.length === 0) { alert('赤枠の「指定カード」を選んでください'); return; }



    const mine = cards.filter(card => {

      const ownerUid = card.dataset.ownerUid || null;

      const ownerSeat = card.dataset.ownerSeat || null;

      return (ownerUid && ownerUid === CURRENT_UID) || (ownerSeat && String(ownerSeat) === String(CURRENT_PLAYER));

    });



    if (mine.length === 0) { alert('自分のカードではありません'); return; }



    const confirmDel = confirm(`選択した ${mine.length} 枚の自分のカードを削除しますか？`);

    if (!confirmDel) return;



    let batch = writeBatch(db);

    let count = 0;



    for (const card of mine) {

      const id = card.dataset.cardId;

      if (!id) continue;



      batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));



      // 画面からも除去

      const el = cardDomMap.get(id);

      if (el) { el.remove(); cardDomMap.delete(id); }

      fullImageStore?.delete?.(id);



      if (++count >= 450) {

        await batch.commit();

        batch = writeBatch(db);

        count = 0;

      }

    }



    if (count > 0) await batch.commit();



    if (window.previewImg) { setPreview(); }

    postLog(`選択中のカード ${mine.length} 枚を削除しました`);



  } catch (e) {

    console.error(e);

    alert('削除に失敗しました。ネットワーク状況を確認して再度お試しください。');

  }

};







// 現在選択中のカードを安全に取得（selectedCard / window.selectedCard / DOM を順に見る）

function getCurrentlySelectedCard() {

  // グローバルでないスコープにある selectedCard も拾えるように typeof で存在確認

  const localSel = (typeof selectedCard !== 'undefined') ? selectedCard : null;

  return localSel || window.selectedCard || document.querySelector('.card.selected') || null;

}



// 現在選択中のすべてのカードを取得

function getCurrentlySelectedCards() {

  return Array.from(document.querySelectorAll('.card.selected'));

}





// === 指定カードを最背面へ（自分のカード限定） ===

window.sendSelectedToBack = async function () {

  try {

    if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }

    const cards = getCurrentlySelectedCards();

    if (cards.length === 0) { alert('赤枠の「指定カード」を選んでください'); return; }



    const mine = cards.filter(card => {

      const ownerUid = card.dataset.ownerUid || null;

      const ownerSeat = card.dataset.ownerSeat || null;

      return (ownerUid && ownerUid === CURRENT_UID) || (ownerSeat && String(ownerSeat) === String(CURRENT_PLAYER));

    });



    if (mine.length === 0) { alert('自分のカードではありません'); return; }



    // 画面上に存在する zIndex の最小値を探す

    let minZ = Infinity;

    cardDomMap.forEach(el => {

      const z = parseInt(el.style.zIndex || '1', 10);

      if (!Number.isNaN(z) && z < minZ) minZ = z;

    });

    if (!isFinite(minZ)) minZ = 1;



    // 複数選択時は、元々のZ順を保ちつつ一番下に持っていく

    mine.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));



    mine.forEach((el, index) => {

      const newZ = minZ - mine.length + index;

      el.style.zIndex = newZ;

      const id = el.dataset.cardId;

      if (id) {

        // Firestore へも反映（バッチ最適化経由）

        updateCardBatched(id, { zIndex: newZ });

      }

    });



    postLog(`選択中のカード ${mine.length} 枚を最背面に送りました`);

  } catch (e) {

    console.error(e);

  }

};









window.openMyCardsDialog = function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER) { alert('ルームに参加してから実行してください'); return; }

  cardListGrid.innerHTML = '';

  const mine = [];

  for (const [id, el] of cardDomMap) {

    if (el.dataset.ownerSeat === String(CURRENT_PLAYER)) {

      const imgEl = el.querySelector('img');

      const src = fullImageStore.get(id) || (imgEl ? imgEl.src : '');

      mine.push({ id, src });

    }

  }

  if (mine.length === 0) {

    const empty = document.createElement('div');

    empty.textContent = 'まだ自分のカードがありません。';

    empty.style.cssText = 'color:#666;font-size:14px;text-align:center;padding:24px 12px;';

    cardListGrid.appendChild(empty);

  } else {

    mine.forEach(({ id, src }) => {

      const item = document.createElement('div');

      item.style.cssText = 'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';

      item.title = id;

      const img = document.createElement('img'); img.crossOrigin = 'anonymous';

      img.src = src; img.alt = 'カード'; img.style.cssText = 'width:100%;height:auto;object-fit:contain;border-radius:6px;';

      item.appendChild(img);

      item.addEventListener('mouseenter', () => { item.style.outline = '3px solid #66aaff'; });

      item.addEventListener('mouseleave', () => { item.style.outline = 'none'; });

      item.addEventListener('click', async () => {

        await focusCardById(id);

        // ★全カード一覧から選択したログ

        postLog(`全カード一覧からカードを選択しました`);

        closeMyCardsDialog();

      });

      cardListGrid.appendChild(item);

    });

  }

  cardListModal.style.display = 'flex';

};



function closeMyCardsDialog() { cardListModal.style.display = 'none'; }

cardListClose?.addEventListener('click', closeMyCardsDialog);

cardListModal?.addEventListener('click', (e) => { if (e.target === cardListModal) closeMyCardsDialog(); });



async function focusCardById(cardId, additive = false, skipPreview = false) {

  const el = cardDomMap.get(cardId) || document.querySelector(`[data-card-id="${cardId}"]`);

  if (!el) return;

  const newZ = getMaxZIndex() + 1;

  el.style.zIndex = newZ; 

  if (!additive) {

    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));

  }

  el.classList.add('selected');

  selectedCard = el;

  const full = fullImageStore.get(cardId);

  const thumbEl = el.querySelector('img');

  const isFaceUp = el.dataset.faceUp === 'true';

  const otherHand = isOtherPlayersHandCard(el);

  const ownerSeatValue = parseInt(el.dataset.ownerSeat || '0', 10);

  const frontSrc = full || (thumbEl && thumbEl.src) || '';

  const previewSrc = (!isFaceUp || otherHand)

    ? getSeatBackUrl(ownerSeatValue)

    : frontSrc;

  if (!skipPreview) {

    setPreview(previewSrc);

    const ownerPlayerNum = el.dataset.ownerSeat ? `SEAT${el.dataset.ownerSeat}` : '?';

    previewInfo.textContent = `カードのオーナー: ${ownerPlayerNum} / あなた: P${CURRENT_PLAYER || "?"}`;

  }

}









//自分の「デッキエリア内カード」だけを一覧表示

window.openMyDeckCardsDialog = function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER) { alert('ルームに参加してから実行してください'); return; }



  // タイトルを書き換え

  const titleEl = document.getElementById('card-list-title');

  if (titleEl) titleEl.textContent = 'デッキエリアのカード一覧（自分）';



  cardListGrid.innerHTML = '';



  // 自分のデッキエリアの矩形を取得

  const deckRect = getDeckBoundsForSeat(CURRENT_PLAYER); // 既存関数

  if (!deckRect) { alert('あなたのデッキエリアが見つかりません'); return; }



  // 画面上のカードDOMから、矩形内 かつ 自分のカードのみ を抽出

  // ※「自分のデッキエリアにある自分のカード」のみを対象にしています

  const listed = [];

  for (const [id, el] of cardDomMap) {

    if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue; // 自分のカードのみ

    const left = parseFloat(el.style.left) || 0;

    const top = parseFloat(el.style.top) || 0;

    const cx = left + CARD_W / 2;

    const cy = top + CARD_H / 2;

    if (cx >= deckRect.minX && cx <= deckRect.minX + deckRect.width &&

      cy >= deckRect.minY && cy <= deckRect.minY + deckRect.height) {

      const imgEl = el.querySelector('img');

      const src = fullImageStore.get(id) || (imgEl ? imgEl.src : '');

      listed.push({ id, src });

    }

  }



  if (listed.length === 0) {

    const empty = document.createElement('div');

    empty.textContent = 'デッキエリア内にカードがありません。';

    empty.style.cssText = 'color:#666;font-size:14px;text-align:center;padding:24px 12px;';

    cardListGrid.appendChild(empty);

  } else {

    listed.forEach(({ id, src }) => {

      const item = document.createElement('div');

      item.style.cssText =

        'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';

      item.title = id;

      const img = document.createElement('img'); img.crossOrigin = 'anonymous';

      img.src = src; img.alt = 'カード'; img.style.cssText = 'width:100%;height:auto;object-fit:contain;border-radius:6px;';

      item.appendChild(img);

      item.addEventListener('mouseenter', () => { item.style.outline = '3px solid #66aaff'; });

      item.addEventListener('mouseleave', () => { item.style.outline = 'none'; });

      item.addEventListener('click', async () => {

        await focusCardById(id);   // 最前面 & プレビュー更新（既存）

        // ★デッキ一覧から選択したログ

        postLog(`デッキ一覧からカードを選択しました`);

        closeMyCardsDialog();

      });

      cardListGrid.appendChild(item);

    });

  }

  cardListModal.style.display = 'flex';

}







window.openMyDiscardCardsDialog = function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER) {

    alert('ルームに参加してから実行してください');

    return;

  }



  // タイトルを書き換え（モーダルは既存のものを流用）

  const titleEl = document.getElementById('card-list-title');

  if (titleEl) titleEl.textContent = t('side.discardList') || '捨て札のカード一覧';



  // 捨て札エリアの矩形を取得（モードに応じて個別 or 共有）

  const discardRect = getDiscardBoundsForSeat(CURRENT_PLAYER);

  if (!discardRect || !discardRect.width || !discardRect.height) {

    alert('あなたの捨て札エリアが見つかりません');

    return;

  }



  // 自分のカードのうち、中心点が捨て札エリア内にあるものだけ抽出

  cardListGrid.innerHTML = '';

  const listed = [];

  for (const [id, el] of cardDomMap) {

    if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue; // 自分のカードのみ

    const left = parseFloat(el.style.left) || 0;

    const top = parseFloat(el.style.top) || 0;

    const cx = left + CARD_W / 2;

    const cy = top + CARD_H / 2;

    if (cx >= discardRect.minX && cx <= discardRect.minX + discardRect.width &&

      cy >= discardRect.minY && cy <= discardRect.minY + discardRect.height) {

      const imgEl = el.querySelector('img');

      const src = fullImageStore.get(id) || (imgEl ? imgEl.src : '');

      listed.push({ id, src });

    }

  }



  if (listed.length === 0) {

    const empty = document.createElement('div');

    empty.textContent = '捨て札エリア内にカードがありません。';

    empty.style.cssText = 'color:#666;font-size:14px;text-align:center;padding:24px 12px;';

    cardListGrid.appendChild(empty);

  } else {

    listed.forEach(({ id, src }) => {

      const item = document.createElement('div');

      item.style.cssText = 'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';

      item.title = id;

      const img = document.createElement('img'); img.crossOrigin = 'anonymous';

      img.src = src; img.alt = 'カード'; img.style.cssText = 'width:100%;height:auto;object-fit:contain;border-radius:6px;';

      item.appendChild(img);

      item.addEventListener('mouseenter', () => { item.style.outline = '3px solid #66aaff'; });

      item.addEventListener('mouseleave', () => { item.style.outline = 'none'; });

      item.addEventListener('click', async () => {

        await focusCardById(id);   // 最前面 & プレビュー更新（既存）

        // ★捨て札一覧から選択したログ

        postLog(`捨て札一覧からカードを選択しました`);

        closeMyCardsDialog();

      });

      cardListGrid.appendChild(item);

    });

  }

  cardListModal.style.display = 'flex';

};













window.toggleFieldSizeOptions = function () { fieldSizeOptions.style.display = fieldSizeOptions.style.display === "none" ? "block" : "none"; }

window.setFieldSize = function (size) {

  window.currentFieldSize = size;

  const pc = typeof getPlayerSeatsCount === 'function' ? getPlayerSeatsCount() : 4;

  const mm = typeof CURRENT_ROOM_META !== 'undefined' ? CURRENT_ROOM_META?.fieldMode : null;

  const mode = (mm === 'board' || mm === 'trump') ? 'board' : 'card';

  const cols = mode === 'card' ? Math.max(1, Math.ceil(pc / 2)) : 2;

  const colWidths = { small: 1500, medium: 2500, large: 5000 };

  const heights = { small: 1700, medium: 2500, large: 5000 };

  const colW = colWidths[size] || colWidths.small;

  const h = heights[size] || heights.small;

  const w = colW * cols;

  field.style.width = `${w}px`;

  field.style.height = `${h}px`;

  field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

}

window.shuffleDecks = async function () {

  if (!CURRENT_ROOM || !CURRENT_PLAYER) return;

  const srcBounds = getDeckBoundsForSeat(CURRENT_PLAYER);

  if (!srcBounds) { alert('あなたのデッキエリアが見つかりません'); return; }

  const targets = getCardsInsideRect(srcBounds);

  if (targets.length === 0) return;

  shuffleArray(targets);

  const dstBounds = getDeckBoundsForSeat(CURRENT_PLAYER);

  if (!dstBounds) { alert('あなたのデッキエリアが見つかりません'); return; }

  const centerX = Math.round(dstBounds.minX + (dstBounds.width - CARD_W) / 2);

  const centerY = Math.round(dstBounds.minY + (dstBounds.height - CARD_H) / 2);

  const baseZ = getMaxZIndex() + 1;

  let z = baseZ;

  // バッチで位置/zIndexをまとめ書き

  let batch = writeBatch(db); let count = 0;

  for (const { id, el } of targets) {

    el.style.left = `${centerX}px`;

    el.style.top = `${centerY}px`;

    el.style.zIndex = z++;

    batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { x: centerX, y: centerY, zIndex: parseInt(el.style.zIndex) || z });

    if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }

  }

  if (count > 0) await batch.commit();

  updateOverlapBadges(); //一括移動のあとに最新化

  postLog('デッキをシャッフルしました');

};

window.collectSelectedCards = async function () {

  if (!CURRENT_ROOM) return;

  const selectedCards = Array.from(document.querySelectorAll('.card.selected'));

  if (selectedCards.length === 0) {

    alert(t('err.noSelectedCards'));

    return;

  }



  // 中心座標の計算 (左上の平均)

  let totalX = 0, totalY = 0;

  selectedCards.forEach(el => {

    totalX += parseFloat(el.style.left) || 0;

    totalY += parseFloat(el.style.top) || 0;

  });

  const avgX = Math.round(totalX / selectedCards.length);

  const avgY = Math.round(totalY / selectedCards.length);



  // ランダムな順番でシャッフル

  const targets = selectedCards.map(el => ({ id: el.dataset.cardId, el }));

  shuffleArray(targets);



  const baseZ = getMaxZIndex() + 1;

  let z = baseZ;

  let batch = writeBatch(db);

  let count = 0;



  for (const { id, el } of targets) {

    el.style.left = `${avgX}px`;

    el.style.top = `${avgY}px`;

    el.style.zIndex = z++;

    

    batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), {

      x: avgX,

      y: avgY,

      zIndex: parseInt(el.style.zIndex) || z

    });

    

    if (++count >= 450) {

      await batch.commit();

      batch = writeBatch(db);

      count = 0;

    }

  }

  if (count > 0) await batch.commit();

  updateOverlapBadges();

  postLog(`${targets.length}枚の選択カードをまとめました`);

};





// ===============================

// フィールド操作（パン/ズーム/選択解除）

// ===============================

// フィールドのパン/ズーム/選択解除、タッチピンチ/パンのハンドラを登録

//



function bindPanZoomHandlers() {

  // === マウスホイールズーム

  field.addEventListener("wheel", e => {

    if (e.ctrlKey) return;

    e.preventDefault();

    const rect = field.getBoundingClientRect();

    const cx = e.clientX - rect.left;

    const cy = e.clientY - rect.top;

    const scale = 0.1;

    const old = zoom;

    zoom += e.deltaY < 0 ? scale : -scale;

    zoom = Math.max(0.3, Math.min(zoom, 3));

    const sx = (cx - panOffsetX) / old;

    const sy = (cy - panOffsetY) / old;

    panOffsetX = cx - sx * zoom;

    panOffsetY = cy - sy * zoom;

    field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

  }, { passive: false });



  // === マウス1本パン

  container.addEventListener("mousedown", e => {

    if (e.button !== 0 && e.button !== 1) return;

    if (e.detail > 1) return;

    if (e.target.closest(".card")) return;



    if (e.shiftKey || e.button === 1) {

      // Marquee selection

      e.preventDefault();

      const containerRect = container.getBoundingClientRect();

      const startX = e.clientX - containerRect.left;

      const startY = e.clientY - containerRect.top;

      const marquee = document.getElementById('marquee');

      if (!marquee) return;



      marquee.style.display = 'block';

      marquee.style.left = `${startX}px`;

      marquee.style.top = `${startY}px`;

      marquee.style.width = '0px';

      marquee.style.height = '0px';



      const onMove = e2 => {

        const curX = e2.clientX - containerRect.left;

        const curY = e2.clientY - containerRect.top;

        const left = Math.min(startX, curX);

        const top = Math.min(startY, curY);

        const width = Math.abs(curX - startX);

        const height = Math.abs(curY - startY);

        marquee.style.left = `${left}px`;

        marquee.style.top = `${top}px`;

        marquee.style.width = `${width}px`;

        marquee.style.height = `${height}px`;

      };



      const onUp = () => {

        document.removeEventListener("mousemove", onMove);

        document.removeEventListener("mouseup", onUp);



        const mRect = marquee.getBoundingClientRect();

        marquee.style.display = 'none';



        if (mRect.width < 5 && mRect.height < 5) return;



        const fieldOriginX = containerRect.left + panOffsetX;

        const fieldOriginY = containerRect.top + panOffsetY;



        const minX = (mRect.left - fieldOriginX) / zoom;

        const minY = (mRect.top - fieldOriginY) / zoom;

        const width = mRect.width / zoom;

        const height = mRect.height / zoom;



        const cards = getCardsInsideRect({ minX, minY, width, height });



        if (cards.length > 0) {

          // Clear current selection

          document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));



          cards.forEach(({ id, el }) => {

            el.classList.add('selected');

          });



          if (cards.length === 1) {

            focusCardById(cards[0].id, true);

          } else {

            const lastId = cards[cards.length - 1].id;

            focusCardById(lastId, true, true);

          }

        }

      };

      document.addEventListener("mousemove", onMove);

      document.addEventListener("mouseup", onUp);

      return;

    }



    const TH = 5;

    let panning = false;

    let sx = e.clientX, sy = e.clientY;

    document.body.style.userSelect = 'none';

    container.style.cursor = 'grabbing';

    const onMove = e2 => {

      const dx = e2.clientX - sx;

      const dy = e2.clientY - sy;

      if (!panning) {

        if (Math.hypot(dx, dy) < TH) return;

        panning = true;

      }

      panOffsetX += dx;

      panOffsetY += dy;

      sx = e2.clientX; sy = e2.clientY;

      field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

    };

    const cleanup = () => {

      document.removeEventListener("mousemove", onMove);

      document.removeEventListener("mouseup", cleanup);

      document.body.style.userSelect = '';

      container.style.cursor = '';

    };

    document.addEventListener("mousemove", onMove);

    document.addEventListener("mouseup", cleanup);

  });



  // === タッチ：1本指パン / 2本指ピンチズーム

  let touchMode = { type: null, startDist: 0, startZoom: zoom, startPanX: 0, startPanY: 0, cx: 0, cy: 0, sx: 0, sy: 0 };



  const getDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const getCenter = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });



  container.addEventListener('touchstart', (e) => {

    if (e.target.closest('.card')) return;  // カード上のタッチはカード側で処理

    if (e.touches.length === 1) {

      e.preventDefault();

      touchMode.type = 'pan';

      touchMode.sx = e.touches[0].clientX;

      touchMode.sy = e.touches[0].clientY;

    } else if (e.touches.length === 2) {

      e.preventDefault();

      touchMode.type = 'pinch';

      touchMode.startDist = getDist(e.touches[0], e.touches[1]);

      touchMode.startZoom = zoom;

      const c = getCenter(e.touches[0], e.touches[1]);

      const rect = field.getBoundingClientRect();

      touchMode.cx = c.x - rect.left;

      touchMode.cy = c.y - rect.top;

      touchMode.startPanX = panOffsetX;

      touchMode.startPanY = panOffsetY;

    }

  }, { passive: false });



  container.addEventListener('touchmove', (e) => {

    if (touchMode.type === 'pan' && e.touches.length === 1) {

      e.preventDefault();

      const t = e.touches[0];

      const dx = t.clientX - touchMode.sx;

      const dy = t.clientY - touchMode.sy;

      touchMode.sx = t.clientX;

      touchMode.sy = t.clientY;

      panOffsetX += dx;

      panOffsetY += dy;

      field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

    } else if (touchMode.type === 'pinch' && e.touches.length === 2) {

      e.preventDefault();

      const dist = getDist(e.touches[0], e.touches[1]);

      let nextZoom = touchMode.startZoom * (dist / Math.max(1, touchMode.startDist));

      nextZoom = Math.max(0.3, Math.min(nextZoom, 3));

      // ピンチ中心を維持するようにオフセットを調整

      const old = touchMode.startZoom;

      const cx = touchMode.cx, cy = touchMode.cy;

      panOffsetX = cx - ((cx - touchMode.startPanX) / old) * nextZoom;

      panOffsetY = cy - ((cy - touchMode.startPanY) / old) * nextZoom;

      zoom = nextZoom;

      field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

    }

  }, { passive: false });



  const endTouch = () => { touchMode.type = null; };

  container.addEventListener('touchend', endTouch);

  container.addEventListener('touchcancel', endTouch);



  // === 余白クリックで選択解除

  field.addEventListener("click", e => {

    if (e.shiftKey) return; // 範囲選択（Shift+Drag）直後のブブリングによる解除を防止

    

    const selected = document.querySelectorAll('.card.selected');

    if (selected.length > 0) {

      selected.forEach(el => el.classList.remove("selected"));

      selectedCard = null;

      setPreview();

    }

  });

}









// ===== end room button

// ===============================

// ルーム終了ボタンの制御

// ===============================

function updateEndRoomButtonVisibility() {
  const show = !!(CURRENT_ROOM && IS_ROOM_CREATOR);
  const seated = show && CURRENT_PLAYER !== 'spectator';
  if (endRoomBtn) endRoomBtn.style.display = show ? 'block' : 'none';
  // Host section container
  if (hostOtherOpsWrap) hostOtherOpsWrap.style.display = show ? 'block' : 'none';
  // Save buttons: only when host is seated
  if (hostSaveRoomBtn) hostSaveRoomBtn.style.display = seated ? 'block' : 'none';
  // hostOtherOpsSaveBtn is a button inside hostOtherOpsWrap
  if (hostOtherOpsSaveBtn) hostOtherOpsSaveBtn.style.display = seated ? '' : 'none';
  // Load buttons: always when host is in room
  if (hostLoadRoomBtn) hostLoadRoomBtn.style.display = show ? 'block' : 'none';
}





// ===== leave room button

// ===============================

// 非ホスト専用の「退室する」ボタン制御

function updateLeaveRoomButtonVisibility() {
  // 自分が今、どこかの席に座っている かつ 「ホストではない」場合だけ表示
  const show = !!(CURRENT_ROOM && CURRENT_PLAYER && !IS_ROOM_CREATOR);
  if (leaveRoomBtn) leaveRoomBtn.style.display = show ? 'block' : 'none';
}



// クリックで手動退室

leaveRoomBtn?.addEventListener('click', async () => {

  if (!(CURRENT_ROOM && CURRENT_PLAYER)) { alert('ルームに参加していません。'); return; }

  if (!confirm('席を空けて退室します。よろしいですか？')) return;

  leaveRoomBtn.disabled = true; const old = leaveRoomBtn.textContent; leaveRoomBtn.textContent = '退室中…';

  try {

    // ★ 先に自分のカードを全削除（非ホストのみ）

    try { await deleteMyCardsSilently(); } catch (_) { }

    try { stopHeartbeat(); } catch (_) { }

    try {

      await releaseSeat(db, CURRENT_ROOM, CURRENT_PLAYER, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);

    } catch (_) { }

    try { if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; } } catch (_) { }

    try { if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; } } catch (_) { }

    try { if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; } } catch (_) { }

    try { if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; } } catch (_) { }

    try { stopHostWatch(); } catch (_) { }

    CURRENT_ROOM = null; CURRENT_PLAYER = null;

    sessionIndicator.textContent = 'ROOM: - / PLAYER: -';

    if (lobby) lobby.style.display = 'flex';

  } finally {

    leaveRoomBtn.disabled = false; leaveRoomBtn.textContent = old;

    updateLeaveRoomButtonVisibility(); updateEndRoomButtonVisibility();

  }

});





// ★ 非ホストUI（参加中のみ表示）

const showLeave = !!(CURRENT_ROOM && !isHost);

if (leaveRoomBtn) leaveRoomBtn.style.display = showLeave ? 'block' : 'none';



endRoomBtn?.addEventListener('click', async () => {

  if (!IS_ROOM_CREATOR) {
    alert('この操作は、ホストのみ実行できます。');
    return;
  }

  if (!confirm('ルームを終了します。全カードと座席情報が削除され、全員が退出します。よろしいですか？')) return;



  endRoomBtn.disabled = true;

  const old = endRoomBtn.textContent;

  endRoomBtn.textContent = '終了中...';



  try {

    // 1) 先に全て止める（復活防止）

    try { stopHostHeartbeat(); } catch (_) { }

    try { stopHeartbeat(); } catch (_) { }

    try { stopHostWatch(); } catch (_) { }

    try { if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; } } catch (_) { }

    try { if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; } } catch (_) { }

    try { if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; } } catch (_) { }

    try { if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; } } catch (_) { }



    // UIを即時クリア（DBは既に消えるがDOMが残らないように）

    clearFieldDOM();



    // 2) Firestore 側を完全掃除（cards / seats 全削除 → 親doc削除）

    await cleanupAndDeleteRoom(db, CURRENT_ROOM);





    CURRENT_ROOM = null;

    CURRENT_PLAYER = null;

    sessionIndicator.textContent = 'ROOM: - / PLAYER: -';

    if (lobby) lobby.style.display = 'flex';

    alert('ルームを終了しました。');
    location.href = 'lobby.html';

  } catch (e) {

    console.error(e);

    alert('ルームの終了に失敗しました。ネットワークをご確認のうえ再試行してください。');

  } finally {

    endRoomBtn.disabled = false;

    endRoomBtn.textContent = old;

    updateEndRoomButtonVisibility();

    updateLeaveRoomButtonVisibility();

  }

});



// ===== Init

let zoom = 1, panOffsetX = 0, panOffsetY = 0, selectedCard = null;





// モバイルでは初期ズームを少し下げて全体を見やすく

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;





// ===============================

// フィールド初期化とハンドラ束ね

// ===============================

// 初期ズーム/サイズ、ハンドラ初回バインド、モード適用。

// フィールド初期サイズ/ズームの設定、各種ハンドラ一回登録、モード適用

//





// チャット見出しの折りたたみ

document.getElementById('toggle-chat')?.addEventListener('click', () => {

  const panel = document.getElementById('chat-panel');

  const btn = document.getElementById('toggle-chat');

  if (!panel || !btn) return;

  const hide = panel.style.display !== 'none' ? true : false;

  panel.style.display = hide ? 'none' : '';

  btn.textContent = hide ? '▶' : '◀';

});







function initializePlayField() {

  setFieldSize('small');



  if (IS_MOBILE) {

    zoom = 0.8;

    panOffsetX = 0; panOffsetY = 0;

    field.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;

  }



  if (!handlersBound) {

    bindUploadHandlers();

    bindPanZoomHandlers();

    bindAreaColorHandlers();

    handlersBound = true;

  }



  applyFieldModeLayout();



}





const rollBtn = document.getElementById('roll-d6-btn');

rollBtn?.addEventListener('click', () => window.rollD6());





// render helpers

function updateEndRoomButtonVisibilityWrapper() { updateEndRoomButtonVisibility(); }







// HTMLの onclick="..." から呼ぶ関数を公開（存在するものだけ残す）

Object.assign(window, {

  openSaveLoadDialog,

  openMyCardsDialog,

  openMyDeckCardsDialog,

  openMyDiscardCardsDialog,

  resetMyCardRotation,

  faceDownAll,

  faceUpAll,

  shuffleDecks,

  confirmCollectMyCardsToDeck,

  deleteMyCards,

  deleteSelectedMine,

  sendSelectedToBack,



  // コイン・ダイス

  flipCoin,

  rollD10,

  rollD20,

  rollD4: window.rollD4,

  rollD100: window.rollD100,



  // カウンター / トークン

  spawnNumberCounter,

  spawnCounter,

  spawnMemo,



  // フィールドサイズUI

  toggleFieldSizeOptions,

  setFieldSize,

  // 背面画像ピッカー起動

  openBackImagePicker,

});







// === 補助: 現在ホストかどうか ===

function isHostNow() {

  const isHostUid = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);

  const isHostSeat = !!(CURRENT_ROOM_META?.hostSeat && CURRENT_PLAYER && CURRENT_ROOM_META.hostSeat === CURRENT_PLAYER);

  return !!(CURRENT_ROOM && isHostUid && isHostSeat);

}



// === サイレント版：自分の全カードを確認なしで削除（UI通知なし） ===

async function deleteMyCardsSilently() {

  try {

    if (!CURRENT_ROOM || !CURRENT_UID) return;

    // 非ホストのみ対象

    if (isHostNow()) return;

    const cardsCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);

    const snap = await getDocs(query(cardsCol, where('ownerUid', '==', CURRENT_UID)));

    if (snap.empty) return;

    let batch = writeBatch(db), n = 0;

    const removed = [];

    for (const d of snap.docs) {

      batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${d.id}`));

      removed.push(d.id);

      if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }

    }

    if (n > 0) await batch.commit();

    // 画面上の残骸も掃除

    for (const id of removed) {

      const el = cardDomMap.get(id);

      if (el) { el.remove(); cardDomMap.delete(id); }

      try { fullImageStore.delete(id); } catch (_) { }

    }

    if (typeof setPreview === 'function') setPreview();

    // ログだけは残す（部屋が未クローズのうちに）

    try { postLog('退室に伴い自分のカードを自動削除しました'); } catch (_) { }

  } catch (_) { /* サイレント運用のため握りつぶす */ }

}







// === 背面画像のアップロード／保存 ===

function openBackImagePicker() {

  // ===== カード裏面デザイン: プレミアム限定 =====

  if (!IS_PREMIUM) {

    alert('カード裏面デザインの変更はプレミアム会員限定の機能です。');

    return;

  }

  const input = document.getElementById('card-back-input');

  if (!input) return;

  input.value = '';

  input.click();

}



// ファイル選択時の処理（1枚だけ採用）

(function bindBackImageInput() {

  const input = document.getElementById('card-back-input');

  if (!input) return;

  input.addEventListener('change', async (e) => {

    const file = e.target.files && e.target.files[0];

    if (!file) return;

    if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {

      alert('ルームに参加してから実行してください'); return;

    }

    try {

      // Storage: rooms/{room}/seats/{seat}/card-back.jpg

      const path = `rooms/${CURRENT_ROOM}/seats/${CURRENT_PLAYER}/card-back.jpg`;

      const sref = ref(storage, path);

      // 圧縮が不要ならそのまま、必要ならここで canvas リサイズしてから uploadBytes

      await uploadBytes(sref, file);

      const url = await getDownloadURL(sref);

      // Firestore: 席ドキュメントへ保存 → 全クライアントへ配信

      await updateSeatBatched(CURRENT_PLAYER, {

        backImageUrl: url,

        updatedAt: serverTimestamp()

      });

      // 自分の画面は即時反映

      refreshCardBacksForSeat(CURRENT_PLAYER);

    } catch (err) {

      console.error('back image upload/save failed', err);

      alert('カード背面画像の保存に失敗しました。通信状況をご確認ください。');

    }

  });

})();




// ==== 保存ルームの復元（URLパラメータ） ====

async function checkRestoreRoomSlot() {

  const urlParams = new URLSearchParams(window.location.search);

  const restoreSlot = urlParams.get('restore_room_slot');

  if (!restoreSlot) return false;



  const slotNum = parseInt(restoreSlot, 10);

  if (!slotNum || slotNum < 1 || slotNum > 3) return false;



  await ensureAuthReady();

  if (!CURRENT_UID) {

    alert('保存したルームを読み込むにはログインが必要です。');

    return false;

  }



  if (lobby) lobby.style.display = 'none'; // 先に隠す



  try {

    const slotPath = `users/${CURRENT_UID}/savedRooms/slot${slotNum}`;

    const snap = await getDoc(doc(db, slotPath));

    if (!snap.exists()) {

      alert(`SLOT ${slotNum} に保存されたルームはありません。`);

      if (lobby) lobby.style.display = 'flex';

      return false;

    }



    const slotData = snap.data();

    const originalRoomId = slotData.originalRoomId || 'unknown';

    // 新しいルームIDを生成 (元のID + timestamp)

    const newRoomId = `${originalRoomId}-${Date.now().toString().slice(-6)}`;

    const roomData = slotData.roomData || { playerCount: 4 };



    // 1. 新しいルームを作成

    const hostName = localStorage.getItem('pa:displayName') || 'Host';

    const payload = {

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),

      hostUid: CURRENT_UID,

      hostDisplayName: hostName,

      lastSeatPing: serverTimestamp(), // ★ ホストが自動退出されないように現在時刻をセット

      roomClosed: false,

      fieldMode: roomData.fieldMode || 'card',

      fieldSize: roomData.fieldSize || 'medium',

      playerCount: roomData.playerCount || 4,

      allowOthersMove: roomData.allowOthersMove || false,

      isRestored: true,

      restoredFromSlot: slotNum

    };



    await setDoc(doc(db, `rooms/${newRoomId}`), payload);



    // 2. コレクションデータのコピー

    const copyCollection = async (colName, transformDoc = (d, id) => d) => {

      const srcCol = collection(db, `${slotPath}/${colName}`);

      const destCol = collection(db, `rooms/${newRoomId}/${colName}`);

      const srcSnap = await getDocs(srcCol);



      if (srcSnap.empty) return;



      let batch = writeBatch(db);

      let n = 0;

      for (const d of srcSnap.docs) {

        batch.set(doc(destCol, d.id), transformDoc(d.data(), d.id));

        if (++n >= 450) {

          await batch.commit();

          batch = writeBatch(db);

          n = 0;

        }

      }

      if (n > 0) await batch.commit();

    };



    // カードの復元

    await copyCollection('cards', (d) => {

      // 復元されたカードのUI表示などをリセット

      d.updatedAt = serverTimestamp();

      return d;

    });



    // 座席(HP等)の復元。ホストは自分に付け替え、他は空席扱いにするかそのまま残すか

    // (ここではHP情報などを残しつつ、アクセス管理上全員ログアウト状態にリセット)

    await copyCollection('seats', (d, id) => {

      // 復元したホストをSEAT1(CURRENT_PLAYER)に強制アサイン

      if (id === '1') {

        return {

          ...d,

          claimedByUid: CURRENT_UID,

          displayName: hostName,

          heartbeatAt: serverTimestamp()

        };

      }

      // 他人の席は空席化

      return {

        ...d,

        claimedByUid: null,

        displayName: '',

        heartbeatAt: serverTimestamp()

      };

    });



    // チャットのログを追加

    await copyCollection('log');

    await addDoc(collection(db, `rooms/${newRoomId}/chat`), {

      type: 'log',

      text: `SLOT ${slotNum} の保存データからルームを復元しました`,

      seat: 1, // 仮

      name: 'System',

      createdAt: serverTimestamp()

    });



    // 3. ルームに入る

    // パラメータを取り除いたURLに履歴書き換え

    window.history.replaceState({}, document.title, window.location.pathname);



    IS_ROOM_CREATOR = true;

    startHostHeartbeat(newRoomId);



    CURRENT_ROOM_META = { hostUid: CURRENT_UID, hostDisplayName: hostName, fieldMode: roomData.fieldMode };

    CURRENT_ROOM = newRoomId;

    CURRENT_PLAYER = 1; // 復元ホストは基本SEAT1



    await setDoc(doc(db, `rooms/${newRoomId}`), { hostSeat: CURRENT_PLAYER, updatedAt: serverTimestamp() }, { merge: true });



    currentSeatMap[CURRENT_PLAYER] = { claimedByUid: CURRENT_UID, displayName: hostName };

    renderFieldLabels();



    startSession(newRoomId, CURRENT_PLAYER);



    try {

      subscribeHP(CURRENT_ROOM);

      renderHPPanel();

    } catch (e) { console.warn('[HP] subscribe failed', e); }



    // トランプモード初期化等が必要なら

    if (roomData.fieldMode === 'trump') applyFieldModeLayout();



    alert('保存したルームを復元しました。');

    return true;



  } catch (e) {

    console.error('Room restore failed', e);

    alert('保存ルームの復元に失敗しました。');

    if (lobby) lobby.style.display = 'flex';

    // URL戻す

    window.history.replaceState({}, document.title, window.location.pathname);

    return false;

  }

}

// ===============================

// エリア背景画像

// ===============================

let unsubscribeAreas = null;

let areaContextMenuBound = false;

let currentTargetAreaId = null; 
// For context menu targeting
let currentTargetAreaSeat = null; // 1..8 if seat area
let currentTargetAreaKey = null;  // 'deck', 'main', etc.
let currentTargetAreaElement = null;



function subscribeAreas() {

  if (unsubscribeAreas) { unsubscribeAreas(); unsubscribeAreas = null; }

  if (!CURRENT_ROOM) return;



  const qAreas = collection(db, `rooms/${CURRENT_ROOM}/areas`);

  unsubscribeAreas = onSnapshot(qAreas, snap => {

    snap.docChanges().forEach(change => {

      const id = change.doc.id;

      const data = change.doc.data();



      let el = null;

      // ID例: "player-1-play-area" -> selector: .player-area.player-1 .play-area

      const parts = id.match(/^(player-\d)-(.+)$/);

      if (parts) {

        const seat = parts[1]; // target seat class, e.g. "player-1"

        const key = parts[2];  // short key, e.g. "main", "deck"

        const cls = (key === 'main') ? 'main-play-area' : (key + '-area');

        el = document.querySelector(`.player-area.${seat} .${cls}`);

      } else {

        el = document.querySelector(`[data-area-id="${id}"]`);

        if (!el) el = document.getElementById(id);

        if (!el) el = document.querySelector(`.${id}`);

      }



      // ★ 配置モード中のガード（el 解決後に行う）

      if (el && el.dataset.moving === 'true') return;

      if (placingArea && placingArea.el && placingArea.el.dataset.areaId === id) return;



      if (!el && data.isAbsolute && change.type !== 'removed') {

           el = document.createElement('div');

           el.className = data.type + (id.startsWith('dynamic-') ? ' dynamic-area' : '');

           el.dataset.areaId = id;

           let label = 'エリア';

           if(data.type==='deck-area') label = 'デッキエリア';

           else if(data.type==='hand-area') label = '手札エリア';

           else if(data.type==='discard-area') label = '捨て札エリア';

           el.innerHTML = `<div class="zone-label" data-i18n="zone.deck">${label}</div>`;

           field.appendChild(el);

           console.log('[subscribeAreas] 新エリア作成:', id);

      }





      if (!el) {

        console.warn('[subscribeAreas] el not found, skip. id=', id);

        return;

      }



      if (change.type === 'removed') {

        if (el.classList.contains('dynamic-area')) {

          console.warn('[subscribeAreas] removed → el.remove() id=', id);

          el.remove();

        } else {

          el.style.backgroundImage = '';

          el.style.backgroundSize = '';

          el.style.backgroundPosition = '';

          el.style.backgroundRepeat = '';

        }

        return;

      }



      // Deleted flag sync from other players

      if (data.isDeleted) {

        if (el.classList.contains('dynamic-area') || el.classList.contains('center-deck') || el.classList.contains('center-discard')) {

          el.remove();

        } else {

          el.style.display = 'none';

        }

        return;

      } else {

        el.style.display = ''; // Restore if undeleted

      }



      // Background image sync

      if (!data.imageUrl) {

        el.style.backgroundImage = '';

        el.style.backgroundSize = '';

        el.style.backgroundPosition = '';

        el.style.backgroundRepeat = '';

      } else {

        el.style.backgroundImage = `url(${data.imageUrl})`;

        el.style.backgroundSize = 'contain';

        el.style.backgroundPosition = 'center';

        el.style.backgroundRepeat = 'no-repeat';

      }



      const scaleLevel = data.scaleLevel || 0;

      const multX = data.multX || 1;

      const multY = data.multY || 1;

      const scale = Math.pow(1.2, scaleLevel);

      

      el.style.setProperty('--area-mult-x', multX);

      el.style.setProperty('--area-mult-y', multY);



      // Position & Scale sync
      if (data.isAbsolute || data.x !== undefined || data.width !== undefined) {
        el.dataset.areaId = id; 
        
        // 以前は field 直下へ移動させていたが、board-layout 内に留めても position:absolute ならOK。
        // ただし座標計算が field 基準なので、親を field に統一する方が安全。
        if (el.parentElement !== field && (data.isAbsolute || id.includes('dynamic'))) {
          el.style.width = el.offsetWidth + 'px';
          el.style.height = el.offsetHeight + 'px';
          field.appendChild(el);
        }

        el.style.position = 'absolute';

        // z-index を動的に設定（100: プレイエリア系 / 200: サブエリア系）。カード(300〜)より背面を維持。
        const isPlayType = (id.includes('main-play-area') || id.includes('board-play'));
        el.style.zIndex = isPlayType ? '100' : '200';
        
        if (data.x !== undefined) el.style.left = data.x + 'px';
        if (data.y !== undefined) el.style.top = data.y + 'px';
        
        // サイズ適用（倍率 multX/multY はリサイズ操作で width/height 自体に取り込まれる運用も可能だが、
        // 既存の multX/multY も考慮して適用する）
        if (data.width !== undefined) el.style.width = (data.width * multX) + 'px';
        if (data.height !== undefined) el.style.height = (data.height * multY) + 'px';

        // board-play の場合は親の #board-layout も同期する
        if (id === 'board-play') {
          const layout = el.parentElement;
          if (layout && layout.id === 'board-layout') {
            if (data.width !== undefined) layout.style.width = data.width + 'px';
            if (data.height !== undefined) layout.style.height = data.height + 'px';
            if (data.x !== undefined) layout.style.left = data.x + 'px';
            if (data.y !== undefined) layout.style.top = data.y + 'px';
          }
        }

      } else {
        // グリッド等に属している場合、実測のピクセル幅（ベース）を計り、正確に倍率を掛けます。
        el.style.width = '';
        el.style.height = '';
        
        const baseW = el.offsetWidth;
        const baseH = el.offsetHeight;
        
        if (multX !== 1) el.style.width = (baseW * multX) + 'px';
        if (multY !== 1) el.style.height = (baseH * multY) + 'px';
        
        el.classList.add('auto-scale-area');
      }

      

      // テキストなどが歪まないように、単一の全体スケール(拡大/縮小)のみtransformで処理

      el.style.transform = `scale(${scale})`;

      el.style.transformOrigin = '50% 50%';

    });

  });

}



let tokenContextMenuBound = false;

let currentTokenId = null;



function bindTokenContextMenuOnce() {

  if (tokenContextMenuBound) return;

  tokenContextMenuBound = true;



  const ctxMenu = document.getElementById('token-context-menu');

  const btnEnlarge = document.getElementById('token-ctx-enlarge');

  const btnShrink = document.getElementById('token-ctx-shrink');

  const btnDelete = document.getElementById('token-ctx-delete');

  const btnFontPlus = document.getElementById('token-ctx-font-plus');
  const btnFontMinus = document.getElementById('token-ctx-font-minus');
  const btnToFront = document.getElementById('token-ctx-to-front');
  const btnToBack = document.getElementById('token-ctx-to-back');

  if (!ctxMenu || !btnEnlarge || !btnShrink || !btnDelete || !btnToFront || !btnToBack || !btnFontPlus || !btnFontMinus) return;



  document.addEventListener('click', (e) => {

    if (e.target.closest('#token-context-menu')) return;

    ctxMenu.style.display = 'none';

  });



  document.addEventListener('contextmenu', () => {

    ctxMenu.style.display = 'none';

  });



  btnEnlarge.addEventListener('click', async (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    if (!CURRENT_ROOM || !currentTokenId) return;

    try {

      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);

      const snap = await getDoc(docRef);

      if (snap.exists()) {

        const d = snap.data();

        const currentLevel = typeof d.scaleLevel === 'number' ? d.scaleLevel : 0;

        await updateDoc(docRef, { scaleLevel: currentLevel + 1, updatedAt: serverTimestamp() });

      }

    } catch (err) { console.warn(err); }

  });



  btnShrink.addEventListener('click', async (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    if (!CURRENT_ROOM || !currentTokenId) return;

    try {

      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);

      const snap = await getDoc(docRef);

      if (snap.exists()) {

        const d = snap.data();

        const currentLevel = typeof d.scaleLevel === 'number' ? d.scaleLevel : 0;

        await updateDoc(docRef, { scaleLevel: currentLevel - 1, updatedAt: serverTimestamp() });

      }

    } catch (err) { console.warn(err); }

  });



  btnToFront.addEventListener('click', async (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    if (!CURRENT_ROOM || !currentTokenId) return;

    try {

      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);

      const zIndex = getMaxZIndex() + 1;

      await updateDoc(docRef, { zIndex, updatedAt: serverTimestamp() });

    } catch (err) { console.warn(err); }

  });



  btnToBack.addEventListener('click', async (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    if (!CURRENT_ROOM || !currentTokenId) return;

    try {

      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);

      const zIndex = getMinZIndex() - 1;

      await updateDoc(docRef, { zIndex, updatedAt: serverTimestamp() });

    } catch (err) { console.warn(err); }

  });



  btnDelete.addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    if (!CURRENT_ROOM || !currentTokenId) return;
    const confirmDel = confirm('このメモ/トークンを削除しますか？');
    if (!confirmDel) return;
    try {
      const id = currentTokenId;
      await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));
      if (typeof markLocal === 'function') markLocal(id);
      if (typeof markLocalDelete === 'function') markLocalDelete(id);
    } catch (err) { console.warn('delete token failed', err); }
  });

  btnFontPlus.addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    if (!CURRENT_ROOM || !currentTokenId) return;
    try {
      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        const currentSize = typeof d.fontSize === 'number' ? d.fontSize : 20;
        await updateDoc(docRef, { fontSize: Math.min(currentSize + 4, 120), updatedAt: serverTimestamp() });
      }
    } catch (err) { console.warn(err); }
  });

  btnFontMinus.addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    if (!CURRENT_ROOM || !currentTokenId) return;
    try {
      const docRef = doc(db, `rooms/${CURRENT_ROOM}/cards/${currentTokenId}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        const currentSize = typeof d.fontSize === 'number' ? d.fontSize : 20;
        await updateDoc(docRef, { fontSize: Math.max(currentSize - 4, 8), updatedAt: serverTimestamp() });
      }
    } catch (err) { console.warn(err); }
  });

}



globalThis.showTokenContextMenu = function(e, cardId) {

  const ctxMenu = document.getElementById('token-context-menu');

  if (!ctxMenu) return;

  e.preventDefault();

  e.stopPropagation();



  const areaMenu = document.getElementById('area-context-menu');

  if (areaMenu) areaMenu.style.display = 'none';

  

  currentTokenId = cardId;

  ctxMenu.style.display = 'block';



  let x = e.clientX;

  let y = e.clientY;

  const menuWidth = ctxMenu.offsetWidth || 150;

  const menuHeight = ctxMenu.offsetHeight || 100;

  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;

  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight;

  ctxMenu.style.left = `${x}px`;

  ctxMenu.style.top = `${y}px`;

};



function bindAreaContextMenuOnce() {

  if (areaContextMenuBound) return;

  areaContextMenuBound = true;



  const ctxMenu = document.getElementById('area-context-menu');

  const btnChangeBg = document.getElementById('area-ctx-change-bg');

  const btnChangeColor = document.getElementById('area-ctx-change-color');

  const btnRemoveBg = document.getElementById('area-ctx-remove-bg');

  const btnDeleteArea = document.getElementById('area-ctx-delete-area');

  const fileInput = document.getElementById('area-bg-file');

  const btnEnlarge = document.getElementById('area-ctx-enlarge');

  const btnShrink = document.getElementById('area-ctx-shrink');

  const btnEnlargeW = document.getElementById('area-ctx-enlarge-w');

  const btnShrinkW = document.getElementById('area-ctx-shrink-w');

  const btnEnlargeH = document.getElementById('area-ctx-enlarge-h');

  const btnShrinkH = document.getElementById('area-ctx-shrink-h');

  const btnMove = document.getElementById('area-ctx-move');

  const btnAddArea = document.getElementById('area-ctx-add');

  const btnAddDeck = document.getElementById('area-ctx-add-deck');



  if (!ctxMenu || !btnChangeBg || !fileInput) return;



  const targetAreaSelectors = [

    // カードゲームモード

    '.play-area', '.main-play-area', '.discard-area', '.deck-area', '.special-area', '.hand-area',

    // ボードゲームモード

    '#board-play', '.board-hand', '.center-deck', '.center-discard'

  ];



  // 右クリックイベントを各エリアにアタッチ (キャプチャフェーズで処理)

  document.addEventListener('contextmenu', (e) => {

    // ===== DEBUG: 右クリック調査ログ =====

    const debugTarget = e.target;

    const debugArea = e.target.closest(targetAreaSelectors.join(', '));

    const debugCard = e.target.closest('.card');

    console.group('[DEBUG] contextmenu fired');

    console.log('  e.target:', debugTarget);

    console.log('  e.target tagName:', debugTarget.tagName);

    console.log('  e.target className:', debugTarget.className);

    console.log('  e.target id:', debugTarget.id);

    console.log('  closest area?', debugArea);

    console.log('  closest .card?', debugCard);

    // e.targetからdocumentに向かってDOMツリーを出力

    const path = e.composedPath ? e.composedPath() : [];

    console.log('  event path (先頭5件):', path.slice(0, 5));

    console.groupEnd();

    // ===== DEBUG ここまで =====



    let area = e.target.closest(targetAreaSelectors.join(', '));

    if (!area) {

      console.warn('[DEBUG] area not found → contextmenu listener 早期リターン');

      return;

    }



    // カードの上で右クリックした場合はカード側で処理させるor標準メニューを出すので抜ける

    if (e.target.closest('.card')) {

      console.warn('[DEBUG] .card に引っかかって早期リターン');

      return;

    }



    // ここまで来たということは確実にエリアへの右クリックなので、ブラウザの標準メニューを止める

    e.preventDefault();

    e.stopPropagation();



    const playerArea = area.closest('.player-area');

    const isDynamicOrMoved = !playerArea && area.parentElement?.id === 'field';



    let pClass = '';

    let aClass = '';

    

    // 実際に保存するキーは対象のメインエリア名 (.play-area など)

    const mainSelectors = ['.main-play-area', '.discard-area', '.deck-area', '.special-area', '.hand-area'];

    const foundSel = mainSelectors.find(sel => area.classList.contains(sel.slice(1)));

    aClass = foundSel ? foundSel.slice(1) : '';



    currentTargetAreaSeat = null;

    currentTargetAreaKey = null;

    currentTargetAreaElement = area;



    if (playerArea) {

      const pMatch = playerArea.className.match(/player-(\d)/);

      pClass = pMatch ? pMatch[1] : '';

      if (!pClass || !aClass) return; 



      const seatNum = parseInt(pClass, 10);

      currentTargetAreaSeat = seatNum;

      currentTargetAreaKey = aClass === 'main-play-area' ? 'main' : aClass.replace('-area', '');

      currentTargetAreaId = `player-${seatNum}-${currentTargetAreaKey}`;

    } else if (isDynamicOrMoved) {

      // aClass が空でも dataset.areaId/id で特定できればOK（ボードモードエリアが field に移動した場合など）

      currentTargetAreaId = area.dataset.areaId || area.id;

      if (!currentTargetAreaId && !aClass) return;

      if (!currentTargetAreaId) currentTargetAreaId = aClass; // fallback to class

      if (!currentTargetAreaId) return;

    } else {

      // ボードゲームモードのエリア (#board-play, .board-hand, .center-deck, .center-discard)

      const boardId = area.id || area.dataset.areaId;

      if (!boardId) {

        // IDがなければクラスから生成

        const boardClass = [...area.classList].find(c => ['board-hand', 'center-deck', 'center-discard'].includes(c));

        if (!boardClass) return;

        currentTargetAreaId = boardClass;

      } else {

        currentTargetAreaId = boardId;

      }

    }



    e.stopPropagation();



    // メニュー表示

    ctxMenu.style.display = 'block';



    const isHost = CURRENT_UID && CURRENT_ROOM_META?.hostUid === CURRENT_UID;
    const isCardMode = CURRENT_ROOM_META?.fieldMode === 'card';

    document.querySelectorAll('#area-context-menu .host-only').forEach(el => {
      // カードゲームモードの場合は、ホストであってもレイアウト操作系を非表示にする
      let show = isHost && !isCardMode;
      el.style.display = show ? 'flex' : 'none';
      if(el.tagName === 'HR') el.style.display = show ? 'block' : 'none'; // HR fallback
    });



    // エリア色変更の表示制御: 自分の座席エリアのみ

    if (btnChangeColor) {

      const isMyArea = currentTargetAreaSeat === CURRENT_PLAYER;

      btnChangeColor.style.display = isMyArea ? 'flex' : 'none';

    }

    

    // Hide 'Move' or 'Add' depending on area
    if (isHost && btnMove && btnAddArea) {
      if (isCardMode) {
        btnMove.style.display = 'none';
        btnAddArea.style.display = 'none';
      } else {
        if (aClass === 'play-area' || aClass === 'main-play-area') {
          btnMove.style.display = 'none';
          btnAddArea.style.display = 'flex';
        } else {
          btnMove.style.display = 'flex';
          btnAddArea.style.display = 'none';
        }
      }
    }



    if (isHost && btnDeleteArea) {
      if (isCardMode) {
        btnDeleteArea.style.display = 'none';
      } else {
        const isPlayOrHand = ['play-area', 'main-play-area', 'hand-area', 'board-play', 'board-hand'].includes(aClass) || 
                             ['board-play', 'board-hand'].includes(currentTargetAreaId) || 
                             area.classList.contains('board-hand') || area.classList.contains('hand-area');
        if (isPlayOrHand) {
          btnDeleteArea.style.display = 'none';
        } else {
          btnDeleteArea.style.display = 'flex';
        }
      }
    }



    // 画面外にはみ出ないように位置調整

    const menuWidth = ctxMenu.offsetWidth;

    const menuHeight = ctxMenu.offsetHeight;

    let x = e.clientX;

    let y = e.clientY;



    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;

    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight;



    ctxMenu.style.left = `${x}px`;

    ctxMenu.style.top = `${y}px`;

    console.log('[contextmenu-capture] Menu positioned at', x, y);

  }, true); // true: capture phase



  // 他の場所をクリックしたらメニューを閉じる

  document.addEventListener('click', () => {

    ctxMenu.style.display = 'none';

  });



  // メニュー: エリア色変更をクリック

  if (btnChangeColor) {

    btnChangeColor.addEventListener('click', (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (currentTargetAreaElement && currentTargetAreaSeat && currentTargetAreaKey) {

        triggerAreaColorPicker(currentTargetAreaElement, currentTargetAreaSeat, currentTargetAreaKey);

      }

    });

  }



  // メニュー: 画像変更をクリック

  btnChangeBg.addEventListener('click', (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    // ===== フィールドデザイン: プレミアム限定 =====

    if (!IS_PREMIUM) {

      alert('フィールドデザインの変更はプレミアム会員限定の機能です。');

      return;

    }

    fileInput.click();

  });



  // メニュー: 画像削除をクリック

  btnRemoveBg.addEventListener('click', async (e) => {

    e.stopPropagation();

    ctxMenu.style.display = 'none';

    if (!CURRENT_ROOM || !currentTargetAreaId) return;



    try {

      await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`));

    } catch (err) {

      console.warn('Failed to delete area bg:', err);

    }

  });



  if (btnDeleteArea) {

    btnDeleteArea.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;



      if (!confirm('このエリアを完全に削除（非表示）にしますか？\n※ページをリロードすると元に戻る場合があります')) return;



      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        await setDoc(docRef, { isDeleted: true }, { merge: true });

        

        // ローカルでも直ちに反映

        const el = getCurrentTargetAreaElement();

        if (el) {

          if (el.classList.contains('dynamic-area') || el.classList.contains('center-deck') || el.classList.contains('center-discard')) {

            el.remove();

          } else {

            el.style.display = 'none';

          }

        }

      } catch (err) {

        console.warn('Failed to delete area entirely:', err);

      }

    });

  }



  // ファイル選択時: アップロードしてFirestoreに書き込み

  fileInput.addEventListener('change', async (e) => {

    const file = e.target.files[0];

    if (!file || !CURRENT_ROOM || !currentTargetAreaId) return;



    // 同じファイルを選べるようにリセット

    fileInput.value = '';



    try {

      const extMatch = file.name.match(/\.[0-9a-z]+$/i);

      const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';

      const storagePath = `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}_${Date.now()}${ext}`;



      const sref = ref(storage, storagePath);

      await uploadBytes(sref, file);

      const url = await getDownloadURL(sref);



      await setDoc(doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`), {

        imageUrl: url,

        updatedAt: serverTimestamp()

      });



      // ログ出力

      appendSystemLine(`エリア画像を更新しました (${currentTargetAreaId})`);

    } catch (err) {

      console.error('Area BG upload failed:', err);

      appendSystemLine('画像のアップロードに失敗しました。');

    }

  });



  if (btnEnlarge) {

    btnEnlarge.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const currentLevel = snap.exists() && typeof snap.data().scaleLevel === 'number' ? snap.data().scaleLevel : 0;

        await setDoc(docRef, { scaleLevel: currentLevel + 1, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnShrink) {

    btnShrink.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const currentLevel = snap.exists() && typeof snap.data().scaleLevel === 'number' ? snap.data().scaleLevel : 0;

        await setDoc(docRef, { scaleLevel: currentLevel - 1, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnEnlargeW) {

    btnEnlargeW.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const cur = snap.exists() && typeof snap.data().multX === 'number' ? snap.data().multX : 1;

        await setDoc(docRef, { multX: cur * 2, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnShrinkW) {

    btnShrinkW.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const cur = snap.exists() && typeof snap.data().multX === 'number' ? snap.data().multX : 1;

        await setDoc(docRef, { multX: cur * 0.5, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnEnlargeH) {

    btnEnlargeH.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const cur = snap.exists() && typeof snap.data().multY === 'number' ? snap.data().multY : 1;

        await setDoc(docRef, { multY: cur * 2, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnShrinkH) {

    btnShrinkH.addEventListener('click', async (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      try {

        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);

        const snap = await getDoc(docRef);

        const cur = snap.exists() && typeof snap.data().multY === 'number' ? snap.data().multY : 1;

        await setDoc(docRef, { multY: cur * 0.5, updatedAt: serverTimestamp() }, { merge: true });

      } catch (err) { console.warn(err); }

    });

  }



  if (btnMove) {

    btnMove.addEventListener('click', (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      const targetArea = getCurrentTargetAreaElement();

      if (targetArea) startAreaPlacement(targetArea, false, currentTargetAreaId);

    });

  }



  if (btnAddDeck) {

    btnAddDeck.addEventListener('click', (e) => {

      e.stopPropagation();

      ctxMenu.style.display = 'none';

      if (!CURRENT_ROOM) return;

      const newAreaId = `dynamic-deck-${Date.now()}`;

      const newArea = document.createElement('div');

      newArea.className = 'deck-area dynamic-area';

      newArea.dataset.areaId = newAreaId;

      newArea.innerHTML = `<div class="zone-label" data-i18n="zone.deck">デッキエリア</div>`;

      startAreaPlacement(newArea, true, newAreaId, 'deck-area');

    });

  }

}



function getCurrentTargetAreaElement() {

  if (!currentTargetAreaId) return null;

  const match = currentTargetAreaId.match(/^(player-\d)-(.+)$/);

  let el = null;

  if (match) {

    const seat = match[1]; // e.g. "player-1"

    const key = match[2];  // e.g. "main"

    const cls = (key === 'main') ? 'main-play-area' : (key + '-area');

    el = document.querySelector(`.player-area.${seat} .${cls}`);

  }

  if (!el) {

    el = document.querySelector(`[data-area-id="${currentTargetAreaId}"]`);

  }

  // ボードモードのエリアは id 属性 or クラス名で存在する

  if (!el) el = document.getElementById(currentTargetAreaId);

  if (!el) el = document.querySelector(`.${currentTargetAreaId}`);

  return el;

}



let placingArea = null;



function stopAreaPlacement() {

  if (placingArea) {

    if (placingArea.el) delete placingArea.el.dataset.moving;

    placingArea.el.style.opacity = placingArea.origOpacity;

    placingArea.el.style.pointerEvents = 'auto';

    placingArea.el.style.filter = '';

    if (placingArea.isNew && placingArea.el.parentElement) {

      placingArea.el.remove();

    }

    document.removeEventListener('mousemove', placingArea.mouseMoveHandler);

    document.removeEventListener('click', placingArea.clickHandler);

    document.removeEventListener('contextmenu', placingArea.cancelHandler);

    placingArea = null;

  }

}




/**
 * エリアをドラッグでリサイズ可能にする（ホスト専用）
 */
function makeAreaResizable(el, areaId) {
  if (!el || !areaId) return;
  const isHost = CURRENT_UID && CURRENT_ROOM_META?.hostUid === CURRENT_UID;
  if (!isHost) return;
  if (el.dataset.resizableBound === 'true') return;
  el.dataset.resizableBound = 'true';

  console.log(`[ResizeDebug] Initializing handles for: ${areaId}`);

  const positions = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    el.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      console.log(`[ResizeDebug] Handle clicked: ${pos} on ${areaId}`);
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = el.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const z = typeof zoom !== 'undefined' ? zoom : 1;
      
      // ボードレイアウト全体のスケーリング補正 (現在は 1.0)
      const isBoardArea = !!el.closest('#board-layout');
      const bScale = 1.0; 
      const totalScale = z * bScale;

      // 倍率を考慮したベースの幅と高さ
      const startW = startRect.width / totalScale;
      const startH = startRect.height / totalScale;
      const startL = (startRect.left - fieldRect.left) / totalScale;
      const startT = (startRect.top - fieldRect.top) / totalScale;

      el.classList.add('area-resizing');

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / totalScale;
        const dy = (moveEvent.clientY - startY) / totalScale;

        let newL = startL;
        let newT = startT;
        let newW = startW;
        let newH = startH;

        if (pos.includes('e')) newW = Math.max(50, startW + dx);
        if (pos.includes('s')) newH = Math.max(50, startH + dy);
        if (pos.includes('w')) {
          const delta = Math.min(dx, startW - 50);
          newL = startL + delta;
          newW = startW - delta;
        }
        if (pos.includes('n')) {
          const delta = Math.min(dy, startH - 50);
          newT = startT + delta;
          newH = startH - delta;
        }

        if (areaId === 'board-play') {
          const layout = el.parentElement;
          if (layout && layout.id === 'board-layout') {
            layout.style.width = newW + 'px';
            layout.style.height = newH + 'px';
            layout.style.left = newL + 'px';
            layout.style.top = newT + 'px';
            console.log(`[ResizeDebug] board-play move: w=${newW}, h=${newH}, l=${newL}, t=${newT}`);
          }
          return;
        }

        el.style.left = newL + 'px';
        el.style.top = newT + 'px';
        el.style.width = newW + 'px';
        el.style.height = newH + 'px';

        if (Math.random() < 0.1) { 
           console.log(`[ResizeDebug] ${areaId} move: w=${newW}, h=${newH}, l=${newL}, t=${newT}`);
        }
      };

      const onMouseUp = async () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        el.classList.remove('area-resizing');

        // 保存 (Firestore)
        if (!CURRENT_ROOM) return;
        try {
          const data = {
            x: parseFloat(el.style.left) || 0,
            y: parseFloat(el.style.top) || 0,
            width: parseFloat(el.style.width) || el.offsetWidth,
            height: parseFloat(el.style.height) || el.offsetHeight,
            updatedAt: serverTimestamp()
          };

          if (areaId === 'board-play') {
            const layout = el.parentElement;
            await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), {
              boardWidth: parseFloat(layout.style.width) || layout.offsetWidth,
              boardHeight: parseFloat(layout.style.height) || layout.offsetHeight,
              boardX: parseFloat(layout.style.left) || 0,
              boardY: parseFloat(layout.style.top) || 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
            console.log('[ResizeDebug] Saved board-play to room doc');
          } else {
            const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${areaId}`);
            await setDoc(docRef, {
              ...data,
              isAbsolute: true // リサイズ後は絶対配置へ移行
            }, { merge: true });
            console.log(`[ResizeDebug] Saved area ${areaId} to areas collection`);
          }
        } catch (err) { console.warn('Area resize save failed', err); }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

function startAreaPlacement(areaEl, isNew, areaId, forceType) {

  stopAreaPlacement();



  areaEl.dataset.areaId = areaId;

  areaEl.dataset.moving = 'true';



  const origOpacity = areaEl.style.opacity || '1';

  areaEl.style.opacity = '0.6';

  areaEl.style.pointerEvents = 'none'; 

  areaEl.style.zIndex = '10000';



  placingArea = { el: areaEl, origOpacity, isNew, type: null, mouseMoveHandler: null, clickHandler: null, cancelHandler: null, overlap: false };



  if (!isNew) {

    const isBoardArea = !!areaEl.closest('#board-layout');
    const boardScale = 1.0; // scale(1.3)廃止に伴い 1.0 固定



    const curW = areaEl.offsetWidth * boardScale;

    const curH = areaEl.offsetHeight * boardScale;

    areaEl.style.width = curW + 'px';

    areaEl.style.height = curH + 'px';



    if (areaEl.parentElement && areaEl.parentElement.id !== 'field') {

      const rect = areaEl.getBoundingClientRect();

      field.appendChild(areaEl);

      areaEl.style.position = 'absolute';

      const fieldRect = field.getBoundingClientRect();

      const z = typeof zoom !== 'undefined' ? zoom : 1;

      areaEl.style.left = ((rect.left - fieldRect.left) / z) + 'px';

      areaEl.style.top  = ((rect.top  - fieldRect.top)  / z) + 'px';

    }

  } else {

    areaEl.style.width = '140px';

    areaEl.style.height = '160px';

    field.appendChild(areaEl);

  }

  areaEl.style.position = 'absolute';



  const typeClasses = ['hand-area', 'deck-area', 'discard-area'];

  const type = forceType || [...areaEl.classList].find(c => typeClasses.includes(c)) || 'deck-area';



  const mouseMoveHandler = (e) => {

    if (!placingArea) return;

    const fieldRect = field.getBoundingClientRect();

    const mx = e.clientX;

    const my = e.clientY;

    let z = typeof zoom !== 'undefined' ? zoom : 1;

    const w = areaEl.offsetWidth * z;

    const h = areaEl.offsetHeight * z;

    const x = ((mx - fieldRect.left) / z) - (w / z / 2);

    const y = ((my - fieldRect.top) / z) - (h / z / 2);

    areaEl.style.left = x + 'px';

    areaEl.style.top = y + 'px';



    const checkRect = { l: mx - w/2, t: my - h/2, r: mx + w/2, b: my + h/2 };

    let overlap = false;

    document.querySelectorAll('.hand-area, .deck-area, .discard-area').forEach(other => {

      if (other === areaEl) return;

      const obr = other.getBoundingClientRect();

      const otherRect = { l: obr.left, t: obr.top, r: obr.right, b: obr.bottom };

      if (intersects(checkRect, otherRect)) overlap = true;

    });



    if (overlap) {

      areaEl.style.filter = 'brightness(0.5) sepia(1) hue-rotate(-50deg) saturate(5)';

      placingArea.overlap = true;

    } else {

      areaEl.style.filter = '';

      placingArea.overlap = false;

    }

  };



  const clickHandler = async (e) => {

    if (!placingArea) return;

    e.preventDefault();

    e.stopPropagation();

    if (placingArea.overlap) return;



    const x = parseFloat(areaEl.style.left);

    const y = parseFloat(areaEl.style.top);

    const width = parseFloat(areaEl.style.width);

    const height = parseFloat(areaEl.style.height);



    document.removeEventListener('mousemove', placingArea.mouseMoveHandler);

    document.removeEventListener('click', placingArea.clickHandler);

    document.removeEventListener('contextmenu', placingArea.cancelHandler);

    delete areaEl.dataset.moving;

    placingArea = null;



    areaEl.style.opacity = origOpacity;

    areaEl.style.pointerEvents = 'auto';

    areaEl.style.filter = '';

    

    const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${areaId}`);

    try {

      await setDoc(docRef, {

        isAbsolute: true,

        type: type,

        x, y,

        width, height,

        updatedAt: serverTimestamp()

      }, { merge: true });

    } catch(err) { console.warn(err); }

  };



  const cancelHandler = (e) => {

    e.preventDefault();

    stopAreaPlacement();

  };



  setTimeout(() => {

    document.addEventListener('mousemove', mouseMoveHandler);

    document.addEventListener('click', clickHandler);

    document.addEventListener('contextmenu', cancelHandler);

  }, 100);



  placingArea.type = type;

  placingArea.mouseMoveHandler = mouseMoveHandler;

  placingArea.clickHandler = clickHandler;

  placingArea.cancelHandler = cancelHandler;

}



// 起動時にロード処理

(async function initApp() {





  // URL復元チェック
  const isRestoring = await checkRestoreRoomSlot();
  if (isRestoring) return;

  // URL IDチェック
  await checkUrlParamsAndJoin();
})();

async function checkUrlParamsAndJoin() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  if (!roomId) return;

  await ensureAuthReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    // 匿名サインインを試みる
    try { await signInAnonymously(auth); } catch (e) { console.error(e); }
  }

  // 既に初期化済みならスキップ
  if (CURRENT_ROOM === roomId) return;

  try {
    const roomSnap = await getDoc(doc(db, `rooms/${roomId}`));
    if (!roomSnap.exists()) {
      alert('指定されたルームが見つかりません。');
      window.location.href = 'lobby.html';
      return;
    }
    const meta = roomSnap.data();

    // セッション復旧試行（以前の座席があるか）
    const seatId = await recoverSession(roomId);
    
    // 座席があるか、またはパスワード不要ならそのまま開始
    if (seatId !== 'spectator' || !meta.hasPassword) {
      if (seatId !== 'spectator') {
        const name = localStorage.getItem('pa:last-player-name') || auth.currentUser?.displayName || 'Anonymous';
        startSession(roomId, seatId);
      } else {
        // パスワード不要な場合も直接入室（観戦者として）
        startSession(roomId, 'spectator');
      }
      return;
    }

    // パスワードまたは名前が必要な場合
    const modal = document.getElementById('direct-join-modal');
    const djInfo = document.getElementById('dj-room-info');
    const djName = document.getElementById('dj-player-name');
    const djPassArea = document.getElementById('dj-password-area');
    const djPass = document.getElementById('dj-room-pass');
    const djStartBtn = document.getElementById('dj-start-btn');

    if (!modal) return;
    modal.style.display = 'flex';
    djInfo.textContent = `ROOM ID: ${roomId}`;
    djName.value = localStorage.getItem('pa:last-player-name') || '';
    if (meta.hasPassword) djPassArea.style.display = 'block';

    djStartBtn.onclick = async () => {
      const name = djName.value.trim();
      const pass = djPass.value.trim();
      if (!name) { alert(t('err.playerName')); return; }
      
      if (meta.hasPassword) {
        const hash = await sha256Hex(pass);
        if (hash !== meta.joinPassHash) { alert(t('err.passWrong')); return; }
      }

      localStorage.setItem('pa:last-player-name', name);
      modal.style.display = 'none';
      startSession(roomId, 'spectator');
    };

  } catch (e) {
    console.error('URL Join failed', e);
  }
}

async function recoverSession(roomId) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return 'spectator';
    const seatsCol = collection(db, `rooms/${roomId}/seats`);
    const snap = await getDocs(query(seatsCol, where('claimedByUid', '==', uid)));
    if (!snap.empty) {
      // 生存確認
      const d = snap.docs[0].data();
      const hb = d.heartbeatAt?.toMillis ? d.heartbeatAt.toMillis() : 0;
      if (Date.now() - hb <= 15000) {
        return parseInt(snap.docs[0].id, 10);
      }
    }
  } catch (e) { console.warn('recoverSession failed', e); }
  return 'spectator';
}


// 
// 画面リサイズ時に、ピクセル固定されたグリッドエリアのサイズを再計算する
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const scalableAreas = document.querySelectorAll('.auto-scale-area');
        if(scalableAreas.length === 0) return;
        
        // 1. 全て一旦固定幅を解除し、元のグリッドサイズに戻す
        scalableAreas.forEach(el => {
            el.style.width = '';
            el.style.height = '';
        });
        
        // 2. ブラウザに一度レイアウトを確定させ、全要素のベースサイズを取得
        const dimensions = Array.from(scalableAreas).map(el => {
            return { w: el.offsetWidth, h: el.offsetHeight };
        });
        
        // 3. 全要素に改めて倍率計算後の幅をセットする（Layout Thrashing防止のため一括で）
        scalableAreas.forEach((el, i) => {
            const mx = parseFloat(el.style.getPropertyValue('--area-mult-x')) || 1;
            const my = parseFloat(el.style.getPropertyValue('--area-mult-y')) || 1;
            if (mx !== 1) el.style.width = (dimensions[i].w * mx) + 'px';
            if (my !== 1) el.style.height = (dimensions[i].h * my) + 'px';
        });
    }, 100);
});


// ============================================
// Seat Selection & Spectator Logic
// ============================================

const sitSeatBtn = document.getElementById('sit-seat-btn');
const leaveSeatBtn = document.getElementById('leave-seat-btn');
const seatSelectModal = document.getElementById('seat-select-modal');
const seatSelectGrid = document.getElementById('seat-select-grid');
const seatSelectCancel = document.getElementById('seat-select-cancel');

if (sitSeatBtn) {
  sitSeatBtn.addEventListener('click', () => {
    if (!CURRENT_ROOM_META) return;
    const maxSeats = parseInt(CURRENT_ROOM_META.playerCount || 10, 10);
    seatSelectGrid.innerHTML = '';
    
    for (let i = 1; i <= maxSeats; i++) {
      const seatData = currentSeatMap[i];
      const hb = seatData && seatData.heartbeatAt && seatData.heartbeatAt.toMillis ? seatData.heartbeatAt.toMillis() : 0;
      const isMe = seatData && seatData.claimedByUid === CURRENT_UID;
      const isUsed = !!(seatData && seatData.claimedByUid && (Date.now() - hb) <= SEAT_STALE_MS && !isMe);
      
      const btn = document.createElement('button');
      btn.className = 'seat-btn';
      if (isMe) {
        btn.classList.add('is-me');
        btn.textContent = `SEAT${i} (戻る)`;
      } else if (isUsed) {
        btn.classList.add('active');
        btn.disabled = true;
        btn.textContent = `SEAT${i} (満席)`;
        btn.style.opacity = '0.5';
      } else {
        btn.textContent = `SEAT${i}`;
      }
      btn.dataset.seat = i;
      
      btn.addEventListener('click', async () => {
        if (isUsed) return;
        seatSelectModal.style.display = 'none';
        
        try { await showRoomInterstitial({ force: true, cooldownMs: 0 }); } catch (_) { }
        
        const ok = await claimSeat(CURRENT_ROOM, i);
        if (!ok) { alert(`SEAT${i} はいま埋まりました。別の座席を選んでください。`); return; }

        // 新しい席の確保に成功
        const oldSeat = Object.keys(currentSeatMap).find(s => 
          currentSeatMap[s]?.claimedByUid === CURRENT_UID && parseInt(s, 10) !== i
        );

        if (oldSeat) {
          try {
            await releaseSeat(db, CURRENT_ROOM, parseInt(oldSeat, 10), CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);
          } catch(e) { console.warn('Old seat cleanup failed', e); }
        }

        CURRENT_PLAYER = i;
        document.body.classList.remove('is-spectator');
        startHeartbeat(CURRENT_ROOM, i);
        subscribeHP(CURRENT_ROOM);
        renderHPPanel();
        updateSessionIndicator();
        updateEndRoomButtonVisibility();
        updateLeaveRoomButtonVisibility();
        applyOtherOpsUI();
        applyCardSizeUI();
        applyBoardSizeUI();
        
        // Host takes seat, we might want to update room doc if they are host
        const isHost = CURRENT_ROOM_META?.hostUid === CURRENT_UID;
        if (isHost) {
          try {
            await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { hostSeat: i, updatedAt: serverTimestamp() }, { merge: true });
          } catch(e) {}
        }
      });
      
      seatSelectGrid.appendChild(btn);
    }
    seatSelectModal.style.display = 'flex';
  });
}

if (seatSelectCancel) {
  seatSelectCancel.addEventListener('click', () => {
    seatSelectModal.style.display = 'none';
  });
}

if (leaveSeatBtn) {
  leaveSeatBtn.addEventListener('click', async () => {
    if (CURRENT_PLAYER === 'spectator') return;
    if (!confirm('座席から離れて観戦者に戻りますか？')) return;
    
    try { await showRoomInterstitial({ force: true, cooldownMs: 0 }); } catch (_) { }
    
    const oldSeat = CURRENT_PLAYER;
    CURRENT_PLAYER = 'spectator';
    document.body.classList.add('is-spectator');
    updateSessionIndicator();
    updateEndRoomButtonVisibility();
    updateLeaveRoomButtonVisibility();
    applyOtherOpsUI();
    applyCardSizeUI();
    applyBoardSizeUI();
    renderHPPanel();
    
    try { stopHeartbeat(); } catch (_) { }
    try {
      if (CURRENT_ROOM) {
         await releaseSeat(db, CURRENT_ROOM, oldSeat, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);
      }
    } catch(e) {}
    
    // If host leaves seat, update room doc
    const isHost = CURRENT_ROOM_META?.hostUid === CURRENT_UID;
    if (isHost && CURRENT_ROOM) {
      try {
        await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { hostSeat: null, updatedAt: serverTimestamp() }, { merge: true });
      } catch(e) {}
    }
    
  });
}
