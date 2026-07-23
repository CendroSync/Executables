import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import * as Clipboard from 'expo-clipboard';
import { ShareIntentService } from './src/services/ShareIntentListener';
import { StorageTracker } from './src/services/StorageTracker';
import App from './App';

// Register Notifee Foreground Service Task
notifee.registerForegroundService((notification) => {
  return new Promise(() => {
    // Keeps the foreground notification alive indefinitely on Android
  });
});

// Register Notifee Background Event Handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'beam') {
    console.log('[Notifee Background] "Beam" button pressed in notification!');
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        const success = await ShareIntentService.handleSharedText(text);
        if (success) {
          await StorageTracker.addHistoryItem(text, 'sent');
          console.log('[Notifee Background] Text successfully beamed to Windows PC!');
        }
      }
    } catch (e) {
      console.error('[Notifee Background Error]', e);
    }
  }
});

registerRootComponent(App);
