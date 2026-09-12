// Enhance below-the-fold content only. Everything stays readable without JavaScript.
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const targets = [...document.querySelectorAll('.plan-card, .pricing-details, .faq-list details, .privacy-overview, .privacy-section')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-waiting');
      entry.target.classList.add('reveal-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  targets.forEach(element => {
    if (element.getBoundingClientRect().top < innerHeight - 24) return;
    element.classList.add('reveal-waiting');
    observer.observe(element);
  });
  const revealAll = () => {
    observer.disconnect();
    targets.forEach(element => element.classList.remove('reveal-waiting', 'reveal-visible'));
  };
  preference.addEventListener('change', revealAll, { once: true });
  // Keyboard and in-page navigation must never arrive at hidden content.
  document.addEventListener('focusin', event => {
    const section = event.target.closest('.reveal-waiting');
    if (section) { section.classList.remove('reveal-waiting'); observer.unobserve(section); }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) revealAll(); });
})();
