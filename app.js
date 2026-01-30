/* ===============================
   App bootstrap
   =============================== */
document.addEventListener('DOMContentLoaded', () => {
  highlightTab();
  pageTransition();
});

/* ===============================
   Tab bar active highlight
   =============================== */
function highlightTab(){
  const path = location.pathname.split('/').pop() || 'month.html';

  document.querySelectorAll('.tabbar .tab[href]').forEach(tab => {
    // ✅ 忽略 query/hash，避免 month.html?m=... 比對失敗
    const href = tab.getAttribute('href').split('?')[0].split('#')[0];

    tab.classList.toggle('active', href === path);
  });
}

/* ===============================
   Page transition (iOS style)
   =============================== */
function pageTransition(){
  const page = document.querySelector('.page');
  if(!page) return;

  // 進場動畫
  page.classList.remove('leaving');

  // 點擊連結時做離場動畫
  document.querySelectorAll('a[href]').forEach(link => {
    const url = link.getAttribute('href');

    // 外部連結 / anchor / javascript: 不處理
    if(
      !url ||
      url.startsWith('#') ||
      url.startsWith('javascript') ||
      url.startsWith('http')
    ) return;

    link.addEventListener('click', e => {
      e.preventDefault();
      page.classList.add('leaving');

      setTimeout(() => {
        location.href = url;
      }, 180); // 和 CSS 動畫時間對齊
    });
  });
}