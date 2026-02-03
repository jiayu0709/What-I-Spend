// app.js
import {
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth } from "./firebase-config.js";

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

document.addEventListener("DOMContentLoaded", () => {
  try { highlightTab(); } catch (e) {}
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  try { highlightTab(); } catch (e) {}
}