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
  const user = await window.waitForAuthReady();

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