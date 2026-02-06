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
   3️⃣ 登入保護（取代你原本的 currentUser 判斷）
---------------------------- */
window.requireAuth = async () => {
  // 1) 先等 persistence 設好
  if (window.firebaseReady) await window.firebaseReady;

  // 2) 等待狀態還原（多給 iOS 一點時間）
  const user = await new Promise((resolve) => {
    let done = false;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (done) return;
      done = true;
      unsub();
      resolve(u);
    });

    // iOS 偶爾需要多一點時間，避免還原前就被導走
    setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(auth.currentUser); // 可能仍是 null，但至少不會「秒踢走」
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
   4️⃣ UI（跟 Auth 無關）
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
// Global Drawer UI (exclude pages)
// ================================
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 你可以在這裡調整哪些頁面不要顯示（登入/歡迎頁不用）
const DRAWER_EXCLUDE = new Set([
  "index.html",
  "onboarding.html",
  "login.html",     // 如果你有
]);

function currentPageName(){
  const p = location.pathname.split("/").pop() || "";
  // Netlify 有時 root 可能是 "/"，你可視情況改成 index.html
  return p || "index.html";
}

function shouldShowDrawer(){
  const page = currentPageName();
  return !DRAWER_EXCLUDE.has(page);
}

function injectDrawer(){
  if (!shouldShowDrawer()) return;
  if (document.getElementById("menuBtn")) return; // 避免重複注入

  // topbar (left hamburger)
  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="hamburger" type="button" id="menuBtn" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  `;

  // backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop drawer-overlay"; // ✅ 加這個
  backdrop.id = "drawerBackdrop";
  backdrop.hidden = true;

  // drawer
  const drawer = document.createElement("aside");
  drawer.className = "drawer drawer-panel"; // ✅ 加這個
  drawer.id = "drawer";
  drawer.setAttribute("aria-hidden","true");

  // ✅ 你可以在這裡放「其他功能欄位」
  drawer.innerHTML = `
    <div class="drawer-inner">
      <div class="drawer-title">功能</div>

      <!-- 登出一定放最上面 -->
      <button class="drawer-item danger" type="button" id="logoutBtn">登出</button>

      <a class="drawer-link" href="month.html"><div class="drawer-item">本月</div></a>
      <a class="drawer-link" href="add.html"><div class="drawer-item">新增</div></a>
      <a class="drawer-link" href="year.html"><div class="drawer-item">統計</div></a>

      <!-- 你想加的頁面 -->
      <!-- <a class="drawer-link" href="settings.html"><div class="drawer-item">設定</div></a> -->
    </div>
  `;

  document.body.appendChild(topbar);
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const menuBtn = document.getElementById("menuBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // ✅ 保證初始狀態是「關閉」
  drawer.classList.remove("open");
  backdrop.hidden = true;
  drawer.setAttribute("aria-hidden","true");
  menuBtn.setAttribute("aria-expanded","false");

  // ✅ 核心修正：定義關閉函式並在啟動時立即執行一次，確保初始狀態被鎖定
  function closeDrawer(){
    drawer.classList.remove("open");
    backdrop.hidden = true;
    drawer.setAttribute("aria-hidden","true");
    menuBtn.setAttribute("aria-expanded","false");
    document.body.style.overflow = ""; // ✅ 還原
  }

  function openDrawer(){
    drawer.classList.add("open");
    backdrop.hidden = false;
    drawer.setAttribute("aria-hidden","false");
    menuBtn.setAttribute("aria-expanded","true");
    document.body.style.overflow = "hidden"; // ✅ 避免背景可滾
  }

  // ✅ 修正初始狀態（防止自動彈出）
  closeDrawer();

  function toggleDrawer(){
    if (drawer.classList.contains("open")) closeDrawer();
    else openDrawer();
  }

  // ✅ 漢堡按鈕：切換開/關
  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDrawer();
  });

  // ✅ 點空白處：關閉
  backdrop.addEventListener("click", (e) => {
    e.preventDefault();
    closeDrawer();
  });

  // ✅ ESC：關閉（桌機測試用）
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // ✅ 登出：Firebase signOut → 回登入頁（保留你的原邏輯）
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(window.auth);
    } catch (e) {
      console.error("signOut failed:", e);
    }
    closeDrawer();
    location.replace("index.html");
  });

  // ✅ 點選 drawer 裡連結後自動關閉（保留）
  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeDrawer();
  });
}

// 等 DOM 好了再注入
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDrawer);
} else {
  injectDrawer();
}