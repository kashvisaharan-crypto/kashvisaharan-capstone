// Scroll-driven split: as the user scrolls through the hero section's
// height, the two halves of the hero image (each a clipped copy of the
// same full image) translate far apart, rotate, and fade out completely,
// so nothing of the hero remains visible once you've scrolled past it -
// revealing the app content that sits immediately after.

function initHeroScroll() {
  const hero = document.getElementById('heroSection');
  const left = document.getElementById('leafLeft');
  const right = document.getElementById('leafRight');
  if (!hero || !left || !right) return;

  function update() {
    const heroHeight = hero.offsetHeight;
    const scrolled = window.scrollY;
    const progress = Math.min(Math.max(scrolled / heroHeight, 0), 1);

    // Travel distance scales with viewport width, so the halves always
    // clear the screen completely regardless of screen size.
    const maxTravel = window.innerWidth;
    const splitPx = progress * maxTravel;

    left.style.transform = `translateX(${-splitPx}px) rotate(${-progress * 15}deg)`;
    right.style.transform = `translateX(${splitPx}px) rotate(${progress * 15}deg)`;

    // Fade out too, as a second guarantee it's fully gone by progress=1,
    // not just moved.
    const opacity = Math.max(0, 1 - progress * 1.3);
    left.style.opacity = String(opacity);
    right.style.opacity = String(opacity);
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

initHeroScroll();
