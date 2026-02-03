// app.js
import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth } from "./firebase-config.js";

// 掛到 window，讓每個頁面都能用
window.auth = auth;

/* ---------------------------
   1) Auth persistence
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
   2) 等待狀態還原
---------------------------- */
window.waitForAuthReady = async () => {
  if (window.firebaseReady) await window.firebaseReady;

  return await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });
};

/* ---------------------------
   3) 需要登入才可用
---------------------------- */
window.requireAuth = async ({ redirectTo = "index.html" } = {}) => {
  const user = await window.waitForAuthReady();
  if (user) return user;

  const next = encodeURIComponent(location.href);
  location.replace(`${redirectTo}?next=${next}`);
  return null;
};

/* ---------------------------
   UI（tab 高亮）
---------------------------- */
function highlightTab() {
  const currentPath = window.location.pathname.split("/").pop() || "month.html";

  document.querySelectorAll(".tabbar .tab").forEach((tab) => {
    const href = tab.getAttribute("href");
    if (!href) return;
    const cleanHref = href.split("?")[0].split("#")[0];

    if (currentPath === cleanHref || cleanHref.endsWith(currentPath)) tab.classList.add("active");
    else tab.classList.remove("active");
  });
}
document.addEventListener("DOMContentLoaded", highlightTab);