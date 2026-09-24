// scripts/header-auth.js
// BatriTable Header Auth Status Handler (Login / MyPage / Logout)
import { auth, onAuthStateChanged, signOut } from "./firebase.init.js";

let currentAuthState = undefined; // undefined: waiting, null: unauthenticated/anon, object: logged in
let isListening = false;

function updateHeaderUI(user) {
  const loginBtn = document.getElementById("header-login-btn");
  const userMenu = document.getElementById("header-user-menu");
  const logoutBtn = document.getElementById("header-logout-btn");

  if (!loginBtn && !userMenu) return;

  const isLoggedIn = !!(user && !user.isAnonymous);

  if (isLoggedIn) {
    if (loginBtn) loginBtn.style.display = "none";
    if (userMenu) userMenu.style.display = "inline-flex";
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (userMenu) userMenu.style.display = "none";
  }

  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        window.location.reload();
      } catch (err) {
        console.error("Sign out error:", err);
        alert("ログアウト処理中にエラーが発生しました。");
      }
    });
  }
}

export function initHeaderAuth() {
  if (!isListening) {
    isListening = true;
    onAuthStateChanged(auth, (user) => {
      currentAuthState = user;
      updateHeaderUI(user);
    });
  } else if (currentAuthState !== undefined) {
    updateHeaderUI(currentAuthState);
  }
}

// Fallback: If auth listener hasn't resolved within 1 second, display login button to prevent blank space
setTimeout(() => {
  if (currentAuthState === undefined) {
    const loginBtn = document.getElementById("header-login-btn");
    if (loginBtn && loginBtn.style.display === "none") {
      loginBtn.style.display = "inline-flex";
    }
  }
}, 1000);

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initHeaderAuth());
  } else {
    initHeaderAuth();
  }

  // Observe DOM for dynamically loaded partials (e.g. loadPartial)
  const observer = new MutationObserver(() => {
    if (document.getElementById("header-login-btn") || document.getElementById("header-user-menu")) {
      if (currentAuthState !== undefined) {
        updateHeaderUI(currentAuthState);
      }
    }
  });

  const rootEl = document.body || document.documentElement;
  if (rootEl) {
    observer.observe(rootEl, { childList: true, subtree: true });
  }
}
