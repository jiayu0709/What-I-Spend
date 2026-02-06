import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
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
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

window.firebaseReady = (async () => {
  try {
    if (isIOSSafari()) {
      await setPersistence(auth, browserLocalPersistence);
      console.log("Auth persistence = localStorage (iOS Safari)");
      return;
    }
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log("Auth persistence = indexedDB");
  } catch (e) {
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log("Auth persistence = localStorage");
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
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user); // user 可能是 null，但「狀態已完成」
    });
  });
};

/* ---------------------------
   3️⃣ 登入保護
---------------------------- */
window.requireAuth = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  const user = await new Promise((resolve) => {
    let done = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (done) return;
      done = true;
      unsub();
      resolve(u);
    });

    setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(auth.currentUser);
    }, 1200);
  });

  if (!user) {
    const next = encodeURIComponent(window.location.href);
    window.location.replace(`index.html?next=${next}`);
    return null;
  }
  return user;
};

/* ---------------------------
   4️⃣ UI 標籤高亮
---------------------------- */
function highlightTab() {
  const currentPath =
    window.location.pathname.split("/").pop() || "month.html";

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
// Global Drawer UI (修正自動彈出問題)
// ================================
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const DRAWER_EXCLUDE = new Set([
  "index.html",
  "onboarding.html",
  "login.html",
  "a2hs.html"
]);

function currentPageName(){
  const p = location.pathname.split("/").pop() || "";
  return p || "index.html";
}

function shouldShowDrawer(){
  const page = currentPageName();
  return !DRAWER_EXCLUDE.has(page);
}

function injectDrawer(){
  if (!shouldShowDrawer()) return;
  if (document.getElementById("menuBtn")) return; 

  // 1. Topbar
  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="hamburger" type="button" id="menuBtn" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  `;

  // 2. Backdrop (強制預設隱藏且不可見)
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop drawer-overlay";
  backdrop.id = "drawerBackdrop";
  backdrop.style.visibility = "hidden"; // 額外保護
  backdrop.hidden = true;

  // 3. Drawer (強制預設不在畫面上)
  const drawer = document.createElement("aside");
  drawer.className = "drawer drawer-panel";
  drawer.id = "drawer";
  drawer.setAttribute("aria-hidden","true");
  // 強制覆寫可能存在的 CSS 預設值，確保啟動時在畫面外
  drawer.style.transform = "translateX(-105%)";

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

  // 初始化狀態鎖定
  const closeDrawer = () => {
    drawer.classList.remove("open");
    drawer.style.transform = "translateX(-105%)";
    backdrop.hidden = true;
    backdrop.style.visibility = "hidden";
    drawer.setAttribute("aria-hidden","true");
    menuBtn.setAttribute("aria-expanded","false");
    document.body.style.overflow = "";
  };

  const openDrawer = () => {
    drawer.classList.add("open");
    drawer.style.transform = "translateX(0)";
    backdrop.hidden = false;
    backdrop.style.visibility = "visible";
    drawer.setAttribute("aria-hidden","false");
    menuBtn.setAttribute("aria-expanded","true");
    document.body.style.overflow = "hidden"; 
  };

  // 立即執行一次關閉邏輯，確保注入後狀態正確
  requestAnimationFrame(() => {
    closeDrawer();
  });

  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (drawer.classList.contains("open")) closeDrawer();
    else openDrawer();
  });

  backdrop.addEventListener("click", (e) => {
    e.preventDefault();
    closeDrawer();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(window.auth);
    } catch (e) {
      console.error("signOut failed:", e);
    }
    closeDrawer();
    location.replace("index.html");
  });

  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeDrawer();
  });
}

// 啟動注入
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDrawer);
} else {
  injectDrawer();
}