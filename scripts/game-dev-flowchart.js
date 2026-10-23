/**
 * game-dev-flowchart.js
 * 開発者モード用ビジュアルフローチャートプログラミングエンジン
 * 完全幾何学SVGキャンバス方式 (隙間ゼロ・ズレゼロ・テキスト貫通ゼロ)
 */


export class CpuFlowchartEditor {
  constructor(options = {}) {
    this.container = options.container; // 描画先DOM
    this.onChange = options.onChange || (() => {});
    this.getAvailableAreas = options.getAvailableAreas || (() => []);
    this.getAvailableTags = options.getAvailableTags || (() => []);
    
    // フローツリーデータ
    this.nodes = [];
    this.svgNS = 'http://www.w3.org/2000/svg';
  }

  setData(nodes) {
    if (Array.isArray(nodes) && nodes.length > 0) {
      this.nodes = JSON.parse(JSON.stringify(nodes));
    } else {
      this.nodes = [
        { id: 'start', type: 'start', label: '開始' },
        { id: 'end', type: 'end', label: '終了' }
      ];
    }
    this.render();
  }

  getData() {
    return JSON.parse(JSON.stringify(this.nodes));
  }

  /**
   * フローチャートのレンダリング
   */
  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'flowchart-svg-viewport';

    const svg = document.createElementNS(this.svgNS, 'svg');
    svg.setAttribute('class', 'flowchart-main-svg');
    svg.setAttribute('xmlns', this.svgNS);

    // 矢印マーカー定義
    const defs = document.createElementNS(this.svgNS, 'defs');
    defs.innerHTML = `
      <marker id="flow-arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f172a" />
      </marker>
    `;
    svg.appendChild(defs);

    // 描画ツリーを走査して絶対座標でSVG要素を生成
    const startX = 260; // フローの中心X軸
    const startY = 36;
    const renderContext = {
      svg,
      maxX: 520,
      maxY: 100
    };

    const finalY = this.renderSequence(this.nodes, startX, startY, renderContext);
    
    const svgWidth = Math.max(renderContext.maxX + 60, 560);
    const svgHeight = Math.max(finalY + 60, 520);
    svg.setAttribute('width', `${svgWidth}`);
    svg.setAttribute('height', `${svgHeight}`);
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    canvasWrapper.appendChild(svg);
    this.container.appendChild(canvasWrapper);
  }

  /**
   * ノードシーケンス（配列）を縦にレンダリングする
   */
  renderSequence(nodeList, centerX, startY, ctx) {
    let currentY = startY;

    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];

      // 前のノードとの接続コネクタ線 ＋ ＋ボタン
      if (i > 0) {
        const connLen = 46;
        const lineStartY = currentY;
        const lineEndY = currentY + connLen;

        this.drawConnectorLine(ctx.svg, centerX, lineStartY, centerX, lineEndY, true);
        this.drawPlusButton(ctx.svg, centerX, lineStartY + connLen / 2, nodeList, i);

        currentY = lineEndY;
      }

      // ノード自体の描画
      if (node.type === 'start' || node.type === 'end') {
        const text = node.type === 'start' ? '開始' : '終了';
        this.drawTerminalNode(ctx.svg, centerX, currentY, text);
        currentY += 44;
      } else if (node.type === 'action') {
        const label = this.getActionLabel(node.action);
        this.drawActionNode(ctx.svg, centerX, currentY, label, node, nodeList, i);
        currentY += 44;
      } else if (node.type === 'condition') {
        // 菱形条件分岐ノードのレンダリング
        currentY = this.drawConditionGroup(ctx.svg, centerX, currentY, node, nodeList, i, ctx);
      }
    }

    return currentY;
  }

  /**
   * 終端ノード（開始・終了: 角丸長方形）
   */
  drawTerminalNode(svg, cx, y, text) {
    const w = 180;
    const h = 42;
    const x = cx - w / 2;

    const g = document.createElementNS(this.svgNS, 'g');
    g.setAttribute('class', 'svg-node-terminal');

    const rect = document.createElementNS(this.svgNS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 21);
    rect.setAttribute('ry', 21);
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#0f172a');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(15,23,42,0.06))');

    const t = document.createElementNS(this.svgNS, 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', y + 26);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#0f172a');
    t.setAttribute('font-size', '14');
    t.setAttribute('font-weight', '700');
    t.setAttribute('letter-spacing', '2px');
    t.textContent = text;

    g.appendChild(rect);
    g.appendChild(t);
    svg.appendChild(g);
  }

  /**
   * 実行ノード（長方形）
   */
  drawActionNode(svg, cx, y, label, node, parentList, index) {
    const w = 220;
    const h = 44;
    const x = cx - w / 2;

    const g = document.createElementNS(this.svgNS, 'g');
    g.setAttribute('class', 'svg-node-action');
    g.style.cursor = 'pointer';

    const rect = document.createElementNS(this.svgNS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 4);
    rect.setAttribute('ry', 4);
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#0f172a');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('filter', 'drop-shadow(0 2px 5px rgba(15,23,42,0.08))');

    const t = document.createElementNS(this.svgNS, 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', y + 27);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#0f172a');
    t.setAttribute('font-size', '13');
    t.setAttribute('font-weight', '700');
    t.textContent = label;

    // クリックで編集
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openActionModal(node, parentList, index);
    });

    g.appendChild(rect);
    g.appendChild(t);
    svg.appendChild(g);
  }

  /**
   * 条件分岐（◇ 菱形 ＋ YES下ルート ＋ NO右折ルート ＋ T字合流バー）
   */
  drawConditionGroup(svg, cx, y, node, parentList, index, ctx) {
    const diaW = 240;
    const diaH = 80;
    const halfW = diaW / 2;
    const halfH = diaH / 2;

    const topX = cx;
    const topY = y;
    const rightX = cx + halfW;
    const rightY = y + halfH;
    const bottomX = cx;
    const bottomY = y + diaH;
    const leftX = cx - halfW;
    const leftY = y + halfH;

    // 1. 菱形を描画
    const gDia = document.createElementNS(this.svgNS, 'g');
    gDia.setAttribute('class', 'svg-node-diamond');
    gDia.style.cursor = 'pointer';

    const poly = document.createElementNS(this.svgNS, 'polygon');
    poly.setAttribute('points', `${topX},${topY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}`);
    poly.setAttribute('fill', '#ffffff');
    poly.setAttribute('stroke', '#0f172a');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('filter', 'drop-shadow(0 3px 6px rgba(15,23,42,0.08))');

    const t = document.createElementNS(this.svgNS, 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', y + 45);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#0f172a');
    t.setAttribute('font-size', '13');
    t.setAttribute('font-weight', '700');
    t.textContent = this.getConditionLabel(node.condition);

    gDia.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openConditionModal(node, parentList, index);
    });

    gDia.appendChild(poly);
    gDia.appendChild(t);
    svg.appendChild(gDia);

    // 2. ブランチの幾何学レイアウト
    const yesCenterX = cx;
    const noCenterX = cx + 180; // NOルートの縦ラインX
    ctx.maxX = Math.max(ctx.maxX, noCenterX + 140);

    if (!Array.isArray(node.yesBranch)) node.yesBranch = [];
    if (!Array.isArray(node.noBranch)) node.noBranch = [];

    // --- YESルート（下方向） ---
    // 下頂点から直下へ伸びる線
    const yesStartLineY = bottomY;
    const yesBranchStartY = bottomY + 54;
    this.drawConnectorLine(svg, yesCenterX, yesStartLineY, yesCenterX, yesBranchStartY, true);
    this.drawText(svg, yesCenterX - 18, bottomY + 22, 'YES', '#0f172a', '12px', 'bold');
    this.drawPlusButton(svg, yesCenterX, bottomY + 32, node.yesBranch, 0);

    let yesEndY = yesBranchStartY;
    if (node.yesBranch.length > 0) {
      yesEndY = this.renderBranchSequence(node.yesBranch, yesCenterX, yesBranchStartY, svg, ctx);
    }

    // --- NOルート（右へ出て下へ折れる） ---
    const noBranchStartY = bottomY + 54;
    // 右頂点 (rightX, rightY) から水平に (noCenterX, rightY) へ、そして下へ (noCenterX, noBranchStartY)
    const elbowPath = document.createElementNS(this.svgNS, 'path');
    elbowPath.setAttribute('d', `M ${rightX},${rightY} H ${noCenterX} V ${noBranchStartY}`);
    elbowPath.setAttribute('fill', 'none');
    elbowPath.setAttribute('stroke', '#0f172a');
    elbowPath.setAttribute('stroke-width', '2');
    elbowPath.setAttribute('stroke-linejoin', 'round');
    elbowPath.setAttribute('marker-end', 'url(#flow-arrow-head)');
    svg.appendChild(elbowPath);

    this.drawText(svg, rightX + 16, rightY - 8, 'NO', '#0f172a', '12px', 'bold');
    this.drawPlusButton(svg, noCenterX, bottomY + 32, node.noBranch, 0);

    let noEndY = noBranchStartY;
    if (node.noBranch.length > 0) {
      noEndY = this.renderBranchSequence(node.noBranch, noCenterX, noBranchStartY, svg, ctx);
    }

    // --- 合流部 (T字マージ) ---
    const mergeY = Math.max(yesEndY, noEndY) + 30;

    // YES側を下へ伸ばす
    this.drawConnectorLine(svg, yesCenterX, yesEndY, yesCenterX, mergeY, false);
    // NO側を下へ伸ばし、左へ水平に合流
    const mergePath = document.createElementNS(this.svgNS, 'path');
    mergePath.setAttribute('d', `M ${noCenterX},${noEndY} V ${mergeY} H ${yesCenterX}`);
    mergePath.setAttribute('fill', 'none');
    mergePath.setAttribute('stroke', '#0f172a');
    mergePath.setAttribute('stroke-width', '2');
    mergePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(mergePath);

    return mergeY;
  }

  /**
   * ブランチ内ノード列のレンダリング
   */
  renderBranchSequence(branchList, centerX, startY, svg, ctx) {
    let currentY = startY;

    for (let i = 0; i < branchList.length; i++) {
      const node = branchList[i];

      if (i > 0) {
        const connLen = 46;
        const lineStartY = currentY;
        const lineEndY = currentY + connLen;

        this.drawConnectorLine(svg, centerX, lineStartY, centerX, lineEndY, true);
        this.drawPlusButton(svg, centerX, lineStartY + connLen / 2, branchList, i);

        currentY = lineEndY;
      }

      if (node.type === 'action') {
        const label = this.getActionLabel(node.action);
        this.drawActionNode(svg, centerX, currentY, label, node, branchList, i);
        currentY += 44;
      }
    }

    return currentY;
  }

  /**
   * 直線コネクタ（矢印付き）
   */
  drawConnectorLine(svg, x1, y1, x2, y2, withArrow = false) {
    const line = document.createElementNS(this.svgNS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#0f172a');
    line.setAttribute('stroke-width', '2');
    if (withArrow) {
      line.setAttribute('marker-end', 'url(#flow-arrow-head)');
    }
    svg.appendChild(line);
  }

  /**
   * テキスト描画
   */
  drawText(svg, x, y, str, color = '#0f172a', size = '12px', weight = 'bold') {
    const t = document.createElementNS(this.svgNS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('fill', color);
    t.setAttribute('font-size', size);
    t.setAttribute('font-weight', weight);
    t.textContent = str;
    svg.appendChild(t);
  }

  /**
   * ( ＋ ) ボタン
   */
  drawPlusButton(svg, cx, cy, parentList, insertIndex) {
    const g = document.createElementNS(this.svgNS, 'g');
    g.setAttribute('class', 'svg-flow-plus');
    g.style.cursor = 'pointer';

    const circle = document.createElementNS(this.svgNS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', 11);
    circle.setAttribute('fill', '#2563eb');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(37,99,235,0.4))');

    const t = document.createElementNS(this.svgNS, 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', cy + 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#ffffff');
    t.setAttribute('font-size', '14');
    t.setAttribute('font-weight', '900');
    t.textContent = '＋';

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAddMenu(e, parentList, insertIndex);
    });

    g.appendChild(circle);
    g.appendChild(t);
    svg.appendChild(g);
  }

  /**
   * 「＋」クリック時のポップアップメニューを開く
   */
  openAddMenu(event, parentList, insertIndex) {
    this.closePopups();

    const menu = document.createElement('div');
    menu.className = 'flow-add-popup-menu';
    menu.innerHTML = `
      <button type="button" class="flow-menu-item item-action">
        <span class="icon">⚡</span>
        <span class="label">実行</span>
      </button>
      <button type="button" class="flow-menu-item item-condition">
        <span class="icon">◇</span>
        <span class="label">条件分岐</span>
      </button>
    `;

    menu.querySelector('.item-action').addEventListener('click', () => {
      this.closePopups();
      this.openActionModal(null, parentList, insertIndex);
    });

    menu.querySelector('.item-condition').addEventListener('click', () => {
      this.closePopups();
      this.openConditionModal(null, parentList, insertIndex);
    });

    const rect = event.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left + rect.width / 2}px`;
    menu.style.transform = 'translateX(-50%)';
    menu.style.zIndex = '10001';

    document.body.appendChild(menu);

    const onOutsideClick = (e) => {
      if (!menu.contains(e.target) && e.target !== event.target) {
        this.closePopups();
        document.removeEventListener('click', onOutsideClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onOutsideClick), 10);
  }

  closePopups() {
    const existing = document.querySelectorAll('.flow-add-popup-menu, .flow-edit-dialog-overlay');
    existing.forEach(el => el.remove());
  }

  /**
   * 「実行」ノード設定モーダルを開く
   */
  openActionModal(existingNode, parentList, insertIndex) {
    this.closePopups();

    const isEdit = !!existingNode;
    const act = isEdit ? existingNode.action : { actionType: 'action_draw', count: 1 };

    const areas = this.getAvailableAreas();
    const areaOptionsHtml = areas.map(a => `<option value="${a.id}">${a.name} (${a.id})</option>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'flow-edit-dialog-overlay';

    overlay.innerHTML = `
      <div class="flow-edit-dialog">
        <div class="flow-dialog-header">
          <span class="flow-dialog-title">実行</span>
          <button type="button" class="flow-dialog-close">✕</button>
        </div>
        <div class="flow-dialog-body">
          <div class="form-group">
            <label class="form-label">実行内容</label>
            <select class="form-select" id="dialog-action-type">
              <option value="action_draw" ${act.actionType === 'action_draw' ? 'selected' : ''}>山札からドロー</option>
              <option value="action_select" ${act.actionType === 'action_select' ? 'selected' : ''}>カードを選択する (条件一致)</option>
              <option value="action_select_ai" ${act.actionType === 'action_select_ai' ? 'selected' : ''}>🤖 カードを選択する (AI)</option>
              <option value="action_move" ${act.actionType === 'action_move' ? 'selected' : ''}>カードを出す / 移動させる</option>
              <option value="action_pass" ${act.actionType === 'action_pass' ? 'selected' : ''}>パスする / ターン終了</option>
            </select>
          </div>

          <!-- パラメータ: 山札からドロー -->
          <div class="action-params-box" id="params-draw" style="display:none;">
            <div class="form-group">
              <label class="form-label">ドローする枚数</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" class="form-input" id="dialog-draw-count" value="${act.count || 1}" min="1" max="20" style="width:100px;" />
                <span>枚</span>
              </div>
            </div>
          </div>

          <!-- パラメータ: カードを選択する (通常) -->
          <div class="action-params-box" id="params-select" style="display:none;">
            <div class="form-group">
              <label class="form-label">選択対象の場所</label>
              <select class="form-select" id="dialog-select-src">
                <option value="own:hand" ${act.srcArea === 'own:hand' ? 'selected' : ''}>自分の手札</option>
                <option value="any:hand" ${act.srcArea === 'any:hand' ? 'selected' : ''}>全員の手札</option>
                ${areaOptionsHtml}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">選択条件 (フィルター)</label>
              <select class="form-select" id="dialog-select-filter">
                <option value="all" ${act.filterMode === 'all' || !act.filterMode ? 'selected' : ''}>すべてのカード</option>
                <option value="tag" ${act.filterMode === 'tag' ? 'selected' : ''}>指定したタグに一致</option>
              </select>
            </div>
            <div class="form-group" id="dialog-select-tag-box" style="display:none;">
              <label class="form-label">タグ名</label>
              <input type="text" class="form-input" id="dialog-select-tag" value="${act.tag || ''}" placeholder="例: spell, red, cost3" />
            </div>
            <div class="form-group">
              <label class="form-label">選択枚数</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" class="form-input" id="dialog-select-count" value="${act.count || 1}" min="1" max="20" style="width:100px;" />
                <span>枚</span>
              </div>
            </div>
          </div>

          <!-- パラメータ: カードを選択する (AI) -->
          <div class="action-params-box" id="params-select-ai" style="display:none;">
            <div class="form-group">
              <label class="form-label">選択対象の場所</label>
              <select class="form-select" id="dialog-ai-src">
                <option value="own:hand" ${act.srcArea === 'own:hand' || !act.srcArea ? 'selected' : ''}>自分の手札</option>
                <option value="any:hand" ${act.srcArea === 'any:hand' ? 'selected' : ''}>全員の手札</option>
                ${areaOptionsHtml}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">ゲームルール (AIへの思考指示)</label>
              <textarea class="form-input" id="dialog-ai-rule" rows="4" style="resize:vertical; font-size:12px; line-height:1.4;" placeholder="例: 場に出ているカードより大きい数字を手札から1枚出す。出せるカードがない場合は何も選択しない。">${act.ruleText || ''}</textarea>
              <div style="font-size:11px; color:#64748b; margin-top:4px;">※AIには「ルール」「現在の盤面（見えているカード）」「自分の手札」のみが渡され、最適なカードを自動選択します。</div>
            </div>
          </div>

          <!-- パラメータ: カードを出す / 移動させる -->
          <div class="action-params-box" id="params-move" style="display:none;">
            <div class="form-group">
              <label class="form-label">移動させるカード</label>
              <select class="form-select" id="dialog-move-src">
                <option value="selected" ${act.srcType === 'selected' || !act.srcType ? 'selected' : ''}>選択中カード</option>
                <option value="own:hand" ${act.srcType === 'own:hand' ? 'selected' : ''}>自分の手札から直接</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">移動先エリア</label>
              <select class="form-select" id="dialog-move-dest">
                ${areaOptionsHtml}
                <option value="discard" ${act.destArea === 'discard' ? 'selected' : ''}>捨て札 / 墓地</option>
                <option value="own:hand" ${act.destArea === 'own:hand' ? 'selected' : ''}>自分の手札</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">カードの向き</label>
              <select class="form-select" id="dialog-move-face">
                <option value="face_up" ${act.face !== 'face_down' ? 'selected' : ''}>表向き</option>
                <option value="face_down" ${act.face === 'face_down' ? 'selected' : ''}>裏向き</option>
              </select>
            </div>
          </div>

          <!-- パラメータ: パス -->
          <div class="action-params-box" id="params-pass" style="display:none;">
            <div style="font-size:12px; color:#94a3b8; padding:8px 0;">何も行動を行わず、パス / 終了します。</div>
          </div>
        </div>

        <div class="flow-dialog-footer">
          ${isEdit ? '<button type="button" class="btn-dialog-del">削除</button>' : ''}
          <div style="flex:1;"></div>
          <button type="button" class="btn-dialog-cancel">キャンセル</button>
          <button type="button" class="btn-dialog-ok">決定</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const typeSelect = overlay.querySelector('#dialog-action-type');
    const pDraw = overlay.querySelector('#params-draw');
    const pSelect = overlay.querySelector('#params-select');
    const pSelectAi = overlay.querySelector('#params-select-ai');
    const pMove = overlay.querySelector('#params-move');
    const pPass = overlay.querySelector('#params-pass');
    const selectFilter = overlay.querySelector('#dialog-select-filter');
    const selectTagBox = overlay.querySelector('#dialog-select-tag-box');

    const updateVisibility = () => {
      pDraw.style.display = typeSelect.value === 'action_draw' ? 'block' : 'none';
      pSelect.style.display = typeSelect.value === 'action_select' ? 'block' : 'none';
      pSelectAi.style.display = typeSelect.value === 'action_select_ai' ? 'block' : 'none';
      pMove.style.display = typeSelect.value === 'action_move' ? 'block' : 'none';
      pPass.style.display = typeSelect.value === 'action_pass' ? 'block' : 'none';
      selectTagBox.style.display = selectFilter.value === 'tag' ? 'block' : 'none';
    };
    typeSelect.addEventListener('change', updateVisibility);
    selectFilter.addEventListener('change', updateVisibility);
    updateVisibility();

    overlay.querySelector('.flow-dialog-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.btn-dialog-cancel').addEventListener('click', () => overlay.remove());

    if (isEdit) {
      overlay.querySelector('.btn-dialog-del').addEventListener('click', () => {
        overlay.remove();
        this.deleteNode(parentList, insertIndex);
      });
    }

    overlay.querySelector('.btn-dialog-ok').addEventListener('click', () => {
      const actType = typeSelect.value;
      let newAction = { actionType: actType };

      if (actType === 'action_draw') {
        newAction.count = parseInt(overlay.querySelector('#dialog-draw-count').value, 10) || 1;
      } else if (actType === 'action_select') {
        newAction.srcArea = overlay.querySelector('#dialog-select-src').value;
        newAction.filterMode = selectFilter.value;
        newAction.tag = overlay.querySelector('#dialog-select-tag').value.trim();
        newAction.count = parseInt(overlay.querySelector('#dialog-select-count').value, 10) || 1;
      } else if (actType === 'action_select_ai') {
        newAction.srcArea = overlay.querySelector('#dialog-ai-src').value;
        newAction.ruleText = overlay.querySelector('#dialog-ai-rule').value.trim();
      } else if (actType === 'action_move') {
        newAction.srcType = overlay.querySelector('#dialog-move-src').value;
        newAction.destArea = overlay.querySelector('#dialog-move-dest').value;
        newAction.face = overlay.querySelector('#dialog-move-face').value;
      }

      if (isEdit) {
        existingNode.action = newAction;
      } else {
        const newNode = {
          id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'action',
          action: newAction
        };
        parentList.splice(insertIndex, 0, newNode);
      }

      overlay.remove();
      this.render();
      this.onChange(this.getData());
    });
  }

  /**
   * 「条件分岐」ノード設定モーダルを開く
   */
  openConditionModal(existingNode, parentList, insertIndex) {
    this.closePopups();

    const isEdit = !!existingNode;
    const cond = isEdit ? existingNode.condition : {
      target: 'selected_count',
      op: '>=',
      value: 3
    };

    const overlay = document.createElement('div');
    overlay.className = 'flow-edit-dialog-overlay';

    overlay.innerHTML = `
      <div class="flow-edit-dialog">
        <div class="flow-dialog-header">
          <span class="flow-dialog-title">条件分岐</span>
          <button type="button" class="flow-dialog-close">✕</button>
        </div>
        <div class="flow-dialog-body">
          <div class="form-group">
            <label class="form-label">条件対象</label>
            <select class="form-select" id="dialog-cond-target">
              <option value="selected_count" ${cond.target === 'selected_count' ? 'selected' : ''}>選択中カードの枚数</option>
              <option value="hand_count" ${cond.target === 'hand_count' ? 'selected' : ''}>自分の手札の枚数</option>
              <option value="deck_count" ${cond.target === 'deck_count' ? 'selected' : ''}>自分の山札の枚数</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">比較演算子・値</label>
            <div style="display:flex; align-items:center; gap:10px;">
              <select class="form-select" id="dialog-cond-op" style="width:90px;">
                <option value=">=" ${cond.op === '>=' ? 'selected' : ''}>&gt;=</option>
                <option value="<=" ${cond.op === '<=' ? 'selected' : ''}>&lt;=</option>
                <option value="==" ${cond.op === '==' ? 'selected' : ''}>==</option>
                <option value=">" ${cond.op === '>' ? 'selected' : ''}>&gt;</option>
                <option value="<" ${cond.op === '<' ? 'selected' : ''}>&lt;</option>
              </select>
              <input type="number" class="form-input" id="dialog-cond-val" value="${cond.value ?? 3}" min="0" max="99" style="width:100px;" />
            </div>
          </div>
        </div>

        <div class="flow-dialog-footer">
          ${isEdit ? '<button type="button" class="btn-dialog-del">削除</button>' : ''}
          <div style="flex:1;"></div>
          <button type="button" class="btn-dialog-cancel">キャンセル</button>
          <button type="button" class="btn-dialog-ok">決定</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.flow-dialog-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.btn-dialog-cancel').addEventListener('click', () => overlay.remove());

    if (isEdit) {
      overlay.querySelector('.btn-dialog-del').addEventListener('click', () => {
        overlay.remove();
        this.deleteNode(parentList, insertIndex);
      });
    }

    overlay.querySelector('.btn-dialog-ok').addEventListener('click', () => {
      const newCond = {
        target: overlay.querySelector('#dialog-cond-target').value,
        op: overlay.querySelector('#dialog-cond-op').value,
        value: parseInt(overlay.querySelector('#dialog-cond-val').value, 10) || 0
      };

      if (isEdit) {
        existingNode.condition = newCond;
      } else {
        const newNode = {
          id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: 'condition',
          condition: newCond,
          yesBranch: [],
          noBranch: []
        };
        parentList.splice(insertIndex, 0, newNode);
      }

      overlay.remove();
      this.render();
      this.onChange(this.getData());
    });
  }

  deleteNode(parentList, index) {
    if (confirm('このノードを削除してもよろしいですか？')) {
      parentList.splice(index, 1);
      this.render();
      this.onChange(this.getData());
    }
  }

  getActionLabel(act) {
    if (!act) return '未設定のアクション';
    switch (act.actionType) {
      case 'action_draw':
        return `山札からドロー (${act.count || 1}枚)`;
      case 'action_select': {
        const filterStr = act.filterMode === 'tag' && act.tag ? `タグ[${act.tag}]` : 'すべて';
        return `カードを選択 (${filterStr}, ${act.count || 1}枚)`;
      }
      case 'action_select_ai':
        return `🤖 カードを選択 (AI思考)`;
      case 'action_move': {
        const srcStr = act.srcType === 'own:hand' ? '手札から' : '選択中カードを';
        return `${srcStr} 移動 (${act.destArea || '指定エリア'})`;
      }
      case 'action_pass':
        return 'パス / ターン終了';
      default:
        return '実行アクション';
    }
  }

  getConditionLabel(cond) {
    if (!cond) return '条件未設定';
    let targetStr = '選択中カードの枚数';
    if (cond.target === 'hand_count') targetStr = '手札の枚数';
    if (cond.target === 'deck_count') targetStr = '山札の枚数';
    return `${targetStr}${cond.op || '>='}${cond.value ?? 0}`;
  }
}
