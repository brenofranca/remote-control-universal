import { createRateLimiter } from './rate-limiter';

describe('createRateLimiter', () => {
  it('permite até o limite dentro da janela', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxEvents: 3, windowMs: 1000, now: () => now });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('libera novamente após a janela passar', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxEvents: 2, windowMs: 1000, now: () => now });
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);
    now = 1000;
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('eventos bloqueados não estendem a janela', () => {
    let now = 0;
    const limiter = createRateLimiter({ maxEvents: 1, windowMs: 1000, now: () => now });
    limiter.tryAcquire();
    now = 500;
    limiter.tryAcquire();
    now = 1000;
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('rejeita configuração inválida', () => {
    expect(() => createRateLimiter({ maxEvents: 0, windowMs: 1000 })).toThrow(RangeError);
    expect(() => createRateLimiter({ maxEvents: 1, windowMs: 0 })).toThrow(RangeError);
  });
});
