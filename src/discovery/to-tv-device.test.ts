import { manualTvDevice, toTvDevice } from './to-tv-device';

describe('toTvDevice', () => {
  it('usa o primeiro IPv4 privado e o nome do serviço como id', () => {
    const device = toTvDevice({ name: 'TCL 55C735', port: 6466, ipv4: ['8.8.8.8', '192.168.0.20'] });
    expect(device).toEqual({ id: 'mdns:TCL 55C735', name: 'TCL 55C735', address: '192.168.0.20', port: 6466, protocol: 'androidtv' });
  });

  it('descarta serviço sem IPv4 privado', () => {
    expect(toTvDevice({ name: 'TV', port: 6466, ipv4: ['8.8.8.8'] })).toBeNull();
    expect(toTvDevice({ name: 'TV', port: 6466, ipv4: [] })).toBeNull();
  });

  it('limita o tamanho do nome e usa nome padrão quando vazio', () => {
    expect(toTvDevice({ name: 'x'.repeat(200), port: 1, ipv4: ['10.0.0.2'] })?.name).toHaveLength(64);
    expect(toTvDevice({ name: '  ', port: 1, ipv4: ['10.0.0.2'] })?.name).toBe('Android TV');
  });
});

describe('manualTvDevice', () => {
  it('aceita IP privado com espaços nas bordas', () => {
    expect(manualTvDevice(' 192.168.1.5 ')).toMatchObject({ id: 'ip:192.168.1.5', address: '192.168.1.5', port: 6466 });
  });

  it('recusa IP público ou inválido', () => {
    expect(manualTvDevice('8.8.8.8')).toBeNull();
    expect(manualTvDevice('192.168.1')).toBeNull();
  });
});
