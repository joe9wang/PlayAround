import os

path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'rb') as f:
    data = f.read()

# Try to find exactly where the valid UTF-8 ends. Add-Content adds a BOM (FF FE) or just starts dumping UTF-16LE.
try:
    decoded = data.decode('utf-8')
    # If this miraculously succeeds, we just write it back
    print("Decoded as utf-8 magically.")
    text = decoded
except UnicodeDecodeError as e:
    print(f"Failed at {e.start}. Slicing there.")
    valid_data = data[:e.start]
    text = valid_data.decode('utf-8', errors='ignore')

# We now have the base UTF-8 text. Let's append the correct ResizeObserver code in UTF-8.
suffix = """
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
"""

# ensure the text ends cleanly
if "function initFieldEvents()" in text:
   # Wait, I don't need to do anything since the previous script replaced `initFieldEvents()` with the newly appended code!
   # Actually the previous script failed with `No changes applied`!
   pass
else:
   text += suffix

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Recovered file.")
