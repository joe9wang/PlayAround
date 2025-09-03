
// ====================================================================
// PlayAround index.js (inlined) — Annotated Edition
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

  import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
  import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-check.js";

  import {
    getAuth, signInAnonymously, onAuthStateChanged,
   GoogleAuthProvider,
   signInWithPopup, linkWithPopup, signInWithCredential,
   signInWithRedirect, linkWithRedirect, getRedirectResult,
   signOut, updateProfile, onIdTokenChanged, getIdToken
   } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

  import {
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot,
    serverTimestamp, runTransaction, deleteDoc, collection, limit,
    addDoc, where, query, getDocs, writeBatch, Timestamp, orderBy 
  } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

  import {
    getStorage, ref, uploadString, uploadBytes, getDownloadURL
  } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
  
  
  
  
  
// ===============================
// Firebase 初期化と App Check
// ===============================
// Firebase SDK の読み込み、構成値、App Check の初期化を行います。
// ===== Firebase（★ここはプレースホルダ。デプロイ時に置換される）
  const firebaseConfig = {
//    apiKey: "__NEXT_PUBLIC_FIREBASE_API_KEY__",
//    authDomain: "__NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN__",
//    projectId: "__NEXT_PUBLIC_FIREBASE_PROJECT_ID__",
//    storageBucket: "__NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET__",
//    messagingSenderId: "__NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID__",
//    appId: "__NEXT_PUBLIC_FIREBASE_APP_ID__"
    apiKey: "AIzaSyCy-r6L1NgyHcqvsfpkyNPDJq9uMvv2CMM",
    authDomain: "cardgame-f484c.firebaseapp.com",
    projectId: "cardgame-f484c",
    storageBucket: "cardgame-f484c.firebasestorage.app",
    messagingSenderId: "248859224605",
    appId: "1:248859224605:web:1320093856bc1861c174f4"


  };
  const app = initializeApp(firebaseConfig);
  
  

  // App Check（reCAPTCHA v3）
  if (typeof window !== "undefined") {
    //const siteKey = "__NEXT_PUBLIC_APPCHECK_KEY__";
    const siteKey = "6LeClaQrAAAAADNTifrjqIOT9_blqXBv8bDkGIHC";

  if (siteKey && !siteKey.startsWith("__")) {
    try {
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      
      // 後で getToken に渡すために保持
      window.appCheck = appCheck;
      
      console.log('[AppCheck] initialized');
    } catch (e) {
      console.warn('[AppCheck] init failed; continuing without it', e);
    }
  }    
    
 }


console.log('apps:', getApps().length); // 1 以上ならOK
getToken(window.appCheck)
  .then(t => console.log('AppCheck token OK', !!t.token))
  .catch(e => console.error('AppCheck error', e));
    
    
// ===============================
// Auth / Firestore / Storage 句の初期化
// ===============================
// Auth/DB/Storage のインスタンスを作成し、以降の処理で参照します。
import { setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const auth = getAuth(app);
// ログイン状態をタブを越えて復元できるようにする
await setPersistence(auth, browserLocalPersistence);

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



 // === Close room API (sendBeacon or keepalive fetch) ===
 const BEACON_URL = '/api/close-room';
 async function sendCloseBeacon(roomId){
   if (!roomId) return;
   // IDトークンをボディに同梱（sendBeacon ではヘッダを付けられないため）
   const payload = JSON.stringify({
     roomId,
     idToken: AUTH_ID_TOKEN || null,
   });
   try {
     if (!navigator.sendBeacon) {
       // iOS/Safari 対策: fetch + keepalive
       await fetch(BEACON_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: payload,
         keepalive: true,
       });
     } else {
       const blob = new Blob([payload], { type: 'application/json' });
       navigator.sendBeacon(BEACON_URL, blob);
     }
   } catch (e) {
     console.warn('[beacon] failed', e);
   }
 }


    const db = getFirestore(app);
    
    
    
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
    
    
    
    
    // env から注入された storageBucket をそのまま使う
    const storageBucket = firebaseConfig.storageBucket;
    const storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app);
    
    

  // ▼ロビーのログインUI参照
  const loginBtn   = document.getElementById('login-google');
  const logoutBtn  = document.getElementById('logout-google');
  const mypageBtn  = document.getElementById('btn-mypage');
  const whoamiSpan = document.getElementById('whoami');

  // まだ匿名で遊べるままにする（既存のまま）


// ===============================
// DOM要素参照 (UI)
// ===============================
// 画面各所の要素を取得して保管します。
// ===== DOM refs
    const lobby = document.getElementById('lobby');
    const joinRoomInput = document.getElementById('join-room-id');
    const playerNameInput = document.getElementById('player-name');
    const endRoomBtn     = document.getElementById('end-room-btn');
    const seatButtons = Array.from(document.querySelectorAll('.seat-grid:not(#create-seat-grid) .seat-btn'));
    const startBtn = document.getElementById('start-btn');
    const sessionIndicator = document.getElementById('session-indicator');

    const newRoomIdInput = document.getElementById('new-room-id');
    const newPlayerNameInput = document.getElementById('new-player-name');
    const joinRoomPassInput = document.getElementById('join-room-pass');
    const newRoomPassInput  = document.getElementById('new-room-pass');
    const newPlayerColorInput = document.getElementById('new-player-color');
    const createRoomBtn = document.getElementById('create-room-btn');
    
    
    // Host-only toggle: 他プレイヤーのカード操作
    const hostOtherOpsWrap   = document.getElementById('host-otherops');
    const toggleOtherOpsInput= document.getElementById('toggle-other-ops');
    const toggleOtherOpsText = document.getElementById('toggle-other-ops-text');

    function applyOtherOpsUI(){
      const on = !!(CURRENT_ROOM_META?.allowOtherOps);
      if (toggleOtherOpsInput) toggleOtherOpsInput.checked = on;
      if (toggleOtherOpsText)  toggleOtherOpsText.textContent = on ? 'ON' : 'OFF';
    }

    toggleOtherOpsInput?.addEventListener('change', async () => {
      // ホストだけ変更可能（UIはホストにしか表示しないが二重ガード）
      const isHost = !!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID && CURRENT_ROOM_META?.hostSeat === CURRENT_PLAYER);
      if (!isHost) { applyOtherOpsUI(); return; }
      const val = !!toggleOtherOpsInput.checked;
      toggleOtherOpsText.textContent = val ? 'ON' : 'OFF';
      try{
        await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { allowOtherOps: val, updatedAt: serverTimestamp() }, { merge: true });
      }catch(e){ console.warn('toggle allowOtherOps failed', e); }
    });    
    
    
    const createSeatButtons = Array.from(document.querySelectorAll('#create-seat-grid .seat-btn'));
    
    
// ==== 追加: フィールドモード（'card' | 'board' | 'trump'） ====
let CREATE_FIELD_MODE = 'card';

const pickModeCardBtn   = document.getElementById('pick-mode-card');
const pickModeBoardBtn  = document.getElementById('pick-mode-board');
const pickModeTrumpBtn  = document.getElementById('pick-mode-trump');


function updateModePickButtons(){
  const set = (btn, on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
    btn.classList.toggle('secondary', !on);
  };
  set(pickModeCardBtn,  CREATE_FIELD_MODE === 'card');
  set(pickModeBoardBtn, CREATE_FIELD_MODE === 'board');
  if (pickModeTrumpBtn) set(pickModeTrumpBtn, CREATE_FIELD_MODE === 'trump'); //
}
pickModeCardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'card';  updateModePickButtons(); });
pickModeBoardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'board'; updateModePickButtons(); });
pickModeTrumpBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'trump'; updateModePickButtons(); });
updateModePickButtons();
    
    
 // ===== サイドバー折り畳み（左=操作パネル, 右=プレビュー） =====
 const toggleLeftBtn  = document.getElementById('toggle-left');
 const toggleRightBtn = document.getElementById('toggle-right');
 
 // localStorage に保持（リロードしても状態維持）
 const LS_COLLAPSE_LEFT  = 'pa:collapse-left';
 const LS_COLLAPSE_RIGHT = 'pa:collapse-right';
 
 function applyCollapseState(){
   const left  = localStorage.getItem(LS_COLLAPSE_LEFT)  === '1';
   const right = localStorage.getItem(LS_COLLAPSE_RIGHT) === '1';
   document.body.classList.toggle('collapse-left',  left);
   document.body.classList.toggle('collapse-right', right);
   // ボタンの矢印を状態に合わせる
   if (toggleLeftBtn)  toggleLeftBtn.textContent  = left  ? '▶' : '◀';
   if (toggleRightBtn) toggleRightBtn.textContent = right ? '◀' : '▶';
   // アクセシビリティ（ご参考）
   if (toggleLeftBtn)  toggleLeftBtn.setAttribute('aria-pressed',  left ? 'true' : 'false');
   if (toggleRightBtn) toggleRightBtn.setAttribute('aria-pressed', right ? 'true' : 'false');
 }
 
 // ===== 外付けハンドル（折り畳み時だけ見える） =====
 const edgeLeft  = document.getElementById('edge-left');
 const edgeRight = document.getElementById('edge-right');
 
 edgeLeft?.addEventListener('click',  () => {
   // 左サイド折り畳み中 → 展開
   localStorage.setItem(LS_COLLAPSE_LEFT, '0');
   applyCollapseState();
 });
 edgeRight?.addEventListener('click', () => {
   // 右サイド折り畳み中 → 展開
   localStorage.setItem(LS_COLLAPSE_RIGHT, '0');
   applyCollapseState();
 });
 
 function toggleLeft(){
   const left = !(localStorage.getItem(LS_COLLAPSE_LEFT) === '1');
   localStorage.setItem(LS_COLLAPSE_LEFT, left ? '1' : '0');
   applyCollapseState();
 }
 function toggleRight(){
   const right = !(localStorage.getItem(LS_COLLAPSE_RIGHT) === '1');
   localStorage.setItem(LS_COLLAPSE_RIGHT, right ? '1' : '0');
   applyCollapseState();
 }
 
 toggleLeftBtn?.addEventListener('click',  toggleLeft);
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
    let CREATE_SELECTED_SEAT = 1;
    createSeatButtons.forEach(b => b.classList.toggle('active', parseInt(b.dataset.createSeat, 10) === 1));
    const picked = document.getElementById('create-seat-picked');
    if (picked) picked.textContent = `P${CREATE_SELECTED_SEAT}`;

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
  function slDocPath(slot){
    return `users/${CURRENT_UID}/saves/slot${slot}`;
  }

  async function fetchMyCardsFromFirestore(){
    // 自分のカードだけをDBから取得（正のソース）
    const base = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    const q = query(base, where('ownerSeat', '==', CURRENT_PLAYER));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function stripSavableFields(src){
    // 保存対象フィールドを限定
    const fields = [
      'type','count','tokenText',
      'x','y','zIndex','faceUp','rotation',
      'visibleToAll','imageUrl','fullUrl'
    ];
    const out = {};
    for (const k of fields){
      if (src[k] !== undefined) out[k] = src[k];
    }
    return out;
  }

  async function saveToSlot(slot){
    
    console.log("UID check", CURRENT_UID, getAuth().currentUser?.uid);
    
    await ensureAuthReady();
    if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID){
      alert('ルームに参加してから実行してください'); return;
    }
    try{
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
      for (const d of oldSnap.docs){
        batch.delete(d.ref); if(++n >= 450){ await batch.commit(); batch = writeBatch(db); n=0; }
      }
      if (n>0) await batch.commit();

      batch = writeBatch(db); n = 0;
      for (const c of cards){
        const refDoc = doc(cardsCol); // 新規ID
        batch.set(refDoc, stripSavableFields(c));
        if(++n >= 450){ await batch.commit(); batch = writeBatch(db); n=0; }
      }
      if (n>0) await batch.commit();
      alert(`SLOT ${slot} に ${cards.length} 枚保存しました。`);
      // ★セーブ完了ログ
      postLog(`SLOT ${slot} に ${cards.length} 枚保存しました`);      
    }catch(e){
      console.error('SAVE ERROR', e?.code, e?.message, e);
      alert(`セーブに失敗しました（${e?.code||'unknown'}）。コンソールの詳細を確認してください。`);
    }
  }

  function tinyOffset(i){ return (i % 7) * 6; } // 重なり回避の微小ズレ

  async function loadFromSlot(slot){
    if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID){
      alert('ルームに参加してから実行してください'); return;
    }
    try{
      const cardsCol = collection(db, `${slDocPath(slot)}/cards`);
      const snap = await getDocs(cardsCol);
      if (snap.empty){ alert(`SLOT ${slot} は空です。`); return; }

      // 現在ルームに生成（追加）。所有者は現在の自分。
      const baseCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);
      let batch = writeBatch(db), n = 0, i = 0;
      const z0 = Date.now() % 10000;
      
    //▼この座席のデッキ中央を基準にする（少しずつズラして重なり回避）
    const basePos = centerOfDeck(CURRENT_PLAYER, CARD_W, CARD_H);
      
      for (const d of snap.docs){
        const s = d.data() || {};
        const payload = {
          //▼保存時の x,y は使わず「デッキ中央」にまとめて出す
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
      // ★ロード完了ログ
      postLog(`SLOT ${slot} から ${snap.size} 枚ロードしました`);
    }catch(e){
      console.error(e);
      alert('ロードに失敗しました。通信状況をご確認ください。');
    }
  }

  // ==== 3スロット選択モーダル制御 ====
  let SL_MODE = null; // 'save' | 'load'
  function openSaveLoadDialog(mode){
    SL_MODE = mode;
    const modal = document.getElementById('save-load-modal');
    const title = document.getElementById('sl-title');
    if (!modal || !title) return;
    title.textContent = (mode==='save') ? '保存先スロットを選択' : 'ロード元スロットを選択';
    
    //▼ロード時にプレビューを更新（非同期）
    if (mode === 'load') updateSlotPreviews();
    
    modal.style.display = 'flex';
  }
  // HTMLのonclickから呼べるように window に公開
  window.openSaveLoadDialog = openSaveLoadDialog;

  // 起動時にイベントを束ねる
  (function bindSLModal(){
    const modal = document.getElementById('save-load-modal');
    if (!modal) return;
    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
    // キャンセル
    document.getElementById('sl-cancel')?.addEventListener('click', ()=>{
      modal.style.display = 'none';
    });
    // スロット選択
    modal.querySelectorAll('.slot-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const slot = parseInt(btn.dataset.slot,10);
        modal.style.display = 'none';
        if (SL_MODE==='save')      await saveToSlot(slot);
        else if (SL_MODE==='load') await loadFromSlot(slot);
      });
    });
  })();    
    

// ▼ 追加：スロットのプレビューを描画（各最大5枚）
async function updateSlotPreviews(){
  try{
    await ensureAuthReady();
    const wrap = document.querySelector('#save-load-modal .sl-preview');
    if (!wrap) return;
    const boxes = Array.from(wrap.querySelectorAll('.slot-preview'));
    for (const box of boxes){
      const slot = parseInt(box.dataset.slot, 10);
      box.innerHTML = '<span class="empty">読み込み中…</span>';
      try{
        // users/{UID}/saves/slot{n}/cards から最大5件
        const cardsRef = collection(db, `${slDocPath(slot)}/cards`);
        const snap = await getDocs(query(cardsRef, limit(5)));
        box.innerHTML = '';
        if (snap.empty){
          box.innerHTML = '<span class="empty">空き</span>';
          continue;
        }
        for (const d of snap.docs){
          const s = d.data() || {};
          // 保存されているURLは fullUrl を優先、なければ Storage 経由で解決
          let url = s.fullUrl;
          if (!url && s.imageUrl) url = await storageDownloadURL(s.imageUrl);
          if (!url) continue;
          const img = document.createElement('img');
          img.src = url;
          img.alt = '';
          box.appendChild(img);
        }
        if (!box.querySelector('img')) {
          // 画像系が1枚も生成されなかった場合のフォールバック
          box.innerHTML = '<span class="empty">画像なし</span>';
        }
      }catch(e){
        console.warn('preview fetch failed', e);
        box.innerHTML = '<span class="empty">取得失敗</span>';
      }
    }
  }catch(e){
    console.warn('updateSlotPreviews error', e);
  }
}    
    
    
    let hostWatchTimer = null;

    let ACTIVE_MODE = 'join'; // 'join' | 'create'
    let IS_ROOM_CREATOR = false;

    // ===== Quota care: intervals
    const HOST_STALE_MS = 180000;  // 3min
    const SEAT_STALE_MS = 600000;  // 10min
    const HOST_HEARTBEAT_MS = 60000; // 10s
    const SEAT_HEARTBEAT_MS = 60000; // 20s
    const ROOM_PING_MS = 60000;      // 60s
    let __roomPingAt = 0;
    

    // ===== Room idle auto-delete (no one seated for a while)
    // 全席が空席 or STALE の状態が一定時間続いたらルーム削除
    const ROOM_IDLE_DELETE_MS = 3 * 60 * 1000; // 3分（必要に応じて調整）
    const ROOM_IDLE_CHECK_MS  = 15 * 1000;     // 15秒ごとに判定
    let roomIdleTimer = null;
    let lastOccupiedAt = Date.now();
    
    const CARD_W = 120;
    const CARD_H = 160;
    
    // ===== Write queue (batching & coalescing)
    const WRITE_FLUSH_MS = 400;     // まとめ書き周期
    const MAX_BATCH_OPS = 450;      // Firestoreの上限に合わせる
    const pendingPatches = new Map(); // key: path "rooms/{room}/cards/{id}" or seats, value: merged patch
    let flushTimer = null;
    
    
// === アクティビティ検知（操作がある時だけ頻繁にHB） ===
const ACTIVE_WINDOW_MS    = 30_000;  // 直近30秒に操作があれば“活動中”
const IDLE_KEEPALIVE_MS   = 300_000; // 完全放置でも5分に1回はHB
let   lastActivityAt      = Date.now();
let   lastSeatHBWriteAt   = 0;

['pointerdown','pointermove','wheel','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, () => { lastActivityAt = Date.now(); }, { passive:true });
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

function pathFor(roomId, sub, id){ return `rooms/${roomId}/${sub}/${id}`; }

    function queueUpdate(path, patch){
      // serverTimestampはここで付けない：無駄な書き込み増を防ぐ
      const prev = pendingPatches.get(path) || {};
      pendingPatches.set(path, { ...prev, ...patch });
      if (!flushTimer) flushTimer = setTimeout(flushWrites, WRITE_FLUSH_MS);
    }

    async function flushWrites(){
      flushTimer = null;
      if (pendingPatches.size === 0) return;
      // 複数バッチに分割
      const entries = Array.from(pendingPatches.entries());
      pendingPatches.clear();
      for (let i=0; i<entries.length; i += MAX_BATCH_OPS){
        const batch = writeBatch(db);
        const slice = entries.slice(i, i+MAX_BATCH_OPS);
        for (const [path, patch] of slice){
          batch.update(doc(db, path), patch);
        }
        try{ await batch.commit(); }catch(e){ console.warn('batch commit failed', e); }
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
    return await getDownloadURL(ref(storage, path));
  } catch (e) {
    console.warn('[Storage] getDownloadURL failed:', path, e.code || e.message);
    return null;
  }
}


    
    
    // === Helper: 他人の手札内かどうか（プレビュー用マスク判定） ===
    function isOtherPlayersHandCard(el){
      try{
        if (!el) return false;
        const viewerSeat = CURRENT_PLAYER;
        const left = parseFloat(el.style.left) || 0;
        const top  = parseFloat(el.style.top)  || 0;
        for (const s of [1,2,3,4]) {
          const hb = getHandBoundsForSeat(s);
          if (hb && isCenterInsideRect(left, top, hb)) {
            return String(s) !== String(viewerSeat);
          }
        }
      }catch(_){}
      return false;
    }
    
    
    
    
    async function sha256Hex(str){
      const data = new TextEncoder().encode(str);
      const buf  = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    
    
    function updateCardBatched(cardId, patch){
      if(!CURRENT_ROOM) return;
      queueUpdate(pathFor(CURRENT_ROOM, 'cards', cardId), patch);
    }
    function updateSeatBatched(seat, patch){
      if(!CURRENT_ROOM) return;
      queueUpdate(pathFor(CURRENT_ROOM, 'seats', seat), patch);
    }

    // ===== Presence / host alive
    
    const ROOM_EMPTY_GRACE_MS = 15 * 60 * 1000; // 15分: 全席不在が続いたら部屋を自動削除
    
    function isHostAlive(roomMeta){
      if(!roomMeta?.hostUid) return false;
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
      for (const s of [1,2,3,4]) {
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
    if (user.isAnonymous) {
      loginBtn  && (loginBtn.style.display  = '');
      logoutBtn && (logoutBtn.style.display = 'none');
      mypageBtn && (mypageBtn.style.display = 'none');   // 匿名時は隠す
      if (whoamiSpan) { whoamiSpan.style.display = 'none'; whoamiSpan.textContent = ''; }
      
      // マイページ表示用の情報はクリア
      localStorage.removeItem('pa:googleUid');
      localStorage.removeItem('pa:displayName');
      localStorage.removeItem('pa:photoURL');
      
    } else {
      loginBtn  && (loginBtn.style.display  = 'none');
      logoutBtn && (logoutBtn.style.display = '');       // 既定表示に戻す
      mypageBtn && (mypageBtn.style.display = '');       // ログイン後に表示
      if (whoamiSpan) {
        whoamiSpan.style.display = '';
        whoamiSpan.textContent = `ログイン中：${user.email || user.displayName || 'No Name'}`;
      }
      
      // ▼GoogleのIDなどを保存（マイページで使う）
      const provider = (user.providerData || []).find(p => p.providerId === 'google.com');
      localStorage.setItem('pa:email',       user.email || '');
      localStorage.setItem('pa:displayName', user.displayName || '');
      localStorage.setItem('pa:photoURL',    user.photoURL   || '');
      
    }
  });  
  
  
  // ===== i18n: dictionary & applier =====
const I18N = {
  ja: {
    "app.title": "画像で遊べるボドゲ・カードゲーム（最大4人）",
    
    "links.privacy": "プライバシーポリシー",
    "links.terms":   "利用規約",
    "links.contact": "お問い合わせ",
    
    "lobby.welcome": "プレイアラウンドへようこそ！",
    "auth.login":  "Googleでログイン",
    "auth.logout": "ログアウト",
    "app.mypage" : "マイページ",
    
    "join.section":   "既存ルームに参加（非ホスト）",
    "join.roomId":    "参加するルームID",
    "join.roomId.ph": "例: room-abc / 1234",
    "join.password":  "入室パスワード",
    "join.password.ph":"ホストが設定した場合は必須",
    "join.name":      "プレイヤー名",
    "join.name.ph":   "名前（例: SOLVENTER）",
    "join.chooseSeat":"座席を選択",
    "join.start":     "開始",
    
    "create.section":   "新しいルームを作成して参加（ホスト）",
    "create.roomId":    "新しいルームを作成",
    "create.roomId.ph": "例: room-abc / 1234",
    "create.password":  "入室パスワード（任意）",
    "create.password.ph":"設定すると参加時に必須",
    "create.name":      "プレイヤー名",
    "create.name.ph":   "名前（例: SOLVENTER）",
    "create.chooseSeat":"座席を選択",
    "create.chooseMode":"フィールド構成を選択",
    "create.mode.card": "🃏 カードゲーム",
    "create.mode.board":"🎲 ボードゲーム",
    "create.mode.trump": "🂠 トランプ",
    "create.createBtn": "作成",
    
    // --- Side / Panel / Buttons ---
    "side.panel": "操作パネル",
    "side.panel.toggle": "操作パネルの表示/非表示",
    "side.save": "💾 セーブ",
    "side.load": "📂 ロード",
    "side.resetFacing": "↻ 全カード向きリセット",
    "side.faceDown": "🂠 全て裏に",
    "side.faceUp": "🂡 全て表に",
    "side.flipCoin": "🪙 コイントス",
    "side.rollD6": "🎲 6面ダイス",
    "side.rollD10": "🎲 10面ダイス",
    "side.rollD20": "🎲 20面ダイス",
    "side.shuffle": "⇅ デッキをシャッフル",
    "side.collect": "❖ 全カードを集める",
    "side.allMyCards": "🔍 全カード一覧",
    "side.deckList": "🔍 デッキ一覧",
    "side.discardList": "🔍 捨て札一覧",
    "side.deleteMine": "🗑 全カードを削除",
    "side.deleteSelected": "🗑 指定カードを削除",
    "side.sendSelectedBack": "⇊ 指定カードを最背面",
    "side.numCounter": "🔢 数値カウンター",
    "side.plus1": "➕1",
    "side.plus10": "➕10",
    "side.plus50": "➕50",
    "side.plus100": "➕100",
    "side.minus1": "➖1",
    "side.minus10": "➖10",
    "side.minus50": "➖50",
    "side.minus100": "➖100",
    "side.token": "📝 トークン作成",
    "side.BackImage": "🖼 カード背景画像",
    "side.fieldSize": "フィールドサイズ変更",
    "side.sizeS": "小",
    "side.sizeM": "中",
    "side.sizeL": "大",
    
    // --- Zones ---
    "zone.special": "特殊エリア",
    "zone.play": "プレイエリア",
    "zone.discard": "捨て札エリア",
    "zone.deck": "デッキエリア",
    "zone.hand": "手札エリア",
    "zone.play.shared": "プレイエリア（共有）",
    "zone.deck.shared": "デッキエリア（共有）",
    "zone.discard.shared": "捨て札エリア（共有）",
    
    // --- Preview / Misc ---
    "preview.title": "選択肢のカード",
    "preview.toggle": "選択肢のカードの表示/非表示",
    "hp.title": "プレイヤーHP",
    
    
    // alerts
    "err.roomId":    "ルームIDを入力してください",
    "err.playerName":"プレイヤー名を入力してください",
    "err.seat":      "座席を選んでください",
    "err.passWrong": "パスワードが違います。",
    "err.hostAbsent":"ホストが不在のため、このルームには参加できません。",
    
    "auth.loggedIn": "ログインしました。",
    "auth.loggedOut":"ログアウトしました。",
    "auth.logoutFail":"ログアウトに失敗しました。"
    
    
  },
  en: {
    "app.title": "Play board/card games with images (up to 4)",
    
    "links.privacy": "Privacy Policy",
    "links.terms":   "Terms",
    "links.contact": "Contact",
    
    "lobby.welcome": "Welcome to PlayAround!",
    
    "auth.login":  "Sign in with Google",
    "auth.logout": "Sign out",
    "app.mypage" : "My Page",
    
    "join.section":   "Join an existing room (Guest)",
    "join.roomId":    "Room ID to join",
    "join.roomId.ph": "e.g., room-abc / 1234",
    "join.password":  "Join password",
    "join.password.ph":"Required if host set one",
    "join.name":      "Player name",
    "join.name.ph":   "Name (e.g., SOLVENTER)",
    "join.chooseSeat":"Choose your seat",
    "join.start":     "Start",
    
    "create.section":   "Create a new room (Host)",
    "create.roomId":    "Create a new room",
    "create.roomId.ph": "e.g., room-abc / 1234",
    "create.password":  "Join password (optional)",
    "create.password.ph":"If set, guests must enter it",
    "create.name":      "Player name",
    "create.name.ph":   "Name (e.g., SOLVENTER)",
    "create.chooseSeat":"Choose your seat",
    "create.chooseMode":"Choose field layout",
    "create.mode.card": "🃏 Card game",
    "create.mode.board":"🎲 Board game",
    "create.mode.trump": "🂠 Playing cards",
    "create.createBtn": "Create",
    
    // --- Side / Panel / Buttons ---
    "side.panel": "Control Panel",
    "side.panel.toggle": "Show/Hide control panel",
    "side.save": "💾 Save",
    "side.load": "📂 Load",
    "side.resetFacing": "↻ Reset card orientation",
    "side.faceDown": "🂠 Face-down",
    "side.faceUp": "🂡 Face-up",
    "side.flipCoin": "🪙 flip a coin",
    "side.rollD6": "🎲 Roll a d6",
    "side.rollD10": "🎲 Roll a d10",
    "side.rollD20": "🎲 Roll a d20",
    "side.shuffle": "⇅ Shuffle my Deck",
    "side.collect": "❖ Gather my cards",
    "side.allMyCards": "🔍 All my cards",
    "side.deckList": "🔍 My deck-area cards",
    "side.discardList": "🔍 My discard-area cards",
    "side.deleteMine": "🗑 Delete all my cards",
    "side.deleteSelected": "🗑 Delete selected card",
    "side.sendSelectedBack": "⇊ Send selected card to back",
    "side.numCounter": "Number counter",
    "side.plus1": "➕1 counter",
    "side.plus10": "➕10 counter",
    "side.plus50": "➕50 counter",
    "side.plus100": "➕100 counter",
    "side.minus1": "➖1 counter",
    "side.minus10": "➖10 counter",
    "side.minus50": "➖50 counter",
    "side.minus100": "➖100 counter",
    "side.token": "Create token",
    "side.BackImage": "Back Image",
    "side.fieldSize": "Change field size",
    "side.sizeS": "Small",
    "side.sizeM": "Medium",
    "side.sizeL": "Large",
    
    // --- Zones ---
    "zone.special": "Special",
    "zone.play": "Play area",
    "zone.discard": "Discard",
    "zone.deck": "Deck",
    "zone.hand": "Hand",
    "zone.play.shared": "Shared play area",
    "zone.deck.shared": "Shared deck area",
    "zone.discard.shared": "Shared discard area",
    
    // --- Preview / Misc ---
    "preview.title": "Candidate cards",
    "preview.toggle": "Show/Hide candidate cards",
    "hp.title": "Players' HP",
    
    // alerts
    "err.roomId":    "Please enter a Room ID.",
    "err.playerName":"Please enter your player name.",
    "err.seat":      "Please select a seat.",
    "err.passWrong": "Wrong password.",
    "err.hostAbsent":"The host is not available, so you can't join this room.",
    
    "auth.loggedIn": "Signed in.",
    "auth.loggedOut":"Signed out.",
    "auth.logoutFail":"Failed to sign out."
  }
};

 // 地域ベースのデフォルト：日本(Asia/Tokyo)ならja、それ以外はen
 function defaultLangByRegion(){
   try {
     const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
     if (tz === 'Asia/Tokyo') return 'ja';
   } catch(_) {}
   return 'en';
 }
 let LANG = (localStorage.getItem('lang') || '').toLowerCase();
 if (!['ja','en'].includes(LANG)) LANG = defaultLangByRegion();
 document.documentElement.lang = LANG;

 function t(key){
  return (I18N[LANG] && I18N[LANG][key]) || I18N.ja[key] || key;
}
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

 // 初期反映＆セレクター同期（ヘッダー＋ロビー）
 const langSelHeader = document.getElementById('lang-switch');         // 既存（ヘッダー右）
 const langSelLobby  = document.getElementById('lang-switch-lobby');   // 新規（ロビー右上）
 function syncLangUI(){
   if (langSelHeader) langSelHeader.value = LANG;
   if (langSelLobby)  langSelLobby.value  = LANG;
 }
 [langSelHeader, langSelLobby].forEach(sel => {
   sel && sel.addEventListener('change', () => {
     LANG = sel.value;
     localStorage.setItem('lang', LANG);
     document.documentElement.lang = LANG;
     applyI18n();
     syncLangUI();
   });
 });
 syncLangUI();
 applyI18n();  
  
  
  
  
  // Googleプロバイダ
  const google = new GoogleAuthProvider();

  // 匿名→Googleへ“昇格” or 通常ログイン
  // まず Popup を試し、代表的な失敗は Redirect にフォールバック
  loginBtn?.addEventListener('click', async () => {
    const tryRedirect = async () => {
      const u = auth.currentUser;
      if (u && u.isAnonymous) {
        await linkWithRedirect(u, google);
      } else {
        await signInWithRedirect(auth, google);
      }
    };
    try {
      loginBtn.disabled = true;
      const u = auth.currentUser;
      if (u && u.isAnonymous) {
        await linkWithPopup(u, google);
      } else {
        await signInWithPopup(auth, google);
      }
      // displayName 未設定ならフォームの名前を反映（任意）
      const cu = auth.currentUser;
      const name = (newPlayerNameInput?.value || playerNameInput?.value || '').trim();
      if (cu && !cu.displayName && name) await updateProfile(cu, { displayName: name });
      alert('ログインしました。');
    } catch (e) {
    
    console.warn('[PopupSignIn] failed', e);
    const code = e?.code || '';

    // すでに別ユーザーにリンク済み → その既存ユーザーでサインインに切り替え
    if (code === 'auth/credential-already-in-use') {
      const cred = GoogleAuthProvider.credentialFromError(e);
      if (cred) {
        await signInWithCredential(auth, cred);  // 既存Googleアカウントでログイン
        alert('既存のGoogleアカウントでログインしました。');
        return;
      }
    }
      
      const popupErrors = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-allowed',   // まれにポリシーで弾かれる
      ];
      if (popupErrors.includes(code)) {
        try { await tryRedirect(); return; } catch (e2) { console.warn('[Redirect fallback] failed', e2); }
      }
      alert(`ログインに失敗しました（${e?.code || 'unknown'}）。別ブラウザ/ポップアップ許可をお試しください。`);
    } finally {
      loginBtn.disabled = false;
    }
  });


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
  
  
  
  

    // UI switching
    joinRoomInput.addEventListener('input', () => {
      ACTIVE_MODE = 'join';
      validateLobby();
      const v = (joinRoomInput.value || '').trim();
      if (!v) {
        // 入力が空になったら、クリアボタン相当の処理を自動実行
        CURRENT_PLAYER = null;
        detachSeatsListener();                 // 座席購読を停止
        if (unsubscribeRoomDoc) {              // ルームdoc購読も停止
          unsubscribeRoomDoc();
          unsubscribeRoomDoc = null;
        }
        CURRENT_ROOM_META = null;
        renderSeatAvailability();
        renderFieldLabels();
        updateEndRoomButtonVisibility();
        renderHPPanel();
      }
    });    
    
    
    // パスワードの再入力でエラー装飾を解除
joinRoomPassInput?.addEventListener('input', () => {
  if (joinRoomPassInput.classList.contains('is-error')) {
    joinRoomPassInput.classList.remove('is-error');
    joinRoomPassInput.removeAttribute('aria-invalid');
  }
});
    
    
    
    
    
    playerNameInput.addEventListener('input', () => { ACTIVE_MODE = 'join'; validateLobby(); });
    seatButtons.forEach(btn => btn.addEventListener('click', () => { ACTIVE_MODE = 'join'; validateLobby(); }));

    newRoomIdInput.addEventListener('input', () => { ACTIVE_MODE = 'create'; validateLobby(); });
    newPlayerNameInput.addEventListener('input', () => { ACTIVE_MODE = 'create'; validateLobby(); });
    createSeatButtons.forEach(btn => btn.addEventListener('click', () => { ACTIVE_MODE = 'create'; validateLobby(); }));

    function isCenterInsideRect(x, y, rect){
      const cx = x + CARD_W / 2;
      const cy = y + CARD_H / 2;
      return cx >= rect.minX && cx <= rect.minX + rect.width && cy >= rect.minY && cy <= rect.minY + rect.height;
    }
    
    
    
    
    
    
function isBoardMode(){
  const m = CURRENT_ROOM_META?.fieldMode;
  // 'board' と 'trump' をボード系モードとして扱う
  return (m === 'board' || m === 'trump');
}

function rectFromEl(el){
  if(!el) return null;
  const fieldRect = field.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const minX = (r.left - fieldRect.left) / zoom;
  const minY = (r.top  - fieldRect.top ) / zoom;
  const width  = r.width  / zoom;
  const height = r.height / zoom;
  return { minX, minY, width, height };
}


 // === レイアウト安定待ち（中央デッキの矩形が正しく測れるまで待つ） ===
 async function waitForBoardDeckRect(maxWaitMs = 1000){
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
function isMyCard(cardEl){ return cardEl?.dataset?.ownerSeat === String(CURRENT_PLAYER); }
function allowOperateOthers(){ return !!(CURRENT_ROOM_META?.allowOtherOps); }
// kind: 'move' | 'flip' | 'delete' | 'rotate'
function canOperateCard(cardEl, kind){
  if (isMyCard(cardEl)) return true;
  if (allowOperateOthers()){
    // 共有ONでも破壊的操作は不可のまま（必要なら広げられます）
    if (kind === 'delete' || kind === 'rotate') return false;
    return true; // move / flip を許可
  }
  return false;
}





function getHandBoundsForSeat(seat){
  if (isBoardMode()) {
    const el = document.getElementById(`board-hand-${seat}`);
    return rectFromEl(el);
  } else {
    const hand = document.querySelector(`.player-${seat} .hand-area`);
    return rectFromEl(hand);
  }
}

function getDeckBoundsForSeat(seat){
  // board と trump のときは「中央の共有デッキ（#board-center .center-deck）」を使う
  const mode = CURRENT_ROOM_META?.fieldMode;
  if (mode === 'board' || mode === 'trump') {
    const el = document.querySelector('#board-center .center-deck');
    return rectFromEl(el);
  }
  // それ以外（通常のカードモード）は各プレイヤーのデッキエリア
  const deck = document.querySelector(`.player-${seat} .deck-area`);
  return rectFromEl(deck);
}


function getDiscardBoundsForSeat(seat){
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


function getMainPlayBoundsForSeat(seat){
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
    previewImg.src = src;
    previewImg.style.display = 'block';
  } else {
    previewImg.removeAttribute('src');   // ← これで “undefined:1” リクエストが出ない
    previewImg.style.display = 'none';
  }
}
    
    

// 座席のメインプレイ中央（w,h 指定版）
// 座席のプレイエリア中央座標を（幅/高さを考慮して）求める
// @param {number} seat - 座席(1..4)
// @param {number} w - 要素幅
// @param {number} h - 要素高
// @returns {object} {x:number,y:number}
//

function centerOfMainPlay(seat, w, h){
  const b = getMainPlayBoundsForSeat(seat);
  if(!b) return { x: 0, y: 0 };
  const x = Math.round(b.minX + (b.width  - w)/2);
  const y = Math.round(b.minY + (b.height - h)/2);
  return { x, y };
}



    function getCardsInsideRect(rect){
      const cards = [];
      document.querySelectorAll('.card').forEach(el => {
        const id = el.dataset.cardId;
        const left = parseFloat(el.style.left) || 0;
        const top  = parseFloat(el.style.top)  || 0;
        const cx = left + CARD_W/2;
        const cy = top  + CARD_H/2;
        if(cx >= rect.minX && cx <= rect.minX + rect.width && cy >= rect.minY && cy <= rect.minY + rect.height){
          cards.push({ id, el });
        }
      });
      return cards;
    }
    function shuffleArray(arr){
      for(let i=arr.length-1;i>0;i--){
        const j = (Math.random()* (i+1))|0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    function randomPointInDeck(seat){
      const b = getDeckBoundsForSeat(seat);
      if(!b) return { x: Math.random()*500|0, y: Math.random()*500|0 };
      const maxX = Math.max(b.minX, b.minX + b.width  - CARD_W);
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
    const meta   = CURRENT_ROOM_META;
    const roomId = (CURRENT_ROOM || (joinRoomInput?.value||'').trim() || null);

    // 既存: セッション中のゲストを安全に退室させる（ロビーでもwatchは回しつつ、kickはセッション中のみ）
    if (CURRENT_ROOM) {
      const iAmHost  = !!(meta?.hostUid && CURRENT_UID && meta.hostUid === CURRENT_UID);
      const closed   = !!meta?.roomClosed;
      const hostHere = isHostAlive(meta);
      if (!iAmHost && (closed || !hostHere)) {
        try { if (CURRENT_ROOM && CURRENT_PLAYER) releaseSeat(CURRENT_ROOM, CURRENT_PLAYER); } catch(_) {}
        if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; }
        if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; }
        if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; }
        CURRENT_ROOM = null;
        CURRENT_PLAYER = null;
        stopHostWatch();
        sessionIndicator.textContent = 'ROOM: - / PLAYER: -';
        lobby.style.display = 'flex';
        alert('ホストが退室したため、このルームは終了しました。');
        return;
      }
    }

    // 追加: 全席不在が続いていたら部屋を自動削除（ロビー表示中でも動く）
    if (roomId) {
      const empty      = isRoomEmpty(); // 既存の空室判定
      const lastPingMs = meta?.lastSeatPing?.toMillis?.() ?? 0;
      const idleMs     = lastPingMs ? (Date.now() - lastPingMs) : Number.POSITIVE_INFINITY;
      if (empty && idleMs > ROOM_EMPTY_GRACE_MS) {
        try { await cleanupAndDeleteRoom(roomId); }
        catch (e) { console.warn('auto delete failed', e?.code||e); }
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

function svgDiceDataUrl(n){
  const size = 72, r = 8, pipR = 6;
  const pip = (cx, cy)=>`<circle cx="${cx}" cy="${cy}" r="${pipR}" fill="#111"/>`;
  const g = [size*0.22, size*0.5, size*0.78];
  const patterns = {
    1: [[1,1]],
    2: [[0,0],[2,2]],
    3: [[0,0],[1,1],[2,2]],
    4: [[0,0],[0,2],[2,0],[2,2]],
    5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
    6: [[0,0],[1,0],[2,0],[0,2],[1,2],[2,2]],
  };
  const pips = (patterns[n]||[]).map(([i,j]) => pip(g[i], g[j])).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect x="1" y="1" width="${size-2}" height="${size-2}" rx="${r}" ry="${r}" fill="#fff" stroke="#111" stroke-width="2"/>
      ${pips}
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}




//
// プレイエリア内のランダム座標（左上）を返す
// @param {number} seat - number
// @returns {object} {x,y}
//

function randomPointInMainPlay(seat){
  const b = getMainPlayBoundsForSeat(seat);
  if(!b) return { x: Math.random()*500|0, y: Math.random()*500|0 };
  const maxX = Math.max(b.minX, b.minX + b.width  - CARD_W);
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

 async function ensureAuthReady(timeoutMs = 8000){
   // すでに確定していれば即帰る
   const uNow = auth.currentUser;
   if (uNow && CURRENT_UID !== uNow.uid) CURRENT_UID = uNow.uid;
   if (CURRENT_UID) return;

   // ユーザーが居なければ匿名サインインを強制（モバイルSafari等の遅延対策）
   if (!auth.currentUser) {
     try { await signInAnonymously(auth); } catch (_) {}
   }

   // onAuthStateChanged で UID が来るのを待つ（タイムアウト付き）
   await new Promise((resolve, reject) => {
     const off = onAuthStateChanged(auth, (u) => {
       if (u) { CURRENT_UID = u.uid; off(); resolve(); }
     });
     setTimeout(() => { try{off();}catch{}; reject(new Error('auth-timeout')); }, timeoutMs);
   });
 }
    // ===== create room (host)
    createRoomBtn.addEventListener('click', async () => {
      await ensureAuthReady();
      const id = (newRoomIdInput.value||'').trim();
      const creatorName  = (newPlayerNameInput.value || '').trim();
      if(!id){ alert(t('err.roomId')); return; }
      if(!creatorName){ alert(t('err.playerName')); newPlayerNameInput.focus(); return; }
      if(!CREATE_SELECTED_SEAT){ alert(t('err.seat')); return; }

      createRoomBtn.disabled = true;
      const oldText = createRoomBtn.textContent;
      createRoomBtn.textContent = '作成中…';

      try{
        
        // 直前の確定 UID（CURRENT_UID が古い可能性に備え、auth.currentUser を使用）
        let uid = auth.currentUser?.uid;
        if (!uid) {
          alert('認証が完了していません。もう一度お試しください。');
          return;
        }
        
       // 直前の確定 UID（CURRENT_UID が古い可能性に備え、auth.currentUser を使用）
       uid = auth.currentUser?.uid;            // 再代入だけにする
       if (!uid) {
         // 念のため匿名サインイン→再wait→再取得（ワンショット・リトライ）
         try { await signInAnonymously(auth); } catch (_) {}
         try { await ensureAuthReady(6000); } catch (_) {}
         uid = auth.currentUser?.uid;
       }
       if (!uid) {
         alert(t('err.playerName') /* 適当な既存文言でOK */ + '\n(Please try login again)');
         return;
       }        
        
        // ▼追加：パスワード読み＆ハッシュ化
        const passRaw = (newRoomPassInput?.value || '').trim();
        const joinPassHash = passRaw ? await sha256Hex(passRaw) : null;
        
        
        // 既存の同名ルームが他人の所有でも、
        // 「誰も座っていない（生きていない）※」なら作成を許可する。
        // ※ SEAT_STALE_MS を超えた seat は死んでいる扱い（既存の isSeatStale と同義）
        const roomRef = doc(db, `rooms/${id}`);
        const existsSnap = await getDoc(roomRef);
        if (existsSnap.exists() && existsSnap.data()?.hostUid && existsSnap.data().hostUid !== uid) {
          // 座席4つを並列取得して“生存者がいるか”を判定
          const seatDocs = await Promise.all([1,2,3,4].map(n => getDoc(doc(db, `rooms/${id}/seats/${n}`))));
          const someoneAlive = seatDocs.some(s => {
            if (!s.exists()) return false;
            const d = s.data() || {};
            const hb = d.heartbeatAt?.toMillis ? d.heartbeatAt.toMillis() : 0;
            const alive = !!d.claimedByUid && (Date.now() - hb) <= SEAT_STALE_MS;
            return alive;
          });
          if (someoneAlive) {
            alert('このルームIDは他のホストが使用中です。別のIDにしてください。');
            return;
          }
          // ▼ 誰も座っていない → サーバAPIで「乗っ取り」を実行（管理者権限で初期化）
          try {
            const payload = JSON.stringify({ roomId: id, idToken: AUTH_ID_TOKEN || null });
            const res = await fetch('/api/takeover-room', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j?.ok) {
              throw new Error(j?.error || `takeover failed (${res.status})`);
            }
            // ここまでで rooms/{id} は新ホスト(uid)として初期化済み
          } catch (e) {
            console.warn('[takeover]', e);
            alert('ルームの引き継ぎに失敗しました。別のIDを試すか、しばらく待ってください。');
            return;
          }
        }

        
        console.log('[create-room] uid(now)=', auth.currentUser?.uid, 'CURRENT_UID=', CURRENT_UID);
        
 const isTrump = (CREATE_FIELD_MODE === 'trump');
 const payload = {
   createdAt: serverTimestamp(),
   updatedAt: serverTimestamp(),
   hostUid: uid,
   hostDisplayName: creatorName,
   roomClosed: false,
   fieldMode: isTrump ? 'board' : CREATE_FIELD_MODE,
   joinPassHash: joinPassHash,
   hasPassword: !!joinPassHash
 };
 // trump のときだけ追加（undefined を書かない）
 if (isTrump) {
   payload.allowOtherOps = true;
   payload.initTrump = true;
 }
 await setDoc(roomRef, payload, { merge: true });

        await resetRoomState(id);

        IS_ROOM_CREATOR = true;
        startHostHeartbeat(id);

        CURRENT_ROOM_META = { ...(CURRENT_ROOM_META||{}), hostUid: CURRENT_UID, hostDisplayName: creatorName };
        renderFieldLabels();

        playerNameInput.value  = creatorName;
        
        joinRoomInput.value = id;
        loadSeatStatus();

        const ok = await claimSeat(id, CREATE_SELECTED_SEAT);
        if(!ok){ alert(`P${CREATE_SELECTED_SEAT} は使用中でした。別の座席を選んでください。`); return; }

        await setDoc(doc(db, `rooms/${id}`), { hostSeat: CREATE_SELECTED_SEAT, updatedAt: serverTimestamp() }, { merge: true });

        currentSeatMap[CREATE_SELECTED_SEAT] = {
          ...(currentSeatMap[CREATE_SELECTED_SEAT] || {}),
          claimedByUid: CURRENT_UID,
          displayName: creatorName
        };
        renderFieldLabels();

        CURRENT_PLAYER = CREATE_SELECTED_SEAT;
        seatButtons.forEach(b => b.classList.toggle('active', parseInt(b.dataset.seat,10) === CURRENT_PLAYER));
        startSession(id, CREATE_SELECTED_SEAT);

        // ★修正: trump モードでは、まず room.fieldMode='trump' を確実に適用してから共有デッキに生成
        if (CREATE_FIELD_MODE === 'trump') {
          // 1) ルーム doc に fieldMode を即反映（購読更新を待たずローカルにも反映）
          await setDoc(doc(db, `rooms/${id}`), { fieldMode: 'trump', updatedAt: serverTimestamp() }, { merge: true });
          CURRENT_ROOM_META = { ...(CURRENT_ROOM_META || {}), fieldMode: 'trump' };
          applyFieldModeLayout(); // ボード系DOM(#board-center .center-deck)を有効化

          // 2) 共有デッキ矩形が測れるまで待ってから中央に生成（waitForBoardDeckRect 内で待機）
          try {
            await spawnTrumpDeck(id);
            await setDoc(doc(db, `rooms/${id}`), { trumpInitialized: true, updatedAt: serverTimestamp() }, { merge: true });
          } catch (e) {
            console.warn('spawnTrumpDeck failed', e);
          }
        }

 } catch (e) {
   console.error('[create-room] failed:', e);
   // エラーコードとメッセージも表示して切り分け容易に
   const code = e?.code || e?.name || 'unknown';
   const msg  = e?.message || String(e);
   alert(`ルーム作成に失敗しました\ncode: ${code}\n${msg}`);
 } finally {
        createRoomBtn.disabled = false;
        createRoomBtn.textContent = oldText;
      }
    });

    const createSeatButtonsEls = Array.from(document.querySelectorAll('#create-seat-grid .seat-btn'));
    createSeatButtonsEls.forEach(btn => {
      btn.addEventListener('click', () => {
        CREATE_SELECTED_SEAT = parseInt(btn.dataset.createSeat, 10);
        createSeatButtonsEls.forEach(b => b.classList.toggle('active', b === btn));
        const picked = document.getElementById('create-seat-picked');
        if (picked) picked.textContent = `P${CREATE_SELECTED_SEAT}`;
      });
    });

// ===============================
// ロビー/座席管理
// ===============================
// 座席の空き状況やホスト在席を購読し、UI へ反映。
// ===== seats & lobby
    let unsubscribeSeats = null;
    joinRoomInput.addEventListener('change', loadSeatStatus);
    joinRoomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadSeatStatus(); });

    playerNameInput.addEventListener('change', async () => {
      const newName = (playerNameInput.value || '').trim();
      if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) return;
      // batched
      updateSeatBatched(CURRENT_PLAYER, { displayName: newName, updatedAt: serverTimestamp() });
    });

    const currentSeatMap = {1:null,2:null,3:null,4:null};
    function isSeatStale(data){
      if(!data || !data.heartbeatAt) return true;
      const hb = data.heartbeatAt?.toMillis ? data.heartbeatAt.toMillis() : 0;
      return (Date.now() - hb) > SEAT_STALE_MS;
    }
    
    // 追加: 全席が空(=生きていない)かを判定
    function isRoomEmpty(){
      return [1,2,3,4].every(s => {
        const d = currentSeatMap[s];
        return !d || isSeatStale(d) || !d.claimedByUid;
      });
    }

 function renderSeatAvailability(){
   const hostHere  = isHostAlive(CURRENT_ROOM_META);
   const roomEmpty = isRoomEmpty();
   seatButtons.forEach(btn => {
     const seat = parseInt(btn.dataset.seat, 10);
     const note = btn.querySelector('.seat-note');
     const data = currentSeatMap[seat];
     const alive = data && !isSeatStale(data) && !!data.claimedByUid;
     if (alive) {
       note.textContent = data.displayName || `P${seat}`;
       btn.disabled = true;
       btn.classList.remove('free');
     } else {
       // 非ホスト参加を許可：ホスト不在でも空席なら座れる
       note.textContent = '空席';
       btn.disabled = false;
       btn.classList.add('free');
     }
   });
   validateLobby();
 }

// ===============================
// HP パネルのレンダリング/操作
// ===============================
// 自席のみ操作可能なシンプルな HP 管理UI。
function renderHPPanel(){
      const grid = document.getElementById('hp-grid');
      if (!grid) return;
      const rows = [];
      for (const seat of [1,2,3,4]) {
        const seatData = currentSeatMap[seat] || {};
        const dispName = seatData.displayName || '';
        const isMe = (CURRENT_PLAYER === seat);
        const hpVal = (typeof seatData.hp === 'number') ? seatData.hp : 0;
        rows.push(`
          <div class="hp-row" data-seat="${seat}">
            <div class="hp-seat">P${seat}</div>
            <div class="hp-name">${dispName ? dispName : ''}</div>
            <div class="hp-value">
              <input class="hp-input" type="number" step="1" value="${hpVal}" ${isMe ? '' : 'disabled'} />
            </div>
            <div class="hp-ops">
              <button class="hp-btn hp-minus" ${isMe ? '' : 'disabled'}>-</button>
              <button class="hp-btn hp-plus"  ${isMe ? '' : 'disabled'}>+</button>
            </div>
          </div>
        `);
      }
      grid.innerHTML = rows.join('');
      grid.querySelectorAll('.hp-row').forEach(row => {
        const seat = parseInt(row.dataset.seat, 10);
        if (seat !== CURRENT_PLAYER) return;
        const input = row.querySelector('.hp-input');
        const minus = row.querySelector('.hp-minus');
        const plus  = row.querySelector('.hp-plus');
        const commit = (nextVal) => {
          const n = Number.isFinite(nextVal) ? Math.trunc(nextVal) : 0;
          if (input) input.value = n;
          updateSeatBatched(seat, { hp: n, updatedAt: serverTimestamp() });
        };
        input?.addEventListener('change', () => commit(parseInt(input.value, 10)));
        minus?.addEventListener('click', () => commit(parseInt(input.value, 10) - 1));
        plus?.addEventListener('click', () => commit(parseInt(input.value, 10) + 1));
      });
    }

    // ===== area colors (no change in write count; low frequency)
    // 特殊エリア(special)・捨て札(discard)を追加
    const DEFAULT_AREA_COLORS = {
      deck:'#ff9900',
      main:'#22dd88',
      hand:'#228be6',
      special:'#9c27b0', 
      discard:'#cc6666'  
    };


    function getSeatAreaColor(seat, zone){
      const ac = currentSeatMap[seat]?.areaColors || {};
      return ac[zone] || DEFAULT_AREA_COLORS[zone];
    }
    function renderAreaColors(){
      for (const seat of [1,2,3,4]) {
        const root = document.querySelector(`.player-${seat}`);
        if (!root) continue;
        
        const deck    = root.querySelector('.deck-area');
        const main    = root.querySelector('.main-play-area');
        const hand    = root.querySelector('.hand-area');
        const special = root.querySelector('.special-area');
        const discard = root.querySelector('.discard-area');
        
        if (deck) deck.style.background = getSeatAreaColor(seat, 'deck');
        if (main) main.style.background = getSeatAreaColor(seat, 'main');
        if (hand) hand.style.background = getSeatAreaColor(seat, 'hand');
        if (special) special.style.background = getSeatAreaColor(seat, 'special');
        if (discard) discard.style.background = getSeatAreaColor(seat, 'discard');

      }
    }
    function bindAreaColorHandlers(){
      for (const seat of [1,2,3,4]) {
        const root = document.querySelector(`.player-${seat}`);
        if (!root) continue;

        [
          { el: root.querySelector('.deck-area'),        key: 'deck'    },
          { el: root.querySelector('.main-play-area'),   key: 'main'    },
          { el: root.querySelector('.hand-area'),        key: 'hand'    },
          { el: root.querySelector('.special-area'),     key: 'special' },
          { el: root.querySelector('.discard-area'),     key: 'discard' },
        ].forEach(({el, key}) => {

          if (!el || el.__colorHandlerBound) return;
          el.__colorHandlerBound = true;
          el.classList.add('zone-colorable');
          el.addEventListener('dblclick', async (ev) => {
            ev.stopPropagation();
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
          });
        });
      }
    }

    function renderFieldLabels(){
      for (const s of [1,2,3,4]) {
        // --- カード用: 既存の .player-label を更新 ---
        {
          const area   = document.querySelector(`.player-${s}`);
          const seatEl = area?.querySelector('.player-label .label-seat');
          const nameEl = area?.querySelector('.player-label .label-name');
          if (seatEl) seatEl.textContent = `P${s}`;
          if (nameEl) {
            const seatData   = currentSeatMap[s] || null;
            const displayName= seatData?.displayName || '';
            const isHostSeat = (CURRENT_ROOM_META?.hostSeat === s);
            nameEl.textContent = displayName ? `${displayName}${isHostSeat ? '（ホスト）' : ''}` : '';
          }
        }

        // --- 追加: ボード / トランプ用の .board-name を更新 ---
        {
          const handEl = document.getElementById(`board-hand-${s}`);
          const seatElB = handEl?.querySelector('.board-name .label-seat');
          const nameElB = handEl?.querySelector('.board-name .label-name');
          if (seatElB) seatElB.textContent = `P${s}`;
          if (nameElB) {
            const seatData   = currentSeatMap[s] || null;
            const displayName= seatData?.displayName || '';
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
function applyFieldModeLayout(){
  const m = CURRENT_ROOM_META?.fieldMode;
  // 'board' と 'trump' をボード系DOMにマップ
  const mode = (m === 'board' || m === 'trump') ? 'board' : 'card';
  const fieldRoot = document.getElementById('field');
  if (!fieldRoot) return;
  fieldRoot.classList.toggle('mode-card',  mode === 'card');
  fieldRoot.classList.toggle('mode-board', mode === 'board');
}
    
    
    
    
    function detachSeatsListener(){ if(unsubscribeSeats){ unsubscribeSeats(); unsubscribeSeats = null; } }

    function loadSeatStatus(){
      detachSeatsListener();
      if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; }
      const roomId = (joinRoomInput.value||'').trim();

      CURRENT_ROOM_META = null;
      IS_ROOM_CREATOR = false;
      stopHostHeartbeat();
      stopHostWatch();
      renderFieldLabels();

      if(!roomId){ return; }
      
      unsubscribeRoomDoc = onSnapshot(doc(db, `rooms/${roomId}`), snap => {
         // ルームdocが削除された（exists=false）→ 即退室（参加者側）
         if (!snap.exists()) {
           CURRENT_ROOM_META = null;
           // いま実プレイ中で、この roomId に居るなら強制退室
           if (CURRENT_ROOM === roomId && lobby.style.display === 'none') {
             try { if (CURRENT_ROOM && CURRENT_PLAYER) releaseSeat(CURRENT_ROOM, CURRENT_PLAYER); } catch(_) {}
             try { if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; } } catch(_) {}
             try { if (unsubscribeSeats) { unsubscribeSeats(); unsubscribeSeats = null; } } catch(_) {}
             try { if (unsubscribeRoomDoc) { unsubscribeRoomDoc(); unsubscribeRoomDoc = null; } } catch(_) {}
             CURRENT_ROOM = null;
             CURRENT_PLAYER = null;
             stopHostWatch();
             sessionIndicator.textContent = 'ROOM: - / PLAYER: -';
             lobby.style.display = 'flex';
             alert('ホストがルームを削除しました。');
           }
           renderFieldLabels(); renderAreaColors(); updateEndRoomButtonVisibility(); renderHPPanel();
           return;
         }
         // 存在する場合の通常処理
         CURRENT_ROOM_META = snap.data();
         
         
         // UI反映
         applyOtherOpsUI();
         applyFieldModeLayout();
         
         
         IS_ROOM_CREATOR = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);
         if (IS_ROOM_CREATOR) startHostHeartbeat(roomId);
         startHostWatch(); // 追加: ロビー中も空室監視/自動削除を回す
         renderFieldLabels(); renderAreaColors(); updateEndRoomButtonVisibility(); renderHPPanel();
       });
      
      


      // ※ ここで updatedAt を書かない（以前は軽く触るだけで1書き込み発生していた）

      // seat docs listen
      const seatDocs = [1,2,3,4].map(n => doc(db, `rooms/${roomId}/seats/${n}`));
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
              // ← 追加：スナップショットに hp が数値で入っていたときだけ更新。
              // 無ければ既存の値（保持）を使う。未設定なら 0。
              hp: (typeof d.hp === 'number')
                    ? d.hp
                    : ((currentSeatMap[idx + 1] && typeof currentSeatMap[idx + 1].hp === 'number')
                        ? currentSeatMap[idx + 1].hp
                        : 0)
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
          const someoneFresh = [1, 2, 3, 4].some(n => isFresh(currentSeatMap[n]));
          if (someoneFresh) {
            // 最後に“だれか座っていた”時刻を更新（この変数名はあなたの実装に合わせて）
            if (typeof lastNonEmptyAt !== 'undefined') lastNonEmptyAt = now;
          }
        } catch (e) {
          console.warn('idle-watch check error', e);
        }

        renderAreaColors();
        renderSeatAvailability();
        renderHPPanel();   //座席更新が入ったらHPパネルも即リフレッシュ
        // 追加: その席のカード裏背景を再適用
        refreshCardBacksForSeat(idx + 1);
        
      }));
      unsubscribeSeats = () => unsubs.forEach(fn => fn());
    }

    function validateLobby(){
   const hostHere  = isHostAlive(CURRENT_ROOM_META);
   const roomEmpty = isRoomEmpty();
   // 非ホスト参加を許可するため、ホスト在席チェックは行わない
   // if (!hostHere && !roomEmpty && ACTIVE_MODE === 'join') { startBtn.disabled = true; return; }
      if (ACTIVE_MODE === 'create') { startBtn.disabled = true; return; }
      const roomOk  = !!(joinRoomInput.value||'').trim();
      const nameNow = (playerNameInput.value||'').trim();
      const nameOk  = nameNow.length > 0 && nameNow.length <= 24;      const seatOk  = !!CURRENT_PLAYER;
      startBtn.disabled = !(roomOk && nameOk && seatOk);
    }

    seatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        ACTIVE_MODE = 'join';
        let nameNow = (playerNameInput.value || '').trim();
        if (!nameNow) {
          const rightName  = (newPlayerNameInput.value || '').trim();
          if (rightName) {
            playerNameInput.value  = rightName;
            nameNow = rightName;
          }
        }
        if (!nameNow) { alert('先に「プレイヤー名」を入力してください。'); playerNameInput.focus(); return; }
        const seat = parseInt(btn.dataset.seat, 10);
        CURRENT_PLAYER = seat;
        seatButtons.forEach(b => b.classList.toggle('active', parseInt(b.dataset.seat,10) === CURRENT_PLAYER));
        validateLobby();
        updateEndRoomButtonVisibility();
        renderHPPanel();
      });
    });


 startBtn.addEventListener('click', async (ev) => {
   // UID 未確定で開始に失敗するのを防ぐ
   await ensureAuthReady();
      ev.preventDefault();
      ACTIVE_MODE = 'join';
      await ensureAuthReady();
      if (!CURRENT_UID) { alert('認証の初期化に時間がかかっています。数秒後に再度お試しください。'); return; }

      const room    = (joinRoomInput.value || '').trim();
      const seat    = CURRENT_PLAYER;
      const nameNow = (playerNameInput.value || '').trim();

      if (!room)  { alert(t('err.roomId')); return; }
      if (!nameNow) { alert(t('err.playerName')); return; }
      if (!seat)  { alert(t('err.seat')); return; }

      const oldText = startBtn.textContent;
      startBtn.disabled = true;
      startBtn.textContent = '開始中…';
      
      // 追加: 無人ルームの自動復旧 & ホスト引き継ぎ
      try {
        const hostHereNow = isHostAlive(CURRENT_ROOM_META);
        if (!hostHereNow && isRoomEmpty()) {
          // サブコレクションを掃除し、roomClosedを開け、ホストを自分に
          await resetRoomState(room);
          await setDoc(doc(db, `rooms/${room}`), {
            roomClosed: false,
            hostUid: CURRENT_UID,
            hostDisplayName: nameNow,
            hostSeat: seat,
            hostHeartbeatAt: serverTimestamp()
          }, { merge: true });
          IS_ROOM_CREATOR = true;
          startHostHeartbeat(room);
        }
      } catch (e) {
        console.warn('[revive-room] failed', e);
        // 失敗しても通常のJoinは続行（権限で弾かれた場合など）
      }      
      
      
      try {
      
      
      
        // まず最新のメタ情報を1回読み込む（以降のロジックで使用）
        const roomSnap = await new Promise(resolve => {
          const unsub = onSnapshot(doc(db, `rooms/${room}`), snap => { unsub(); resolve(snap); });
        });
        const meta = roomSnap.exists() ? roomSnap.data() : null;
        
        // ★追加：自分がホストかどうか（UID一致）を定義しておく
        const iAmHost = !!(meta?.hostUid && CURRENT_UID && meta.hostUid === CURRENT_UID);


        // === NEW: ルームが「終了扱い」またはホスト不在なら、ここで完全掃除してから再開する ===
        // これにより、終了時の削除に失敗してカード/座席が残っていても、再入室時に必ず消える
        if (meta?.roomClosed || !isHostAlive(meta)) {
          try {
            await resetRoomState(room); // サブコレクション（cards / seats）を全削除
            await setDoc(doc(db, `rooms/${room}`), { // ルームを再開
              roomClosed: false,
              hostUid: CURRENT_UID,
              hostSeat: seat,
              hostDisplayName: nameNow,
              hostHeartbeatAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
            IS_ROOM_CREATOR = true;
            startHostHeartbeat(room);
          } catch (e) {
            console.warn('[auto-cleanup] failed', e);
          }
        }


// 「ホストUID かつ ホスト席」の人だけパス免除
const isHostUid  = !!(meta?.hostUid && CURRENT_UID && meta.hostUid === CURRENT_UID);
const isHostSeat = !!(meta?.hostSeat && seat && meta.hostSeat === seat);
const canSkipPassword = isHostUid && isHostSeat;

// 共有パスワードが設定されているなら、免除対象以外は必ず検証
if (meta?.joinPassHash && !canSkipPassword) {
  const passRaw = (joinRoomPassInput?.value || '').trim();
  const given   = passRaw ? await sha256Hex(passRaw) : '';

  if (given !== meta.joinPassHash) {
    // 視覚フィードバック（赤枠＆振動）
    if (joinRoomPassInput) {
      joinRoomPassInput.classList.add('is-error','shake');
      joinRoomPassInput.setAttribute('aria-invalid','true');
      joinRoomPassInput.focus();
      // アニメ終了で振動クラスだけ外す（赤枠は入力し直すまで残す）
      joinRoomPassInput.addEventListener('animationend', () => {
        joinRoomPassInput.classList.remove('shake');
      }, { once:true });
      // 選択状態にしてすぐ打ち直せるように
      joinRoomPassInput.select?.();
    }
    // （必要ならアラートは外してOK）
    // alert(t('err.passWrong'));
    startBtn.disabled = false;
    startBtn.textContent = oldText;
    return;
  }
  
}
        
        
        const hostLikelyHere = !!meta?.hostUid || isHostAlive(meta);
        if (!meta || (!hostLikelyHere && !iAmHost)) {
          alert(t('err.hostAbsent')); return;
        }
        if (iAmHost) IS_ROOM_CREATOR = true;

        const ok = await claimSeat(room, seat);
        if (!ok) { alert('開始直前に座席が埋まりました。別の席を選んでください。'); return; }

        currentSeatMap[seat] = { ...(currentSeatMap[seat] || {}), claimedByUid: CURRENT_UID, displayName: nameNow, color: '#22aaff' };
        renderSeatAvailability();

        startSession(room, seat);
      } catch (e) {
        console.error(e);
        alert('開始に失敗しました。ネットワーク状態を確認してもう一度お試しください。');
      } finally {
        startBtn.disabled = false;
        startBtn.textContent = oldText;
      }
    });

// ===============================
// 座席の取得/解放
// ===============================
// トランザクションで安全に座席を確保/解放します。
// 座席をトランザクションで確保（古い/空き/自分なら上書き）
// @param {string} roomId - string
// @param {number} seat - number
// @returns {Promise<boolean>} 成功可否
//

async function claimSeat(roomId, seat){
      const seatRef = doc(db, `rooms/${roomId}/seats/${seat}`);
      const displayName = (playerNameInput.value||'').trim();
      const color = '#22aaff';
      try{
        const success = await runTransaction(db, async (tx) => {
          const snap = await tx.get(seatRef);
          if(!snap.exists()){
            tx.set(seatRef, { claimedByUid: CURRENT_UID, displayName, color, claimedAt: serverTimestamp(), heartbeatAt: serverTimestamp(), hp: 0 });
            return true;
          }
          const data = snap.data();
          const stale = isSeatStale(data);
          if(!data.claimedByUid || stale || data.claimedByUid === CURRENT_UID){
            tx.set(seatRef, { claimedByUid: CURRENT_UID, displayName, color, claimedAt: serverTimestamp(), heartbeatAt: serverTimestamp(), hp: (typeof data?.hp==='number'?data.hp:0) });
            return true;
          }
          return false;
        });
        return success;
      }catch(e){ console.error('claimSeat error', e); return false; }
    }

    async function releaseSeat(roomId, seat){
      try{
        await deleteDoc(doc(db, `rooms/${roomId}/seats/${seat}`));
      }catch(e){
        // 既に seats が掃除済み / ルームが閉鎖済みのときは黙って無視
        if (e?.code !== 'permission-denied' && e?.code !== 'not-found') {
          console.warn('releaseSeat error', e);
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

 // [HB] host heartbeat
 function startHostHeartbeat(roomId){
   // 専用ループは起動しない（座席HBの中で hostHeartbeatAt を更新）
   if (hostHeartbeatTimer) { clearInterval(hostHeartbeatTimer); hostHeartbeatTimer = null; }
   
   
   hostHeartbeatTimer = setInterval(async () => {
     try{
      // ルームを離脱/閉鎖している間は doc を再生成しない
      if (!CURRENT_ROOM || CURRENT_ROOM !== roomId) return;
      if (CURRENT_ROOM_META?.roomClosed) return;
      await setDoc(
        doc(db, `rooms/${roomId}`),
        { hostHeartbeatAt: serverTimestamp() }, { merge: true });
       
     }catch(e){ console.warn('host HB failed', e); }
   }, HOST_HEARTBEAT_MS);
 }    
    
    
    
    
    function stopHostHeartbeat(){ if(hostHeartbeatTimer){ clearInterval(hostHeartbeatTimer); hostHeartbeatTimer = null; } }
    
    
// === 背面画像関連 ===
function seatBackUrl(seat){
  const s = currentSeatMap && currentSeatMap[seat];
  return (s && typeof s.backImageUrl === 'string' && s.backImageUrl) ? s.backImageUrl : null;
}

// 席ごとの裏面URL（未設定ならデフォルトのトランプ裏面にフォールバック）
function getSeatBackUrl(seat){
  const url = seatBackUrl(seat);
  return url || TRUMP_BACK_URL;
}

function applyCardBackStyle(card){
  // 裏面の背景を適用（席の設定がなければ黒）
  const seat = parseInt(card.dataset.ownerSeat || '0', 10);
  const url  = seatBackUrl(seat);
  card.style.backgroundColor = '#000';
  if (url){
    card.classList.add('has-back');
    card.style.backgroundImage  = `url("${url}")`;
  }else{
    card.classList.remove('has-back');
    card.style.backgroundImage  = '';
  }
}
function refreshCardBacksForSeat(seat){
  // 指定席の全カードについて、裏向きなら背面を塗り直す
  cardDomMap.forEach((el) => {
    if (parseInt(el.dataset.ownerSeat || '0', 10) !== seat) return;
    const img = el.querySelector('img');
    const isFaceUp = !!img && img.style.display !== 'none';
    if (!isFaceUp) applyCardBackStyle(el);
  });
}    



 async function startHeartbeat(roomId, seat){
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
     try{
     
      const now = Date.now();

      // 直近の操作が無い → 完全スキップ（ただし5分に1回は維持）
      const active = (now - lastActivityAt) < ACTIVE_WINDOW_MS;
      const needIdleKeepAlive = (now - lastSeatHBWriteAt) > IDLE_KEEPALIVE_MS;
      if (active || needIdleKeepAlive) {
        updateSeatBatched(seat, { heartbeatAt: serverTimestamp() });
        lastSeatHBWriteAt = now;
      }

      // ルーム側 ping は 60s に節約
      if (now - __roomPingAt > ROOM_PING_MS) {
        __roomPingAt = now;
        const patch = { lastSeatPing: serverTimestamp() };
        // ホストなら hostHeartbeatAt も同梱して1 write にまとめる
        const iAmHost = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);
        if (iAmHost) patch.hostHeartbeatAt = serverTimestamp();
        await setDoc(doc(db, `rooms/${roomId}`), patch, { merge: true });
      }
     
     }catch(e){ console.warn('HB error', e); }
   }, SEAT_HEARTBEAT_MS);
 }
 
     function stopHeartbeat(){ if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; } }

    // ===== Cards / UI
    const field = document.getElementById("field");
    const container = document.getElementById("container");
    const previewImg = document.getElementById("preview-img");
    const previewInfo = document.getElementById("preview-info");
    const uploadArea = document.getElementById("upload-area");
    const fileInput = document.getElementById("file-input");
    const fieldSizeOptions = document.getElementById("field-size-options");

    const fullImageStore = new Map(); // key: cardId, value: dataURL(full)

    let unsubscribeCards = null;
    let handlersBound = false;
    
    
    // ==== 退室通知: タブ閉じ/アプリ終了時のみ ====
    let __lifecycleBound = false;
    function bindLifecycleHandlers(){
      if (__lifecycleBound) return; __lifecycleBound = true;

      // 退室処理（「タブ閉じ/終了」のみで呼ぶ）
      const leaveSafely = async (reason) => {
        try {
          if (!CURRENT_ROOM || !CURRENT_PLAYER) return;
          // できるだけ早く席を解放（非同期ベストエフォート）
          // Firestore 書き込みはタイミング次第で完了しない可能性もあるが、
          // pagehide の段階なら概ね実行時間が確保される。
          await releaseSeat(CURRENT_ROOM, CURRENT_PLAYER);
        } catch(e) {
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
// ルーム/座席が決まった後の購読開始やUI初期化。
// 購読開始/ハートビート開始/UI初期化など、参加開始時の初期化
// @param {string} roomId - string
// @param {number} playerId - number
//

function startSession(roomId, playerId){
      CURRENT_ROOM = roomId; CURRENT_PLAYER = playerId;
      updateEndRoomButtonVisibility();
      sessionIndicator.textContent = `ROOM: ${CURRENT_ROOM} / PLAYER: P${CURRENT_PLAYER}`;
      lobby.style.display = 'none';
      startHeartbeat(roomId, playerId);
      if (IS_ROOM_CREATOR) startHostHeartbeat(roomId);
      
      
      joinRoomInput.value = CURRENT_ROOM;
      loadSeatStatus();

// 離脱時の多重実行防止
      let __leavingOnce = false;
      const __onLeave = () => {
        if (__leavingOnce) return;
        __leavingOnce = true;

        // 先に全タイマー/購読を停止してから DB を触る
        try { stopHostHeartbeat(); } catch (_) {}
        try { stopHeartbeat(); } catch (_) {}
        try { stopHostWatch(); } catch (_) {}

        if (IS_ROOM_CREATOR && CURRENT_ROOM) {
          // 重要：タブが閉じても到達しやすい手段で通知
          sendCloseBeacon(CURRENT_ROOM);
        }

        try { releaseSeat(roomId, playerId); } catch (_) {}
      };

      // PCブラウザ向け
      window.addEventListener('beforeunload', __onLeave);
      // iOS Safari 等のモバイル向け
      window.addEventListener('pagehide', __onLeave, { once: true });
      
      
      
      
      initializePlayField();
      
      // 再入室時に前のDOMが残らないよう、まず強制クリア
      clearFieldDOM();
      initializePlayField();
      
      subscribeCards();
      subscribeChat();          // ←追加：チャット購読を開始
      bindChatUIOnce();         // ←追加：送信ボタン/Enter送信を有効化
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
function appendSystemLine(text){
  const listEl = document.getElementById('chat-log');
  if (!listEl) return;
  const el = document.createElement('div');
  el.className = 'sys';
  el.style.cssText = 'color:#a00;font-size:12px;margin:4px 0;';
  el.textContent = text;
  listEl.appendChild(el);
  listEl.scrollTop = listEl.scrollHeight;
}


function myDisplayName(){
  try{
    const seatData = (typeof CURRENT_PLAYER === 'number' && currentSeatMap) ? (currentSeatMap[CURRENT_PLAYER] || {}) : {};
    const nameFromSeat = seatData.displayName;
    const fallback = document.getElementById('new-player-name')?.value;
    return nameFromSeat || fallback || `P${CURRENT_PLAYER||'-'}`;
  }catch(_){
    return `P${CURRENT_PLAYER||'-'}`;
  }
}

async function postChat(text){
  if (!text || !CURRENT_ROOM || !CURRENT_PLAYER) return;
  try{
    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/chat`), {
      type: 'chat',
      text: String(text).slice(0, 500),
      seat: CURRENT_PLAYER,
      name: myDisplayName(),
      createdAt: serverTimestamp()
    });
  }catch(e){
    console.warn('chat send failed', e);
    if (e?.code === 'permission-denied'){
      appendSystemLine('チャット送信が許可されていません（権限）');
      // 入力UIを無効化
      document.getElementById('chat-input')?.setAttribute('disabled','');
      document.getElementById('chat-send')?.setAttribute('disabled','');
    }
  }
}

async function postLog(text){
  if (!text || !CURRENT_ROOM || !CURRENT_PLAYER) return;
  try{
    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/chat`), {
      type: 'log',
      text: String(text),
      seat: CURRENT_PLAYER,
      name: myDisplayName(),
      createdAt: serverTimestamp()
    });
  }catch(e){
    console.warn('log failed', e);
    if (e?.code === 'permission-denied'){
      appendSystemLine('操作ログの書き込みが許可されていません（権限）');
    }
  }
}

function bindChatUIOnce(){
  if (chatUIBound) return;
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');

  // 送信ボタン
  send?.addEventListener('click', async () => {
    const text = (input?.value || '').trim();
    if (!text) return;
    await postChat(text);
    if (input) input.value = '';
  });

  // Enter 送信（Shift+Enter で改行）
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      send?.click();
    }
  });

  chatUIBound = true;
}

function renderChatDoc(d){
  const data = d.data() || {};
  const wrap = document.createElement('div');
  wrap.className = (data.type === 'log') ? 'log' : 'chat';
  wrap.style.margin = '4px 0';

  const t = data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date();
  const hh = String(t.getHours()).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');

  const head = document.createElement('div');
  head.style.fontSize = '11px';
  head.style.color = (data.type === 'log') ? '#888' : '#666';
  // ログでもプレイヤー名を表示（name が無ければ seat から P番号を推定）
  const who = data.name || (typeof data.seat === 'number' ? `P${data.seat}` : '');
  head.textContent = `[${hh}:${mm}] ${who}`;

  const body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  body.textContent = data.text || '';

  wrap.appendChild(head);
  wrap.appendChild(body);
  return wrap;
}

function subscribeChat(){
  try{ unsubscribeChat?.(); }catch(_){}
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
      if (ch.type === 'added'){
        listEl.appendChild(renderChatDoc(ch.doc));
      }
    });
    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }, (err) => {
    console.warn('chat subscribe error', err?.code, err);
    if (err?.code === 'permission-denied'){
      appendSystemLine('このプロジェクトの Firestore ルールでチャットの閲覧が許可されていません。');
      document.getElementById('chat-input')?.setAttribute('disabled','');
      document.getElementById('chat-send')?.setAttribute('disabled','');
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

function subscribeCards(){
      if(unsubscribeCards){ unsubscribeCards(); unsubscribeCards = null; }
      const qCards = collection(db, `rooms/${CURRENT_ROOM}/cards`);
      unsubscribeCards = onSnapshot(qCards, snap => {
        snap.docChanges().forEach(change => {
          const data = change.doc.data();
          const id = change.doc.id;
          if(change.type === 'removed'){
            const el = cardDomMap.get(id); if(el){ el.remove(); cardDomMap.delete(id); }
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
    function markLocal(id){ localChangeMap.set(id, Date.now()); setTimeout(()=>localChangeMap.delete(id), 800); }
    function isLocalRecent(id){ const t = localChangeMap.get(id); return t && (Date.now() - t < 800); }
    // ★ 追加: 直近でローカル削除したIDを覚えて、再生成を抑止
    const localDeleteMap = new Map(); // id -> timestamp
    function markLocalDelete(id){ localDeleteMap.set(id, Date.now()); setTimeout(()=>localDeleteMap.delete(id), 2000); }
    function isLocallyDeleted(id){ const t = localDeleteMap.get(id); return t && (Date.now() - t < 2000); }
    
    
    // ==== 追加: フィールド上の描画カードを強制的に全消去 ====
    function clearFieldDOM(){
      try {
        // .card 要素を全削除
        document.querySelectorAll('.card').forEach(el => el.remove());
      } catch(_) {}
      // 管理用マップや選択状態も掃除
      try { cardDomMap.clear(); } catch(_) {}
      try { selectedCard?.classList?.remove?.('selected'); } catch(_) {}
      try { selectedCard = null; } catch(_) {}
      try { typeof setPreview === 'function' && setPreview(); } catch(_) {}
    }
    
    
    function upsertCardFromRemote(id, data){
      let el = cardDomMap.get(id) || document.querySelector(`[data-card-id="${id}"]`);
      const exists = !!el;
      // ★ 追加: 直近にローカルで削除したIDは一定時間は無視して再生成しない
      if (!exists && (isLocallyDeleted(id))) {
        return;
      }
      if (!exists && !isLocalRecent(id)) {
        el = createCardDom(id, data.imageUrl, data);
        cardDomMap.set(id, el);
        field.appendChild(el);
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

function createCardDom(cardId, imageSrc, state){
      const card = document.createElement("div");
      card.className = "card";
      if (state?.type === 'counter') card.classList.add('counter');
      
      
      
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
  const img = document.createElement('img');
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

  card.addEventListener('dblclick',     e => e.preventDefault());
  
  
 // === 長押し（モバイル）で右クリック相当の処理 ===
 async function handleLongPressOnCard(card, state){
   const cardId = card.dataset.cardId;
   const isCounter = (state?.type === 'counter') || card.classList.contains('counter');
   const isToken   = (state?.type === 'token')   || card.classList.contains('token');
   const isNumCtr  = (state?.type === 'numcounter') || card.classList.contains('numcounter');
   if (isCounter || isToken || isNumCtr) {
     if (!canOperateCard(card, 'delete')) return;
     try { await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${cardId}`)); } catch(e){ console.warn(e); }
     return;
   }
   // 通常カード：表裏トグル
   if (!canOperateCard(card, 'flip')) return;
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

      const img = document.createElement('img');
      img.decoding = 'async';
      img.loading  = 'lazy';
      if (typeof imageSrc === 'string' && imageSrc.trim().length > 0) {
        img.src = imageSrc;
      } else {
        // 未定義/空なら src を付けない（/undefined リクエスト回避）
        img.removeAttribute('src');
        img.style.display = 'none'; // URLが入るまで非表示
      }
      card.appendChild(img);


      // token UI
      let tokenInput = null;
      if (state?.type === 'token') {
        card.classList.add('token');
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
          tokenInput.addEventListener('input', () => { if (tmr) clearTimeout(tmr); tmr = setTimeout(commit, 500); }); // ← 500ms
          tokenInput.addEventListener('blur', commit);
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

  if (editable){
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

        if (selectedCard) selectedCard.classList.remove("selected");
        card.classList.add("selected");
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
        
        const ownerPlayerNum = card.dataset.ownerSeat ? `P${card.dataset.ownerSeat}` : "?";
        if (isToken) {
          const t = card.querySelector('.token-input')?.value || '';
          previewInfo.textContent = `カードのオーナー: ${ownerPlayerNum} / あなた: P${CURRENT_PLAYER || "?"}\n内容: ${t ? t.slice(0,200) : '(未記入)'}`;
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
        
        
        // まず種類を判定（トークン/カウンター/数値カウンターの削除はオーナーのみ＝従来通り）
        const isCounter = (state?.type === 'counter') || card.classList.contains('counter');
        const isToken   = (state?.type === 'token')   || card.classList.contains('token');
        const isNumCtr  = (state?.type === 'numcounter') || card.classList.contains('numcounter');
        if (isCounter || isToken || isNumCtr) {
          if (!canOperateCard(card, 'delete')) return; // 共有ONでも削除は不可（オーナーのみ）
          try {
            const id = card.dataset.cardId;
            await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));
            // ★ 追加: 直近削除マーキング（差分レースでの復活を防止）
            markLocal(id);
            markLocalDelete(id);
          } catch (err) {
            console.warn('delete token/counter failed', err);
          }
          return;
        }
        // ここから通常カードの表裏トグル
        if (!canOperateCard(card, 'flip')) return;        
        
        
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
        
 if (tokenEl) {
   if (nextFaceUp) { tokenEl.style.display = 'block'; card.style.backgroundColor = '#fff'; }
   else { tokenEl.style.display = 'none'; card.style.backgroundColor = '#000'; if (selectedCard === card) setPreview(); }
 }        
        
        updateCardBatched(cardId, { faceUp: nextFaceUp });
      });
      
      
      
      
      

      // ダブルクリックで90°回転（自分のカードのみ）
      card.addEventListener("dblclick", async (e) => {
        e.stopPropagation();
        if (card.dataset.ownerSeat !== String(CURRENT_PLAYER)) return;
        
        // ★ 数値カウンターは回転させない
        if (card.classList.contains('numcounter')) return;
  
        const currentStyle = card.style.transform || '';
        const match = currentStyle.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
        const current = match ? parseFloat(match[1]) : (typeof state?.rotation === 'number' ? state.rotation : 0);
        const next = ((current + 270) % 360 + 360) % 360;
        card.style.transform = `rotate(${next}deg)`;
        updateCardBatched(cardId, { rotation: next });
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
        }, { passive:true });
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

function applyCardState(card, data){
      card.dataset.ownerUid = data.ownerUid || '';
      card.dataset.ownerSeat = (data.ownerSeat!=null) ? String(data.ownerSeat) : '';
      card.setAttribute('data-owner', (card.dataset.ownerSeat && card.dataset.ownerSeat !== String(CURRENT_PLAYER)) ? 'other' : 'me');

      card.style.left = `${data.x||0}px`;
      card.style.top  = `${data.y||0}px`;
      if (data.zIndex) card.style.zIndex = data.zIndex;

      const rot = (typeof data.rotation === 'number') ? data.rotation : 0;
      card.style.transform = `rotate(${rot}deg)`;

      card.dataset.faceUp = data.faceUp ? 'true' : 'false';
      const img = card.querySelector('img');
      if (data.fullUrl) { card.dataset.fullUrl = data.fullUrl; }
      
      
      if(img){
        if(data.faceUp){ img.style.display = 'block'; card.style.backgroundColor = '#fff'; }
        else { img.style.display = 'none'; card.style.backgroundColor = '#000'; }
        if(data.imageUrl && img.src !== data.imageUrl){ img.src = data.imageUrl; }
      }
      
      
      
      // --- ここから追加：旧形式URL（/o?name= を含む）を安全なURLへ自動移行 ---
      if (data?.imageUrl && /\/o\?name=/.test(data.imageUrl)) {
        (async () => {
          try {
            const id = card.dataset.cardId;
            // 既存の保存規約：rooms/{ROOM}/cards/{ID}/(thumb|full).jpg
            const base = `rooms/${CURRENT_ROOM}/cards/${id}`;
            const thumbRef = ref(storage, `${base}/thumb.jpg`);
            const fullRef  = ref(storage, `${base}/full.jpg`);
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
      
      
      

      if (data.type === 'token') {
        card.classList.add('token');
        const tokenInput = card.querySelector('.token-input');
        if (tokenInput) {
          if (typeof data.tokenText === 'string' && tokenInput.value !== data.tokenText) {
            tokenInput.value = data.tokenText;
          }
          // トークンはテキスト入力の表示/非表示だけを切り替える（通常カードの表裏処理は入れない）
          if (data.faceUp) {
            tokenInput.style.display = 'block';
            card.style.backgroundColor = '#fff';
            card.style.backgroundImage = '';
            card.classList.remove('has-back');
          } else {
            tokenInput.style.display = 'none';
            // 背面画像を適用したい場合は次行を有効化。黒で良ければ消してOK。
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
        const y = parseFloat(card.style.top)  || 0;
        let insideSeat = null;
        for (const s of [1,2,3,4]) {
          const hb = getHandBoundsForSeat(s);
          if (hb && isCenterInsideRect(x, y, hb)) { insideSeat = s; break; }
        }
        if (insideSeat && String(viewerSeat) !== String(insideSeat)) {
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
      } catch(_) {}
    }

// ===============================
// ルーム終了/削除ユーティリティ
// ===============================
// cards/seats の一括削除と roomClosed フラグの設定、必要に応じて親docも削除。
// cards/seats を一括削除し roomClosed を立てる
// @param {string} roomId - string
//

async function cleanupAndCloseRoom(roomId){
      // cards
      const cardsCol = collection(db, `rooms/${roomId}/cards`);
      const cardsSnap = await getDocs(cardsCol);
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of cardsSnap.docs) {
        batch.delete(doc(db, `rooms/${roomId}/cards/${docSnap.id}`));
        if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      // seats
      const seatsCol = collection(db, `rooms/${roomId}/seats`);
      const seatsSnap = await getDocs(seatsCol);
      batch = writeBatch(db); count = 0;
      for (const docSnap of seatsSnap.docs) {
        batch.delete(doc(db, `rooms/${roomId}/seats/${docSnap.id}`));
        if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      await setDoc(doc(db, `rooms/${roomId}`), { roomClosed: true, updatedAt: serverTimestamp() }, { merge: true });
    }
    
    
     // ルーム完全削除（サブコレ削除→roomClosedフラグ→親doc削除）
     async function cleanupAndDeleteRoom(roomId){
  // まず既存処理で cards/seats を全削除し、roomClosed を立てて通知
  await cleanupAndCloseRoom(roomId);
  // 次に親ルームドキュメント自体を削除（失敗時は墓標＆TTL）
  try {
    await deleteDoc(doc(db, `rooms/${roomId}`));
  } catch (e) {
    console.warn('delete room doc failed', e);
    // 権限NGや競合時の保険：入室不可にする tombstone を残す
    try {
      await setDoc(doc(db, `rooms/${roomId}`), {
        roomClosed: true,
        tombstone: true,
        deletedAt: serverTimestamp(),
        // Firestore TTL を rooms コレクションの "ttl" に設定していれば自動削除
        ttl: new Date(Date.now() + 10 * 60 * 1000) // 10分後
      }, { merge: true });
    } catch (e2) {
      console.warn('tombstone fallback failed', e2);
    }
  }
}
    
    
    
    

    async function resetRoomState(roomId){
      try{
        const cardsCol = collection(db, `rooms/${roomId}/cards`);
        const cardsSnap = await getDocs(cardsCol);
        let batch = writeBatch(db); let n = 0;
        for (const d of cardsSnap.docs){
          batch.delete(doc(db, `rooms/${roomId}/cards/${d.id}`));
          if (++n >= 450){ await batch.commit(); batch = writeBatch(db); n = 0; }
        }
        if (n > 0) await batch.commit();

        const seatsCol = collection(db, `rooms/${roomId}/seats`);
        const seatsSnap = await getDocs(seatsCol);
        batch = writeBatch(db); n = 0;
        for (const d of seatsSnap.docs){
          batch.delete(doc(db, `rooms/${roomId}/seats/${d.id}`));
          if (++n >= 450){ await batch.commit(); batch = writeBatch(db); n = 0; }
        }
        if (n > 0) await batch.commit();

        await setDoc(doc(db, `rooms/${roomId}`), { roomClosed: false, updatedAt: serverTimestamp() }, { merge: true });
      }catch(e){
        console.warn('resetRoomState failed', e);
      }
    }
    
    
    
    
    
    // ===== queued update API (replaces updateDoc direct calls)
    async function updateCard(cardId, patch){
      // 互換用（今は使っていない）— 直接書かない
      updateCardBatched(cardId, patch);
    }

// ===============================
// アップロードとサムネ生成
// ===============================
// 画像のサムネイル生成、Storage アップロード、Firestore への反映を並列/分割で実行。
// ===== Uploads: parallel & thumbnails
    const nextFrame = ()=>new Promise(r=>requestAnimationFrame(()=>r()));
    const THUMB_MAX_W = 240;
    const THUMB_MAX_H = 320;
    const PARALLEL = Math.max(2, Math.min(6, Math.floor((navigator.hardwareConcurrency||8)/2))); // 少し下げる
    const BATCH_INSERT = 12;

    const fileQueue = [];
    let processing = false;

    function bindUploadHandlers(){
      uploadArea.addEventListener("click", () => fileInput.click());
      uploadArea.addEventListener("dragover", e => { e.preventDefault(); uploadArea.style.backgroundColor = "#eef"; });
      uploadArea.addEventListener("dragleave", () => { uploadArea.style.backgroundColor = "#fff"; });
      uploadArea.addEventListener("drop", e => { e.preventDefault(); uploadArea.style.backgroundColor = "#fff"; handleFiles(e.dataTransfer.files); });
      fileInput.addEventListener("change", e => handleFiles(e.target.files));
    }

    function handleFiles(files){
      const imgs = [...files].filter(f=>f.type.startsWith('image/'));
      for (const f of imgs) fileQueue.push(f);
      if (!processing) processQueue();
    }

    async function fileToThumbAndFull(file){
      const bmp = await createImageBitmap(file);
      const sw = bmp.width, sh = bmp.height;
      const scale = Math.min(THUMB_MAX_W / sw, THUMB_MAX_H / sh, 1);
      const tw = Math.max(1, Math.round(sw * scale));
      const th = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext('2d', {alpha: false});
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(bmp, 0, 0, tw, th);
      const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.6); // ← 0.6 に
      const fullDataUrl = await new Promise((res, rej)=>{
        const fr = new FileReader(); fr.onerror = rej; fr.onload = ()=>res(fr.result); fr.readAsDataURL(file);
      });
      try { bmp.close?.(); } catch(_){}
      return { thumbDataUrl, fullDataUrl };
    }

    async function processQueue(){
      processing = true;
      // ★ アップロード完了合計
      let totalUploaded = 0;
      try{
        while (fileQueue.length){
          const chunk = fileQueue.splice(0, BATCH_INSERT);
          const groups = [];
          for (let i=0; i<chunk.length; i+=PARALLEL) groups.push(chunk.slice(i,i+PARALLEL));

          const frag = document.createDocumentFragment();

          for (const group of groups){
            const results = await Promise.all(group.map(async (file)=>{
              const {thumbDataUrl, fullDataUrl} = await fileToThumbAndFull(file);
              if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) return null;

              const {x,y} = randomPointInDeck(CURRENT_PLAYER);


              // 1) まず Firestore にメタだけ作る（URLはあとで埋める）
              const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
              const refDoc = await addDoc(baseCol, {
                x, y, zIndex: 1, faceUp: true,
                ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER, rotation: 0,
                visibleToAll: true,
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
              });
              const cardId = refDoc.id;

              // 2) Storage へ thumb/full をアップロード
              const objBase = `rooms/${CURRENT_ROOM}/cards/${cardId}`;
              const fullRef  = ref(storage, `${objBase}/full.jpg`);
              const thumbRef = ref(storage, `${objBase}/thumb.jpg`);
              // data URL を直接アップロード（クライアント生成）
              await Promise.all([
                uploadString(fullRef,  fullDataUrl,  'data_url'),
                uploadString(thumbRef, thumbDataUrl, 'data_url'),
              ]);
              const [fullUrl, thumbUrl] = await Promise.all([
                getDownloadURL(fullRef),
                getDownloadURL(thumbRef),
              ]);

              // 3) Firestore のカードに URL を反映
              await updateDoc(refDoc, {
                imageUrl: thumbUrl,
                fullUrl: fullUrl,
                updatedAt: serverTimestamp()
              });

              // 4) DOM 生成（即時プレビュー用に thumb を使い、full は data 属性へ）
              markLocal(cardId);
              let el = cardDomMap.get(cardId);
              if (!el) {
                el = createCardDom(cardId, thumbUrl, {
                  x, y, zIndex: 1, faceUp: true,
                  ownerUid: CURRENT_UID, ownerSeat: CURRENT_PLAYER, rotation: 0
                });
                el.dataset.fullUrl = fullUrl;
                cardDomMap.set(cardId, el);
                applyCardState(el, {
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

function makeDraggable(card){
      const DRAG_THRESHOLD = 5;
      let isDragging = false;
      let startClientX = 0, startClientY = 0;
      let grabOffsetX = 0, grabOffsetY = 0;

      card.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (!canOperateCard(card, 'move')) return;
        if (e.detail > 1) return;

        const rect = field.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - panOffsetX) / zoom;
        const mouseY = (e.clientY - rect.top - panOffsetY) / zoom;

        startClientX = e.clientX;
        startClientY = e.clientY;
        grabOffsetX = mouseX - (parseFloat(card.style.left || '0') || 0);
        grabOffsetY = mouseY - (parseFloat(card.style.top  || '0') || 0);

        const onMove = (e2) => {
          const dx = e2.clientX - startClientX;
          const dy = e2.clientY - startClientY;
          if (!isDragging) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            isDragging = true;
            card.style.cursor = "grabbing";
            card.style.zIndex = getMaxZIndex() + 1; // 表示のみ
          }
          const x = (e2.clientX - rect.left - panOffsetX) / zoom;
          const y = (e2.clientY - rect.top  - panOffsetY) / zoom;
          card.style.left = `${x - grabOffsetX}px`;
          card.style.top  = `${y - grabOffsetY}px`;
        };
        
        const onUp = async () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          card.style.cursor = "grab";
          if (!isDragging) return;
          isDragging = false;
          const id = card.dataset.cardId;
          const x = parseFloat(card.style.left) || 0;
          const y = parseFloat(card.style.top)  || 0;
          const zIndex = parseInt(card.style.zIndex) || 1;
          updateCardBatched(id, { x, y, zIndex });
          updateOverlapBadges(); //ドラッグ終了で最新化
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
      
      
      // === Touch drag (mobile) ===
      card.addEventListener('touchstart', (e) => {
        if (!canOperateCard(card, 'move')) return;
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        const rect = field.getBoundingClientRect();
        const mouseX = (t.clientX - rect.left - panOffsetX) / zoom;
        const mouseY = (t.clientY - rect.top  - panOffsetY) / zoom;

        startClientX = t.clientX;
        startClientY = t.clientY;
        grabOffsetX = mouseX - (parseFloat(card.style.left || '0') || 0);
        grabOffsetY = mouseY - (parseFloat(card.style.top  || '0') || 0);
        isDragging = false;

        const onMove = (ev) => {
          if (ev.touches.length !== 1) return;
          ev.preventDefault();
          const tt = ev.touches[0];
          const dx = tt.clientX - startClientX;
          const dy = tt.clientY - startClientY;
          if (!isDragging) {
            if (Math.hypot(dx, dy) < 5) return;
            isDragging = true;
            card.style.cursor = "grabbing";
            card.style.zIndex = getMaxZIndex() + 1;
          }
          const x = (tt.clientX - rect.left - panOffsetX) / zoom;
          const y = (tt.clientY - rect.top  - panOffsetY) / zoom;
          card.style.left = `${x - grabOffsetX}px`;
          card.style.top  = `${y - grabOffsetY}px`;
        };
        const onEnd = async () => {
          document.removeEventListener('touchmove', onMove, { passive:false });
          document.removeEventListener('touchend', onEnd);
          document.removeEventListener('touchcancel', onEnd);
          card.style.cursor = "grab";
          if (!isDragging) return;
          isDragging = false;
          const id = card.dataset.cardId;
          const x = parseFloat(card.style.left) || 0;
          const y = parseFloat(card.style.top)  || 0;
          const zIndex = parseInt(card.style.zIndex) || 1;
          updateCardBatched(id, { x, y, zIndex });
          updateOverlapBadges();
        };
        document.addEventListener('touchmove', onMove, { passive:false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
      }, { passive:false });      
      
      
      
      
    }

    function getMaxZIndex(){ let max=0; document.querySelectorAll(".card").forEach(c=>{ const z=parseInt(c.style.zIndex)||0; if(z>max) max=z; }); return max; }


// ★ added: 重なり判定 & バッジ更新 =========================
function rectOfCard(el){
  const left = parseFloat(el.style.left) || 0;
  const top  = parseFloat(el.style.top)  || 0;
  const w = el.offsetWidth  || 0;
  const h = el.offsetHeight || 0;
  return { l:left, t:top, r:left+w, b:top+h };
}
function intersects(a,b){
  // 面積が正に重なるかどうか（辺が接するだけは“重なり”とみなさない）
  return (a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);
}
function unionFind(n){
  const p = Array(n).fill(0).map((_,i)=>i);
  const f = i => p[i]===i ? i : (p[i]=f(p[i]));
  const u = (a,b)=>{ a=f(a); b=f(b); if(a!==b) p[b]=a; };
  return { find:f, unite:u, parent:p };
}
function ensureBadge(el){
  let b = el.querySelector('.overlap-badge');
  if (!b){
    b = document.createElement('div');
    b.className = 'overlap-badge';
    el.appendChild(b);
  }
  return b;
}
function clearBadge(el){
  const b = el.querySelector('.overlap-badge');
  if (b) b.remove();
}

 // 画面上のカードを重なりクラスタごとに分け、各クラスタの「最前面の通常カード」に通常カード枚数を表示
 window.updateOverlapBadges = function(){
   const all = Array.from(document.querySelectorAll('.card'));
   if (all.length === 0) return;
 
   // まず全ての既存バッジを消す（必要なものだけ後で付ける）
   all.forEach(clearBadge);
 
   // 「通常カード」判定（※トークン/各種カウンターはバッジ対象外・カウント対象外）
   const isReal = (el) => !(
     el.classList.contains('token') ||
     el.classList.contains('counter') ||
     el.classList.contains('numcounter')
   );
 
   // 位置とZ
   const rects = all.map(rectOfCard);
   const zList = all.map(el => parseInt(el.style.zIndex || '1', 10) || 1);
 
   // Union-Find で重なりクラスタ化（※ブリッジ防止のため、判定は全要素で行う）
   const uf = unionFind(all.length);
   for (let i=0; i<all.length; i++){
     for (let j=i+1; j<all.length; j++){
       if (intersects(rects[i], rects[j])) uf.unite(i, j);
     }
   }
 
   // root -> indices
   const groups = new Map();
   for (let i=0; i<all.length; i++){
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

window.faceDownAll = async function(){
      const batch = writeBatch(db);
      let count = 0;
      for(const [id, el] of cardDomMap){
        if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
        el.dataset.faceUp = 'false';
        const imgEl = el.querySelector('img'); if (imgEl) imgEl.style.display='none';
        el.style.backgroundColor = '#000';
        batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { faceUp: false });
        if (++count >= 450){ await batch.commit(); count=0; }
      }
      if (count>0) await batch.commit();
      setPreview();
      //postLog('自分のカードをすべて裏にしました');
    }

    window.faceUpAll = async function(){
      const batch = writeBatch(db);
      let count = 0;
      for(const [id, el] of cardDomMap){
        if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
        el.dataset.faceUp = 'true';
        const imgEl = el.querySelector('img'); if (imgEl) imgEl.style.display='block';
        el.style.backgroundColor = '#fff';
        batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { faceUp: true });
        if (++count >= 450){ await batch.commit(); count=0; }
      }
      if (count>0) await batch.commit();
      //postLog('自分のカードをすべて表にしました');
    }

    window.resetMyCardRotation = async function () {
      if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }
      const batch = writeBatch(db);
      let count = 0;
      for (const [id, el] of cardDomMap) {
        if (el.dataset.ownerSeat !== String(CURRENT_PLAYER)) continue;
        el.style.transform = 'rotate(0deg)';
        batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { rotation: 0 });
        if (++count >= 450){ await batch.commit(); count=0; }
      }
      if (count>0) await batch.commit();
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

window.spawnNumberCounter = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {
    alert('ルームに参加してから実行してください'); return;
  }
  try{
    const W = 110, H = 60;
    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, W, H);
    const z = getMaxZIndex() + 50;
    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    await addDoc(baseCol, {
      type: 'numcounter',
      count: 0,               // 初期値
      imageUrl: '',           // 画像は使わない（DOMでUIを構成）
      fullUrl:  '',
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
   
  }catch(e){
    console.error(e);
    alert('数値カウンター作成に失敗しました。');
  }
};
    
    
    
    
    
    
    
// ▼ 置換：6面ダイス処理（中央配置・単一化・最前面・3秒CD）
let lastDiceAt = 0;
/**
 * 6面ダイスを1つだけ生成（3秒クールダウン、クリック/右クリックで自分のもののみ削除）
 */

window.rollD6 = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {
    alert('ルームに参加してから実行してください'); return;
  }
  disableDiceButtons(3000);
  const now = Date.now();
  if (now - lastDiceAt < 3000) return; // 早押しガード
  lastDiceAt = now;

  const btn = document.getElementById('roll-d6-btn');
  if (btn) btn.disabled = true;
  setTimeout(()=>{ if (btn) btn.disabled = false; }, 3000);

  try{
    // 1) 既存の自分のダイスを削除（常に1つだけにする）
    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    const qOld = query(baseCol, where('type','==','dice'), where('ownerSeat','==', CURRENT_PLAYER));
    const oldSnap = await getDocs(qOld);
    if (!oldSnap.empty) {
      const batch = writeBatch(db);
      oldSnap.forEach(d => batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${d.id}`)));
      await batch.commit();
    }

    // 2) 新しい出目
    const val = (Math.random()*6|0) + 1;
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
      fullUrl:  imgUrl,
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
  } catch(e){
    console.error(e);
    alert('ダイス作成に失敗しました。ネットワーク状態を確認してもう一度お試しください。');
  }
};  


  // === 追加: ダイス/コイン系ボタンを一時的に無効化するユーティリティ ===
  function setDiceButtonsDisabled(disabled){
    ['roll-d6-btn','roll-d10-btn','roll-d20-btn','flip-coin-btn'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  }
  function disableDiceButtons(ms=3000){
    setDiceButtonsDisabled(true);
    setTimeout(()=>setDiceButtonsDisabled(false), ms);
  }



// ==== 数字表示の汎用ダイスSVG（D10/D20用） ====
function svgNumberDiceDataUrl(n){
  const size = 72, r = 8;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect x="1" y="1" width="${size-2}" height="${size-2}" rx="${r}" ry="${r}" fill="#fff" stroke="#111" stroke-width="2"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-size="${n >= 10 ? 34 : 40}" font-family="ui-sans-serif, system-ui" fill="#111" font-weight="700">${n}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ==== コインSVG（オモテ／ウラ）：背景を一切敷かず、完全な丸＋透過 ====
function svgCoinDataUrl(face){ // face: 'オモテ' or 'ウラ'
  const size = 72;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs><filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/></filter></defs>
      <!-- 余白なし：丸のみ。背景は透明 -->
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-3}" fill="#ffd54f" stroke="#111" stroke-width="2" filter="url(#s)"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
            font-size="24" font-family="ui-sans-serif, system-ui" fill="#111" font-weight="700">${face}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ==== 既存の自分ダイスを一旦削除して1つに揃える ====
async function resetMyDiceIfAny(){
  const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
  const qOld = query(baseCol, where('type','==','dice'), where('ownerSeat','==', CURRENT_PLAYER));
  const snap = await getDocs(qOld);
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(doc(db, `rooms/${CURRENT_ROOM}/cards/${d.id}`)));
    await batch.commit();
  }
}

// ==== D10 ====
window.rollD10 = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }
  disableDiceButtons(3000);
  try{
    await resetMyDiceIfAny();

    const val = (Math.random()*10|0) + 1;
    const imgUrl = svgNumberDiceDataUrl(val);

    const SIZE = 72;
    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);
    const z = getMaxZIndex() + 100;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl:  imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    postLog(`10面ダイスを振りました → ${val}`);
  }catch(e){
    console.error(e); alert('10面ダイスの作成に失敗しました。');
  }
};

// ==== D20 ====
window.rollD20 = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }
  disableDiceButtons(3000);
  try{
    await resetMyDiceIfAny();

    const val = (Math.random()*20|0) + 1;
    const imgUrl = svgNumberDiceDataUrl(val);
    const SIZE = 72;
    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);
    const z = getMaxZIndex() + 100;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), {
      type: 'dice',
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl:  imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    postLog(`20面ダイスを振りました → ${val}`);
  }catch(e){
    console.error(e); alert('20面ダイスの作成に失敗しました。');
  }
};

// ==== コイン ====
window.flipCoin = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }
  disableDiceButtons(3000);
  try{
    await resetMyDiceIfAny();

    const isHeads = Math.random() < 0.5;
    const faceJP  = isHeads ? 'オモテ' : 'ウラ';
    const val     = isHeads ? 1 : 2;   // 便宜的に 1=表, 2=裏
    const imgUrl  = svgCoinDataUrl(faceJP);

    const SIZE = 72;
    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, SIZE, SIZE);
    const z = getMaxZIndex() + 100;

    await addDoc(collection(db, `rooms/${CURRENT_ROOM}/cards`), {
      type: 'dice',          // 既存の .card.dice の見た目/削除挙動に合わせる
      diceKind: 'coin',      // ← コイン判定用フラグを保存
      diceValue: val,
      imageUrl: imgUrl,
      fullUrl:  imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    postLog(`コイントス → ${faceJP}`);
  }catch(e){
    console.error(e); alert('コインの作成に失敗しました。');
  }
};



    
    
    
// ===============================
// カウンター生成（+1 / +10 / -1 / -10 など）
// ===============================
function svgCounterDataUrl(label){
  const size = 60;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <filter id="s">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/>
        </filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-3}" fill="#ffffff" stroke="#111" stroke-width="2" filter="url(#s)"/>
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
const TRUMP_IMG_BASE = 'TrumpPicture';                 // ← ルートフォルダ（バックスラッシュではなくスラッシュで参照）
const TRUMP_BACK_URL = `${TRUMP_IMG_BASE}/back.png`;   // ← 今回は表裏トグル時の裏表示は背景黒を使用するため未使用
const JOKER_URL      = `${TRUMP_IMG_BASE}/joker.png`;

function centerOfBoardDeck(w, h){
  const r = getDeckBoundsForSeat(1); // boardモード時は共有デッキ（seatはダミー）
  if (!r) return { x: 0, y: 0 };
  const x = Math.round(r.minX + (r.width  - w)/2);
  const y = Math.round(r.minY + (r.height - h)/2);
  return { x, y };
}

function buildTrumpFrontUrl(suit, rank){
  // ファイル命名: spade_A.png / heart_10.png / diamond_Q.png / club_K.png
  return `${TRUMP_IMG_BASE}/${suit}_${rank}.png`;
}

async function spawnTrumpDeck(roomId){
  // 52枚（spade/heart/diamond/club × A,2..10,J,Q,K）を生成。全て裏向き（faceUp:false）
  const SUITS = ['spade','heart','diamond','club'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  // レイアウト確定を待ってから中心を測る（ズレ防止）
  await waitForBoardDeckRect();
  const { x, y } = centerOfBoardDeck(CARD_W, CARD_H);
  let z = getMaxZIndex() + 1;

  const col = collection(db, `rooms/${roomId}/cards`);
  let batch = writeBatch(db);
  let count = 0;

  for (const s of SUITS){
    for (const r of RANKS){
      const url = buildTrumpFrontUrl(s, r);
      const ref = doc(col);
      batch.set(ref, {
        imageUrl: url,      // 表面画像（裏向き開始なので最初は非表示）
        fullUrl:  url,
        x, y, zIndex: z++,
        faceUp: false,      // ← 裏向きで開始（既存実装では img を隠し、背景を黒で表現）
        ownerUid: null,     // 共有物
        ownerSeat: null,    // 共有物
        rotation: 0,
        visibleToAll: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
   }
  }

  // Joker を2枚、山の一番上として追加（同じバッチで）
  for (let j = 0; j < 2; j++) {
    const ref = doc(col);
    batch.set(ref, {
      imageUrl: JOKER_URL,
      fullUrl:  JOKER_URL,
      x, y, zIndex: z++,   // 既存の z の続き＝最前面
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



window.spawnCounter = async function(label){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {
    alert('ルームに参加してから実行してください'); return;
  }
  try{
    const imgUrl = svgCounterDataUrl(label || '+1');
    const { x, y } = centerOfMainPlay(CURRENT_PLAYER, 60, 60); // 自エリア中央付近
    const z = getMaxZIndex() + 50;
    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    await addDoc(baseCol, {
      type: 'counter',
      imageUrl: imgUrl,
      fullUrl:  imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }catch(e){
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

function blankTokenThumb(){
  // 120x160 の薄枠だけ付けたサムネ（imgは非表示になるが念のため）
  const w=120,h=160;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="10" ry="10"
            fill="#ffffff" stroke="#ddd" stroke-width="2"/>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
//
// テキストトークン（メモ）を生成して自エリア内のランダム位置へ配置
//

window.spawnToken = async function(){
  if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID) {
    alert('ルームに参加してから実行してください'); return;
  }
  try{
    const { x, y } = randomPointInMainPlay(CURRENT_PLAYER);
    const z = getMaxZIndex() + 20;
    const imgUrl = blankTokenThumb();
    const baseCol = collection(db, `rooms/${CURRENT_ROOM}/cards`);
    await addDoc(baseCol, {
      type: 'token',
      tokenText: '',
      imageUrl: imgUrl,
      fullUrl:  imgUrl,
      x, y, zIndex: z,
      faceUp: true,
      ownerUid: CURRENT_UID,
      ownerSeat: CURRENT_PLAYER,
      rotation: 0,
      visibleToAll: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }catch(e){
    console.error(e);
    alert('トークン作成に失敗しました。');
  }
};
    
    
    
    
    window.deleteMyCards = async function(){
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
    const cardListGrid  = document.getElementById('card-list-grid');
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
    const card = getCurrentlySelectedCard();
    if (!card) { alert('赤枠の「指定カード」を選んでください'); return; }

    // 自分のカードかチェック（ownerUid / ownerSeat）
    const ownerUid  = card.dataset.ownerUid || null;
    const ownerSeat = card.dataset.ownerSeat || null;
    const isMine = (ownerUid && ownerUid === CURRENT_UID) || (ownerSeat && String(ownerSeat) === String(CURRENT_PLAYER));
    if (!isMine) { alert('自分のカードではありません'); return; }

    const id = card.dataset.cardId;
    if (!id) return;

    // Firestore から削除
    await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`));

    // 画面からも除去
    const el = cardDomMap.get(id);
    if (el) { el.remove(); cardDomMap.delete(id); }
    fullImageStore?.delete?.(id);
    if (window.previewImg) { setPreview(); }
    postLog('選択中のカードを削除しました');

  } catch (e) {
    console.error(e);
    alert('削除に失敗しました。ネットワーク状況を確認して再度お試しください。');
  }
};



 // 現在選択中のカードを安全に取得（selectedCard / window.selectedCard / DOM を順に見る）
 function getCurrentlySelectedCard(){
   // グローバルでないスコープにある selectedCard も拾えるように typeof で存在確認
   const localSel = (typeof selectedCard !== 'undefined') ? selectedCard : null;
   return localSel || window.selectedCard || document.querySelector('.card.selected') || null;
 }


// === 指定カードを最背面へ（自分のカード限定） ===
window.sendSelectedToBack = async function () {
  try {
    if (!CURRENT_ROOM || !CURRENT_UID) { alert('ルームに参加してから実行してください'); return; }
    const card = getCurrentlySelectedCard();
    if (!card) { alert('赤枠の「指定カード」を選んでください'); return; }

    // 自分のカードかチェック
    const ownerUid  = card.dataset.ownerUid || null;
    const ownerSeat = card.dataset.ownerSeat || null;
    const isMine = (ownerUid && ownerUid === CURRENT_UID) || (ownerSeat && String(ownerSeat) === String(CURRENT_PLAYER));
    if (!isMine) { alert('自分のカードではありません'); return; }

    const id = card.dataset.cardId;
    if (!id) return;

    // 画面上に存在する zIndex の最小値を探す
    let minZ = Infinity;
    cardDomMap.forEach(el => {
      const z = parseInt(el.style.zIndex || '1', 10);
      if (!Number.isNaN(z) && z < minZ) minZ = z;
    });
    if (!isFinite(minZ)) minZ = 1;

    // 一番下になるように さらに -1
    const newZ = minZ - 1;

    // 表示を先に更新（体感即時）
    card.style.zIndex = newZ;

    // Firestore へも反映（バッチ最適化経由）
    updateCardBatched(id, { zIndex: newZ });
    
    postLog('選択中のカードを最背面に送りました');
    

  } catch (e) {
    console.error(e);
    alert('最背面化に失敗しました。');
  }
};  
    
    
    
    window.openMyCardsDialog = function(){
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
        mine.forEach(({id, src}) => {
          const item = document.createElement('div');
          item.style.cssText = 'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';
          item.title = id;
          const img = document.createElement('img');
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

    function closeMyCardsDialog(){ cardListModal.style.display = 'none'; }
    cardListClose?.addEventListener('click', closeMyCardsDialog);
    cardListModal?.addEventListener('click', (e) => { if (e.target === cardListModal) closeMyCardsDialog(); });

    async function focusCardById(cardId){
      const el = cardDomMap.get(cardId) || document.querySelector(`[data-card-id="${cardId}"]`);
      if (!el) return;
      const newZ = getMaxZIndex() + 1;
      el.style.zIndex = newZ; // 表示だけ（サーバーへは書かない）
      if (selectedCard) selectedCard.classList.remove('selected');
      el.classList.add('selected');
      selectedCard = el;
      const full = fullImageStore.get(cardId);
      const thumbEl = el.querySelector('img');
      const isFaceUp = el.dataset.faceUp === 'true';
      const otherHand = isOtherPlayersHandCard(el);
      const frontSrc = full || (thumbEl && thumbEl.src) || '';
      const previewSrc = (!isFaceUp || otherHand)
        ? getSeatBackUrl(ownerSeat)
        : frontSrc;
      setPreview(previewSrc);
      
      const ownerPlayerNum = el.dataset.ownerSeat ? `P${el.dataset.ownerSeat}` : '?';
      previewInfo.textContent = `カードのオーナー: ${ownerPlayerNum} / あなた: P${CURRENT_PLAYER || "?"}`;
    }
    
    
    
    
    //自分の「デッキエリア内カード」だけを一覧表示
  window.openMyDeckCardsDialog = function(){
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
      const top  = parseFloat(el.style.top)  || 0;
      const cx = left + CARD_W/2;
      const cy = top  + CARD_H/2;
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
      listed.forEach(({id, src}) => {
        const item = document.createElement('div');
        item.style.cssText =
          'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';
        item.title = id;
        const img = document.createElement('img');
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
    
    
    
window.openMyDiscardCardsDialog = function(){
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
    const top  = parseFloat(el.style.top)  || 0;
    const cx   = left + CARD_W/2;
    const cy   = top  + CARD_H/2;
    if (cx >= discardRect.minX && cx <= discardRect.minX + discardRect.width &&
        cy >= discardRect.minY && cy <= discardRect.minY + discardRect.height) {
      const imgEl = el.querySelector('img');
      const src   = fullImageStore.get(id) || (imgEl ? imgEl.src : '');
      listed.push({ id, src });
    }
  }

  if (listed.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '捨て札エリア内にカードがありません。';
    empty.style.cssText = 'color:#666;font-size:14px;text-align:center;padding:24px 12px;';
    cardListGrid.appendChild(empty);
  } else {
    listed.forEach(({id, src}) => {
      const item = document.createElement('div');
      item.style.cssText = 'border:1px solid #ddd;border-radius:10px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fafafa;';
      item.title = id;
      const img = document.createElement('img');
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
    
    
    
    
    

    window.toggleFieldSizeOptions = function(){ fieldSizeOptions.style.display = fieldSizeOptions.style.display==="none"?"block":"none"; }
    window.setFieldSize = function(size){ const sizes={ small:[3000,1500], medium:[5000,2500], large:[10000,5000] }; const [w,h]=sizes[size]||sizes.small; field.style.width=`${w}px`; field.style.height=`${h}px`; field.style.transform=`translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`; }
    window.shuffleDecks = async function(){
      if(!CURRENT_ROOM || !CURRENT_PLAYER) return;
      const srcBounds = getDeckBoundsForSeat(CURRENT_PLAYER);
      if(!srcBounds){ alert('あなたのデッキエリアが見つかりません'); return; }
      const targets = getCardsInsideRect(srcBounds);
      if(targets.length === 0) return;
      shuffleArray(targets);
      const dstBounds = getDeckBoundsForSeat(CURRENT_PLAYER);
      if(!dstBounds){ alert('あなたのデッキエリアが見つかりません'); return; }
      const centerX = Math.round(dstBounds.minX + (dstBounds.width  - CARD_W)/2);
      const centerY = Math.round(dstBounds.minY + (dstBounds.height - CARD_H)/2);
      const baseZ = getMaxZIndex() + 1;
      let z = baseZ;
      // バッチで位置/zIndexをまとめ書き
      let batch = writeBatch(db); let count = 0;
      for(const { id, el } of targets){
        el.style.left = `${centerX}px`;
        el.style.top  = `${centerY}px`;
        el.style.zIndex = z++;
        batch.update(doc(db, `rooms/${CURRENT_ROOM}/cards/${id}`), { x: centerX, y: centerY, zIndex: parseInt(el.style.zIndex) || z });
        if (++count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count>0) await batch.commit();
      updateOverlapBadges(); //一括移動のあとに最新化
      postLog('デッキをシャッフルしました');
    };


// ===============================
// フィールド操作（パン/ズーム/選択解除）
// ===============================
// フィールドのパン/ズーム/選択解除、タッチピンチ/パンのハンドラを登録
//

function bindPanZoomHandlers(){
      // === マウスホイールズーム
      field.addEventListener("wheel", e => {
        if(e.ctrlKey) return;
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
      }, { passive:false });

      // === マウス1本パン
      container.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        if (e.detail > 1) return;
        if (e.target.closest(".card")) return;
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
      let touchMode = { type:null, startDist:0, startZoom:zoom, startPanX:0, startPanY:0, cx:0, cy:0, sx:0, sy:0 };

      const getDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const getCenter = (t1, t2) => ({ x:(t1.clientX + t2.clientX)/2, y:(t1.clientY + t2.clientY)/2 });

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
      }, { passive:false });

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
      }, { passive:false });

      const endTouch = () => { touchMode.type = null; };
      container.addEventListener('touchend', endTouch);
      container.addEventListener('touchcancel', endTouch);

      // === 余白クリックで選択解除
      field.addEventListener("click", () => {
        if (selectedCard) {
          selectedCard.classList.remove("selected");
          selectedCard = null;
          setPreview();
        }
      });
    }




// ===== end room button
// ===============================
// ルーム終了ボタンの制御
// ===============================
    function updateEndRoomButtonVisibility(){
      const isHostUid = !!(CURRENT_ROOM_META?.hostUid && CURRENT_UID && CURRENT_ROOM_META.hostUid === CURRENT_UID);
      const isHostSeat = !!(CURRENT_ROOM_META?.hostSeat && CURRENT_PLAYER && CURRENT_ROOM_META.hostSeat === CURRENT_PLAYER);
      const show = !!(CURRENT_ROOM && isHostUid && isHostSeat);
      if (endRoomBtn) endRoomBtn.style.display = show ? 'block' : 'none';
      if (hostOtherOpsWrap) hostOtherOpsWrap.style.display = show ? 'block' : 'none';
    }
    endRoomBtn?.addEventListener('click', async () => {
      if (!(CURRENT_ROOM && CURRENT_ROOM_META?.hostUid === CURRENT_UID && CURRENT_ROOM_META?.hostSeat === CURRENT_PLAYER)) {
        alert('この操作は、ホスト座席に座ったホストのみ実行できます。');
        return;
      }
      if (!confirm('ルームを終了します。全カードと座席情報が削除され、全員が退出します。よろしいですか？')) return;

      endRoomBtn.disabled = true;
      const old = endRoomBtn.textContent;
      endRoomBtn.textContent = '終了中...';

    try{
      // 1) 先に全て止める（復活防止）
      try { stopHostHeartbeat(); } catch (_){}
      try { stopHeartbeat(); } catch (_){}
      try { stopHostWatch(); } catch (_){}
      try { if (unsubscribeCards)    { unsubscribeCards();    unsubscribeCards    = null; } } catch(_){}
      try { if (unsubscribeSeats)    { unsubscribeSeats();    unsubscribeSeats    = null; } } catch(_){}
      try { if (unsubscribeRoomDoc)  { unsubscribeRoomDoc();  unsubscribeRoomDoc  = null; } } catch(_){}
      
      // UIを即時クリア（DBは既に消えるがDOMが残らないように）
      clearFieldDOM();      
      
      // 2) Firestore 側を完全掃除（cards / seats 全削除 → 親doc削除）
      await cleanupAndDeleteRoom(CURRENT_ROOM);
      
      
        CURRENT_ROOM = null;
        CURRENT_PLAYER = null;
        sessionIndicator.textContent = 'ROOM: - / PLAYER: -';
        lobby.style.display = 'flex';
        alert('ルームを終了しました。');
      } catch (e) {
        console.error(e);
        alert('ルームの終了に失敗しました。ネットワークをご確認のうえ再試行してください。');
      } finally {
        endRoomBtn.disabled = false;
        endRoomBtn.textContent = old;   // ← 復帰を追加
        updateEndRoomButtonVisibility();
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
  const btn   = document.getElementById('toggle-chat');
  if (!panel || !btn) return;
  const hide = panel.style.display !== 'none' ? true : false;
  panel.style.display = hide ? 'none' : '';
  btn.textContent = hide ? '▶' : '◀';
});



function initializePlayField(){
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
    
    
//▼デッキ中央（w,h考慮）を返す
function centerOfDeck(seat, w, h){
  const b = getDeckBoundsForSeat(seat); // board/trumpなら共有デッキ、通常は自席デッキ
  if (!b) return { x: 0, y: 0 };
  const x = Math.round(b.minX + (b.width  - (w||0)) / 2);
  const y = Math.round(b.minY + (b.height - (h||0)) / 2);
  return { x, y };
}
    
    
    // render helpers
    function updateEndRoomButtonVisibilityWrapper(){ updateEndRoomButtonVisibility(); }
    


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

  // カウンター / トークン
  spawnNumberCounter,
  spawnCounter,
  spawnToken,

  // フィールドサイズUI
  toggleFieldSizeOptions,
  setFieldSize,
  // 背面画像ピッカー起動
  openBackImagePicker,  
});


// === 背面画像のアップロード／保存 ===
function openBackImagePicker(){
  const input = document.getElementById('card-back-input');
  if (!input) return;
  input.value = '';
  input.click();
}

// ファイル選択時の処理（1枚だけ採用）
(function bindBackImageInput(){
  const input = document.getElementById('card-back-input');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!CURRENT_ROOM || !CURRENT_PLAYER || !CURRENT_UID){
      alert('ルームに参加してから実行してください'); return;
    }
    try{
      // Storage: rooms/{room}/seats/{seat}/card-back.jpg
      const storage = getStorage();
      const path    = `rooms/${CURRENT_ROOM}/seats/${CURRENT_PLAYER}/card-back.jpg`;
      const sref    = ref(storage, path);
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
    }catch(err){
      console.error('back image upload/save failed', err);
      alert('カード背面画像の保存に失敗しました。通信状況をご確認ください。');
    }
  });
})();



