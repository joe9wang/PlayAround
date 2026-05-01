// ====================================================================
// state.js — ゲーム共有状態
// アプリ全体で参照されるランタイム状態をここに集約。
// 各モジュールは import { state } from './state.js' で参照し、
// state.CURRENT_ROOM = 'xxx' のように読み書きする。
// ====================================================================

/**
 * ゲーム共有状態オブジェクト。
 * 各モジュールが同じオブジェクト参照を使うため、値の変更は即座に反映される。
 */
export const state = {
    // --- セッション ---
    CURRENT_ROOM: null,          // 参加中のルームID
    CURRENT_ROOM_META: null,     // ルームdocの内容 (hostUid, hostSeat, fieldMode, …)
    CURRENT_PLAYER: null,        // 自分の座席番号 (1..4)
    CURRENT_UID: null,           // Firebase Auth UID

    IS_ROOM_CREATOR: false,      // 自分がこのルームを作成したか
    ACTIVE_MODE: 'join',         // 'join' | 'create'

    // --- 購読ハンドル ---
    unsubscribeRoomDoc: null,
    unsubscribeSeats: null,
    unsubscribeCards: null,
    unsubscribeChat: null,

    // --- タイマーハンドル ---
    hostWatchTimer: null,
    heartbeatTimer: null,
    hostHeartbeatTimer: null,
    flushTimer: null,

    // --- 書き込み最適化 ---
    pendingPatches: new Map(),   // path → merged patch

    // --- アクティビティ検知 ---
    lastActivityAt: Date.now(),
    lastSeatHBWriteAt: 0,
    __roomPingAt: 0,

    // --- Auth ---
    AUTH_ID_TOKEN: null,
    __initialAuthResolved: false,

    // --- 座席 ---
    currentSeatMap: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, 10: null },
    CREATE_SELECTED_SEAT: 1,
    CREATE_FIELD_MODE: 'card',
};

// --- 定数（不変） ---
export const CARD_W = 120;
export const CARD_H = 160;

export const HOST_STALE_MS = 180000;   // 3min
export const SEAT_STALE_MS = 600000;   // 10min
export const HOST_HEARTBEAT_MS = 60000; // 60s
export const SEAT_HEARTBEAT_MS = 60000; // 60s
export const ROOM_PING_MS = 60000;  // 60s

export const WRITE_FLUSH_MS = 400;
export const MAX_BATCH_OPS = 450;

export const ROOM_EMPTY_GRACE_MS = 15 * 60 * 1000; // 15分

export const ACTIVE_WINDOW_MS = 30_000;
export const IDLE_KEEPALIVE_MS = 300_000;

// --- Layer ranges (z-index) ---
export const Z_BACK_BASE = 0;
export const Z_CENTER_BASE = 10000;
export const Z_FRONT_BASE = 20000;
