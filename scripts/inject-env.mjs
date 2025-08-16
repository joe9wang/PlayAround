// scripts/inject-env.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1) 入力/出力ファイル
const SRC = "./index.html";   // ← リポジトリ直下に index.html がある前提
const OUT_DIR = "./dist";
const OUT = `${OUT_DIR}/index.html`;

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

// 3) 読み込み
let html = readFileSync(SRC, "utf8");

// 4) 置換
for (const [ph, val] of Object.entries(replMap)) {
  const safe = String(val).replaceAll(/[$]/g, '$$$$'); // $ をエスケープ
  html = html.split(ph).join(safe);
}

// 5) 出力
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, "utf8");

// 6) 追加の静的ファイルがあればここでコピー
// ads.txt を dist にコピー
copyFileSync("./ads.txt", `${OUT_DIR}/ads.txt`);
// privacy.html を dist にコピー
copyFileSync("./privacy.html", `${OUT_DIR}/privacy.html`);
// contact.html を dist にコピー
copyFileSync("./contact.html", `${OUT_DIR}/contact.html`);
// terms.html を dist にコピー
copyFileSync("./terms.html", `${OUT_DIR}/terms.html`);

// BoardGame.html を dist にコピー
//copyFileSync("./BoardGame.html", `${OUT_DIR}/BoardGame.html`);
// CardGame.html を dist にコピー
//copyFileSync("./CardGame.html", `${OUT_DIR}/CardGame.html`);


console.log("Injected env vars into dist/index.html");
