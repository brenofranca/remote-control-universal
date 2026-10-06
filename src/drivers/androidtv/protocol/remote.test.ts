import {
  decodeRemoteMessage,
  encodeAppLinkLaunch,
  encodeKeyInject,
  encodePingResponse,
  encodeRemoteConfigure,
  encodeSetActive,
  Feature,
  negotiateFeatures,
} from './remote';
import { concatBytes, lengthDelimitedField, varintField } from './wire';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((char) => char.charCodeAt(0));

describe('encode (cliente para TV)', () => {
  it('KeyInject SHORT do HOME (keycode 3)', () => {
    expect(Array.from(encodeKeyInject(3, 'SHORT'))).toEqual([0x52, 0x04, 0x08, 0x03, 0x10, 0x03]);
  });

  it('KeyInject START_LONG e END_LONG', () => {
    expect(Array.from(encodeKeyInject(26, 'START_LONG'))).toEqual([0x52, 0x04, 0x08, 0x1a, 0x10, 0x01]);
    expect(Array.from(encodeKeyInject(26, 'END_LONG'))).toEqual([0x52, 0x04, 0x08, 0x1a, 0x10, 0x02]);
  });

  it('AppLinkLaunch envia o link no campo 90', () => {
    const link = 'market://launch?id=com.netflix.ninja';
    expect(Array.from(encodeAppLinkLaunch(link))).toEqual([0xd2, 0x05, link.length + 2, 0x0a, link.length, ...ascii(link)]);
  });

  it('AppLinkLaunch rejeita link vazio ou grande demais', () => {
    expect(() => encodeAppLinkLaunch('')).toThrow(RangeError);
    expect(() => encodeAppLinkLaunch('x'.repeat(513))).toThrow(RangeError);
  });

  it('PingResponse ecoa val1', () => {
    expect(Array.from(encodePingResponse(5))).toEqual([0x4a, 0x02, 0x08, 0x05]);
  });

  it('SetActive envia as features ativas', () => {
    expect(Array.from(encodeSetActive(611))).toEqual([0x12, 0x03, 0x08, 0xe3, 0x04]);
  });

  it('RemoteConfigure responde com features e identificação do cliente', () => {
    const expected = [
      0x0a, 0x1b, 0x08, 0x62, 0x12, 0x17, 0x18, 0x01, 0x22, 0x01, 0x31, 0x2a, 0x09, ...ascii('atvremote'), 0x32, 0x05,
      ...ascii('1.0.0'),
    ];
    expect(Array.from(encodeRemoteConfigure(0x62))).toEqual(expected);
  });

  it.each([-1, 1.5, 2 ** 32])('rejeita keycode inválido %p', (code) => {
    expect(() => encodeKeyInject(code, 'SHORT')).toThrow(RangeError);
  });
});

describe('negotiateFeatures', () => {
  it('ativa apenas o que o app quer e a TV suporta', () => {
    const supported = Feature.PING | Feature.KEY | Feature.IME | Feature.VOICE;
    expect(negotiateFeatures(supported)).toBe(Feature.PING | Feature.KEY);
  });

  it('inclui power, volume e app link quando suportados', () => {
    const supported = Feature.PING | Feature.KEY | Feature.POWER | Feature.VOLUME | Feature.APP_LINK;
    expect(negotiateFeatures(supported)).toBe(supported);
  });
});

describe('decodeRemoteMessage (TV para cliente)', () => {
  it('remote_configure retorna features suportadas', () => {
    const inner = varintField(1, 611);
    const message = lengthDelimitedField(1, inner);
    expect(decodeRemoteMessage(message)).toEqual({ ok: true, value: { kind: 'configure', supportedFeatures: 611 } });
  });

  it('remote_set_active', () => {
    expect(decodeRemoteMessage(lengthDelimitedField(2, varintField(1, 1)))).toEqual({
      ok: true,
      value: { kind: 'setActive' },
    });
  });

  it('remote_ping_request retorna val1', () => {
    const message = lengthDelimitedField(8, varintField(1, 42));
    expect(decodeRemoteMessage(message)).toEqual({ ok: true, value: { kind: 'pingRequest', val1: 42 } });
  });

  it('remote_start informa se a TV está ligada', () => {
    expect(decodeRemoteMessage(lengthDelimitedField(40, varintField(1, 1)))).toEqual({
      ok: true,
      value: { kind: 'start', started: true },
    });
    expect(decodeRemoteMessage(lengthDelimitedField(40, bytes()))).toEqual({
      ok: true,
      value: { kind: 'start', started: false },
    });
  });

  it('remote_error', () => {
    expect(decodeRemoteMessage(lengthDelimitedField(3, bytes()))).toEqual({ ok: true, value: { kind: 'error' } });
  });

  it('mensagens desconhecidas (volume, ime) são ignoradas sem falhar', () => {
    const message = concatBytes(lengthDelimitedField(50, varintField(1, 10)), lengthDelimitedField(21, bytes()));
    expect(decodeRemoteMessage(message)).toEqual({ ok: true, value: { kind: 'ignored' } });
  });

  it('falha em bytes malformados sem lançar exceção', () => {
    expect(decodeRemoteMessage(bytes(0x0a, 0x7f)).ok).toBe(false);
  });
});
