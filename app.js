function highlightTab() {
  const currentPath =
    (location.pathname.split('/').pop() || 'month.html')
      .split('?')[0]
      .split('#')[0];

  document.querySelectorAll('.tabbar .tab[href]').forEach(tab => {
    const href =
      tab.getAttribute('href')
        .split('?')[0]
        .split('#')[0];

    tab.classList.toggle('active', href === currentPath);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  highlightTab();
  pageTransition();
});