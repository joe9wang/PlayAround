/**
 * ============================================================================
 * BatriTable Developer Mode (game-dev.module.js)
 * Standalone Engine & Logic for Game Schema, Areas, Automation & Properties
 * ============================================================================
 */

import {
  auth, db, storage,
  onAuthStateChanged,
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp, onSnapshot,
  ref, uploadString, getDownloadURL
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

// CPU設定
let CPU_SEATS = new Set(['player2', 'player3', 'player4']);
let CPU_RULES = [];
let LAST_ACTED_CPU_INDEX = -1;

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
const btnSharePlayUrl = document.getElementById('btn-share-play-url');
const btnExitLobby = document.getElementById('btn-exit-lobby');

// HUD
const hudZoomText = document.getElementById('hud-zoom-text');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');

// Top Bar Uploads & ZIP
const btnUploadCard = document.getElementById('btn-upload-card');
const fileInputCard = document.getElementById('file-input-card');
const btnImportZip = document.getElementById('btn-import-zip');
const fileInputZip = document.getElementById('file-input-zip');
const btnExportZip = document.getElementById('btn-export-zip');
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
const devPlayerCountSelect = document.getElementById('dev-player-count');
let PLAYER_COUNT = 4;

const modalCardSchema = document.getElementById('modal-card-schema');
const devCardSchemaBtn = document.getElementById('dev-card-schema-btn');
const btnAddCardType = document.getElementById('btn-add-card-type');
const schemaTypesList = document.getElementById('schema-types-list');

const modalAddButton = document.getElementById('modal-add-button');
const devAddButtonBtn = document.getElementById('dev-add-button-btn');
const btnConfirmAddButton = document.getElementById('btn-confirm-add-button');
const btnDefLabel = document.getElementById('btn-def-label');
const btnDefAction = document.getElementById('btn-def-action');
const btnDefWhat = document.getElementById('btn-def-what');
const btnDefSrcArea = document.getElementById('btn-def-src-area');
const btnDefSrcOwner = document.getElementById('btn-def-src-owner');
const btnDefDest = document.getElementById('btn-def-dest');
const btnDefDestLabel = document.getElementById('btn-def-dest-label');
const btnDefWhatGroup = document.getElementById('btn-def-what-group');
const btnDefSrcAreaGroup = document.getElementById('btn-def-src-area-group');
const btnDefSrcOwnerGroup = document.getElementById('btn-def-src-owner-group');
const btnDefTagConditionsGroup = document.getElementById('btn-def-tag-conditions-group');
const tagConditionsList = document.getElementById('tag-conditions-list');
const btnAddTagCondition = document.getElementById('btn-add-tag-condition');
const btnDefDestGroup = document.getElementById('btn-def-dest-group');
const btnDefPlacementGroup = document.getElementById('btn-def-placement-group');
const btnDefPlacementVal = document.getElementById('btn-def-placement-val');
const btnPlacementSpread = document.getElementById('btn-placement-spread');
const placementGridContainer = document.getElementById('placement-grid-container');
const btnDefAngle = document.getElementById('btn-def-angle');
const btnDefAngleLabel = document.getElementById('btn-def-angle-label');
const btnDefDirection = document.getElementById('btn-def-direction');
const btnDefHint = document.getElementById('btn-def-hint');
const btnDefAngleGroup = document.getElementById('btn-def-angle-group');
const btnDefDirectionGroup = document.getElementById('btn-def-direction-group');
const btnDefDrawSrcGroup = document.getElementById('btn-def-draw-src-group');
const btnDefDrawSrc = document.getElementById('btn-def-draw-src');
const btnDefDrawCountGroup = document.getElementById('btn-def-draw-count-group');
const btnDefDrawCount = document.getElementById('btn-def-draw-count');
const btnDefDrawPosGroup = document.getElementById('btn-def-draw-pos-group');
const btnDefDrawPos = document.getElementById('btn-def-draw-pos');
const btnDefDrawFaceGroup = document.getElementById('btn-def-draw-face-group');
const btnDefDrawFace = document.getElementById('btn-def-draw-face');

// 配る専用
const btnDefDealFields = document.getElementById('btn-def-deal-fields');
const btnDefDealSrc = document.getElementById('btn-def-deal-src');
const btnDealSelectHands = document.getElementById('btn-deal-select-hands');
const btnDealSelectAll = document.getElementById('btn-deal-select-all');
const btnDealClear = document.getElementById('btn-deal-clear');
const dealDestsContainer = document.getElementById('deal-dests-container');
const btnDefDealCount = document.getElementById('btn-def-deal-count');
const btnDefDealAll = document.getElementById('btn-def-deal-all');
const btnDefDealMethod = document.getElementById('btn-def-deal-method');
const btnDefDealPlacement = document.getElementById('btn-def-deal-placement');
const btnDefDealFace = document.getElementById('btn-def-deal-face');
let SELECTED_DEAL_DESTS = new Set();

const devActingPlayerSelect = document.getElementById('dev-acting-player');
const playButtonsContainer = document.getElementById('play-buttons-container');

// CPU・自動化設定
const cpuSeatsSummary = document.getElementById('cpu-seats-summary');
const devCpuSeatsBtn = document.getElementById('dev-cpu-seats-btn');
const cpuRulesContainer = document.getElementById('cpu-rules-container');
const cpuRulesEmpty = document.getElementById('cpu-rules-empty');
const devCpuRuleBtn = document.getElementById('dev-cpu-rule-btn');
const devTestCpuTurnBtn = document.getElementById('dev-test-cpu-turn-btn');

// Modal: CPU座席設定
const modalCpuSeats = document.getElementById('modal-cpu-seats');
const cpuSeatsList = document.getElementById('cpu-seats-list');
const btnCpuSeatsAllHuman = document.getElementById('btn-cpu-seats-all-human');
const btnCpuSeatsSolo = document.getElementById('btn-cpu-seats-solo');
const btnSaveCpuSeats = document.getElementById('btn-save-cpu-seats');

// Modal: CPU動作ルール設定
const modalCpuRule = document.getElementById('modal-cpu-rule');
const cpuRuleEditId = document.getElementById('cpu-rule-edit-id');
const cpuRuleName = document.getElementById('cpu-rule-name');
const cpuRuleTargetSeat = document.getElementById('cpu-rule-target-seat');
const cpuFlowContainer = document.getElementById('cpu-flow-container');
const btnAddFlowAction = document.getElementById('btn-add-flow-action');
const btnAddFlowIf = document.getElementById('btn-add-flow-if');
const btnSaveCpuRule = document.getElementById('btn-save-cpu-rule');
let EDITING_CPU_BLOCKS = [];

// Right Inspector
const devInspector = document.getElementById('dev-inspector');
const toggleInspector = document.getElementById('toggle-inspector');
const inspectorEmpty = document.getElementById('inspector-empty');
const inspectorContent = document.getElementById('inspector-content');
const inspectorPreviewImg = document.getElementById('inspector-preview-img');
const inspectorBadge = document.getElementById('inspector-badge');
const inspectorStatus = document.getElementById('inspector-status');
const inspectorCardTypeSelect = document.getElementById('inspector-card-type-select');
const inspectorTagsContainer = document.getElementById('inspector-tags-container');
const inspectorSaveNotice = document.getElementById('inspector-save-notice');

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
  setupInspectorEvents();
  updatePlayerCountUI();

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
      // 作成者権限チェック（本人以外のアクセスはプレイ用ページへ自動誘導）
      if (ROOM_DATA.creatorUid && CURRENT_UID && ROOM_DATA.creatorUid !== CURRENT_UID) {
        alert('このルームは他のユーザーが作成したゲームです。開発者モードの編集権限がないため、プレイ用ページへ移動します。');
        window.location.href = `./game-dev-play.html?id=${encodeURIComponent(CURRENT_ROOM)}`;
        return;
      }
      if (!ROOM_DATA.creatorUid && CURRENT_UID) {
        ROOM_DATA.creatorUid = CURRENT_UID;
      }

      if (ROOM_DATA.playerCount) {
        PLAYER_COUNT = Math.max(1, Math.min(10, Number(ROOM_DATA.playerCount) || 4));
      }
      if (ROOM_DATA.cardSchemas) CARD_SCHEMAS = ROOM_DATA.cardSchemas;
      if (ROOM_DATA.playButtons) PLAY_BUTTONS = ROOM_DATA.playButtons;
      if (ROOM_DATA.cpuSeats) {
        CPU_SEATS = new Set(Array.isArray(ROOM_DATA.cpuSeats) ? ROOM_DATA.cpuSeats : []);
      }
      if (ROOM_DATA.cpuRules) {
        CPU_RULES = Array.isArray(ROOM_DATA.cpuRules) ? ROOM_DATA.cpuRules : [];
      }
      if (ROOM_DATA.devAreas && ROOM_DATA.devAreas.length > 0) AREAS = ROOM_DATA.devAreas;
      if (ROOM_DATA.devEntities) ENTITIES = ROOM_DATA.devEntities;
    }

    updatePlayerCountUI();
    renderAllAreas();
    renderAllEntities();
    renderPlayButtons();
    renderCpuSeatsSummary();
    renderCpuRulesList();
    renderSchemaList();

    // Listen to remote changes
    onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists() || isSavingRoom) return;
      const data = docSnap.data();
      if (data.playerCount && data.playerCount !== PLAYER_COUNT) {
        PLAYER_COUNT = Math.max(1, Math.min(10, Number(data.playerCount) || 4));
        updatePlayerCountUI();
      }
      if (data.cardSchemas) CARD_SCHEMAS = data.cardSchemas;
      if (data.playButtons) {
        PLAY_BUTTONS = data.playButtons;
        renderPlayButtons();
      }
      if (data.cpuSeats) {
        CPU_SEATS = new Set(Array.isArray(data.cpuSeats) ? data.cpuSeats : []);
        renderCpuSeatsSummary();
      }
      if (data.cpuRules) {
        CPU_RULES = Array.isArray(data.cpuRules) ? data.cpuRules : [];
        renderCpuRulesList();
      }
    });
  } catch (err) {
    console.warn('[DevMode] Load room data failed, using local state:', err);
    updatePlayerCountUI();
    renderAllAreas();
    renderAllEntities();
    renderPlayButtons();
    renderCpuSeatsSummary();
    renderCpuRulesList();
    renderSchemaList();
  }
}

// Storage Upload Helper & Cache (Firestore 1MB 上限エラー回避用)
const storageUploadCache = new Map();

async function uploadDataUrlToStorage(dataUrl, pathHint = 'asset') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  if (storageUploadCache.has(dataUrl)) {
    return storageUploadCache.get(dataUrl);
  }

  try {
    const extMatch = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
    let ext = extMatch ? extMatch[1] : 'png';
    if (ext === 'jpeg') ext = 'jpg';
    if (ext.includes('svg')) ext = 'svg';

    const safeRoom = CURRENT_ROOM || 'dev_common';
    const cleanHint = pathHint.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const filename = `${cleanHint}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const storageRef = ref(storage, `rooms/${safeRoom}/dev_assets/${filename}`);

    await uploadString(storageRef, dataUrl, 'data_url');
    const downloadUrl = await getDownloadURL(storageRef);
    storageUploadCache.set(dataUrl, downloadUrl);
    return downloadUrl;
  } catch (err) {
    console.warn('[DevMode] Storage upload failed, keeping data URL:', err);
    return dataUrl;
  }
}

let syncTimeout = null;
let isSavingRoom = false;

function scheduleSaveRoom() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (!CURRENT_ROOM || isSavingRoom) return;
    isSavingRoom = true;
    try {
      // 1. ENTITIES 内に Base64 画像が存在する場合、Firebase Storage へアップロードして URL に置換
      const uploadTasks = [];
      for (const ent of ENTITIES) {
        if (ent.frontUrl && ent.frontUrl.startsWith('data:')) {
          uploadTasks.push((async () => {
            ent.frontUrl = await uploadDataUrlToStorage(ent.frontUrl, `front_${ent.id}`);
            const dom = document.getElementById(ent.id);
            if (dom) updateEntityInnerDOM(dom, ent);
          })());
        }
        if (ent.backUrl && ent.backUrl.startsWith('data:')) {
          uploadTasks.push((async () => {
            ent.backUrl = await uploadDataUrlToStorage(ent.backUrl, `back_${ent.id}`);
            const dom = document.getElementById(ent.id);
            if (dom) updateEntityInnerDOM(dom, ent);
          })());
        }
      }

      if (uploadTasks.length > 0) {
        await Promise.all(uploadTasks);
      }

      // 2. Firestore への保存実行 (Base64 が除外されサイズが数百KB以下になるため 1MB 上限エラーが解消)
      const roomRef = doc(db, `rooms/${CURRENT_ROOM}`);
      await setDoc(roomRef, {
        creatorUid: ROOM_DATA?.creatorUid || CURRENT_UID,
        playerCount: PLAYER_COUNT,
        cardSchemas: CARD_SCHEMAS,
        playButtons: PLAY_BUTTONS,
        cpuSeats: Array.from(CPU_SEATS),
        cpuRules: CPU_RULES,
        devAreas: AREAS,
        devEntities: ENTITIES,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('[DevMode] Room successfully synced to Firestore');
    } catch (e) {
      console.warn('[DevMode] Sync failed:', e);
    } finally {
      isSavingRoom = false;
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

  // Panning with Middle Click or Left Drag on background/empty area
  viewportEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;

    // カード/コマ/ボード、エリアヘッダー、リサイズハンドル、削除ボタン、HUD操作時はパン開始しない
    if (e.target.closest('.dev-entity') ||
        e.target.closest('.dev-area-header') ||
        e.target.closest('.dev-resize-handle') ||
        e.target.closest('.area-delete-btn') ||
        e.target.closest('.viewport-hud') ||
        e.target.closest('#dev-context-menu')) {
      return;
    }

    IS_PANNING = true;
    PAN_START_X = e.clientX - VIEW_X;
    PAN_START_Y = e.clientY - VIEW_Y;
    viewportEl.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    deselectEntity();
    hideContextMenu();
    e.preventDefault();
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
      document.body.style.userSelect = '';
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

  btnSharePlayUrl?.addEventListener('click', () => {
    if (CURRENT_ROOM) {
      const playUrl = `${window.location.origin}/game-dev-play.html?id=${encodeURIComponent(CURRENT_ROOM)}`;
      navigator.clipboard.writeText(playUrl).then(() => {
        showToast('🚀 プレイ公開URLをコピーしました！このリンクを共有すれば誰でも遊べます');
      }).catch(() => {
        prompt('このゲームのプレイ用公開URLです（コピーしてください）:', playUrl);
      });
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

  // ZIP Import & Export
  btnImportZip?.addEventListener('click', () => fileInputZip?.click());
  fileInputZip?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await importCardsFromZip(file);
      e.target.value = '';
    }
  });
  btnExportZip?.addEventListener('click', async () => {
    await exportCardsToZip();
  });
}

async function handleFileUpload(e, type) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const vpCenterX = (-VIEW_X + (viewportEl?.clientWidth || 800) / 2) / VIEW_SCALE;
  const vpCenterY = (-VIEW_Y + (viewportEl?.clientHeight || 600) / 2) / VIEW_SCALE;

  let index = 0;
  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const storageUrl = await uploadDataUrlToStorage(dataUrl, `upload_${type}_${file.name}`);
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    HIGHEST_Z += 1;

    let entity = {
      id: entityId,
      type: type,
      x: vpCenterX + index * 25,
      y: vpCenterY + index * 25,
      z: HIGHEST_Z,
      angle: 0,
      frontUrl: storageUrl,
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
// CSV Helpers (RFC 4180 with UTF-8 BOM Support for Excel)
// ============================================================================
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cur.trim());
        cur = '';
      } else if (c === '\r') {
        if (next === '\n') i++;
        row.push(cur.trim());
        if (row.some(cell => cell.length > 0)) lines.push(row);
        row = [];
        cur = '';
      } else if (c === '\n') {
        row.push(cur.trim());
        if (row.some(cell => cell.length > 0)) lines.push(row);
        row = [];
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(cell => cell.length > 0)) lines.push(row);
  }

  if (lines.length === 0) return [];
  const rawHeaders = lines[0].map(h => h.trim());
  return lines.slice(1).map(line => {
    const obj = {};
    rawHeaders.forEach((h, idx) => {
      obj[h] = line[idx] !== undefined ? line[idx] : '';
    });
    return obj;
  });
}

function serializeCSV(headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(',')
  ];
  rows.forEach(r => {
    lines.push(headers.map(h => escapeCell(r[h])).join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}

function findZipFile(zip, filePath) {
  if (!filePath) return null;
  const clean = filePath.replace(/^[./\\]+/, '').replace(/\\/g, '/');
  const basename = clean.split('/').pop().toLowerCase();

  if (zip.file(clean)) return zip.file(clean);
  if (zip.file(`images/${basename}`)) return zip.file(`images/${basename}`);

  for (const filename of Object.keys(zip.files)) {
    const f = zip.files[filename];
    if (f.dir) continue;
    const norm = filename.replace(/\\/g, '/').toLowerCase();
    if (norm === clean.toLowerCase() || norm.endsWith('/' + basename) || norm === basename) {
      return f;
    }
  }
  return null;
}

// ============================================================================
// ZIP Export & Import (Cards, Attributes, Schemas)
// ============================================================================
async function exportCardsToZip() {
  if (typeof JSZip === 'undefined') {
    alert('JSZipライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }

  const cards = ENTITIES.filter(e => e.type === 'card');
  if (cards.length === 0) {
    alert('エクスポート対象のカードがキャンバスにありません。まずはカードを追加してください。');
    return;
  }

  const zip = new JSZip();
  const imgFolder = zip.folder('images');

  // 1. 全スキーマからタグ名を抽出
  const allTagNames = new Set();
  Object.values(CARD_SCHEMAS).forEach(schema => {
    (schema.tags || []).forEach(tag => {
      if (tag.name) allTagNames.add(tag.name);
    });
  });
  const tagColumns = Array.from(allTagNames);

  // 2. manifest.json
  const manifest = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    deckName: 'BatriTable_Exported_Cards',
    cardCount: cards.length,
    cardSchemas: CARD_SCHEMAS
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 3. 画像収集とCSV行の生成
  const csvHeaders = ['image', 'type', 'count', 'back_image', ...tagColumns];
  const csvRows = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const filename = `card_${String(i + 1).padStart(3, '0')}.png`;

    if (card.frontUrl) {
      if (card.frontUrl.startsWith('data:')) {
        const parts = card.frontUrl.split(',');
        const base64Data = parts[1];
        imgFolder.file(filename, base64Data, { base64: true });
      } else {
        try {
          const resp = await fetch(card.frontUrl);
          const blob = await resp.blob();
          imgFolder.file(filename, blob);
        } catch (err) {
          console.warn('Failed to fetch card frontUrl:', card.frontUrl, err);
        }
      }
    }

    const schema = card.cardTypeId ? CARD_SCHEMAS[card.cardTypeId] : null;
    const typeName = schema ? schema.name : '';

    const rowObj = {
      image: `images/${filename}`,
      type: typeName,
      count: 1,
      back_image: (card.backUrl && card.backUrl !== 'PlayExample.webp') ? card.backUrl : ''
    };

    tagColumns.forEach(tagName => {
      rowObj[tagName] = '';
      if (schema && card.tagValues) {
        const tagDef = (schema.tags || []).find(t => t.name === tagName);
        if (tagDef && card.tagValues[tagDef.id] !== undefined) {
          rowObj[tagName] = card.tagValues[tagDef.id];
        }
      }
    });

    csvRows.push(rowObj);
  }

  // 4. cards.csv 生成
  const csvContent = serializeCSV(csvHeaders, csvRows);
  zip.file('cards.csv', csvContent);

  // 5. ダウンロード実行
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `cards_export_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(downloadUrl);
}

async function importCardsFromZip(file) {
  if (typeof JSZip === 'undefined') {
    alert('JSZipライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }
  if (!file) return;

  try {
    const zip = await JSZip.loadAsync(file);

    // 1. manifest.json 読み込み (カードタイプ・タグ定義の復元)
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        const manifestStr = await manifestFile.async('string');
        const manifest = JSON.parse(manifestStr);
        if (manifest.cardSchemas && typeof manifest.cardSchemas === 'object') {
          Object.entries(manifest.cardSchemas).forEach(([typeId, schema]) => {
            let existing = Object.values(CARD_SCHEMAS).find(s => s.name === schema.name || s.id === typeId);
            if (!existing) {
              CARD_SCHEMAS[typeId] = schema;
            } else {
              if (!existing.tags) existing.tags = [];
              (schema.tags || []).forEach(t => {
                if (!existing.tags.some(et => et.name === t.name || et.id === t.id)) {
                  existing.tags.push(t);
                }
              });
            }
          });
          renderSchemaList();
        }
      } catch (err) {
        console.warn('Failed to parse manifest.json:', err);
      }
    }

    // 2. cards.csv の検出
    let csvFile = zip.file('cards.csv');
    if (!csvFile) {
      const candidate = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.csv') && !f.dir);
      if (candidate) csvFile = candidate;
    }

    if (!csvFile) {
      alert('ZIP内に cards.csv が見つかりませんでした。');
      return;
    }

    const csvStr = await csvFile.async('string');
    const rows = parseCSV(csvStr);
    if (rows.length === 0) {
      alert('cards.csv にデータが含まれていません。');
      return;
    }

    const vpCenterX = (-VIEW_X + (viewportEl?.clientWidth || 800) / 2) / VIEW_SCALE;
    const vpCenterY = (-VIEW_Y + (viewportEl?.clientHeight || 600) / 2) / VIEW_SCALE;

    let createdCount = 0;
    let cardIndex = 0;

    for (const row of rows) {
      // カラム名のゆらぎ吸収 (大文字小文字/日本語名)
      let rawImage = '';
      let rawType = '';
      let rawCount = 1;
      let rawBack = '';
      const customTagCells = {};

      Object.entries(row).forEach(([colName, cellVal]) => {
        const lower = colName.toLowerCase().trim();
        if (['image', 'img', 'file', 'ファイル', '画像'].includes(lower)) {
          rawImage = cellVal.trim();
        } else if (['type', 'card_type', 'cardtype', 'タイプ', 'カードタイプ'].includes(lower)) {
          rawType = cellVal.trim();
        } else if (['count', 'qty', 'quantity', '枚数', '個数'].includes(lower)) {
          rawCount = parseInt(cellVal, 10) || 1;
        } else if (['back_image', 'backimage', 'back', '裏面', '裏面画像'].includes(lower)) {
          rawBack = cellVal.trim();
        } else {
          customTagCells[colName.trim()] = cellVal.trim();
        }
      });

      // 画像の取得 (Firebase Storage へ直接アップロードして軽量URL化)
      let frontUrl = 'PlayExample.webp';
      const zipImgEntry = findZipFile(zip, rawImage);
      if (zipImgEntry) {
        const base64Data = await zipImgEntry.async('base64');
        const ext = zipImgEntry.name.split('.').pop().toLowerCase();
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'webp') mime = 'image/webp';
        else if (ext === 'svg') mime = 'image/svg+xml';
        const dataUrl = `data:${mime};base64,${base64Data}`;
        frontUrl = await uploadDataUrlToStorage(dataUrl, `zip_${rawImage}`);
      }

      // 裏面画像の取得 (Firebase Storage へ直接アップロードして軽量URL化)
      let backUrl = 'PlayExample.webp';
      if (rawBack) {
        const zipBackEntry = findZipFile(zip, rawBack);
        if (zipBackEntry) {
          const base64Back = await zipBackEntry.async('base64');
          const ext = zipBackEntry.name.split('.').pop().toLowerCase();
          let mime = 'image/png';
          if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
          else if (ext === 'webp') mime = 'image/webp';
          const dataUrl = `data:${mime};base64,${base64Back}`;
          backUrl = await uploadDataUrlToStorage(dataUrl, `zip_${rawBack}`);
        } else if (rawBack.startsWith('http') || rawBack.endsWith('.webp') || rawBack.endsWith('.png')) {
          backUrl = rawBack;
        }
      }

      // カードタイプの特定または新規自動登録
      let matchedSchema = null;
      if (rawType) {
        matchedSchema = Object.values(CARD_SCHEMAS).find(s => s.name === rawType || s.id === rawType);
        if (!matchedSchema) {
          const newTypeId = `type_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          matchedSchema = {
            id: newTypeId,
            name: rawType,
            tags: []
          };
          CARD_SCHEMAS[newTypeId] = matchedSchema;
          renderSchemaList();
        }
      }

      // タグ値の解決 (未登録タグは自動でスキーマに追加)
      const tagValues = {};
      if (matchedSchema) {
        if (!matchedSchema.tags) matchedSchema.tags = [];
        Object.entries(customTagCells).forEach(([colKey, colVal]) => {
          if (colVal !== '') {
            let tagDef = matchedSchema.tags.find(t => t.name === colKey || t.id === colKey);
            if (!tagDef) {
              const newTagId = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              tagDef = { id: newTagId, name: colKey };
              matchedSchema.tags.push(tagDef);
            }
            tagValues[tagDef.id] = colVal;
          }
        });
      }

      const count = Math.min(100, Math.max(1, rawCount));
      const cols = 8;

      for (let c = 0; c < count; c++) {
        const entityId = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        HIGHEST_Z += 1;

        const col = cardIndex % cols;
        const rowIdx = Math.floor(cardIndex / cols);
        const cardX = Math.round(vpCenterX + (col - cols / 2) * 135);
        const cardY = Math.round(vpCenterY + (rowIdx - 2) * 175);

        const entity = {
          id: entityId,
          type: 'card',
          x: cardX,
          y: cardY,
          z: HIGHEST_Z,
          w: 120,
          h: 160,
          angle: 0,
          frontUrl: frontUrl,
          backUrl: backUrl,
          isFaceDown: false,
          cardTypeId: matchedSchema ? matchedSchema.id : '',
          tagValues: tagValues
        };

        ENTITIES.push(entity);
        createEntityDOM(entity);
        createdCount++;
        cardIndex++;
      }
    }

    renderSchemaList();
    if (SELECTED_ENTITY_ID) updateInspector(SELECTED_ENTITY_ID);
    scheduleSaveRoom();
    alert(`合計 ${createdCount} 枚のカードを正常にインポートしました！`);
  } catch (err) {
    console.error('ZIP import error:', err);
    alert('ZIPファイルの読み込み中にエラーが発生しました: ' + err.message);
  }
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
  updateInspector(id);
}

function deselectEntity() {
  SELECTED_ENTITY_ID = null;
  document.querySelectorAll('.dev-entity').forEach(el => el.classList.remove('selected'));
  updateInspector(null);
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
    if (targetId) {
      selectEntity(targetId);
      if (devInspector?.classList.contains('is-collapsed')) {
        devInspector.classList.remove('is-collapsed');
        if (toggleInspector) {
          toggleInspector.textContent = '▶';
          toggleInspector.title = 'パネルを折り畳む';
        }
        handleResize();
      }
    }
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
      if (SELECTED_ENTITY_ID === ent.id) updateInspector(ent.id);
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
      if (SELECTED_ENTITY_ID === ent.id) updateInspector(ent.id);
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
      if (SELECTED_ENTITY_ID === ent.id) deselectEntity();
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

  // プレイヤー人数設定
  if (devPlayerCountSelect) {
    devPlayerCountSelect.value = String(PLAYER_COUNT);
    devPlayerCountSelect.addEventListener('change', () => {
      const count = parseInt(devPlayerCountSelect.value, 10);
      if (!isNaN(count) && count >= 1 && count <= 10) {
        PLAYER_COUNT = count;
        updatePlayerCountUI();
        scheduleSaveRoom();
      }
    });
  }

  // 操作プレイヤー（「自分の〜エリア」の解決に使用）
  if (devActingPlayerSelect) {
    devActingPlayerSelect.addEventListener('change', () => {
      localStorage.setItem(ACTING_PLAYER_STORAGE_KEY, devActingPlayerSelect.value);
    });
  }

  // CPU設定関連
  devCpuSeatsBtn?.addEventListener('click', openCpuSeatsModal);
  devCpuRuleBtn?.addEventListener('click', () => openCpuRuleModal(null));
  devTestCpuTurnBtn?.addEventListener('click', executeNextCpuTurn);
}

function updatePlayerCountUI() {
  if (devPlayerCountSelect && devPlayerCountSelect.value !== String(PLAYER_COUNT)) {
    devPlayerCountSelect.value = String(PLAYER_COUNT);
  }

  // 1. エリア追加モーダルの「対象プレイヤー」
  if (areaOwnerSelect) {
    const prevVal = areaOwnerSelect.value;
    areaOwnerSelect.innerHTML = '<option value="shared">共有</option>';
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const opt = document.createElement('option');
      opt.value = `player${i}`;
      opt.textContent = `プレイヤー${i}`;
      areaOwnerSelect.appendChild(opt);
    }
    if (areaOwnerSelect.querySelector(`option[value="${prevVal}"]`)) {
      areaOwnerSelect.value = prevVal;
    } else {
      areaOwnerSelect.value = 'shared';
    }
  }

  // 2. 「プレイ用」設定の「操作プレイヤー」
  if (devActingPlayerSelect) {
    const saved = localStorage.getItem(ACTING_PLAYER_STORAGE_KEY);
    const prevVal = devActingPlayerSelect.value || saved;
    devActingPlayerSelect.innerHTML = '';
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const opt = document.createElement('option');
      opt.value = `player${i}`;
      opt.textContent = `プレイヤー${i}`;
      devActingPlayerSelect.appendChild(opt);
    }
    if (prevVal && devActingPlayerSelect.querySelector(`option[value="${prevVal}"]`)) {
      devActingPlayerSelect.value = prevVal;
    } else {
      devActingPlayerSelect.value = 'player1';
      localStorage.setItem(ACTING_PLAYER_STORAGE_KEY, 'player1');
    }
  }

  // 3. ボタン追加モーダルの「対象（誰の）」
  if (btnDefSrcOwner) {
    const prevOwner = btnDefSrcOwner.value;
    btnDefSrcOwner.innerHTML = `
      <option value="any">指定なし（だれでも）</option>
      <option value="mine">自分の</option>
      <option value="shared">共有の</option>
    `;
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const opt = document.createElement('option');
      opt.value = `player${i}`;
      opt.textContent = `P${i}の`;
      btnDefSrcOwner.appendChild(opt);
    }
    if (btnDefSrcOwner.querySelector(`option[value="${prevOwner}"]`)) {
      btnDefSrcOwner.value = prevOwner;
    } else {
      btnDefSrcOwner.value = 'any';
    }
  }

  // 4. エリア参照オプション再構築
  rebuildAreaOptions();

  // 5. CPU座席サマリーの更新
  renderCpuSeatsSummary();
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
  btnDefWhat?.addEventListener('change', updateButtonFormVisibility);
  btnDefSrcArea?.addEventListener('change', updateButtonFormHint);
  btnDefDrawSrc?.addEventListener('change', updateButtonFormHint);
  btnDefDealSrc?.addEventListener('change', updateButtonFormHint);
  btnDefDest?.addEventListener('change', updateButtonFormHint);
  btnDefAngle?.addEventListener('input', syncAnglePresetActive);

  // 配る専用イベント
  btnDefDealAll?.addEventListener('change', () => {
    if (btnDefDealCount) btnDefDealCount.disabled = !!btnDefDealAll?.checked;
  });
  btnDealSelectHands?.addEventListener('click', selectDealHandsOnly);
  btnDealSelectAll?.addEventListener('click', selectDealAll);
  btnDealClear?.addEventListener('click', clearDealDests);

  // 置き方ボタン (並べる vs 9方向グリッド)
  btnPlacementSpread?.addEventListener('click', () => {
    selectPlacementOption('spread');
  });

  placementGridContainer?.querySelectorAll('.grid-cell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectPlacementOption(btn.getAttribute('data-placement'));
    });
  });

  // タグ条件追加ボタン
  btnAddTagCondition?.addEventListener('click', () => {
    addTagConditionRow();
  });

  document.querySelectorAll('.angle-preset').forEach(chip => {
    chip.addEventListener('click', () => {
      if (btnDefAngle) btnDefAngle.value = chip.getAttribute('data-angle');
      syncAnglePresetActive();
    });
  });

  // Play Button: Confirm Add Button
  btnConfirmAddButton?.addEventListener('click', confirmAddPlayButton);

  // CPU座席設定モーダルイベント
  btnCpuSeatsAllHuman?.addEventListener('click', () => {
    if (!cpuSeatsList) return;
    cpuSeatsList.querySelectorAll('.cpu-toggle-btn').forEach(b => {
      if (b.dataset.role === 'human') b.classList.add('active');
      else b.classList.remove('active');
    });
  });

  btnCpuSeatsSolo?.addEventListener('click', () => {
    if (!cpuSeatsList) return;
    cpuSeatsList.querySelectorAll('.cpu-seat-row').forEach(row => {
      const seatKey = row.dataset.seat;
      const humanBtn = row.querySelector('.cpu-toggle-btn[data-role="human"]');
      const cpuBtn = row.querySelector('.cpu-toggle-btn[data-role="cpu"]');
      if (seatKey === 'player1') {
        humanBtn?.classList.add('active');
        cpuBtn?.classList.remove('active');
      } else {
        humanBtn?.classList.remove('active');
        cpuBtn?.classList.add('active');
      }
    });
  });

  btnSaveCpuSeats?.addEventListener('click', saveCpuSeats);

  // CPU動作設定モーダルイベント（フローブロック追加）
  btnAddFlowAction?.addEventListener('click', () => {
    addCpuFlowActionBlock();
  });

  btnAddFlowIf?.addEventListener('click', () => {
    addCpuFlowIfBlock();
  });

  btnSaveCpuRule?.addEventListener('click', saveCpuRule);
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

  if (SELECTED_ENTITY_ID) {
    updateInspector(SELECTED_ENTITY_ID);
  }
}

// ============================================================================
// Play Buttons Management & Execution (プレイ用ボタン)
// ============================================================================
// ---- 参照（エリア）のエンコード ----
// 'all'                 : 全領域
// 'own:<areaType>'      : 自分（操作プレイヤー）の〇〇エリア
// 'area:<areaId>'       : 特定のエリア
function refToValue(ref) {
  if (!ref) return '';
  if (ref.kind === 'all') return 'all';
  if (ref.kind === 'selected') return 'selected';
  if (ref.kind === 'own') return `own:${ref.areaType}`;
  if (ref.kind === 'area') return `area:${ref.areaId}`;
  return '';
}

function valueToRef(value) {
  if (!value) return null;
  if (value === 'all') return { kind: 'all' };
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
  if (ref.kind === 'all') return '全領域';
  if (ref.kind === 'selected') return '選択中のアイテム';
  if (ref.kind === 'own') return `自分の${getAreaTypeName(ref.areaType)}`;
  if (ref.kind === 'area') {
    const area = AREAS.find(a => a.id === ref.areaId);
    return area ? getAreaDisplayName(area) : '（削除済みエリア）';
  }
  return '（不明）';
}

function resolveAreaRef(ref, actingPlayerOverride = null) {
  if (!ref) return null;
  if (ref.kind === 'area') return AREAS.find(a => a.id === ref.areaId) || null;
  if (ref.kind === 'own') {
    const me = actingPlayerOverride || getActingPlayer();
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
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const ACTION_LABELS = {
  move: '移動',
  draw: 'ドロー',
  deal: '配る',
  flip_toggle: '裏表を変える',
  flip_down: '裏にする',
  flip_up: '表にする',
  rotate: '回転',
  set_angle: '向きをそろえる'
};

const ITEM_TYPE_LABELS = {
  selected: '選択中のアイテム',
  all_cards: '全てのカード',
  all_pieces: '全てのコマ',
  all_boards: '全てのボード',
  tag_filter: 'タグ指定のカード'
};

const PLACEMENT_LABELS = {
  spread: '横に並べる',
  spread_lr: '左から右へ',
  spread_rl: '右から左へ',
  spread_tb: '上から下へ',
  spread_bt: '下から上へ',
  stack: '中央に重ねる',
  stack_center: '中央に重ねる',
  stack_top_left: '左上に重ねる',
  stack_top_center: '上に重ねる',
  stack_top_right: '右上に重ねる',
  stack_center_left: '左に重ねる',
  stack_center_right: '右に重ねる',
  stack_bottom_left: '左下に重ねる',
  stack_bottom_center: '下に重ねる',
  stack_bottom_right: '右下に重ねる',
  auto: '自動'
};

// 全カードタイプからユニークなタグ一覧を取得
function getAllDefinedTags() {
  const map = new Map();
  Object.values(CARD_SCHEMAS).forEach(schema => {
    (schema.tags || []).forEach(t => {
      if (!map.has(t.name)) {
        map.set(t.name, { id: t.id, name: t.name, type: t.type });
      }
    });
  });
  return Array.from(map.values());
}

// 旧形式（target: {kind:'selected'}等）のボタンを新形式へ変換
function normalizeButtonDef(def) {
  if (!def || typeof def !== 'object') return def;

  // すでに新形式またはドロー・配るの場合
  if (def.itemType !== undefined || def.action === 'draw' || def.action === 'deal') {
    return def;
  }

  // 旧形式からの移行
  const out = {
    id: def.id,
    label: def.label,
    action: def.action || 'move',
    itemType: (def.target && def.target.kind === 'selected') ? 'selected' : 'all_cards',
    sourceArea: (def.target && def.target.kind !== 'selected') ? refToValue(def.target) : 'all',
    sourceOwner: (def.target && def.target.kind === 'own') ? 'mine' : 'any',
    dest: def.dest || null,
    placement: def.placement || 'spread',
    angle: def.angle !== undefined ? def.angle : 90,
    direction: def.direction || 'cw',
    tagConditions: []
  };

  return out;
}

// ボタンが実行不能になっていないか（参照エリアの削除など）
function getButtonIssue(def) {
  const norm = normalizeButtonDef(def);

  if (norm.action === 'draw') {
    if (!norm.drawSrc) return 'ドロー元が未設定です';
    if (norm.drawSrc.kind === 'area' && !AREAS.some(a => a.id === norm.drawSrc.areaId)) {
      return 'ドロー元エリアが削除されています';
    }
    if (!norm.dest) return 'ドロー先が未設定です';
    if (norm.dest.kind === 'area' && !AREAS.some(a => a.id === norm.dest.areaId)) {
      return 'ドロー先エリアが削除されています';
    }
    return null;
  }

  if (norm.action === 'deal') {
    if (!norm.dealSrc) return '配布元が未設定です';
    if (norm.dealSrc.kind === 'area' && !AREAS.some(a => a.id === norm.dealSrc.areaId)) {
      return '配布元エリアが削除されています';
    }
    if (!norm.dealDests || norm.dealDests.length === 0) {
      return '配布先エリアが未設定です';
    }
    const validDests = norm.dealDests.filter(id => AREAS.some(a => a.id === id));
    if (validDests.length === 0) {
      return '配布先エリアがすべて削除されています';
    }
    return null;
  }

  if (norm.itemType !== 'selected' && norm.sourceArea && norm.sourceArea !== 'all') {
    const srcRef = valueToRef(norm.sourceArea);
    if (srcRef && srcRef.kind === 'area' && !AREAS.some(a => a.id === srcRef.areaId)) {
      return '対象エリアが削除されています';
    }
  }

  if (norm.action === 'move') {
    if (!norm.dest) return '移動先が未設定です';
    if (norm.dest.kind === 'area' && !AREAS.some(a => a.id === norm.dest.areaId)) {
      return '移動先エリアが削除されています';
    }
  }
  return null;
}

function describeButton(def) {
  const norm = normalizeButtonDef(def);
  const actName = ACTION_LABELS[norm.action] || norm.action;

  if (norm.action === 'draw') {
    const srcText = norm.drawSrc ? refLabel(norm.drawSrc) : '未設定';
    const destText = norm.dest ? refLabel(norm.dest) : '未設定';
    const posText = norm.drawPos === 'bottom' ? '下から' : '上から';
    const countText = `${norm.drawCount || 1}枚`;
    const faceText = norm.drawFace === 'face_up' ? ' (表)' : norm.drawFace === 'face_down' ? ' (裏)' : '';
    const placeText = PLACEMENT_LABELS[norm.placement] || norm.placement;
    return `${actName}：${srcText}の${posText}${countText}${faceText} → ${destText} [${placeText}]`;
  }

  if (norm.action === 'deal') {
    const srcText = norm.dealSrc ? refLabel(norm.dealSrc) : '未設定';
    const destNames = (norm.dealDests || [])
      .map(id => {
        const a = AREAS.find(area => area.id === id);
        return a ? `${getOwnerLabel(a.owner)}${a.name || getAreaTypeName(a.type)}` : id;
      })
      .join(', ');
    const countText = norm.dealAll ? '全配り切り' : `各${norm.dealCount || 5}枚`;
    const methodText = (norm.dealMethod === 'bulk') ? 'まとめて' : '1枚ずつ';
    return `${actName}：${srcText} → ${destNames || '未設定'}（${countText} / ${methodText}）`;
  }

  let whatText = ITEM_TYPE_LABELS[norm.itemType] || norm.itemType;
  if (norm.itemType === 'tag_filter' && norm.tagConditions && norm.tagConditions.length > 0) {
    const condStr = norm.tagConditions.map(c => `${c.tagName}${c.op}${c.value}`).join(' & ');
    whatText = `カード(${condStr})`;
  }

  if (norm.itemType === 'selected') {
    if (norm.action === 'move') {
      return `${actName}：選択アイテム → ${refLabel(norm.dest)} [${PLACEMENT_LABELS[norm.placement] || norm.placement}]`;
    }
    if (norm.action === 'rotate') return `${actName}：選択アイテム ${norm.direction === 'ccw' ? '左' : '右'}${norm.angle}°`;
    if (norm.action === 'set_angle') return `${actName}：選択アイテム ${norm.angle}°`;
    return `${actName}：選択アイテム`;
  }

  const whereText = norm.sourceArea === 'all' ? '全領域' : refLabel(valueToRef(norm.sourceArea));
  const ownerText = norm.sourceOwner === 'any' ? '' : norm.sourceOwner === 'mine' ? '自分の' : `${norm.sourceOwner}の`;

  let desc = `${actName}：${whereText}の${ownerText}${whatText}`;
  if (norm.action === 'move') {
    desc += ` → ${refLabel(norm.dest)} [${PLACEMENT_LABELS[norm.placement] || norm.placement}]`;
  } else if (norm.action === 'rotate') {
    desc += ` (${norm.direction === 'ccw' ? '左' : '右'}${norm.angle}°)`;
  } else if (norm.action === 'set_angle') {
    desc += ` (${norm.angle}°)`;
  }
  return desc;
}

// ---- 配布先エリアチップ管理 ----
function rebuildDealDestButtons() {
  if (!dealDestsContainer) return;
  dealDestsContainer.innerHTML = '';

  if (AREAS.length === 0) {
    dealDestsContainer.innerHTML = '<div class="empty-notice" style="padding:4px; font-size:11px;">エリアがありません</div>';
    return;
  }

  AREAS.forEach(area => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'deal-dest-chip';
    chip.dataset.areaId = area.id;

    const isSelected = SELECTED_DEAL_DESTS.has(area.id);
    if (isSelected) chip.classList.add('active');

    chip.innerHTML = `
      <span class="chip-check">${isSelected ? '✅' : '⬜'}</span>
      <span>${getOwnerLabel(area.owner)} ${escapeHtml(area.name || getAreaTypeName(area.type))}</span>
    `;

    chip.addEventListener('click', () => {
      if (SELECTED_DEAL_DESTS.has(area.id)) {
        SELECTED_DEAL_DESTS.delete(area.id);
        chip.classList.remove('active');
        const chk = chip.querySelector('.chip-check');
        if (chk) chk.textContent = '⬜';
      } else {
        SELECTED_DEAL_DESTS.add(area.id);
        chip.classList.add('active');
        const chk = chip.querySelector('.chip-check');
        if (chk) chk.textContent = '✅';
      }
    });

    dealDestsContainer.appendChild(chip);
  });
}

function selectDealHandsOnly() {
  SELECTED_DEAL_DESTS.clear();
  AREAS.filter(a => a.type === 'hand').forEach(a => SELECTED_DEAL_DESTS.add(a.id));
  updateDealDestChipsUI();
}

function selectDealAll() {
  SELECTED_DEAL_DESTS.clear();
  AREAS.forEach(a => SELECTED_DEAL_DESTS.add(a.id));
  updateDealDestChipsUI();
}

function clearDealDests() {
  SELECTED_DEAL_DESTS.clear();
  updateDealDestChipsUI();
}

function updateDealDestChipsUI() {
  if (!dealDestsContainer) return;
  dealDestsContainer.querySelectorAll('.deal-dest-chip').forEach(chip => {
    const aId = chip.dataset.areaId;
    const active = SELECTED_DEAL_DESTS.has(aId);
    chip.classList.toggle('active', active);
    const chk = chip.querySelector('.chip-check');
    if (chk) chk.textContent = active ? '✅' : '⬜';
  });
}

// ---- モーダル（動的フォーム） ----
function openAddButtonModal() {
  if (btnDefLabel) btnDefLabel.value = '';
  if (btnDefAction) btnDefAction.value = 'move';
  if (btnDefWhat) btnDefWhat.value = 'all_cards';
  if (btnDefSrcOwner) btnDefSrcOwner.value = 'any';
  if (btnDefAngle) btnDefAngle.value = '90';
  if (btnDefDirection) btnDefDirection.value = 'cw';
  if (btnDefDrawPos) btnDefDrawPos.value = 'top';
  if (btnDefDrawCount) btnDefDrawCount.value = '1';
  if (btnDefDrawFace) btnDefDrawFace.value = 'keep';

  // 配る初期値
  if (btnDefDealCount) {
    btnDefDealCount.value = '5';
    btnDefDealCount.disabled = false;
  }
  if (btnDefDealAll) btnDefDealAll.checked = false;
  if (btnDefDealMethod) btnDefDealMethod.value = 'round_robin';
  if (btnDefDealPlacement) btnDefDealPlacement.value = 'spread_lr';
  if (btnDefDealFace) btnDefDealFace.value = 'face_down';
  SELECTED_DEAL_DESTS.clear();

  selectPlacementOption('spread');
  rebuildAreaOptions();
  clearTagConditions();
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
    { group: '自分のエリア（操作者に合わせて変化）', items: ownItems },
    { group: 'フィールド上の実在エリア', items: areaItems }
  ];
}

function rebuildAreaOptions() {
  const prevSrc = btnDefSrcArea?.value;
  fillSelect(btnDefSrcArea, [
    { value: 'all', label: '全領域にある' },
    ...buildAreaRefOptions('にある', null)
  ], prevSrc || 'all');

  const prevDrawSrc = btnDefDrawSrc?.value;
  fillSelect(btnDefDrawSrc, [
    { value: 'all', label: '全領域にある' },
    ...buildAreaRefOptions('にある', null)
  ], prevDrawSrc || 'own:deck');

  const prevDealSrc = btnDefDealSrc?.value;
  fillSelect(btnDefDealSrc, [
    { value: 'all', label: '全領域にある' },
    ...buildAreaRefOptions('にある', null)
  ], prevDealSrc || 'own:deck');

  const prevDest = btnDefDest?.value;
  fillSelect(btnDefDest, buildAreaRefOptions('へ', null), prevDest || 'own:hand');

  rebuildDealDestButtons();
}

function selectPlacementOption(placementKey) {
  const targetKey = placementKey || 'spread';
  if (btnDefPlacementVal) btnDefPlacementVal.value = targetKey;

  if (targetKey === 'spread') {
    btnPlacementSpread?.classList.add('active');
    placementGridContainer?.querySelectorAll('.grid-cell-btn').forEach(b => b.classList.remove('active'));
  } else {
    btnPlacementSpread?.classList.remove('active');
    placementGridContainer?.querySelectorAll('.grid-cell-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-placement') === targetKey);
    });
  }
}

// ---- タグ条件ビルダー ----
function clearTagConditions() {
  if (!tagConditionsList) return;
  tagConditionsList.innerHTML = '';
  addTagConditionRow(); // 初期1行
}

function addTagConditionRow(data = null) {
  if (!tagConditionsList) return;

  const definedTags = getAllDefinedTags();
  const rowCount = tagConditionsList.children.length;
  const row = document.createElement('div');
  row.className = 'tag-condition-row';

  // 2行目以降は「かつ (AND) / または (OR)」セレクト
  let logicHtml = '';
  if (rowCount > 0) {
    logicHtml = `
      <select class="tag-condition-op-select">
        <option value="and"${data?.logical === 'and' ? ' selected' : ''}>かつ</option>
        <option value="or"${data?.logical === 'or' ? ' selected' : ''}>または</option>
      </select>
    `;
  } else {
    logicHtml = `<span style="font-size:11px; font-weight:700; color:#a78bfa; width:40px;">条件:</span>`;
  }

  // タグ名ドロップダウン
  let tagOptionsHtml = '';
  if (definedTags.length === 0) {
    tagOptionsHtml = '<option value="">(タグが未定義です)</option>';
  } else {
    tagOptionsHtml = definedTags.map(t =>
      `<option value="${escapeHtml(t.name)}"${data?.tagName === t.name ? ' selected' : ''}>🏷️ ${escapeHtml(t.name)}</option>`
    ).join('');
  }

  row.innerHTML = `
    ${logicHtml}
    <select class="tag-condition-key-select">${tagOptionsHtml}</select>
    <select class="tag-condition-comp-select">
      <option value=="${data?.op === '==' ? ' selected' : ''}">と同じ (==)</option>
      <option value=">"${data?.op === '>' ? ' selected' : ''}>より大きい (&gt;)</option>
      <option value=">="${data?.op === '>=' ? ' selected' : ''}>以上 (&gt;=)</option>
      <option value="<"${data?.op === '<' ? ' selected' : ''}>より小さい (&lt;)</option>
      <option value="<="${data?.op === '<=' ? ' selected' : ''}>以下 (&lt;=)</option>
    </select>
    <input type="text" class="tag-condition-val-input" placeholder="値" value="${escapeHtml(data?.value || '')}" />
    ${rowCount > 0 ? '<button type="button" class="tag-condition-del-btn" title="条件を削除">✕</button>' : ''}
  `;

  if (rowCount > 0) {
    row.querySelector('.tag-condition-del-btn')?.addEventListener('click', () => {
      row.remove();
    });
  }

  tagConditionsList.appendChild(row);
}

function getTagConditionsFromUI() {
  if (!tagConditionsList) return [];
  const rows = Array.from(tagConditionsList.querySelectorAll('.tag-condition-row'));
  const conditions = [];

  rows.forEach((row, index) => {
    const logical = index === 0 ? 'and' : (row.querySelector('.tag-condition-op-select')?.value || 'and');
    const tagName = row.querySelector('.tag-condition-key-select')?.value || '';
    const op = row.querySelector('.tag-condition-comp-select')?.value || '==';
    const valInput = row.querySelector('.tag-condition-val-input')?.value ?? '';

    if (tagName) {
      conditions.push({ logical, tagName, op, value: valInput.trim() });
    }
  });

  return conditions;
}

function updateButtonFormVisibility() {
  const action = btnDefAction?.value || 'move';
  const what = btnDefWhat?.value || 'all_cards';
  const show = (el, visible) => { if (el) el.style.display = visible ? '' : 'none'; };

  const isDraw = (action === 'draw');
  const isDeal = (action === 'deal');
  const isSelected = (what === 'selected');
  const isTagFilter = (what === 'tag_filter');

  // 配る専用フィールド群
  show(btnDefDealFields, isDeal);
  if (isDeal && SELECTED_DEAL_DESTS.size === 0) {
    selectDealHandsOnly();
  }

  // ドロー専用フィールド群
  show(btnDefDrawSrcGroup, isDraw);
  show(btnDefDrawCountGroup, isDraw);
  show(btnDefDrawPosGroup, isDraw);
  show(btnDefDrawFaceGroup, isDraw);

  // 対象（なにを / どこのエリア / 誰の）: ドロー・配る時は非表示
  show(btnDefWhatGroup, !isDraw && !isDeal);
  show(btnDefSrcAreaGroup, !isDraw && !isDeal && !isSelected);
  show(btnDefSrcOwnerGroup, !isDraw && !isDeal && !isSelected);

  // タグ指定条件群: 項目3で「タグ指定」を選んだ時のみ
  show(btnDefTagConditionsGroup, !isDraw && !isDeal && isTagFilter && !isSelected);

  // 移動先／ドロー先 & 置き方: 移動またはドロー時
  show(btnDefDestGroup, action === 'move' || isDraw);
  show(btnDefPlacementGroup, action === 'move' || isDraw);

  if (btnDefDestLabel) {
    btnDefDestLabel.textContent = isDraw ? 'ドロー先（どこへ）' : '移動先（どこへ）';
  }

  // 回転 & 角度
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
  const what = btnDefWhat?.value;
  let hint = '';

  if (AREAS.length === 0) {
    hint = '💡 フィールドにエリアがありません。「エリア追加」で作成すると、ここに選択肢として表示されます。';
  } else if (action === 'deal') {
    if (AREAS.length === 0) {
      hint = '⚠️ 配布先のエリアがありません。手札エリア等を追加してください。';
    } else {
      hint = '💡 デッキ等の山札から、指定した複数のエリア（手札など）へカードを一括・均等配布します。';
    }
  } else if (action === 'draw') {
    if (!btnDefDest || btnDefDest.options.length === 0) {
      hint = '⚠️ ドロー先にできるエリアがありません。手札エリア等を追加してください。';
    } else {
      hint = '💡 山札（デッキエリアなど）からカードを指定枚数ドローします。';
    }
  } else if (action === 'move' && (!btnDefDest || btnDefDest.options.length === 0)) {
    hint = '⚠️ 移動先にできるエリアがありません。別のエリアを追加してください。';
  } else if (what === 'tag_filter' && getAllDefinedTags().length === 0) {
    hint = '💡 カードタイプにタグが定義されていません。「カード全般設定」からタグ（例: Cost, Mark）を追加してください。';
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

  // 1. 配る場合 (deal)
  if (action === 'deal') {
    const dealSrc = valueToRef(btnDefDealSrc?.value);
    if (!dealSrc) {
      alert('配布元エリアを選択してください。');
      return;
    }
    if (SELECTED_DEAL_DESTS.size === 0) {
      alert('配布先エリア（どこに）を少なくとも1つ選択してください。');
      return;
    }
    const dealAll = !!btnDefDealAll?.checked;
    const count = parseInt(btnDefDealCount?.value, 10);
    if (!dealAll && (Number.isNaN(count) || count < 1)) {
      alert('枚数は 1 以上の数値を入力してください。');
      return;
    }

    const newBtn = {
      id: `btn_${Date.now()}`,
      label,
      action: 'deal',
      itemType: 'all_cards',
      dealSrc,
      dealDests: Array.from(SELECTED_DEAL_DESTS),
      dealAll,
      dealCount: dealAll ? 0 : count,
      dealMethod: btnDefDealMethod?.value || 'round_robin',
      dealPlacement: btnDefDealPlacement?.value || 'spread_lr',
      dealFace: btnDefDealFace?.value || 'face_down'
    };

    PLAY_BUTTONS.push(newBtn);
    renderPlayButtons();
    if (modalAddButton) modalAddButton.style.display = 'none';
    scheduleSaveRoom();
    return;
  }

  // 2. ドローする場合
  if (action === 'draw') {
    const drawSrc = valueToRef(btnDefDrawSrc?.value);
    if (!drawSrc) {
      alert('ドロー元エリアを選択してください。');
      return;
    }
    const dest = valueToRef(btnDefDest?.value);
    if (!dest) {
      alert('ドロー先（どこへ）を選択してください。');
      return;
    }
    if (refToValue(drawSrc) === refToValue(dest)) {
      alert('ドロー元エリアとドロー先エリアが同じです。別のドロー先を選択してください。');
      return;
    }
    const count = parseInt(btnDefDrawCount?.value, 10);
    if (Number.isNaN(count) || count < 1) {
      alert('枚数は 1 以上の数値を入力してください。');
      return;
    }

    const newBtn = {
      id: `btn_${Date.now()}`,
      label,
      action: 'draw',
      itemType: 'all_cards',
      drawSrc,
      drawPos: btnDefDrawPos?.value === 'bottom' ? 'bottom' : 'top',
      drawCount: count,
      drawFace: btnDefDrawFace?.value || 'keep',
      dest,
      placement: btnDefPlacementVal?.value || 'spread'
    };

    PLAY_BUTTONS.push(newBtn);
    renderPlayButtons();
    if (modalAddButton) modalAddButton.style.display = 'none';
    scheduleSaveRoom();
    return;
  }

  // 2. 移動 / 裏表 / 回転
  const itemType = btnDefWhat?.value || 'all_cards';
  const sourceArea = btnDefSrcArea?.value || 'all';
  const sourceOwner = btnDefSrcOwner?.value || 'any';

  const newBtn = {
    id: `btn_${Date.now()}`,
    label,
    action,
    itemType,
    sourceArea,
    sourceOwner
  };

  if (itemType === 'tag_filter') {
    const conditions = getTagConditionsFromUI();
    if (conditions.length === 0 || !conditions[0].tagName) {
      alert('タグ指定の条件を設定してください（タグ名が未選択です）。');
      return;
    }
    newBtn.tagConditions = conditions;
  }

  if (action === 'move') {
    const dest = valueToRef(btnDefDest?.value);
    if (!dest) {
      alert('移動先（どこへ）を選択してください。');
      return;
    }
    if (itemType !== 'selected' && sourceArea === refToValue(dest)) {
      alert('移動元エリアと移動先エリアが同じです。別の移動先を選択してください。');
      return;
    }
    newBtn.dest = dest;
    newBtn.placement = btnDefPlacementVal?.value || 'spread';
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
    item.title = issue ? `⚠️ ${issue}` : describeButton(btnDef);
    item.innerHTML = `
      <span class="play-btn-label">
        <span>${issue ? '⚠️' : '▶'} ${escapeHtml(btnDef.label)}</span>
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

// ---- 対象抽出ロジック ----
function getTargetEntities(btnDef) {
  if (btnDef.itemType === 'selected') {
    if (SELECTED_ENTITY_ID) {
      const ent = ENTITIES.find(e => e.id === SELECTED_ENTITY_ID);
      return ent ? [ent] : [];
    }
    return [];
  }

  const actingPlayer = getActingPlayer();

  return ENTITIES.filter(ent => {
    // 1. アイテム種類（なにを）
    if (btnDef.itemType === 'all_cards' && ent.type !== 'card') return false;
    if (btnDef.itemType === 'all_pieces' && ent.type !== 'piece') return false;
    if (btnDef.itemType === 'all_boards' && ent.type !== 'board') return false;
    if (btnDef.itemType === 'tag_filter' && ent.type !== 'card') return false;

    // 2. エリア（どこの）
    if (btnDef.sourceArea && btnDef.sourceArea !== 'all') {
      const srcRef = valueToRef(btnDef.sourceArea);
      const srcArea = resolveAreaRef(srcRef);
      if (!srcArea || !isEntityOverlappingArea(ent, srcArea)) return false;
    }

    // 3. 所有者（誰の）
    if (btnDef.sourceOwner && btnDef.sourceOwner !== 'any') {
      const targetOwner = (btnDef.sourceOwner === 'mine') ? actingPlayer : btnDef.sourceOwner;
      const curArea = AREAS.find(a => isEntityOverlappingArea(ent, a));
      const entOwner = ent.owner || (curArea ? curArea.owner : 'shared');
      if (entOwner !== targetOwner) return false;
    }

    // 4. タグ条件（タグ指定の場合）
    if (btnDef.itemType === 'tag_filter' && Array.isArray(btnDef.tagConditions) && btnDef.tagConditions.length > 0) {
      if (!matchesTagConditions(ent, btnDef.tagConditions)) return false;
    }

    return true;
  });
}

function matchesTagConditions(ent, conditions) {
  if (!conditions || conditions.length === 0) return true;
  if (!ent.cardTypeId || !CARD_SCHEMAS[ent.cardTypeId]) return false;

  const schema = CARD_SCHEMAS[ent.cardTypeId];
  const tagValues = ent.tagValues || {};

  let result = null;

  for (const cond of conditions) {
    const tagDef = schema.tags.find(t => t.name === cond.tagName || t.id === cond.tagName);
    const rawVal = tagDef ? (tagValues[tagDef.id] ?? '') : '';
    const condVal = cond.value ?? '';

    let match = false;
    const numRaw = parseFloat(rawVal);
    const numCond = parseFloat(condVal);
    const isBothNum = !isNaN(numRaw) && !isNaN(numCond);

    switch (cond.op) {
      case '==':
        match = isBothNum ? numRaw === numCond : String(rawVal).toLowerCase() === String(condVal).toLowerCase();
        break;
      case '>':
        match = isBothNum ? numRaw > numCond : String(rawVal) > String(condVal);
        break;
      case '>=':
        match = isBothNum ? numRaw >= numCond : String(rawVal) >= String(condVal);
        break;
      case '<':
        match = isBothNum ? numRaw < numCond : String(rawVal) < String(condVal);
        break;
      case '<=':
        match = isBothNum ? numRaw <= numCond : String(rawVal) <= String(condVal);
        break;
      default:
        match = false;
    }

    if (result === null) {
      result = match;
    } else {
      if (cond.logical === 'or') {
        result = result || match;
      } else {
        result = result && match;
      }
    }
  }

  return !!result;
}

// ---- 実行と配置計算 ----
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
  const mode = placement || 'spread';

  // 1. 横並び (spread, spread_lr: 左から右へ, spread_rl: 右から左へ)
  if (mode === 'spread' || mode === 'spread_lr' || mode === 'spread_rl') {
    const movingIds = new Set(movingEnts.map(e => e.id));
    const existing = ENTITIES.filter(ent => isEntityOverlappingArea(ent, area) && !movingIds.has(ent.id))
      .sort((a, b) => a.x - b.x);
    const all = (mode === 'spread_rl')
      ? [...existing, ...movingEnts.slice().reverse()]
      : [...existing, ...movingEnts];
    const n = all.length;
    if (n === 0) return;

    const cardW = Math.max(...all.map(e => e.w || 120));
    const gap = 10;
    const padding = 15;
    const usable = Math.max(area.w - padding * 2, cardW);
    let step = cardW + gap;
    if (n > 1 && cardW + step * (n - 1) > usable) {
      step = (usable - cardW) / (n - 1);
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
    return;
  }

  // 2. 縦並び (spread_tb: 上から下へ, spread_bt: 下から上へ)
  if (mode === 'spread_tb' || mode === 'spread_bt') {
    const movingIds = new Set(movingEnts.map(e => e.id));
    const existing = ENTITIES.filter(ent => isEntityOverlappingArea(ent, area) && !movingIds.has(ent.id))
      .sort((a, b) => a.y - b.y);
    const all = (mode === 'spread_bt')
      ? [...existing, ...movingEnts.slice().reverse()]
      : [...existing, ...movingEnts];
    const n = all.length;
    if (n === 0) return;

    const cardH = Math.max(...all.map(e => e.h || 160));
    const gap = 10;
    const padding = 15;
    const usable = Math.max(area.h - padding * 2, cardH);
    let step = cardH + gap;
    if (n > 1 && cardH + step * (n - 1) > usable) {
      step = (usable - cardH) / (n - 1);
    }
    const totalH = cardH + step * (n - 1);
    const startY = area.y + (area.h - totalH) / 2;

    all.forEach((ent, i) => {
      const w = ent.w || 120;
      ent.x = Math.round(area.x + area.w / 2 - w / 2);
      ent.y = Math.round(startY + step * i);
      HIGHEST_Z += 1;
      ent.z = HIGHEST_Z;
      applyEntityPosition(ent);
    });
    return;
  }

  // 3. 重ねる / 9方向グリッド重ね
  const pad = 15;
  movingEnts.forEach(ent => {
    const w = ent.w || 120;
    const h = ent.h || 160;

    let targetX = area.x + (area.w - w) / 2;
    let targetY = area.y + (area.h - h) / 2;

    // X軸
    if (mode.includes('left')) {
      targetX = area.x + pad;
    } else if (mode.includes('right')) {
      targetX = area.x + area.w - w - pad;
    }

    // Y軸
    if (mode.includes('top')) {
      targetY = area.y + pad;
    } else if (mode.includes('bottom')) {
      targetY = area.y + area.h - h - pad;
    }

    ent.x = Math.round(targetX);
    ent.y = Math.round(targetY);
    HIGHEST_Z += 1;
    ent.z = HIGHEST_Z;
    applyEntityPosition(ent);
  });
}

function executePlayAction(rawDef) {
  const btnDef = normalizeButtonDef(rawDef);

  // 1. 配る処理 (deal)
  if (btnDef.action === 'deal') {
    let sourceCards = [];
    let sourceName = '';

    if (btnDef.dealSrc?.kind === 'all') {
      sourceCards = ENTITIES.filter(e => e.type === 'card');
      sourceName = '全領域';
    } else {
      const srcArea = resolveAreaRef(btnDef.dealSrc);
      if (!srcArea) {
        showToast(btnDef.dealSrc?.kind === 'own'
          ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.dealSrc.areaType)}がありません`
          : '配布元エリアが見つかりません');
        return;
      }
      sourceName = `「${getAreaDisplayName(srcArea)}」`;
      sourceCards = ENTITIES.filter(e => e.type === 'card' && isEntityOverlappingArea(e, srcArea));
    }

    if (sourceCards.length === 0) {
      showToast(`${sourceName}にカードがありません`);
      return;
    }

    // 配布先エリアの解決
    const destAreas = [];
    (btnDef.dealDests || []).forEach(refOrId => {
      let resolved = null;
      if (typeof refOrId === 'string' && (refOrId.startsWith('area:') || refOrId.startsWith('own:'))) {
        resolved = resolveAreaRef(valueToRef(refOrId));
      } else if (typeof refOrId === 'object') {
        resolved = resolveAreaRef(refOrId);
      } else {
        resolved = AREAS.find(a => a.id === refOrId);
      }
      if (resolved && !destAreas.some(d => d.id === resolved.id)) {
        destAreas.push(resolved);
      }
    });

    if (destAreas.length === 0) {
      showToast('配布先のエリアが見つかりません');
      return;
    }

    // 山札の上から配る (z降順: 大きい順)
    sourceCards.sort((a, b) => (b.z || 0) - (a.z || 0));

    let cardsPerArea = 0;
    if (btnDef.dealAll) {
      cardsPerArea = Math.floor(sourceCards.length / destAreas.length);
    } else {
      cardsPerArea = Math.max(1, Number(btnDef.dealCount) || 1);
    }

    if (cardsPerArea < 1) {
      showToast('配布できるカード枚数が足りません');
      return;
    }

    const distributedMap = new Map();
    destAreas.forEach(a => distributedMap.set(a.id, []));

    let cardIndex = 0;
    let shortage = false;

    if (btnDef.dealMethod === 'bulk') {
      for (const area of destAreas) {
        for (let i = 0; i < cardsPerArea; i++) {
          if (cardIndex < sourceCards.length) {
            distributedMap.get(area.id).push(sourceCards[cardIndex]);
            cardIndex++;
          } else {
            shortage = true;
            break;
          }
        }
        if (shortage) break;
      }
    } else {
      // 1枚ずつ (ラウンドロビン)
      for (let round = 0; round < cardsPerArea; round++) {
        for (const area of destAreas) {
          if (cardIndex < sourceCards.length) {
            distributedMap.get(area.id).push(sourceCards[cardIndex]);
            cardIndex++;
          } else {
            shortage = true;
            break;
          }
        }
        if (shortage) break;
      }
    }

    destAreas.forEach(area => {
      const cards = distributedMap.get(area.id);
      if (!cards || cards.length === 0) return;

      if (btnDef.dealFace === 'face_up') {
        cards.forEach(c => {
          c.isFaceDown = false;
          const dom = document.getElementById(c.id);
          if (dom) updateEntityInnerDOM(dom, c);
        });
      } else if (btnDef.dealFace === 'face_down') {
        cards.forEach(c => {
          c.isFaceDown = true;
          const dom = document.getElementById(c.id);
          if (dom) updateEntityInnerDOM(dom, c);
        });
      }

      placeEntitiesInArea(cards, area, btnDef.dealPlacement || 'spread_lr');
    });

    const totalDistributed = cardIndex;
    if (shortage) {
      showToast(`山札が途中で不足したため、計${totalDistributed}枚を配布して終了しました`);
    } else {
      showToast(`${sourceName}から各${cardsPerArea}枚（計${totalDistributed}枚）を配布しました`);
    }

    scheduleSaveRoom();
    return;
  }

  // 2. ドロー処理
  if (btnDef.action === 'draw') {
    let sourceCards = [];
    let sourceName = '';

    if (btnDef.drawSrc?.kind === 'all') {
      sourceCards = ENTITIES.filter(e => e.type === 'card');
      sourceName = '全領域';
    } else {
      const srcArea = resolveAreaRef(btnDef.drawSrc);
      if (!srcArea) {
        showToast(btnDef.drawSrc?.kind === 'own'
          ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.drawSrc.areaType)}がありません`
          : 'ドロー元エリアが見つかりません');
        return;
      }
      sourceName = `「${getAreaDisplayName(srcArea)}」`;
      sourceCards = ENTITIES.filter(e => e.type === 'card' && isEntityOverlappingArea(e, srcArea));
    }

    if (sourceCards.length === 0) {
      showToast(`${sourceName}にカードがありません`);
      return;
    }

    const destArea = resolveAreaRef(btnDef.dest);
    if (!destArea) {
      showToast(btnDef.dest?.kind === 'own'
        ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.dest.areaType)}がありません`
        : 'ドロー先エリアが見つかりません');
      return;
    }

    // ソート: 上から(top) = z降順 (大きい順), 下から(bottom) = z昇順 (小さい順)
    if (btnDef.drawPos === 'bottom') {
      sourceCards.sort((a, b) => (a.z || 0) - (b.z || 0));
    } else {
      sourceCards.sort((a, b) => (b.z || 0) - (a.z || 0));
    }

    const reqCount = Math.max(1, Number(btnDef.drawCount) || 1);
    const actualCount = Math.min(reqCount, sourceCards.length);
    const drawn = sourceCards.slice(0, actualCount);

    // 表裏の変更
    if (btnDef.drawFace === 'face_up') {
      drawn.forEach(c => {
        c.isFaceDown = false;
        const dom = document.getElementById(c.id);
        if (dom) updateEntityInnerDOM(dom, c);
      });
    } else if (btnDef.drawFace === 'face_down') {
      drawn.forEach(c => {
        c.isFaceDown = true;
        const dom = document.getElementById(c.id);
        if (dom) updateEntityInnerDOM(dom, c);
      });
    }

    // 移動先へ配置
    placeEntitiesInArea(drawn, destArea, btnDef.placement);

    const destName = `「${getAreaDisplayName(destArea)}」`;
    if (actualCount < reqCount) {
      showToast(`山札が不足しているため、${actualCount}枚のみドローしました（残り0枚）`);
    } else {
      showToast(`${sourceName}から${actualCount}枚ドローして${destName}へ置きました`);
    }

    scheduleSaveRoom();
    return;
  }

  // 2. 移動 / 裏表 / 回転処理
  const targets = getTargetEntities(btnDef);

  if (btnDef.itemType === 'selected' && (!SELECTED_ENTITY_ID || targets.length === 0)) {
    showToast('カードまたはアイテムを選択してください');
    return;
  }

  if (targets.length === 0) {
    showToast('対象となるアイテムがありません');
    return;
  }

  switch (btnDef.action) {
    case 'move': {
      const destArea = resolveAreaRef(btnDef.dest);
      if (!destArea) {
        showToast(btnDef.dest?.kind === 'own'
          ? `${getOwnerLabel(getActingPlayer())} の${getAreaTypeName(btnDef.dest.areaType)}がありません`
          : '移動先エリアが見つかりません');
        return;
      }
      placeEntitiesInArea(targets, destArea, btnDef.placement);
      showToast(`${targets.length}個のアイテムを「${getAreaDisplayName(destArea)}」へ移動しました`);
      break;
    }
    case 'flip_toggle':
    case 'flip_down':
    case 'flip_up': {
      let count = 0;
      targets.forEach(ent => {
        if (ent.type !== 'card') return;
        count++;
        if (btnDef.action === 'flip_toggle') ent.isFaceDown = !ent.isFaceDown;
        else ent.isFaceDown = (btnDef.action === 'flip_down');
        const dom = document.getElementById(ent.id);
        if (dom) updateEntityInnerDOM(dom, ent);
      });
      showToast(`${count}枚のカードの表裏を変更しました`);
      break;
    }
    case 'rotate': {
      const delta = (Number(btnDef.angle) || 0) * (btnDef.direction === 'ccw' ? -1 : 1);
      targets.forEach(ent => {
        ent.angle = (((ent.angle || 0) + delta) % 360 + 360) % 360;
        applyEntityAngle(ent);
      });
      showToast(`${targets.length}個のアイテムを${btnDef.direction === 'ccw' ? '左' : '右'}に${btnDef.angle}°回転しました`);
      break;
    }
    case 'set_angle': {
      const angle = ((Number(btnDef.angle) || 0) % 360 + 360) % 360;
      targets.forEach(ent => {
        ent.angle = angle;
        applyEntityAngle(ent);
      });
      showToast(`${targets.length}個のアイテムの向きを${angle}°にそろえました`);
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
// CPU & Automation Management (CPU座席設定・動作ルール・自動ターン実行)
// ============================================================================

// ---- CPU座席表示サマリー ----
function renderCpuSeatsSummary() {
  if (!cpuSeatsSummary) return;
  cpuSeatsSummary.innerHTML = '';

  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const seatKey = `player${i}`;
    const isCpu = CPU_SEATS.has(seatKey);
    const badge = document.createElement('span');
    badge.className = `cpu-seat-badge${isCpu ? ' is-cpu' : ''}`;
    badge.textContent = `P${i}: ${isCpu ? '🤖CPU' : '👤人間'}`;
    badge.title = `P${i} (${isCpu ? 'CPUプレイヤー' : '人間プレイヤー'})`;
    cpuSeatsSummary.appendChild(badge);
  }
}

// ---- CPU座席設定モーダル ----
function openCpuSeatsModal() {
  if (!cpuSeatsList || !modalCpuSeats) return;
  cpuSeatsList.innerHTML = '';

  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const seatKey = `player${i}`;
    const isCpu = CPU_SEATS.has(seatKey);

    const row = document.createElement('div');
    row.className = 'cpu-seat-row';
    row.dataset.seat = seatKey;
    row.innerHTML = `
      <span class="cpu-seat-name">P${i} (プレイヤー${i})</span>
      <div class="cpu-role-toggle">
        <button type="button" class="cpu-toggle-btn${!isCpu ? ' active' : ''}" data-role="human">👤 人間</button>
        <button type="button" class="cpu-toggle-btn${isCpu ? ' active' : ''}" data-role="cpu">🤖 CPU</button>
      </div>
    `;

    const humanBtn = row.querySelector('.cpu-toggle-btn[data-role="human"]');
    const cpuBtn = row.querySelector('.cpu-toggle-btn[data-role="cpu"]');

    humanBtn?.addEventListener('click', () => {
      humanBtn.classList.add('active');
      cpuBtn?.classList.remove('active');
    });

    cpuBtn?.addEventListener('click', () => {
      cpuBtn.classList.add('active');
      humanBtn?.classList.remove('active');
    });

    cpuSeatsList.appendChild(row);
  }

  modalCpuSeats.style.display = 'flex';
}

function saveCpuSeats() {
  if (!cpuSeatsList) return;
  const newSet = new Set();
  cpuSeatsList.querySelectorAll('.cpu-seat-row').forEach(row => {
    const seatKey = row.dataset.seat;
    const cpuBtn = row.querySelector('.cpu-toggle-btn[data-role="cpu"]');
    if (cpuBtn && cpuBtn.classList.contains('active')) {
      newSet.add(seatKey);
    }
  });

  CPU_SEATS = newSet;
  renderCpuSeatsSummary();
  if (modalCpuSeats) modalCpuSeats.style.display = 'none';
  scheduleSaveRoom();
  showToast('CPU座席設定を保存しました');
}

// ---- CPUルール一覧表示 ----
function renderCpuRulesList() {
  if (!cpuRulesContainer) return;
  cpuRulesContainer.innerHTML = '';

  if (!CPU_RULES || CPU_RULES.length === 0) {
    cpuRulesContainer.innerHTML = '<div class="empty-notice" id="cpu-rules-empty">ルールが未設定です</div>';
    return;
  }

  CPU_RULES.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'cpu-rule-item';

    const targetLabel = rule.targetSeat === 'all'
      ? '全CPU共通'
      : (getOwnerLabel(rule.targetSeat) + '専用');

    let descText = '';
    if (Array.isArray(rule.blocks) && rule.blocks.length > 0) {
      descText = rule.blocks.map((b, i) => {
        if (b.type === 'action') {
          if (b.actionType === 'action_draw') return `ドロー(${b.count || 1}枚)`;
          if (b.actionType === 'action_pass') return 'パス';
          return `${refLabel(valueToRef(b.srcArea))} → ${refLabel(valueToRef(b.destArea))}`;
        }
        if (b.type === 'condition_if') {
          const thenType = b.thenAction?.actionType === 'action_pass' ? 'パス' : (b.thenAction?.actionType === 'action_draw' ? 'ドロー' : '出す');
          const elseType = b.elseAction?.actionType === 'action_pass' ? 'パス' : (b.elseAction?.actionType === 'action_draw' ? 'ドロー' : '出す');
          return `条件分岐 (YES:${thenType} / NO:${elseType})`;
        }
        return `ステップ${i + 1}`;
      }).join(' ➔ ');
    } else {
      const srcText = refLabel(valueToRef(rule.srcArea));
      const destText = refLabel(valueToRef(rule.destArea));
      const countText = `${rule.count || 1}枚`;
      const filterText = (rule.filterMode === 'tag_condition' && rule.tagConditions?.length > 0)
        ? rule.tagConditions.map(c => `${c.tagName}${c.op}${c.value}`).join(' & ')
        : '全カード';
      descText = `${srcText} (${filterText}) → ${destText} (${countText})`;
    }

    item.innerHTML = `
      <div class="cpu-rule-header">
        <span class="cpu-rule-title">⚡ ${escapeHtml(rule.name || `ルール #${idx + 1}`)}</span>
        <span class="cpu-rule-badge">${escapeHtml(targetLabel)}</span>
      </div>
      <div class="cpu-rule-desc">
        ${escapeHtml(descText)}
      </div>
      <div class="cpu-rule-actions">
        <button type="button" class="mini-tool-btn btn-edit-cpu-rule" title="編集">✏️ 編集</button>
        <button type="button" class="mini-tool-btn btn-del-cpu-rule" title="削除" style="color:#f87171;">✕ 削除</button>
      </div>
    `;

    item.querySelector('.btn-edit-cpu-rule')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCpuRuleModal(rule.id);
    });

    item.querySelector('.btn-del-cpu-rule')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`CPUルール「${rule.name}」を削除しますか？`)) {
        CPU_RULES = CPU_RULES.filter(r => r.id !== rule.id);
        renderCpuRulesList();
        scheduleSaveRoom();
      }
    });

    cpuRulesContainer.appendChild(item);
  });
}

// ---- CPUルール編集モーダル & フロービルダー ----
function migrateLegacyRuleToBlocks(rule) {
  if (Array.isArray(rule.blocks) && rule.blocks.length > 0) {
    return JSON.parse(JSON.stringify(rule.blocks));
  }
  return [
    {
      id: `blk_${Date.now()}_1`,
      type: 'condition_if',
      condType: 'has_card',
      checkArea: rule.srcArea || 'own:hand',
      filterMode: rule.filterMode || 'none',
      tagConditions: Array.isArray(rule.tagConditions) ? JSON.parse(JSON.stringify(rule.tagConditions)) : [],
      countOp: '>=',
      countVal: 1,
      thenAction: {
        actionType: 'action_move',
        srcArea: rule.srcArea || 'own:hand',
        filterMode: rule.filterMode || 'none',
        tagConditions: Array.isArray(rule.tagConditions) ? JSON.parse(JSON.stringify(rule.tagConditions)) : [],
        count: rule.count || 1,
        pickOrder: rule.pickOrder || 'first',
        sortTag: rule.sortTag || '',
        destArea: rule.destArea || (AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center'),
        placement: rule.placement || 'spread_lr',
        face: rule.face || 'face_up'
      },
      elseAction: {
        actionType: rule.fallback === 'draw' ? 'action_draw' : 'action_pass',
        count: 1
      }
    }
  ];
}

function openCpuRuleModal(editRuleId = null) {
  if (!modalCpuRule) return;

  const rule = editRuleId ? CPU_RULES.find(r => r.id === editRuleId) : null;
  if (cpuRuleEditId) cpuRuleEditId.value = editRuleId || '';

  // 1. ルール名
  if (cpuRuleName) {
    cpuRuleName.value = rule ? rule.name : '基本ルーチン（ドロー→判定→プレイ）';
  }

  // 2. 対象CPU座席
  if (cpuRuleTargetSeat) {
    const prevVal = rule ? rule.targetSeat : 'all';
    cpuRuleTargetSeat.innerHTML = '<option value="all">全CPU座席共通（どのCPUでも実行）</option>';
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const seatKey = `player${i}`;
      const opt = document.createElement('option');
      opt.value = seatKey;
      opt.textContent = `P${i} (プレイヤー${i}) 専用${CPU_SEATS.has(seatKey) ? ' [CPU]' : ''}`;
      cpuRuleTargetSeat.appendChild(opt);
    }
    cpuRuleTargetSeat.value = prevVal;
  }

  // 3. フローブロックの初期化
  if (rule) {
    EDITING_CPU_BLOCKS = migrateLegacyRuleToBlocks(rule);
  } else {
    // デフォルト: 「ドローする」→「もし出せるカードがあれば出す、なければパス」
    EDITING_CPU_BLOCKS = [
      {
        id: `blk_${Date.now()}_1`,
        type: 'action',
        actionType: 'action_draw',
        count: 1
      },
      {
        id: `blk_${Date.now()}_2`,
        type: 'condition_if',
        condType: 'has_card',
        checkArea: 'own:hand',
        filterMode: 'none',
        tagConditions: [],
        countOp: '>=',
        countVal: 1,
        thenAction: {
          actionType: 'action_move',
          srcArea: 'own:hand',
          filterMode: 'none',
          tagConditions: [],
          count: 1,
          pickOrder: 'first',
          sortTag: '',
          destArea: AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center',
          placement: 'spread_lr',
          face: 'face_up'
        },
        elseAction: {
          actionType: 'action_pass',
          count: 1
        }
      }
    ];
  }

  renderCpuFlowBlocks();
  modalCpuRule.style.display = 'flex';
}

function addCpuFlowActionBlock() {
  EDITING_CPU_BLOCKS.push({
    id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'action',
    actionType: 'action_move',
    srcArea: 'own:hand',
    filterMode: 'none',
    tagConditions: [],
    count: 1,
    pickOrder: 'first',
    sortTag: '',
    destArea: AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center',
    placement: 'spread_lr',
    face: 'face_up'
  });
  renderCpuFlowBlocks();
}

function addCpuFlowIfBlock() {
  EDITING_CPU_BLOCKS.push({
    id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'condition_if',
    condType: 'has_card',
    checkArea: 'own:hand',
    filterMode: 'none',
    tagConditions: [],
    countOp: '>=',
    countVal: 1,
    thenAction: {
      actionType: 'action_move',
      srcArea: 'own:hand',
      filterMode: 'none',
      tagConditions: [],
      count: 1,
      pickOrder: 'first',
      sortTag: '',
      destArea: AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center',
      placement: 'spread_lr',
      face: 'face_up'
    },
    elseAction: {
      actionType: 'action_pass',
      count: 1
    }
  });
  renderCpuFlowBlocks();
}

// タグ条件エディタコンポーネント
function createTagConditionsEditor(tagConditions, onUpdate) {
  const container = document.createElement('div');
  container.className = 'cpu-tag-conditions-wrap';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '6px';
  container.style.marginTop = '4px';

  const rowsList = document.createElement('div');
  rowsList.style.display = 'flex';
  rowsList.style.flexDirection = 'column';
  rowsList.style.gap = '6px';
  container.appendChild(rowsList);

  const definedTags = getAllDefinedTags();

  function renderRows() {
    rowsList.innerHTML = '';
    tagConditions.forEach((cond, idx) => {
      const row = document.createElement('div');
      row.className = 'tag-condition-row';
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.alignItems = 'center';

      let logicHtml = '';
      if (idx > 0) {
        logicHtml = `
          <select class="tag-condition-op-select form-select" style="width:70px; padding:2px 6px; font-size:11px;">
            <option value="and"${cond.logical === 'and' ? ' selected' : ''}>かつ</option>
            <option value="or"${cond.logical === 'or' ? ' selected' : ''}>または</option>
          </select>
        `;
      } else {
        logicHtml = `<span style="font-size:11px; font-weight:700; color:#10b981; width:45px;">条件:</span>`;
      }

      let tagOptionsHtml = '';
      if (definedTags.length === 0) {
        tagOptionsHtml = '<option value="">(タグ未定義)</option>';
      } else {
        tagOptionsHtml = definedTags.map(t =>
          `<option value="${escapeHtml(t.name)}"${cond.tagName === t.name ? ' selected' : ''}>🏷️ ${escapeHtml(t.name)}</option>`
        ).join('');
      }

      row.innerHTML = `
        ${logicHtml}
        <select class="tag-condition-key-select form-select" style="flex:1; padding:2px 6px; font-size:11px;">${tagOptionsHtml}</select>
        <select class="tag-condition-comp-select form-select" style="width:90px; padding:2px 6px; font-size:11px;">
          <option value="=="${cond.op === '==' ? ' selected' : ''}>一致 (==)</option>
          <option value=">"${cond.op === '>' ? ' selected' : ''}>より大きい (&gt;)</option>
          <option value=">="${cond.op === '>=' ? ' selected' : ''}>以上 (&gt;=)</option>
          <option value="<"${cond.op === '<' ? ' selected' : ''}>より小さい (&lt;)</option>
          <option value="<="${cond.op === '<=' ? ' selected' : ''}>以下 (&lt;=)</option>
        </select>
        <input type="text" class="tag-condition-val-input form-input" placeholder="値" value="${escapeHtml(cond.value || '')}" style="width:75px; padding:2px 6px; font-size:11px;" />
        <button type="button" class="cpu-flow-tool-btn del" style="padding:2px 6px;" title="削除">✕</button>
      `;

      row.querySelector('.tag-condition-op-select')?.addEventListener('change', (e) => {
        cond.logical = e.target.value;
        onUpdate();
      });
      row.querySelector('.tag-condition-key-select')?.addEventListener('change', (e) => {
        cond.tagName = e.target.value;
        onUpdate();
      });
      row.querySelector('.tag-condition-comp-select')?.addEventListener('change', (e) => {
        cond.op = e.target.value;
        onUpdate();
      });
      row.querySelector('.tag-condition-val-input')?.addEventListener('input', (e) => {
        cond.value = e.target.value;
        onUpdate();
      });
      row.querySelector('.cpu-flow-tool-btn.del')?.addEventListener('click', () => {
        tagConditions.splice(idx, 1);
        renderRows();
        onUpdate();
      });

      rowsList.appendChild(row);
    });
  }

  renderRows();

  const btnAdd = document.createElement('button');
  btnAdd.type = 'button';
  btnAdd.className = 'btn-add-condition';
  btnAdd.style.alignSelf = 'flex-start';
  btnAdd.style.fontSize = '11px';
  btnAdd.style.padding = '3px 8px';
  btnAdd.innerHTML = '<span>➕ タグ条件を追加</span>';
  btnAdd.addEventListener('click', () => {
    const firstTag = definedTags.length > 0 ? definedTags[0].name : '';
    tagConditions.push({ logical: 'and', tagName: firstTag, op: '==', value: '' });
    renderRows();
    onUpdate();
  });
  container.appendChild(btnAdd);

  return container;
}

// 行動フィールド（カード移動/ドロー/パス）コンポーネント
function createActionFieldsDOM(actionObj, onUpdate) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '8px';

  // 1. 行動タイプ選択
  const typeRow = document.createElement('div');
  typeRow.style.display = 'flex';
  typeRow.style.alignItems = 'center';
  typeRow.style.gap = '8px';
  typeRow.innerHTML = `
    <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">行動内容:</label>
    <select class="form-select action-type-select" style="flex:1; font-size:12px;">
      <option value="action_move"${actionObj.actionType === 'action_move' ? ' selected' : ''}>🎴 カードを出す / 移動</option>
      <option value="action_draw"${actionObj.actionType === 'action_draw' ? ' selected' : ''}>📥 山札からドロー</option>
      <option value="action_pass"${actionObj.actionType === 'action_pass' ? ' selected' : ''}>⏭️ パスしてターン終了</option>
    </select>
  `;
  wrap.appendChild(typeRow);

  const detailsContainer = document.createElement('div');
  detailsContainer.style.display = 'flex';
  detailsContainer.style.flexDirection = 'column';
  detailsContainer.style.gap = '8px';
  wrap.appendChild(detailsContainer);

  function renderDetails() {
    detailsContainer.innerHTML = '';
    const actType = actionObj.actionType || 'action_move';

    if (actType === 'action_draw') {
      const drawRow = document.createElement('div');
      drawRow.style.display = 'flex';
      drawRow.style.alignItems = 'center';
      drawRow.style.gap = '8px';
      drawRow.innerHTML = `
        <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">ドロー枚数:</label>
        <input type="number" class="form-input act-draw-count" min="1" max="99" value="${actionObj.count || 1}" style="width:80px; font-size:12px;" />
        <span style="font-size:11px; color:#94a3b8;">枚（自分の山札から手札へ引く）</span>
      `;
      drawRow.querySelector('.act-draw-count')?.addEventListener('input', (e) => {
        actionObj.count = Math.max(1, parseInt(e.target.value, 10) || 1);
        onUpdate();
      });
      detailsContainer.appendChild(drawRow);
      return;
    }

    if (actType === 'action_pass') {
      const passInfo = document.createElement('div');
      passInfo.style.fontSize = '11px';
      passInfo.style.color = '#94a3b8';
      passInfo.style.padding = '6px 8px';
      passInfo.style.background = 'rgba(0,0,0,0.2)';
      passInfo.style.borderRadius = '4px';
      passInfo.textContent = 'ℹ️ この行動が実行されると、CPUは手番をパスして終了します。';
      detailsContainer.appendChild(passInfo);
      return;
    }

    // actType === 'action_move'
    // 1. 移動元
    const srcRow = document.createElement('div');
    srcRow.style.display = 'flex';
    srcRow.style.alignItems = 'center';
    srcRow.style.gap = '8px';
    srcRow.innerHTML = `
      <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">探索元:</label>
      <select class="form-select act-src-select" style="flex:1; font-size:12px;"></select>
    `;
    const srcSelect = srcRow.querySelector('.act-src-select');
    fillSelect(srcSelect, buildAreaRefOptions('にある', null), actionObj.srcArea || 'own:hand');
    srcSelect.addEventListener('change', (e) => {
      actionObj.srcArea = e.target.value;
      onUpdate();
    });
    detailsContainer.appendChild(srcRow);

    // 2. 絞り込み条件
    const filterRow = document.createElement('div');
    filterRow.style.display = 'flex';
    filterRow.style.flexDirection = 'column';
    filterRow.style.gap = '6px';
    filterRow.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">対象条件:</label>
        <select class="form-select act-filter-select" style="flex:1; font-size:12px;">
          <option value="none"${actionObj.filterMode === 'none' ? ' selected' : ''}>すべて（条件なし / 何でもよい）</option>
          <option value="tag_condition"${actionObj.filterMode === 'tag_condition' ? ' selected' : ''}>属性（タグ）の条件に一致するもの</option>
        </select>
      </div>
    `;
    const filterSelect = filterRow.querySelector('.act-filter-select');
    const tagWrap = document.createElement('div');
    tagWrap.style.display = actionObj.filterMode === 'tag_condition' ? 'block' : 'none';
    if (!Array.isArray(actionObj.tagConditions)) actionObj.tagConditions = [];
    tagWrap.appendChild(createTagConditionsEditor(actionObj.tagConditions, onUpdate));

    filterSelect.addEventListener('change', (e) => {
      actionObj.filterMode = e.target.value;
      tagWrap.style.display = actionObj.filterMode === 'tag_condition' ? 'block' : 'none';
      if (actionObj.filterMode === 'tag_condition' && actionObj.tagConditions.length === 0) {
        const definedTags = getAllDefinedTags();
        const firstTag = definedTags.length > 0 ? definedTags[0].name : '';
        actionObj.tagConditions.push({ logical: 'and', tagName: firstTag, op: '==', value: '' });
        tagWrap.innerHTML = '';
        tagWrap.appendChild(createTagConditionsEditor(actionObj.tagConditions, onUpdate));
      }
      onUpdate();
    });
    filterRow.appendChild(tagWrap);
    detailsContainer.appendChild(filterRow);

    // 3. 枚数 & 優先順位
    const countRow = document.createElement('div');
    countRow.style.display = 'flex';
    countRow.style.alignItems = 'center';
    countRow.style.gap = '8px';
    countRow.style.flexWrap = 'wrap';
    countRow.innerHTML = `
      <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">枚数 & 選択:</label>
      <input type="number" class="form-input act-count" min="1" max="99" value="${actionObj.count || 1}" style="width:65px; font-size:12px;" />
      <span style="font-size:11px; color:#94a3b8;">枚</span>
      <select class="form-select act-pick-order" style="flex:1; min-width:130px; font-size:12px;">
        <option value="first"${actionObj.pickOrder === 'first' ? ' selected' : ''}>最初に見つかったカード</option>
        <option value="random"${actionObj.pickOrder === 'random' ? ' selected' : ''}>ランダム</option>
        <option value="max_tag"${actionObj.pickOrder === 'max_tag' ? ' selected' : ''}>指定タグ最大値優先</option>
        <option value="min_tag"${actionObj.pickOrder === 'min_tag' ? ' selected' : ''}>指定タグ最小値優先</option>
      </select>
    `;
    const countInput = countRow.querySelector('.act-count');
    const pickOrderSelect = countRow.querySelector('.act-pick-order');

    const sortTagSelect = document.createElement('select');
    sortTagSelect.className = 'form-select act-sort-tag';
    sortTagSelect.style.width = '100%';
    sortTagSelect.style.marginTop = '4px';
    sortTagSelect.style.fontSize = '12px';
    const isSort = actionObj.pickOrder === 'max_tag' || actionObj.pickOrder === 'min_tag';
    sortTagSelect.style.display = isSort ? 'block' : 'none';

    const tags = getAllDefinedTags();
    if (tags.length === 0) {
      sortTagSelect.innerHTML = '<option value="">(比較タグ未定義)</option>';
    } else {
      sortTagSelect.innerHTML = tags.map(t =>
        `<option value="${escapeHtml(t.name)}"${actionObj.sortTag === t.name ? ' selected' : ''}>🏷️ ${escapeHtml(t.name)}</option>`
      ).join('');
    }

    countInput.addEventListener('input', (e) => {
      actionObj.count = Math.max(1, parseInt(e.target.value, 10) || 1);
      onUpdate();
    });
    pickOrderSelect.addEventListener('change', (e) => {
      actionObj.pickOrder = e.target.value;
      const needTag = actionObj.pickOrder === 'max_tag' || actionObj.pickOrder === 'min_tag';
      sortTagSelect.style.display = needTag ? 'block' : 'none';
      if (needTag && !actionObj.sortTag && tags.length > 0) {
        actionObj.sortTag = tags[0].name;
      }
      onUpdate();
    });
    sortTagSelect.addEventListener('change', (e) => {
      actionObj.sortTag = e.target.value;
      onUpdate();
    });

    detailsContainer.appendChild(countRow);
    detailsContainer.appendChild(sortTagSelect);

    // 4. 移動先
    const destRow = document.createElement('div');
    destRow.style.display = 'flex';
    destRow.style.alignItems = 'center';
    destRow.style.gap = '8px';
    destRow.innerHTML = `
      <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">移動先:</label>
      <select class="form-select act-dest-select" style="flex:1; font-size:12px;"></select>
    `;
    const destSelect = destRow.querySelector('.act-dest-select');
    fillSelect(destSelect, buildAreaRefOptions('へ', null), actionObj.destArea || (AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center'));
    destSelect.addEventListener('change', (e) => {
      actionObj.destArea = e.target.value;
      onUpdate();
    });
    detailsContainer.appendChild(destRow);

    // 5. 置き方 & 表裏
    const styleRow = document.createElement('div');
    styleRow.style.display = 'grid';
    styleRow.style.gridTemplateColumns = '1fr 1fr';
    styleRow.style.gap = '8px';
    styleRow.innerHTML = `
      <div>
        <label class="form-label" style="font-size:11px; margin-bottom:2px;">置き方</label>
        <select class="form-select act-placement" style="font-size:11px;">
          <option value="spread_lr"${actionObj.placement === 'spread_lr' ? ' selected' : ''}>左から右へ（横並び）</option>
          <option value="stack_center"${actionObj.placement === 'stack_center' ? ' selected' : ''}>中央に重ねる</option>
          <option value="spread_tb"${actionObj.placement === 'spread_tb' ? ' selected' : ''}>上から下へ（縦並び）</option>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:11px; margin-bottom:2px;">表裏</label>
        <select class="form-select act-face" style="font-size:11px;">
          <option value="face_up"${actionObj.face === 'face_up' ? ' selected' : ''}>表向きで出す</option>
          <option value="face_down"${actionObj.face === 'face_down' ? ' selected' : ''}>裏向きでセット</option>
          <option value="keep"${actionObj.face === 'keep' ? ' selected' : ''}>変更しない（そのまま）</option>
        </select>
      </div>
    `;
    styleRow.querySelector('.act-placement')?.addEventListener('change', (e) => {
      actionObj.placement = e.target.value;
      onUpdate();
    });
    styleRow.querySelector('.act-face')?.addEventListener('change', (e) => {
      actionObj.face = e.target.value;
      onUpdate();
    });
    detailsContainer.appendChild(styleRow);
  }

  typeRow.querySelector('.action-type-select')?.addEventListener('change', (e) => {
    actionObj.actionType = e.target.value;
    renderDetails();
    onUpdate();
  });

  renderDetails();
  return wrap;
}

function renderCpuFlowBlocks() {
  if (!cpuFlowContainer) return;
  cpuFlowContainer.innerHTML = '';

  if (EDITING_CPU_BLOCKS.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.style.padding = '24px 16px';
    emptyNotice.style.textAlign = 'center';
    emptyNotice.style.color = '#94a3b8';
    emptyNotice.style.fontSize = '12px';
    emptyNotice.style.border = '1px dashed #334155';
    emptyNotice.style.borderRadius = '8px';
    emptyNotice.textContent = '実行フローブロックがありません。下のボタンから行動または条件分岐を追加してください。';
    cpuFlowContainer.appendChild(emptyNotice);
    return;
  }

  EDITING_CPU_BLOCKS.forEach((block, index) => {
    if (index > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'cpu-flow-arrow';
      arrow.textContent = '⬇ 続けて実行';
      cpuFlowContainer.appendChild(arrow);
    }

    const blockCard = document.createElement('div');
    blockCard.className = `cpu-flow-block ${block.type === 'condition_if' ? 'type-if' : 'type-action'}`;

    // Header
    const header = document.createElement('div');
    header.className = 'cpu-flow-block-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'cpu-flow-block-title';
    if (block.type === 'condition_if') {
      titleWrap.innerHTML = `
        <span class="cpu-flow-badge if">IF 分岐</span>
        <span>ステップ #${index + 1}: 条件判定と分岐</span>
      `;
    } else {
      titleWrap.innerHTML = `
        <span class="cpu-flow-badge action">ACTION 行動</span>
        <span>ステップ #${index + 1}: 行動の実行</span>
      `;
    }
    header.appendChild(titleWrap);

    const tools = document.createElement('div');
    tools.className = 'cpu-flow-block-tools';

    if (index > 0) {
      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.className = 'cpu-flow-tool-btn';
      btnUp.textContent = '⬆';
      btnUp.title = '上へ移動';
      btnUp.addEventListener('click', () => {
        const tmp = EDITING_CPU_BLOCKS[index - 1];
        EDITING_CPU_BLOCKS[index - 1] = EDITING_CPU_BLOCKS[index];
        EDITING_CPU_BLOCKS[index] = tmp;
        renderCpuFlowBlocks();
      });
      tools.appendChild(btnUp);
    }

    if (index < EDITING_CPU_BLOCKS.length - 1) {
      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'cpu-flow-tool-btn';
      btnDown.textContent = '⬇';
      btnDown.title = '下へ移動';
      btnDown.addEventListener('click', () => {
        const tmp = EDITING_CPU_BLOCKS[index + 1];
        EDITING_CPU_BLOCKS[index + 1] = EDITING_CPU_BLOCKS[index];
        EDITING_CPU_BLOCKS[index] = tmp;
        renderCpuFlowBlocks();
      });
      tools.appendChild(btnDown);
    }

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'cpu-flow-tool-btn del';
    btnDel.textContent = '✕';
    btnDel.title = 'このブロックを削除';
    btnDel.addEventListener('click', () => {
      EDITING_CPU_BLOCKS.splice(index, 1);
      renderCpuFlowBlocks();
    });
    tools.appendChild(btnDel);

    header.appendChild(tools);
    blockCard.appendChild(header);

    // Body
    if (block.type === 'action') {
      const actionBody = createActionFieldsDOM(block, () => {});
      blockCard.appendChild(actionBody);
    } else if (block.type === 'condition_if') {
      // IF Condition Config
      const condSection = document.createElement('div');
      condSection.style.display = 'flex';
      condSection.style.flexDirection = 'column';
      condSection.style.gap = '8px';
      condSection.style.padding = '8px 10px';
      condSection.style.background = 'rgba(0,0,0,0.25)';
      condSection.style.borderRadius = '6px';

      // 判定タイプ & エリア
      const condRow1 = document.createElement('div');
      condRow1.style.display = 'flex';
      condRow1.style.gap = '8px';
      condRow1.style.alignItems = 'center';
      condRow1.style.flexWrap = 'wrap';
      condRow1.innerHTML = `
        <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">判定条件:</label>
        <select class="form-select if-cond-type" style="flex:1; min-width:140px; font-size:12px;">
          <option value="has_card"${block.condType === 'has_card' ? ' selected' : ''}>指定カードの有無を判定</option>
          <option value="card_count"${block.condType === 'card_count' ? ' selected' : ''}>エリアのカード総枚数を判定</option>
        </select>
        <select class="form-select if-check-area" style="flex:1; min-width:140px; font-size:12px;"></select>
      `;
      const areaSelect = condRow1.querySelector('.if-check-area');
      fillSelect(areaSelect, buildAreaRefOptions('にある', null), block.checkArea || 'own:hand');
      areaSelect.addEventListener('change', (e) => {
        block.checkArea = e.target.value;
      });

      condSection.appendChild(condRow1);

      // タグ条件 (has_card の時のみ)
      const tagSection = document.createElement('div');
      tagSection.style.display = block.condType === 'has_card' ? 'flex' : 'none';
      tagSection.style.flexDirection = 'column';
      tagSection.style.gap = '6px';
      tagSection.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">カード属性:</label>
          <select class="form-select if-filter-mode" style="flex:1; font-size:12px;">
            <option value="none"${block.filterMode === 'none' ? ' selected' : ''}>何でもよい（カードが1枚でも存在すればOK）</option>
            <option value="tag_condition"${block.filterMode === 'tag_condition' ? ' selected' : ''}>特定タグ条件に一致するカード</option>
          </select>
        </div>
      `;
      const filterSelect = tagSection.querySelector('.if-filter-mode');
      const tagEditorWrap = document.createElement('div');
      tagEditorWrap.style.display = block.filterMode === 'tag_condition' ? 'block' : 'none';
      if (!Array.isArray(block.tagConditions)) block.tagConditions = [];
      tagEditorWrap.appendChild(createTagConditionsEditor(block.tagConditions, () => {}));

      filterSelect.addEventListener('change', (e) => {
        block.filterMode = e.target.value;
        tagEditorWrap.style.display = block.filterMode === 'tag_condition' ? 'block' : 'none';
        if (block.filterMode === 'tag_condition' && block.tagConditions.length === 0) {
          const definedTags = getAllDefinedTags();
          const firstTag = definedTags.length > 0 ? definedTags[0].name : '';
          block.tagConditions.push({ logical: 'and', tagName: firstTag, op: '==', value: '' });
          tagEditorWrap.innerHTML = '';
          tagEditorWrap.appendChild(createTagConditionsEditor(block.tagConditions, () => {}));
        }
      });
      tagSection.appendChild(tagEditorWrap);
      condSection.appendChild(tagSection);

      // 枚数比較
      const countCompRow = document.createElement('div');
      countCompRow.style.display = 'flex';
      countCompRow.style.alignItems = 'center';
      countCompRow.style.gap = '8px';
      countCompRow.innerHTML = `
        <label class="form-label" style="margin:0; font-size:11px; min-width:65px;">成立枚数:</label>
        <span style="font-size:11px; color:#94a3b8;">対象カードが</span>
        <select class="form-select if-count-op" style="width:90px; font-size:12px;">
          <option value=">="${block.countOp === '>=' ? ' selected' : ''}>以上 (&gt;=)</option>
          <option value="=="${block.countOp === '==' ? ' selected' : ''}>同数 (==)</option>
          <option value="<="${block.countOp === '<=' ? ' selected' : ''}>以下 (&lt;=)</option>
          <option value=">"${block.countOp === '>' ? ' selected' : ''}>より多い (&gt;)</option>
          <option value="<"${block.countOp === '<' ? ' selected' : ''}>より少ない (&lt;)</option>
        </select>
        <input type="number" class="form-input if-count-val" min="0" max="99" value="${block.countVal ?? 1}" style="width:65px; font-size:12px;" />
        <span style="font-size:11px; color:#94a3b8;">枚なら YES</span>
      `;
      countCompRow.querySelector('.if-count-op')?.addEventListener('change', (e) => {
        block.countOp = e.target.value;
      });
      countCompRow.querySelector('.if-count-val')?.addEventListener('input', (e) => {
        block.countVal = Math.max(0, parseInt(e.target.value, 10) || 0);
      });
      condSection.appendChild(countCompRow);

      condRow1.querySelector('.if-cond-type')?.addEventListener('change', (e) => {
        block.condType = e.target.value;
        tagSection.style.display = block.condType === 'has_card' ? 'flex' : 'none';
      });

      blockCard.appendChild(condSection);

      // Branch Grid (YES / NO)
      const branchGrid = document.createElement('div');
      branchGrid.className = 'cpu-branch-grid';

      // YES Branch Box
      const yesBox = document.createElement('div');
      yesBox.className = 'cpu-branch-box branch-yes';
      yesBox.innerHTML = `
        <div class="cpu-branch-header yes">
          <span>🟢</span>
          <span>YESの場合（条件成立）:</span>
        </div>
      `;
      if (!block.thenAction) {
        block.thenAction = {
          actionType: 'action_move',
          srcArea: block.checkArea || 'own:hand',
          filterMode: 'none',
          tagConditions: [],
          count: 1,
          pickOrder: 'first',
          sortTag: '',
          destArea: AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center',
          placement: 'spread_lr',
          face: 'face_up'
        };
      }
      const yesFields = createActionFieldsDOM(block.thenAction, () => {});
      yesBox.appendChild(yesFields);
      branchGrid.appendChild(yesBox);

      // NO Branch Box
      const noBox = document.createElement('div');
      noBox.className = 'cpu-branch-box branch-no';
      noBox.innerHTML = `
        <div class="cpu-branch-header no">
          <span>🔴</span>
          <span>NOの場合（条件不成立）:</span>
        </div>
      `;
      if (!block.elseAction) {
        block.elseAction = { actionType: 'action_pass', count: 1 };
      }
      const noFields = createActionFieldsDOM(block.elseAction, () => {});
      noBox.appendChild(noFields);
      branchGrid.appendChild(noBox);

      blockCard.appendChild(branchGrid);
    }

    cpuFlowContainer.appendChild(blockCard);
  });
}

function saveCpuRule() {
  const editId = cpuRuleEditId?.value || null;
  const name = cpuRuleName?.value?.trim() || 'CPU思考ルーチン';
  const targetSeat = cpuRuleTargetSeat?.value || 'all';

  if (EDITING_CPU_BLOCKS.length === 0) {
    alert('少なくとも1つの行動または条件分岐ブロックを追加してください。');
    return;
  }

  const newRule = {
    id: editId || `cpu_rule_${Date.now()}`,
    name,
    targetSeat,
    blocks: JSON.parse(JSON.stringify(EDITING_CPU_BLOCKS)),
    // 後方互換性用プロパティ
    srcArea: EDITING_CPU_BLOCKS[0]?.srcArea || 'own:hand',
    destArea: EDITING_CPU_BLOCKS[0]?.destArea || 'area:area_play_center'
  };

  if (editId) {
    const index = CPU_RULES.findIndex(r => r.id === editId);
    if (index >= 0) {
      CPU_RULES[index] = newRule;
    } else {
      CPU_RULES.push(newRule);
    }
  } else {
    CPU_RULES.push(newRule);
  }

  renderCpuRulesList();
  if (modalCpuRule) modalCpuRule.style.display = 'none';
  scheduleSaveRoom();
  showToast(`CPU動作ルール「${name}」を保存しました`);
}

// ---- CPU自動ターン実行エンジン ----
function executeNextCpuTurn() {
  const cpuList = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const seatKey = `player${i}`;
    if (CPU_SEATS.has(seatKey)) {
      cpuList.push(seatKey);
    }
  }

  if (cpuList.length === 0) {
    showToast('CPU座席が設定されていません。「CPU座席設定」でCPUを指定してください');
    return;
  }

  LAST_ACTED_CPU_INDEX = (LAST_ACTED_CPU_INDEX + 1) % cpuList.length;
  const actingCpu = cpuList[LAST_ACTED_CPU_INDEX];
  executeCpuForPlayer(actingCpu);
}

function executeCpuForPlayer(cpuPlayerId) {
  const cpuLabel = getOwnerLabel(cpuPlayerId);

  // 該当CPUに適用されるルールを抽出
  const matchedRules = CPU_RULES.filter(r => r.targetSeat === 'all' || r.targetSeat === cpuPlayerId);

  if (matchedRules.length === 0) {
    showToast(`🤖 ${cpuLabel} 用の動作ルールが設定されていません。「CPU動作設定」から追加してください`);
    return;
  }

  // ルールを順番に評価し、実行可能な最初のアクションを行う
  for (const rule of matchedRules) {
    const didAct = executeSingleCpuRule(rule, cpuPlayerId);
    if (didAct) {
      return;
    }
  }

  showToast(`🤖 ${cpuLabel} は実行できるルールがなかったため待機しました`);
}

// 単一アクション実行ヘルパー
function executeCpuAction(act, cpuPlayerId) {
  const cpuLabel = getOwnerLabel(cpuPlayerId);
  const actType = act?.actionType || 'action_move';

  if (actType === 'action_pass') {
    return { success: true, didPass: true, summary: 'パス' };
  }

  if (actType === 'action_draw') {
    const deckArea = resolveAreaRef({ kind: 'own', areaType: 'deck' }, cpuPlayerId);
    const handArea = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
    if (!deckArea || !handArea) {
      return { success: false, didPass: false, summary: '山札または手札エリアが見つかりません' };
    }

    const deckCards = ENTITIES.filter(e => e.type === 'card' && isEntityOverlappingArea(e, deckArea))
      .sort((a, b) => (b.z || 0) - (a.z || 0));

    if (deckCards.length === 0) {
      return { success: false, didPass: false, summary: '山札が空のためドロー不可' };
    }

    const drawCount = Math.min(act.count || 1, deckCards.length);
    const drawn = deckCards.slice(0, drawCount);
    placeEntitiesInArea(drawn, handArea, 'spread_lr');

    drawn.forEach(c => {
      c.isFaceDown = false;
      const dom = document.getElementById(c.id);
      if (dom) updateEntityInnerDOM(dom, c);
    });

    return { success: true, didPass: false, summary: `山札から${drawCount}枚ドロー` };
  }

  if (actType === 'action_move') {
    const srcRef = valueToRef(act.srcArea || 'own:hand');
    const srcArea = resolveAreaRef(srcRef, cpuPlayerId);
    if (!srcArea) {
      return { success: false, didPass: false, summary: '移動元エリアが見つかりません' };
    }

    const cardsInSrc = ENTITIES.filter(e => e.type === 'card' && isEntityOverlappingArea(e, srcArea));
    let candidates = cardsInSrc;
    if (act.filterMode === 'tag_condition' && Array.isArray(act.tagConditions) && act.tagConditions.length > 0) {
      candidates = cardsInSrc.filter(c => matchesTagConditions(c, act.tagConditions));
    }

    if (candidates.length === 0) {
      return { success: false, didPass: false, summary: '条件に合うカードなし' };
    }

    // 優先順位ソート
    if (act.pickOrder === 'random') {
      candidates.sort(() => Math.random() - 0.5);
    } else if (act.pickOrder === 'max_tag' && act.sortTag) {
      candidates.sort((a, b) => {
        const valA = parseFloat(a.tagValues?.[act.sortTag] ?? 0);
        const valB = parseFloat(b.tagValues?.[act.sortTag] ?? 0);
        return (isNaN(valB) ? 0 : valB) - (isNaN(valA) ? 0 : valA);
      });
    } else if (act.pickOrder === 'min_tag' && act.sortTag) {
      candidates.sort((a, b) => {
        const valA = parseFloat(a.tagValues?.[act.sortTag] ?? 0);
        const valB = parseFloat(b.tagValues?.[act.sortTag] ?? 0);
        return (isNaN(valA) ? 0 : valA) - (isNaN(valB) ? 0 : valB);
      });
    }

    const count = Math.min(act.count || 1, candidates.length);
    const selected = candidates.slice(0, count);

    const destRef = valueToRef(act.destArea || (AREAS.length > 0 ? `area:${AREAS[0].id}` : 'area:area_play_center'));
    const destArea = resolveAreaRef(destRef, cpuPlayerId);
    if (!destArea) {
      return { success: false, didPass: false, summary: '移動先エリアが見つかりません' };
    }

    // 表裏の更新
    if (act.face === 'face_up') {
      selected.forEach(c => {
        c.isFaceDown = false;
        const dom = document.getElementById(c.id);
        if (dom) updateEntityInnerDOM(dom, c);
      });
    } else if (act.face === 'face_down') {
      selected.forEach(c => {
        c.isFaceDown = true;
        const dom = document.getElementById(c.id);
        if (dom) updateEntityInnerDOM(dom, c);
      });
    }

    // 配置
    placeEntitiesInArea(selected, destArea, act.placement || 'spread_lr');

    const cardNames = selected.map(c => {
      if (c.tagValues && (c.tagValues.Mark || c.tagValues.tag_mark) && (c.tagValues.Number || c.tagValues.tag_number)) {
        const m = c.tagValues.Mark || c.tagValues.tag_mark;
        const n = c.tagValues.Number || c.tagValues.tag_number;
        return `${m}${n}`;
      }
      return 'カード';
    }).join(', ');

    return {
      success: true,
      didPass: false,
      summary: `${srcArea.name || '手札'}から「${cardNames}」を${destArea.name || '場'}へ移動`
    };
  }

  return { success: false, didPass: false, summary: '不明な行動' };
}

// 単一IF条件判定ヘルパー
function evaluateCpuCondition(block, cpuPlayerId) {
  const checkRef = valueToRef(block.checkArea || 'own:hand');
  const checkArea = resolveAreaRef(checkRef, cpuPlayerId);
  if (!checkArea) return false;

  const cardsInArea = ENTITIES.filter(e => e.type === 'card' && isEntityOverlappingArea(e, checkArea));
  let matchedCount = cardsInArea.length;

  if (block.condType === 'has_card') {
    if (block.filterMode === 'tag_condition' && Array.isArray(block.tagConditions) && block.tagConditions.length > 0) {
      const filtered = cardsInArea.filter(c => matchesTagConditions(c, block.tagConditions));
      matchedCount = filtered.length;
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

function executeSingleCpuRule(rule, cpuPlayerId) {
  const cpuLabel = getOwnerLabel(cpuPlayerId);

  // ブロックが存在しない場合はレガシーマイグレーション
  const blocks = (Array.isArray(rule.blocks) && rule.blocks.length > 0)
    ? rule.blocks
    : migrateLegacyRuleToBlocks(rule);

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

// ============================================================================
// Right Sidebar Inspector (プレビュー & リアルタイム属性編集)
// ============================================================================
function setupInspectorEvents() {
  toggleInspector?.addEventListener('click', () => {
    if (!devInspector) return;
    devInspector.classList.toggle('is-collapsed');
    const isCollapsed = devInspector.classList.contains('is-collapsed');
    toggleInspector.textContent = isCollapsed ? '◀' : '▶';
    toggleInspector.title = isCollapsed ? 'パネルを展開' : 'パネルを折り畳む';
    setTimeout(handleResize, 220);
    handleResize();
  });

  inspectorCardTypeSelect?.addEventListener('change', () => {
    if (!SELECTED_ENTITY_ID) return;
    const entity = ENTITIES.find(e => e.id === SELECTED_ENTITY_ID);
    if (!entity || entity.type !== 'card') return;

    entity.cardTypeId = inspectorCardTypeSelect.value || '';
    renderInspectorTags(entity.cardTypeId, entity);

    const dom = document.getElementById(entity.id);
    if (dom) updateEntityInnerDOM(dom, entity);
    flashInspectorSaveNotice();
    scheduleSaveRoom();
  });
}

function updateInspector(entityId) {
  if (!devInspector) return;

  if (!entityId) {
    if (inspectorEmpty) inspectorEmpty.style.display = 'flex';
    if (inspectorContent) inspectorContent.style.display = 'none';
    return;
  }

  const entity = ENTITIES.find(e => e.id === entityId);
  if (!entity) {
    if (inspectorEmpty) inspectorEmpty.style.display = 'flex';
    if (inspectorContent) inspectorContent.style.display = 'none';
    return;
  }

  if (inspectorEmpty) inspectorEmpty.style.display = 'none';
  if (inspectorContent) inspectorContent.style.display = 'flex';

  // 1. プレビュー画像とステータス
  const displayUrl = (entity.type === 'card' && entity.isFaceDown)
    ? (entity.backUrl || 'PlayExample.webp')
    : (entity.frontUrl || entity.url || 'PlayExample.webp');

  if (inspectorPreviewImg) {
    inspectorPreviewImg.src = displayUrl;
    inspectorPreviewImg.style.transform = `rotate(${entity.angle || 0}deg)`;
  }

  if (inspectorBadge) {
    inspectorBadge.textContent = entity.type === 'card' ? '🃏 カード'
      : entity.type === 'board' ? '🗺️ ボード'
      : '♟ コマ';
  }

  if (inspectorStatus) {
    const faceText = entity.type === 'card' ? (entity.isFaceDown ? '裏向き' : '表向き') : '';
    const angleText = `${entity.angle || 0}°`;
    inspectorStatus.textContent = faceText ? `${faceText} (${angleText})` : angleText;
  }

  // 2. カード属性（タグ）の表示・編集
  const cardPropsSec = document.getElementById('inspector-card-props');
  if (entity.type === 'card') {
    if (cardPropsSec) cardPropsSec.style.display = '';

    // カードタイプ一覧を同期
    if (inspectorCardTypeSelect) {
      inspectorCardTypeSelect.innerHTML = '<option value="">(なし / 一般画像)</option>';
      Object.entries(CARD_SCHEMAS).forEach(([typeId, schema]) => {
        const opt = document.createElement('option');
        opt.value = typeId;
        opt.textContent = schema.name;
        if (entity.cardTypeId === typeId) opt.selected = true;
        inspectorCardTypeSelect.appendChild(opt);
      });
    }

    renderInspectorTags(entity.cardTypeId, entity);
  } else {
    if (cardPropsSec) cardPropsSec.style.display = 'none';
  }
}

function renderInspectorTags(cardTypeId, entity) {
  if (!inspectorTagsContainer) return;
  inspectorTagsContainer.innerHTML = '';

  if (!cardTypeId || !CARD_SCHEMAS[cardTypeId]) {
    inspectorTagsContainer.innerHTML = '<div style="font-size:12px; color:#64748b; padding:6px 0;">カードタイプを選択すると属性（タグ）の入力欄が表示されます。</div>';
    return;
  }

  const schema = CARD_SCHEMAS[cardTypeId];
  if (!schema.tags || schema.tags.length === 0) {
    inspectorTagsContainer.innerHTML = '<div style="font-size:12px; color:#64748b; padding:6px 0;">このタイプにはタグが定義されていません。「カード全般設定」からタグを追加できます。</div>';
    return;
  }

  schema.tags.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'prop-tag-row';
    const currentVal = (entity.tagValues && entity.tagValues[tag.id] !== undefined) ? entity.tagValues[tag.id] : '';

    row.innerHTML = `
      <span class="prop-tag-name">${escapeHtml(tag.name)}</span>
      <input type="text" class="prop-tag-input" data-tag-id="${escapeHtml(tag.id)}" value="${escapeHtml(currentVal)}" placeholder="値を入力" />
    `;

    const input = row.querySelector('.prop-tag-input');
    input?.addEventListener('input', () => {
      if (!entity.tagValues) entity.tagValues = {};
      entity.tagValues[tag.id] = input.value.trim();

      const dom = document.getElementById(entity.id);
      if (dom) updateEntityInnerDOM(dom, entity);
      flashInspectorSaveNotice();
      scheduleSaveRoom();
    });

    inspectorTagsContainer.appendChild(row);
  });
}

let saveNoticeTimer = null;
function flashInspectorSaveNotice() {
  if (!inspectorSaveNotice) return;
  inspectorSaveNotice.style.opacity = '1';
  clearTimeout(saveNoticeTimer);
  saveNoticeTimer = setTimeout(() => {
    inspectorSaveNotice.style.opacity = '0.4';
  }, 1200);
}

// Start
init();
