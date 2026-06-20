import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { CHECKPOINT_DATE } from '../constants/config';

export const PREFIX = 'hair_os_';

export const getTodayKey = () => new Date().toISOString().split('T')[0];
export const getCheckinKey = (dateStr) => `${PREFIX}checkin_${dateStr}`;

// ─── Schema mapping ───────────────────────────────────────────────────────────

const toSupabaseRow = (local) => ({
  date: local.date,
  oral_minoxidil: local.oralMinoxidil ?? null,
  topical_minoxidil: local.topicalMinoxidil ?? null,
  red_light: local.redLightComb ?? null,
  shedding: local.sheddingNoticed ?? null,
  cigarettes: typeof local.cigarettes === 'number' ? local.cigarettes : null,
  sleep: typeof local.sleep === 'number' ? local.sleep : null,
  stress: typeof local.stress === 'number' ? local.stress : null,
  notes: local.notes || '',
  // NOTE: dutasteride column needs to be added to Supabase checkins table
  // Run in Supabase SQL editor: ALTER TABLE checkins ADD COLUMN dutasteride boolean;
  // Once confirmed, uncomment the line below:
  // dutasteride: local.dutasteride ?? null,
});

const fromSupabaseRow = (row) => ({
  oralMinoxidil: row.oral_minoxidil,
  topicalMinoxidil: row.topical_minoxidil,
  dutasteride: null,
  cigarettes: row.cigarettes ?? 0,
  sleep: row.sleep ?? 7,
  stress: row.stress ?? 5,
  redLightComb: row.red_light,
  sheddingNoticed: row.shedding,
  notes: row.notes || '',
  date: row.date,
  savedAt: row.created_at,
  synced: true,
});

// ─── Supabase sync ────────────────────────────────────────────────────────────

const pushToSupabase = async (local) => {
  try {
    const { error } = await supabase
      .from('checkins')
      .upsert(toSupabaseRow(local), { onConflict: 'date' });
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

    const { data, error } = await supabase
      .from('checkins').select('*').eq('date', key).maybeSingle();
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

    const { error } = await supabase
      .from('checkins')
      .upsert(unsynced.map(toSupabaseRow), { onConflict: 'date' });

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
    return getCheckinKey(d.toISOString().split('T')[0]);
  });
  const result = await AsyncStorage.getMany(keys);
  let streak = 0;
  for (const key of keys) {
    const entry = result[key] ? JSON.parse(result[key]) : null;
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
    return getCheckinKey(d.toISOString().split('T')[0]);
  });
  const result = await AsyncStorage.getMany(keys);
  return keys.filter(k => result[k] !== null).map(k => JSON.parse(result[k]));
};

export const getLast30Days = async () => {
  const today = new Date();
  const meta = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    return {
      key: getCheckinKey(d.toISOString().split('T')[0]),
      date: d.toISOString().split('T')[0],
      dayNum: d.getDate(),
      month: d.getMonth(),
    };
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
    return {
      key: getCheckinKey(d.toISOString().split('T')[0]),
      date: d.toISOString().split('T')[0],
      dayNum: d.getDate(),
      month: d.getMonth(),
      dow: d.getDay(),
    };
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

    const { data, error } = await supabase
      .from('custom_protocols')
      .select('*')
      .eq('active', true)
      .order('added_at', { ascending: true });

    if (error || !data) return [];
    await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(data));
    return data;
  } catch {
    return [];
  }
};

export const addCustomProtocol = async (name, source) => {
  const protocol = { id: `local_${Date.now()}`, name, source, active: true, added_at: new Date().toISOString() };

  try {
    const existing = await getCustomProtocols();
    if (existing.some(p => p.name.toLowerCase() === name.toLowerCase())) return null;

    const updated = [...existing, protocol];
    await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(updated));

    try {
      const { data, error } = await supabase
        .from('custom_protocols')
        .insert({ name, source, active: true })
        .select()
        .single();

      if (!error && data) {
        const synced = updated.map(p => p.id === protocol.id ? data : p);
        await AsyncStorage.setItem(CUSTOM_PROTOCOLS_KEY, JSON.stringify(synced));
        return data;
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
