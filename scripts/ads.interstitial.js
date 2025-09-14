// /public/js/ads.interstitial.js
// PropellerAds Interstitial (Vignette) Loader
// - ルーム作成/入室の直前で呼ぶ
// - 頻度制限あり（デフォ：1時間に1回）
// - ?noads=1 で強制的に無効化（開発時など）
// - 失敗時は最大待機 ms 経過で自動的に解放

const PROPELLER_ZONE_ID = '9874020';                   // ←あなたの zone
const PROPELLER_SRC    = 'https://groleegni.net/vignette.min.js';
const LS_KEY_LAST_SHOWN = 'pa_interstitial_last_shown';
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;            // 1時間
const DEFAULT_MAX_WAIT_MS = 10 * 1000;                 // 広告待ち最大 10s
const MIN_BLOCK_MS = 5 * 1000;                         // 最低でも 5s ブロック

function shouldBypass() {
  // 開発時は ?noads=1 でスキップ
  const params = new URLSearchParams(location.search);
  if (params.get('noads') === '1') return true;

  // ユーザーが広告トラブルなら ?ads=force で強制
  if (params.get('ads') === 'force') return false;

  return false;
}

function passedCooldown(cooldownMs) {
  const last = Number(localStorage.getItem(LS_KEY_LAST_SHOWN) || 0);
  return (Date.now() - last) >= cooldownMs;
}

function markShown() {
  localStorage.setItem(LS_KEY_LAST_SHOWN, String(Date.now()));
}

function loadPropellerOnce(zoneId) {
  return new Promise((resolve) => {
    // 同じ script を二重挿入しない
    if (document.querySelector(`script[data-zone="${zoneId}"][data-propeller="1"]`)) {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.dataset.zone = zoneId;
    s.dataset.propeller = '1';
    s.src = PROPELLER_SRC;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    // body がなければ html に入れる
    (document.body || document.documentElement).appendChild(s);
  });
}

function blockOverlay(ms) {
  // 広告のクローズイベントが取れないため、最短ブロック時間を自前で確保
  const overlay = document.createElement('div');
  overlay.id = 'pa-ad-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; 
    background: rgba(0,0,0,.5);
    z-index: 999999999; 
    display: flex; align-items: center; justify-content: center;
    pointer-events: all;
  `;
  overlay.innerHTML = `
    <div style="background:#111;color:#fff;padding:20px 28px;border-radius:14px;font-size:16px;text-align:center;max-width:90%;box-shadow:0 8px 24px rgba(0,0,0,.35)">
      <div style="margin-bottom:8px;font-weight:700">Loading ad…</div>
      <div style="opacity:.8">ゲーム開始まで数秒お待ちください</div>
    </div>
  `;
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    setTimeout(() => {
      try { overlay.remove(); } catch(_) {}
      resolve();
    }, ms);
  });
}

/**
 * 入室/作成の直前で await する。
 * @param {Object} opts
 * @param {boolean} [opts.force=false]  // true ならクールダウン無視
 * @param {number}  [opts.cooldownMs=DEFAULT_COOLDOWN_MS]
 * @param {number}  [opts.maxWaitMs=DEFAULT_MAX_WAIT_MS]
 */
export async function showRoomInterstitial(opts = {}) {
  const force = !!opts.force;
  const cooldownMs = Number.isFinite(opts.cooldownMs) ? opts.cooldownMs : DEFAULT_COOLDOWN_MS;
  const maxWaitMs  = Number.isFinite(opts.maxWaitMs)  ? opts.maxWaitMs  : DEFAULT_MAX_WAIT_MS;

  if (shouldBypass()) return;                // 明示スキップ
  if (!force && !passedCooldown(cooldownMs)) return; // クールダウン中

  // クリック直後に呼ぶのが安全（ユーザー操作直後のほうがブロックされにくい）
  const waitMin = blockOverlay(MIN_BLOCK_MS);      // 最低 5s はブロック表示
  const load = loadPropellerOnce(PROPELLER_ZONE_ID);

  // 広告の「閉じた」を検出できないのでタイムアウトで開放
  // - 早く閉じても MIN_BLOCK_MS は待つ
  // - 遅い/失敗でも maxWaitMs で続行
  await Promise.race([
    (async () => { await load; await waitMin; })(),
    new Promise(res => setTimeout(res, maxWaitMs)) // フォールバック
  ]);

  markShown(); // 表示トライ扱い（収益はネットワーク側起算）
}
