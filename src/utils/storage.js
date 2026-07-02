import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { CHECKPOINT_DATE } from '../constants/config';
import { withTimeout } from './fetchTimeout';

export const PREFIX = 'hair_os_';

// Always use local date — never toISOString() which returns UTC
const localDateStr = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getTodayKey = () => localDateStr();
export const getCheckinKey = (dateStr) => `${PREFIX}checkin_${dateStr}`;

// ─── Schema mapping ───────────────────────────────────────────────────────────

const toSupabaseRow = (local, { includeCustomValues = true } = {}) => ({
  date: local.date,
  oral_minoxidil: local.oralMinoxidil ?? null,
  topical_minoxidil: local.topicalMinoxidil ?? null,
  red_light: local.redLightComb ?? null,
  shedding: local.sheddingNoticed ?? null,
  cigarettes: typeof local.cigarettes === 'number' ? local.cigarettes : null,
  sleep: typeof local.sleep === 'number' ? local.sleep : null,
  stress: typeof local.stress === 'number' ? local.stress : null,
  notes: local.notes || '',
  dutasteride: local.dutasteride ?? null,
  ...(includeCustomValues && local.customValues && Object.keys(local.customValues).length > 0
    ? { custom_values: local.customValues }
    : {}),
});

const fromSupabaseRow = (row) => ({
  oralMinoxidil: row.oral_minoxidil,
  topicalMinoxidil: row.topical_minoxidil,
  dutasteride: row.dutasteride ?? null,
  cigarettes: row.cigarettes ?? 0,
  sleep: row.sleep ?? 7,
  stress: row.stress ?? null,
  redLightComb: row.red_light,
  sheddingNoticed: row.shedding,
  notes: row.notes || '',
  date: row.date,
  savedAt: row.created_at,
  synced: true,
  customValues: row.custom_values ?? {},
});

// ─── Supabase sync ────────────────────────────────────────────────────────────

const pushToSupabase = async (local) => {
  try {
    let { error } = await withTimeout(
      supabase.from('checkins').upsert(toSupabaseRow(local), { onConflict: 'date' }),
      8000, { error: 'timeout' },
    );
    // If upsert failed and we included custom_values, retry without it
    // (column may not exist yet in Supabase schema)
    if (error && local.customValues && Object.keys(local.customValues).length > 0) {
      ({ error } = await withTimeout(
        supabase.from('checkins').upsert(toSupabaseRow(local, { includeCustomValues: false }), { onConflict: 'date' }),
        8000, { error: 'timeout' },
      ));
    }
    if (!error) {
      await AsyncStorage.setItem(
        getCheckinKey(local.date),
        JSON.stringify({ ...local, synced: true }),
      );
    }
  } catch { /* offline */ }
};

// ─── Check-in ─────────────────────────────────────────────────────────────────

export const saveCheckin = async (data) => {
  const today = getTodayKey();
  const record = { ...data, date: today, savedAt: new Date().toISOString(), synced: false };
  await AsyncStorage.setItem(getCheckinKey(today), JSON.stringify(record));
  pushToSupabase(record);
};

export const loadCheckin = async (dateStr) => {
  const key = dateStr || getTodayKey();
  try {
    const raw = await AsyncStorage.getItem(getCheckinKey(key));
    if (raw) return JSON.parse(raw);

    const { data, error } = await withTimeout(
      supabase.from('checkins').select('*').eq('date', key).maybeSingle(),
      6000, { data: null, error: 'timeout' },
    );
    if (error || !data) return null;

    const local = fromSupabaseRow(data);
    await AsyncStorage.setItem(getCheckinKey(key), JSON.stringify(local));
    return local;
  } catch {
    return null;
  }
};

export const syncPendingCheckins = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const checkinKeys = allKeys.filter(k => k.startsWith(`${PREFIX}checkin_`));
    if (!checkinKeys.length) return;

    const result = await AsyncStorage.getMany(checkinKeys);
    const unsynced = Object.values(result)
      .filter(Boolean)
      .map(v => { try { return JSON.parse(v); } catch { return null; } })
      .filter(c => c && !c.synced);

    if (!unsynced.length) return;

    let { error } = await withTimeout(
      supabase.from('checkins').upsert(unsynced.map(toSupabaseRow), { onConflict: 'date' }),
      10000, { error: 'timeout' },
    );

    // If column missing (custom_values not yet added), retry without it
    if (error && unsynced.some(c => c.customValues && Object.keys(c.customValues).length > 0)) {
      ({ error } = await withTimeout(
        supabase.from('checkins').upsert(unsynced.map(c => toSupabaseRow(c, { includeCustomValues: false })), { onConflict: 'date' }),
        10000, { error: 'timeout' },
      ));
    }

    if (!error) {
      for (const c of unsynced) {
        await AsyncStorage.setItem(
          getCheckinKey(c.date),
          JSON.stringify({ ...c, synced: true }),
        );
      }
    }
  } catch { /* offline */ }
};

// ─── Batch reads ──────────────────────────────────────────────────────────────

export const getStreakCount = async () => {
  const today = new Date();
  const keys = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return getCheckinKey(localDateStr(d));
  });
  const result = await AsyncStorage.getMany(keys);

  // If today isn't fully logged yet, skip it — still show the prior streak
  const todayEntry = result[keys[0]] ? JSON.parse(result[keys[0]]) : null;
  const todayDone = todayEntry?.oralMinoxidil === true && todayEntry?.topicalMinoxidil === true;
  const start = todayDone ? 0 : 1;

  let streak = 0;
  for (let i = start; i < keys.length; i++) {
    const entry = result[keys[i]] ? JSON.parse(result[keys[i]]) : null;
    if (entry && entry.oralMinoxidil === true && entry.topicalMinoxidil === true) streak++;
    else break;
  }
  return streak;
};

export const getRecentCheckins = async (days = 7) => {
  const today = new Date();
  const keys = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return getCheckinKey(localDateStr(d));
  });
  const result = await AsyncStorage.getMany(keys);
  return keys.filter(k => result[k] !== null).map(k => JSON.parse(result[k]));
};

export const getLast30Days = async () => {
  const today = new Date();
  const meta = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const ds = localDateStr(d);
    return { key: getCheckinKey(ds), date: ds, dayNum: d.getDate(), month: d.getMonth() };
  });
  const result = await AsyncStorage.getMany(meta.map(m => m.key));
  return meta.map(m => ({
    date: m.date,
    dayNum: m.dayNum,
    month: m.month,
    hasCheckin: result[m.key] !== null,
    data: result[m.key] ? JSON.parse(result[m.key]) : null,
  }));
};

export const getLastNDays = async (n = 84) => {
  const today = new Date();
  const meta = Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (n - 1 - i));
    const ds = localDateStr(d);
    return { key: getCheckinKey(ds), date: ds, dayNum: d.getDate(), month: d.getMonth(), dow: d.getDay() };
  });
  const result = await AsyncStorage.getMany(meta.map(m => m.key));
  return meta.map(m => ({
    date: m.date,
    dayNum: m.dayNum,
    month: m.month,
    dow: m.dow,
    hasCheckin: result[m.key] !== null,
    data: result[m.key] ? JSON.parse(result[m.key]) : null,
  }));
};

// ─── Custom protocols ─────────────────────────────────────────────────────────

const CUSTOM_PROTOCOLS_KEY = `${PREFIX}custom_protocols`;

export const getCustomProtocols = async () => {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_PROTOCOLS_KEY);
    if (raw) return JSON.parse(raw);

    const { data, error } = await withTimeout(
      supabase.from('custom_protocols').select('*').eq('active', true).order('added_at', { ascending: true }),
      6000, { data: null, error: 'timeout' },
    );

    if (error || !data) return [];
    await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(data));
    return data;
  } catch {
    return [];
  }
};

export const addCustomProtocol = async ({ name, icon = 'lightning', dose = '', frequency = 'Daily', source = 'Manual' } = {}) => {
  const protocol = { id: `local_${Date.now()}`, name, icon, dose, frequency, source, active: true, added_at: new Date().toISOString() };

  try {
    const existing = await getCustomProtocols();
    if (existing.some(p => p.name.toLowerCase() === name.toLowerCase())) return null;

    const updated = [...existing, protocol];
    await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(updated));

    try {
      const { data, error } = await withTimeout(
        supabase.from('custom_protocols').insert({ name, icon, dose, frequency, source, active: true }).select().single(),
        8000, { data: null, error: 'timeout' },
      );

      if (!error && data) {
        // Merge: keep local fields (icon/dose/frequency), just adopt Supabase's authoritative id
        const synced = updated.map(p => p.id === protocol.id ? { ...p, id: data.id } : p);
        await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(synced));
        return { ...protocol, id: data.id };
      }
    } catch { /* offline — local only */ }

    return protocol;
  } catch {
    return null;
  }
};

export const isProtocolAdded = async (name) => {
  const protocols = await getCustomProtocols();
  return protocols.some(p => p.name.toLowerCase() === name.toLowerCase() && p.active);
};

export const removeCustomProtocol = async (id) => {
  const existing = await getCustomProtocols();
  const updated = existing.filter(p => p.id !== id);
  await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(updated));
  // Soft-delete from Supabase so deleted protocols don't reappear on fresh install
  if (!String(id).startsWith('local_')) {
    withTimeout(
      supabase.from('custom_protocols').update({ active: false }).eq('id', id),
      6000, { error: 'timeout' },
    ).catch(() => {});
  }
};

const PROTOCOL_GUIDES_KEY = `${PREFIX}protocol_guides`;

export const saveProtocolGuide = async (name, guide) => {
  try {
    const raw = await AsyncStorage.getItem(PROTOCOL_GUIDES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[name.toLowerCase()] = guide;
    await AsyncStorage.setItem(PROTOCOL_GUIDES_KEY, JSON.stringify(all));
  } catch {}
};

export const getProtocolGuide = async (name) => {
  try {
    const raw = await AsyncStorage.getItem(PROTOCOL_GUIDES_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[name.toLowerCase()] || null;
  } catch { return null; }
};

// ─── Generic KV ───────────────────────────────────────────────────────────────

export const get = async (key, fallback = null) => {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const set = async (key, value) => {
  await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
};

export const daysToCheckpoint = () => {
  const today = new Date();
  return Math.max(0, Math.ceil((CHECKPOINT_DATE - today) / (1000 * 60 * 60 * 24)));
};

// ─── Scalp photos (crown recovery) ─────────────────────────────────────────────

const SCALP_PHOTOS_BUCKET   = 'scalp-photos';
const SCALP_PHOTOS_CACHE_KEY = `${PREFIX}scalp_photos_meta`;
const SCALP_PHOTO_PENDING_KEY = `${PREFIX}scalp_photo_pending`;

// Rows: { id, date, storage_path, verdict, confidence, notes, created_at }, oldest first.
// If a capture is still queued locally (offline at capture time), it's appended last
// with synced:false and a `base64` field instead of storage_path, so the UI can show
// it immediately and cadence-gating sees it without waiting on a network round trip.
export const getScalpPhotos = async () => {
  let rows;
  try {
    const { data, error } = await withTimeout(
      supabase.from('scalp_photos').select('*').order('date', { ascending: true }),
      8000, { data: null, error: 'timeout' },
    );
    if (error || !data) {
      const raw = await AsyncStorage.getItem(SCALP_PHOTOS_CACHE_KEY);
      rows = raw ? JSON.parse(raw) : [];
    } else {
      await AsyncStorage.setItem(SCALP_PHOTOS_CACHE_KEY, JSON.stringify(data));
      rows = data;
    }
  } catch {
    rows = [];
  }

  const pending = await getPendingScalpPhoto();
  if (pending && !rows.some(r => r.date === pending.date)) rows = [...rows, { ...pending, id: 'pending', synced: false }];
  return rows;
};

export const getPendingScalpPhoto = async () => {
  try {
    const raw = await AsyncStorage.getItem(SCALP_PHOTO_PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const trySyncScalpPhoto = async (pending) => {
  try {
    const storage_path = await uploadScalpPhoto(pending.base64, pending.date);
    await saveScalpPhotoRecord({ date: pending.date, storage_path, verdict: pending.verdict, confidence: pending.confidence, notes: pending.notes });
    await AsyncStorage.removeItem(SCALP_PHOTO_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
};

// Retries a queued-but-unsynced capture — call on app foreground, mirroring syncPendingCheckins.
export const syncPendingScalpPhoto = async () => {
  const pending = await getPendingScalpPhoto();
  if (pending) await trySyncScalpPhoto(pending);
};

// Offline-safe capture: persists locally first (so a network blip never loses the
// photo/verdict), then attempts to sync immediately. Mirrors the saveCheckin /
// syncPendingCheckins local-first pattern used for daily check-ins.
export const captureScalpPhoto = async ({ date, base64, verdict, confidence, notes }) => {
  const pending = { date, base64, verdict, confidence, notes };
  await AsyncStorage.setItem(SCALP_PHOTO_PENDING_KEY, JSON.stringify(pending));
  const synced = await trySyncScalpPhoto(pending);
  return { ...pending, synced };
};

// base64Jpeg: raw base64 string, no "data:image/jpeg;base64," prefix
export const uploadScalpPhoto = async (base64Jpeg, dateStr) => {
  const path = `${dateStr}.jpg`;
  const { error } = await supabase.storage.from(SCALP_PHOTOS_BUCKET).upload(path, decode(base64Jpeg), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
};

// Fetches a remote image and returns raw base64 (no data: prefix), or null on failure.
export const fetchImageAsBase64 = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(String(reader.result).split(',')[1] || null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const getScalpPhotoSignedUrl = async (storagePath, expiresIn = 3600) => {
  try {
    const { data, error } = await supabase.storage.from(SCALP_PHOTOS_BUCKET).createSignedUrl(storagePath, expiresIn);
    return error ? null : (data?.signedUrl || null);
  } catch {
    return null;
  }
};

export const saveScalpPhotoRecord = async ({ date, storage_path, verdict, confidence, notes }) => {
  const { data, error } = await withTimeout(
    supabase.from('scalp_photos').insert({ date, storage_path, verdict, confidence, notes }).select().single(),
    8000, { data: null, error: 'timeout' },
  );
  if (error) throw error;
  await AsyncStorage.removeItem(SCALP_PHOTOS_CACHE_KEY); // force refresh on next getScalpPhotos()
  return data;
};
