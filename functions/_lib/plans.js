export const PLANS = {
  personal: {
    id: 'personal',
    name: 'Personal',
    amountCents: 2000,
    minutes: 30,
    overage: '0.15',
    priceEnv: 'STRIPE_PRICE_PERSONAL',
    productName: 'Treena Personal',
    productDescription: '30 connected min · $0.15/min overage',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    amountCents: 4000,
    minutes: 90,
    overage: '0.12',
    priceEnv: 'STRIPE_PRICE_PLUS',
    productName: 'Treena Plus',
    productDescription: '90 connected min · $0.12/min overage',
  },
};

export function getPlan(planId) {
  return PLANS[planId] || null;
}

/** Cap lock (Nathan): Personal $20 → Plus charges only this delta today. Recurring becomes Plus $40. */
export const PERSONAL_TO_PLUS_KIND = 'personal_to_plus';
export const PERSONAL_TO_PLUS_DELTA_CENTS = PLANS.plus.amountCents - PLANS.personal.amountCents;

export function isPersonalToPlusCheckout(obj) {
  if (!obj) return false;
  const metadata = obj.metadata || {};
  const kind = metadata.kind || obj.client_reference_id;
  const planId = metadata.plan || (kind === PERSONAL_TO_PLUS_KIND ? 'plus' : null);
  return kind === PERSONAL_TO_PLUS_KIND && planId === 'plus';
}
