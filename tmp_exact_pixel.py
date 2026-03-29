import sys
path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

o1 = """      const scaleLevel = data.scaleLevel || 0;
      const multX = data.multX || 1;
      const multY = data.multY || 1;
      const scale = Math.pow(1.2, scaleLevel);
      
      // Position & Scale sync
      if (data.isAbsolute) {
        el.dataset.areaId = id; 
        if (el.parentElement !== field) {
          el.style.width = el.offsetWidth + 'px';
          el.style.height = el.offsetHeight + 'px';
          field.appendChild(el);
        }
        el.style.position = 'absolute';
        // z-index を動的に設定（100: プレイエリア系 / 200: サブエリア系）。カード(300〜) margin
        const isPlayType = (id.includes('play-area') || id.includes('main-play-area') || id.includes('board-play'));
        el.style.zIndex = isPlayType ? '100' : '200';
        
        if (data.x !== undefined) el.style.left = data.x + 'px';
        if (data.y !== undefined) el.style.top = data.y + 'px';
        
        // isAbsoluteの場合、ベースサイズに縦横乗数をかけて実体面積のみを変える
        if (data.width !== undefined) el.style.width = (data.width * multX) + 'px';
        if (data.height !== undefined) el.style.height = (data.height * multY) + 'px';
      } else {
        // グリッド等に属している場合、ベース100%からcalcで計算する
        if (multX !== 1) el.style.width = `calc(100% * ${multX})`;
        else el.style.width = '';
        if (multY !== 1) el.style.height = `calc(100% * ${multY})`;
        else el.style.height = '';
      }
      
      // テキストなどが歪まないように、単一の全体スケール(拡大/縮小)のみtransformで処理
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = '50% 50%';"""

n1 = """      const scaleLevel = data.scaleLevel || 0;
      const multX = data.multX || 1;
      const multY = data.multY || 1;
      const scale = Math.pow(1.2, scaleLevel);
      
      el.style.setProperty('--area-mult-x', multX);
      el.style.setProperty('--area-mult-y', multY);

      // Position & Scale sync
      if (data.isAbsolute) {
        el.dataset.areaId = id; 
        if (el.parentElement !== field) {
          el.style.width = el.offsetWidth + 'px';
          el.style.height = el.offsetHeight + 'px';
          field.appendChild(el);
        }
        el.style.position = 'absolute';
        const isPlayType = (id.includes('play-area') || id.includes('main-play-area') || id.includes('board-play'));
        el.style.zIndex = isPlayType ? '100' : '200';
        
        if (data.x !== undefined) el.style.left = data.x + 'px';
        if (data.y !== undefined) el.style.top = data.y + 'px';
        
        if (data.width !== undefined) el.style.width = (data.width * multX) + 'px';
        if (data.height !== undefined) el.style.height = (data.height * multY) + 'px';
      } else {
        // グリッドアイテムとしての100%指定は親コンテナ基準になるブラウザ差異による肥大化を防ぐため、
        // JSで実測のピクセル幅（ベース）を計り、正確に倍率を掛けます。
        // （直後に ResizeObserver でレスポンシブにも対応させます）
        el.style.width = '';
        el.style.height = '';
        
        // 強制レイアウト同期になるため、少しだけ重いですがエリア数は少ないので許容範囲
        const baseW = el.offsetWidth;
        const baseH = el.offsetHeight;
        
        if (multX !== 1) el.style.width = (baseW * multX) + 'px';
        if (multY !== 1) el.style.height = (baseH * multY) + 'px';
        
        // .player-area要素等を示すクラスを付与しておく（ResizeObserver用）
        el.classList.add('auto-scale-area');
      }
      
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = '50% 50%';"""

# Need to inject the ResizeObserver at the end of the file or near init.
o2 = """function initFieldEvents() {"""
n2 = """
// 画面リサイズ時に、ピクセル固定されたグリッドエリアのサイズを再計算する
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const scalableAreas = document.querySelectorAll('.auto-scale-area');
        if(scalableAreas.length === 0) return;
        
        // 1. 全て一旦固定幅を解除し、元のグリッドサイズに戻す
        scalableAreas.forEach(el => {
            el.style.width = '';
            el.style.height = '';
        });
        
        // 2. ブラウザに一度レイアウトを確定させ、全要素のベースサイズを取得
        const dimensions = Array.from(scalableAreas).map(el => {
            return { w: el.offsetWidth, h: el.offsetHeight };
        });
        
        // 3. 全要素に改めて倍率計算後の幅をセットする（Layout Thrashing防止のため一括で）
        scalableAreas.forEach((el, i) => {
            const mx = parseFloat(el.style.getPropertyValue('--area-mult-x')) || 1;
            const my = parseFloat(el.style.getPropertyValue('--area-mult-y')) || 1;
            if (mx !== 1) el.style.width = (dimensions[i].w * mx) + 'px';
            if (my !== 1) el.style.height = (dimensions[i].h * my) + 'px';
        });
    }, 100);
});

function initFieldEvents() {"""

def replace_str(t, old, new):
    if old in t: return t.replace(old, new)
    if old.replace('\\n', '\\r\\n') in t: return t.replace(old.replace('\\n', '\\r\\n'), new.replace('\\n', '\\r\\n'))
    
    # 緩和された部分一致を探す
    lines_old = old.split('\\n')
    if len(lines_old) > 5:
        sub_old = '\\n'.join(lines_old[1:-2]) # 最初と最後を少し削る
        if sub_old in t:
            print("Found partial match! Could not fully replace, manual check needed.")
            return t
    print("Not found:\\n", old[:100])
    return t

t1 = replace_str(text, o1, n1)

t2 = replace_str(t1, o2, n2)

if t2 == text:
    print("No changes applied.")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t2)

print("Success")
