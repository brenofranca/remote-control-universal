import { findBytes, findVarint, parseFields } from '../protocol/wire';

// Interpreta mensagens que o CLIENTE envia à TV, para os testes conferirem o que saiu no fio.
export const decodeRemoteMessageForTests = (payload: Uint8Array): string => {
  const parsed = parseFields(payload);
  if (!parsed.ok) return 'invalid';
  const fields = parsed.value;

  const configure = findBytes(fields, 1);
  if (configure) return 'configure';

  const setActive = findBytes(fields, 2);
  if (setActive) {
    const inner = parseFields(setActive);
    return inner.ok ? `setActive:${findVarint(inner.value, 1)}` : 'invalid';
  }

  const ping = findBytes(fields, 9);
  if (ping) {
    const inner = parseFields(ping);
    return inner.ok ? `pingResponse:${findVarint(inner.value, 1)}` : 'invalid';
  }

  const key = findBytes(fields, 10);
  if (key) {
    const inner = parseFields(key);
    return inner.ok ? `key:${findVarint(inner.value, 1)}:${findVarint(inner.value, 2)}` : 'invalid';
  }
  const appLink = findBytes(fields, 90);
  if (appLink) {
    const inner = parseFields(appLink);
    const link = inner.ok ? findBytes(inner.value, 1) : undefined;
    return link ? `appLink:${new TextDecoder().decode(link)}` : 'invalid';
  }
  return 'unknown';
};
