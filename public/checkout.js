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
    csrf: 'treena-csrf',
  };
  let csrfToken = '';
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
    const headers = Object.assign({}, (options && options.headers) || {});
    const method = String((options && options.method) || 'GET').toUpperCase();
    if (csrfToken && method !== 'GET' && method !== 'HEAD') {
      headers['X-Treena-CSRF'] = csrfToken;
    }
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}, { headers }));
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (data && data.csrf) {
      csrfToken = data.csrf;
      try { sessionStorage.setItem(KEY.csrf, data.csrf); } catch (_) {}
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function rememberCsrf(token) {
    if (!token) return;
    csrfToken = token;
    try { sessionStorage.setItem(KEY.csrf, token); } catch (_) {}
  }
  try { csrfToken = sessionStorage.getItem(KEY.csrf) || ''; } catch (_) {}

  function formatIsoDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fillDate(selector, iso) {
    const label = formatIsoDate(iso);
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = label || '—';
    });
  }

  function showRow(selector, show) {
    document.querySelectorAll(selector).forEach((el) => {
      el.hidden = !show;
    });
  }

  function applyBillingPeriod(billed) {
    const start = billed && billed.periodStart;
    const end = billed && billed.periodEnd;
    const renews = billed && billed.renewsAt;
    const reset = billed && billed.minutesResetAt;
    const cancelAt = billed && billed.cancelEffectiveAt;
    const canceling = Boolean(billed && billed.cancelAtPeriodEnd);
    showRow('[data-period-row]', Boolean(start || end));
    showRow('[data-renews-row]', Boolean(renews));
    showRow('[data-reset-row]', Boolean(reset));
    showRow('[data-cancel-row]', Boolean(canceling && cancelAt));
    fillDate('[data-period-start]', start);
    fillDate('[data-period-end]', end);
    fillDate('[data-renews-at]', renews);
    fillDate('[data-minutes-reset-at]', reset);
    fillDate('[data-cancel-effective-at]', cancelAt);
    fillDate('[data-renewal]', renews);
    fillDate('[data-next-payment]', renews);
    const cancelBtn = document.getElementById('cancel-plan');
    if (cancelBtn) {
      cancelBtn.hidden = Boolean(canceling)
        || (billed && billed.status === 'canceled')
        || Boolean(billed && billed.complimentary)
        || !(billed && billed.subscriptionId);
      cancelBtn.disabled = false;
    }
  }

  function applyComplimentary(billed) {
    const grant = Boolean(billed && billed.complimentary);
    document.querySelectorAll('[data-complimentary-only]').forEach((el) => {
      el.hidden = !grant;
    });
    const manage = document.getElementById('manage-billing');
    if (manage) {
      const hidePortal = grant || (billed && billed.canManageBilling === false);
      manage.hidden = hidePortal;
      manage.disabled = hidePortal;
      if (hidePortal) manage.setAttribute('aria-disabled', 'true');
      else manage.removeAttribute('aria-disabled');
    }
    if (!grant) return;
    document.querySelectorAll('[data-stripe-live-only]').forEach((el) => {
      el.hidden = true;
    });
    const cancelBtn = document.getElementById('cancel-plan');
    if (cancelBtn) cancelBtn.hidden = true;
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
      if (me.phone) sessionStorage.setItem(KEY.phone, me.phone);
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
    (async () => {
      let email = null;
      let phone = null;
      try {
        email = sessionStorage.getItem(KEY.email);
        phone = sessionStorage.getItem(KEY.phone);
      } catch (_) {}
      try {
        const me = await fetch('/api/auth/me', { credentials: 'same-origin' }).then((res) => res.json());
        applyOAuthSession(me);
        if (me && me.signedIn) {
          if (me.hasAccount) {
            location.replace('/dashboard');
            return;
          }
          if (!email && me.email) email = me.email;
          if (!phone && me.phone) phone = me.phone;
          try {
            if (me.email) sessionStorage.setItem(KEY.email, me.email);
            if (me.phone) sessionStorage.setItem(KEY.phone, me.phone);
            if (me.name) sessionStorage.setItem(KEY.name, me.name);
            sessionStorage.setItem(KEY.plan, plan.id);
          } catch (_) {}
        }
      } catch (_) {}
      if (!email) {
        location.replace(href('account.html', plan.id));
        return;
      }
      fill('[data-account-email]', email);
      fill('[data-account-phone]', phone || '');
      showRow('[data-account-phone-row]', Boolean(phone));
      const details = document.getElementById('pay-details');
      const phoneInput = document.getElementById('pay-phone');
      if (!phone) {
        if (details) details.hidden = false;
        if (phoneInput) {
          phoneInput.required = true;
          phoneInput.value = '';
        }
      } else if (phoneInput) {
        phoneInput.required = false;
        phoneInput.value = phone;
      }
      let retain = 'off';
      try { retain = sessionStorage.getItem(KEY.retain) === 'on' ? 'on' : 'off'; } catch (_) {}
      showRetain(retain);
      const retainInput = document.getElementById('pay-retain');
      if (retainInput) retainInput.checked = retain === 'on';
    })();
  }

  if (page === 'start') {
    const sessionId = resolveSessionId();
    (async () => {
      try {
        const path = sessionId
          ? `/api/session?session_id=${encodeURIComponent(sessionId)}`
          : '/api/session';
        const result = await api(path);
        paidPlan = PLANS[result.plan] || plan;
        if (paidPlan) showPlan(paidPlan);
        if (result.email) fill('[data-account-email]', result.email);
        if (result.phone) fill('[data-account-phone]', result.phone);
        showRetain(result.retainAfterCall === 'on' ? 'on' : 'off');
        storeSession(result, result.sessionId || sessionId);
        rememberCsrf(result.csrf);
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

  function fillSettings(result) {
    const settings = result.settings || {};
    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const phoneInput = document.getElementById('settings-phone');
    const retainInput = document.getElementById('settings-retain');
    if (nameInput) nameInput.value = settings.name || result.name || '';
    if (emailInput) emailInput.value = settings.email || result.email || '';
    if (phoneInput) phoneInput.value = settings.phone || result.phone || '';
    if (retainInput) {
      retainInput.checked = (settings.retainAfterCall || (result.user && result.user.retain_call_artifacts ? 'on' : 'off')) === 'on';
    }
  }

  function bindDashboardActions(result) {
    const manage = document.getElementById('manage-billing');
    const complimentaryGrant = Boolean(result.billing && (result.billing.complimentary || result.billing.canManageBilling === false));
    if (manage && !complimentaryGrant) {
      manage.addEventListener('click', async () => {
        showError('billing-error', '');
        manage.disabled = true;
        try {
          const portal = await api('/api/billing/portal', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: resolveSessionId() || undefined }),
          });
          if (!portal.url) throw new Error('Billing portal URL missing');
          location.href = portal.url;
        } catch (error) {
          showError('billing-error', error.message || 'Could not open Stripe Customer Portal');
          manage.disabled = false;
        }
      });
    }
    const cancelBtn = document.getElementById('cancel-plan');
    const confirmBox = document.getElementById('cancel-confirm');
    const confirmActions = document.getElementById('cancel-confirm-actions');
    const confirmBtn = document.getElementById('cancel-plan-confirm');
    const backBtn = document.getElementById('cancel-plan-back');
    function showCancelConfirm(show) {
      if (confirmBox) confirmBox.hidden = !show;
      if (confirmActions) confirmActions.hidden = !show;
      if (cancelBtn) cancelBtn.hidden = show || cancelBtn.hidden;
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        showError('billing-error', '');
        showCancelConfirm(true);
      });
    }
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        showCancelConfirm(false);
        if (cancelBtn) cancelBtn.hidden = false;
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        showError('billing-error', '');
        confirmBtn.disabled = true;
        try {
          const canceled = await api('/api/billing/cancel', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: resolveSessionId() || undefined }),
          });
          applyBillingPeriod(canceled);
          fill('[data-billing-status]', canceled.status || 'active');
          showCancelConfirm(false);
          if (cancelBtn) cancelBtn.hidden = true;
        } catch (error) {
          showError('billing-error', error.message || 'Could not cancel plan');
          confirmBtn.disabled = false;
        }
      });
    }
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showError('settings-error', '');
        const savedNote = document.getElementById('settings-saved');
        if (savedNote) savedNote.hidden = true;
        const nameInput = document.getElementById('settings-name');
        const phoneInput = document.getElementById('settings-phone');
        const retainInput = document.getElementById('settings-retain');
        const name = nameInput ? nameInput.value.trim() : '';
        const phone = phoneInput ? normalizeE164(phoneInput.value) : '';
        if (phoneInput) {
          phoneInput.setCustomValidity(phone ? '' : 'Use an E.164 phone number, like +14155552671');
        }
        if (nameInput) {
          nameInput.setCustomValidity(firstNameFrom(name) ? '' : 'Use a first name, like Nathan');
        }
        if (!settingsForm.reportValidity()) return;
        const submit = settingsForm.querySelector('[type="submit"]');
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Saving…';
        }
        try {
          const saved = await api('/api/account', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              sessionId: resolveSessionId() || undefined,
              name,
              phone,
              plan: (result.billing && result.billing.plan) || undefined,
              retainAfterCall: retainInput && retainInput.checked ? 'on' : 'off',
            }),
          });
          storeSession({
            sessionId: result.sessionId,
            plan: saved.plan,
            email: result.email,
            phone: saved.phone,
            retainAfterCall: saved.retainAfterCall,
            name: saved.name,
          }, result.sessionId);
          fill('[data-first-name]', saved.firstName || firstNameFrom(saved.name) || 'there');
          if (savedNote) savedNote.hidden = false;
        } catch (error) {
          showError('settings-error', error.message || 'Could not save settings');
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.textContent = 'Save settings';
          }
        }
      });
    }
  }

  if (page === 'dashboard') {
    const sessionId = resolveSessionId();
    (async () => {
      try {
        const path = sessionId
          ? `/api/dashboard?session_id=${encodeURIComponent(sessionId)}`
          : '/api/dashboard';
        const result = await api(path);
        rememberCsrf(result.csrf);
        if (result.needsName) {
          location.replace(withSession('start.html', result.sessionId || sessionId, result.billing && result.billing.plan));
          return;
        }
        storeSession({
          sessionId: result.sessionId || sessionId,
          plan: result.billing && result.billing.plan,
          email: result.email,
          phone: result.phone,
          retainAfterCall: (result.settings && result.settings.retainAfterCall)
            || (result.user && result.user.retain_call_artifacts ? 'on' : 'off'),
          name: result.name,
        }, result.sessionId || sessionId);
        const billed = result.billing || {};
        applyStripeMode(billed);
        applyComplimentary(billed);
        const usage = result.usage || {};
        const billedPlan = PLANS[billed.plan];
        if (billedPlan) showPlan(billedPlan);
        fill('[data-first-name]', result.firstName || 'there');
        fill('[data-minutes-included]', String(usage.minutesIncluded ?? (billed.minutes || 0)));
        fill('[data-minutes-used]', String(usage.minutesUsed ?? 0));
        fill('[data-call-count]', String(usage.callCount ?? 0));
        fill('[data-billing-status]', billed.status || 'active');
        fill('[data-subscription-id]', billed.subscriptionId || '—');
        applyBillingPeriod(billed);
        if (usage.usageNote) fill('[data-usage-note]', usage.usageNote);
        fillSettings(result);
        renderThreads(Array.isArray(result.threads) ? result.threads : []);
        renderObservability(Array.isArray(result.calls) ? result.calls : []);
        bindDashboardActions(result);
        if (window.renderTreenaDashboard) window.renderTreenaDashboard(result);
        setHidden('dash-pending', true);
        setHidden('dash-ready', false);
      } catch (_) {
        try { sessionStorage.removeItem(KEY.session); } catch (e) {}
        location.replace('/login');
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
            sessionId,
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
      const phoneInput = document.getElementById('pay-phone');
      const retainInput = document.getElementById('pay-retain');
      if (phoneInput && phoneInput.value.trim()) {
        const typed = normalizeE164(phoneInput.value);
        phoneInput.setCustomValidity(typed ? '' : 'Use an E.164 phone number, like +14155552671');
        if (typed) phone = typed;
      }
      if (retainInput) retainAfterCall = retainInput.checked ? 'on' : 'off';
      if (phoneInput && phoneInput.required && !payForm.reportValidity()) return;
      if (!email || !phone) {
        location.replace(href('account.html', plan.id));
        return;
      }
      try {
        sessionStorage.setItem(KEY.email, email);
        sessionStorage.setItem(KEY.phone, phone);
        sessionStorage.setItem(KEY.retain, retainAfterCall);
      } catch (_) {}
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
