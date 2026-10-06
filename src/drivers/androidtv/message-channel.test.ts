import { domainError } from '@/domain/errors';
import { MessageChannel } from './message-channel';

describe('MessageChannel', () => {
  it('entrega mensagens enfileiradas na ordem', async () => {
    const channel = new MessageChannel<number>();
    channel.push(1);
    channel.push(2);
    expect(await channel.next(50)).toEqual({ ok: true, value: 1 });
    expect(await channel.next(50)).toEqual({ ok: true, value: 2 });
  });

  it('entrega mensagem que chega depois do next', async () => {
    const channel = new MessageChannel<string>();
    const pending = channel.next(500);
    channel.push('oi');
    expect(await pending).toEqual({ ok: true, value: 'oi' });
  });

  it('falha com TIMEOUT quando nada chega', async () => {
    const channel = new MessageChannel<number>();
    const result = await channel.next(10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
  });

  it('timeout de um esperador não afeta o próximo', async () => {
    const channel = new MessageChannel<number>();
    await channel.next(5);
    const pending = channel.next(500);
    channel.push(7);
    expect(await pending).toEqual({ ok: true, value: 7 });
  });

  it('close acorda quem espera com o erro', async () => {
    const channel = new MessageChannel<number>();
    const pending = channel.next(500);
    channel.close(domainError('CONNECTION_FAILED', 'caiu'));
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONNECTION_FAILED');
  });

  it('entrega o que já estava na fila antes de reportar o fechamento', async () => {
    const channel = new MessageChannel<number>();
    channel.push(1);
    channel.close(domainError('CONNECTION_FAILED', 'caiu'));
    expect(await channel.next(50)).toEqual({ ok: true, value: 1 });
    expect((await channel.next(50)).ok).toBe(false);
  });

  it('ignora push depois de fechado', async () => {
    const channel = new MessageChannel<number>();
    channel.close(domainError('CONNECTION_FAILED', 'caiu'));
    channel.push(1);
    expect((await channel.next(50)).ok).toBe(false);
  });
});
