// scripts/inject-env.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1) 入力/出力ファイル
const OUT_DIR = "./dist";
const PAGES = ["./index.html", "./game.html", "./mypage.html"];

// 2) 置換マップ（Vercelの環境変数 → プレースホルダ）
const replMap = {
  "__NEXT_PUBLIC_FIREBASE_API_KEY__": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  "__NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN__": process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  "__NEXT_PUBLIC_FIREBASE_PROJECT_ID__": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  "__NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET__": process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  "__NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID__": process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  "__NEXT_PUBLIC_FIREBASE_APP_ID__": process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  "__NEXT_PUBLIC_APPCHECK_KEY__": process.env.NEXT_PUBLIC_APPCHECK_KEY || ""
};

// 3) 置換して dist へ出力（複数ページ対応）
mkdirSync(OUT_DIR, { recursive: true });
for (const src of PAGES) {
  let html = readFileSync(src, "utf8");   // 読み込み
  for (const [ph, val] of Object.entries(replMap)) {  // 置換
    const safe = String(val).replaceAll(/[$]/g, '$$$$');
    html = html.split(ph).join(safe);
  }
  const outPath = `${OUT_DIR}/${src.replace(/^.\//, "")}`; // 例: ./mypage.html → dist/mypage.html
  writeFileSync(outPath, html, "utf8");      // 出力
}

// 6) 追加の静的ファイルがあればここでコピー
// ads.txt を dist にコピー
copyFileSync("./ads.txt", `${OUT_DIR}/ads.txt`);
// privacy.html を dist にコピー
copyFileSync("./privacy.html", `${OUT_DIR}/privacy.html`);
// contact.html を dist にコピー
copyFileSync("./contact.html", `${OUT_DIR}/contact.html`);
// terms.html を dist にコピー
copyFileSync("./terms.html", `${OUT_DIR}/terms.html`);
copyFileSync("./about.html", `${OUT_DIR}/about.html`);
copyFileSync("./howto.html", `${OUT_DIR}/howto.html`);
copyFileSync("./news.html", `${OUT_DIR}/news.html`);
copyFileSync("./Geki-Mahjong.html", `${OUT_DIR}/Geki-Mahjong.html`);


// BoardGame.html を dist にコピー
//copyFileSync("./BoardGame.html", `${OUT_DIR}/BoardGame.html`);
// CardGame.html を dist にコピー
//copyFileSync("./CardGame.html", `${OUT_DIR}/CardGame.html`);


console.log("Injected env vars into dist/index.html");
