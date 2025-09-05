// scripts/inject-env.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1) 入力/出力ファイル
const OUT_DIR = "./dist";
// 置換対象：HTML（従来どおり）
const PAGES = ["./index.html", "./game.html", "./mypage.html"];
// 置換対象：JS/ESM（必要に応じて追加）
// 例: game.html から外出しした module スクリプトをここに追加
const JS_MODULES = [
  "./scripts/game.module.js",   // 本体
  "./scripts/hp.js",            // プレイヤーHPモジュール
  "./scripts/room.module.js",   // ルーム関連処理モジュール  
  "./scripts/card-geometry.js",   // カード関連処理モジュール  
  "./scripts/card-storage.js",   // カード関連処理モジュール  
  "./scripts/card-utils.js",   // カード関連処理モジュール    
  "./scripts/save-load.module.js",   // セーブ関連処理モジュール    
  // "./scripts/他にも置換したい.mjs",
];

// 丸ごとコピーするディレクトリ（public 廃止）
// ※ ここに列挙されたものだけ dist に展開されます
const DIRS = [
  { src: "./assets",   dest: "assets"   },
  { src: "./partials", dest: "partials" },
  { src: "./scripts",  dest: "scripts"  }, // polyfills.js / 分割JS も配布
];


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

// 3) 置換して dist へ出力（HTML と JS を別々に処理）
mkdirSync(OUT_DIR, { recursive: true });
for (const src of PAGES) {
  let html = readFileSync(src, "utf8");   // 読み込み
  for (const [ph, val] of Object.entries(replMap)) {  // 置換
    const safe = String(val).replaceAll(/[$]/g, '$$$$');
    html = html.split(ph).join(safe);
  }
  const outPath = `${OUT_DIR}/${src.replace(/^.\//, "")}`; // 例: ./mypage.html → dist/mypage.html
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");      // 出力
}

// 3.5) JS/ESM の置換（必要なときだけ。無ければ空配列でOK）
for (const src of JS_MODULES) {
  if (!existsSync(src)) continue;
  let code = readFileSync(src, "utf8");
  for (const [ph, val] of Object.entries(replMap)) {
    const safe = String(val).replaceAll(/[$]/g, '$$$$');
    code = code.split(ph).join(safe);
  }
  const outPath = `${OUT_DIR}/${src.replace(/^.\//, "")}`; // 例: ./scripts/game.module.js → dist/scripts/game.module.js
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, code, "utf8");
}


// 4) ディレクトリをそのままコピー（Node 18+ の fs.cp を使用）
// 同じ dest への重複コピーは気にせず上書きOK
for (const { src, dest } of DIRS) {
  if (existsSync(src)) {
    cpSync(src, `${OUT_DIR}/${dest}`, { recursive: true });
  }
}

// 5) 追加の静的ファイルがあればここでコピー
// ads.txt を dist にコピー
copyFileSync("./ads.txt", `${OUT_DIR}/ads.txt`);
// robots / sitemap（あれば）を dist にコピー
try { copyFileSync("./robots.txt", `${OUT_DIR}/robots.txt`); } catch {}
try { copyFileSync("./sitemap.xml", `${OUT_DIR}/sitemap.xml`); } catch {}

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

// 6) ルート直下の画像・アイコン類を dist へコピー（存在するものだけ）
for (const f of [
  "./PlayAround-icon.png",
  "./field-card-pic.png",
  "./field-board-pic.png",
  "./favicon.ico",
  "./favicon-32.png",
  "./favicon-16.png",
  "./apple-touch-icon.png"
]) {
  try { copyFileSync(f, `${OUT_DIR}/${f.replace(/^.\//, "")}`); } catch {}
}



// BoardGame.html を dist にコピー
//copyFileSync("./BoardGame.html", `${OUT_DIR}/BoardGame.html`);
// CardGame.html を dist にコピー
//copyFileSync("./CardGame.html", `${OUT_DIR}/CardGame.html`);


console.log("Build done: env injected, assets/ & partials/ & scripts/ copied to dist/");

