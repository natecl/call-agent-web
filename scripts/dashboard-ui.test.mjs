import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/dashboard-ui.js', import.meta.url),'utf8');
function render(data, { search = '' } = {}) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        textContent: '',
        style: {},
        attributes: {},
        hidden: false,
        disabled: false,
        checked: false,
        setAttribute(k, v) { this.attributes[k] = v; },
        querySelector() { return element('bar'); },
      });
    }
    return elements.get(selector);
  };
  const context = {
    window: {},
    location: { hash: '#plan', search },
    addEventListener() {},
    document: {
      querySelector: element,
      querySelectorAll: s => s === '[data-view]' || s === '.account-view' ? [] : [element(s)],
    },
    Intl,
    Number,
    String,
    Math,
  };
  vm.runInNewContext(source, context);
  context.window.renderTreenaDashboard(data);
  return element;
}
test('included minutes and remaining render from account data', () => {
  const el = render({ name: 'Jamie Davis', usage: { minutesIncluded: 30, minutesUsed: 12, minutesRemaining: 18, state: 'ok', pack: { canPurchase: true, packsUsed: 0 } } });
  assert.equal(el('[data-minutes-remaining]').textContent, '18');
  assert.equal(el('bar').style.width, '40%');
  assert.equal(el('[data-cap-banner]').hidden, true);
  assert.equal(el('#buy-pack').disabled, false);
});
test('at cap remaining is 0 and does not invent metered overage dollars', () => {
  const el = render({
    usage: {
      minutesIncluded: 30,
      minutesUsed: 30,
      minutesRemaining: 0,
      prepaidMinutes: 0,
      state: 'at_cap',
      autoMeter: false,
      usageNote: 'At your minute cap. Add a 5-minute pack ($1.00) to place another call.',
      pack: { canPurchase: true, amountCents: 100, packsUsed: 0 },
    },
  });
  assert.equal(el('[data-minutes-remaining]').textContent, '0');
  assert.equal(el('[data-remaining-label]').textContent, 'At your minute cap');
  assert.equal(el('#usage').attributes['data-usage-state'], 'at_cap');
  assert.equal(el('[data-cap-banner]').hidden, false);
  assert.match(el('[data-cap-banner]').textContent, /\$1\.00/);
  assert.equal(el('bar').style.width, '100%');
  assert.equal(el('.meter').attributes['aria-valuenow'], '30');
  assert.equal(el('[data-overage-cost]').textContent, '');
});
test('after pack purchase remaining includes prepaid minutes', () => {
  const el = render({
    usage: {
      minutesIncluded: 30,
      minutesUsed: 30,
      prepaidMinutes: 5,
      minutesRemaining: 5,
      state: 'approaching',
      usageNote: 'Remaining minutes include prepaid pack minutes.',
      pack: { canPurchase: true, packsUsed: 1 },
    },
  });
  assert.equal(el('[data-minutes-remaining]').textContent, '5');
  assert.equal(el('[data-prepaid-minutes]').textContent, '5');
  assert.equal(el('[data-prepaid-row]').hidden, false);
  assert.equal(el('#buy-pack').disabled, false);
});
test('pack cap disables purchase without inventing overage', () => {
  const el = render({
    usage: {
      minutesIncluded: 30,
      minutesUsed: 90,
      prepaidMinutes: 60,
      minutesRemaining: 0,
      state: 'at_cap',
      pack: { canPurchase: false, atPackCap: true, packsUsed: 12, gatedReason: 'Pack cap reached (60 min / 12 packs this period).' },
    },
  });
  assert.equal(el('#buy-pack').disabled, true);
  assert.equal(el('[data-pack-gated]').hidden, false);
  assert.match(el('[data-pack-gated]').textContent, /12 packs/);
  assert.equal(el('[data-overage-cost]').textContent, '');
});
test('missing metrics do not produce NaN or invented identity', () => {
  const el = render({});
  assert.equal(el('[data-profile-email]').textContent, 'Not available');
  assert.equal(el('bar').style.width, '0%');
  assert.equal(el('[data-minutes-remaining]').textContent, '0');
});
test('profile values remain text and retention preference reflects account data', () => {
  const el = render({ name: '<script>alert(1)</script>', user: { retain_call_artifacts: true } });
  assert.equal(el('[data-profile-name]').textContent, '<script>alert(1)</script>');
  assert.equal(el('#dashboard-retain').checked, true);
  assert.equal(el('#dashboard-retain').attributes['aria-checked'], 'true');
  assert.equal(el('#privacy-retain-heading').textContent, 'Saving is on');
});
test('privacy summary uses persisted settings.retainAfterCall when Fly user is absent', () => {
  const el = render({ settings: { retainAfterCall: 'on' } });
  assert.equal(el('#dashboard-retain').checked, true);
  assert.equal(el('#privacy-retain-heading').textContent, 'Saving is on');
});
test('privacy summary stays Off by default when retain is off', () => {
  const el = render({ settings: { retainAfterCall: 'off' }, user: { retain_call_artifacts: false } });
  assert.equal(el('#dashboard-retain').checked, false);
  assert.equal(el('#dashboard-retain').attributes['aria-checked'], 'false');
  assert.equal(el('#privacy-retain-heading').textContent, 'Off by default');
});
test('pack=ok return shows recorded note', () => {
  const el = render({
    usage: { minutesIncluded: 30, minutesUsed: 30, minutesRemaining: 0, state: 'at_cap', pack: { canPurchase: true } },
  }, { search: '?pack=ok' });
  assert.equal(el('[data-pack-recorded]').hidden, false);
});
