// app.js

function highlightTab() {
  // 1. 取得當前檔名 (例如: month.html)
  // 如果是根目錄 "/"，預設為 "month.html"
  const currentPath = window.location.pathname.split('/').pop() || 'month.html';

  document.querySelectorAll('.tabbar .tab').forEach(tab => {
    const href = tab.getAttribute('href');
    if (!href) return;

    // 2. 清理 href 的參數（處理 month.html?m=2025-01 這種情況）
    const cleanHref = href.split('?')[0].split('#')[0];

    // 3. 檢查當前路徑是否包含該 tab 的連結，或是兩者完全一致
    // 使用 endsWith 可以避免路徑中有資料夾名稱的干擾
    if (currentPath === cleanHref || cleanHref.endsWith(currentPath)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

// 確保轉場效果不會卡住，並執行高亮
document.addEventListener('DOMContentLoaded', () => {
  highlightTab();
  pageTransition();
});

// 額外保險：如果 DOM 已經加載完畢，直接執行一次
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  highlightTab();
}

/* ... 保持原本的 pageTransition 不變 ... */