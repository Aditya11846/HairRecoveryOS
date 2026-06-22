import notifee, { AndroidImportance, TriggerType, RepeatFrequency, AuthorizationStatus } from '@notifee/react-native';
import { Platform } from 'react-native';
import { getTodayKey, loadCheckin } from '../utils/storage';

const CHANNEL_ID = 'hairos-checkin';
const NOTIF_ID = 'daily-checkin-reminder';
const SETTINGS_KEY = 'notif_hour';  // stored via storage.get/set
const DEFAULT_HOUR = 21; // 9 PM

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestPermission() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function getPermissionStatus() {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

// ─── Android channel (no-op on iOS) ──────────────────────────────────────────

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Daily Check-in Reminder',
      importance: AndroidImportance.HIGH,
    });
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function scheduleDailyReminder(hour = DEFAULT_HOUR) {
  await ensureChannel();
  await notifee.cancelNotification(NOTIF_ID);

  const trigger = buildTrigger(hour);

  await notifee.createTriggerNotification(
    {
      id: NOTIF_ID,
      title: '💊 Hair protocol check-in',
      body: "Don't break your streak — log today's meds in HairOS.",
      ios: { sound: 'default', foregroundPresentationOptions: { alert: true, badge: true, sound: true } },
      android: { channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
    },
    trigger,
  );
}

function buildTrigger(hour) {
  const now = new Date();
  const fire = new Date();
  fire.setHours(hour, 0, 0, 0);
  if (fire <= now) fire.setDate(fire.getDate() + 1); // already past today → tomorrow

  return {
    type: TriggerType.TIMESTAMP,
    timestamp: fire.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: { allowWhileIdle: true },
  };
}

// ─── Cancel (called when user logs today) ────────────────────────────────────

export async function cancelTodayReminder() {
  await notifee.cancelNotification(NOTIF_ID);
  // Re-schedule for tomorrow so future days still get reminded
  const { get } = await import('../utils/storage');
  const hour = await get(SETTINGS_KEY, DEFAULT_HOUR);
  await scheduleDailyReminder(hour);
}

// ─── On app foreground — check if already logged ──────────────────────────────

export async function syncReminderWithTodayLog() {
  try {
    const today = await loadCheckin(getTodayKey());
    const fullyLogged = today?.oralMinoxidil !== null && today?.topicalMinoxidil !== null;
    if (fullyLogged) {
      await cancelTodayReminder();
    }
  } catch {}
}

// ─── Init (call once on app start, after permission granted) ──────────────────

export async function initNotifications() {
  const granted = await requestPermission();
  if (!granted) return false;

  const { get } = await import('../utils/storage');
  const hour = await get(SETTINGS_KEY, DEFAULT_HOUR);

  // Only schedule if not already pending
  const pending = await notifee.getTriggerNotificationIds();
  if (!pending.includes(NOTIF_ID)) {
    await scheduleDailyReminder(hour);
  }
  return true;
}
