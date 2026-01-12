(function () {
  const PAGES = [
    "/",
    "/slides/"
  ];

  const FADE_DURATION = 1200; // ms (must match CSS)

  function getNextDelay() {
    const min = 0.5 * 60 * 1000; // 15s
    const max = 1 * 60 * 1000; // 60s
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getNextPage() {
    const current = window.location.pathname;
    return current === PAGES[0] ? PAGES[1] : PAGES[0];
  }

  function fadeOutAndNavigate() {
    document.body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = getNextPage();
    }, FADE_DURATION);
  }

  // Fade in on load
  document.body.classList.add("fade-in");

  // Rotate after delay
  setTimeout(fadeOutAndNavigate, getNextDelay());
})();
