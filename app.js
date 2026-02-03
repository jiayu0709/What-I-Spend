import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";

// 掛到 window：讓你各頁面原本 window.auth / window.db 的用法不必改
window.auth = auth;
window.db = db;

/* ---------------------------
   1) Firebase Auth persistence
---------------------------- */
window.firebaseReady = (async () => {
  try {
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
   2) 等待 Auth 狀態還原完成
---------------------------- */
window.waitForAuthReady = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  return await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user); // user 可能是 null，但狀態已完成
    });
  });
};

/* ---------------------------
   3) 登入保護
---------------------------- */
window.requireAuth = async () => {
  const user = await window.waitForAuthReady();

  if (!user) {
    const next = encodeURIComponent(window.location.href);
    window.location.replace(`index.html?next=${next}`);
    return null;
  }
  return user;
};

/* ---------------------------
   4) UI：Tab 高亮（不影響任何功能）
---------------------------- */
function highlightTab() {
  const currentPath = window.location.pathname.split("/").pop() || "month.html";

  document.querySelectorAll(".tabbar .tab").forEach((tab) => {
    const href = tab.getAttribute("href");
    if (!href) return;

    const cleanHref = href.split("?")[0].split("#")[0];

    // ✅ 用完全一致比對（避免你之前提到的「不會變色」問題）
    if (currentPath === cleanHref) tab.classList.add("active");
    else tab.classList.remove("active");
  });
}

document.addEventListener("DOMContentLoaded", highlightTab);