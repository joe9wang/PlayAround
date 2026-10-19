// ============================================================================
// BatriTable: Game Dev Play Module (プレイ専用ルーム)
// ============================================================================

import {
  auth,
  db
} from './firebase.init.js';
import {
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ---- URL Params ----
const urlParams = new URLSearchParams(window.location.search);
const TEMPLATE_ID = urlParams.get('id');
const ROOM_INSTANCE_ID = urlParams.get('room_id');

// ---- State Variables ----
let CURRENT_UID = null;
let ROOM_DOC_PATH = null;
let ROOM_DATA = null;
let PLAYER_COUNT = 4;
let AREAS = [];
let ENTITIES = [];
let PLAY_BUTTONS = [];
let CPU_SEATS = new Set();
let CPU_RULES = [];
let CARD_SCHEMAS = [];
let CURRENT_ACTING_PLAYER = 'player1';
let LAST_ACTED_CPU_INDEX = -1;

// Viewport / Zoom
let VIEW_SCALE = 1.0;
let VIEW_OFFSET_X = 0;
let VIEW_OFFSET_Y = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Dragging
let draggingEntity = null;
let dragStartX = 0;
let dragStartY = 0;
let entityStartX = 0;
let entityStartY = 0;
let isSavingRoom = false;
let syncTimeout = null;

// Context Menu
let contextMenuTargetId = null;

// DOM Elements
const loadingOverlay = document.getElementById('play-loading-overlay');
const loadingText = document.getElementById('play-loading-text');
const roomIdDisplay = document.getElementById('room-id-display');
const instanceNumDisplay = document.getElementById('instance-num-display');
const actingPlayerSelect = document.getElementById('play-acting-player');
const btnInviteFriend = document.getElementById('btn-invite-friend');
const btnToggleActionPanel = document.getElementById('btn-toggle-action-panel');
const btnCloseActionPanel = document.getElementById('btn-close-action-panel');
const btnExitLobby = document.getElementById('btn-exit-lobby');
const actionsPanel = document.getElementById('play-actions-panel');
const playButtonsContainer = document.getElementById('play-buttons-container');
const cpuSection = document.getElementById('cpu-section');
const btnTriggerCpuTurn = document.getElementById('btn-trigger-cpu-turn');
const cpuSummaryBox = document.getElementById('cpu-summary-box');

const tableContainer = document.getElementById('table-container');
const worldEl = document.getElementById('world');
const areasLayerEl = document.getElementById('areas-layer');
const entitiesLayerEl = document.getElementById('entities-layer');

const hudZoomText = document.getElementById('hud-zoom-text');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');

const ctxMenu = document.getElementById('play-context-menu');
const ctxFlip = document.getElementById('ctx-flip');
const ctxRotate = document.getElementById('ctx-rotate');

// ============================================================================
// Initialization & Instance Room Routing
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!TEMPLATE_ID) {
    alert('ゲームIDが指定されていません。ロビーへ戻ります。');
    window.location.href = './lobby.html';
    return;
  }

  // 1. room_id が無い場合: テンプレートから新しいインスタンス卓を生成してリダイレクト
  if (!ROOM_INSTANCE_ID) {
    await createAndRedirectToInstance();
    return;
  }

  // 2. room_id がある場合: 該当インスタンス卓へ入室してゲーム開始
  ROOM_DOC_PATH = `rooms/${TEMPLATE_ID}_inst_${ROOM_INSTANCE_ID}`;
  if (roomIdDisplay) roomIdDisplay.textContent = TEMPLATE_ID;
  if (instanceNumDisplay) instanceNumDisplay.textContent = `#${ROOM_INSTANCE_ID}`;

  setupUIEvents();
  initAuthAndGame();
});

// インスタンス卓の自動生成
async function createAndRedirectToInstance() {
  if (loadingText) loadingText.textContent = '新規ゲーム卓（インスタンス）を作成中...';

  try {
    const templateRef = doc(db, `rooms/${TEMPLATE_ID}`);
    const snap = await getDoc(templateRef);

    if (!snap.exists()) {
      alert(`指定されたゲームテンプレート「${TEMPLATE_ID}」が見つかりませんでした。ロビーへ戻ります。`);
      window.location.href = './lobby.html';
      return;
    }

    const templateData = snap.data();
    const nextInstanceNum = (Number(templateData.instanceCount) || 0) + 1;

    // テンプレート側の instanceCount を更新
    await updateDoc(templateRef, {
      instanceCount: nextInstanceNum
    }).catch(async () => {
      await setDoc(templateRef, { instanceCount: nextInstanceNum }, { merge: true });
    });

    // 新規インスタンス卓の作成
    const newInstanceRef = doc(db, `rooms/${TEMPLATE_ID}_inst_${nextInstanceNum}`);
    await setDoc(newInstanceRef, {
      templateId: TEMPLATE_ID,
      instanceNum: nextInstanceNum,
      isDevInstance: true,
      playerCount: templateData.playerCount || 4,
      cardSchemas: templateData.cardSchemas || [],
      playButtons: templateData.playButtons || [],
      cpuSeats: templateData.cpuSeats || [],
      cpuRules: templateData.cpuRules || [],
      devAreas: templateData.devAreas || [],
      devEntities: templateData.devEntities || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 自分用のインスタンス卓 URL に自動遷移
    window.location.replace(`./game-dev-play.html?id=${encodeURIComponent(TEMPLATE_ID)}&room_id=${nextInstanceNum}`);
  } catch (err) {
    console.error('Failed to create instance room:', err);
    alert('ゲーム卓の作成に失敗しました。ロビーへ戻ります。');
    window.location.href = './lobby.html';
  }
}

// 認証＆卓データ購読
function initAuthAndGame() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      CURRENT_UID = user.uid;
      await loadInstanceRoom();
    } else {
      // ゲストでも即座に遊べるよう匿名認証
      try {
        const cred = await signInAnonymously(auth);
        CURRENT_UID = cred.user.uid;
        await loadInstanceRoom();
      } catch (e) {
        console.warn('Anonymous sign-in failed, proceeding as local guest:', e);
        await loadInstanceRoom();
      }
    }
  });
}

async function loadInstanceRoom() {
  try {
    const roomRef = doc(db, ROOM_DOC_PATH);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      alert(`卓 #${ROOM_INSTANCE_ID} が見つかりません。新しい卓を作成します。`);
      window.location.href = `./game-dev-play.html?id=${encodeURIComponent(TEMPLATE_ID)}`;
      return;
    }

    ROOM_DATA = snap.data();
    applyRoomData(ROOM_DATA);

    // リアルタイム同期
    onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists() || isSavingRoom) return;
      applyRoomData(docSnap.data());
    });

    // ロード画面非表示
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 300);
    }

    centerWorldInViewport();
  } catch (err) {
    console.error('Load instance room failed:', err);
    alert('卓データの読み込みに失敗しました。');
  }
}

function applyRoomData(data) {
  if (data.playerCount) {
    PLAYER_COUNT = Math.max(1, Math.min(10, Number(data.playerCount) || 4));
    updateActingPlayerOptions();
  }
  if (data.cardSchemas) CARD_SCHEMAS = data.cardSchemas;
  if (data.playButtons) {
    PLAY_BUTTONS = data.playButtons;
    renderPlayButtons();
  }
  if (data.cpuSeats) {
    CPU_SEATS = new Set(Array.isArray(data.cpuSeats) ? data.cpuSeats : []);
    renderCpuSection();
  }
  if (data.cpuRules) {
    CPU_RULES = Array.isArray(data.cpuRules) ? data.cpuRules : [];
  }
  if (data.devAreas) {
    AREAS = data.devAreas;
    renderAllAreas();
  }
  if (data.devEntities) {
    ENTITIES = data.devEntities;
    renderAllEntities();
  }
}

// ============================================================================
// UI Event Handlers
// ============================================================================
function setupUIEvents() {
  // 友達招待ボタン（URLコピー）
  btnInviteFriend?.addEventListener('click', () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      showToast('🔗 この卓の招待リンクをコピーしました！友達に送って一緒に遊ぼう');
    }).catch(() => {
      prompt('この卓の招待URLです（コピーしてください）:', inviteUrl);
    });
  });

  // 操作パネルの開閉
  btnToggleActionPanel?.addEventListener('click', () => {
    actionsPanel?.classList.toggle('is-collapsed');
  });
  btnCloseActionPanel?.addEventListener('click', () => {
    actionsPanel?.classList.add('is-collapsed');
  });

  // ロビーへ戻る
  btnExitLobby?.addEventListener('click', () => {
    if (confirm('ゲームを終了してロビーに戻りますか？')) {
      window.location.href = './lobby.html';
    }
  });

  // 座席切り替え
  actingPlayerSelect?.addEventListener('change', (e) => {
    CURRENT_ACTING_PLAYER = e.target.value;
    showToast(`操作プレイヤーを ${getOwnerLabel(CURRENT_ACTING_PLAYER)} に切り替えました`);
  });

  // CPUターン実行
  btnTriggerCpuTurn?.addEventListener('click', () => {
    executeNextCpuTurn();
  });

  // ズーム
  btnZoomIn?.addEventListener('click', () => {
    VIEW_SCALE = Math.min(VIEW_SCALE * 1.2, 3.0);
    updateWorldTransform();
  });
  btnZoomOut?.addEventListener('click', () => {
    VIEW_SCALE = Math.max(VIEW_SCALE / 1.2, 0.2);
    updateWorldTransform();
  });
  btnZoomReset?.addEventListener('click', centerWorldInViewport);

  // パン操作 (Table drag)
  tableContainer?.addEventListener('mousedown', (e) => {
    if (e.target !== tableContainer && e.target !== worldEl && e.target !== areasLayerEl) return;
    if (e.button === 0) {
      isPanning = true;
      panStartX = e.clientX - VIEW_OFFSET_X;
      panStartY = e.clientY - VIEW_OFFSET_Y;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      VIEW_OFFSET_X = e.clientX - panStartX;
      VIEW_OFFSET_Y = e.clientY - panStartY;
      updateWorldTransform();
    }
    if (draggingEntity) {
      handleEntityDrag(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) isPanning = false;
    if (draggingEntity) {
      handleEntityDrop();
    }
  });

  // コンテキストメニュー（めくり・回転）
  ctxFlip?.addEventListener('click', () => {
    if (!contextMenuTargetId) return;
    const ent = ENTITIES.find(e => e.id === contextMenuTargetId);
    if (ent && ent.type === 'card') {
      ent.isFaceDown = !ent.isFaceDown;
      const dom = document.getElementById(ent.id);
      if (dom) updateEntityDOM(dom, ent);
      scheduleSaveRoom();
    }
    closeContextMenu();
  });

  ctxRotate?.addEventListener('click', () => {
    if (!contextMenuTargetId) return;
    const ent = ENTITIES.find(e => e.id === contextMenuTargetId);
    if (ent) {
      ent.angle = ((ent.angle || 0) + 90) % 360;
      const dom = document.getElementById(ent.id);
      if (dom) updateEntityDOM(dom, ent);
      scheduleSaveRoom();
    }
    closeContextMenu();
  });

  document.addEventListener('click', (e) => {
    if (!ctxMenu?.contains(e.target)) {
      closeContextMenu();
    }
  });
}

function updateActingPlayerOptions() {
  if (!actingPlayerSelect) return;
  const currentVal = actingPlayerSelect.value;
  actingPlayerSelect.innerHTML = '';
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const seatKey = `player${i}`;
    const opt = document.createElement('option');
    opt.value = seatKey;
    const isCpu = CPU_SEATS.has(seatKey);
    opt.textContent = `P${i} (プレイヤー${i})${isCpu ? ' [CPU]' : ''}`;
    actingPlayerSelect.appendChild(opt);
  }
  if (actingPlayerSelect.querySelector(`option[value="${currentVal}"]`)) {
    actingPlayerSelect.value = currentVal;
  }
}

function updateWorldTransform() {
  if (!worldEl) return;
  worldEl.style.transform = `translate(${VIEW_OFFSET_X}px, ${VIEW_OFFSET_Y}px) scale(${VIEW_SCALE})`;
  if (hudZoomText) hudZoomText.textContent = `${Math.round(VIEW_SCALE * 100)}%`;
}

function centerWorldInViewport() {
  if (!tableContainer || !worldEl) return;
  const rect = tableContainer.getBoundingClientRect();
  VIEW_SCALE = 1.0;
  VIEW_OFFSET_X = rect.width / 2 - 2000;
  VIEW_OFFSET_Y = rect.height / 2 - 2000;
  updateWorldTransform();
}

// ============================================================================
// Render Areas & Entities
// ============================================================================
function renderAllAreas() {
  if (!areasLayerEl) return;
  areasLayerEl.innerHTML = '';

  AREAS.forEach(area => {
    const el = document.createElement('div');
    el.className = `play-area type-${area.type || 'play'}`;
    el.style.left = `${area.x || 0}px`;
    el.style.top = `${area.y || 0}px`;
    el.style.width = `${area.w || 200}px`;
    el.style.height = `${area.h || 200}px`;

    const label = document.createElement('div');
    label.className = 'play-area-label';
    const ownerName = area.owner ? getOwnerLabel(area.owner) : '';
    label.textContent = area.name || `${ownerName} ${getAreaTypeName(area.type)}`;
    el.appendChild(label);

    areasLayerEl.appendChild(el);
  });
}

function renderAllEntities() {
  if (!entitiesLayerEl) return;
  entitiesLayerEl.innerHTML = '';

  ENTITIES.forEach(ent => {
    const el = document.createElement('div');
    el.id = ent.id;
    el.className = `play-entity ${ent.type}-entity`;
    el.style.left = `${ent.x || 0}px`;
    el.style.top = `${ent.y || 0}px`;
    el.style.width = `${ent.w || 100}px`;
    el.style.height = `${ent.h || 140}px`;
    el.style.zIndex = ent.z || 10;
    el.style.transform = `rotate(${ent.angle || 0}deg)`;

    updateEntityDOM(el, ent);

    // Drag start
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        startEntityDrag(e, ent);
      }
    });

    // Context menu (Right click)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e, ent.id);
    });

    // Double click to flip
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (ent.type === 'card') {
        ent.isFaceDown = !ent.isFaceDown;
        updateEntityDOM(el, ent);
        scheduleSaveRoom();
      }
    });

    entitiesLayerEl.appendChild(el);
  });
}

function updateEntityDOM(dom, ent) {
  dom.innerHTML = '';
  if (ent.type === 'card') {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = (ent.isFaceDown && ent.backUrl) ? ent.backUrl : (ent.frontUrl || ent.url || 'PlayExample.webp');
    dom.appendChild(img);
  } else {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = ent.url || 'PlayExample.webp';
    dom.appendChild(img);
  }
  dom.style.transform = `rotate(${ent.angle || 0}deg)`;
}

// ============================================================================
// Drag & Drop Entity
// ============================================================================
function startEntityDrag(e, entity) {
  e.stopPropagation();
  draggingEntity = entity;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  entityStartX = entity.x || 0;
  entityStartY = entity.y || 0;

  // Bring to top
  const maxZ = ENTITIES.reduce((max, item) => Math.max(max, item.z || 0), 10);
  entity.z = maxZ + 1;
  const dom = document.getElementById(entity.id);
  if (dom) {
    dom.classList.add('is-dragging');
    dom.style.zIndex = entity.z;
  }
}

function handleEntityDrag(e) {
  if (!draggingEntity) return;
  const dx = (e.clientX - dragStartX) / VIEW_SCALE;
  const dy = (e.clientY - dragStartY) / VIEW_SCALE;

  draggingEntity.x = Math.round(entityStartX + dx);
  draggingEntity.y = Math.round(entityStartY + dy);

  const dom = document.getElementById(draggingEntity.id);
  if (dom) {
    dom.style.left = `${draggingEntity.x}px`;
    dom.style.top = `${draggingEntity.y}px`;
  }
}

function handleEntityDrop() {
  if (!draggingEntity) return;
  const dom = document.getElementById(draggingEntity.id);
  if (dom) dom.classList.remove('is-dragging');
  draggingEntity = null;
  scheduleSaveRoom();
}

// ============================================================================
// Context Menu
// ============================================================================
function openContextMenu(e, entityId) {
  contextMenuTargetId = entityId;
  if (!ctxMenu) return;
  ctxMenu.style.display = 'block';
  ctxMenu.style.left = `${e.clientX}px`;
  ctxMenu.style.top = `${e.clientY}px`;
}

function closeContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none';
  contextMenuTargetId = null;
}

// ============================================================================
// Play Buttons (Action Execution)
// ============================================================================
function renderPlayButtons() {
  if (!playButtonsContainer) return;
  playButtonsContainer.innerHTML = '';

  if (PLAY_BUTTONS.length === 0) {
    playButtonsContainer.innerHTML = '<div class="empty-notice">実行ボタンがありません</div>';
    return;
  }

  PLAY_BUTTONS.forEach((btn, idx) => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'action-trigger-btn';
    trigger.innerHTML = `
      <span class="btn-icon">🔘</span>
      <span class="btn-label">${escapeHtml(btn.label || `アクション #${idx + 1}`)}</span>
    `;

    trigger.addEventListener('click', () => {
      executePlayButtonAction(btn);
    });

    playButtonsContainer.appendChild(trigger);
  });
}

function executePlayButtonAction(btn) {
  const actor = CURRENT_ACTING_PLAYER || 'player1';

  // 1. Move
  if (btn.action === 'move') {
    const srcArea = resolveAreaRef(btn.sourceArea, actor);
    const destArea = resolveAreaRef(btn.dest, actor);
    if (!srcArea || !destArea) {
      showToast('移動元または移動先のエリアが見つかりません');
      return;
    }

    const cardsInSrc = ENTITIES.filter(e => isEntityOverlappingArea(e, srcArea));
    let targets = cardsInSrc;

    if (btn.tagConditions && btn.tagConditions.length > 0) {
      targets = cardsInSrc.filter(c => matchesTagConditions(c, btn.tagConditions));
    }

    if (targets.length === 0) {
      showToast('条件に合うカードが見つかりませんでした');
      return;
    }

    placeEntitiesInArea(targets, destArea, btn.placement || 'spread_lr');
    showToast(`${targets.length}枚のカードを${destArea.name || 'エリア'}へ移動しました`);
    scheduleSaveRoom();
    return;
  }

  // 2. Draw
  if (btn.action === 'draw') {
    const srcArea = resolveAreaRef(btn.drawSrc, actor) || resolveAreaRef({ kind: 'own', areaType: 'deck' }, actor);
    const destArea = resolveAreaRef(btn.dest, actor) || resolveAreaRef({ kind: 'own', areaType: 'hand' }, actor);
    if (!srcArea || !destArea) {
      showToast('山札またはドロー先エリアが見つかりません');
      return;
    }

    const deckCards = ENTITIES.filter(e => isEntityOverlappingArea(e, srcArea))
      .sort((a, b) => (b.z || 0) - (a.z || 0));

    if (deckCards.length === 0) {
      showToast('山札にカードがありません');
      return;
    }

    const count = Math.min(btn.drawCount || 1, deckCards.length);
    const drawn = deckCards.slice(0, count);

    if (btn.drawFace === 'face_up') {
      drawn.forEach(c => { c.isFaceDown = false; });
    } else if (btn.drawFace === 'face_down') {
      drawn.forEach(c => { c.isFaceDown = true; });
    }

    placeEntitiesInArea(drawn, destArea, btn.placement || 'spread_lr');
    drawn.forEach(c => {
      const dom = document.getElementById(c.id);
      if (dom) updateEntityDOM(dom, c);
    });

    showToast(`${getOwnerLabel(actor)}: 山札から${count}枚ドローしました`);
    scheduleSaveRoom();
    return;
  }

  // 3. Deal
  if (btn.action === 'deal') {
    const srcArea = resolveAreaRef(btn.dealSrc, actor) || resolveAreaRef({ kind: 'own', areaType: 'deck' }, actor);
    if (!srcArea) {
      showToast('配る元のエリアが見つかりません');
      return;
    }

    const destIds = btn.dealDests || [];
    const destAreas = destIds.map(id => AREAS.find(a => a.id === id)).filter(Boolean);
    if (destAreas.length === 0) {
      showToast('配り先のエリアが設定されていません');
      return;
    }

    const deckCards = ENTITIES.filter(e => isEntityOverlappingArea(e, srcArea))
      .sort((a, b) => (b.z || 0) - (a.z || 0));

    if (deckCards.length === 0) {
      showToast('配るカードが山札にありません');
      return;
    }

    const perPlayer = btn.dealCount || 1;
    let cardIdx = 0;

    for (let r = 0; r < perPlayer; r++) {
      for (const dest of destAreas) {
        if (cardIdx >= deckCards.length) break;
        const c = deckCards[cardIdx++];
        if (btn.dealFace === 'face_up') c.isFaceDown = false;
        if (btn.dealFace === 'face_down') c.isFaceDown = true;
        placeEntitiesInArea([c], dest, btn.dealPlacement || 'spread_lr');
        const dom = document.getElementById(c.id);
        if (dom) updateEntityDOM(dom, c);
      }
    }

    showToast(`各エリアに${perPlayer}枚ずつカードを配りました`);
    scheduleSaveRoom();
    return;
  }

  // 4. Flip Toggle
  if (btn.action === 'flip_toggle') {
    const srcArea = resolveAreaRef(btn.sourceArea, actor);
    if (!srcArea) return;
    const cards = ENTITIES.filter(e => isEntityOverlappingArea(e, srcArea));
    cards.forEach(c => {
      c.isFaceDown = !c.isFaceDown;
      const dom = document.getElementById(c.id);
      if (dom) updateEntityDOM(dom, c);
    });
    showToast(`${cards.length}枚のカードを表裏反転しました`);
    scheduleSaveRoom();
    return;
  }

  showToast(`ボタン「${btn.label}」を実行しました`);
}

// ============================================================================
// CPU Automation Execution
// ============================================================================
function renderCpuSection() {
  if (!cpuSection) return;
  if (CPU_SEATS.size > 0 && CPU_RULES.length > 0) {
    cpuSection.style.display = 'flex';
    if (cpuSummaryBox) {
      const seatsText = Array.from(CPU_SEATS).map(s => getOwnerLabel(s)).join(', ');
      cpuSummaryBox.textContent = `参加CPU: ${seatsText} (${CPU_RULES.length}個のルール設定済み)`;
    }
  } else {
    cpuSection.style.display = 'none';
  }
}

function executeNextCpuTurn() {
  const cpuList = Array.from(CPU_SEATS).sort();
  if (cpuList.length === 0) {
    showToast('CPU座席がありません');
    return;
  }

  LAST_ACTED_CPU_INDEX = (LAST_ACTED_CPU_INDEX + 1) % cpuList.length;
  const actingCpu = cpuList[LAST_ACTED_CPU_INDEX];
  const cpuLabel = getOwnerLabel(actingCpu);

  const matchedRules = CPU_RULES.filter(r => r.targetSeat === 'all' || r.targetSeat === actingCpu);
  if (matchedRules.length === 0) {
    showToast(`🤖 ${cpuLabel} 用のルールがありません`);
    return;
  }

  for (const rule of matchedRules) {
    const didAct = executeSingleCpuRule(rule, actingCpu);
    if (didAct) return;
  }

  showToast(`🤖 ${cpuLabel} は実行できるルールがなかったためパスしました`);
}

function executeSingleCpuRule(rule, cpuPlayerId) {
  const cpuLabel = getOwnerLabel(cpuPlayerId);
  const blocks = (Array.isArray(rule.blocks) && rule.blocks.length > 0)
    ? rule.blocks
    : [
      {
        type: 'action',
        actionType: 'action_move',
        srcArea: rule.srcArea || 'own:hand',
        destArea: rule.destArea || 'area:area_play_center',
        count: rule.count || 1
      }
    ];

  const stepsSummary = [];
  let actedAny = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'action') {
      const res = executeCpuAction(block, cpuPlayerId);
      stepsSummary.push(res.summary);
      if (res.success) actedAny = true;
      if (res.didPass) break;
    } else if (block.type === 'condition_if') {
      const isYes = evaluateCpuCondition(block, cpuPlayerId);
      const chosenAct = isYes ? block.thenAction : block.elseAction;
      const res = executeCpuAction(chosenAct, cpuPlayerId);
      const branchText = isYes ? 'YES' : 'NO';
      stepsSummary.push(`条件判定: ${branchText} → ${res.summary}`);
      if (res.success) actedAny = true;
      if (res.didPass) break;
    }
  }

  if (actedAny) {
    showToast(`🤖 ${cpuLabel}: ${stepsSummary.join(' → ')}`);
    scheduleSaveRoom();
    return true;
  }

  return false;
}

function executeCpuAction(act, cpuPlayerId) {
  const actType = act?.actionType || 'action_move';
  if (actType === 'action_pass') {
    return { success: true, didPass: true, summary: 'パス' };
  }

  if (actType === 'action_draw') {
    const deckArea = resolveAreaRef({ kind: 'own', areaType: 'deck' }, cpuPlayerId);
    const handArea = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
    if (!deckArea || !handArea) {
      return { success: false, didPass: false, summary: '山札/手札が見つかりません' };
    }
    const deckCards = ENTITIES.filter(e => isEntityOverlappingArea(e, deckArea))
      .sort((a, b) => (b.z || 0) - (a.z || 0));
    if (deckCards.length === 0) {
      return { success: false, didPass: false, summary: '山札が空です' };
    }
    const count = Math.min(act.count || 1, deckCards.length);
    const drawn = deckCards.slice(0, count);
    drawn.forEach(c => {
      c.isFaceDown = false;
      const dom = document.getElementById(c.id);
      if (dom) updateEntityDOM(dom, c);
    });
    placeEntitiesInArea(drawn, handArea, 'spread_lr');
    return { success: true, didPass: false, summary: `山札から${count}枚ドロー` };
  }

  if (actType === 'action_move') {
    const srcArea = resolveAreaRef(valueToRef(act.srcArea || 'own:hand'), cpuPlayerId);
    if (!srcArea) {
      return { success: false, didPass: false, summary: '移動元エリアが見つかりません' };
    }
    const cardsInSrc = ENTITIES.filter(e => isEntityOverlappingArea(e, srcArea));
    let candidates = cardsInSrc;
    if (act.filterMode === 'tag_condition' && Array.isArray(act.tagConditions) && act.tagConditions.length > 0) {
      candidates = cardsInSrc.filter(c => matchesTagConditions(c, act.tagConditions));
    }
    if (candidates.length === 0) {
      return { success: false, didPass: false, summary: '条件に合うカードなし' };
    }

    const count = Math.min(act.count || 1, candidates.length);
    const selected = candidates.slice(0, count);
    const destArea = resolveAreaRef(valueToRef(act.destArea || 'area:area_play_center'), cpuPlayerId);
    if (!destArea) {
      return { success: false, didPass: false, summary: '移動先エリアが見つかりません' };
    }

    if (act.face === 'face_up') selected.forEach(c => { c.isFaceDown = false; });
    if (act.face === 'face_down') selected.forEach(c => { c.isFaceDown = true; });

    placeEntitiesInArea(selected, destArea, act.placement || 'spread_lr');
    selected.forEach(c => {
      const dom = document.getElementById(c.id);
      if (dom) updateEntityDOM(dom, c);
    });

    return { success: true, didPass: false, summary: `${selected.length}枚を${destArea.name || '場'}へ移動` };
  }

  return { success: false, didPass: false, summary: '行動不可' };
}

function evaluateCpuCondition(block, cpuPlayerId) {
  const checkArea = resolveAreaRef(valueToRef(block.checkArea || 'own:hand'), cpuPlayerId);
  if (!checkArea) return false;

  const cardsInArea = ENTITIES.filter(e => isEntityOverlappingArea(e, checkArea));
  let matchedCount = cardsInArea.length;

  if (block.condType === 'has_card') {
    if (block.filterMode === 'tag_condition' && Array.isArray(block.tagConditions) && block.tagConditions.length > 0) {
      matchedCount = cardsInArea.filter(c => matchesTagConditions(c, block.tagConditions)).length;
    }
  }

  const op = block.countOp || '>=';
  const target = block.countVal ?? 1;

  switch (op) {
    case '>=': return matchedCount >= target;
    case '<=': return matchedCount <= target;
    case '==': return matchedCount === target;
    case '>': return matchedCount > target;
    case '<': return matchedCount < target;
    default: return matchedCount >= target;
  }
}

// ============================================================================
// Helpers & Math
// ============================================================================
function isEntityOverlappingArea(entity, area) {
  const ex1 = entity.x;
  const ey1 = entity.y;
  const ex2 = ex1 + (entity.w || 100);
  const ey2 = ey1 + (entity.h || 140);

  const ax1 = area.x;
  const ay1 = area.y;
  const ax2 = ax1 + (area.w || 200);
  const ay2 = ay1 + (area.h || 200);

  return !(ex2 < ax1 || ex1 > ax2 || ey2 < ay1 || ey1 > ay2);
}

function matchesTagConditions(entity, conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  let overallResult = true;

  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    const val = entity.tagValues ? entity.tagValues[c.tagName] : undefined;
    let singleMatch = false;

    if (val !== undefined && val !== null) {
      const numVal = parseFloat(val);
      const targetNum = parseFloat(c.value);
      if (!isNaN(numVal) && !isNaN(targetNum)) {
        if (c.op === '==') singleMatch = numVal === targetNum;
        if (c.op === '>') singleMatch = numVal > targetNum;
        if (c.op === '>=') singleMatch = numVal >= targetNum;
        if (c.op === '<') singleMatch = numVal < targetNum;
        if (c.op === '<=') singleMatch = numVal <= targetNum;
      } else {
        singleMatch = String(val).toLowerCase() === String(c.value).toLowerCase();
      }
    }

    if (i === 0) {
      overallResult = singleMatch;
    } else {
      if (c.logical === 'or') {
        overallResult = overallResult || singleMatch;
      } else {
        overallResult = overallResult && singleMatch;
      }
    }
  }

  return overallResult;
}

function placeEntitiesInArea(entities, destArea, placement) {
  const baseLeft = destArea.x + 10;
  const baseTop = destArea.y + 10;
  const spacing = 36;

  entities.forEach((ent, idx) => {
    if (placement === 'stack_center') {
      ent.x = destArea.x + (destArea.w - ent.w) / 2;
      ent.y = destArea.y + (destArea.h - ent.h) / 2;
    } else if (placement === 'spread_tb') {
      ent.x = baseLeft;
      ent.y = baseTop + idx * spacing;
    } else {
      // spread_lr
      ent.x = baseLeft + idx * spacing;
      ent.y = baseTop;
    }
    const dom = document.getElementById(ent.id);
    if (dom) {
      dom.style.left = `${ent.x}px`;
      dom.style.top = `${ent.y}px`;
    }
  });
}

function valueToRef(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (value.startsWith('own:')) return { kind: 'own', areaType: value.slice(4) };
  if (value.startsWith('area:')) return { kind: 'area', areaId: value.slice(5) };
  return null;
}

function resolveAreaRef(ref, actingPlayerOverride = null) {
  if (!ref) return null;
  if (ref.kind === 'area') return AREAS.find(a => a.id === ref.areaId) || null;
  if (ref.kind === 'own') {
    const me = actingPlayerOverride || CURRENT_ACTING_PLAYER || 'player1';
    return AREAS.find(a => a.type === ref.areaType && a.owner === me) || null;
  }
  return null;
}

function getOwnerLabel(ownerKey) {
  if (!ownerKey) return '共有';
  const m = ownerKey.match(/^player(\d+)$/);
  if (m) return `P${m[1]}`;
  return ownerKey;
}

function getAreaTypeName(typeKey) {
  const map = { hand: '手札', deck: '山札', discard: '捨て札', play: 'プレイ' };
  return map[typeKey] || typeKey;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function showToast(message) {
  let toast = document.getElementById('dev-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dev-toast';
    toast.className = 'dev-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function scheduleSaveRoom() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (!ROOM_DOC_PATH || isSavingRoom) return;
    isSavingRoom = true;
    try {
      const roomRef = doc(db, ROOM_DOC_PATH);
      await updateDoc(roomRef, {
        devEntities: ENTITIES,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Sync room failed:', e);
    } finally {
      isSavingRoom = false;
    }
  }, 400);
}
