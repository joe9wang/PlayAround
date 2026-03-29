import sys
path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

o1 = """      // Position & Scale sync
      if (data.isAbsolute) {
        el.dataset.areaId = id; 
        if (el.parentElement !== field) {
          el.style.width = el.offsetWidth + 'px';
          el.style.height = el.offsetHeight + 'px';
          field.appendChild(el);
        }
        el.style.position = 'absolute';
        // z-index を動的に設定（100: プレイエリア系 / 200: サブエリア系）。カード(300〜)より背面を維持。
        const isPlayType = (id.includes('play-area') || id.includes('main-play-area') || id.includes('board-play'));
        el.style.zIndex = isPlayType ? '100' : '200';
        if (data.x !== undefined) el.style.left = data.x + 'px';
        if (data.y !== undefined) el.style.top = data.y + 'px';
        if (data.width !== undefined) el.style.width = data.width + 'px';
        if (data.height !== undefined) el.style.height = data.height + 'px';
      }
      
      const scaleLevel = data.scaleLevel || 0;
      const multX = data.multX || 1;
      const multY = data.multY || 1;
      const scale = Math.pow(1.2, scaleLevel);
      el.style.transform = `scale(${scale * multX}, ${scale * multY})`;
      el.style.transformOrigin = '50% 50%';"""

n1 = """      const scaleLevel = data.scaleLevel || 0;
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
        // z-index を動的に設定（100: プレイエリア系 / 200: サブエリア系）。カード(300〜)より背面を維持。
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

def replace_str(t, old, new):
    if old in t: return t.replace(old, new)
    if old.replace('\\n', '\\r\\n') in t: return t.replace(old.replace('\\n', '\\r\\n'), new.replace('\\n', '\\r\\n'))
    print("Not found:\\n", old[:100])
    return t

t1 = replace_str(text, o1, n1)

if t1 == text:
    print("No changes applied.")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t1)

print("Success")
