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
let CURRENT_OFFICIAL_SELECTION = 'trump';

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
const pickModeOfficialBtn = document.getElementById('pick-mode-official');

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

      console.log('[AuthDebug] User in Lobby:', user.email, 'Verified:', user.emailVerified);

      // --- NEW: メール確認 & アカウント有効化チェック ---
      if (!user.isAnonymous) {
        // パスワード認証の場合のみメール確認をチェック
        if (user.providerData.some(p => p.providerId === 'password') && !user.emailVerified) {
          console.warn('[Auth] Email not verified. Redirecting to login.');
          location.href = './login.html';
          return;
        }

        // 全ての非匿名ユーザーに対して、Firestore レコードがない場合は作成（アカウント有効化）
        try {
          const userDocRef = doc(db, `users/${user.uid}`);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) {
            console.log('[Auth] Creating new user record (Activation)');
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'Player',
              photoURL: user.photoURL || null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              emailVerified: user.emailVerified || false
            });
          }
        } catch (e) {
          console.error('[Auth] Activation failed:', e);
        }
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
    updateGuestLimitUI();
  });

  onIdTokenChanged(auth, async (user) => {
    AUTH_ID_TOKEN = user ? await getIdToken(user, true) : null;
  });

  // Event Listeners
  pickModeCardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'card'; updateModePickButtons(); });
  pickModeBoardBtn?.addEventListener('click', () => { CREATE_FIELD_MODE = 'board'; updateModePickButtons(); });
  pickModeOfficialBtn?.addEventListener('click', () => {
    CREATE_FIELD_MODE = 'official';
    updateModePickButtons();
  });
  
  createRoomBtn?.addEventListener('click', handleCreateRoom);
  startBtn?.addEventListener('click', handleJoinRoom);
  
  logoutBtn?.addEventListener('click', () => auth.signOut());

  [joinRoomIdInput, playerNameInput].forEach(el => {
    el?.addEventListener('input', updateStartButtonState);
  });

  document.getElementById('field-layout-ok')?.addEventListener('click', () => {
    let sel = CURRENT_LAYOUT_SELECTION || 'standard1';
    if (CREATE_FIELD_MODE === 'board') {
      sel = (sel === 'simple1' || sel === 'simple') ? 'simple' : 'standard';
    }
    executeRoomCreation(sel);
  });
  document.getElementById('field-layout-cancel')?.addEventListener('click', () => {
    document.getElementById('field-layout-modal').style.display = 'none';
  });

  document.getElementById('official-game-ok')?.addEventListener('click', () => {
    CREATE_FIELD_MODE = CURRENT_OFFICIAL_SELECTION;
    document.getElementById('official-game-modal').style.display = 'none';
    // Trump uses standard layout (deck/discard areas), Chess uses playonly (board only)
    const layout = (CURRENT_OFFICIAL_SELECTION === 'chess') ? 'playonly' : 'standard';
    executeRoomCreation(layout);
  });
  document.getElementById('official-game-cancel')?.addEventListener('click', () => {
    document.getElementById('official-game-modal').style.display = 'none';
  });

  document.getElementById('anon-warning-ok')?.addEventListener('click', () => {
    document.getElementById('anon-warning-modal').style.display = 'none';
    showLayoutModal();
  });
  document.getElementById('anon-warning-cancel')?.addEventListener('click', () => {
    document.getElementById('anon-warning-modal').style.display = 'none';
  });

  document.getElementById('guest-limit-cancel')?.addEventListener('click', () => {
    document.getElementById('guest-limit-modal').style.display = 'none';
  });
  document.getElementById('guest-limit-login-btn')?.addEventListener('click', () => {
    window.location.href = './login.html';
  });

  updateModePickButtons();
  updateGuestLimitUI();
  setInterval(updateGuestLimitUI, 60000); // 1分毎に残り時間を自動更新
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
  set(pickModeOfficialBtn, CREATE_FIELD_MODE === 'official' || CREATE_FIELD_MODE === 'trump' || CREATE_FIELD_MODE === 'chess');
}

window.selectOfficialOption = function(type) {
  CURRENT_OFFICIAL_SELECTION = type;
  const opts = document.querySelectorAll('.official-option');
  opts.forEach(opt => {
    const isActive = opt.id === `official-opt-${type}`;
    opt.classList.toggle('active', isActive);
    
    const wrap = opt.querySelector('.layout-preview-wrap');
    if (wrap) {
      wrap.style.borderColor = isActive ? '#2d8' : '#eee';
    }
    
    const label = opt.querySelector('.layout-label');
    if (label) {
      label.style.color = isActive ? '#2d8' : '#555';
    }
    
    const overlay = opt.querySelector('.selection-overlay');
    if (overlay) {
      overlay.style.opacity = isActive ? '1' : '0';
    }
  });
};

window.selectLayoutOption = function(type) {
  const normType = (type === 'standard') ? 'standard1' : (type === 'simple') ? 'simple1' : (type || 'standard1');
  CURRENT_LAYOUT_SELECTION = normType;
  const opts = document.querySelectorAll('.layout-option');
  opts.forEach(opt => {
    const isActive = opt.id === `layout-opt-${normType}`;
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

// === ゲスト（未ログイン）向けルーム作成制限（24時間に1回） ===
const GUEST_ROOM_LIMIT_MS = 24 * 60 * 60 * 1000; // 24時間

/**
 * ゲストユーザーの作成制限状態を取得
 * @returns {Promise<{ isLimited: boolean, remainingMs: number, formattedRemaining: string }>}
 */
async function getGuestCreateLimitStatus() {
  const user = auth.currentUser;
  // ログイン済み（非匿名）ユーザーは回数制限なし
  if (user && !user.isAnonymous) {
    return { isLimited: false, remainingMs: 0, formattedRemaining: '' };
  }

  let lastCreatedAt = 0;

  // 1. localStorage から確認
  const localStr = localStorage.getItem('pa:last-guest-room-created-at');
  if (localStr) {
    const t = parseInt(localStr, 10);
    if (!isNaN(t) && t > lastCreatedAt) {
      lastCreatedAt = t;
    }
  }

  // 2. 匿名ユーザーの Firestore レコード（users/{uid}）から確認
  if (user && user.isAnonymous) {
    try {
      const uSnap = await getDoc(doc(db, `users/${user.uid}`));
      if (uSnap.exists()) {
        const d = uSnap.data();
        const firestoreTime = d.lastRoomCreatedAt?.toMillis ? d.lastRoomCreatedAt.toMillis() : (d.lastRoomCreatedAt || 0);
        if (firestoreTime > lastCreatedAt) {
          lastCreatedAt = firestoreTime;
          localStorage.setItem('pa:last-guest-room-created-at', lastCreatedAt.toString());
        }
      }
    } catch (err) {
      console.warn('[Limit] Firestore check failed:', err);
    }
  }

  if (lastCreatedAt > 0) {
    const elapsed = Date.now() - lastCreatedAt;
    if (elapsed < GUEST_ROOM_LIMIT_MS) {
      const remainingMs = GUEST_ROOM_LIMIT_MS - elapsed;
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      const formattedRemaining = `${hours}時間${minutes}分`;
      return { isLimited: true, remainingMs, formattedRemaining };
    }
  }

  return { isLimited: false, remainingMs: 0, formattedRemaining: '' };
}

/**
 * ゲスト作成制限案内バッジのUI更新
 */
async function updateGuestLimitUI() {
  const badgeText = document.getElementById('guest-limit-badge-text');
  if (!badgeText) return;

  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    badgeText.innerHTML = `<span style="color:#0a7; font-weight:600;">✨ ログイン中：ルーム作成は無制限です</span>`;
    return;
  }

  const status = await getGuestCreateLimitStatus();
  if (status.isLimited) {
    const linkText = t('create.limit.badgeLoginLink') || 'ログインして作成';
    badgeText.innerHTML = `<span style="color:#e64a5a; font-weight:700;">⚠️ 本日の未ログイン作成枠を使用済み（次回可能: あと${status.formattedRemaining}）</span><br><a href="./login.html" style="color:#0a7; font-weight:700; text-decoration:underline; margin-left:4px;">${linkText}</a>`;
  } else {
    badgeText.innerHTML = `<span>${t('create.limit.badgeNotice') || '💡 未ログインでの作成は24時間に1回まで（ログインで作成）'}</span>`;
  }
}

async function handleCreateRoom() {
  await ensureAuthReady();
  TEMP_CREATE_ROOM_ID = (newRoomIdInput.value || '').trim();
  TEMP_CREATE_CREATOR_NAME = (newPlayerNameInput.value || '').trim();
  
  if (!TEMP_CREATE_ROOM_ID) { alert(t('err.roomId')); return; }
  if (!TEMP_CREATE_CREATOR_NAME) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }

  // Store name
  localStorage.setItem('pa:last-player-name', TEMP_CREATE_CREATOR_NAME);

  // ゲスト作成制限チェック
  if (auth.currentUser?.isAnonymous) {
    const limitStatus = await getGuestCreateLimitStatus();
    if (limitStatus.isLimited) {
      const timerEl = document.getElementById('guest-limit-timer-text');
      if (timerEl) {
        timerEl.textContent = `次回作成可能まで：あと ${limitStatus.formattedRemaining}`;
      }
      document.getElementById('guest-limit-modal').style.display = 'flex';
      updateGuestLimitUI();
      return;
    }

    document.getElementById('anon-warning-modal').style.display = 'flex';
  } else {
    showLayoutModal();
  }
}

function showLayoutModal() {
  if (CREATE_FIELD_MODE === 'official' || CREATE_FIELD_MODE === 'trump' || CREATE_FIELD_MODE === 'chess') {
    document.getElementById('official-game-modal').style.display = 'flex';
    window.selectOfficialOption(CURRENT_OFFICIAL_SELECTION || 'trump');
    return;
  }
  if (CREATE_FIELD_MODE === 'card' || CREATE_FIELD_MODE === 'board') {
    const isBoard = (CREATE_FIELD_MODE === 'board');
    // 全オプションまたはボード用2種を表示制御
    document.querySelectorAll('#field-layout-modal .layout-option').forEach(opt => {
      const isBasic = (opt.id === 'layout-opt-standard1' || opt.id === 'layout-opt-simple1');
      opt.style.display = (!isBoard || isBasic) ? '' : 'none';
    });

    const simpleImg = document.getElementById('layout-img-simple1');
    const standardImg = document.getElementById('layout-img-standard1');
    if (simpleImg && standardImg) {
      if (isBoard) {
        simpleImg.src = 'image/board simple.png';
        standardImg.src = 'image/board standard.png';
      } else {
        simpleImg.src = 'image/Field_simple1_type.png';
        standardImg.src = 'image/Field_standard1_type.png';
      }
    }
    window.selectLayoutOption('standard1');
    document.getElementById('field-layout-modal').style.display = 'flex';
  } else if (CREATE_FIELD_MODE === 'trump' || CREATE_FIELD_MODE === 'chess') {
    executeRoomCreation(CREATE_FIELD_MODE === 'trump' ? 'simple' : 'playonly');
  } else {
    executeRoomCreation('standard1');
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
      needsInitialization: (CREATE_FIELD_MODE === 'trump' || CREATE_FIELD_MODE === 'chess'),
      joinPassHash: joinPassHash,
      hasPassword: !!joinPassHash,
      playerCount: parseInt(newPlayerCountSelect?.value || '4', 10),
      roomName: id, // デフォルトはID
    };

    // 匿名ユーザー（ゲスト）の場合のみ、24時間で削除される有効期限を設定 & 24時間作成制限のタイムスタンプ記録
    if (auth.currentUser?.isAnonymous) {
      payload.expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      const nowMs = Date.now();
      localStorage.setItem('pa:last-guest-room-created-at', nowMs.toString());
      try {
        await setDoc(doc(db, `users/${uid}`), {
          lastRoomCreatedAt: serverTimestamp(),
          isAnonymous: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('[Limit] Failed to save lastRoomCreatedAt to users doc:', err);
      }
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
