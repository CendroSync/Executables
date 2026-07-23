import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { StorageTracker } from '../services/StorageTracker';

export const DonationModal = ({ visible, count, onClose }) => {
  const handleDonate = () => {
    Linking.openURL('https://buymeacoffee.com');
    onClose();
  };

  const handleNeverAskAgain = async () => {
    await StorageTracker.setNeverAskAgain();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.badge}>🎉 Milestone Reached</Text>
          <Text style={styles.title}>Buy Me a Coffee?</Text>
          <Text style={styles.description}>
            You've completed <Text style={styles.highlight}>{count}</Text> successful P2P clipboard transfers! If this app helps your daily workflow, consider supporting development.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleDonate}>
            <Text style={styles.primaryButtonText}>☕ Support Project</Text>
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={handleNeverAskAgain}>
              <Text style={styles.dangerButtonText}>Never Ask Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#1a1d28',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 20,
  },
  highlight: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#12141c',
  },
  secondaryButtonText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  dangerButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 13,
  },
});
