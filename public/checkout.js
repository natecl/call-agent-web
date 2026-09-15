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

  function validCheckoutSessionId(value) {
    const id = String(value || '').trim();
    return /^cs_(test|live)_/.test(id) ? id : '';
  }

  function withSession(file, sessionId, planId) {
    const params = new URLSearchParams();
    const sid = validCheckoutSessionId(sessionId);
    if (sid) params.set('session_id', sid);
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

  function showPlan(plan, opts) {
    const options = opts || {};
    const due = options.dueToday != null ? options.dueToday : plan.price;
    fill('[data-plan-name]', plan.name);
    fill('[data-plan-price]', String(plan.price));
    fill('[data-plan-minutes]', String(plan.minutes));
    fill('[data-plan-overage]', plan.overage);
    fill('[data-pay-label]', `Pay $${due}`);
    fill('[data-due-today]', String(due));
    showRow('[data-due-today-row]', Boolean(options.upgradeDelta));
  }

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  }

  function showStartPanel(id) {
    setHidden('start-pending', true);
    setHidden('start-name', id !== 'start-name');
    setHidden('start-phone', id !== 'start-phone');
    setHidden('start-ready', id !== 'start-ready');
    const current = ({ 'start-name': 'name', 'start-phone': 'phone', 'start-ready': 'imessage' })[id];
    const order = ['name', 'phone', 'imessage', 'dashboard'];
    const currentIndex = order.indexOf(current);
    document.querySelectorAll('[data-onboard]').forEach((li) => {
      const step = li.getAttribute('data-onboard');
      const index = order.indexOf(step);
      const isCurrent = step === current;
      li.classList.toggle('current', isCurrent);
      li.classList.toggle('complete', index > -1 && index < currentIndex);
      if (isCurrent) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

  function readStoredAccount() {
    const out = { email: '', phone: '', name: '', retainAfterCall: 'off' };
    try {
      out.email = sessionStorage.getItem(KEY.email) || '';
      out.phone = sessionStorage.getItem(KEY.phone) || '';
      out.name = sessionStorage.getItem(KEY.name) || '';
      out.retainAfterCall = sessionStorage.getItem(KEY.retain) === 'on' ? 'on' : 'off';
    } catch (_) {}
    return out;
  }

  function reservedUserPhones() {
    const out = ['+12138653024', '+12135690899'];
    const published = window.TREENA_IMESSAGE_E164;
    if (published && out.indexOf(published) === -1) out.push(published);
    return out;
  }

  function isReservedUserPhone(e164) {
    return Boolean(e164 && reservedUserPhones().indexOf(e164) !== -1);
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

  function rememberCsrf(token) {
    if (!token) return;
    csrfToken = token;
    try { sessionStorage.setItem(KEY.csrf, token); } catch (_) {}
  }

  function currentCsrf() {
    if (csrfToken) return csrfToken;
    try { csrfToken = sessionStorage.getItem(KEY.csrf) || ''; } catch (_) {}
    return csrfToken;
  }

  function withCsrfBody(headers, body, token) {
    if (!token || !body || typeof body !== 'string') return body;
    const type = String(headers['content-type'] || headers['Content-Type'] || '');
    if (!type.includes('application/json')) return body;
    try {
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.csrf) return body;
      parsed.csrf = token;
      return JSON.stringify(parsed);
    } catch (_) {
      return body;
    }
  }

  async function api(path, options) {
    const headers = Object.assign({}, (options && options.headers) || {});
    const method = String((options && options.method) || 'GET').toUpperCase();
    const token = currentCsrf();
    let body = options && options.body;
    if (token && method !== 'GET' && method !== 'HEAD') {
      headers['X-Treena-CSRF'] = token;
      body = withCsrfBody(headers, body, token);
    }
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}, { headers, body }));
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (data && data.csrf) rememberCsrf(data.csrf);
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
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

  function canUpgradeToPlus(billed) {
    return Boolean(
      billed
      && billed.plan === 'personal'
      && !billed.complimentary
      && billed.canManageBilling !== false
    );
  }

  function applyUpgradeCta(billed) {
    const show = canUpgradeToPlus(billed);
    document.querySelectorAll('[data-upgrade-plan]').forEach((el) => {
      el.hidden = !show;
    });
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
    rememberCsrf(me.csrf);
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

  function persistCheckoutSessionId(sessionId) {
    const sid = validCheckoutSessionId(sessionId);
    if (!sid) return '';
    try { sessionStorage.setItem(KEY.session, sid); } catch (_) {}
    try { localStorage.setItem(KEY.session, sid); } catch (_) {}
    return sid;
  }

  function storeSession(result, sessionId) {
    persistCheckoutSessionId((result && result.sessionId) || sessionId);
    try {
      if (result.plan) sessionStorage.setItem(KEY.plan, result.plan);
      if (result.email) sessionStorage.setItem(KEY.email, result.email);
      if (result.phone) sessionStorage.setItem(KEY.phone, result.phone);
      sessionStorage.setItem(KEY.retain, result.retainAfterCall === 'on' ? 'on' : 'off');
      if (result.name) sessionStorage.setItem(KEY.name, result.name);
    } catch (_) {}
  }

  function resolveSessionId() {
    const params = new URLSearchParams(location.search);
    const fromQuery = validCheckoutSessionId(params.get('session_id'));
    if (fromQuery) return persistCheckoutSessionId(fromQuery);
    try {
      const fromSession = validCheckoutSessionId(sessionStorage.getItem(KEY.session));
      if (fromSession) return persistCheckoutSessionId(fromSession);
    } catch (_) {}
    try {
      return persistCheckoutSessionId(localStorage.getItem(KEY.session));
    } catch (_) {}
    return '';
  }

  function rememberSessionInUrl(sessionId, planId) {
    const sid = validCheckoutSessionId(sessionId);
    if (!sid) return;
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('session_id') === sid) return;
      url.searchParams.set('session_id', sid);
      if (planId) url.searchParams.set('plan', planId);
      history.replaceState({}, '', url);
    } catch (_) {}
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

  function applyIMessage(cfg) {
    const im = cfg && cfg.imessage;
    if (!im || !im.e164) return;
    window.TREENA_IMESSAGE_E164 = im.e164;
    if (im.smsUrl) window.TREENA_MESSAGE_URL = im.smsUrl;
    document.querySelectorAll('a.text-relay').forEach((a) => {
      if (im.smsUrl) a.href = im.smsUrl;
    });
    document.querySelectorAll('[data-imessage-e164]').forEach((el) => {
      el.textContent = im.e164;
    });
  }

  function loadStripeMode() {
    return fetch('/api/config')
      .then((res) => res.json())
      .then((cfg) => {
        applyStripeMode(cfg);
        applyIMessage(cfg);
      })
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
            const plusUpgrade = plan && plan.id === 'plus' && !me.complimentary && me.plan === 'personal';
            if (!plusUpgrade) {
              location.replace('/dashboard');
              return;
            }
            showPlan(plan, { dueToday: 20, upgradeDelta: true });
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
        rememberSessionInUrl(result.sessionId || sessionId, result.plan || (paidPlan && paidPlan.id));
        const nameInput = document.getElementById('name');
        if (nameInput && (result.name || result.firstName) && !nameInput.value) {
          nameInput.value = result.name || result.firstName;
        }
        const phoneInput = document.getElementById('start-user-phone');
        if (phoneInput) {
          const fromAccount = result.phone || '';
          let fromStore = '';
          try { fromStore = sessionStorage.getItem(KEY.phone) || ''; } catch (_) {}
          if (!phoneInput.value) phoneInput.value = fromAccount || fromStore;
        }
        if (!hasName(result)) {
          showStartPanel('start-name');
        } else {
          showStartPanel('start-phone');
        }
      } catch (_) {
        try {
          if (!validCheckoutSessionId(sessionStorage.getItem(KEY.session))) {
            sessionStorage.removeItem(KEY.session);
          }
        } catch (e) {}
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
          if (typeof window.renderTreenaDashboard === 'function') {
            window.renderTreenaDashboard({
              ...result,
              name: saved.name,
              phone: saved.phone,
              firstName: saved.firstName || firstNameFrom(saved.name),
              settings: {
                ...(result.settings || {}),
                name: saved.name,
                phone: saved.phone,
                retainAfterCall: saved.retainAfterCall,
              },
              user: {
                ...(result.user || {}),
                retain_call_artifacts: saved.retainAfterCall === 'on',
              },
            });
          }
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

  function bindPackPurchase() {
    const buy = document.getElementById('buy-pack');
    if (!buy || buy.dataset.bound === '1') return;
    buy.dataset.bound = '1';
    buy.addEventListener('click', async () => {
      showError('pack-error', '');
      const latest = window.__treenaDashboard || {};
      const pack = (latest.usage && latest.usage.pack) || {};
      if (pack.canPurchase === false) {
        showError('pack-error', pack.gatedReason || 'Cannot purchase a minute pack');
        return;
      }
      buy.disabled = true;
      try {
        const checkout = await api('/api/billing/pack', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: resolveSessionId() || undefined }),
        });
        if (!checkout.url) throw new Error('Pack Checkout URL missing');
        location.href = checkout.url;
      } catch (error) {
        showError('pack-error', error.message || 'Could not start pack checkout');
        buy.disabled = false;
      }
    });
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
        rememberSessionInUrl(result.sessionId || sessionId, result.billing && result.billing.plan);
        const billed = result.billing || {};
        applyStripeMode(billed);
        applyComplimentary(billed);
        applyUpgradeCta(billed);
        const usage = result.usage || {};
        const billedPlan = PLANS[billed.plan];
        if (billedPlan) showPlan(billedPlan);
        fill('[data-first-name]', result.firstName || 'there');
        fill('[data-minutes-included]', String(usage.minutesIncluded ?? (billed.minutes || 0)));
        fill('[data-minutes-used]', String(usage.minutesUsed ?? 0));
        fill('[data-minutes-remaining]', String(usage.minutesRemaining ?? 0));
        fill('[data-call-count]', String(usage.callCount ?? 0));
        fill('[data-billing-status]', billed.status || 'active');
        fill('[data-subscription-id]', billed.subscriptionId || '—');
        applyBillingPeriod(billed);
        if (usage.usageNote) fill('[data-usage-note]', usage.usageNote);
        fillSettings(result);
        renderThreads(Array.isArray(result.threads) ? result.threads : []);
        renderObservability(Array.isArray(result.calls) ? result.calls : []);
        bindDashboardActions(result);
        bindPackPurchase();
        window.__treenaDashboard = result;
        if (window.renderTreenaDashboard) window.renderTreenaDashboard(result);
        setHidden('dash-pending', true);
        setHidden('dash-ready', false);
      } catch (_) {
        try { sessionStorage.removeItem(KEY.session); } catch (e) {}
        location.replace('/login');
      }
    })();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const sid = resolveSessionId();
      const path = sid
        ? `/api/dashboard?session_id=${encodeURIComponent(sid)}`
        : '/api/dashboard';
      api(path).then((fresh) => {
        window.__treenaDashboard = fresh;
        const usage = fresh.usage || {};
        fill('[data-minutes-remaining]', String(usage.minutesRemaining ?? 0));
        fill('[data-minutes-used]', String(usage.minutesUsed ?? 0));
        fill('[data-minutes-included]', String(usage.minutesIncluded ?? 0));
        fill('[data-call-count]', String(usage.callCount ?? 0));
        if (usage.usageNote) fill('[data-usage-note]', usage.usageNote);
        if (window.renderTreenaDashboard) window.renderTreenaDashboard(fresh);
      }).catch(() => {});
    });
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

  async function saveStartAccount({ name, phone }) {
    const stored = readStoredAccount();
    const sessionId = resolveSessionId() || undefined;
    const planForSave = paidPlan || plan || PLANS.personal;
    const saved = await api('/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        plan: (planForSave && planForSave.id) || 'personal',
        email: stored.email,
        name: name || stored.name,
        phone: phone || stored.phone,
        retainAfterCall: stored.retainAfterCall,
      }),
    });
    storeSession({
      sessionId,
      plan: saved.plan || (planForSave && planForSave.id),
      email: saved.email || stored.email,
      phone: saved.phone || phone || stored.phone,
      retainAfterCall: saved.retainAfterCall || stored.retainAfterCall,
      name: saved.name || name || stored.name,
    }, sessionId);
    rememberCsrf(saved.csrf);
    return { saved, sessionId, planForSave };
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
      const submit = nameForm.querySelector('[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Saving…';
      }
      try {
        try { sessionStorage.setItem(KEY.name, name); } catch (_) {}
        await saveStartAccount({ name });
        showStartPanel('start-phone');
      } catch (error) {
        const msg = error.message || 'Could not save your name';
        if (/phone number is required/i.test(msg)) {
          showStartPanel('start-phone');
        } else {
          showError('name-error', msg);
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Continue →';
        }
      }
    });
  }

  const phoneForm = document.getElementById('start-phone-form');
  if (phoneForm) {
    const phoneInput = document.getElementById('start-user-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
    }
    phoneForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('phone-error', '');
      const phone = phoneInput ? normalizeE164(phoneInput.value) : '';
      if (phoneInput) {
        if (!phone) {
          phoneInput.setCustomValidity('Use an E.164 phone number, like +14155552671');
        } else if (isReservedUserPhone(phone)) {
          phoneInput.setCustomValidity('Use your own phone number — the one you’ll text Treena from. Not Treena’s shared number.');
        } else {
          phoneInput.setCustomValidity('');
        }
      }
      if (!phoneForm.reportValidity()) return;
      const submit = phoneForm.querySelector('[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Saving…';
      }
      try {
        await saveStartAccount({ phone });
        showStartPanel('start-ready');
      } catch (error) {
        showError('phone-error', error.message || 'Could not save your phone');
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Continue →';
        }
      }
    });
  }

  const startDashboard = document.getElementById('start-dashboard');
  if (startDashboard) {
    startDashboard.addEventListener('click', () => {
      const planForSave = paidPlan || plan || PLANS.personal;
      location.replace(withSession('dashboard.html', resolveSessionId(), planForSave && planForSave.id));
    });
  }

  const payForm = document.getElementById('pay-form');
  if (payForm && plan) {
    const submit = payForm.querySelector('[type="submit"]');
    function currentPayDue() {
      const dueRow = document.querySelector('[data-due-today-row]');
      const dueEl = document.querySelector('[data-due-today]');
      if (dueRow && !dueRow.hidden && dueEl) {
        const n = Number(dueEl.textContent);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return plan.price;
    }
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
          submit.textContent = `Pay $${currentPayDue()}`;
        }
      }
    });
  }
})();
