// app.js  (請用 type="module" 載入)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ 你的 Firebase 設定（照你貼的）
const firebaseConfig = {
  apiKey: "AIzaSyDkj60hCKagiQijipxl3s6F5soN1YIKadE",
  authDomain: "whatispend-3c060.firebaseapp.com",
  projectId: "whatispend-3c060",
  storageBucket: "whatispend-3c060.firebasestorage.app",
  messagingSenderId: "740100624448",
  appId: "1:740100624448:web:88c3298185bd163fba8fa5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseReady = (async () => {
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch (e1) {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (e2) {
      await setPersistence(auth, browserSessionPersistence);
    }
  }
})();

// ✅ 給其他頁使用
window.auth = auth;
window.db = db;

// ===== 你原本的 highlightTab / pageTransition 保留 =====
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

// 你原本有 pageTransition 就留著，沒有也不會壞
function pageTransition() {}

document.addEventListener("DOMContentLoaded", () => {
  highlightTab();
  try { pageTransition(); } catch (e) {}
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  highlightTab();
}