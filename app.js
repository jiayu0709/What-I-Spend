import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

// 讓各頁共用同一個 instance
window.auth = auth;
window.db = db;

/* =========================
   0) Global constants
========================= */
const LS_BOOK = "wis_currentBookId";
const LS_BOOK_NAME = "wis_currentBookName";

const DEFAULT_CATEGORIES = {
  expense: ["餐飲🥣","飲料🥤","交通🛵","日用🛍️","娛樂🎮","醫療🏥","治裝👗","家用🏠","旅遊🧳","其他🧶"],
  income: ["薪資💼","獎金🎁","兼職🧑‍💻","投資📈","退款💵","其他🧶"],
};

window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;

function pageName() {
  return location.pathname.split("/").pop() || "index.html";
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

function hasValidCategories(categories) {
  return !!(
    categories &&
    Array.isArray(categories.expense) &&
    categories.expense.length &&
    Array.isArray(categories.income) &&
    categories.income.length
  );
}

/* =========================
   1) Ensure default book + categories
========================= */
window.ensureDefaultBookAndCategories = async function (uid) {
  const existingBookId = localStorage.getItem(LS_BOOK);

  // 1. localStorage 已有目前帳本：先檢查這本是否存在、分類是否完整
  if (existingBookId) {
    const bookRef = doc(db, "users", uid, "books", existingBookId);
    const snap = await getDoc(bookRef);

    if (snap.exists()) {
      const data = snap.data() || {};

      if (!hasValidCategories(data.categories)) {
        await updateDoc(bookRef, { categories: DEFAULT_CATEGORIES });
      }

      localStorage.setItem(LS_BOOK_NAME, data.name || "生活");
      return existingBookId;
    }

    // localStorage 指到不存在的帳本就清掉
    localStorage.removeItem(LS_BOOK);
    localStorage.removeItem(LS_BOOK_NAME);
  }

  // 2. 先找現有第一本未封存帳本
  const booksRef = collection(db, "users", uid, "books");
  const q1 = query(booksRef, where("archived", "==", false), orderBy("createdAt", "asc"), limit(1));
  const firstSnap = await getDocs(q1);

  if (!firstSnap.empty) {
    const firstDoc = firstSnap.docs[0];
    const firstId = firstDoc.id;
    const firstData = firstDoc.data() || {};

    localStorage.setItem(LS_BOOK, firstId);
    localStorage.setItem(LS_BOOK_NAME, firstData.name || "生活");

    if (!hasValidCategories(firstData.categories)) {
      await updateDoc(doc(db, "users", uid, "books", firstId), {
        categories: DEFAULT_CATEGORIES,
      });
    }

    return firstId;
  }

  // 3. 如果完全沒有帳本：固定建立 default，避免競態重複新增
  const defaultBookRef = doc(db, "users", uid, "books", "default");
  const defaultSnap = await getDoc(defaultBookRef);

  if (!defaultSnap.exists()) {
    await setDoc(defaultBookRef, {
      name: "生活",
      archived: false,
      createdAt: serverTimestamp(),
      categories: DEFAULT_CATEGORIES,
    });
  } else {
    const defaultData = defaultSnap.data() || {};
    if (!hasValidCategories(defaultData.categories)) {
      await updateDoc(defaultBookRef, {
        categories: DEFAULT_CATEGORIES,
      });
    }
  }

  localStorage.setItem(LS_BOOK, "default");
  localStorage.setItem(LS_BOOK_NAME, "生活");

  return "default";
};

/* =========================
   2) Firebase Auth Persistence
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
   3) Wait auth restore
========================= */
window.waitForAuthReady = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  return await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
};

/* =========================
   4) Require auth
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
   5) Tabbar
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

      tab.style.setProperty("--rx", `${x}px`);
      tab.style.setProperty("--ry", `${y}px`);

      tab.classList.remove("ripple");
      void tab.offsetWidth;
      tab.classList.add("ripple");
    },
    true
  );
}

/* =========================
   6) Drawer
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

  const leftSlot =
    document.querySelector(".nav .nav-left") ||
    document.querySelector(".nav-left");

  if (leftSlot) {
    leftSlot.appendChild(topbar);
  } else {
    document.body.appendChild(topbar);
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const menuBtn = document.getElementById("menuBtn");
  const logoutBtn = document.getElementById("logoutBtn");

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
   7) Themed modal
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
        buttons: [
          {
            text: opts.okText || "知道了",
            variant: "primary",
            value: true,
          },
        ],
      });
    },

    confirm(message, opts = {}) {
      return render({
        title: opts.title || "確認",
        message,
        buttons: [
          { text: opts.cancelText || "取消", value: false },
          {
            text: opts.okText || "確定",
            variant: opts.danger ? "danger" : "primary",
            value: true,
          },
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
          {
            text: opts.okText || "確定",
            variant: "primary",
            onClick: (val) => (val ?? "").trim(),
          },
        ],
      });
    },
  };
}

/* =========================
   8) Button feedback
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
    if (minShowMs > elapsed) {
      await new Promise((r) => setTimeout(r, minShowMs - elapsed));
    }

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
   9) Book badge
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

  const existing = document.getElementById("bookBadge");
  if (existing) return existing;

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

  try {
    const bookId = await window.ensureDefaultBookAndCategories(user.uid);
    if (!bookId) {
      el.style.display = "none";
      return;
    }

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
   10) Boot
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