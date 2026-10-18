// Shares can be fractional: 10 USDT at 4 USDT per share is 2.5 shares. Nothing is rounded to whole shares;
// the only rounding is at the 4th decimal digit (so up to 3 decimals are kept), e.g. 10 USDT at 3 USDT = 3.333.
export const SHARE_DECIMALS = 3
const FACTOR = 10 ** SHARE_DECIMALS

/** Smallest amount of shares an order can hold. */
export const MIN_SHARES = 1 / FACTOR

export const roundShares = (n) => Math.round((n + Number.EPSILON) * FACTOR) / FACTOR

/** Shares bought with `amountCents` at `priceCents` per share, rounded at the 4th decimal digit. */
export const sharesFor = (amountCents, priceCents) => Math.round((amountCents * FACTOR) / priceCents) / FACTOR
