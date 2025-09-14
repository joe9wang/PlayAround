// public/js/hp.js
// プレイヤーHP機能（UI描画・本人マスター書き込み・購読/解除）を分離
// 依存は initHP() で注入する（Firebase関数や状態取得クロージャ）

let ctx;

// 共有状態（UI差分反映と巻き戻り防止に必要）
export const hpValues      = {1:0,2:0,3:0,4:0};
export const localHpEditAt = {1:0,2:0,3:0,4:0};
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
  const refs = [1,2,3,4].map(seat => doc(db, hpDocPath(roomId, seat)));
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
  const { document, ensureAuthReady, db, doc, setDoc, serverTimestamp, alert } = ctx;
  // ここでは CURRENT_* をキャプチャしない（都度 getState で取得する）
  const grid = document.getElementById('hp-grid');
  if (!grid) return;

  // 初回：行が無ければ生成（4席ぶん）
  if (!grid.querySelector('.hp-row')) {
    hpDbg('renderHPPanel: initial UI build');  
    const frag = document.createDocumentFragment();
    for (const seat of [1,2,3,4]) {
      const wrap = document.createElement('div');
      wrap.className = 'hp-row';
      wrap.dataset.seat = String(seat);
      wrap.innerHTML = `
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

    // イベントは一度だけバインド（※座席判定は都度 getState() で最新を見る）
    grid.querySelectorAll('.hp-row').forEach(row => {
      const seat  = parseInt(row.dataset.seat, 10);
      const input = row.querySelector('.hp-input');
      const minus = row.querySelector('.hp-minus');
      const plus  = row.querySelector('.hp-plus');
      const commit = async (nextVal) => {
        // ★ 毎回、最新状態を取得して判定（キャプチャしない）
        const { CURRENT_PLAYER, CURRENT_ROOM, CURRENT_UID, currentSeatMap } = ctx.getState();
        hpDbg('commit called', { seat, nextVal, CURRENT_PLAYER, CURRENT_ROOM, CURRENT_UID });
        if (CURRENT_PLAYER !== seat) { hpDbg('commit blocked: not my seat'); return; }
        const n = Number.isFinite(nextVal) ? Math.trunc(nextVal) : 0;
        if (seat !== CURRENT_PLAYER) return; // 念のための二重ガード
        await ensureAuthReady();
        const myUid = CURRENT_UID;
        const owner = currentSeatMap[seat]?.claimedByUid || null;
        if (!myUid || myUid !== owner) {
          hpDbg('commit blocked: not the seat owner', { myUid, owner });
          renderHPPanel();
          alert?.('このHPはあなたの席ではないため変更できません。');
          return;
        }
        if (input) input.value = n;
        // 本人マスター：hp コレクションへ書く（楽観更新 + 失敗時は巻き戻し）
        localHpEditAt[seat] = Date.now();
        hpValues[seat] = n;
        try {
          const path = hpDocPath(CURRENT_ROOM, seat);
          const payload = {
            seat: seat,                // 将来のルール突き合わせ用に明示
            value: n,
            updatedAt: serverTimestamp(),
            updatedBy: myUid
          };
          hpDbg('setDoc start', { path, payload });
          await setDoc(doc(db, path), payload, { merge: true });
          hpDbg('setDoc ok', { path, value: n });
        } catch (e) {
          console.warn('hp write failed', e?.code || e);
          hpDbg('setDoc failed', { code: e?.code, message: e?.message });
          // 失敗したらリモート最新で描き直し（0に戻って見える問題の見える化）
          renderHPPanel();
        }
      };
      
      input?.addEventListener('change', () => {
        const v = parseInt(input.value, 10);
        hpDbg('UI event: input change', { seat, v });
        commit(v);
      });
      minus?.addEventListener('click', () => {
        const v = parseInt(input?.value, 10) - 1;
        hpDbg('UI event: minus click', { seat, v });
        commit(v);
      });
      plus ?.addEventListener('click', () => {
        const v = parseInt(input?.value, 10) + 1;
        hpDbg('UI event: plus click', { seat, v });
        commit(v);
      });      
      
    });
  }

  // 差分更新：名前/活性/値のみ更新（入力中は値を上書きしない）
  for (const seat of [1,2,3,4]) {
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
