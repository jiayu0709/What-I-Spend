// app.js  (IMPORTANT: this file is loaded via <script type="module" src="app.js"></script>)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   1) Firebase 初始化（把這段換成你 Firebase console 給的）
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDkj60hCKagiQijipxl3s6F5soN1YIKadE",
  authDomain: "whatispend-3c060.firebaseapp.com",
  projectId: "whatispend-3c060",
  storageBucket: "whatispend-3c060.firebasestorage.app",
  messagingSenderId: "740100624448",
  appId: "1:740100624448:web:88c3298185bd163fba8fa5",
  measurementId: "G-X5V7G8QBCY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ 關鍵：掛到 window，讓其他頁面的 inline script 可以用
window.auth = auth;
window.db = db;

/* =========================
   2) 你的 tab 高亮（保持你的原功能）
   ========================= */
function highlightTab() {
  const currentPath = window.location.pathname.split('/').pop() || 'month.html';

  document.querySelectorAll('.tabbar .tab').forEach(tab => {
    const href = tab.getAttribute('href');
    if (!href) return;

    const cleanHref = href.split('?')[0].split('#')[0];

    // ✅ 修正：應該是 cleanHref.endsWith(currentPath)
    // 你原本寫反了，會導致判斷常常失敗
    if (cleanHref === currentPath || cleanHref.endsWith(currentPath)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

/* =========================
   3) 保持你原本的 pageTransition（如果你原本有）
   ========================= */
function pageTransition() {
  // 你原本怎麼寫就放這裡，不動也可以
  // 如果你本來就在 app.js 裡有，請保留原本版本
}

document.addEventListener('DOMContentLoaded', () => {
  highlightTab();
  try { pageTransition(); } catch(e) {}
});

// 額外保險（你原本的）
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  highlightTab();
}