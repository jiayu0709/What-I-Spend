// app.js (請確保在 HTML 中用 type="module" 載入)

// ✅ 修改：直接從你已經寫好的 firebase-config.js 匯入，避免重複初始化
import { auth, db } from './firebase-config.js'; 
import { 
  setPersistence, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ 修改：移除這裡原本重複的 firebaseConfig 和 initializeApp 代碼

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

// ✅ 修改：確保全域變數與 firebase-config.js 保持一致
window.auth = auth;
window.db = db;

// ===== 你原本的 highlightTab / pageTransition 保留 (不做修改) =====
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

function pageTransition() {}

document.addEventListener("DOMContentLoaded", () => {
  highlightTab();
  try { pageTransition(); } catch (e) {}
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  highlightTab();
}