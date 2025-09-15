// /public/js/ads.interstitial.js
// シンプル版: ボタン押下時に毎回 PropellerAds を読み込むだけ

export function showRoomInterstitial() {
  try {
    const s = document.createElement('script');
    s.dataset.zone = '9874020';  // あなたの Zone ID
    s.src = 'https://groleegni.net/vignette.min.js';
    (document.body || document.documentElement).appendChild(s);
  } catch (e) {
    console.error('PropellerAds script insert failed:', e);
  }
}
