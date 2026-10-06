export interface RateLimiterOptions {
  readonly maxEvents: number;
  readonly windowMs: number;
  readonly now?: () => number;
}

export interface RateLimiter {
  tryAcquire(): boolean;
}

export const createRateLimiter = ({ maxEvents, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter => {
  if (maxEvents < 1) throw new RangeError('maxEvents deve ser >= 1');
  if (windowMs < 1) throw new RangeError('windowMs deve ser >= 1');

  const accepted: number[] = [];

  return {
    tryAcquire() {
      const current = now();
      while (accepted.length > 0 && current - accepted[0] >= windowMs) accepted.shift();
      if (accepted.length >= maxEvents) return false;
      accepted.push(current);
      return true;
    },
  };
};
