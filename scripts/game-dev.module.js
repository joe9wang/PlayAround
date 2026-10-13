/**
 * ============================================================================
 * BatriTable Developer Mode (game-dev.module.js)
 * Standalone Engine & Logic for Game Schema, Areas, Automation & Properties
 * ============================================================================
 */

import {
  auth, db,
  onAuthStateChanged,
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp, onSnapshot
} from './firebase.init.js';

// === State ===
let CURRENT_ROOM = null;
let CURRENT_UID = null;
let ROOM_DATA = null;

// Viewport Transform State
let VIEW_X = 0;
let VIEW_Y = 0;
let VIEW_SCALE = 0.8;
let IS_PANNING = false;
let PAN_START_X = 0;
let PAN_START_Y = 0;

// Selection & Context Menu
let SELECTED_ENTITY_ID = null;
let CTX_TARGET_ENTITY_ID = null;

// Schemas & Definitions
let CARD_SCHEMAS = {
  type_trump: {
    id: 'type_trump',
    name: 'トランプ',
    tags: [
      { id: 'tag_mark', name: 'Mark', type: 'string' },
      { id: 'tag_number', name: 'Number', type: 'number' }
    ]
  }
};

let PLAY_BUTTONS = [];

// 「自分の〇〇エリア」を解決する際の操作プレイヤー（ブラウザごとに記憶）
const ACTING_PLAYER_STORAGE_KEY = 'pa:dev-acting-player';

let AREAS = [
  {
    id: 'area_play_center',
    type: 'play',
    owner: 'shared',
    name: '共有 プレイエリア',
    x: 1100,
    y: 900,
    w: 1000,
    h: 600
  }
];

let ENTITIES = []; // Cards, boards, pieces
let HIGHEST_Z = 10;

// === DOM Elements ===
const viewportEl = document.getElementById('canvas-viewport');
const rulerCanvas = document.getElementById('ruler-canvas');
const rulerCtx = rulerCanvas ? rulerCanvas.getContext('2d') : null;
const worldEl = document.getElementById('world');
const areasLayerEl = document.getElementById('areas-layer');
const entitiesLayerEl = document.getElementById('entities-layer');
const roomIdDisplay = document.getElementById('room-id-display');
const btnCopyRoomId = document.getElementById('btn-copy-room-id');
const btnExitLobby = document.getElementById('btn-exit-lobby');

// HUD
const hudZoomText = document.getElementById('hud-zoom-text');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');

// Top Bar Uploads
const btnUploadCard = document.getElementById('btn-upload-card');
const fileInputCard = document.getElementById('file-input-card');
const btnUploadBoard = document.getElementById('btn-upload-board');
const fileInputBoard = document.getElementById('file-input-board');
const btnUploadPiece = document.getElementById('btn-upload-piece');
const fileInputPiece = document.getElementById('file-input-piece');

// Context Menu
const ctxMenu = document.getElementById('dev-context-menu');
const ctxProperties = document.getElementById('ctx-properties');
const ctxRotate = document.getElementById('ctx-rotate');
const ctxFlip = document.getElementById('ctx-flip');
const ctxDelete = document.getElementById('ctx-delete');

// Modals
const modalAddArea = document.getElementById('modal-add-area');
const devAddAreaBtn = document.getElementById('dev-add-area-btn');
const btnConfirmAddArea = document.getElementById('btn-confirm-add-area');
const areaTypeSelect = document.getElementById('area-type-select');
const areaOwnerSelect = document.getElementById('area-owner-select');

const modalCardSchema = document.getElementById('modal-card-schema');
const devCardSchemaBtn = document.getElementById('dev-card-schema-btn');
const btnAddCardType = document.getElementById('btn-add-card-type');
const schemaTypesList = document.getElementById('schema-types-list');

const modalAddButton = document.getElementById('modal-add-button');
const devAddButtonBtn = document.getElementById('dev-add-button-btn');
const btnConfirmAddButton = document.getElementById('btn-confirm-add-button');
const btnDefLabel = document.getElementById('btn-def-label');
const btnDefTarget = document.getElementById('btn-def-target');
const btnDefAction = document.getElementById('btn-def-action');
const btnDefDest = document.getElementById('btn-def-dest');
const btnDefPlacement = document.getElementById('btn-def-placement');
const btnDefAngle = document.getElementById('btn-def-angle');
const btnDefAngleLabel = document.getElementById('btn-def-angle-label');
const btnDefDirection = document.getElementById('btn-def-direction');
const btnDefHint = document.getElementById('btn-def-hint');
const btnDefTargetGroup = document.getElementById('btn-def-target-group');
const btnDefDestGroup = document.getElementById('btn-def-dest-group');
const btnDefPlacementGroup = document.getElementById('btn-def-placement-group');
const btnDefAngleGroup = document.getElementById('btn-def-angle-group');
const btnDefDirectionGroup = document.getElementById('btn-def-direction-group');
const devActingPlayerSelect = document.getElementById('dev-acting-player');
const playButtonsContainer = document.getElementById('play-buttons-container');

const modalProperties = document.getElementById('modal-properties');
const propCardTypeSelect = document.getElementById('prop-card-type-select');
const propTagsContainer = document.getElementById('prop-tags-container');
const btnSaveProperties = document.getElementById('btn-save-properties');

// ============================================================================
// Initialization
// ============================================================================
async function init() {
  const params = new URLSearchParams(window.location.search);
  CURRENT_ROOM = params.get('id');

  if (!CURRENT_ROOM) {
    alert('ルームIDが指定されていません。ロビーに戻ります。');
    window.location.href = './lobby.html';
    return;
  }

  if (roomIdDisplay) roomIdDisplay.textContent = CURRENT_ROOM;

  // Window Resize & Viewport
  window.addEventListener('resize', handleResize);
  handleResize();
  centerWorldInViewport();

  // Setup Event Listeners
  setupViewportEvents();
  setupTopbarEvents();
  setupSidebarEvents();
  setupModalEvents();
  setupContextMenuEvents();

  // Auth Listener
  onAuthStateChanged(auth, async (user) => {
    const DEV_ACCOUNTS = ['joe9bk@gmail.com'];
    if (user && !user.isAnonymous && DEV_ACCOUNTS.includes(user.email)) {
      CURRENT_UID = user.uid;
      await loadRoomData();
    } else {
      CURRENT_UID = null;
      alert('開発者モードは現在、特定のアカウントのみ先行公開されています。ロビーへ戻ります。');
      window.location.href = './lobby.html';
    }
  });
}

// ============================================================================
// Firestore Persistence & Room Data
// ============================================================================
async function loadRoomData() {
  try {
    const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
    const snap = await getDoc(roomRef);

    if (snap.exists()) {
      ROOM_DATA = snap.data();
      if (ROOM_DATA.cardSchemas) CARD_SCHEMAS = ROOM_DATA.cardSchemas;
      if (ROOM_DATA.playButtons) PLAY_BUTTONS = ROOM_DATA.playButtons;
      if (ROOM_DATA.devAreas && ROOM_DATA.devAreas.length > 0) AREAS = ROOM_DATA.devAreas;
      if (ROOM_DATA.devEntities) ENTITIES = ROOM_DATA.devEntities;
    }

    renderAllAreas();
    renderAllEntities();
    renderPlayButtons();
    renderSchemaList();

    // Listen to remote changes
    onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      if (data.cardSchemas) CARD_SCHEMAS = data.cardSchemas;
      if (data.playButtons) {
        PLAY_BUTTONS = data.playButtons;
        renderPlayButtons();
      }
    });
  } catch (err) {
    console.warn('[DevMode] Load room data failed, using local state:', err);
    renderAllAreas();
    renderAllEntities();
    renderPlayButtons();
    renderSchemaList();
  }
}

let syncTimeout = null;
function scheduleSaveRoom() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (!CURRENT_ROOM) return;
    try {
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await setDoc(roomRef, {
        cardSchemas: CARD_SCHEMAS,
        playButtons: PLAY_BUTTONS,
        devAreas: AREAS,
        devEntities: ENTITIES,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('[DevMode] Sync failed:', e);
    }
  }, 500);
}

// ============================================================================
// Viewport & Ruler (マス目) Rendering
// ============================================================================
function handleResize() {
  if (!viewportEl || !rulerCanvas) return;
  rulerCanvas.width = viewportEl.clientWidth;
  rulerCanvas.height = viewportEl.clientHeight;
  drawRuler();
}

function updateWorldTransform() {
  if (!worldEl) return;
  worldEl.style.transform = `translate(${VIEW_X}px, ${VIEW_Y}px) scale(${VIEW_SCALE})`;
  if (hudZoomText) hudZoomText.textContent = `${Math.round(VIEW_SCALE * 100)}%`;
  drawRuler();
}

function centerWorldInViewport() {
  if (!viewportEl) return;
  const vw = viewportEl.clientWidth;
  const vh = viewportEl.clientHeight;
  VIEW_SCALE = 0.5;
  VIEW_X = (vw - 3200 * VIEW_SCALE) / 2;
  VIEW_Y = (vh - 2400 * VIEW_SCALE) / 2;
  updateWorldTransform();
}

function drawRuler() {
  if (!rulerCtx || !rulerCanvas) return;
  const w = rulerCanvas.width;
  const h = rulerCanvas.height;

  rulerCtx.clearRect(0, 0, w, h);

  const minorGrid = 50 * VIEW_SCALE;
  const majorGrid = 200 * VIEW_SCALE;

  const startX = VIEW_X % minorGrid;
  const startY = VIEW_Y % minorGrid;

  // Minor Grid Lines
  rulerCtx.beginPath();
  rulerCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  rulerCtx.lineWidth = 1;

  for (let x = startX; x < w; x += minorGrid) {
    rulerCtx.moveTo(x, 0);
    rulerCtx.lineTo(x, h);
  }
  for (let y = startY; y < h; y += minorGrid) {
    rulerCtx.moveTo(0, y);
    rulerCtx.lineTo(w, y);
  }
  rulerCtx.stroke();

  // Major Grid Lines
  const majorStartX = VIEW_X % majorGrid;
  const majorStartY = VIEW_Y % majorGrid;

  rulerCtx.beginPath();
  rulerCtx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
  rulerCtx.lineWidth = 1.2;

  for (let x = majorStartX; x < w; x += majorGrid) {
    rulerCtx.moveTo(x, 0);
    rulerCtx.lineTo(x, h);
  }
  for (let y = majorStartY; y < h; y += majorGrid) {
    rulerCtx.moveTo(0, y);
    rulerCtx.lineTo(w, y);
  }
  rulerCtx.stroke();

  // Coordinate Ticks along the top and left edges
  rulerCtx.fillStyle = 'rgba(167, 139, 250, 0.6)';
  rulerCtx.font = '10px monospace';

  for (let x = majorStartX; x < w; x += majorGrid) {
    const worldCoordX = Math.round((x - VIEW_X) / VIEW_SCALE);
    rulerCtx.fillText(`${worldCoordX}`, x + 4, 12);
  }
  for (let y = majorStartY; y < h; y += majorGrid) {
    const worldCoordY = Math.round((y - VIEW_Y) / VIEW_SCALE);
    rulerCtx.fillText(`${worldCoordY}`, 4, y - 4);
  }
}

function setupViewportEvents() {
  if (!viewportEl) return;

  // Panning with Middle Click or Right Drag or Left Drag on background
  viewportEl.addEventListener('mousedown', (e) => {
    if (e.target === viewportEl || e.target === rulerCanvas || e.target === worldEl || e.target.classList.contains('world-bounds')) {
      if (e.button === 0 || e.button === 1) { // Left or middle
        IS_PANNING = true;
        PAN_START_X = e.clientX - VIEW_X;
        PAN_START_Y = e.clientY - VIEW_Y;
        viewportEl.style.cursor = 'grabbing';
        deselectEntity();
        hideContextMenu();
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (IS_PANNING) {
      VIEW_X = e.clientX - PAN_START_X;
      VIEW_Y = e.clientY - PAN_START_Y;
      updateWorldTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (IS_PANNING) {
      IS_PANNING = false;
      viewportEl.style.cursor = 'default';
    }
  });

  // Wheel Zoom
  viewportEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(VIEW_SCALE * zoomFactor, 0.2), 3.0);

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    VIEW_X = mouseX - (mouseX - VIEW_X) * (newScale / VIEW_SCALE);
    VIEW_Y = mouseY - (mouseY - VIEW_Y) * (newScale / VIEW_SCALE);
    VIEW_SCALE = newScale;

    updateWorldTransform();
  }, { passive: false });

  // HUD Buttons
  btnZoomIn?.addEventListener('click', () => {
    VIEW_SCALE = Math.min(VIEW_SCALE * 1.2, 3.0);
    updateWorldTransform();
  });
  btnZoomOut?.addEventListener('click', () => {
    VIEW_SCALE = Math.max(VIEW_SCALE / 1.2, 0.2);
    updateWorldTransform();
  });
  btnZoomReset?.addEventListener('click', centerWorldInViewport);
}

// ============================================================================
// Topbar Events (Cards, Boards, Pieces)
// ============================================================================
function setupTopbarEvents() {
  btnCopyRoomId?.addEventListener('click', () => {
    if (CURRENT_ROOM) {
      navigator.clipboard.writeText(CURRENT_ROOM);
      alert(`ルームID「${CURRENT_ROOM}」をコピーしました！`);
    }
  });

  btnExitLobby?.addEventListener('click', () => {
    if (confirm('ロビー画面に戻りますか？')) {
      window.location.href = './lobby.html';
    }
  });

  // Upload Buttons triggering hidden file inputs
  btnUploadCard?.addEventListener('click', () => fileInputCard?.click());
  btnUploadBoard?.addEventListener('click', () => fileInputBoard?.click());
  btnUploadPiece?.addEventListener('click', () => fileInputPiece?.click());

  fileInputCard?.addEventListener('change', (e) => handleFileUpload(e, 'card'));
  fileInputBoard?.addEventListener('change', (e) => handleFileUpload(e, 'board'));
  fileInputPiece?.addEventListener('change', (e) => handleFileUpload(e, 'piece'));
}

async function handleFileUpload(e, type) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const vpCenterX = (-VIEW_X + (viewportEl?.clientWidth || 800) / 2) / VIEW_SCALE;
  const vpCenterY = (-VIEW_Y + (viewportEl?.clientHeight || 600) / 2) / VIEW_SCALE;

  let index = 0;
  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    HIGHEST_Z += 1;

    let entity = {
      id: entityId,
      type: type,
      x: vpCenterX + index * 25,
      y: vpCenterY + index * 25,
      z: HIGHEST_Z,
      angle: 0,
      frontUrl: dataUrl,
      backUrl: 'PlayExample.webp',
      isFaceDown: false
    };

    if (type === 'card') {
      entity.w = 120;
      entity.h = 160;
      entity.cardTypeId = '';
      entity.tagValues = {};
    } else if (type === 'piece') {
      entity.w = 60;
      entity.h = 60;
    } else if (type === 'board') {
      entity.w = 800;
      entity.h = 600;
      entity.z = 1; // Boards default to bottom
    }

    ENTITIES.push(entity);
    createEntityDOM(entity);
    index++;
  }

  e.target.value = '';
  scheduleSaveRoom();
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Area Management (Drag, Resize, Types)
// ============================================================================
function renderAllAreas() {
  if (!areasLayerEl) return;
  areasLayerEl.innerHTML = '';
  AREAS.forEach(area => createAreaDOM(area));
}

function getAreaTypeName(type) {
  switch (type) {
    case 'hand': return '手札エリア';
    case 'deck': return 'デッキエリア';
    case 'deck2': return 'デッキエリア2';
    case 'discard': return '捨て札エリア';
    case 'special': return '特殊エリア';
    case 'play': return 'プレイエリア';
    default: return 'エリア';
  }
}

function getOwnerLabel(owner) {
  if (owner === 'shared') return '共有';
  return owner.replace('player', 'P');
}

function createAreaDOM(area) {
  const el = document.createElement('div');
  el.className = `dev-area type-${area.type}`;
  el.id = area.id;
  el.style.left = `${area.x}px`;
  el.style.top = `${area.y}px`;
  el.style.width = `${area.w}px`;
  el.style.height = `${area.h}px`;

  el.innerHTML = `
    <div class="dev-area-header">
      <div>
        <span class="area-owner-badge">${getOwnerLabel(area.owner)}</span>
        <span>${area.name || getAreaTypeName(area.type)}</span>
      </div>
      <button class="area-delete-btn" title="エリアを削除">✕</button>
    </div>
    <div class="dev-area-body"></div>
    <div class="dev-resize-handle" title="ドラッグしてリサイズ"></div>
  `;

  // Delete button
  const delBtn = el.querySelector('.area-delete-btn');
  delBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`エリア「${area.name || getAreaTypeName(area.type)}」を削除しますか？`)) {
      AREAS = AREAS.filter(a => a.id !== area.id);
      el.remove();
      renderPlayButtons(); // 参照先が消えたボタンに警告を出す
      scheduleSaveRoom();
    }
  });

  // Area Header Drag (Move Area)
  const header = el.querySelector('.dev-area-header');
  let isDraggingArea = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialAreaX = 0;
  let initialAreaY = 0;

  header?.addEventListener('mousedown', (e) => {
    if (e.target === delBtn) return;
    e.stopPropagation();
    isDraggingArea = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialAreaX = area.x;
    initialAreaY = area.y;

    const onMove = (ev) => {
      if (!isDraggingArea) return;
      const dx = (ev.clientX - dragStartX) / VIEW_SCALE;
      const dy = (ev.clientY - dragStartY) / VIEW_SCALE;
      area.x = Math.round(initialAreaX + dx);
      area.y = Math.round(initialAreaY + dy);
      el.style.left = `${area.x}px`;
      el.style.top = `${area.y}px`;
    };

    const onUp = () => {
      isDraggingArea = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      scheduleSaveRoom();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // Area Resize Handle Drag
  const resizeHandle = el.querySelector('.dev-resize-handle');
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let initialW = 0;
  let initialH = 0;

  resizeHandle?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    initialW = area.w;
    initialH = area.h;

    const onMove = (ev) => {
      if (!isResizing) return;
      const dw = (ev.clientX - resizeStartX) / VIEW_SCALE;
      const dh = (ev.clientY - resizeStartY) / VIEW_SCALE;
      area.w = Math.max(120, Math.round(initialW + dw));
      area.h = Math.max(80, Math.round(initialH + dh));
      el.style.width = `${area.w}px`;
      el.style.height = `${area.h}px`;
    };

    const onUp = () => {
      isResizing = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      scheduleSaveRoom();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  areasLayerEl.appendChild(el);
}

// ============================================================================
// Entity Rendering (Cards, Boards, Pieces) & Badges
// ============================================================================
function renderAllEntities() {
  if (!entitiesLayerEl) return;
  entitiesLayerEl.innerHTML = '';
  ENTITIES.forEach(entity => createEntityDOM(entity));
}

function createEntityDOM(entity) {
  const el = document.createElement('div');
  el.className = `dev-entity dev-${entity.type}`;
  el.id = entity.id;
  el.style.left = `${entity.x}px`;
  el.style.top = `${entity.y}px`;
  el.style.width = `${entity.w}px`;
  el.style.height = `${entity.h}px`;
  el.style.zIndex = entity.z;
  el.style.transform = `rotate(${entity.angle || 0}deg)`;

  updateEntityInnerDOM(el, entity);

  // Left click selection & drag
  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      e.stopPropagation();
      selectEntity(entity.id);
      HIGHEST_Z += 1;
      entity.z = HIGHEST_Z;
      el.style.zIndex = entity.z;

      let isDragging = true;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const initX = entity.x;
      const initY = entity.y;

      const onMove = (ev) => {
        if (!isDragging) return;
        const dx = (ev.clientX - startClientX) / VIEW_SCALE;
        const dy = (ev.clientY - startClientY) / VIEW_SCALE;
        entity.x = Math.round(initX + dx);
        entity.y = Math.round(initY + dy);
        el.style.left = `${entity.x}px`;
        el.style.top = `${entity.y}px`;
      };

      const onUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        scheduleSaveRoom();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  });

  // Right click context menu (Properties)
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectEntity(entity.id);
    showContextMenu(e.clientX, e.clientY, entity.id);
  });

  entitiesLayerEl.appendChild(el);
}

function updateEntityInnerDOM(el, entity) {
  const displayUrl = entity.isFaceDown ? (entity.backUrl || 'PlayExample.webp') : entity.frontUrl;

  let badgeHTML = '';
  if (entity.type === 'card' && entity.cardTypeId && CARD_SCHEMAS[entity.cardTypeId]) {
    const schema = CARD_SCHEMAS[entity.cardTypeId];
    const tagsText = Object.entries(entity.tagValues || {})
      .map(([tId, val]) => {
        const tagDef = schema.tags.find(t => t.id === tId);
        return `${tagDef?.name || tId}:${val}`;
      })
      .join(' | ');

    badgeHTML = `
      <div class="dev-card-badge">
        <div class="badge-type">${schema.name}</div>
        <div class="badge-tags">${tagsText || '(値未設定)'}</div>
      </div>
    `;
  }

  el.innerHTML = `
    <img src="${displayUrl}" class="dev-card-img" alt="${entity.type}" draggable="false" />
    ${badgeHTML}
  `;
}

function selectEntity(id) {
  SELECTED_ENTITY_ID = id;
  document.querySelectorAll('.dev-entity').forEach(el => {
    el.classList.toggle('selected', el.id === id);
  });
}

function deselectEntity() {
  SELECTED_ENTITY_ID = null;
  document.querySelectorAll('.dev-entity').forEach(el => el.classList.remove('selected'));
}

// ============================================================================
// Context Menu (Right Click on Card/Board/Piece)
// ============================================================================
function setupContextMenuEvents() {
  window.addEventListener('click', (e) => {
    if (!ctxMenu?.contains(e.target)) hideContextMenu();
  });

  ctxProperties?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = CTX_TARGET_ENTITY_ID;
    hideContextMenu();
    if (targetId) openPropertiesModal(targetId);
  });

  ctxRotate?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = CTX_TARGET_ENTITY_ID;
    hideContextMenu();
    const ent = ENTITIES.find(e => e.id === targetId);
    if (ent) {
      ent.angle = ((ent.angle || 0) + 90) % 360;
      const dom = document.getElementById(ent.id);
      if (dom) dom.style.transform = `rotate(${ent.angle}deg)`;
      scheduleSaveRoom();
    }
  });

  ctxFlip?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = CTX_TARGET_ENTITY_ID;
    hideContextMenu();
    const ent = ENTITIES.find(e => e.id === targetId);
    if (ent && ent.type === 'card') {
      ent.isFaceDown = !ent.isFaceDown;
      const dom = document.getElementById(ent.id);
      if (dom) updateEntityInnerDOM(dom, ent);
      scheduleSaveRoom();
    }
  });

  ctxDelete?.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = CTX_TARGET_ENTITY_ID;
    hideContextMenu();
    const ent = ENTITIES.find(e => e.id === targetId);
    if (ent) {
      ENTITIES = ENTITIES.filter(e => e.id !== ent.id);
      document.getElementById(ent.id)?.remove();
      scheduleSaveRoom();
    }
  });
}

function showContextMenu(x, y, entityId) {
  if (!ctxMenu) return;
  CTX_TARGET_ENTITY_ID = entityId;
  ctxMenu.style.display = 'block';
  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top = `${y}px`;
}

function hideContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none';
  CTX_TARGET_ENTITY_ID = null;
}

// ============================================================================
// Modals & Panels Event Handlers
// ============================================================================
function setupSidebarEvents() {
  // Area Modal
  devAddAreaBtn?.addEventListener('click', () => {
    if (modalAddArea) modalAddArea.style.display = 'flex';
  });

  // Card Schemas Modal
  devCardSchemaBtn?.addEventListener('click', () => {
    renderSchemaList();
    if (modalCardSchema) modalCardSchema.style.display = 'flex';
  });

  // Play Button Modal
  devAddButtonBtn?.addEventListener('click', () => {
    openAddButtonModal();
  });

  // 操作プレイヤー（「自分の〜エリア」の解決に使用）
  if (devActingPlayerSelect) {
    const saved = localStorage.getItem(ACTING_PLAYER_STORAGE_KEY);
    if (saved && devActingPlayerSelect.querySelector(`option[value="${saved}"]`)) {
      devActingPlayerSelect.value = saved;
    }
    devActingPlayerSelect.addEventListener('change', () => {
      localStorage.setItem(ACTING_PLAYER_STORAGE_KEY, devActingPlayerSelect.value);
    });
  }
}

function setupModalEvents() {
  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const target = document.getElementById(modalId);
      if (target) target.style.display = 'none';
    });
  });

  // Confirm Add Area
  btnConfirmAddArea?.addEventListener('click', () => {
    const type = areaTypeSelect?.value || 'hand';
    const owner = areaOwnerSelect?.value || 'shared';
    const areaId = `area_${Date.now()}`;

    const vpCenterX = (-VIEW_X + (viewportEl?.clientWidth || 800) / 2) / VIEW_SCALE;
    const vpCenterY = (-VIEW_Y + (viewportEl?.clientHeight || 600) / 2) / VIEW_SCALE;

    let w = 400;
    let h = 200;
    if (type === 'deck' || type === 'deck2' || type === 'discard') {
      w = 180;
      h = 240;
    } else if (type === 'special') {
      w = 300;
      h = 300;
    }

    const newArea = {
      id: areaId,
      type: type,
      owner: owner,
      name: `${getOwnerLabel(owner)} ${getAreaTypeName(type)}`,
      x: Math.round(vpCenterX - w / 2),
      y: Math.round(vpCenterY - h / 2),
      w: w,
      h: h
    };

    AREAS.push(newArea);
    createAreaDOM(newArea);
    renderPlayButtons();
    if (modalAddArea) modalAddArea.style.display = 'none';
    scheduleSaveRoom();
  });

  // Card Schema: Add Card Type
  btnAddCardType?.addEventListener('click', () => {
    const typeName = prompt('新規カードタイプ名を入力してください（例: トランプ、ユニット、モンスター）:');
    if (!typeName || !typeName.trim()) return;

    const typeId = `type_${Date.now()}`;
    CARD_SCHEMAS[typeId] = {
      id: typeId,
      name: typeName.trim(),
      tags: []
    };

    renderSchemaList();
    scheduleSaveRoom();
  });

  // Play Button: 動的フォーム
  btnDefAction?.addEventListener('change', updateButtonFormVisibility);
  btnDefTarget?.addEventListener('change', () => { rebuildDestOptions(); updateButtonFormHint(); });
  btnDefDest?.addEventListener('change', updateButtonFormHint);
  btnDefAngle?.addEventListener('input', syncAnglePresetActive);
  document.querySelectorAll('.angle-preset').forEach(chip => {
    chip.addEventListener('click', () => {
      if (btnDefAngle) btnDefAngle.value = chip.getAttribute('data-angle');
      syncAnglePresetActive();
    });
  });

  // Play Button: Confirm Add Button
  btnConfirmAddButton?.addEventListener('click', confirmAddPlayButton);

  // Save Properties
  btnSaveProperties?.addEventListener('click', saveEntityProperties);
}

// ============================================================================
// Card Schema Manager (カード全般設定: タイプ & タグ)
// ============================================================================
function renderSchemaList() {
  if (!schemaTypesList) return;
  schemaTypesList.innerHTML = '';

  const typeEntries = Object.entries(CARD_SCHEMAS);
  if (typeEntries.length === 0) {
    schemaTypesList.innerHTML = '<div class="empty-notice">カードタイプが未登録です。「カードタイプ追加」を押してください。</div>';
    return;
  }

  typeEntries.forEach(([typeId, schema]) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'schema-card';

    const tagsHtml = schema.tags.map(tag => `
      <div class="tag-item">
        <span style="color:#a78bfa; font-weight:700;">🏷️ ${tag.name}</span>
        <span style="font-size:11px; color:#94a3b8;">(${tag.type})</span>
        <button class="action-btn secondary btn-del-tag" data-type="${typeId}" data-tag="${tag.id}" style="width:auto; padding:2px 6px; font-size:11px; margin-left:auto;">削除</button>
      </div>
    `).join('');

    cardEl.innerHTML = `
      <div class="schema-card-header">
        <div style="font-size:14px; font-weight:700; color:#fff;">🗃️ ${schema.name}</div>
        <div style="display:flex; gap:6px;">
          <button class="action-btn secondary btn-add-tag" data-type="${typeId}" style="width:auto; padding:4px 8px; font-size:11px;">➕ タグ追加</button>
          <button class="action-btn secondary btn-del-type" data-type="${typeId}" style="width:auto; padding:4px 8px; font-size:11px; color:#f87171;">削除</button>
        </div>
      </div>
      <div class="tag-list">
        ${tagsHtml || '<div style="font-size:11px; color:#6b7280;">タグがありません。「タグ追加」を押してください。</div>'}
      </div>
    `;

    // Add Tag
    cardEl.querySelector('.btn-add-tag')?.addEventListener('click', () => {
      const tagName = prompt(`「${schema.name}」に追加するタグ名を入力してください（例: Mark, Number, Cost）:`);
      if (!tagName || !tagName.trim()) return;

      const tagId = `tag_${Date.now()}`;
      schema.tags.push({
        id: tagId,
        name: tagName.trim(),
        type: 'string'
      });

      renderSchemaList();
      scheduleSaveRoom();
    });

    // Delete Type
    cardEl.querySelector('.btn-del-type')?.addEventListener('click', () => {
      if (confirm(`カードタイプ「${schema.name}」を削除しますか？`)) {
        delete CARD_SCHEMAS[typeId];
        renderSchemaList();
        scheduleSaveRoom();
      }
    });

    // Delete Tag
    cardEl.querySelectorAll('.btn-del-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.getAttribute('data-tag');
        schema.tags = schema.tags.filter(t => t.id !== tId);
        renderSchemaList();
        scheduleSaveRoom();
      });
    });

    schemaTypesList.appendChild(cardEl);
  });
}

// ============================================================================
// Play Buttons Management & Execution (プレイ用ボタン)
// ============================================================================
// ---- 参照（対象・移動先）のエンコード ----
// 'selected'            : 選択中のカード
// 'own:<areaType>'      : 自分（操作プレイヤー）の〇〇エリア
// 'area:<areaId>'       : 特定のエリア
function refToValue(ref) {
  if (!ref) return '';
  if (ref.kind === 'selected') return 'selected';
  if (ref.kind === 'own') return `own:${ref.areaType}`;
  if (ref.kind === 'area') return `area:${ref.areaId}`;
  return '';
}

function valueToRef(value) {
  if (!value) return null;
  if (value === 'selected') return { kind: 'selected' };
  if (value.startsWith('own:')) return { kind: 'own', areaType: value.slice(4) };
  if (value.startsWith('area:')) return { kind: 'area', areaId: value.slice(5) };
  return null;
}

function getActingPlayer() {
  return devActingPlayerSelect?.value || 'player1';
}

function getAreaDisplayName(area) {
  return area.name || `${getOwnerLabel(area.owner)} ${getAreaTypeName(area.type)}`;
}

// プレイヤー所属のエリアが1つでもある種類（＝「自分の〇〇エリア」を選択肢に出せる種類）
function getOwnableAreaTypes() {
  const types = [];
  AREAS.forEach(a => {
    if (a.owner && a.owner.startsWith('player') && !types.includes(a.type)) types.push(a.type);
  });
  return types;
}

function refLabel(ref) {
  if (!ref) return '（未設定）';
  if (ref.kind === 'selected') return '選択中のカード';
  if (ref.kind === 'own') return `自分の${getAreaTypeName(ref.areaType)}`;
  if (ref.kind === 'area') {
    const area = AREAS.find(a => a.id === ref.areaId);
    return area ? getAreaDisplayName(area) : '（削除済みエリア）';
  }
  return '（不明）';
}

function resolveAreaRef(ref) {
  if (!ref) return null;
  if (ref.kind === 'area') return AREAS.find(a => a.id === ref.areaId) || null;
  if (ref.kind === 'own') {
    const me = getActingPlayer();
    return AREAS.find(a => a.type === ref.areaType && a.owner === me) || null;
  }
  return null;
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
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

const ACTION_LABELS = {
  move: '移動',
  flip_toggle: '裏表を変える',
  flip_down: '裏にする',
  flip_up: '表にする',
  rotate: '回転',
  set_angle: '向きをそろえる'
};

// 旧形式（target: 'all_hand' / action: 'rotate_90' など）のボタンを新形式へ変換
function normalizeButtonDef(def) {
  if (!def || typeof def !== 'object') return def;
  if (def.target && typeof def.target === 'object') return def; // 既に新形式

  const out = { id: def.id, label: def.label };
  out.target = def.target === 'selected'
    ? { kind: 'selected' }
    : { kind: 'own', areaType: 'hand' };

  const findAreaRef = (type) => {
    const area = AREAS.find(a => a.type === type);
    return area ? { kind: 'area', areaId: area.id } : { kind: 'own', areaType: type };
  };

  switch (def.action) {
    case 'rotate_90': Object.assign(out, { action: 'rotate', angle: 90, direction: 'cw' }); break;
    case 'rotate_180': Object.assign(out, { action: 'rotate', angle: 180, direction: 'cw' }); break;
    case 'move_discard': Object.assign(out, { action: 'move', dest: findAreaRef('discard'), placement: 'auto' }); break;
    case 'move_deck': Object.assign(out, { action: 'move', dest: findAreaRef('deck'), placement: 'auto' }); break;
    default: out.action = def.action || 'flip_toggle';
  }
  return out;
}

// ボタンが実行不能になっていないか（参照エリアの削除など）
function getButtonIssue(def) {
  const check = (ref, role) => {
    if (!ref) return `${role}が未設定です`;
    if (ref.kind === 'area' && !AREAS.some(a => a.id === ref.areaId)) {
      return `${role}のエリアが削除されています`;
    }
    if (ref.kind === 'own' && !AREAS.some(a => a.type === ref.areaType && a.owner?.startsWith('player'))) {
      return `プレイヤー用の${getAreaTypeName(ref.areaType)}がありません`;
    }
    return null;
  };
  return check(def.target, '対象') || (def.action === 'move' ? check(def.dest, '移動先') : null);
}

function describeButton(def) {
  let text = `${ACTION_LABELS[def.action] || def.action}：${refLabel(def.target)}`;
  if (def.action === 'move') text += ` → ${refLabel(def.dest)}`;
  if (def.action === 'rotate') text += ` ${def.direction === 'ccw' ? '左' : '右'}${def.angle}°`;
  if (def.action === 'set_angle') text += ` ${def.angle}°`;
  return text;
}

// ---- モーダル（動的フォーム） ----
function openAddButtonModal() {
  if (btnDefLabel) btnDefLabel.value = '';
  if (btnDefAction) btnDefAction.value = 'move';
  if (btnDefPlacement) btnDefPlacement.value = 'auto';
  if (btnDefAngle) btnDefAngle.value = '90';
  if (btnDefDirection) btnDefDirection.value = 'cw';
  rebuildTargetOptions();
  rebuildDestOptions();
  updateButtonFormVisibility();
  syncAnglePresetActive();
  if (modalAddButton) modalAddButton.style.display = 'flex';
  btnDefLabel?.focus();
}

function fillSelect(selectEl, options, preferredValue) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach(opt => {
    if (opt.group) {
      const og = document.createElement('optgroup');
      og.label = opt.group;
      opt.items.forEach(item => {
        const o = document.createElement('option');
        o.value = item.value;
        o.textContent = item.label;
        og.appendChild(o);
      });
      if (opt.items.length > 0) selectEl.appendChild(og);
    } else {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      selectEl.appendChild(o);
    }
  });
  if (preferredValue && selectEl.querySelector(`option[value="${CSS.escape(preferredValue)}"]`)) {
    selectEl.value = preferredValue;
  }
}

function buildAreaRefOptions(suffix, excludeValue) {
  const ownItems = getOwnableAreaTypes()
    .map(type => ({ value: `own:${type}`, label: `自分の${getAreaTypeName(type)}${suffix}` }))
    .filter(item => item.value !== excludeValue);
  const areaItems = AREAS
    .map(area => ({ value: `area:${area.id}`, label: `${getAreaDisplayName(area)}${suffix}` }))
    .filter(item => item.value !== excludeValue);
  return [
    { group: '自分のエリア（押した人に合わせて変わる）', items: ownItems },
    { group: 'フィールド上のエリア', items: areaItems }
  ];
}

function rebuildTargetOptions() {
  const prev = btnDefTarget?.value;
  fillSelect(btnDefTarget, [
    { value: 'selected', label: '選択中のカード' },
    ...buildAreaRefOptions('の全カード', null)
  ], prev);
}

function rebuildDestOptions() {
  const prev = btnDefDest?.value;
  const targetValue = btnDefTarget?.value;
  // 移動元と同じエリアは移動先に出さない
  fillSelect(btnDefDest, buildAreaRefOptions('', targetValue), prev);
}

function updateButtonFormVisibility() {
  const action = btnDefAction?.value || 'move';
  const show = (el, visible) => { if (el) el.style.display = visible ? '' : 'none'; };

  show(btnDefTargetGroup, true);
  show(btnDefDestGroup, action === 'move');
  show(btnDefPlacementGroup, action === 'move');
  show(btnDefAngleGroup, action === 'rotate' || action === 'set_angle');
  show(btnDefDirectionGroup, action === 'rotate');

  if (btnDefAngleLabel) {
    btnDefAngleLabel.textContent = action === 'set_angle'
      ? 'そろえる向き（0°＝縦向き／右回りの角度）'
      : '回転量（どれくらい）';
  }
  updateButtonFormHint();
}

function updateButtonFormHint() {
  if (!btnDefHint) return;
  const action = btnDefAction?.value;
  let hint = '';
  if (AREAS.length === 0) {
    hint = 'フィールドにエリアがありません。「エリア追加」で作成すると、ここに選択肢として表示されます。';
  } else if (action === 'move' && (!btnDefDest || btnDefDest.options.length === 0)) {
    hint = '移動先にできるエリアがありません。別のエリアを追加してください。';
  }
  btnDefHint.textContent = hint;
}

function syncAnglePresetActive() {
  const val = String(parseInt(btnDefAngle?.value, 10));
  document.querySelectorAll('.angle-preset').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-angle') === val);
  });
}

function confirmAddPlayButton() {
  const label = (btnDefLabel?.value || '').trim();
  if (!label) {
    alert('ボタン名を入力してください。');
    return;
  }

  const action = btnDefAction?.value || 'move';
  const target = valueToRef(btnDefTarget?.value);
  if (!target) {
    alert('対象（なにを）を選択してください。');
    return;
  }

  const newBtn = { id: `btn_${Date.now()}`, label, action, target };

  if (action === 'move') {
    const dest = valueToRef(btnDefDest?.value);
    if (!dest) {
      alert('移動先（どこに）を選択してください。');
      return;
    }
    if (refToValue(dest) === refToValue(target)) {
      alert('移動元と移動先が同じエリアです。');
      return;
    }
    newBtn.dest = dest;
    newBtn.placement = btnDefPlacement?.value || 'auto';
  }

  if (action === 'rotate' || action === 'set_angle') {
    const angle = parseInt(btnDefAngle?.value, 10);
    if (Number.isNaN(angle) || angle < 0 || angle > 360) {
      alert('角度は 0〜360 の数値で入力してください。');
      return;
    }
    if (action === 'rotate' && angle % 360 === 0) {
      alert('0° / 360° の回転では向きが変わりません。別の角度を指定してください。');
      return;
    }
    newBtn.angle = angle % 360;
    if (action === 'rotate') newBtn.direction = btnDefDirection?.value === 'ccw' ? 'ccw' : 'cw';
  }

  PLAY_BUTTONS.push(newBtn);
  renderPlayButtons();
  if (modalAddButton) modalAddButton.style.display = 'none';
  scheduleSaveRoom();
}

// ---- サイドバーのボタン一覧 ----
function renderPlayButtons() {
  if (!playButtonsContainer) return;
  playButtonsContainer.innerHTML = '';

  PLAY_BUTTONS = PLAY_BUTTONS.map(normalizeButtonDef);

  if (PLAY_BUTTONS.length === 0) {
    playButtonsContainer.innerHTML = '<div class="empty-notice">ボタンが未設定です</div>';
    return;
  }

  PLAY_BUTTONS.forEach(btnDef => {
    const issue = getButtonIssue(btnDef);
    const item = document.createElement('div');
    item.className = `play-btn-item${issue ? ' is-broken' : ''}`;
    item.title = issue ? `⚠ ${issue}` : describeButton(btnDef);
    item.innerHTML = `
      <span class="play-btn-label">
        <span>${issue ? '⚠' : '▶'} ${escapeHtml(btnDef.label)}</span>
        <span class="play-btn-sub">${escapeHtml(issue || describeButton(btnDef))}</span>
      </span>
      <button class="play-btn-delete" title="このボタンを削除">✕</button>
    `;

    // Click to execute action
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('play-btn-delete')) return;
      if (issue) {
        showToast(`このボタンは実行できません：${issue}`);
        return;
      }
      executePlayAction(btnDef);
    });

    // Delete button
    item.querySelector('.play-btn-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      PLAY_BUTTONS = PLAY_BUTTONS.filter(b => b.id !== btnDef.id);
      renderPlayButtons();
      scheduleSaveRoom();
    });

    playButtonsContainer.appendChild(item);
  });
}

// ---- 実行 ----
function getCardsInArea(area) {
  return ENTITIES.filter(ent => ent.type === 'card' && isEntityOverlappingArea(ent, area));
}

function applyEntityPosition(ent) {
  const dom = document.getElementById(ent.id);
  if (!dom) return;
  dom.style.left = `${ent.x}px`;
  dom.style.top = `${ent.y}px`;
  dom.style.zIndex = ent.z;
}

function applyEntityAngle(ent) {
  const dom = document.getElementById(ent.id);
  if (dom) dom.style.transform = `rotate(${ent.angle || 0}deg)`;
}

function placeEntitiesInArea(movingEnts, area, placement) {
  const mode = placement === 'auto' || !placement
    ? (area.type === 'hand' ? 'spread' : 'stack')
    : placement;

  if (mode === 'stack') {
    movingEnts.forEach(ent => {
      const w = ent.w || 120;
      const h = ent.h || 160;
      ent.x = Math.round(area.x + area.w / 2 - w / 2);
      ent.y = Math.round(area.y + area.h / 2 - h / 2);
      HIGHEST_Z += 1;
      ent.z = HIGHEST_Z;
      applyEntityPosition(ent);
    });
    return;
  }

  // spread: 既にエリア内にあるカードも含めて横一列に並べ直す（重なり防止）
  const movingIds = new Set(movingEnts.map(e => e.id));
  const existing = getCardsInArea(area)
    .filter(e => !movingIds.has(e.id))
    .sort((a, b) => a.x - b.x);
  const all = [...existing, ...movingEnts];
  const n = all.length;
  if (n === 0) return;

  const cardW = Math.max(...all.map(e => e.w || 120));
  const gap = 10;
  const padding = 10;
  const usable = Math.max(area.w - padding * 2, cardW);
  let step = cardW + gap;
  if (n > 1 && cardW + step * (n - 1) > usable) {
    step = (usable - cardW) / (n - 1); // 入りきらない場合は重ねて詰める
  }
  const totalW = cardW + step * (n - 1);
  const startX = area.x + (area.w - totalW) / 2;

  all.forEach((ent, i) => {
    const h = ent.h || 160;
    ent.x = Math.round(startX + step * i);
    ent.y = Math.round(area.y + area.h / 2 - h / 2);
    HIGHEST_Z += 1;
    ent.z = HIGHEST_Z;
    applyEntityPosition(ent);
  });
}

function executePlayAction(rawDef) {
  const btnDef = normalizeButtonDef(rawDef);
  let targets = [];

  if (btnDef.target?.kind === 'selected') {
    const ent = SELECTED_ENTITY_ID ? ENTITIES.find(e => e.id === SELECTED_ENTITY_ID) : null;
    if (!ent) {
      showToast('カードを選択してください');
      return;
    }
    targets = [ent];
  } else {
    const srcArea = resolveAreaRef(btnDef.target);
    if (!srcArea) {
      showToast(btnDef.target?.kind === 'own'
        ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.target.areaType)}がありません`
        : '対象のエリアが見つかりません');
      return;
    }
    targets = getCardsInArea(srcArea);
    if (targets.length === 0) {
      showToast(`${getAreaDisplayName(srcArea)}にカードがありません`);
      return;
    }
  }

  switch (btnDef.action) {
    case 'move': {
      const destArea = resolveAreaRef(btnDef.dest);
      if (!destArea) {
        showToast(btnDef.dest?.kind === 'own'
          ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.dest.areaType)}がありません`
          : '移動先のエリアが見つかりません');
        return;
      }
      placeEntitiesInArea(targets, destArea, btnDef.placement);
      break;
    }
    case 'flip_toggle':
    case 'flip_down':
    case 'flip_up':
      targets.forEach(ent => {
        if (ent.type !== 'card') return;
        if (btnDef.action === 'flip_toggle') ent.isFaceDown = !ent.isFaceDown;
        else ent.isFaceDown = (btnDef.action === 'flip_down');
        const dom = document.getElementById(ent.id);
        if (dom) updateEntityInnerDOM(dom, ent);
      });
      break;
    case 'rotate': {
      const delta = (Number(btnDef.angle) || 0) * (btnDef.direction === 'ccw' ? -1 : 1);
      targets.forEach(ent => {
        ent.angle = (((ent.angle || 0) + delta) % 360 + 360) % 360;
        applyEntityAngle(ent);
      });
      break;
    }
    case 'set_angle': {
      const angle = ((Number(btnDef.angle) || 0) % 360 + 360) % 360;
      targets.forEach(ent => {
        ent.angle = angle;
        applyEntityAngle(ent);
      });
      break;
    }
    default:
      showToast('未対応の動作です');
      return;
  }

  scheduleSaveRoom();
}

function isEntityOverlappingArea(ent, area) {
  const w = ent.w || 120;
  const h = ent.h || 160;
  return !(
    ent.x + w < area.x ||
    ent.x > area.x + area.w ||
    ent.y + h < area.y ||
    ent.y > area.y + area.h
  );
}

function isPointInArea(px, py, area) {
  return px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h;
}

// ============================================================================
// Entity Properties Inspector (カードタイプ・各タグ値入力)
// ============================================================================
let INSPECTING_ENTITY_ID = null;

function openPropertiesModal(entityId) {
  INSPECTING_ENTITY_ID = entityId;
  const entity = ENTITIES.find(e => e.id === entityId);
  if (!entity || !modalProperties) return;

  const titleEl = document.getElementById('prop-modal-title');
  if (titleEl) {
    titleEl.textContent = `${entity.type === 'card' ? '🃏 カード' : entity.type === 'board' ? '🗺️ ボード' : '♟ コマ'} プロパティ`;
  }

  // Populate Card Types Select
  if (propCardTypeSelect) {
    propCardTypeSelect.innerHTML = '<option value="">(なし / 一般画像)</option>';
    Object.entries(CARD_SCHEMAS).forEach(([typeId, schema]) => {
      const opt = document.createElement('option');
      opt.value = typeId;
      opt.textContent = schema.name;
      if (entity.cardTypeId === typeId) opt.selected = true;
      propCardTypeSelect.appendChild(opt);
    });

    propCardTypeSelect.onchange = () => renderPropertyTags(propCardTypeSelect.value, entity);
    renderPropertyTags(propCardTypeSelect.value, entity);
  }

  modalProperties.style.display = 'flex';
}

function renderPropertyTags(cardTypeId, entity) {
  if (!propTagsContainer) return;
  propTagsContainer.innerHTML = '';

  if (!cardTypeId || !CARD_SCHEMAS[cardTypeId]) {
    propTagsContainer.innerHTML = '<div style="font-size:12px; color:#6b7280; padding:8px;">カードタイプを選択すると属性（タグ）の入力欄が表示されます。</div>';
    return;
  }

  const schema = CARD_SCHEMAS[cardTypeId];
  if (schema.tags.length === 0) {
    propTagsContainer.innerHTML = '<div style="font-size:12px; color:#6b7280; padding:8px;">このタイプにはタグが定義されていません。「カード全般設定」からタグを追加できます。</div>';
    return;
  }

  schema.tags.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'prop-tag-row';
    const currentVal = (entity.tagValues && entity.tagValues[tag.id] !== undefined) ? entity.tagValues[tag.id] : '';

    row.innerHTML = `
      <span class="prop-tag-name">${tag.name}</span>
      <input type="text" class="prop-tag-input" data-tag-id="${tag.id}" value="${currentVal}" placeholder="値を入力" />
    `;
    propTagsContainer.appendChild(row);
  });
}

function saveEntityProperties() {
  if (!INSPECTING_ENTITY_ID) return;
  const entity = ENTITIES.find(e => e.id === INSPECTING_ENTITY_ID);
  if (!entity) return;

  if (entity.type === 'card') {
    entity.cardTypeId = propCardTypeSelect?.value || '';
    entity.tagValues = {};

    document.querySelectorAll('.prop-tag-input').forEach(input => {
      const tId = input.getAttribute('data-tag-id');
      if (tId) entity.tagValues[tId] = input.value.trim();
    });

    const dom = document.getElementById(entity.id);
    if (dom) updateEntityInnerDOM(dom, entity);
  }

  if (modalProperties) modalProperties.style.display = 'none';
  scheduleSaveRoom();
}

// Start
init();
