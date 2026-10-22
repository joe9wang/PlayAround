/**
 * game-dev-flowchart.js
 * 開発者モード用ビジュアルフローチャートプログラミングエンジン
 * JIS/ISO規格準拠のフローチャート ([開始] -> [長方形:実行] -> [◇:条件分岐(YES/NO)] -> [合流] -> [終了])
 */

export class CpuFlowchartEditor {
  constructor(options = {}) {
    this.container = options.container; // 描画先DOM
    this.onChange = options.onChange || (() => {});
    this.getAvailableAreas = options.getAvailableAreas || (() => []);
    this.getAvailableTags = options.getAvailableTags || (() => []);
    
    // フローツリーデータ
    this.nodes = [];
    this.selectedNodeId = null;
    this.activePlusContext = null; // { parentList, index }
  }

  /**
   * データをセットして再描画
   */
  setData(nodes) {
    if (Array.isArray(nodes) && nodes.length > 0) {
      this.nodes = JSON.parse(JSON.stringify(nodes));
    } else {
      // デフォルトの基本フロー: [開始] -> [終了]
      this.nodes = [
        { id: 'start', type: 'start', label: '開始' },
        { id: 'end', type: 'end', label: '終了' }
      ];
    }
    this.render();
  }

  /**
   * 現在のフローデータを取得
   */
  getData() {
    return JSON.parse(JSON.stringify(this.nodes));
  }

  /**
   * フローチャート全体の描画
   */
  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const rootEl = document.createElement('div');
    rootEl.className = 'flowchart-canvas';

    // ルートノード列を描画
    const flowListEl = this.renderNodeList(this.nodes, null);
    rootEl.appendChild(flowListEl);

    this.container.appendChild(rootEl);
  }

  /**
   * ノード配列を縦にレンダリングする（各ノード間に矢印と＋ボタン）
   */
  renderNodeList(nodeList, parentContext) {
    const listWrapper = document.createElement('div');
    listWrapper.className = 'flow-sequence-col';

    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];

      // ノード自体の描画
      const nodeEl = this.renderSingleNode(node, nodeList, i);
      listWrapper.appendChild(nodeEl);

      // 最後のノードが 'end' でなければ、またはノード間に「下向き矢印 ＋ コネクタボタン」を描画
      if (i < nodeList.length - 1) {
        const connectorEl = this.renderConnector(nodeList, i + 1);
        listWrapper.appendChild(connectorEl);
      }
    }

    return listWrapper;
  }

  /**
   * 単一ノードの描画
   */
  renderSingleNode(node, parentList, index) {
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = `flow-node-wrapper type-${node.type}`;
    nodeWrapper.dataset.nodeId = node.id;

    if (node.type === 'start') {
      const el = document.createElement('div');
      el.className = 'flow-node flow-node-terminal start';
      el.textContent = '開始';
      nodeWrapper.appendChild(el);
      return nodeWrapper;
    }

    if (node.type === 'end') {
      const el = document.createElement('div');
      el.className = 'flow-node flow-node-terminal end';
      el.textContent = '終了';
      nodeWrapper.appendChild(el);
      return nodeWrapper;
    }

    if (node.type === 'action') {
      const el = document.createElement('div');
      el.className = 'flow-node flow-node-action';
      el.innerHTML = `
        <div class="flow-node-label">${this.getActionLabel(node.action)}</div>
        <div class="flow-node-actions">
          <button type="button" class="flow-node-btn edit" title="編集">✏️</button>
          <button type="button" class="flow-node-btn del" title="削除">🗑️</button>
        </div>
      `;
      el.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openActionModal(node, parentList, index);
      });
      el.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNode(parentList, index);
      });
      el.addEventListener('click', () => {
        this.openActionModal(node, parentList, index);
      });
      nodeWrapper.appendChild(el);
      return nodeWrapper;
    }

    if (node.type === 'condition') {
      // 菱形条件分岐ノード
      const condContainer = document.createElement('div');
      condContainer.className = 'flow-condition-group';

      // 菱形ノード（余計な長方形枠線を排除しSVGのみで描画）
      const diamondWrapper = document.createElement('div');
      diamondWrapper.className = 'flow-node-diamond-wrapper';

      const diamond = document.createElement('div');
      diamond.className = 'flow-node-diamond'; // flow-nodeを付与しないことで外枠を除去
      
      const labelText = this.getConditionLabel(node.condition);
      diamond.innerHTML = `
        <svg class="flow-diamond-svg" viewBox="0 0 240 84">
          <polygon points="120,2 238,42 120,82 2,42" class="flow-diamond-polygon" />
        </svg>
        <span class="flow-diamond-text">${labelText}</span>
        <div class="flow-node-actions diamond-tools">
          <button type="button" class="flow-node-btn edit" title="編集">✏️</button>
          <button type="button" class="flow-node-btn del" title="削除">🗑️</button>
        </div>
      `;

      diamond.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openConditionModal(node, parentList, index);
      });
      diamond.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNode(parentList, index);
      });
      diamond.addEventListener('click', () => {
        this.openConditionModal(node, parentList, index);
      });

      diamondWrapper.appendChild(diamond);
      condContainer.appendChild(diamondWrapper);

      // YES / NO の分岐エリア
      const branchesWrapper = document.createElement('div');
      branchesWrapper.className = 'flow-branches-container';

      // YESルート（直進・下）
      const yesCol = document.createElement('div');
      yesCol.className = 'flow-branch-col branch-yes';
      
      const yesHeader = document.createElement('div');
      yesHeader.className = 'flow-branch-header yes-header';
      yesHeader.innerHTML = `
        <span class="branch-tag yes">YES</span>
        <svg class="branch-header-svg" width="16" height="24" viewBox="0 0 16 24">
          <line x1="8" y1="0" x2="8" y2="20" stroke="#0f172a" stroke-width="2" />
          <polygon points="4,16 12,16 8,22" fill="#0f172a" />
        </svg>
      `;
      yesCol.appendChild(yesHeader);

      if (!Array.isArray(node.yesBranch)) node.yesBranch = [];
      const yesListEl = this.renderBranchList(node.yesBranch);
      yesCol.appendChild(yesListEl);

      // NOルート（右へ分岐して直角に下へ折れる）
      const noCol = document.createElement('div');
      noCol.className = 'flow-branch-col branch-no';

      const noHeader = document.createElement('div');
      noHeader.className = 'flow-branch-header no-header';
      noHeader.innerHTML = `
        <svg class="no-branch-elbow-svg" width="140" height="44" viewBox="0 0 140 44">
          <path d="M 0,2 H 100 V 40" fill="none" stroke="#0f172a" stroke-width="2" stroke-linejoin="round" />
          <polygon points="96,36 104,36 100,42" fill="#0f172a" />
        </svg>
        <span class="branch-tag no">NO</span>
      `;
      noCol.appendChild(noHeader);

      if (!Array.isArray(node.noBranch)) node.noBranch = [];
      const noListEl = this.renderBranchList(node.noBranch);
      noCol.appendChild(noListEl);

      branchesWrapper.appendChild(yesCol);
      branchesWrapper.appendChild(noCol);
      condContainer.appendChild(branchesWrapper);

      // 合流部（YESとNOを隙間なく結合する一体型SVG）
      const mergeEl = document.createElement('div');
      mergeEl.className = 'flow-branch-merge-container';
      mergeEl.innerHTML = `
        <svg class="merge-svg" width="480" height="36" viewBox="0 0 480 36">
          <line x1="130" y1="0" x2="130" y2="18" stroke="#0f172a" stroke-width="2" />
          <path d="M 370,0 V 18 H 130" fill="none" stroke="#0f172a" stroke-width="2" stroke-linejoin="round" />
          <line x1="130" y1="18" x2="130" y2="32" stroke="#0f172a" stroke-width="2" />
          <polygon points="126,28 134,28 130,34" fill="#0f172a" />
        </svg>
      `;
      condContainer.appendChild(mergeEl);

      nodeWrapper.appendChild(condContainer);
      return nodeWrapper;
    }

    return nodeWrapper;
  }

  /**
   * ブランチ（YES/NO）内のノードリストを描画
   */
  renderBranchList(branchList) {
    const listWrapper = document.createElement('div');
    listWrapper.className = 'flow-branch-node-list';

    // 最初の＋ボタン（ブランチの先頭）
    listWrapper.appendChild(this.renderConnector(branchList, 0));

    for (let i = 0; i < branchList.length; i++) {
      const node = branchList[i];
      const nodeEl = this.renderSingleNode(node, branchList, i);
      listWrapper.appendChild(nodeEl);

      // 次の＋ボタン
      listWrapper.appendChild(this.renderConnector(branchList, i + 1));
    }

    return listWrapper;
  }

  /**
   * コネクタ（矢印線 ＋ 青い丸型＋ボタン）をSVGで綺麗に描画
   */
  renderConnector(parentList, insertIndex) {
    const connector = document.createElement('div');
    connector.className = 'flow-connector';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flow-plus-btn';
    btn.innerHTML = '＋';
    btn.title = 'ノードを追加';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAddMenu(e, parentList, insertIndex);
    });

    connector.innerHTML = `
      <svg class="connector-svg" width="16" height="44" viewBox="0 0 16 44">
        <line x1="8" y1="0" x2="8" y2="40" stroke="#0f172a" stroke-width="2" />
        <polygon points="4,36 12,36 8,42" fill="#0f172a" />
      </svg>
    `;
    connector.appendChild(btn);

    return connector;
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

    // ポップアップ位置の計算
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
              <option value="action_select" ${act.actionType === 'action_select' ? 'selected' : ''}>カードを選択する</option>
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

          <!-- パラメータ: カードを選択する -->
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
    const pMove = overlay.querySelector('#params-move');
    const pPass = overlay.querySelector('#params-pass');
    const selectFilter = overlay.querySelector('#dialog-select-filter');
    const selectTagBox = overlay.querySelector('#dialog-select-tag-box');

    const updateVisibility = () => {
      pDraw.style.display = typeSelect.value === 'action_draw' ? 'block' : 'none';
      pSelect.style.display = typeSelect.value === 'action_select' ? 'block' : 'none';
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
