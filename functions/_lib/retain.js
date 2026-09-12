const ON = new Set(['1', 'on', 'true', 'yes']);

export function normalizeRetain(input) {
  if (input === true || input === 1) return 'on';
  const raw = String(input ?? '').trim().toLowerCase();
  return ON.has(raw) ? 'on' : 'off';
}

export function retainIsOn(input) {
  return normalizeRetain(input) === 'on';
}
