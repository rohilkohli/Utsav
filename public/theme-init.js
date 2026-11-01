(() => {
  const stored = window.localStorage.getItem('utsav-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light';
})();
