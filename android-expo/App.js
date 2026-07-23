import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, Linking, Image } from 'react-native';
import { LocalTcpServer } from './src/services/LocalTcpServer';
import { ShareIntentService } from './src/services/ShareIntentListener';
import { StorageTracker } from './src/services/StorageTracker';
import { OnboardingModal } from './src/components/OnboardingModal';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network';
import notifee, { EventType, AndroidImportance } from '@notifee/react-native';

export default function App() {
  const [myCode, setMyCode] = useState('AND-92A');
  const [targetCode, setTargetCode] = useState('');
  const [history, setHistory] = useState([]);
  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pairedDevices, setPairedDevices] = useState([]);

  const refreshHistory = async () => {
    const items = await StorageTracker.getHistory();
    setHistory(items);
  };

  const refreshDevices = async () => {
    const pending = await StorageTracker.getPendingRequests();
    const paired = await StorageTracker.getPairedDevices();
    setPendingRequests(pending);
    setPairedDevices(paired);
  };

  const startForegroundService = async () => {
    try {
      await notifee.requestPermission();

      const channelId = await notifee.createChannel({
        id: 'p2p-sync',
        name: 'P2P Background Sync',
        importance: AndroidImportance.LOW,
      });

      await notifee.displayNotification({
        id: 'p2p-sync-notification',
        title: '⚡ CendrosyncP2P Sync Active',
        body: 'Tap "⚡ Beam" to send clipboard to PC',
        android: {
          channelId,
          asForegroundService: true,
          ongoing: true,
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: '⚡ Beam to PC',
              pressAction: { id: 'beam' },
            },
          ],
        },
      });
    } catch (e) {
      console.warn('Failed to start foreground service', e);
    }
  };

  useEffect(() => {
    StorageTracker.getMyDeviceCode().then(setMyCode);
    refreshHistory();
    startForegroundService();

    StorageTracker.getHasSeenGuide().then(hasSeen => {
      if (!hasSeen) {
        setIsGuideVisible(true);
        StorageTracker.setHasSeenGuide(true);
      }
    });

    StorageTracker.getPairedDevices().then(async (paired) => {
      setPairedDevices(paired);
      if (paired.length === 0) {
        scanNetwork();
      } else {
        for (const d of paired) {
          const discovered = await ShareIntentService.autoDiscoverDeviceIp(d.code);
          if (discovered && discovered.ip && discovered.ip !== d.ip) {
            await StorageTracker.updatePairedDeviceIp(d.code, discovered.ip);
            refreshDevices();
          }
        }
      }
    });
    
    StorageTracker.getPendingRequests().then(setPendingRequests);

    const tcpServer = new LocalTcpServer();
    tcpServer.startServer(52431, async (receivedText) => {
      await StorageTracker.addHistoryItem(receivedText, 'received');
      await refreshHistory();
    }, async (device) => {
      Alert.alert('Pairing Request', `${device.name} wants to pair with this device!`);
      await refreshDevices();
    });

    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction.id === 'beam') {
        setTimeout(async () => {
          await handleTestSend();
        }, 300);
      }
    });

    return () => {
      tcpServer.stopServer();
      unsubscribe();
    };
  }, []);

  const scanNetwork = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    try {
      const ip = await Network.getIpAddressAsync();
      const parts = ip.split('.');
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const scanPromises = [];
        for (let i = 1; i <= 254; i++) {
          const testIp = `${subnet}.${i}`;
          if (testIp === ip) continue;
          
          scanPromises.push(
            new Promise(async (resolve) => {
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 800);
                const res = await fetch(`http://${testIp}:52431/api/v1/ping`, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                  const data = await res.json();
                  setDiscoveredDevices(prev => {
                    if (!prev.some(d => d.ip === testIp)) {
                      return [...prev, { ip: testIp, name: data.device_name }];
                    }
                    return prev;
                  });
                }
              } catch (e) {}
              resolve();
            })
          );
        }
        await Promise.all(scanPromises);
      }
    } catch (e) {}
    setIsScanning(false);
  };

  const handlePairDevice = async () => {
    if (!targetCode.trim()) {
      Alert.alert('Error', 'Please enter a device code');
      return;
    }

    let targetIp = selectedDevice ? selectedDevice.ip : (discoveredDevices[0] ? discoveredDevices[0].ip : null);

    if (!targetIp) {
      try {
        const ip = await Network.getIpAddressAsync();
        const parts = ip.split('.');
        if (parts.length === 4) {
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
          for (let i = 1; i <= 254; i++) {
            const testIp = `${subnet}.${i}`;
            if (testIp === ip) continue;
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 400);
              const res = await fetch(`http://${testIp}:52431/api/v1/ping`, { signal: controller.signal });
              clearTimeout(timeout);
              if (res.ok) {
                targetIp = testIp;
                break;
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    if (!targetIp) {
      Alert.alert('Device Not Found', 'Could not find any Windows PC on your Wi-Fi network. Ensure CendrosyncP2P is running on your PC.');
      return;
    }

    try {
      const response = await fetch(`http://${targetIp}:52431/api/v1/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_code: myCode,
          sender_name: 'Android Phone',
          sender_ip: '',
        }),
      });

      if (response.ok) {
        const paired = await StorageTracker.getPairedDevices();
        const updated = paired.filter(d => d.code !== targetCode);
        updated.push({
          code: targetCode,
          name: 'Windows PC',
          ip: targetIp,
          trusted: true
        });
        await StorageTracker.setPairedDevices(updated);
        await refreshDevices();
        Alert.alert('Pair Request Sent 🚀', `Sent pairing request to ${targetCode}. Check your Windows screen to click Accept!`);
      } else {
        Alert.alert('Pairing Failed', 'Could not reach Windows PC on local Wi-Fi.');
      }
    } catch (e) {
      Alert.alert('Connection Error', 'Ensure CendrosyncP2P is open on Windows PC.');
    }
  };

  const handleTestSend = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) {
      Alert.alert('Clipboard Empty', 'Copy some text first');
      return;
    }

    const success = await ShareIntentService.handleSharedText(text);
    if (success) {
      await StorageTracker.addHistoryItem(text, 'sent');
      await refreshHistory();
      const milestone = await StorageTracker.incrementTransferCount();
      if (milestone) {
        setDonationCount(milestone);
        setIsModalVisible(true);
      }
      const count = await StorageTracker.getTransferCount();
      setTransferCount(count);
      Alert.alert('Success', 'Text beamed to Windows!');
    } else {
      Alert.alert('Error', 'Failed to reach Windows PC IP');
    }
  };

  const handleCopyHistory = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Item copied to system clipboard!');
  };

  const handleDeleteHistory = async (id) => {
    await StorageTracker.deleteHistoryItem(id);
    await refreshHistory();
  };

  const handleClearAllHistory = async () => {
    Alert.alert('Clear History', 'Are you sure you want to delete all history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await StorageTracker.clearHistory();
          await refreshHistory();
        },
      },
    ]);
  };

  const handleAcceptRequest = async (code) => {
    await StorageTracker.acceptPendingRequest(code);
    await refreshDevices();
    Alert.alert('Paired', 'Device is now trusted for life!');
  };

  const handleRejectRequest = async (code) => {
    await StorageTracker.rejectPendingRequest(code);
    await refreshDevices();
  };

  const handleUnpairDevice = async (code) => {
    Alert.alert('Unpair', 'Are you sure you want to remove this trusted device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          await StorageTracker.removePairedDevice(code);
          await refreshDevices();
        },
      },
    ]);
  };

  const openBatterySettings = () => {
    Alert.alert(
      'Background Sync Reliability',
      'To keep P2P Sync running in the background, please set its Battery Usage to "Unrestricted" in Android Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
            <Image source={require('./assets/logo.png')} style={{width: 44, height: 44, borderRadius: 10}} />
            <View>
              <Text style={styles.title}>CendrosyncP2P</Text>
              <Text style={styles.badge}>Clipboard & History</Text>
            </View>
          </View>
        </View>

        {/* Setup Background Battery & Help Guide */}
        <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
          <TouchableOpacity style={[styles.batteryBtn, {flex: 1, marginBottom: 0}]} onPress={openBatterySettings}>
            <Text style={styles.batteryBtnText}>⚙️ Battery Setup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batteryBtn, {flex: 1, marginBottom: 0, backgroundColor: 'rgba(99, 102, 241, 0.15)'}]} onPress={() => setIsGuideVisible(true)}>
            <Text style={[styles.batteryBtnText, {color: '#818cf8'}]}>❓ User Guide</Text>
          </TouchableOpacity>
        </View>

        {/* Device Code Header */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR DEVICE PAIRING CODE</Text>
          <Text style={styles.codeValue}>{myCode}</Text>
        </View>

        {/* Pair Remote Device */}
        <View style={styles.card}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.cardTitle}>Discover Windows PCs</Text>
            <TouchableOpacity onPress={scanNetwork}>
              <Text style={styles.clearBtnText}>{isScanning ? 'Scanning...' : 'Rescan'}</Text>
            </TouchableOpacity>
          </View>
          
          {isScanning && discoveredDevices.length === 0 && <ActivityIndicator color="#6366f1" style={{marginVertical: 10}}/>}
          
          {!isScanning && discoveredDevices.length === 0 && (
            <Text style={styles.emptyText}>No devices found on local network.</Text>
          )}

          {discoveredDevices.map(device => (
            <TouchableOpacity 
              key={device.ip} 
              style={[styles.deviceItem, selectedDevice?.ip === device.ip && styles.deviceItemSelected]}
              onPress={() => setSelectedDevice(device)}>
              <Text style={styles.deviceItemText}>💻 {device.name}</Text>
              <Text style={styles.deviceItemIp}>{device.ip}</Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.inputRow, {marginTop: 15}]}>
            <TextInput
              style={styles.input}
              value={targetCode}
              onChangeText={setTargetCode}
              placeholder="Pairing Code (e.g. XY792B)"
              placeholderTextColor="#6b7280"
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handlePairDevice}>
              <Text style={styles.saveBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.card}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.cardTitle}>Pending Requests</Text>
            </View>
            {pendingRequests.map(device => (
              <View key={device.code} style={styles.historyItem}>
                <View style={styles.historyItemMain}>
                  <Text style={styles.deviceItemText}>💻 {device.name}</Text>
                  <Text style={styles.deviceItemIp}>Code: {device.code} ({device.ip})</Text>
                </View>
                <View style={styles.historyItemActions}>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => handleAcceptRequest(device.code)}>
                    <Text style={styles.actionIconText}>✔️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => handleRejectRequest(device.code)}>
                    <Text style={styles.actionIconText}>❌</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Paired Devices */}
        {pairedDevices.length > 0 && (
          <View style={styles.card}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.cardTitle}>Trusted Devices</Text>
            </View>
            {pairedDevices.map(device => (
              <View key={device.code} style={styles.historyItem}>
                <View style={styles.historyItemMain}>
                  <Text style={styles.deviceItemText}>✅ {device.name}</Text>
                  <Text style={styles.deviceItemIp}>{device.ip}</Text>
                </View>
                <View style={styles.historyItemActions}>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => handleUnpairDevice(device.code)}>
                    <Text style={styles.actionIconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Beam */}
        <TouchableOpacity style={styles.sendBtn} onPress={handleTestSend}>
          <Text style={styles.sendBtnText}>Beam Clipboard to Windows Now</Text>
        </TouchableOpacity>

        {/* History Card Section */}
        <View style={styles.card}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.cardTitle}>Clipboard History</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleClearAllHistory}>
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyText}>No synced clipboard entries yet.</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyItemMain}>
                  <Text style={item.direction === 'sent' ? styles.tagSent : styles.tagRecv}>
                    {item.direction === 'sent' ? '💻 SENT' : '📱 RECV'}
                  </Text>
                  <Text style={styles.historyItemText} numberOfLines={2}>
                    {item.text}
                  </Text>
                </View>
                <View style={styles.historyItemActions}>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => handleCopyHistory(item.text)}>
                    <Text style={styles.actionIconText}>📋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon} onPress={() => handleDeleteHistory(item.id)}>
                    <Text style={styles.actionIconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.statsFooter}>
          <Text style={styles.statsText}>Made with ❤️ by Cendronyx</Text>
        </View>
      </ScrollView>

      <OnboardingModal
        visible={isGuideVisible}
        onClose={() => setIsGuideVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12141c',
  },
  content: {
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 16,
  },
  badge: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  codeCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818cf8',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: '#1a1d28',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f3f4f6',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#12141c',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceItem: {
    backgroundColor: '#12141c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  deviceItemSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  deviceItemText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  deviceItemIp: {
    color: '#6b7280',
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  batteryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  batteryBtnText: {
    color: '#d1d5db',
    fontWeight: '600',
    fontSize: 13,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  historyItem: {
    backgroundColor: '#12141c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  historyItemMain: {
    flex: 1,
    marginRight: 10,
    overflow: 'hidden',
  },
  tagSent: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  tagRecv: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  historyItemText: {
    color: '#d1d5db',
    fontSize: 13,
    fontFamily: 'monospace',
    flexWrap: 'wrap',
  },
  historyItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
  },
  actionIconText: {
    fontSize: 14,
  },
  statsFooter: {
    alignItems: 'center',
    marginTop: 8,
  },
  statsText: {
    color: '#6b7280',
    fontSize: 12,
  },
});
