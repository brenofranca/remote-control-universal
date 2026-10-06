import { generateKeyPair } from 'react-native-quick-crypto';
import { MIN_RSA_KEY_BITS } from '../certificate';

const RSA_PUBLIC_EXPONENT = 0x10001;

/** Gera a chave RSA no módulo nativo (OpenSSL): em JS puro levaria dezenas de segundos ou mais. */
export const generateRsaPrivateKeyPem = (): Promise<string> =>
  new Promise((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: MIN_RSA_KEY_BITS,
        publicExponent: RSA_PUBLIC_EXPONENT,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      },
      (error, _publicKey, privateKey) => {
        if (error || typeof privateKey !== 'string') return reject(error ?? new Error('Chave RSA não gerada.'));
        resolve(privateKey);
      },
    );
  });
