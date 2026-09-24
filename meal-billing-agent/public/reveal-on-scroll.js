// Apple-style content reveal: elements fade and slide up into view as
// they enter the viewport, instead of appearing instantly. Applied to
// the main content box on load, and to any .card that appears later
// (results, breakdowns, issue forms) as they're shown dynamically.

function revealElement(el) {
  if (!el) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.disconnect();
      }
    });
  }, { threshold: 0.1 });
  observer.observe(el);
}

function initRevealOnScroll() {
  revealElement(document.querySelector('.content-box'));

  // Cards that start hidden and get shown dynamically (breakdown, issue
  // form, etc.) - watch for their "hidden" class being removed, then
  // reveal them the same way.
  document.querySelectorAll('.card').forEach(card => {
    const cardObserver = new MutationObserver(() => {
      if (!card.classList.contains('hidden')) {
        revealElement(card);
        cardObserver.disconnect();
      }
    });
    cardObserver.observe(card, { attributes: true, attributeFilter: ['class'] });
  });
}

initRevealOnScroll();
