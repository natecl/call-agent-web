// Stripe checkout. Mode follows Pages Stripe keys (TEST or live). Email + password + E.164 (the user's phone, not Treena's shared bot DID). Password stays client-side unless Google/Apple session is present. Name is not collected on /account. Secret stays on Pages Functions.
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
    name: 'treena-name',
  };
  const FIRST_NAME_RE = /^[A-Za-z][A-Za-z' -]{0,31}$/;

  function base() {
    return document.body.getAttribute('data-base') || '.';
  }

  function href(file, planId) {
    const path = `${base()}/${file}`;
    if (!planId) return path;
    return `${path}?plan=${encodeURIComponent(planId)}`;
  }

  function withSession(file, sessionId, planId) {
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (planId) params.set('plan', planId);
    const query = params.toString();
    return `${base()}/${file}${query ? `?${query}` : ''}`;
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

  function firstNameFrom(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const first = trimmed.split(/\s+/)[0];
    return FIRST_NAME_RE.test(first) ? first : null;
  }

  function hasName(result) {
    return Boolean(firstNameFrom((result && (result.firstName || result.name)) || ''));
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

  function applyOAuthSession(me) {
    if (!me || !me.signedIn) return;
    const emailInput = document.getElementById('email');
    if (emailInput && me.email) emailInput.value = me.email;
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.required = false;
      passwordInput.disabled = true;
      passwordInput.value = '';
    }
    const passwordField = document.getElementById('password-field');
    if (passwordField) passwordField.hidden = true;
    try {
      if (me.email) sessionStorage.setItem(KEY.email, me.email);
      if (me.name) sessionStorage.setItem(KEY.name, me.name);
    } catch (_) {}
  }

  function storeSession(result, sessionId) {
    try {
      sessionStorage.setItem(KEY.session, result.sessionId || sessionId);
      if (result.plan) sessionStorage.setItem(KEY.plan, result.plan);
      if (result.email) sessionStorage.setItem(KEY.email, result.email);
      if (result.phone) sessionStorage.setItem(KEY.phone, result.phone);
      sessionStorage.setItem(KEY.retain, result.retainAfterCall === 'on' ? 'on' : 'off');
      if (result.name) sessionStorage.setItem(KEY.name, result.name);
    } catch (_) {}
  }

  function resolveSessionId() {
    const params = new URLSearchParams(location.search);
    let sessionId = params.get('session_id');
    try {
      if (!sessionId) sessionId = sessionStorage.getItem(KEY.session);
    } catch (_) {}
    return sessionId;
  }

  function threadSnippet(thread) {
    const inbound = thread.inbound || {};
    const kickoff = thread.kickoff || {};
    return inbound.text || inbound.body || inbound.message || kickoff.task || kickoff.preview || thread.verb || '';
  }

  function durationLabel(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const seconds = Math.round(n / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  function renderThreads(threads) {
    const list = document.getElementById('thread-list');
    const empty = document.getElementById('threads-empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    if (!threads.length) {
      list.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    threads.forEach((thread) => {
      const li = document.createElement('li');
      const verb = thread.verb || 'thread';
      const status = thread.call && thread.call.status ? thread.call.status : 'no call yet';
      const snippet = threadSnippet(thread);
      li.innerHTML = `<p class="eyebrow">${escapeText(thread.chat_id || thread.event_id || 'Linq')} · ${escapeText(verb)} · ${escapeText(status)}</p><p>${escapeText(snippet || 'No preview')}</p>`;
      list.appendChild(li);
    });
  }

  function renderObservability(calls) {
    const list = document.getElementById('obs-list');
    const empty = document.getElementById('obs-empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    if (!calls.length) {
      list.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    calls.forEach((call) => {
      const li = document.createElement('li');
      const obs = call.observability || {};
      const counts = obs.counts || {};
      const duration = durationLabel(obs.duration_ms);
      const turns = counts.transcript_turns != null ? counts.transcript_turns : counts.turns;
      const tools = counts.tool_calls != null ? counts.tool_calls : '';
      const hangup = obs.hangup_path || '';
      const bits = [
        call.status || obs.status || 'unknown',
        duration,
        hangup && `hangup ${hangup}`,
        turns != null && turns !== '' ? `${turns} transcript turns` : '',
        tools !== '' ? `${tools} tool calls` : '',
      ].filter(Boolean);
      const details = call.transcript
        ? `<details><summary>Transcript</summary><pre>${escapeText(JSON.stringify(call.transcript, null, 2))}</pre></details>`
        : '';
      li.innerHTML = `<p class="eyebrow">${escapeText(call.event_id || call.call_control_id || 'call')}</p><p>${escapeText(obs.answer_text || obs.task || 'Call report retained.')}</p><p class="obs-meta">${escapeText(bits.join(' · '))}</p>${details}`;
      list.appendChild(li);
    });
  }

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyStripeMode(cfg) {
    const mode = cfg && cfg.mode;
    const test = mode === 'test';
    document.body.setAttribute('data-stripe-mode', test ? 'test' : 'live');
    document.querySelectorAll('[data-stripe-test-only]').forEach((el) => {
      el.hidden = !test;
    });
    document.querySelectorAll('[data-stripe-live-only]').forEach((el) => {
      el.hidden = test;
    });
  }

  function loadStripeMode() {
    return fetch('/api/config')
      .then((res) => res.json())
      .then(applyStripeMode)
      .catch(() => applyStripeMode({ mode: 'live' }));
  }

  loadStripeMode();
  const page = document.body.getAttribute('data-page');
  const planId = resolvePlanId();
  const plan = planId ? PLANS[planId] : null;
  let paidPlan = plan;

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
    const sessionId = resolveSessionId();
    if (!sessionId) {
      location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      return;
    }
    (async () => {
      try {
        const result = await api(`/api/session?session_id=${encodeURIComponent(sessionId)}`);
        paidPlan = PLANS[result.plan] || plan;
        if (paidPlan) showPlan(paidPlan);
        if (result.email) fill('[data-account-email]', result.email);
        if (result.phone) fill('[data-account-phone]', result.phone);
        showRetain(result.retainAfterCall === 'on' ? 'on' : 'off');
        storeSession(result, sessionId);
        if (hasName(result)) {
          location.replace(withSession('dashboard.html', result.sessionId || sessionId, result.plan || (paidPlan && paidPlan.id)));
          return;
        }
        setHidden('start-pending', true);
        setHidden('start-name', false);
      } catch (_) {
        try { sessionStorage.removeItem(KEY.session); } catch (e) {}
        location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      }
    })();
  }

  if (page === 'dashboard') {
    const sessionId = resolveSessionId();
    if (!sessionId) {
      location.replace(plan ? href('pay.html', plan.id) : href('pricing.html'));
      return;
    }
    (async () => {
      try {
        const result = await api(`/api/dashboard?session_id=${encodeURIComponent(sessionId)}`);
        if (result.needsName) {
          location.replace(withSession('start.html', result.sessionId || sessionId, result.billing && result.billing.plan));
          return;
        }
        storeSession({
          sessionId: result.sessionId || sessionId,
          plan: result.billing && result.billing.plan,
          email: result.email,
          phone: result.phone,
          retainAfterCall: result.user && result.user.retain_call_artifacts ? 'on' : 'off',
          name: result.name,
        }, sessionId);
        const billed = result.billing || {};
        applyStripeMode(billed);
        const usage = result.usage || {};
        const billedPlan = PLANS[billed.plan];
        if (billedPlan) showPlan(billedPlan);
        fill('[data-first-name]', result.firstName || 'there');
        fill('[data-minutes-included]', String(usage.minutesIncluded ?? (billed.minutes || 0)));
        fill('[data-minutes-used]', String(usage.minutesUsed ?? 0));
        fill('[data-call-count]', String(usage.callCount ?? 0));
        fill('[data-billing-status]', billed.status || 'active');
        fill('[data-subscription-id]', billed.subscriptionId || '—');
        if (usage.usageNote) fill('[data-usage-note]', usage.usageNote);
        renderThreads(Array.isArray(result.threads) ? result.threads : []);
        renderObservability(Array.isArray(result.calls) ? result.calls : []);
        setHidden('dash-pending', true);
        setHidden('dash-ready', false);
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
    fetch('/api/auth/me').then((res) => res.json()).then(applyOAuthSession).catch(() => {});
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
      // password required unless Google/Apple session is present; never sent to Stripe
      if (passwordInput && passwordInput.required && !passwordInput.value) return;
      const retainAfterCall = retainInput && retainInput.checked ? 'on' : 'off';
      try {
        sessionStorage.setItem(KEY.email, email);
        sessionStorage.setItem(KEY.phone, phone);
        sessionStorage.setItem(KEY.plan, plan.id);
        sessionStorage.setItem(KEY.retain, retainAfterCall);
        sessionStorage.removeItem(KEY.session);
        sessionStorage.removeItem(KEY.name);
      } catch (_) {}
      location.href = href('pay.html', plan.id);
    });
  }

  const nameForm = document.getElementById('start-name-form');
  if (nameForm) {
    const nameInput = document.getElementById('name');
    if (nameInput) {
      nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
    }
    nameForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('name-error', '');
      const name = nameInput ? nameInput.value.trim() : '';
      if (nameInput) {
        nameInput.setCustomValidity(firstNameFrom(name) ? '' : 'Use a first name, like Nathan');
      }
      if (!nameForm.reportValidity()) return;
      let email = '';
      let phone = '';
      let retainAfterCall = 'off';
      let sessionId = resolveSessionId();
      try {
        email = sessionStorage.getItem(KEY.email) || '';
        phone = sessionStorage.getItem(KEY.phone) || '';
        retainAfterCall = sessionStorage.getItem(KEY.retain) === 'on' ? 'on' : 'off';
      } catch (_) {}
      const planForSave = paidPlan || plan || PLANS.personal;
      const submit = nameForm.querySelector('[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Saving…';
      }
      try {
        const saved = await api('/api/account', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            plan: (planForSave && planForSave.id) || 'personal',
            email,
            name,
            phone,
            retainAfterCall,
          }),
        });
        try { sessionStorage.setItem(KEY.name, saved.name || name); } catch (_) {}
        location.replace(withSession('dashboard.html', sessionId, (planForSave && planForSave.id)));
      } catch (error) {
        showError('name-error', error.message || 'Could not save your name');
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Continue to dashboard →';
        }
      }
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
        // name is not collected on /account — collected on /start; copy says it lives in account settings after signup
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
