// app.js (請確保在 HTML 中用 type="module" 載入)

// ✅ 修改：直接從你已經寫好的 firebase-config.js 匯入，避免重複初始化導致報錯
import { auth, db } from './firebase-config.js'; 
import { 
  setPersistence, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ 修改：這裡不再定義 firebaseConfig，因為它會導致 API Key 被重複定義或覆蓋

window.firebaseReady = (async () => {
  try {
    // 確保 auth 物件存在後再設定持久化
    if (auth) {
      await setPersistence(auth, indexedDBLocalPersistence);
    }
  } catch (e1) {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (e2) {
      await setPersistence(auth, browserSessionPersistence);
    }
  }
})();

// ✅ 修改：將從 config 匯入的 auth 掛載到 window，供全域使用
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