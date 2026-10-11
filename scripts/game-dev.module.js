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
    if (user) {
      CURRENT_UID = user.uid;
      await loadRoomData();
    } else {
      CURRENT_UID = null;
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
    if (btnDefLabel) btnDefLabel.value = '';
    if (modalAddButton) modalAddButton.style.display = 'flex';
  });
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

  // Play Button: Confirm Add Button
  btnConfirmAddButton?.addEventListener('click', () => {
    const label = (btnDefLabel?.value || '').trim();
    if (!label) {
      alert('ボタン名を入力してください。');
      return;
    }

    const newBtn = {
      id: `btn_${Date.now()}`,
      label: label,
      target: btnDefTarget?.value || 'all_hand',
      action: btnDefAction?.value || 'flip_toggle'
    };

    PLAY_BUTTONS.push(newBtn);
    renderPlayButtons();
    if (modalAddButton) modalAddButton.style.display = 'none';
    scheduleSaveRoom();
  });

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
function renderPlayButtons() {
  if (!playButtonsContainer) return;
  playButtonsContainer.innerHTML = '';

  if (PLAY_BUTTONS.length === 0) {
    playButtonsContainer.innerHTML = '<div class="empty-notice">ボタンが未設定です</div>';
    return;
  }

  PLAY_BUTTONS.forEach(btnDef => {
    const item = document.createElement('div');
    item.className = 'play-btn-item';
    item.innerHTML = `
      <span>▶ ${btnDef.label}</span>
      <button class="play-btn-delete" title="このボタンを削除">✕</button>
    `;

    // Click to execute action
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('play-btn-delete')) return;
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

function executePlayAction(btnDef) {
  let targets = [];

  if (btnDef.target === 'selected') {
    if (SELECTED_ENTITY_ID) {
      const ent = ENTITIES.find(e => e.id === SELECTED_ENTITY_ID);
      if (ent) targets.push(ent);
    }
  } else if (btnDef.target === 'all_hand') {
    // Collect all cards currently overlapping any hand area
    const handAreas = AREAS.filter(a => a.type === 'hand');
    targets = ENTITIES.filter(ent => {
      if (ent.type !== 'card') return false;
      return handAreas.some(area => isPointInArea(ent.x + ent.w / 2, ent.y + ent.h / 2, area));
    });
  }

  if (targets.length === 0) {
    alert(`対象となるカードがありません（対象設定: ${btnDef.target === 'selected' ? '選択カード' : '手札内のカード'}）`);
    return;
  }

  targets.forEach(ent => {
    const dom = document.getElementById(ent.id);
    switch (btnDef.action) {
      case 'flip_toggle':
        ent.isFaceDown = !ent.isFaceDown;
        if (dom) updateEntityInnerDOM(dom, ent);
        break;
      case 'flip_down':
        ent.isFaceDown = true;
        if (dom) updateEntityInnerDOM(dom, ent);
        break;
      case 'flip_up':
        ent.isFaceDown = false;
        if (dom) updateEntityInnerDOM(dom, ent);
        break;
      case 'rotate_90':
        ent.angle = ((ent.angle || 0) + 90) % 360;
        if (dom) dom.style.transform = `rotate(${ent.angle}deg)`;
        break;
      case 'rotate_180':
        ent.angle = ((ent.angle || 0) + 180) % 360;
        if (dom) dom.style.transform = `rotate(${ent.angle}deg)`;
        break;
      case 'move_discard': {
        const discardArea = AREAS.find(a => a.type === 'discard');
        if (discardArea) {
          ent.x = discardArea.x + 20;
          ent.y = discardArea.y + 20;
          if (dom) {
            dom.style.left = `${ent.x}px`;
            dom.style.top = `${ent.y}px`;
          }
        }
        break;
      }
      case 'move_deck': {
        const deckArea = AREAS.find(a => a.type === 'deck');
        if (deckArea) {
          ent.x = deckArea.x + 20;
          ent.y = deckArea.y + 20;
          if (dom) {
            dom.style.left = `${ent.x}px`;
            dom.style.top = `${ent.y}px`;
          }
        }
        break;
      }
    }
  });

  scheduleSaveRoom();
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
