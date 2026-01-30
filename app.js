function pageTransition(){
  const page = document.querySelector('.page');
  if(!page) return;

  // 進場：確保不是 leaving
  page.classList.remove('leaving');

  // ✅ 用事件代理：只攔截「站內換頁」的 a 連結
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if(!a) return;

    const href = a.getAttribute('href');
    if(!href) return;

    // 不處理：錨點、javascript、外連、下載、開新分頁
    if(
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('http') ||
      a.hasAttribute('download') ||
      a.target === '_blank'
    ) return;

    // 同頁不處理
    const current = location.pathname.split('/').pop();
    if(href === current) return;

    e.preventDefault();

    // ✅ 只動 page，不動 tabbar
    page.classList.add('leaving');

    setTimeout(() => {
      location.href = href;
    }, 200);
  });
}