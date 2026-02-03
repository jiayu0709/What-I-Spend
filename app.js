import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";

// 將實例掛載到 window 確保其他模組抓到的是同一個
window.auth = auth;
window.db = db;

// 優化初始化順序
window.firebaseReady = (async () => {
  try {
    // 優先順序：indexedDB -> local -> session
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch (e) {
    console.warn("IndexedDB persistence failed, trying local storage", e);
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (e2) {
      await setPersistence(auth, browserSessionPersistence);
    }
  }
  return auth;
})();

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