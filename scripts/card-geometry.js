// card-geometry.js
// “フィールド上の幾何計算”を担当（DOM/状態から座標/矩形を導出）

// Note: これらは game.module.js の状態とDOMに依存するので、
// 依存を注入（DI）する初期化関数を用意します。
let _getState = null; // () => { field, zoom, CARD_W, CARD_H, CURRENT_ROOM_META }
export function initCardGeometry(getState){
  _getState = getState;
}

// 内部ヘルパ
function S(){ if(!_getState) throw new Error('initCardGeometry not called'); return _getState(); }
function rectFromEl(el){
  if(!el) return null;
  const { field, zoom } = S();
  const fieldRect = field.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const minX = (r.left - fieldRect.left) / zoom;
  const minY = (r.top  - fieldRect.top ) / zoom;
  const width  = r.width  / zoom;
  const height = r.height / zoom;
  return { minX, minY, width, height };
}

// カード中心が矩形内か
export function isCenterInsideRect(x, y, rect){
  const { CARD_W, CARD_H } = S();
  const cx = x + CARD_W / 2;
  const cy = y + CARD_H / 2;
  return cx >= rect.minX && cx <= rect.minX + rect.width && cy >= rect.minY && cy <= rect.minY + rect.height;
}

// ボード/トランプ共有モード判定
export function isBoardMode(){
  const { CURRENT_ROOM_META } = S();
  const m = CURRENT_ROOM_META?.fieldMode;
  return (m === 'board' || m === 'trump');
}

// 各エリアのDOM→矩形
export function getHandBoundsForSeat(seat){
  const { document } = window;
  if (isBoardMode()) {
    const el = document.getElementById(`board-hand-${seat}`);
    return rectFromEl(el);
  } else {
    const hand = document.querySelector(`.player-${seat} .hand-area`);
    return rectFromEl(hand);
  }
}
export function getDeckBoundsForSeat(seat){
  const { document } = window;
  const { CURRENT_ROOM_META } = S();
  const mode = CURRENT_ROOM_META?.fieldMode;
  if (mode === 'board' || mode === 'trump') {
    const el = document.querySelector('#board-center .center-deck');
    return rectFromEl(el);
  }
  const deck = document.querySelector(`.player-${seat} .deck-area`);
  return rectFromEl(deck);
}
export function getDiscardBoundsForSeat(seat){
  const { document } = window;
  const { CURRENT_ROOM_META } = S();
  const mode = CURRENT_ROOM_META?.fieldMode;
  if (mode === 'board' || mode === 'trump') {
    const el = document.querySelector('#board-center .center-discard');
    return rectFromEl(el);
  }
  const el = document.querySelector(`.player-${seat} .discard-area`);
  return rectFromEl(el);
}
export function getMainPlayBoundsForSeat(seat){
  const { document } = window;
  if (isBoardMode()) {
    const el = document.getElementById('board-play');
    return rectFromEl(el);
  } else {
    const main = document.querySelector(`.player-${seat} .main-play-area`);
    return rectFromEl(main);
  }
}

// 共有デッキ中央 / 座席プレイエリア中央
export function centerOfDeck(seat, w=0, h=0){
  const b = getDeckBoundsForSeat(seat);
  if (!b) return { x: 0, y: 0 };
  const x = Math.round(b.minX + (b.width  - w) / 2);
  const y = Math.round(b.minY + (b.height - h) / 2);
  return { x, y };
}
export function centerOfMainPlay(seat, w, h){
  const b = getMainPlayBoundsForSeat(seat);
  if(!b) return { x: 0, y: 0 };
  const x = Math.round(b.minX + (b.width  - w)/2);
  const y = Math.round(b.minY + (b.height - h)/2);
  return { x, y };
}

// ランダム生成位置（左上）
export function randomPointInDeck(seat){
  const { CARD_W, CARD_H } = S();
  const b = getDeckBoundsForSeat(seat);
  if(!b) return { x: Math.random()*500|0, y: Math.random()*500|0 };
  const maxX = Math.max(b.minX, b.minX + b.width  - CARD_W);
  const maxY = Math.max(b.minY, b.minY + b.height - CARD_H);
  const x = b.minX + Math.random() * (maxX - b.minX);
  const y = b.minY + Math.random() * (maxY - b.minY);
  return { x: Math.round(x), y: Math.round(y) };
}
export function randomPointInMainPlay(seat){
  const { CARD_W, CARD_H } = S();
  const b = getMainPlayBoundsForSeat(seat);
  if(!b) return { x: Math.random()*500|0, y: Math.random()*500|0 };
  const maxX = Math.max(b.minX, b.minX + b.width  - CARD_W);
  const maxY = Math.max(b.minY, b.minY + b.height - CARD_H);
  const x = b.minX + Math.random() * (maxX - b.minX);
  const y = b.minY + Math.random() * (maxY - b.minY);
  return { x: Math.round(x), y: Math.round(y) };
}
