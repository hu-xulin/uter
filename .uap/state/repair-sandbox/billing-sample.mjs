// UAP repair sandbox fixture — deliberately defective, NOT business code.
export function toPayAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid amount');
  return Math.min(Math.trunc(n * 100), 2147483647);
}

export function charge(amount) {
  const paid = toPayAmount(amount);
  return paid;
}
