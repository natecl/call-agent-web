// Enhance below-the-fold content only. Everything stays readable without JavaScript.
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const targets = [...document.querySelectorAll('.plan-card, .pricing-details, .faq-list details, .privacy-overview, .privacy-section, .privacy-contact, .field, .flow-actions, .first-call, .dash-section, .dash-metric, .how-strip > div, .closing, footer')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-waiting');
      entry.target.classList.add('reveal-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -16px 0px' });
  targets.forEach(element => {
    if (document.body.classList.contains('home')) return; // Home owns its staggered reveals.
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

// Visual feedback only: native navigation, input, and form behavior remain untouched.
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = 'cubic-bezier(.16,1,.3,1)';
  document.addEventListener('click', event => {
    if (preference.matches) return;
    const control = event.target.closest('button, .button, summary, input[type="checkbox"]');
    if (!control || control.disabled) return;
    control.animate([{scale:'.97'}, {scale:'1.012',offset:.65}, {scale:'1'}], {duration:480,easing});
  });
  // Animate newly shown checkout/dashboard panels, without touching their state.
  const main = document.querySelector('main');
  if (!main) return;
  new MutationObserver(records => {
    if (preference.matches) return;
    for (const {target} of records) {
      if (target.hidden || target.getAttribute('aria-hidden') === 'true' || !target.getClientRects().length) continue;
      target.animate([{opacity:.4,translate:'0 10px'}, {opacity:1,translate:'0 0'}], {duration:560,easing});
    }
  }).observe(main, {subtree:true,attributes:true,attributeFilter:['hidden']});
})();

// One moving capsule, shared by all navigation items. Links retain native behavior.
(() => {
  const nav = document.querySelector('.nav nav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a')];
  const pill = document.createElement('span');
  pill.className = 'nav-capsule';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  nav.classList.add('fluid-nav');
  let selected = links.find(link => link.getAttribute('aria-current') === 'page');
  let preview = null;
  function move(link) {
    if (!link || !link.getClientRects().length) { pill.style.opacity = '0'; return; }
    const n = nav.getBoundingClientRect(), r = link.getBoundingClientRect();
    const pad = innerWidth <= 800 ? 8 : 12;
    pill.style.width = `${r.width + pad * 2}px`;
    pill.style.height = `${r.height + 18}px`;
    pill.style.transform = `translate(${r.left - n.left - pad}px, ${r.top - n.top - 9}px)`;
    pill.style.opacity = '1';
  }
  function syncHash() {
    const hash = location.hash;
    if (hash) selected = links.find(link => new URL(link.href).hash === hash) || selected;
    move(preview || selected);
  }
  links.forEach(link => {
    link.addEventListener('pointerenter', () => { preview = link; move(link); });
    link.addEventListener('focus', () => { preview = link; move(link); });
    link.addEventListener('blur', () => { preview = null; move(selected); });
    link.addEventListener('click', () => { selected = link; move(link); });
  });
  nav.addEventListener('pointerleave', () => { preview = null; move(selected); });
  new ResizeObserver(() => move(preview || selected)).observe(nav);
  addEventListener('hashchange', syncHash);
  document.fonts.ready.then(syncHash);
  syncHash();
  requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('nav-motion-ready')));
})();
