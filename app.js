// ✅ URL auth 方案：全站共用這兩個常數
export const DB = "https://xxx.asia-southeast1.firebasedatabase.app";
export const AUTH = "12345678";

// ✅ 統一產生帶 auth 的 Realtime DB REST URL
export function rtdbUrl(path) {
  // path 例： "records/list" 或 `records/list/${id}`
  return `${DB}/${path}.json?auth=${encodeURIComponent(AUTH)}`;
}

/* ---------------------------
   UI（跟 Auth 無關）
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