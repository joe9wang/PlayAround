// scripts/inject-env.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = "./dist";
const PAGES = ["./index.html", "./game.html", "./mypage.html", "./login.html", "./plans.html"];
const JS_MODULES = [
  "./scripts/game.module.js",
  "./scripts/firebase.init.js",
  "./scripts/state.js",
  "./scripts/i18n.js",
  "./scripts/hp.js",
  "./scripts/room.module.js",
];

const DIRS = [
  { src: "./assets", dest: "assets" },
  { src: "./partials", dest: "partials" },
  { src: "./scripts", dest: "scripts" },
  { src: "./TrumpPicture", dest: "TrumpPicture" },
];

const staticFiles = [
  "./ads.txt", "./robots.txt", "./sitemap.xml", "./privacy.html", 
  "./contact.html", "./terms.html", "./law.html", "./about.html", 
  "./howto.html", "./Geki-Mahjong.html",
  "./BatriTable-icon.png", "./PlayExample.png", "./favicon.ico",
  "./favicon-32.png", "./favicon-16.png", "./favicon-192.png",
  "./favicon-512.png", "./sw.js", "./site.webmanifest"
];

const replMap = {
  "__NEXT_PUBLIC_FIREBASE_API_KEY__": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  "__NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN__": process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  "__NEXT_PUBLIC_FIREBASE_PROJECT_ID__": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  "__NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET__": process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  "__NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID__": process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  "__NEXT_PUBLIC_FIREBASE_APP_ID__": process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  "__NEXT_PUBLIC_APPCHECK_KEY__": process.env.NEXT_PUBLIC_APPCHECK_KEY || ""
};

function copyRecursiveSync(src, dest) {
  if (!existsSync(src)) return;
  const stats = statSync(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    readdirSync(src).forEach((child) => {
      copyRecursiveSync(join(src, child), join(dest, child));
    });
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

try {
  // 1. Ensure dist exists
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // 1.5. Copy directories
  for (const { src, dest } of DIRS) {
    console.log(`Copying directory: ${src} -> ${join(OUT_DIR, dest)}`);
    copyRecursiveSync(src, join(OUT_DIR, dest));
  }

  // 2. Inject and overwrite files in dist
  for (const src of PAGES) {
    if (!existsSync(src)) continue;
    console.log(`Injecting env to page: ${src}`);
    let content = readFileSync(src, "utf8");
    for (const [ph, val] of Object.entries(replMap)) {
      const safe = String(val).replaceAll(/[$]/g, '$$$$');
      content = content.split(ph).join(safe);
    }
    const outPath = join(OUT_DIR, src.replace(/^\.\//, ""));
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, "utf8");
  }

  for (const src of JS_MODULES) {
    if (!existsSync(src)) continue;
    console.log(`Injecting env to module: ${src}`);
    let content = readFileSync(src, "utf8");
    for (const [ph, val] of Object.entries(replMap)) {
      const safe = String(val).replaceAll(/[$]/g, '$$$$');
      content = content.split(ph).join(safe);
    }
    const outPath = join(OUT_DIR, src.replace(/^\.\//, ""));
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, "utf8");
  }

  // 3. Copy specific static files directly to dist
  for (const f of staticFiles) {
    if (existsSync(f)) {
      console.log(`Copying static file: ${f}`);
      copyFileSync(f, join(OUT_DIR, f.replace(/^\.\//, "")));
    }
  }

  console.log("Injection successful!");
} catch (err) {
  console.error("INJECTION FATAL ERROR:");
  console.error(err);
  process.exit(1);
}
