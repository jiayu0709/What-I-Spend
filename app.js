import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";

// 掛到 window，確保所有模組共用同一個 instance
window.auth = auth;
window.db = db;

/* ---------------------------
   1️⃣ Firebase Auth 初始化
---------------------------- */
function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  // PWA 模式下 UserAgent 可能不含 Safari 字樣，但只要是 iOS 且是 Standalone 就必須用 LocalPersistence
  const isStandalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && (isSafari || isStandalone);
}

window.firebaseReady = (async () => {
  try {
    // 在 iOS 或 PWA 模式下，IndexedDB 穩定性較差且不共享，強制使用 localStorage
    if (isIOSSafari()) {
      await setPersistence(auth, browserLocalPersistence);
      console.log("Auth persistence = localStorage (iOS/PWA Optimized)");
      return;
    }
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log("Auth persistence = indexedDB");
  } catch (e) {
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log("Auth persistence = localStorage (Fallback)");
    } catch {
      await setPersistence(auth, browserSessionPersistence);
      console.log("Auth persistence = session");
    }
  }
})();

/* ---------------------------
   2️⃣ 等待 Auth 狀態還原完成
---------------------------- */
window.waitForAuthReady = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  return await new Promise((resolve) => {
    const start = Date.now();
    const MAX_WAIT = 12000; // iOS PWA 建議拉長

    const unsub = onAuthStateChanged(auth, (user) => {
      // ✅ 一旦拿到 user 就結案
      if (user) {
        unsub();
        resolve(user);
        return;
      }

      // ✅ 還沒拿到 user：不要立刻 unsub
      // 直到超過 MAX_WAIT 才結案回傳 null
      if (Date.now() - start > MAX_WAIT) {
        unsub();
        resolve(null);
      }
    });
  });
};

/* ---------------------------
   3️⃣ 登入保護
---------------------------- */
window.requireAuth = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  // 等待狀態還原
  const user = await window.waitForAuthReady();

  if (!user) {
    // 如果沒登入，導向登入頁並帶上當前路徑以便登入後跳回
    const next = encodeURIComponent(window.location.href);
    // 建議將 index.html 改為 login.html，或確保 index.html 會正確處理
    window.location.replace(`login.html?next=${next}`);
    return null;
  }
  return user;
};

/* ---------------------------
   4️⃣ UI 邏輯
---------------------------- */
function highlightTab() {
  const currentPath = window.location.pathname.split("/").pop() || "month.html";
  document.querySelectorAll(".tabbar .tab").forEach((tab) => {
    const href = tab.getAttribute("href");
    if (!href) return;
    const cleanHref = href.split("?")[0].split("#")[0];
    if (currentPath === cleanHref || cleanHref.endsWith(currentPath)) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", highlightTab);

// ================================
// Global Drawer UI
// ================================
const DRAWER_EXCLUDE = new Set([
  "index.html",
  "onboarding.html",
  "login.html",
]);

function currentPageName(){
  return location.pathname.split("/").pop() || "index.html";
}

function shouldShowDrawer(){
  const page = currentPageName();
  return !DRAWER_EXCLUDE.has(page);
}

function injectDrawer(){
  if (!shouldShowDrawer()) return;
  if (document.getElementById("menuBtn")) return;

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="hamburger" type="button" id="menuBtn" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.id = "drawerBackdrop";
  backdrop.hidden = true;

  const drawer = document.createElement("aside");
  drawer.className = "drawer";
  drawer.id = "drawer";
  drawer.setAttribute("aria-hidden","true");
  drawer.innerHTML = `
    <div class="drawer-inner">
      <div class="drawer-title">功能</div>
      <button class="drawer-item danger" type="button" id="logoutBtn">登出</button>
      <a class="drawer-link" href="month.html"><div class="drawer-item">本月</div></a>
      <a class="drawer-link" href="add.html"><div class="drawer-item">新增</div></a>
      <a class="drawer-link" href="year.html"><div class="drawer-item">統計</div></a>
    </div>
  `;

  document.body.appendChild(topbar);
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const menuBtn = document.getElementById("menuBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const closeDrawer = () => {
    drawer.classList.remove("open");
    backdrop.hidden = true;
    drawer.setAttribute("aria-hidden","true");
  };

  menuBtn.addEventListener("click", () => {
    drawer.classList.toggle("open");
    backdrop.hidden = !drawer.classList.contains("open");
  });

  backdrop.addEventListener("click", closeDrawer);

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      location.replace("login.html");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  });

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeDrawer();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDrawer);
} else {
  injectDrawer();
}