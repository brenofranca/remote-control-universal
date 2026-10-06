import { domainError, type DomainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';

interface Waiter<T> {
  readonly resolve: (result: Result<T>) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export class MessageChannel<T> {
  private readonly queue: T[] = [];
  private readonly waiters: Waiter<T>[] = [];
  private closedWith: DomainError | null = null;

  push(value: T): void {
    if (this.closedWith) return;
    const waiter = this.waiters.shift();
    if (!waiter) {
      this.queue.push(value);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(ok(value));
  }

  close(error: DomainError): void {
    if (this.closedWith) return;
    this.closedWith = error;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(fail(error));
    }
  }

  next(timeoutMs: number): Promise<Result<T>> {
    if (this.queue.length > 0) return Promise.resolve(ok(this.queue.shift() as T));
    if (this.closedWith) return Promise.resolve(fail(this.closedWith));

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.findIndex((waiter) => waiter.timer === timer), 1);
        resolve(fail(domainError('TIMEOUT', 'A TV não respondeu a tempo.')));
      }, timeoutMs);
      this.waiters.push({ resolve, timer });
    });
  }
}
