/**
 * Lobby module for BatriTable
 * Handles room creation, joining, and authentication
 */

import {
  auth, db,
  signInAnonymously, onAuthStateChanged,
  onIdTokenChanged, getIdToken,
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp, collection,
  query, getDocs, writeBatch, Timestamp
} from './firebase.init.js';

import { getLimits } from './premium.js';
import { t, initI18n, applyI18n } from './i18n.js';
import { sha256Hex } from './utils.js';

// === State ===
let CURRENT_UID = null;
let AUTH_ID_TOKEN = null;
let IS_PREMIUM = false;
let CREATE_FIELD_MODE = 'card';
let TEMP_CREATE_ROOM_ID = '';
let TEMP_CREATE_CREATOR_NAME = '';
let CURRENT_LAYOUT_SELECTION = 'standard';

// === DOM Elements ===
const loginGoBtn = document.getElementById('login-go-btn');
const logoutBtn = document.getElementById('logout-google');
const mypageBtn = document.getElementById('btn-mypage');
const whoamiSpan = document.getElementById('whoami');
const authFormArea = document.getElementById('auth-form-area');
const authLoggedinArea = document.getElementById('auth-loggedin-area');
const authIndicator = document.getElementById('auth-indicator');

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

const newRoomIdInput = document.getElementById('new-room-id');
const newRoomPassInput = document.getElementById('new-room-pass');
const newPlayerNameInput = document.getElementById('new-player-name');
const newPlayerCountSelect = document.getElementById('new-player-count');
const createRoomBtn = document.getElementById('create-room-btn');

const joinRoomIdInput = document.getElementById('join-room-id');
const joinRoomPassInput = document.getElementById('join-room-pass');
const playerNameInput = document.getElementById('player-name');
const startBtn = document.getElementById('start-btn');

const pickModeCardBtn = document.getElementById('pick-mode-card');
const pickModeBoardBtn = document.getElementById('pick-mode-board');

// === Initialization ===
async function init() {
  initI18n();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      CURRENT_UID = user.uid;
      // 匿名ログインIDを記憶する
      if (user.isAnonymous) {
        localStorage.setItem('pa:last-anon-uid', user.uid);
      }

      whoamiSpan.textContent = user.displayName || user.email || 'Anonymous';
      
      // 匿名ログイン時は「ログイン」ボタンのみ表示し、ログアウト／マイページは隠す
      if (user.isAnonymous) {
        authFormArea.style.display = 'block';
        authLoggedinArea.style.display = 'none';
      } else {
        authFormArea.style.display = 'none';
        authLoggedinArea.style.display = 'block';
      }
      
      // Load stored player name if exists
      if (!newPlayerNameInput.value) newPlayerNameInput.value = localStorage.getItem('pa:last-player-name') || '';
      if (!playerNameInput.value) playerNameInput.value = localStorage.getItem('pa:last-player-name') || '';
    } else {
      CURRENT_UID = null;
      authFormArea.style.display = 'block';
      authLoggedinArea.style.display = 'none';
      // Auto anonymous sign-in if not logged in
      try { await signInAnonymously(auth); } catch (e) { console.error('Auth error', e); }
    }
    updateAuthIndicator(user);
    updateStartButtonState();
  });

  onIdTokenChanged(auth, async (user) => {
    AUTH_ID_TOKEN = user ? await getIdToken(user, true) : null;
  });

  // Event Listeners
  pickModeCardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'card'; updateModePickButtons(); });
  pickModeBoardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'board'; updateModePickButtons(); });
  
  createRoomBtn?.addEventListener('click', handleCreateRoom);
  startBtn?.addEventListener('click', handleJoinRoom);
  
  logoutBtn?.addEventListener('click', () => auth.signOut());

  [joinRoomIdInput, playerNameInput].forEach(el => {
    el?.addEventListener('input', updateStartButtonState);
  });

  document.getElementById('field-layout-ok')?.addEventListener('click', () => {
    executeRoomCreation(CURRENT_LAYOUT_SELECTION || 'standard');
  });
  document.getElementById('field-layout-cancel')?.addEventListener('click', () => {
    document.getElementById('field-layout-modal').style.display = 'none';
  });

  document.getElementById('anon-warning-ok')?.addEventListener('click', () => {
    document.getElementById('anon-warning-modal').style.display = 'none';
    showLayoutModal();
  });
  document.getElementById('anon-warning-cancel')?.addEventListener('click', () => {
    document.getElementById('anon-warning-modal').style.display = 'none';
  });

  updateModePickButtons();
}

function updateStartButtonState() {
  const room = (joinRoomIdInput.value || '').trim();
  const name = (playerNameInput.value || '').trim();
  if (startBtn) startBtn.disabled = !(room && name);
}

function updateModePickButtons() {
  const set = (btn, on) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
    btn.classList.toggle('secondary', !on);
  };
  set(pickModeCardBtn, CREATE_FIELD_MODE === 'card');
  set(pickModeBoardBtn, CREATE_FIELD_MODE === 'board');
}

window.selectLayoutOption = function(type) {
  CURRENT_LAYOUT_SELECTION = type;
  const opts = document.querySelectorAll('.layout-option');
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
  });
};

async function handleCreateRoom() {
  await ensureAuthReady();
  TEMP_CREATE_ROOM_ID = (newRoomIdInput.value || '').trim();
  TEMP_CREATE_CREATOR_NAME = (newPlayerNameInput.value || '').trim();
  
  if (!TEMP_CREATE_ROOM_ID) { alert(t('err.roomId')); return; }
  if (!TEMP_CREATE_CREATOR_NAME) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }

  // Store name
  localStorage.setItem('pa:last-player-name', TEMP_CREATE_CREATOR_NAME);

  if (auth.currentUser?.isAnonymous) {
    document.getElementById('anon-warning-modal').style.display = 'flex';
  } else {
    showLayoutModal();
  }
}

function showLayoutModal() {
  if (CREATE_FIELD_MODE === 'card' || CREATE_FIELD_MODE === 'board') {
    const simpleImg = document.getElementById('layout-img-simple');
    const standardImg = document.getElementById('layout-img-standard');
    if (simpleImg && standardImg) {
      if (CREATE_FIELD_MODE === 'card') {
        simpleImg.src = 'image/Field_simple_type.png';
        standardImg.src = 'image/Field_standard_type.png';
      } else {
        simpleImg.src = 'image/board simple.png';
        standardImg.src = 'image/board standard.png';
      }
    }
    window.selectLayoutOption('standard');
    document.getElementById('field-layout-modal').style.display = 'flex';
  } else {
    executeRoomCreation('standard');
  }
}

async function executeRoomCreation(layoutType) {
  const modal = document.getElementById('field-layout-modal');
  if (modal) modal.style.display = 'none';

  const id = TEMP_CREATE_ROOM_ID;
  const creatorName = TEMP_CREATE_CREATOR_NAME;

  createRoomBtn.disabled = true;
  const oldText = createRoomBtn.textContent;
  createRoomBtn.textContent = '作成中...';

  try {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('Auth not ready'); createRoomBtn.disabled = false; createRoomBtn.textContent = oldText; return; }

    const passRaw = (newRoomPassInput?.value || '').trim();
    const joinPassHash = passRaw ? await sha256Hex(passRaw) : null;

    const roomRef = doc(db, `rooms/${id}`);
    const existsSnap = await getDoc(roomRef);
    const roomData = existsSnap.exists() ? existsSnap.data() : null;
    const lastAnonUid = localStorage.getItem('pa:last-anon-uid');
    const isRecentlySameHost = roomData && lastAnonUid && roomData.hostUid === lastAnonUid;

    // Room takeover logic (simplified from game.module.js)
    if (roomData && (roomData.hostUid !== uid || roomData.roomClosed === true)) {
       // Check if someone is alive
       const seatDocs = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(n => getDoc(doc(db, `rooms/${id}/seats/${n}`))));
       const someoneAlive = seatDocs.some(s => {
         if (!s.exists()) return false;
         const d = s.data();
         const hb = d.heartbeatAt?.toMillis ? d.heartbeatAt.toMillis() : 0;
         return !!d.claimedByUid && (Date.now() - hb) <= 15000;
       });

       // 匿名ログインIDと一致する場合、または自分がホストの場合は、生存チェックをパスしてAPI呼び出し（リセット）へ進ませる
       const shouldBlock = someoneAlive && roomData.hostUid !== uid && !isRecentlySameHost;

       if (shouldBlock) {
         alert('このルームIDは他のホストが使用中です。');
         createRoomBtn.disabled = false;
         createRoomBtn.textContent = oldText;
         return;
       }

       // Takeover API call
       try {
         const res = await fetch('/api/takeover-room', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ roomId: id, idToken: AUTH_ID_TOKEN })
         });
         if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || 'Takeover failed');
         }
       } catch (e) {
         console.warn('Takeover failed', e);
         alert(e.message || 'ルームの引き継ぎに失敗しました。');
         createRoomBtn.disabled = false;
         createRoomBtn.textContent = oldText;
         return;
       }
    }

    const payload = {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      hostUid: uid,
      hostDisplayName: creatorName,
      hostPhotoURL: auth.currentUser.photoURL || null,
      hostIsAnonymous: auth.currentUser.isAnonymous,
      roomClosed: false,
      fieldMode: CREATE_FIELD_MODE,
      fieldLayout: layoutType || 'standard',
      joinPassHash: joinPassHash,
      hasPassword: !!joinPassHash,
      playerCount: parseInt(newPlayerCountSelect?.value || '4', 10),
      roomName: id, // デフォルトはID
    };

    // 匿名ユーザー（ゲスト）の場合のみ、24時間で削除される有効期限を設定
    if (auth.currentUser?.isAnonymous) {
      payload.expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      // ログイン済みユーザーの場合は期限を設けない（もし既存ルームの上書きなら明示的に削除）
      payload.expiresAt = null;
    }

    await setDoc(roomRef, payload, { merge: true });
    
    // Reset room state (stub from game.module.js logic)
    // Note: resetRoomState is complex, but on creation it's often fine to just overwrite.
    // In a real app we might want to call a function to clear subcollections.
    
    // Redirect to game
    window.location.href = `game.html?id=${encodeURIComponent(id)}`;

  } catch (e) {
    console.error('Create room failed', e);
    alert('失敗しました: ' + e.message);
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = oldText;
  }
}

async function handleJoinRoom() {
  const id = (joinRoomIdInput.value || '').trim();
  const name = (playerNameInput.value || '').trim();
  const pass = (joinRoomPassInput.value || '').trim();

  if (!id || !name) return;

  // Store name
  localStorage.setItem('pa:last-player-name', name);

  startBtn.disabled = true;
  const oldText = startBtn.textContent;
  startBtn.textContent = '確認中...';

  try {
    const roomSnap = await getDoc(doc(db, `rooms/${id}`));
    if (!roomSnap.exists()) {
      alert('ルームが見つかりません。');
      startBtn.disabled = false;
      startBtn.textContent = oldText;
      return;
    }
    const meta = roomSnap.data();
    
    if (meta.joinPassHash) {
      if (!pass) {
        alert('パスワードを入力してください。');
        startBtn.disabled = false;
        startBtn.textContent = oldText;
        return;
      }
      const hash = await sha256Hex(pass);
      if (hash !== meta.joinPassHash) {
        alert('パスワードが違います。');
        startBtn.disabled = false;
        startBtn.textContent = oldText;
        return;
      }
    }

    // Redirect to game
    window.location.href = `game.html?id=${encodeURIComponent(id)}`;
  } catch (e) {
    console.error('Join failed', e);
    alert('入室に失敗しました。');
    startBtn.disabled = false;
    startBtn.textContent = oldText;
  }
}

async function ensureAuthReady(timeoutMs = 8000) {
  if (auth.currentUser) return;
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (auth.currentUser || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

// Start
init();
