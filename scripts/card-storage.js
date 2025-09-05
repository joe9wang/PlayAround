// card-storage.js
// Storage / 画像変換まわり（Firebase Storage 依存は注入）

let _getStorage = null; // () => storage
export function initCardStorage(getStorage){ _getStorage = getStorage; }

// Storage の安全なダウンロードURL取得（失敗時は null）
export async function storageDownloadURL(path) {
  const storage = _getStorage();
  try {
    const { getDownloadURL, ref } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js");
    return await getDownloadURL(ref(storage, path));
  } catch (e) {
    console.warn('[Storage] getDownloadURL failed:', path, e.code || e.message);
    return null;
  }
}

// 画像 → サムネ/フル の dataURL 生成（元ロジック準拠）
export async function fileToThumbAndFull(file){
  const bmp  = await createImageBitmap(file);
  const tw   = 256; // 既存のサムネ幅（必要なら調整）
  const th   = Math.round((bmp.height / bmp.width) * tw);
  const canvas = new OffscreenCanvas(tw, th);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(bmp, 0, 0, tw, th);

  // ✅ いつでも「data:」URLを返す
  let thumbDataUrl;
  if (canvas.convertToBlob) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    thumbDataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => res(fr.result);     // ← data:image/jpeg;base64,....
      fr.readAsDataURL(blob);
    });
  } else {
    thumbDataUrl = canvas.toDataURL('image/jpeg', 0.6);
  }

  const fullDataUrl = await new Promise((res, rej)=>{
    const fr = new FileReader(); fr.onerror = rej; fr.onload = ()=>res(fr.result); fr.readAsDataURL(file);
  });
  try { bmp.close?.(); } catch(_){}
  return { thumbDataUrl, fullDataUrl };
}
