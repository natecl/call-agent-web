// Design-scoped checkout stub. No Stripe, no auth backend, no network charge.
(function () {
  const PLANS = {
    personal: { id: 'personal', name: 'Personal', price: 20, minutes: 30, overage: '0.15' },
    plus: { id: 'plus', name: 'Plus', price: 40, minutes: 90, overage: '0.12' },
  };
  const KEY = {
    plan: 'treena-stub-plan',
    email: 'treena-stub-email',
    name: 'treena-stub-name',
    paid: 'treena-stub-paid',
  };

  function base() {
    return document.body.getAttribute('data-base') || '.';
  }

  function href(file, planId) {
    const path = `${base()}/${file}`;
    if (!planId) return path;
    return `${path}?plan=${encodeURIComponent(planId)}`;
  }

  function resolvePlanId() {
    const fromQuery = new URLSearchParams(location.search).get('plan');
    if (fromQuery && PLANS[fromQuery]) {
      try { sessionStorage.setItem(KEY.plan, fromQuery); } catch (_) {}
      return fromQuery;
    }
    try {
      const stored = sessionStorage.getItem(KEY.plan);
      if (stored && PLANS[stored]) return stored;
    } catch (_) {}
    return null;
  }

  function fill(selector, text) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  function showPlan(plan) {
    fill('[data-plan-name]', plan.name);
    fill('[data-plan-price]', String(plan.price));
    fill('[data-plan-minutes]', String(plan.minutes));
    fill('[data-plan-overage]', plan.overage);
    fill('[data-pay-label]', `Pay $${plan.price}`);
  }

  const page = document.body.getAttribute('data-page');
  const planId = resolvePlanId();
  const plan = planId ? PLANS[planId] : null;

  if (page === 'account' || page === 'pay' || page === 'start') {
    if (!plan) {
      location.replace(href('pricing.html'));
      return;
    }
    showPlan(plan);
  }

  if (page === 'pay') {
    let email = null;
    try { email = sessionStorage.getItem(KEY.email); } catch (_) {}
    if (!email) {
      location.replace(href('account.html', plan.id));
      return;
    }
    fill('[data-account-email]', email);
  }

  if (page === 'start') {
    let paid = null;
    try { paid = sessionStorage.getItem(KEY.paid); } catch (_) {}
    if (paid !== '1') {
      location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      return;
    }
  }

  const form = document.getElementById('account-form');
  if (form && plan) {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    try {
      if (nameInput) nameInput.value = sessionStorage.getItem(KEY.name) || '';
      if (emailInput) emailInput.value = sessionStorage.getItem(KEY.email) || '';
    } catch (_) {}
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const email = emailInput.value.trim();
      const name = nameInput ? nameInput.value.trim() : '';
      try {
        sessionStorage.setItem(KEY.email, email);
        sessionStorage.setItem(KEY.plan, plan.id);
        if (name) sessionStorage.setItem(KEY.name, name);
        else sessionStorage.removeItem(KEY.name);
      } catch (_) {}
      location.href = href('pay.html', plan.id);
    });
  }

  const payForm = document.getElementById('pay-form');
  if (payForm && plan) {
    payForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try { sessionStorage.setItem(KEY.paid, '1'); } catch (_) {}
      location.href = href('start.html', plan.id);
    });
  }
})();
