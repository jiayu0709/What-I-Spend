document.addEventListener('DOMContentLoaded', () => {
  highlightTab();
  pageTransition();
});

function highlightTab(){
  const path = (location.pathname.split('/').pop() || 'month.html').split('?')[0].split('#')[0];

  document.querySelectorAll('.tabbar .tab[href]').forEach(tab => {
    const href = (tab.getAttribute('href') || '').split('?')[0].split('#')[0];
    tab.classList.toggle('active', href === path);
  });
}

function pageTransition(){
  const page = document.querySelector('main.page');
  if(!page) return;

  page.classList.remove('leaving');

  document.querySelectorAll('a[href]').forEach(link => {
    const url = link.getAttribute('href');

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
      }, 200); // 要跟 theme.css 的 page-leave (.2s) 一致
    });
  });
}