import 'react-native-get-random-values';
import forge from 'node-forge';

const RAW_KEY = new Uint8Array(32); // All zeros, 32 bytes (256 bits)

function uint8ArrayToForgeBuffer(arr) {
  let str = '';
  for (let i = 0; i < arr.length; i++) {
    str += String.fromCharCode(arr[i]);
  }
  return forge.util.createBuffer(str, 'raw');
}

export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  // Strip control characters except tab (\x09), newline (\x0A), and carriage return (\x0D)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

export class CryptoService {
  static async encrypt(text, senderId = 'AND-000', senderName = 'Android Phone') {
    const cleanText = sanitizeText(text);
    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const nonceBytes = new Uint8Array(12);
    crypto.getRandomValues(nonceBytes);

    const keyBuffer = uint8ArrayToForgeBuffer(RAW_KEY);
    const ivBuffer = uint8ArrayToForgeBuffer(nonceBytes);

    const textBytes = new TextEncoder().encode(cleanText);
    const textBuffer = uint8ArrayToForgeBuffer(textBytes);

    const cipher = forge.cipher.createCipher('AES-GCM', keyBuffer);
    cipher.start({
      iv: ivBuffer,
      tagLength: 128
    });
    cipher.update(textBuffer);
    cipher.finish();

    const ciphertextBytes = cipher.output.getBytes();
    const tagBytes = cipher.mode.tag.getBytes();

    return {
      protocol_version: '1.0',
      message_id: messageId,
      sender_id: senderId,
      sender_name: senderName,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: forge.util.encode64(uint8ArrayToForgeBuffer(nonceBytes).getBytes()),
      payload: forge.util.encode64(ciphertextBytes),
      tag: forge.util.encode64(tagBytes),
      signature: 'rsa_signature_placeholder',
    };
  }

  static async decrypt(payload) {
    if (!payload || !payload.nonce || !payload.payload || !payload.tag) {
      throw new Error('Invalid payload structure');
    }

    const keyBuffer = uint8ArrayToForgeBuffer(RAW_KEY);
    const ivBuffer = forge.util.createBuffer(forge.util.decode64(payload.nonce), 'raw');
    const tagBuffer = forge.util.createBuffer(forge.util.decode64(payload.tag), 'raw');
    const ciphertextBuffer = forge.util.createBuffer(forge.util.decode64(payload.payload), 'raw');

    const decipher = forge.cipher.createDecipher('AES-GCM', keyBuffer);
    decipher.start({
      iv: ivBuffer,
      tagLength: 128,
      tag: tagBuffer
    });
    decipher.update(ciphertextBuffer);
    const pass = decipher.finish();

    if (!pass) {
      throw new Error('Decryption authentication failed');
    }

    const rawBytesStr = decipher.output.getBytes();
    const bytes = new Uint8Array(rawBytesStr.length);
    for (let i = 0; i < rawBytesStr.length; i++) {
      bytes[i] = rawBytesStr.charCodeAt(i);
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return sanitizeText(decoded);
  }
}
