// Stripe TEST checkout. Email + password + E.164 phone captured here. Password stays client-side (auth backend / OAuth parked). Name is not collected on this page. Secret stays on Pages Functions.
(function () {
  const PLANS = {
    personal: { id: 'personal', name: 'Personal', price: 20, minutes: 30, overage: '0.15' },
    plus: { id: 'plus', name: 'Plus', price: 40, minutes: 90, overage: '0.12' },
  };
  const KEY = {
    plan: 'treena-plan',
    email: 'treena-email',
    phone: 'treena-phone',
    retain: 'treena-retain-after-call',
    session: 'treena-session-id',
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

  function retainLabel(value) {
    return value === 'on'
      ? 'Save audio, transcripts, history'
      : 'Don’t save';
  }

  function showRetain(value) {
    fill('[data-retain-label]', value === 'on'
      ? 'Account setting: save audio, transcripts, and history'
      : 'Account setting: don’t save audio, transcripts, or history');
    document.querySelectorAll('.pay-row [data-retain-label]').forEach((el) => {
      el.textContent = retainLabel(value);
    });
  }

  function showPlan(plan) {
    fill('[data-plan-name]', plan.name);
    fill('[data-plan-price]', String(plan.price));
    fill('[data-plan-minutes]', String(plan.minutes));
    fill('[data-plan-overage]', plan.overage);
    fill('[data-pay-label]', `Pay $${plan.price}`);
  }

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function normalizeE164(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    let compact = raw.replace(/[^\d+]/g, '');
    if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
    if (!compact.startsWith('+')) {
      const digits = compact.replace(/\D/g, '');
      if (digits.length === 10) compact = `+1${digits}`;
      else if (digits.length === 11 && digits.startsWith('1')) compact = `+${digits}`;
      else return '';
    } else {
      compact = `+${compact.slice(1).replace(/\D/g, '')}`;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(compact)) return '';
    return compact;
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const page = document.body.getAttribute('data-page');
  const planId = resolvePlanId();
  const plan = planId ? PLANS[planId] : null;

  if (page === 'account' || page === 'pay') {
    if (!plan) {
      location.replace(href('pricing.html'));
      return;
    }
    showPlan(plan);
  }

  if (page === 'pay') {
    let email = null;
    let phone = null;
    try {
      email = sessionStorage.getItem(KEY.email);
      phone = sessionStorage.getItem(KEY.phone);
    } catch (_) {}
    if (!email || !phone) {
      location.replace(href('account.html', plan.id));
      return;
    }
    fill('[data-account-email]', email);
    fill('[data-account-phone]', phone);
    let retain = 'off';
    try { retain = sessionStorage.getItem(KEY.retain) === 'on' ? 'on' : 'off'; } catch (_) {}
    showRetain(retain);
  }

  if (page === 'start') {
    const params = new URLSearchParams(location.search);
    let sessionId = params.get('session_id');
    try {
      if (!sessionId) sessionId = sessionStorage.getItem(KEY.session);
    } catch (_) {}
    if (!sessionId) {
      location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      return;
    }
    (async () => {
      try {
        const result = await api(`/api/session?session_id=${encodeURIComponent(sessionId)}`);
        const paidPlan = PLANS[result.plan] || plan;
        if (paidPlan) showPlan(paidPlan);
        if (result.email) fill('[data-account-email]', result.email);
        if (result.phone) fill('[data-account-phone]', result.phone);
        showRetain(result.retainAfterCall === 'on' ? 'on' : 'off');
        try {
          sessionStorage.setItem(KEY.session, result.sessionId || sessionId);
          if (result.plan) sessionStorage.setItem(KEY.plan, result.plan);
          if (result.email) sessionStorage.setItem(KEY.email, result.email);
          if (result.phone) sessionStorage.setItem(KEY.phone, result.phone);
          sessionStorage.setItem(KEY.retain, result.retainAfterCall === 'on' ? 'on' : 'off');
        } catch (_) {}
        setHidden('start-pending', true);
        setHidden('start-ready', false);
      } catch (_) {
        try { sessionStorage.removeItem(KEY.session); } catch (e) {}
        location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      }
    })();
  }

  const form = document.getElementById('account-form');
  if (form && plan) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const phoneInput = document.getElementById('account-phone');
    const retainInput = document.getElementById('retain-after-call');
    try {
      if (emailInput) emailInput.value = sessionStorage.getItem(KEY.email) || '';
      // never restore password into the DOM from storage
      if (phoneInput) phoneInput.value = sessionStorage.getItem(KEY.phone) || '';
      if (retainInput) retainInput.checked = sessionStorage.getItem(KEY.retain) === 'on';
    } catch (_) {}
    if (phoneInput) {
      phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const phone = phoneInput ? normalizeE164(phoneInput.value) : '';
      if (phoneInput) {
        phoneInput.setCustomValidity(phone ? '' : 'Use an E.164 phone number, like +14155552671');
      }
      if (!form.reportValidity()) return;
      const email = emailInput.value.trim();
      // password required by the form; not persisted or sent to Stripe (auth backend / OAuth parked)
      if (passwordInput && !passwordInput.value) return;
      const retainAfterCall = retainInput && retainInput.checked ? 'on' : 'off';
      try {
        sessionStorage.setItem(KEY.email, email);
        sessionStorage.setItem(KEY.phone, phone);
        sessionStorage.setItem(KEY.plan, plan.id);
        sessionStorage.setItem(KEY.retain, retainAfterCall);
        sessionStorage.removeItem(KEY.session);
        sessionStorage.removeItem('treena-name');
      } catch (_) {}
      location.href = href('pay.html', plan.id);
    });
  }

  const payForm = document.getElementById('pay-form');
  if (payForm && plan) {
    const submit = payForm.querySelector('[type="submit"]');
    payForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('pay-error', '');
      let email = '';
      let phone = '';
      let retainAfterCall = 'off';
      try {
        email = sessionStorage.getItem(KEY.email) || '';
        phone = sessionStorage.getItem(KEY.phone) || '';
        retainAfterCall = sessionStorage.getItem(KEY.retain) === 'on' ? 'on' : 'off';
      } catch (_) {}
      if (!email || !phone) {
        location.replace(href('account.html', plan.id));
        return;
      }
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Redirecting to Stripe…';
      }
      try {
        // name is not collected on /account — lives in account settings / users row later
        const result = await api('/api/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: plan.id, email, phone, retainAfterCall }),
        });
        if (!result.url) throw new Error('Checkout URL missing');
        location.href = result.url;
      } catch (error) {
        showError('pay-error', error.message || 'Checkout failed');
        if (submit) {
          submit.disabled = false;
          submit.textContent = `Pay $${plan.price}`;
        }
      }
    });
  }
})();
