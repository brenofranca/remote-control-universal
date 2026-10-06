import { parsePrivateIPv4 } from './private-address';

describe('parsePrivateIPv4', () => {
  it.each(['10.0.0.1', '10.255.255.254', '172.16.0.1', '172.31.255.1', '192.168.0.10', '192.168.255.255', '169.254.1.1'])(
    'aceita endereço privado %s',
    (address) => {
      const result = parsePrivateIPv4(address);
      expect(result).toEqual({ ok: true, value: address });
    },
  );

  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '11.0.0.1', '1.1.1.1'])(
    'rejeita endereço público %s',
    (address) => {
      const result = parsePrivateIPv4(address);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_ADDRESS');
    },
  );

  it.each(['127.0.0.1', '0.0.0.0', '255.255.255.255', '224.0.0.1'])('rejeita loopback/especial %s', (address) => {
    expect(parsePrivateIPv4(address).ok).toBe(false);
  });

  it.each([
    '',
    ' 192.168.0.1',
    '192.168.0.1 ',
    '192.168.0',
    '192.168.0.1.5',
    '192.168.0.256',
    '192.168.0.-1',
    '192.168.00.1',
    '192.168.0.01',
    '0xC0.0xA8.0.1',
    '3232235521',
    '192.168.0.1:8080',
    'http://192.168.0.1',
    '::1',
    'fe80::1',
    'localhost',
    '192.168.0.1\n',
  ])('rejeita formato inválido %j', (address) => {
    expect(parsePrivateIPv4(address).ok).toBe(false);
  });

  it('não aceita valores que não são string', () => {
    expect(parsePrivateIPv4(undefined as unknown as string).ok).toBe(false);
    expect(parsePrivateIPv4(null as unknown as string).ok).toBe(false);
  });
});
