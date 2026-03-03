// app.js (GLOBAL)
// ✅ 目標：全站共用（Auth persistence / auth gate / drawer / modal / tabbar / book badge）集中在這裡
// ✅ 不改功能、不改樣式：只把重複邏輯整理乾淨、確保每頁都能正常注入

import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

// 讓各頁共用同一個 instance（保持你原本行為）
window.auth = auth;
window.db = db;

/* =========================
   0) Helpers
========================= */
const LS_BOOK = "wis_currentBookId";
const LS_BOOK_NAME = "wis_currentBookName";

function pageName() {
  return location.pathname.split("/").pop() || "index.html";
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

/* =========================
   1) Firebase Auth Persistence
========================= */
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

/* =========================
   2) Wait auth restore
========================= */
window.waitForAuthReady = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  return await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user); // user 可能是 null，但「狀態已完成」
    });
  });
};

/* =========================
   3) Require auth (redirect)
========================= */
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

    // iOS 偶爾需要多一點時間
    setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(auth.currentUser);
    }, 1200);
  });

  if (!user) {
    const next = encodeURIComponent(location.href);
    location.replace(`index.html?next=${next}`);
    return null;
  }
  return user;
};

/* =========================
   4) Tabbar highlight + navigation
========================= */
function highlightTab() {
  const cur = pageName();
  document.querySelectorAll(".tabbar .tab").forEach((tab) => {
    const href = tab.getAttribute("href") || tab.dataset.href || "";
    const clean = href.split("?")[0].split("#")[0];
    const active = clean && (clean === cur || clean.endsWith(cur));
    tab.classList.toggle("active", !!active);
  });
}

function bindTabbarButtons() {
  document.addEventListener(
    "click",
    (e) => {
      const tab = e.target.closest(".tabbar .tab[data-href]");
      if (!tab) return;
      e.preventDefault();
      const href = tab.dataset.href;
      if (href) location.href = href;
    },
    true
  );
}

// ===== Haptic + micro-bounce + ripple (保持你原本效果) =====
window.hapticTap = function hapticTap() {
  if (navigator.vibrate) navigator.vibrate(10);
};

function bindTabbarEffects() {
  document.addEventListener(
    "click",
    (e) => {
      const tab = e.target.closest(".tabbar .tab");
      if (!tab) return;

      window.hapticTap?.();

      tab.classList.remove("tap-bounce");
      void tab.offsetWidth;
      tab.classList.add("tap-bounce");

      const r = tab.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      tab.style.setProperty("--rx", x + "px");
      tab.style.setProperty("--ry", y + "px");

      tab.classList.remove("ripple");
      void tab.offsetWidth;
      tab.classList.add("ripple");
    },
    true
  );
}

/* =========================
   5) Drawer (Global)
   - 注入 hamburger + drawer + backdrop
   - ✅ 塞進 .nav-left（跟著捲動，不浮動）
========================= */
const DRAWER_EXCLUDE = new Set([
  "index.html",
  "onboarding.html",
  "login.html",
  "edit.html",
  "waiting.html",
  "books.html",
  "categories.html",
]);

function shouldShowDrawer() {
  return !DRAWER_EXCLUDE.has(pageName());
}

function injectDrawer() {
  if (!shouldShowDrawer()) return;
  if (document.getElementById("menuBtn")) return;

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="hamburger" type="button" id="menuBtn" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop drawer-overlay";
  backdrop.id = "drawerBackdrop";
  backdrop.hidden = true;

  const drawer = document.createElement("aside");
  drawer.className = "drawer drawer-panel";
  drawer.id = "drawer";
  drawer.setAttribute("aria-hidden", "true");

  const ref = encodeURIComponent(pageName() || "month.html");
  drawer.innerHTML = `
    <div class="drawer-inner">
      <div class="drawer-title">功能</div>

      <button class="drawer-item danger" type="button" id="logoutBtn">登出</button>

      <a class="drawer-link" href="books.html?ref=${ref}">
        <div class="drawer-item">切換帳本</div>
      </a>
      <a class="drawer-link" href="categories.html?ref=${ref}">
        <div class="drawer-item">分類設定</div>
      </a>
    </div>
  `;

  // ✅ 放進 header 左側（如果頁面有 .nav-left）
  const leftSlot = document.querySelector(".nav .nav-left") || document.querySelector(".nav-left");
  if (leftSlot) leftSlot.appendChild(topbar);
  else document.body.appendChild(topbar);

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const menuBtn = document.getElementById("menuBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // 初始狀態關閉
  drawer.classList.remove("open");
  backdrop.hidden = true;
  drawer.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");

  const openDrawer = () => {
    drawer.classList.add("open");
    backdrop.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    drawer.classList.remove("open");
    backdrop.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  const toggleDrawer = () => {
    if (drawer.classList.contains("open")) closeDrawer();
    else openDrawer();
  };

  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDrawer();
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

/* =========================
   6) Themed Modal (ui.alert/confirm/prompt)
========================= */
function injectThemedModal() {
  if (window.ui) return;

  const backdrop = document.createElement("div");
  backdrop.className = "ui-modal-backdrop";
  backdrop.innerHTML = `
    <div class="ui-modal" role="dialog" aria-modal="true" aria-live="polite">
      <div class="ui-modal-head">
        <h3 class="ui-modal-title" id="uiTitle"></h3>
        <p class="ui-modal-msg" id="uiMsg"></p>
      </div>
      <div class="ui-modal-body" id="uiBody" style="display:none;"></div>
      <div class="ui-modal-actions" id="uiActions"></div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const $ = (id) => backdrop.querySelector("#" + id);

  const open = () => {
    backdrop.classList.add("show");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    backdrop.classList.remove("show");
    document.body.style.overflow = "";
  };

  function render({ title, message, input, buttons }) {
    $("uiTitle").textContent = title || "";
    $("uiMsg").textContent = message || "";

    const body = $("uiBody");
    const actions = $("uiActions");
    actions.innerHTML = "";
    body.innerHTML = "";
    body.style.display = "none";

    let inputEl = null;
    if (input) {
      body.style.display = "block";
      inputEl = document.createElement("input");
      inputEl.className = "ui-modal-input";
      inputEl.type = input.type || "text";
      inputEl.placeholder = input.placeholder || "";
      inputEl.value = input.value || "";
      body.appendChild(inputEl);
      setTimeout(() => inputEl.focus(), 50);
    }

    return new Promise((resolve) => {
      buttons.forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ui-btn" + (b.variant ? " " + b.variant : "");
        btn.textContent = b.text;
        btn.addEventListener("click", () => {
          const val = inputEl ? inputEl.value : null;
          close();
          resolve(b.onClick ? b.onClick(val) : b.value);
        });
        actions.appendChild(btn);
      });

      open();
    });
  }

  window.ui = {
    alert(message, opts = {}) {
      return render({
        title: opts.title || "提示",
        message,
        buttons: [{ text: opts.okText || "知道了", variant: "primary", value: true }],
      });
    },
    confirm(message, opts = {}) {
      return render({
        title: opts.title || "確認",
        message,
        buttons: [
          { text: opts.cancelText || "取消", value: false },
          { text: opts.okText || "確定", variant: opts.danger ? "danger" : "primary", value: true },
        ],
      });
    },
    prompt(message, opts = {}) {
      return render({
        title: opts.title || "請輸入",
        message,
        input: {
          value: opts.defaultValue || "",
          placeholder: opts.placeholder || "",
          type: "text",
        },
        buttons: [
          { text: opts.cancelText || "取消", value: null },
          { text: opts.okText || "確定", variant: "primary", onClick: (val) => (val ?? "").trim() },
        ],
      });
    },
  };
}

/* =========================
   7) Button feedback helper (global)
========================= */
window.withButtonFeedback = async function withButtonFeedback(btn, task, opts = {}) {
  if (!btn) return task();

  const {
    loadingText = "儲存中…",
    successText = "已儲存 ✓",
    successHoldMs = 800,
    minShowMs = 0,
    onError,
  } = opts;

  const prevText = btn.textContent;
  const startTs = Date.now();

  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = loadingText;

  try {
    const result = await task();

    const elapsed = Date.now() - startTs;
    if (minShowMs > elapsed) await new Promise((r) => setTimeout(r, minShowMs - elapsed));

    btn.classList.remove("loading");
    btn.classList.add("success");
    btn.textContent = successText;

    setTimeout(() => {
      btn.classList.remove("success");
      btn.textContent = prevText;
      btn.disabled = false;
    }, successHoldMs);

    return result;
  } catch (e) {
    btn.classList.remove("loading", "success");
    btn.textContent = prevText;
    btn.disabled = false;
    if (typeof onError === "function") onError(e);
    throw e;
  }
};

/* =========================
   8) Current Book Badge (Global)
   - ✅ 優先使用頁面 header 裡的 #bookBadge（如果存在）
   - ✅ 否則才注入到 body（但你之後會統一用 header，所以基本不會走到注入）
========================= */
const BOOK_BADGE_EXCLUDE = new Set([
  "index.html",
  "login.html",
  "onboarding.html",
  "waiting.html",
]);

function shouldShowBookBadge() {
  return !BOOK_BADGE_EXCLUDE.has(pageName());
}

function ensureBookBadgeElement() {
  if (!shouldShowBookBadge()) return null;

  // ✅ 如果頁面自己已經有 <div id="bookBadge">（放在 .nav-right），就直接用
  const existing = document.getElementById("bookBadge");
  if (existing) return existing;

  // fallback：若某頁還沒改成 header 結構，才注入
  const el = document.createElement("div");
  el.id = "bookBadge";
  el.className = "book-badge";
  el.textContent = localStorage.getItem(LS_BOOK_NAME) || "";
  el.style.display = el.textContent ? "block" : "none";
  document.body.appendChild(el);
  return el;
}

async function updateBookBadge() {
  if (!shouldShowBookBadge()) return;

  const el = ensureBookBadgeElement();
  if (!el) return;

  const user = await window.waitForAuthReady();
  if (!user) {
    el.style.display = "none";
    return;
  }

  const bookId = localStorage.getItem(LS_BOOK);
  if (!bookId) {
    el.style.display = "none";
    return;
  }

  try {
    const ref = doc(window.db, "users", user.uid, "books", bookId);
    const snap = await getDoc(ref);
    const name = snap.exists() ? (snap.data()?.name || "未命名帳本") : "未命名帳本";

    el.textContent = name;
    el.style.display = "block";
    localStorage.setItem(LS_BOOK_NAME, name);
  } catch (e) {
    console.error("updateBookBadge failed:", e);
    const cached = localStorage.getItem(LS_BOOK_NAME);
    if (cached) {
      el.textContent = cached;
      el.style.display = "block";
    }
  }
}

/* =========================
   9) Boot
========================= */
function boot() {
  highlightTab();
  bindTabbarButtons();
  bindTabbarEffects();

  injectThemedModal();
  injectDrawer();
  updateBookBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}