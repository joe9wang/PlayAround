// card-utils.js
// カード周辺の“純粋ユーティリティ”群（依存薄め）

// === 小さなズレ（重なり回避） ===
export function tinyOffset(i){ return (i % 7) * 6; } // 元実装と同一

// === 配列シャッフル ===
export function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// === SVGダイス画像（72x72） ===
export function svgDiceDataUrl(n){
  const size = 72, r = 8, pipR = 6;
  const pip = (cx, cy)=>`<circle cx="${cx}" cy="${cy}" r="${pipR}" fill="#111"/>`;
  const g = [size*0.22, size*0.5, size*0.78];
  const patterns = {
    1: [[1,1]],
    2: [[0,0],[2,2]],
    3: [[0,0],[1,1],[2,2]],
    4: [[0,0],[0,2],[2,0],[2,2]],
    5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
    6: [[0,0],[1,0],[2,0],[0,2],[1,2],[2,2]],
  };
  const pips = (patterns[n]||[]).map(([i,j]) => pip(g[i], g[j])).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect x="1" y="1" width="${size-2}" height="${size-2}" rx="${r}" ry="${r}" fill="#fff" stroke="#111" stroke-width="2"/>
      ${pips}
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
