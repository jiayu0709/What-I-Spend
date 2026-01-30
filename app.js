/* =================================================
   App Bootstrap
   ================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initTabHighlight();
  initPageTransition();
});

/* =================================================
   Tab Bar Active Highlight
   - 根據目前頁面自動上色
   ================================================= */
function initTabHighlight(){
  const currentPage = location.pathname.split("/").pop() || "month.html";

  document.querySelectorAll(".tabbar .tab").forEach(tab => {
    const href = tab.getAttribute("href");
    if(!href) return;

    tab.classList.toggle("active", href === currentPage);
  });
}

/* =================================================
   Page Transition (iOS style)
   - 進場：CSS animation 自動執行
   - 離場：攔截內部連結，播放動畫後再跳轉
   ================================================= */
function initPageTransition(){
  const page = document.querySelector(".page");
  if(!page) return;

  // 保證進場動畫正常（避免從 cache 回來卡住）
  page.classList.remove("leaving");

  // 攔截所有內部連結
  document.querySelectorAll("a[href]").forEach(link => {
    const href = link.getAttribute("href");

    // 不處理的情況
    if(
      !href ||
      href.startsWith("#") ||
      href.startsWith("javascript") ||
      href.startsWith("http")
    ){
      return;
    }

    link.addEventListener("click", e => {
      // 如果已經在離場中，不再重複觸發
      if(page.classList.contains("leaving")) return;

      e.preventDefault();
      page.classList.add("leaving");

      // 與 CSS page-leave 時間對齊
      window.setTimeout(() => {
        location.href = href;
      }, 180);
    });
  });
}