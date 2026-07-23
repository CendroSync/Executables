import * as Clipboard from 'expo-clipboard';
import { CryptoService, sanitizeText } from './CryptoService';
import { StorageTracker } from './StorageTracker';

let TcpSocket = null;
try {
  TcpSocket = require('react-native-tcp-socket');
  if (TcpSocket.default) {
    TcpSocket = TcpSocket.default;
  }
} catch (e) {
  console.warn('[TcpServer] react-native-tcp-socket native module not loaded in standard Expo Go sandbox.');
}

export class LocalTcpServer {
  server = null;
  static isSelfTriggered = false;

  startServer(port = 52431, onPayloadReceived, onPairRequest) {
    if (!TcpSocket || typeof TcpSocket.createServer !== 'function') {
      console.warn('[TcpServer] Native TCP Server is supported in custom prebuild APK.');
      return;
    }

    if (this.server) {
      console.log('[TcpServer] Server is already running.');
      return;
    }

    try {
      this.server = TcpSocket.createServer((socket) => {
        const clientIp = socket.remoteAddress;
        console.log(`[TcpServer] Client connected: ${clientIp}`);
        socket.rxBuffer = '';

        socket.on('data', async (data) => {
          try {
            socket.rxBuffer += data.toString('utf8');

            const jsonStartIndex = socket.rxBuffer.indexOf('{');
            const jsonEndIndex = socket.rxBuffer.lastIndexOf('}');
            if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
              return; // Wait for complete JSON block
            }

            const jsonString = socket.rxBuffer.substring(jsonStartIndex, jsonEndIndex + 1);
            socket.rxBuffer = ''; // Clear buffer once complete JSON frame is extracted

            const payload = JSON.parse(jsonString);

            // Handle Pair Requests from Windows
            if (payload.sender_code && payload.sender_name && !payload.payload && !payload.ciphertext) {
              console.log(`[TcpServer] Received pair request from ${payload.sender_name} (${clientIp})`);

              const paired = await StorageTracker.getPairedDevices();
              const isPaired = paired.find(d => d.code === payload.sender_code);

              if (isPaired) {
                await StorageTracker.updatePairedDeviceIp(payload.sender_code, clientIp);
              } else {
                const device = {
                  code: payload.sender_code,
                  name: payload.sender_name,
                  ip: clientIp,
                };
                await StorageTracker.addPendingRequest(device);
                if (onPairRequest) onPairRequest(device);
              }

              const myCode = await StorageTracker.getMyDeviceCode();
              socket.write(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"accepted":true,"device_code":"${myCode}","device_name":"Android Phone"}`);
              return;
            }

            console.log(`[TcpServer] Received payload from ${payload.sender_name} (${payload.sender_id}) at IP ${clientIp}`);

            // Security & Auto-Trust Check
            const paired = await StorageTracker.getPairedDevices();
            const isTrusted = paired.length === 0 ||
              (payload.sender_name && payload.sender_name.toLowerCase().includes('windows')) ||
              (payload.sender_id && payload.sender_id.startsWith('WIN-')) ||
              paired.some(d =>
                (payload.sender_id && d.code === payload.sender_id) ||
                (payload.sender_name && d.name === payload.sender_name) ||
                d.ip === clientIp
              );

            if (!isTrusted) {
              console.log(`[TcpServer] Rejecting sync from unauthorized device: ${payload.sender_name} (${payload.sender_id})`);
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\nUnauthorized');
              return;
            }

            // Auto-update or add paired device with real client IP
            await StorageTracker.addOrUpdatePairedDevice({
              code: payload.sender_id || 'WIN-492',
              name: payload.sender_name || 'CendroSync Windows PC',
              ip: clientIp,
            });

            const rawDecrypted = await CryptoService.decrypt(payload);
            const cleanPlaintext = sanitizeText(rawDecrypted);

            if (!cleanPlaintext) {
              console.warn('[TcpServer] Decrypted payload was empty or non-printable.');
              socket.write('HTTP/1.1 400 Bad Request\r\n\r\nEmpty or invalid text');
              return;
            }

            LocalTcpServer.isSelfTriggered = true;
            await Clipboard.setStringAsync(cleanPlaintext);

            console.log('[TcpServer] Successfully updated Android clipboard!');
            if (onPayloadReceived) {
              onPayloadReceived(cleanPlaintext);
            }

            socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nOK');

            setTimeout(() => {
              LocalTcpServer.isSelfTriggered = false;
            }, 500);
          } catch (err) {
            console.error('[TcpServer Error] Processing error:', err);
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\nError');
          }
        });

        socket.on('error', (error) => {
          console.error('[TcpServer Socket Error]', error);
        });
      });

      if (!this.server) {
        console.warn('[TcpServer] createServer returned null.');
        return;
      }

      this.server.listen({ port, host: '0.0.0.0' }, () => {
        console.log(`[TcpServer] Listening for Windows payloads on port ${port}`);
      });
    } catch (e) {
      console.error('[TcpServer Init Error]', e);
    }
  }

  stopServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  static isLocked() {
    return this.isSelfTriggered;
  }
}
