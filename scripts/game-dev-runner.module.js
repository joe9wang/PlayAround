// ============================================================================
// game-dev-runner.module.js
// BatriTable 開発モード・ルール実行エンジン (game.html 統合用)
// ============================================================================

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch
} from './firebase.init.js';
import { queryAiCardSelection } from './game-dev-ai.js?v=20261023-2';

let CURRENT_ROOM_ID = null;
let ROOM_DATA = null;
let DEV_AREAS = [];
let PLAY_BUTTONS = [];
let CPU_RULES = [];
let CPU_SEATS = new Set();
let CURRENT_ACTING_PLAYER = 'player1';
let isRunningAction = false;

/**
 * 開発モードランナー初期化エントリーポイント
 * game.module.js から動的インポートで呼び出される
 */
export async function initGameDevRunner({ roomId, meta }) {
  console.log('[DevRunner] Initializing Game Dev Runner for room:', roomId);
  CURRENT_ROOM_ID = roomId;

  // 1. スタイルの動的注入
  injectDevRunnerStyles();

  // 2. ルームメタデータの取得
  if (meta && meta.isDevInstance) {
    ROOM_DATA = meta;
  } else {
    try {
      const snap = await getDoc(doc(db, `rooms/${roomId}`));
      if (snap.exists()) {
        ROOM_DATA = snap.data();
      }
    } catch (e) {
      console.warn('[DevRunner] Failed to fetch room data:', e);
    }
  }

  if (!ROOM_DATA) {
    console.warn('[DevRunner] No dev room data found.');
    return;
  }

  DEV_AREAS = Array.isArray(ROOM_DATA.devAreas) ? ROOM_DATA.devAreas : [];
  PLAY_BUTTONS = Array.isArray(ROOM_DATA.playButtons) ? ROOM_DATA.playButtons : [];
  CPU_RULES = Array.isArray(ROOM_DATA.cpuRules) ? ROOM_DATA.cpuRules : [];
  CPU_SEATS = new Set(Array.isArray(ROOM_DATA.cpuSeats) ? ROOM_DATA.cpuSeats : []);

  // 3. 盤面エリア（マット）のレンダリング
  renderDevAreasOnField();

  // 4. アクション実行パネル & CPUパネルのマウント
  mountDevActionPanel();

  showToast('⚡ 自作ゲーム開発モードが起動しました');
}

/**
 * 盤面フィールド（#field）の上に開発エリアを描画
 */
function renderDevAreasOnField() {
  const fieldEl = document.getElementById('field');
  if (!fieldEl) {
    setTimeout(renderDevAreasOnField, 500);
    return;
  }

  let overlayEl = document.getElementById('dev-areas-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'dev-areas-overlay';
    fieldEl.prepend(overlayEl);
  }

  overlayEl.innerHTML = '';
  if (DEV_AREAS.length === 0) return;

  DEV_AREAS.forEach(area => {
    const areaEl = document.createElement('div');
    areaEl.className = `dev-play-area type-${area.type || 'play'}`;
    areaEl.dataset.areaId = area.id;
    areaEl.style.left = `${area.x || 0}px`;
    areaEl.style.top = `${area.y || 0}px`;
    areaEl.style.width = `${area.w || 200}px`;
    areaEl.style.height = `${area.h || 150}px`;

    const label = document.createElement('div');
    label.className = 'dev-play-area-label';
    const ownerTag = area.owner ? `[${getOwnerLabel(area.owner)}] ` : '';
    label.textContent = `${ownerTag}${area.name || getAreaTypeName(area.type)}`;
    areaEl.appendChild(label);

    overlayEl.appendChild(areaEl);
  });
}

/**
 * アクション操作パネル（左フローティングまたはサイドバー）のマウント
 */
function mountDevActionPanel() {
  let panel = document.getElementById('dev-runner-panel');
  if (panel) panel.remove();

  panel = document.createElement('div');
  panel.id = 'dev-runner-panel';
  panel.className = 'dev-runner-panel';

  panel.innerHTML = `
    <div class="dev-runner-header">
      <div class="dev-runner-title">
        <span class="icon">⚡</span>
        <span>ゲームアクション</span>
      </div>
      <button type="button" id="dev-runner-toggle" class="dev-runner-toggle" title="パネルを開閉">◀</button>
    </div>
    
    <div class="dev-runner-body">
      <!-- 手番・操作プレイヤー選択 -->
      <div class="dev-runner-section">
        <label class="dev-section-label">現在の操作手番:</label>
        <select id="dev-acting-player-select" class="dev-select">
          <option value="player1">P1 (プレイヤー1)</option>
          <option value="player2">P2 (プレイヤー2)</option>
          <option value="player3">P3 (プレイヤー3)</option>
          <option value="player4">P4 (プレイヤー4)</option>
        </select>
      </div>

      <!-- 実行ボタン一覧 -->
      <div class="dev-runner-section">
        <div class="dev-section-subtitle">実行ボタン一覧</div>
        <div id="dev-buttons-list" class="dev-buttons-list"></div>
      </div>

      <!-- CPU自動化 -->
      <div class="dev-runner-section cpu-section">
        <div class="dev-section-subtitle">🤖 CPU・自動化</div>
        <button type="button" id="btn-run-cpu-turn" class="dev-btn-cpu">
          <span>▶</span> 次のCPUターンを実行
        </button>
        <div class="dev-cpu-info">参加CPU: ${CPU_SEATS.size > 0 ? Array.from(CPU_SEATS).map(s => getOwnerLabel(s)).join(', ') : 'なし'}</div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // パネル開閉
  const toggleBtn = panel.querySelector('#dev-runner-toggle');
  toggleBtn?.addEventListener('click', () => {
    panel.classList.toggle('is-collapsed');
    toggleBtn.textContent = panel.classList.contains('is-collapsed') ? '▶' : '◀';
  });

  // 操作プレイヤー変更
  const playerSelect = panel.querySelector('#dev-acting-player-select');
  playerSelect?.addEventListener('change', (e) => {
    CURRENT_ACTING_PLAYER = e.target.value;
    showToast(`操作プレイヤーを ${getOwnerLabel(CURRENT_ACTING_PLAYER)} に切り替えました`);
  });

  // アクションボタン一覧の描画
  renderActionButtons();

  // CPU実行ボタン
  const cpuBtn = panel.querySelector('#btn-run-cpu-turn');
  cpuBtn?.addEventListener('click', executeNextCpuTurn);
}

function renderActionButtons() {
  const container = document.getElementById('dev-buttons-list');
  if (!container) return;
  container.innerHTML = '';

  if (PLAY_BUTTONS.length === 0) {
    container.innerHTML = '<div class="empty-hint">設定されたアクションボタンはありません</div>';
    return;
  }

  PLAY_BUTTONS.forEach((btn, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-action-btn';
    b.innerHTML = `
      <span class="btn-dot">🔘</span>
      <span class="btn-text">${escapeHtml(btn.label || `アクション #${idx + 1}`)}</span>
    `;

    b.addEventListener('click', () => {
      runPlayButtonAction(btn);
    });

    container.appendChild(b);
  });
}

// ============================================================================
// アクション実行エンジン (rooms/${roomId}/cards と連動)
// ============================================================================
async function runPlayButtonAction(btn) {
  if (isRunningAction) return;
  isRunningAction = true;

  try {
    const actor = CURRENT_ACTING_PLAYER || 'player1';
    const cardsCol = collection(db, `rooms/${CURRENT_ROOM_ID}/cards`);
    const snap = await getDocs(cardsCol);
    const allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allCards.length === 0) {
      showToast('卓上にカードがありません');
      return;
    }

    // 1. 移動アクション
    if (btn.action === 'move') {
      const srcArea = resolveAreaRef(btn.sourceArea, actor);
      const destArea = resolveAreaRef(btn.dest, actor);
      if (!srcArea || !destArea) {
        showToast('移動元または移動先のエリアが見つかりません');
        return;
      }

      const cardsInSrc = allCards.filter(c => isCardInArea(c, srcArea));
      let targets = cardsInSrc;
      if (btn.tagConditions && btn.tagConditions.length > 0) {
        targets = cardsInSrc.filter(c => matchesTagConditions(c, btn.tagConditions));
      }

      if (targets.length === 0) {
        showToast('条件に合うカードが見つかりませんでした');
        return;
      }

      await batchPlaceCardsInArea(targets, destArea, btn.placement || 'spread_lr');
      showToast(`${targets.length}枚のカードを「${destArea.name || 'エリア'}」へ移動しました`);
      return;
    }

    // 2. ドローアクション
    if (btn.action === 'draw') {
      const srcArea = resolveAreaRef(btn.drawSrc, actor) || resolveAreaRef({ kind: 'own', areaType: 'deck' }, actor);
      const destArea = resolveAreaRef(btn.dest, actor) || resolveAreaRef({ kind: 'own', areaType: 'hand' }, actor);
      if (!srcArea || !destArea) {
        showToast('山札またはドロー先のエリアが見つかりません');
        return;
      }

      const deckCards = allCards.filter(c => isCardInArea(c, srcArea))
        .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));

      if (deckCards.length === 0) {
        showToast('山札にカードがありません');
        return;
      }

      const count = Math.min(btn.drawCount || 1, deckCards.length);
      const drawn = deckCards.slice(0, count);

      let faceUp = null;
      if (btn.drawFace === 'face_up') faceUp = true;
      if (btn.drawFace === 'face_down') faceUp = false;

      await batchPlaceCardsInArea(drawn, destArea, btn.placement || 'spread_lr', faceUp);
      showToast(`${getOwnerLabel(actor)}: 山札から${count}枚ドローしました`);
      return;
    }

    // 3. 配布 (Deal) アクション
    if (btn.action === 'deal') {
      const srcArea = resolveAreaRef(btn.dealSrc, actor) || resolveAreaRef({ kind: 'own', areaType: 'deck' }, actor);
      if (!srcArea) {
        showToast('配る元の山札エリアが見つかりません');
        return;
      }

      const destIds = btn.dealDests || [];
      const destAreas = destIds.map(id => DEV_AREAS.find(a => a.id === id)).filter(Boolean);
      if (destAreas.length === 0) {
        showToast('配り先のエリアが設定されていません');
        return;
      }

      const deckCards = allCards.filter(c => isCardInArea(c, srcArea))
        .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));

      if (deckCards.length === 0) {
        showToast('配るカードが山札にありません');
        return;
      }

      const perPlayer = btn.dealCount || 1;
      let cardIdx = 0;
      const batch = writeBatch(db);

      let faceUp = null;
      if (btn.dealFace === 'face_up') faceUp = true;
      if (btn.dealFace === 'face_down') faceUp = false;

      for (let r = 0; r < perPlayer; r++) {
        for (const dest of destAreas) {
          if (cardIdx >= deckCards.length) break;
          const c = deckCards[cardIdx++];
          const pos = calculateNextSlotPosition(dest, [c], btn.dealPlacement || 'spread_lr', 0, 1);
          const ref = doc(db, `rooms/${CURRENT_ROOM_ID}/cards/${c.id}`);
          const update = { x: pos.x, y: pos.y, zIndex: 100 + cardIdx };
          if (faceUp !== null) update.faceUp = faceUp;
          batch.update(ref, update);
        }
      }

      await batch.commit();
      showToast(`各エリアに${perPlayer}枚ずつカードを配りました`);
      return;
    }

    // 4. めくる (Flip) アクション
    if (btn.action === 'flip') {
      const targetArea = resolveAreaRef(btn.targetArea, actor);
      if (!targetArea) {
        showToast('対象エリアが見つかりません');
        return;
      }

      const areaCards = allCards.filter(c => isCardInArea(c, targetArea));
      if (areaCards.length === 0) {
        showToast('対象エリアにカードがありません');
        return;
      }

      const batch = writeBatch(db);
      areaCards.forEach(c => {
        let nextFace = !c.faceUp;
        if (btn.flipTo === 'face_up') nextFace = true;
        if (btn.flipTo === 'face_down') nextFace = false;
        batch.update(doc(db, `rooms/${CURRENT_ROOM_ID}/cards/${c.id}`), { faceUp: nextFace });
      });

      await batch.commit();
      showToast(`${areaCards.length}枚のカードを表裏変更しました`);
      return;
    }

    // 5. シャッフル (Shuffle) アクション
    if (btn.action === 'shuffle') {
      const targetArea = resolveAreaRef(btn.targetArea, actor);
      if (!targetArea) {
        showToast('対象エリアが見つかりません');
        return;
      }

      const areaCards = allCards.filter(c => isCardInArea(c, targetArea));
      if (areaCards.length <= 1) {
        showToast('シャッフルするカードが足りません');
        return;
      }

      // Fisher-Yates shuffle
      const shuffled = [...areaCards];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const batch = writeBatch(db);
      shuffled.forEach((c, idx) => {
        batch.update(doc(db, `rooms/${CURRENT_ROOM_ID}/cards/${c.id}`), { zIndex: 10 + idx });
      });

      await batch.commit();
      showToast(`「${targetArea.name || 'エリア'}」のカード（${areaCards.length}枚）をシャッフルしました！`);
      return;
    }

    // 6. 整列 (Align) アクション
    if (btn.action === 'align') {
      const targetArea = resolveAreaRef(btn.targetArea, actor);
      if (!targetArea) {
        showToast('対象エリアが見つかりません');
        return;
      }

      const areaCards = allCards.filter(c => isCardInArea(c, targetArea));
      if (areaCards.length === 0) {
        showToast('整列するカードがありません');
        return;
      }

      await batchPlaceCardsInArea(areaCards, targetArea, btn.alignPattern || 'spread_lr');
      showToast(`${areaCards.length}枚のカードを整列しました`);
      return;
    }
  } catch (err) {
    console.error('[DevRunner] Action failed:', err);
    showToast('アクションの実行に失敗しました');
  } finally {
    isRunningAction = false;
  }
}

// ============================================================================
// CPU 自動思考エンジン
// ============================================================================
async function executeNextCpuTurn() {
  if (isRunningAction) return;

  const cpuList = Array.from(CPU_SEATS);
  if (cpuList.length === 0) {
    showToast('CPUプレイヤーが登録されていません');
    return;
  }

  // 現在の操作者がCPUでなければ最初のCPUを手番にする
  let actor = CURRENT_ACTING_PLAYER;
  if (!CPU_SEATS.has(actor)) {
    actor = cpuList[0];
    const select = document.getElementById('dev-acting-player-select');
    if (select) select.value = actor;
    CURRENT_ACTING_PLAYER = actor;
  }

  showToast(`🤖 ${getOwnerLabel(actor)} の思考を実行中...`);
  const success = await evaluateAndRunCpuRules(actor);
  if (!success) {
    showToast(`🤖 ${getOwnerLabel(actor)}: 有効な行動ルールがありませんでした`);
  }
}

async function evaluateAndRunCpuRules(cpuPlayerId) {
  if (CPU_RULES.length === 0) return false;

  const cardsCol = collection(db, `rooms/${CURRENT_ROOM_ID}/cards`);
  const snap = await getDocs(cardsCol);
  const allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const matchedRules = CPU_RULES.filter(r => r.targetSeat === 'all' || r.targetSeat === cpuPlayerId);
  if (matchedRules.length === 0) return false;

  for (const rule of matchedRules) {
    // 1. 新フローチャート形式 (nodes)
    if (Array.isArray(rule.nodes) && rule.nodes.length > 0) {
      const context = {
        cpuPlayerId,
        allCards,
        selectedCards: [],
        executedAnyAction: false
      };
      await executeFlowchartNodeList(rule.nodes, context);
      if (context.executedAnyAction) {
        showToast(`🤖 ${getOwnerLabel(cpuPlayerId)}: ルール「${rule.name || 'CPUルーチン'}」を実行しました`);
        return true;
      }
      continue;
    }

    // 2. 旧ブロック形式 (blocks / ruleType)
    if (rule.ruleType === 'action') {
      const act = rule.action;
      if (act && act.actionType !== 'action_pass') {
        await executeCpuActionOnCards(act, cpuPlayerId, allCards);
        showToast(`🤖 ${getOwnerLabel(cpuPlayerId)}: ${rule.label || '優先行動'} を実行しました`);
        return true;
      }
    } else if (rule.ruleType === 'condition') {
      let chosenAct = null;
      let branchLabel = '';

      if (evaluateCpuConditionOnCards(rule, cpuPlayerId, allCards)) {
        chosenAct = rule.thenAction;
        branchLabel = 'IF条件成立';
      } else {
        const elseIfs = Array.isArray(rule.elseIfBranches) ? rule.elseIfBranches : [];
        for (let i = 0; i < elseIfs.length; i++) {
          if (evaluateCpuConditionOnCards(elseIfs[i], cpuPlayerId, allCards)) {
            chosenAct = elseIfs[i].thenAction;
            branchLabel = `ELSE IF #${i + 1}成立`;
            break;
          }
        }
        if (!chosenAct) {
          chosenAct = rule.elseAction;
          branchLabel = 'ELSE成立';
        }
      }

      if (chosenAct && chosenAct.actionType !== 'action_pass') {
        await executeCpuActionOnCards(chosenAct, cpuPlayerId, allCards);
        showToast(`🤖 ${getOwnerLabel(cpuPlayerId)}: [${branchLabel}] アクションを実行しました`);
        return true;
      }
    }
  }

  return false;
}

/**
 * フローチャートノード列を順次再帰実行
 */
async function executeFlowchartNodeList(nodeList, context) {
  if (!Array.isArray(nodeList)) return;

  for (const node of nodeList) {
    if (!node) continue;
    if (node.type === 'start') continue;
    if (node.type === 'end') break;

    if (node.type === 'action') {
      await executeFlowchartAction(node.action, context);
    } else if (node.type === 'condition') {
      const isTrue = evaluateFlowchartCondition(node.condition, context);
      if (isTrue && Array.isArray(node.yesBranch) && node.yesBranch.length > 0) {
        await executeFlowchartNodeList(node.yesBranch, context);
      } else if (!isTrue && Array.isArray(node.noBranch) && node.noBranch.length > 0) {
        await executeFlowchartNodeList(node.noBranch, context);
      }
    }
  }
}

/**
 * フローチャートのアクション実行
 */
async function executeFlowchartAction(act, context) {
  if (!act) return;
  const { cpuPlayerId, allCards } = context;
  const actType = act.actionType || 'action_draw';

  if (actType === 'action_draw') {
    const deck = resolveAreaRef({ kind: 'own', areaType: 'deck' }, cpuPlayerId);
    const hand = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
    if (!deck || !hand) return;

    const deckCards = allCards.filter(c => isCardInArea(c, deck))
      .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
    if (deckCards.length === 0) return;

    const count = Math.min(act.count || 1, deckCards.length);
    const drawn = deckCards.slice(0, count);
    await batchPlaceCardsInArea(drawn, hand, 'spread_lr', true);

    // allCardsの状態も更新
    drawn.forEach(c => {
      c.x = hand.x;
      c.y = hand.y;
    });
    context.executedAnyAction = true;
    return;
  }

  if (actType === 'action_select') {
    const srcArea = resolveAreaRef(valueToRef(act.srcArea || 'own:hand'), cpuPlayerId);
    if (!srcArea) {
      context.selectedCards = [];
      return;
    }
    const inAreaCards = allCards.filter(c => isCardInArea(c, srcArea));
    let candidates = inAreaCards;

    if (act.filterMode === 'tag' && act.tag) {
      const targetTag = act.tag.toLowerCase();
      candidates = inAreaCards.filter(c => {
        const cTags = Array.isArray(c.tags) ? c.tags.map(t => String(t).toLowerCase()) : [];
        return cTags.includes(targetTag);
      });
    }

    const count = Math.min(act.count || 1, candidates.length);
    context.selectedCards = candidates.slice(0, count);
    return;
  }

  if (actType === 'action_select_ai') {
    const srcArea = resolveAreaRef(valueToRef(act.srcArea || 'own:hand'), cpuPlayerId);
    const candidateCards = srcArea ? allCards.filter(c => isCardInArea(c, srcArea)) : [];

    if (candidateCards.length === 0) {
      context.selectedCards = [];
      return;
    }

    // AIが見てよい可視盤面情報の整理
    const visibleContext = {
      areas: {}
    };

    DEV_AREAS.forEach(area => {
      const areaCards = allCards.filter(c => isCardInArea(c, area));
      const isOpponentHand = area.owner && area.owner !== cpuPlayerId && area.areaType === 'hand';
      if (!isOpponentHand) {
        const ownHand = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
        visibleContext.areas[area.name || area.id] = areaCards.map(c => {
          const isOwnCard = ownHand && isCardInArea(c, ownHand);
          if (c.faceUp || isOwnCard) {
            return {
              id: c.id,
              name: c.name || c.id,
              tags: c.tags || c.tagValues || {}
            };
          }
          return { id: c.id, status: '裏向きカード' };
        });
      }
    });

    try {
      showToast(`🤖 ${getOwnerLabel(cpuPlayerId)}: AIがカードを思考中...`);
      const { selectedCardIds, reason } = await queryAiCardSelection({
        ruleText: act.ruleText,
        candidateCards,
        visibleContext,
        cpuPlayerLabel: getOwnerLabel(cpuPlayerId)
      });

      const selected = candidateCards.filter(c => selectedCardIds.includes(c.id));
      context.selectedCards = selected;
      if (reason) {
        showToast(`🤖 ${getOwnerLabel(cpuPlayerId)}: 「${reason}」`);
      }
    } catch (err) {
      console.error('[AI Selection Failed]', err);
      showToast(`⚠️ AI思考エラー: ${err.message}`);
      context.selectedCards = [];
    }
    return;
  }

  if (actType === 'action_move') {
    let toMove = [];
    if (act.srcType === 'own:hand') {
      const hand = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
      if (hand) {
        toMove = allCards.filter(c => isCardInArea(c, hand)).slice(0, act.count || 1);
      }
    } else {
      toMove = context.selectedCards || [];
    }

    if (toMove.length === 0) return;

    const dest = resolveAreaRef(valueToRef(act.destArea || 'area:area_play_center'), cpuPlayerId);
    if (!dest) return;

    let faceUp = null;
    if (act.face === 'face_up') faceUp = true;
    if (act.face === 'face_down') faceUp = false;

    await batchPlaceCardsInArea(toMove, dest, act.placement || 'spread_lr', faceUp);
    context.executedAnyAction = true;
    context.selectedCards = []; // 移動完了後に選択解除
    return;
  }
}

/**
 * フローチャートの条件分岐判定
 */
function evaluateFlowchartCondition(cond, context) {
  if (!cond) return true;
  const { cpuPlayerId, allCards, selectedCards } = context;

  let currentVal = 0;
  if (cond.target === 'selected_count') {
    currentVal = (selectedCards || []).length;
  } else if (cond.target === 'hand_count') {
    const hand = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
    currentVal = hand ? allCards.filter(c => isCardInArea(c, hand)).length : 0;
  } else if (cond.target === 'deck_count') {
    const deck = resolveAreaRef({ kind: 'own', areaType: 'deck' }, cpuPlayerId);
    currentVal = deck ? allCards.filter(c => isCardInArea(c, deck)).length : 0;
  }

  const op = cond.op || '>=';
  const target = Number(cond.value ?? 0);

  switch (op) {
    case '>=': return currentVal >= target;
    case '<=': return currentVal <= target;
    case '==': return currentVal === target;
    case '>': return currentVal > target;
    case '<': return currentVal < target;
    default: return currentVal >= target;
  }
}

function evaluateCpuConditionOnCards(block, cpuPlayerId, allCards) {
  const checkArea = resolveAreaRef(valueToRef(block.checkArea || 'own:hand'), cpuPlayerId);
  if (!checkArea) return false;

  const inArea = allCards.filter(c => isCardInArea(c, checkArea));
  let count = inArea.length;

  if (block.condType === 'has_card' && block.filterMode === 'tag_condition' && Array.isArray(block.tagConditions)) {
    count = inArea.filter(c => matchesTagConditions(c, block.tagConditions)).length;
  }

  const op = block.countOp || '>=';
  const target = Number(block.countVal ?? 1);

  switch (op) {
    case '>=': return count >= target;
    case '<=': return count <= target;
    case '==': return count === target;
    case '>': return count > target;
    case '<': return count < target;
    default: return count >= target;
  }
}

async function executeCpuActionOnCards(act, cpuPlayerId, allCards) {
  const actType = act.actionType || 'action_move';

  if (actType === 'action_draw') {
    const deck = resolveAreaRef({ kind: 'own', areaType: 'deck' }, cpuPlayerId);
    const hand = resolveAreaRef({ kind: 'own', areaType: 'hand' }, cpuPlayerId);
    if (!deck || !hand) return;

    const deckCards = allCards.filter(c => isCardInArea(c, deck))
      .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
    if (deckCards.length === 0) return;

    const count = Math.min(act.count || 1, deckCards.length);
    const drawn = deckCards.slice(0, count);
    await batchPlaceCardsInArea(drawn, hand, 'spread_lr', true);
    return;
  }

  if (actType === 'action_move') {
    const src = resolveAreaRef(valueToRef(act.srcArea || 'own:hand'), cpuPlayerId);
    const dest = resolveAreaRef(valueToRef(act.destArea || 'area:area_play_center'), cpuPlayerId);
    if (!src || !dest) return;

    const srcCards = allCards.filter(c => isCardInArea(c, src));
    let candidates = srcCards;
    if (act.filterMode === 'tag_condition' && Array.isArray(act.tagConditions) && act.tagConditions.length > 0) {
      candidates = srcCards.filter(c => matchesTagConditions(c, act.tagConditions));
    }
    if (candidates.length === 0) return;

    const count = Math.min(act.count || 1, candidates.length);
    const selected = candidates.slice(0, count);

    let faceUp = null;
    if (act.face === 'face_up') faceUp = true;
    if (act.face === 'face_down') faceUp = false;

    await batchPlaceCardsInArea(selected, dest, act.placement || 'spread_lr', faceUp);
  }
}

// ============================================================================
// カード配置・バッチ更新ヘルパー
// ============================================================================
async function batchPlaceCardsInArea(cards, destArea, placementPattern, faceUpOverride = null) {
  if (!destArea || cards.length === 0) return;

  const batch = writeBatch(db);
  const total = cards.length;

  cards.forEach((c, idx) => {
    const pos = calculateNextSlotPosition(destArea, cards, placementPattern, idx, total);
    const ref = doc(db, `rooms/${CURRENT_ROOM_ID}/cards/${c.id}`);
    const update = {
      x: pos.x,
      y: pos.y,
      zIndex: 50 + idx
    };
    if (faceUpOverride !== null) {
      update.faceUp = faceUpOverride;
    }
    batch.update(ref, update);
  });

  await batch.commit();
}

function calculateNextSlotPosition(area, cards, pattern, idx, total) {
  const cardW = 100;
  const cardH = 140;
  const areaX = area.x || 0;
  const areaY = area.y || 0;
  const areaW = area.w || 300;
  const areaH = area.h || 200;

  if (pattern === 'stack') {
    const cx = areaX + (areaW - cardW) / 2;
    const cy = areaY + (areaH - cardH) / 2;
    return { x: Math.round(cx + idx * 0.4), y: Math.round(cy + idx * 0.4) };
  }

  if (pattern === 'grid') {
    const cols = Math.max(1, Math.floor(areaW / (cardW + 10)));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      x: Math.round(areaX + 10 + col * (cardW + 10)),
      y: Math.round(areaY + 10 + row * (cardH + 10))
    };
  }

  // spread_lr
  const spacing = total > 1 ? Math.min(cardW + 14, (areaW - cardW - 20) / (total - 1)) : 0;
  const startX = areaX + (areaW - ((total - 1) * spacing + cardW)) / 2;
  const startY = areaY + (areaH - cardH) / 2;
  return {
    x: Math.round(startX + idx * spacing),
    y: Math.round(startY)
  };
}

function isCardInArea(card, area) {
  const cx = Number(card.x) || 0;
  const cy = Number(card.y) || 0;
  const cw = Number(card.width) || 100;
  const ch = Number(card.height) || 140;

  const ax1 = area.x || 0;
  const ay1 = area.y || 0;
  const ax2 = ax1 + (area.w || 200);
  const ay2 = ay1 + (area.h || 150);

  // 中心座標判定または重なり判定
  const centerX = cx + cw / 2;
  const centerY = cy + ch / 2;
  return centerX >= ax1 && centerX <= ax2 && centerY >= ay1 && centerY <= ay2;
}

function matchesTagConditions(card, tagConditions) {
  if (!tagConditions || tagConditions.length === 0) return true;
  const cardTags = Array.isArray(card.tags) ? card.tags : [];

  return tagConditions.every(cond => {
    const hasTag = cardTags.includes(cond.tag);
    return cond.op === 'not_has' ? !hasTag : hasTag;
  });
}

function resolveAreaRef(ref, actor) {
  if (!ref) return null;
  if (ref.kind === 'area') {
    return DEV_AREAS.find(a => a.id === ref.areaId) || null;
  }
  if (ref.kind === 'own') {
    const owner = actor || 'player1';
    return DEV_AREAS.find(a => a.type === ref.areaType && a.owner === owner) || null;
  }
  return null;
}

function valueToRef(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (value.startsWith('own:')) return { kind: 'own', areaType: value.slice(4) };
  if (value.startsWith('area:')) return { kind: 'area', areaId: value.slice(5) };
  return null;
}

function getOwnerLabel(ownerKey) {
  if (!ownerKey) return '共有';
  const m = String(ownerKey).match(/^player(\d+)$/i);
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
    toast.className = 'dev-runner-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/**
 * 開発モード専用CSSの動的注入
 */
function injectDevRunnerStyles() {
  if (document.getElementById('dev-runner-css')) return;
  const link = document.createElement('link');
  link.id = 'dev-runner-css';
  link.rel = 'stylesheet';
  link.href = 'assets/game-dev-runner.css?v=' + Date.now();
  document.head.appendChild(link);
}
