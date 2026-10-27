/**
 * ============================================================================
 * BatriTable TRPG Studio (trpg.module.js)
 * Standalone Virtual Tabletop (VTT) Engine
 * Ccfolia-compatible Board, Character Pieces, Dice Bot & Realtime Sync
 * ============================================================================
 */

import {
  auth, db,
  onAuthStateChanged,
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp, onSnapshot,
  collection, addDoc, query, orderBy, limit
} from './firebase.init.js';

// === State ===
let CURRENT_ROOM = null;
let CURRENT_UID = null;
let CURRENT_USER_NAME = 'プレイヤー';
let ROOM_DATA = null;

// Viewport Transform State
let VIEW_X = -1500;
let VIEW_Y = -1000;
let VIEW_SCALE = 0.8;
let IS_PANNING = false;
let PAN_START_X = 0;
let PAN_START_Y = 0;

// Grid & Snap
let GRID_SIZE = 50;
let SNAP_TO_GRID = true;
let SHOW_GRID = true;

// Active Tool
let ACTIVE_TOOL = 'select'; // 'select' | 'piece' | 'marker' | 'ruler'

// Characters & Pieces in Room
let ROOM_PIECES = {};
let DRAGGING_PIECE_ID = null;
let DRAG_OFFSET_X = 0;
let DRAG_OFFSET_Y = 0;

// Chat
let ACTIVE_CHAT_TAB = 'main';

// Elements
const viewport = document.getElementById('trpg-viewport');
const world = document.getElementById('trpg-world');
const surface = document.getElementById('trpg-table-surface');
const bgImg = document.getElementById('trpg-table-bg-img');
const piecesLayer = document.getElementById('trpg-pieces-layer');
const chatLog = document.getElementById('trpg-chat-log');
const chatInput = document.getElementById('chat-input-text');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatSenderSelect = document.getElementById('chat-sender-select');
const chatDiffSelect = document.getElementById('chat-diff-select');
const audioEl = document.getElementById('trpg-audio-el');
const bgmToggleBtn = document.getElementById('bgm-toggle-btn');
const bgmTitleText = document.getElementById('bgm-current-title');
const bgmVolumeSlider = document.getElementById('bgm-volume');

// ============================================================================
// Initialization & Authentication Guard
// ============================================================================
async function init() {
  const params = new URLSearchParams(window.location.search);
  CURRENT_ROOM = params.get('id');

  if (!CURRENT_ROOM) {
    alert('ルームIDが指定されていません。ロビーへ戻ります。');
    window.location.href = './lobby.html';
    return;
  }

  const roomIdDisplay = document.getElementById('room-id-display');
  if (roomIdDisplay) roomIdDisplay.textContent = CURRENT_ROOM;

  // コピーボタン
  document.getElementById('btn-copy-room-id')?.addEventListener('click', () => {
    navigator.clipboard.writeText(CURRENT_ROOM);
    alert(`ルームID「${CURRENT_ROOM}」をコピーしました！`);
  });

  // 認証チェック（先行開発アカウント限定 guard）
  onAuthStateChanged(auth, async (user) => {
    const DEV_ACCOUNTS = ['joe9bk@gmail.com'];
    if (user && !user.isAnonymous && DEV_ACCOUNTS.includes(user.email)) {
      CURRENT_UID = user.uid;
      CURRENT_USER_NAME = user.displayName || user.email.split('@')[0] || 'プレイヤー';
      setupUIEventListeners();
      await loadRoomData();
      listenRoomUpdates();
      listenChatMessages();
    } else {
      CURRENT_UID = null;
      alert('TRPGモードは現在、特定のアカウント（先行開発）のみ公開されています。ロビーへ戻ります。');
      window.location.href = './lobby.html';
    }
  });
}

// ============================================================================
// Room Data & Realtime Sync
// ============================================================================
async function loadRoomData() {
  try {
    const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
    const snap = await getDoc(roomRef);

    if (snap.exists()) {
      ROOM_DATA = snap.data();
      applyRoomData(ROOM_DATA);
    } else {
      // 初期化作成
      ROOM_DATA = {
        fieldMode: 'trpg',
        gridSize: 50,
        snapGrid: true,
        bgUrl: '',
        bgmUrl: '',
        bgmTitle: '♪ 未設定',
        sharedNotes: '【共有メモ】\nここにセッション情報や手がかりを記録できます。',
        pieces: {},
        createdAt: serverTimestamp()
      };
      await setDoc(roomRef, ROOM_DATA, { merge: true });
      applyRoomData(ROOM_DATA);
    }
  } catch (err) {
    console.error('[TRPG] Load room failed:', err);
  }
}

function listenRoomUpdates() {
  const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
  onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    ROOM_DATA = data;
    applyRoomData(data);
  });
}

function applyRoomData(data) {
  if (!data) return;

  // Background Image
  if (data.bgUrl) {
    bgImg.src = data.bgUrl;
    bgImg.style.display = 'block';
  } else {
    bgImg.style.display = 'none';
  }

  // Grid
  if (data.gridSize) {
    GRID_SIZE = data.gridSize;
    surface.style.backgroundSize = `${GRID_SIZE}px ${GRID_SIZE}px`;
  }
  if (typeof data.snapGrid === 'boolean') {
    SNAP_TO_GRID = data.snapGrid;
  }

  // Shared Notes modal content
  const noteContentEl = document.getElementById('shared-note-content');
  if (noteContentEl && document.activeElement !== noteContentEl) {
    noteContentEl.value = data.sharedNotes || '';
  }

  // BGM sync
  if (data.bgmTitle) {
    bgmTitleText.textContent = `♪ ${data.bgmTitle}`;
  }
  if (data.bgmUrl && audioEl.src !== data.bgmUrl) {
    audioEl.src = data.bgmUrl;
  }

  // Pieces Render
  if (data.pieces) {
    ROOM_PIECES = data.pieces;
    renderPieces();
    updateSenderSelectOptions();
  }
}

// ============================================================================
// Viewport Transform (Pan & Zoom)
// ============================================================================
function updateWorldTransform() {
  world.style.transform = `translate(${VIEW_X}px, ${VIEW_Y}px) scale(${VIEW_SCALE})`;
}

function setupViewportControls() {
  updateWorldTransform();

  // Mouse wheel zoom (zoom around cursor)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextScale = Math.min(Math.max(VIEW_SCALE * zoomFactor, 0.2), 3.0);

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    VIEW_X = mouseX - (mouseX - VIEW_X) * (nextScale / VIEW_SCALE);
    VIEW_Y = mouseY - (mouseY - VIEW_Y) * (nextScale / VIEW_SCALE);
    VIEW_SCALE = nextScale;

    updateWorldTransform();
  }, { passive: false });

  // Pan with middle click, right click, or space+drag, or click on background
  viewport.addEventListener('mousedown', (e) => {
    // If clicking a piece or UI element, don't pan canvas
    if (e.target.closest('.trpg-piece') || e.target.closest('#trpg-toolbox') || e.target.closest('.trpg-modal-card')) {
      return;
    }

    if (e.button === 0 || e.button === 1 || e.button === 2) {
      IS_PANNING = true;
      PAN_START_X = e.clientX - VIEW_X;
      PAN_START_Y = e.clientY - VIEW_Y;
      viewport.classList.add('panning');
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (IS_PANNING) {
      VIEW_X = e.clientX - PAN_START_X;
      VIEW_Y = e.clientY - PAN_START_Y;
      updateWorldTransform();
    } else if (DRAGGING_PIECE_ID) {
      handlePieceDrag(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (IS_PANNING) {
      IS_PANNING = false;
      viewport.classList.remove('panning');
    }
    if (DRAGGING_PIECE_ID) {
      finishPieceDrag();
    }
  });

  // Prevent context menu on canvas for smooth right-click pan
  viewport.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================================================
// Character Pieces Management & Dragging
// ============================================================================
function renderPieces() {
  piecesLayer.innerHTML = '';

  Object.entries(ROOM_PIECES).forEach(([id, piece]) => {
    const el = document.createElement('div');
    el.className = 'trpg-piece';
    el.dataset.id = id;
    el.style.left = `${piece.x || 100}px`;
    el.style.top = `${piece.y || 100}px`;

    // HP / MP / SAN ratios
    const hpCur = piece.hpCur ?? 12;
    const hpMax = Math.max(piece.hpMax ?? 12, 1);
    const hpRatio = Math.min(Math.max((hpCur / hpMax) * 100, 0), 100);

    const mpCur = piece.mpCur ?? 10;
    const mpMax = Math.max(piece.mpMax ?? 10, 1);
    const mpRatio = Math.min(Math.max((mpCur / mpMax) * 100, 0), 100);

    const sanCur = piece.sanCur ?? 65;
    const sanMax = Math.max(piece.sanMax ?? 99, 1);
    const sanRatio = Math.min(Math.max((sanCur / sanMax) * 100, 0), 100);

    const avatarUrl = piece.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

    el.innerHTML = `
      <div class="piece-name-badge" title="${piece.name}">${piece.name}</div>
      <div class="piece-avatar-wrap">
        <img class="piece-avatar-img" src="${avatarUrl}" alt="${piece.name}" />
      </div>
      <div class="piece-bars">
        <div class="piece-bar" title="HP: ${hpCur}/${hpMax}"><div class="piece-bar-fill hp" style="width:${hpRatio}%"></div></div>
        <div class="piece-bar" title="MP: ${mpCur}/${mpMax}"><div class="piece-bar-fill mp" style="width:${mpRatio}%"></div></div>
        <div class="piece-bar" title="SAN: ${sanCur}/${sanMax}"><div class="piece-bar-fill san" style="width:${sanRatio}%"></div></div>
      </div>
    `;

    // Drag piece mousedown
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only for moving piece
      e.stopPropagation();
      startPieceDrag(id, e);
    });

    // Double click to edit piece
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      openEditPieceModal(id);
    });

    piecesLayer.appendChild(el);
  });
}

function startPieceDrag(pieceId, e) {
  DRAGGING_PIECE_ID = pieceId;
  const piece = ROOM_PIECES[pieceId];
  if (!piece) return;

  const pieceEl = piecesLayer.querySelector(`[data-id="${pieceId}"]`);
  if (pieceEl) pieceEl.classList.add('dragging');

  // Calculate mouse offset within surface coordinate space
  const mouseTableX = (e.clientX - VIEW_X) / VIEW_SCALE;
  const mouseTableY = (e.clientY - VIEW_Y) / VIEW_SCALE;

  DRAG_OFFSET_X = mouseTableX - (piece.x || 0);
  DRAG_OFFSET_Y = mouseTableY - (piece.y || 0);
}

function handlePieceDrag(e) {
  if (!DRAGGING_PIECE_ID) return;

  const mouseTableX = (e.clientX - VIEW_X) / VIEW_SCALE;
  const mouseTableY = (e.clientY - VIEW_Y) / VIEW_SCALE;

  let newX = mouseTableX - DRAG_OFFSET_X;
  let newY = mouseTableY - DRAG_OFFSET_Y;

  if (SNAP_TO_GRID) {
    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
  }

  const pieceEl = piecesLayer.querySelector(`[data-id="${DRAGGING_PIECE_ID}"]`);
  if (pieceEl) {
    pieceEl.style.left = `${newX}px`;
    pieceEl.style.top = `${newY}px`;
  }
}

async function finishPieceDrag() {
  if (!DRAGGING_PIECE_ID) return;

  const pieceEl = piecesLayer.querySelector(`[data-id="${DRAGGING_PIECE_ID}"]`);
  if (pieceEl) {
    pieceEl.classList.remove('dragging');
    const finalX = parseFloat(pieceEl.style.left);
    const finalY = parseFloat(pieceEl.style.top);

    // Save to Firestore
    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await updateDoc(roomRef, {
        [`pieces.${DRAGGING_PIECE_ID}.x`]: finalX,
        [`pieces.${DRAGGING_PIECE_ID}.y`]: finalY
      });
    } catch (err) {
      console.error('[TRPG] Save piece position failed:', err);
    }
  }

  DRAGGING_PIECE_ID = null;
}

function updateSenderSelectOptions() {
  // Keep system & player, then add all pieces
  chatSenderSelect.innerHTML = `
    <option value="__gm__">GM（ナレーション）</option>
    <option value="__player__">${CURRENT_USER_NAME} (プレイヤー)</option>
  `;

  Object.entries(ROOM_PIECES).forEach(([id, piece]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `♟ ${piece.name}`;
    chatSenderSelect.appendChild(opt);
  });
}

function openEditPieceModal(pieceId) {
  const piece = ROOM_PIECES[pieceId];
  if (!piece) return;

  document.getElementById('char-name').value = piece.name || '';
  document.getElementById('char-hp-cur').value = piece.hpCur ?? 12;
  document.getElementById('char-hp-max').value = piece.hpMax ?? 12;
  document.getElementById('char-mp-cur').value = piece.mpCur ?? 10;
  document.getElementById('char-mp-max').value = piece.mpMax ?? 10;
  document.getElementById('char-san-cur').value = piece.sanCur ?? 65;
  document.getElementById('char-san-max').value = piece.sanMax ?? 99;
  document.getElementById('char-avatar-url').value = piece.avatarUrl || '';
  document.getElementById('char-palette-text').value = piece.paletteText || '';

  // Mark current editing piece id
  document.getElementById('modal-char-manage').dataset.editingId = pieceId;
  openModal('modal-char-manage');
}

// ============================================================================
// Dice Evaluation Engine (BCDice-compatible Subset)
// ============================================================================
function parseAndRollDice(text) {
  // Regular expressions for common TRPG dice commands
  // 1. CoC Skill roll: CC<=50, CCB<=60, 1D100<=70
  const cocMatch = text.match(/^(?:CC|CCB|1D100)<=(\d+)(.*)$/i);
  if (cocMatch) {
    const target = parseInt(cocMatch[1], 10);
    const comment = cocMatch[2].trim();
    const roll = Math.floor(Math.random() * 100) + 1; // 1 to 100

    let outcome = 'failure';
    let outcomeText = '失敗';

    if (roll <= 5) {
      outcome = 'critical';
      outcomeText = '決定的成功 / クリティカル！ ✨';
    } else if (roll >= 96) {
      outcome = 'fumble';
      outcomeText = '致命的失敗 / ファンブル！ 💥';
    } else if (roll <= Math.floor(target / 5)) {
      outcome = 'success';
      outcomeText = 'スペシャル！ (1/5値以下)';
    } else if (roll <= target) {
      outcome = 'success';
      outcomeText = '成功';
    }

    return {
      isDice: true,
      command: `1D100<=${target} ${comment}`,
      resultText: `🎲 1D100 ➔ [${roll}] ➔ ${outcomeText}`,
      outcomeClass: outcome
    };
  }

  // 2. Generic XDY + Z: 2D6, 3D6+2, 1D100
  const xdyMatch = text.match(/^(\d+)D(\d+)([+-]\d+)?(.*)$/i);
  if (xdyMatch) {
    const count = Math.min(parseInt(xdyMatch[1], 10), 50);
    const sides = parseInt(xdyMatch[2], 10);
    const mod = xdyMatch[3] ? parseInt(xdyMatch[3], 10) : 0;
    const comment = xdyMatch[4].trim();

    const rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    const total = sum + mod;
    const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : '';

    return {
      isDice: true,
      command: `${count}D${sides}${modStr} ${comment}`,
      resultText: `🎲 (${rolls.join('+')})${modStr} ➔ 合計: ${total}`,
      outcomeClass: 'success'
    };
  }

  return { isDice: false };
}

// ============================================================================
// Chat System
// ============================================================================
function listenChatMessages() {
  const chatCol = collection(db, `rooms/${CURRENT_ROOM}/chat`);
  const q = query(chatCol, orderBy('createdAt', 'asc'), limit(80));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const msg = change.doc.data();
        appendChatMessageToUI(msg);
      }
    });
  });
}

function appendChatMessageToUI(msg) {
  const item = document.createElement('div');
  item.className = 'chat-msg';

  const timeStr = msg.createdAt?.toDate ? 
    msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let avatarMarkup = '';
  if (msg.avatarUrl) {
    avatarMarkup = `<img src="${msg.avatarUrl}" alt="${msg.senderName}" />`;
  } else {
    const icon = msg.isGm ? '👑' : '♟';
    avatarMarkup = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1e293b; color:#38bdf8; font-weight:700;">${icon}</div>`;
  }

  let diceMarkup = '';
  if (msg.diceData) {
    diceMarkup = `
      <div class="dice-result-card">
        <div class="dice-command">${msg.diceData.command}</div>
        <div class="dice-outcome ${msg.diceData.outcomeClass}">${msg.diceData.resultText}</div>
      </div>
    `;
  }

  item.innerHTML = `
    <div class="chat-msg-avatar">
      ${avatarMarkup}
    </div>
    <div class="chat-msg-body">
      <div class="chat-msg-header">
        <span class="chat-msg-sender ${msg.isGm ? 'is-gm' : ''}">${msg.senderName}</span>
        <span class="chat-msg-time">${timeStr}</span>
      </div>
      <div class="chat-msg-text">${escapeHtml(msg.text || '')}</div>
      ${diceMarkup}
    </div>
  `;

  chatLog.appendChild(item);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChatMessage(content) {
  const text = (content || chatInput.value || '').trim();
  if (!text) return;

  chatInput.value = '';

  const senderId = chatSenderSelect.value;
  let senderName = CURRENT_USER_NAME;
  let isGm = false;
  let avatarUrl = '';

  if (senderId === '__gm__') {
    senderName = 'GM（ナレーション）';
    isGm = true;
  } else if (senderId === '__player__') {
    senderName = CURRENT_USER_NAME;
  } else if (ROOM_PIECES[senderId]) {
    senderName = ROOM_PIECES[senderId].name;
    avatarUrl = ROOM_PIECES[senderId].avatarUrl || '';
  }

  const diceRes = parseAndRollDice(text);

  const payload = {
    senderUid: CURRENT_UID,
    senderName,
    isGm,
    avatarUrl,
    tab: ACTIVE_CHAT_TAB,
    text: diceRes.isDice ? '' : text,
    diceData: diceRes.isDice ? diceRes : null,
    createdAt: serverTimestamp()
  };

  try {
    const chatCol = collection(db, `rooms/${CURRENT_ROOM}/chat`);
    await addDoc(chatCol, payload);
  } catch (err) {
    console.error('[TRPG] Send chat failed:', err);
  }
}

// ============================================================================
// Modal & UI Event Handlers
// ============================================================================
function setupUIEventListeners() {
  setupViewportControls();

  // Chat send
  chatSendBtn?.addEventListener('click', () => sendChatMessage());
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Chat palette buttons
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd) sendChatMessage(cmd);
    });
  });

  // Dock Tabs
  document.querySelectorAll('.dock-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ACTIVE_CHAT_TAB = tab.dataset.tab;
    });
  });

  // Modal open buttons
  document.getElementById('btn-open-char-modal')?.addEventListener('click', () => {
    document.getElementById('modal-char-manage').removeAttribute('data-editing-id');
    openModal('modal-char-manage');
  });
  document.getElementById('btn-open-notes')?.addEventListener('click', () => openModal('modal-notes'));
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openModal('modal-settings'));
  document.getElementById('btn-set-bgm')?.addEventListener('click', () => openModal('modal-bgm'));
  document.getElementById('btn-exit-lobby')?.addEventListener('click', () => {
    if (confirm('ロビーへ退出しますか？')) window.location.href = './lobby.html';
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Toolbox buttons
  document.getElementById('tool-select')?.addEventListener('click', () => setTool('select'));
  document.getElementById('tool-piece')?.addEventListener('click', () => {
    openModal('modal-char-manage');
  });
  document.getElementById('tool-grid-toggle')?.addEventListener('click', () => {
    SHOW_GRID = !SHOW_GRID;
    surface.style.backgroundImage = SHOW_GRID ? 
      `linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)` : 
      'none';
  });
  document.getElementById('tool-reset-view')?.addEventListener('click', () => {
    VIEW_X = -1500;
    VIEW_Y = -1000;
    VIEW_SCALE = 0.8;
    updateWorldTransform();
  });

  // Save Character & Spawn Piece
  document.getElementById('btn-save-spawn-char')?.addEventListener('click', async () => {
    const modalEl = document.getElementById('modal-char-manage');
    const editingId = modalEl.dataset.editingId;
    const pieceId = editingId || `piece_${Date.now()}`;

    const name = document.getElementById('char-name').value.trim() || '探索者';
    const hpCur = parseInt(document.getElementById('char-hp-cur').value, 10) || 12;
    const hpMax = parseInt(document.getElementById('char-hp-max').value, 10) || 12;
    const mpCur = parseInt(document.getElementById('char-mp-cur').value, 10) || 10;
    const mpMax = parseInt(document.getElementById('char-mp-max').value, 10) || 10;
    const sanCur = parseInt(document.getElementById('char-san-cur').value, 10) || 65;
    const sanMax = parseInt(document.getElementById('char-san-max').value, 10) || 99;
    const avatarUrl = document.getElementById('char-avatar-url').value.trim();
    const paletteText = document.getElementById('char-palette-text').value.trim();

    // Default spawn position around center of current viewport
    const spawnX = Math.round(((-VIEW_X + 400) / VIEW_SCALE) / GRID_SIZE) * GRID_SIZE;
    const spawnY = Math.round(((-VIEW_Y + 300) / VIEW_SCALE) / GRID_SIZE) * GRID_SIZE;

    const existingX = editingId && ROOM_PIECES[editingId] ? ROOM_PIECES[editingId].x : spawnX;
    const existingY = editingId && ROOM_PIECES[editingId] ? ROOM_PIECES[editingId].y : spawnY;

    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await updateDoc(roomRef, {
        [`pieces.${pieceId}`]: {
          name,
          hpCur,
          hpMax,
          mpCur,
          mpMax,
          sanCur,
          sanMax,
          avatarUrl,
          paletteText,
          x: existingX,
          y: existingY,
          ownerUid: CURRENT_UID
        }
      });
      closeModal('modal-char-manage');
    } catch (err) {
      console.error('[TRPG] Save piece failed:', err);
      alert('コマの保存に失敗しました。');
    }
  });

  // Clipboard JSON Import (Ccfolia-compatible)
  document.getElementById('btn-import-char-json')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { alert('クリップボードが空です。'); return; }

      const data = JSON.parse(text);
      // Ccfolia JSON standard structure
      const charData = data.data || data;

      if (charData.name) document.getElementById('char-name').value = charData.name;
      
      // Status parameters
      if (Array.isArray(charData.status)) {
        charData.status.forEach(st => {
          const label = (st.label || '').toUpperCase();
          if (label === 'HP' || label === '体力') {
            document.getElementById('char-hp-cur').value = st.value ?? 12;
            document.getElementById('char-hp-max').value = st.max ?? 12;
          } else if (label === 'MP' || label === 'マジックポイント') {
            document.getElementById('char-mp-cur').value = st.value ?? 10;
            document.getElementById('char-mp-max').value = st.max ?? 10;
          } else if (label === 'SAN' || label === '正気度') {
            document.getElementById('char-san-cur').value = st.value ?? 65;
            document.getElementById('char-san-max').value = st.max ?? 99;
          }
        });
      }

      // Chat palette
      if (charData.commands) {
        document.getElementById('char-palette-text').value = charData.commands;
      }

      alert('キャラシートJSONを自動読み込みしました！');
    } catch (err) {
      console.warn('[TRPG] JSON import parse failed:', err);
      alert('有効なキャラクターJSONが見つかりませんでした。クリップボードの内容を確認してください。');
    }
  });

  // Save Shared Notes
  document.getElementById('btn-save-note')?.addEventListener('click', async () => {
    const text = document.getElementById('shared-note-content').value;
    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await updateDoc(roomRef, { sharedNotes: text });
      closeModal('modal-notes');
    } catch (err) {
      console.error('[TRPG] Save notes failed:', err);
    }
  });

  // Save Settings
  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const bgUrl = document.getElementById('setting-bg-url').value.trim();
    const gSize = parseInt(document.getElementById('setting-grid-size').value, 10) || 50;
    const snap = document.getElementById('setting-snap-grid').checked;

    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await updateDoc(roomRef, { bgUrl, gridSize: gSize, snapGrid: snap });
      closeModal('modal-settings');
    } catch (err) {
      console.error('[TRPG] Save settings failed:', err);
    }
  });

  // Save BGM
  document.getElementById('btn-save-bgm')?.addEventListener('click', async () => {
    const bgmTitle = document.getElementById('bgm-input-title').value.trim() || '通常BGM';
    const bgmUrl = document.getElementById('bgm-input-url').value.trim();

    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await updateDoc(roomRef, { bgmTitle, bgmUrl });
      closeModal('modal-bgm');
    } catch (err) {
      console.error('[TRPG] Save BGM failed:', err);
    }
  });

  // BGM Player Play/Pause
  bgmToggleBtn?.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play().then(() => {
        bgmToggleBtn.textContent = '⏸';
      }).catch(err => {
        console.warn('Audio play blocked:', err);
        alert('ブラウザの自動再生制限により再生できませんでした。画面をクリックした後に再度お試しください。');
      });
    } else {
      audioEl.pause();
      bgmToggleBtn.textContent = '▶';
    }
  });

  // BGM Volume
  bgmVolumeSlider?.addEventListener('input', (e) => {
    audioEl.volume = parseFloat(e.target.value) / 100;
  });
}

function setTool(tool) {
  ACTIVE_TOOL = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  const target = document.getElementById(`tool-${tool}`);
  if (target) target.classList.add('active');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Start Engine
init();
