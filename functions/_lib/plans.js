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
