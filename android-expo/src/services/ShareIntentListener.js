import * as Network from 'expo-network';
import { CryptoService, sanitizeText } from './CryptoService';
import { StorageTracker } from './StorageTracker';

export class ShareIntentService {
  /**
   * Auto-discovers a target device on the local Wi-Fi subnet if its IP changed after a reboot.
   */
  static async autoDiscoverDeviceIp(targetCode) {
    try {
      const ipAddress = await Network.getIpAddressAsync();
      if (!ipAddress || ipAddress.includes(':') || ipAddress === '127.0.0.1') {
        return null;
      }
      const parts = ipAddress.split('.');
      if (parts.length !== 4) return null;
      const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;

      console.log(`[AutoDiscover] Probing subnet ${subnetPrefix}.1..254 for device code ${targetCode || 'any'}...`);

      const chunkSize = 32;
      for (let i = 1; i <= 254; i += chunkSize) {
        const chunkPromises = [];
        for (let j = i; j < Math.min(i + chunkSize, 255); j++) {
          const testIp = `${subnetPrefix}.${j}`;
          if (testIp === ipAddress) continue;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1600);

          chunkPromises.push(
            fetch(`http://${testIp}:52431/api/v1/ping`, {
              method: 'GET',
              signal: controller.signal,
            })
              .then(async (res) => {
                clearTimeout(timeoutId);
                if (res.ok) {
                  const info = await res.json();
                  if (info && info.device_code) {
                    if (!targetCode || info.device_code === targetCode) {
                      return { ip: testIp, code: info.device_code, name: info.device_name || 'Windows PC' };
                    }
                  }
                }
                return null;
              })
              .catch(() => {
                clearTimeout(timeoutId);
                return null;
              })
          );
        }

        const chunkResults = await Promise.all(chunkPromises);
        const match = chunkResults.find((r) => r !== null);
        if (match) {
          console.log(`[AutoDiscover] Successfully located Windows device at ${match.ip} (${match.name})`);
          return match;
        }
      }
    } catch (err) {
      console.warn('[AutoDiscover] Error during subnet probe:', err);
    }
    return null;
  }

  static async handleSharedText(sharedText) {
    const cleanText = sanitizeText(sharedText);
    if (!cleanText || cleanText.trim().length === 0) {
      return false;
    }

    try {
      let pairedDevices = await StorageTracker.getPairedDevices();
      const myCode = await StorageTracker.getMyDeviceCode();
      const payload = await CryptoService.encrypt(cleanText, myCode, 'Android Phone');

      // Tier 0: If no paired devices in storage, auto-discover ANY Windows PC on local Wi-Fi immediately!
      if (pairedDevices.length === 0) {
        console.log('[ShareIntent] No paired devices in storage. Auto-discovering Windows PC on local subnet...');
        const discovered = await ShareIntentService.autoDiscoverDeviceIp(null);
        if (discovered && discovered.ip) {
          await StorageTracker.addOrUpdatePairedDevice({
            code: discovered.code || 'WIN-AUTO',
            name: discovered.name || 'CendroSync Windows PC',
            ip: discovered.ip,
          });
          pairedDevices = await StorageTracker.getPairedDevices();
        }
      }

      let successCount = 0;

      // Tier 1: Try beaming to stored IP(s)
      for (const device of pairedDevices) {
        let targetIp = device.ip;
        let sent = false;

        if (targetIp) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

            const response = await fetch(`http://${targetIp}:52431/api/v1/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (response.ok) {
              console.log(`[ShareIntent] Beamed payload to stored IP ${targetIp}!`);
              sent = true;
              successCount++;
            }
          } catch (e) {
            console.warn(`[ShareIntent] Stored IP ${targetIp} unreachable. Probing subnet for updated IP...`);
          }
        }

        // Tier 2: Probe subnet specifically for this paired device code
        if (!sent) {
          const discovered = await ShareIntentService.autoDiscoverDeviceIp(device.code);
          if (discovered && discovered.ip) {
            await StorageTracker.addOrUpdatePairedDevice({
              code: device.code || discovered.code,
              name: device.name || discovered.name,
              ip: discovered.ip,
            });

            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);

              const response = await fetch(`http://${discovered.ip}:52431/api/v1/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);
              if (response.ok) {
                console.log(`[ShareIntent] Beamed payload to auto-discovered IP ${discovered.ip}!`);
                sent = true;
                successCount++;
              }
            } catch (retryErr) {
              console.error(`[ShareIntent] Retry send failed to ${discovered.ip}:`, retryErr);
            }
          }
        }
      }

      // Tier 3 Fallback: If still unsuccessful, probe subnet for ANY active CendroSync Windows PC
      if (successCount === 0) {
        console.log('[ShareIntent] Fallback: Searching subnet for any active CendroSync Windows PC...');
        const anyDiscovered = await ShareIntentService.autoDiscoverDeviceIp(null);
        if (anyDiscovered && anyDiscovered.ip) {
          await StorageTracker.addOrUpdatePairedDevice({
            code: anyDiscovered.code || 'WIN-AUTO',
            name: anyDiscovered.name || 'CendroSync Windows PC',
            ip: anyDiscovered.ip,
          });

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`http://${anyDiscovered.ip}:52431/api/v1/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (response.ok) {
              console.log(`[ShareIntent] Fallback beam succeeded to ${anyDiscovered.ip}!`);
              successCount++;
            }
          } catch (err) {
            console.error('[ShareIntent] Fallback send error:', err);
          }
        }
      }

      if (successCount > 0) {
        await StorageTracker.incrementTransferCount();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ShareIntent] Transmission error:', error);
      return false;
    }
  }
}
