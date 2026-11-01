(() => {
  let stored;
  try {
    stored = window.localStorage.getItem('utsav-theme');
  } catch {
    // A disabled storage setting must not prevent rendering.
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light';
})();
