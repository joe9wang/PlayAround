// public/js/hp.js
// プレイヤーHP機能（UI描画・本人マスター書き込み・購読/解除）を分離
// 依存は initHP() で注入する（Firebase関数や状態取得クロージャ）

let ctx;

// 共有状態（UI差分反映と巻き戻り防止に必要）
export const hpValues      = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0};
export const localHpEditAt = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0};
let unsubscribeHP = null;

export const hpDocPath = (roomId, seat) => `rooms/${roomId}/hp/p${seat}`;

// ===== DEBUG ログ =====
// 必要に応じて false にすれば出力停止
const HP_DEBUG = true;
const hpDbg = (...args) => { if (HP_DEBUG) console.log('[HP]', ...args); };


export function initHP(context){
  // context: { db, doc, setDoc, onSnapshot, serverTimestamp, ensureAuthReady, getState, t, alert, document }
  ctx = context;
  
  hpDbg('initHP done');
  
  
}

export function detachHPListener(){
  if (unsubscribeHP) { try{unsubscribeHP();}catch(_){/*noop*/} unsubscribeHP = null; }
}


export function subscribeHP(roomId){
  detachHPListener();
  const { db, doc, onSnapshot } = ctx;
  const refs = [1,2,3,4,5,6,7,8,9,10].map(seat => doc(db, hpDocPath(roomId, seat)));
  const unsubs = refs.map((ref, idx) => onSnapshot(ref, snap => {
    const seat = idx + 1;
    // ドキュメントが無い時に即0へ“戻す”のをやめる。
    // その席が未占有（誰も座っていない）場合のみ 0 にリセットする。
    if (!snap.exists()) {
      const { currentSeatMap } = ctx.getState();
      const owner = currentSeatMap[seat]?.claimedByUid || null;
      if (!owner) {                     // 無人席のときだけ 0 に揃える
        if (hpValues[seat] !== 0) { hpValues[seat] = 0; renderHPPanel(); }
      }
      
      hpDbg('snapshot: no doc', { seat, ownerExists: !!owner });
      
      return;
    }
    const d = snap.data() || {};
    const remoteAt = d.updatedAt?.toMillis?.() || 0;
    const localAt  = localHpEditAt[seat] || 0;
    const now      = Date.now();
    // 巻き戻り防止：
    //  1) 自分のローカル編集より古いスナップショットは無視
    //  2) updatedAt 未反映（=0）の通知は、ローカル編集から一定時間は無視
    if (localAt > remoteAt) { hpDbg('snapshot ignored: local newer', { seat, localAt, remoteAt }); return; }
    if (!remoteAt && (now - localAt) < 3000) { hpDbg('snapshot ignored: remote ts pending', { seat, localAt, remoteAt }); return; }

    const v = Number.isFinite(d.value) ? Math.trunc(d.value) : 0;
    if (hpValues[seat] !== v) { hpValues[seat] = v; renderHPPanel(); }
  }, (err) => {
    console.warn('hp subscribe error', err?.code||err);
  }));
  unsubscribeHP = () => unsubs.forEach(fn => fn());
}

export function renderHPPanel(){
  const { document, ensureAuthReady, db, doc, setDoc, serverTimestamp, alert, getState } = ctx;
  const state = getState();
  const playerCount = state.CURRENT_ROOM_META?.playerCount || 4;

  const grid = document.getElementById('hp-grid');
  if (!grid) return;

  // 行数が現在の人数と合わない場合に再生成
  const existingRows = grid.querySelectorAll('.hp-row');
  if (existingRows.length !== playerCount) {
    hpDbg('renderHPPanel: rebuild UI', { playerCount, existing: existingRows.length });  
    const frag = document.createDocumentFragment();
    for (let seat = 1; seat <= playerCount; seat++) {
      const wrap = document.createElement('div');
      wrap.className = 'hp-row';
      wrap.dataset.seat = String(seat);
      wrap.innerHTML = `
        <div class="hp-seat">SEAT ${seat}</div>
        <div class="hp-name"></div>
        <div class="hp-ctrls">
          <button class="hp-minus" type="button">-</button>
          <input class="hp-input" type="number" inputmode="numeric" />
          <button class="hp-plus"  type="button">+</button>
        </div>`;
      frag.appendChild(wrap);
    }
    grid.innerHTML = '';
    grid.appendChild(frag);

    // イベントバインド
    grid.querySelectorAll('.hp-row').forEach(row => {
      const seat  = parseInt(row.dataset.seat, 10);
      const input = row.querySelector('.hp-input');
      const minus = row.querySelector('.hp-minus');
      const plus  = row.querySelector('.hp-plus');
      const commit = async (nextVal) => {
        const { CURRENT_PLAYER, CURRENT_ROOM, CURRENT_UID, currentSeatMap } = ctx.getState();
        if (CURRENT_PLAYER !== seat) return;
        const n = Number.isFinite(nextVal) ? Math.trunc(nextVal) : 0;
        await ensureAuthReady();
        const myUid = CURRENT_UID;
        const owner = currentSeatMap[seat]?.claimedByUid || null;
        if (!myUid || myUid !== owner) {
          renderHPPanel();
          alert?.('このHPはあなたの席ではないため変更できません。');
          return;
        }
        if (input) input.value = n;
        localHpEditAt[seat] = Date.now();
        hpValues[seat] = n;
        try {
          const path = hpDocPath(CURRENT_ROOM, seat);
          await setDoc(doc(db, path), {
            seat: seat,
            value: n,
            updatedAt: serverTimestamp(),
            updatedBy: myUid
          }, { merge: true });
        } catch (e) {
          renderHPPanel();
        }
      };
      
      input?.addEventListener('change', () => commit(parseInt(input.value, 10)));
      minus?.addEventListener('click', () => commit(parseInt(input?.value, 10) - 1));
      plus ?.addEventListener('click', () => commit(parseInt(input?.value, 10) + 1));      
    });
  }

  // 差分更新：名前/活性/値のみ更新（入力中は値を上書きしない）
  const { CURRENT_PLAYER, currentSeatMap } = ctx.getState();
  for (let seat = 1; seat <= playerCount; seat++) {
    const row   = grid.querySelector(`.hp-row[data-seat="${seat}"]`);
    const input = row?.querySelector('.hp-input');
    const name  = row?.querySelector('.hp-name');
    const isMe  = (CURRENT_PLAYER === seat);
    const dispName = (currentSeatMap[seat]?.displayName) || '';
    if (name) name.textContent = dispName;
    if (input) {
      input.disabled = !isMe;
      if (!(isMe && document.activeElement === input)) {
        const v = Number.isFinite(hpValues[seat]) ? hpValues[seat] : 0;
        if (String(input.value) !== String(v)) input.value = v;
      }
    }
    row?.querySelector('.hp-minus')?.toggleAttribute('disabled', !isMe);
    row?.querySelector('.hp-plus') ?.toggleAttribute('disabled', !isMe);
    hpDbg('renderHPPanel row update', { seat, isMe, value: hpValues[seat] });
  }
}
