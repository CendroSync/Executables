import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeText } from './CryptoService';

const STORAGE_KEYS = {
  TRANSFER_COUNT: '@p2p_transfer_count',
  NEVER_ASK_AGAIN: '@p2p_never_ask_again',
  HISTORY: '@p2p_clipboard_history',
  PAIRED_DEVICES: '@p2p_paired_devices',
  PENDING_REQUESTS: '@p2p_pending_requests',
  MY_DEVICE_CODE: '@p2p_my_device_code',
  HAS_SEEN_GUIDE: '@p2p_has_seen_guide',
};

export class StorageTracker {
  static async getHasSeenGuide() {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_GUIDE);
    return val === 'true';
  }

  static async setHasSeenGuide(val = true) {
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_GUIDE, val ? 'true' : 'false');
  }

  static async getMyDeviceCode() {
    let code = await AsyncStorage.getItem(STORAGE_KEYS.MY_DEVICE_CODE);
    if (!code) {
      code = 'AND-' + Math.floor(100 + Math.random() * 900);
      await AsyncStorage.setItem(STORAGE_KEYS.MY_DEVICE_CODE, code);
    }
    return code;
  }

  static async getPairedDevices() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICES);
    return data ? JSON.parse(data) : [];
  }

  static async setPairedDevices(devices) {
    await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(devices));
  }

  static async getPendingRequests() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REQUESTS);
    return data ? JSON.parse(data) : [];
  }

  static async setPendingRequests(requests) {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REQUESTS, JSON.stringify(requests));
  }

  static async addPendingRequest(device) {
    const pending = await this.getPendingRequests();
    const updated = pending.filter(d => d.code !== device.code);
    updated.push(device);
    await this.setPendingRequests(updated);
  }

  static async acceptPendingRequest(code) {
    const pending = await this.getPendingRequests();
    const device = pending.find(d => d.code === code);
    if (device) {
      const updatedPending = pending.filter(d => d.code !== code);
      await this.setPendingRequests(updatedPending);

      const paired = await this.getPairedDevices();
      const updatedPaired = paired.filter(d => d.code !== code);
      updatedPaired.push({ ...device, trusted: true });
      await this.setPairedDevices(updatedPaired);
      return device;
    }
    return null;
  }

  static async rejectPendingRequest(code) {
    const pending = await this.getPendingRequests();
    const updated = pending.filter(d => d.code !== code);
    await this.setPendingRequests(updated);
  }

  static async removePairedDevice(code) {
    const paired = await this.getPairedDevices();
    const updated = paired.filter(d => d.code !== code);
    await this.setPairedDevices(updated);
  }

  static async addOrUpdatePairedDevice(device) {
    const paired = await this.getPairedDevices();
    const existing = paired.find(d => (device.code && d.code === device.code) || (device.name && d.name === device.name));
    if (existing) {
      existing.ip = device.ip;
      if (device.code) existing.code = device.code;
      if (device.name) existing.name = device.name;
    } else {
      paired.push({
        code: device.code || `WIN-${Math.floor(100 + Math.random() * 900)}`,
        name: device.name || 'CendroSync Windows PC',
        ip: device.ip,
        trusted: true,
      });
    }
    await this.setPairedDevices(paired);
  }

  static async updatePairedDeviceIp(code, newIp) {
    const paired = await this.getPairedDevices();
    const device = paired.find(d => d.code === code);
    if (device) {
      device.ip = newIp;
      await this.setPairedDevices(paired);
    } else {
      await this.addOrUpdatePairedDevice({ code, ip: newIp });
    }
  }

  static async getHistory() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      // Filter out any corrupted entries with non-printable binary text
      return parsed
        .map(item => ({
          ...item,
          text: sanitizeText(item.text)
        }))
        .filter(item => item.text && item.text.trim().length > 0);
    } catch (e) {
      return [];
    }
  }

  static async addHistoryItem(text, direction) {
    const cleanText = sanitizeText(text);
    if (!cleanText || cleanText.trim().length === 0) return;

    const current = await this.getHistory();
    const newItem = {
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      text: cleanText,
      direction,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [newItem, ...current].slice(0, 50);
    await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  }

  static async deleteHistoryItem(id) {
    const current = await this.getHistory();
    const updated = current.filter((item) => item.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  }

  static async clearHistory() {
    await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
  }

  static async incrementTransferCount() {
    const neverAsk = await AsyncStorage.getItem(STORAGE_KEYS.NEVER_ASK_AGAIN);
    if (neverAsk === 'true') return null;

    const currentCountStr = await AsyncStorage.getItem(STORAGE_KEYS.TRANSFER_COUNT);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    const newCount = currentCount + 1;

    await AsyncStorage.setItem(STORAGE_KEYS.TRANSFER_COUNT, newCount.toString());

    if ([10, 30, 50, 100].includes(newCount)) {
      return newCount;
    }

    return null;
  }

  static async setNeverAskAgain() {
    await AsyncStorage.setItem(STORAGE_KEYS.NEVER_ASK_AGAIN, 'true');
  }

  static async getTransferCount() {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.TRANSFER_COUNT);
    return val ? parseInt(val, 10) : 0;
  }
}
