import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';

const { width } = Dimensions.get('window');

export function OnboardingModal({ visible, onClose }) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      icon: '⚡',
      badge: 'WELCOME',
      title: 'Welcome to CendrosyncP2P!',
      subtitle: 'Instant, encrypted local clipboard synchronization between Windows PC & Android.',
      bullets: [
        '🔒 End-to-End AES-256-GCM Encryption.',
        '📡 Direct local Wi-Fi transfer—no cloud or remote servers.',
        '⚡ Zero latency clipboard sharing.'
      ]
    },
    {
      icon: '🔗',
      badge: 'STEP 1',
      title: 'One-Time Device Pairing',
      subtitle: 'Pair your devices once on the same Wi-Fi network.',
      bullets: [
        '1. Ensure PC and Phone are connected to the same Wi-Fi network.',
        '2. Note your PC pairing code in Windows CendrosyncP2P Control Center.',
        '3. On Android, type this PC code into "PAIR NEW DEVICE" box and tap Connect (or tap any discovered device).',
        '4. Accept the pair request to link your devices permanently.'
      ]
    },
    {
      icon: '📱',
      badge: 'STEP 2',
      title: 'Beaming Android → PC',
      subtitle: '3 quick ways to send text from Android to Windows:',
      bullets: [
        '⚡ Notification Shade: Pull down your Android notification bar and tap "⚡ Beam to PC" anytime!',
        '📋 Quick Beam Button: Open app & tap "Beam Clipboard to Windows Now".',
        '📤 Share Sheet: Highlight text in Chrome/apps, tap "Share", and select CendrosyncP2P.'
      ]
    },
    {
      icon: '💻',
      badge: 'STEP 3',
      title: 'Syncing PC → Android',
      subtitle: 'Automatic copy detection on your Windows PC:',
      bullets: [
        '1. Copy any text on Windows.',
        '2. A micro-popup appears at bottom-right of your PC screen.',
        '3. Click "Send to Phone" to beam it to your Android clipboard!',
        '4. Taskbar System Tray icon gives quick access anytime.'
      ]
    },
    {
      icon: '⚙️',
      badge: 'STEP 4',
      title: 'Background Battery Setup',
      subtitle: 'Ensure reliable sync when phone is locked:',
      bullets: [
        '• Android battery optimization can kill background network listeners.',
        '• Tap "⚙️ Battery Setup" inside the app.',
        '• Set CendrosyncP2P battery usage to "Unrestricted" in Android Settings.',
        '• Now clipboards beam even when your screen is off!'
      ]
    }
  ];

  const current = steps[activeStep];

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.badge}>{current.badge} ({activeStep + 1}/{steps.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body Scroll */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10}}>
              {activeStep === 0 ? (
                <Image source={require('../../assets/logo.png')} style={{width: 38, height: 38, borderRadius: 10}} resizeMode="contain" />
              ) : (
                <View style={styles.inlineIconBadge}>
                  <Text style={styles.inlineIconText}>{current.icon}</Text>
                </View>
              )}
              <Text style={[styles.title, {marginBottom: 0, textAlign: 'left', flexShrink: 1}]}>{current.title}</Text>
            </View>
            <Text style={styles.subtitle}>{current.subtitle}</Text>

            <View style={styles.bulletsCard}>
              {current.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer Controls */}
          <View style={styles.footer}>
            <View style={styles.dotsRow}>
              {steps.map((_, idx) => (
                <TouchableOpacity key={idx} onPress={() => setActiveStep(idx)}>
                  <View style={[styles.dot, activeStep === idx && styles.activeDot]} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.navRow}>
              {activeStep > 0 ? (
                <TouchableOpacity style={styles.backBtn} onPress={() => setActiveStep(activeStep - 1)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
              ) : <View style={{ width: 70 }} />}

              {activeStep < steps.length - 1 ? (
                <TouchableOpacity style={styles.nextBtn} onPress={() => setActiveStep(activeStep + 1)}>
                  <Text style={styles.nextBtnText}>Next →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.finishBtn} onPress={onClose}>
                  <Text style={styles.finishBtnText}>Got It, Let's Sync! 🚀</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    height: 520,
    maxHeight: '90%',
    backgroundColor: '#161922',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12141c',
  },
  badge: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'stretch',
  },
  iconContainer: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineIconText: {
    fontSize: 18,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  bulletsCard: {
    width: '100%',
    backgroundColor: '#1d212d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bulletRow: {
    marginBottom: 10,
  },
  bulletText: {
    fontSize: 13,
    color: '#f3f4f6',
    lineHeight: 20,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12141c',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeDot: {
    width: 22,
    backgroundColor: '#6366f1',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  nextBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  finishBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  finishBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
});
