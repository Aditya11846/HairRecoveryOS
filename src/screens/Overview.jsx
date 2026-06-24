import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getTodayKey, getStreakCount, getRecentCheckins, loadCheckin,
  daysToCheckpoint, get, set,
} from '../utils/storage';
import { Pill, Droplet, Sun, Shield } from '../components/Icon';
import RecoveryArc from '../components/RecoveryArc';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import { color, type, radius, space } from '../theme/tokens';

const isDutaDay = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;

const STRESS_LABEL = ['', 'None', 'Low', 'Med', 'High', 'Extreme'];
const DOW_LETTER   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const MED = [
  { id: 'oral',    label: 'Oral Min',  Icon: Pill,    accent: '#FFB020', key: 'oralMinoxidil' },
  { id: 'topical', label: 'Topical',   Icon: Droplet, accent: '#FF6B4A', key: 'topicalMinoxidil' },
  { id: 'rlc',     label: 'RLC',       Icon: Sun,     accent: '#FF9030', key: 'redLightComb' },
  { id: 'duta',    label: 'Duta',      Icon: Shield,  accent: '#CF8020', key: 'dutasteride' },
];

// ── Today Med Chip ────────────────────────────────────────────────────────────

function TodayMedChip({ med, status }) {
  const taken   = status === 'done';
  const skipped = status === 'skipped';
  const a       = med.accent;
  return (
    <View style={[
      chip.wrap,
      {
        backgroundColor: taken ? ra(a, 0.10) : skipped ? 'rgba(255,69,58,0.07)' : color.card2,
        borderColor:     taken ? ra(a, 0.28) : skipped ? 'rgba(255,69,58,0.18)' : color.line,
      },
    ]}>
      <med.Icon size={13} color={taken ? a : skipped ? color.red : color.faint} />
      <Text style={[chip.name, { color: taken ? a : skipped ? color.red : color.dim }]}>{med.label}</Text>
      <Text style={[chip.badge, { color: taken ? a : skipped ? color.red : color.faint }]}>
        {taken ? '✓' : skipped ? '✕' : '—'}
      </Text>
    </View>
  );
}

// ── Week Dots ─────────────────────────────────────────────────────────────────

function WeekDots({ days }) {
  return (
    <View style={wd.row}>
      {days.map((d, i) => {
        const logged = d.entry && (d.entry.oralMinoxidil || d.entry.topicalMinoxidil);
        const isToday = i === days.length - 1;
        return (
          <View key={i} style={wd.item}>
            <Text style={[wd.dow, isToday && { color: color.warmA }]}>{DOW_LETTER[d.dow]}</Text>
            <View style={[
              wd.dot,
              logged && wd.dotLogged,
              isToday && !logged && wd.dotToday,
            ]} />
          </View>
        );
      })}
    </View>
  );
}

// ── Adherence Bar ─────────────────────────────────────────────────────────────

function AdherenceBar({ med, pct, last }) {
  const hasData = pct > 0;
  return (
    <View style={[ab.row, !last && ab.border]}>
      <View style={[ab.strip, { backgroundColor: hasData ? med.accent : color.faint, opacity: hasData ? 1 : 0.3 }]} />
      <med.Icon size={13} color={hasData ? med.accent : color.faint} />
      <Text style={[ab.name, { color: hasData ? color.txt : color.dim }]}>{med.label}</Text>
      <View style={ab.track}>
        <View style={[ab.fill, { width: `${pct}%`, backgroundColor: med.accent }]} />
      </View>
      <Text style={[ab.pct, { color: pct >= 80 ? med.accent : pct >= 50 ? color.dim : color.faint }]}>
        {pct}%
      </Text>
    </View>
  );
}

// ── Life Stat Cell ────────────────────────────────────────────────────────────

function LifeStatCell({ label, value, accent }) {
  return (
    <View style={ls.cell}>
      <Text style={[ls.val, accent ? { color: accent } : {}]} numberOfLines={1}>{value ?? '—'}</Text>
      <Text style={ls.label}>{label}</Text>
    </View>
  );
}

// ── Recovery % Edit Modal ─────────────────────────────────────────────────────

function RecoveryEntryModal({ visible, current, onSave, onClose }) {
  const [val, setVal] = React.useState(current != null ? String(current) : '');
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) setVal(current != null ? String(current) : '');
  }, [visible, current]);

  const handleSave = () => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0 && n <= 100) { onSave(Math.round(n * 10) / 10); onClose(); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={rem.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[rem.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <Text style={rem.label}>Crown recovery estimate</Text>
            <Text style={rem.hint}>Monthly self-assessment. 0 = no change from baseline, 100 = full recovery.</Text>
            <View style={rem.inputRow}>
              <TextInput
                value={val}
                onChangeText={setVal}
                keyboardType="decimal-pad"
                placeholder="e.g. 42"
                placeholderTextColor={color.faint}
                style={rem.input}
                autoFocus
                maxLength={5}
              />
              <Text style={rem.pct}>%</Text>
            </View>
            <TouchableOpacity onPress={handleSave} style={rem.saveBtn} activeOpacity={0.8}>
              <Text style={rem.saveTxt}>Save</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Overview() {
  const insets = useSafeAreaInsets();

  const [todayCI, setTodayCI]                 = useState(null);
  const [streak, setStreak]                   = useState(0);
  const [recoveryLog, setRecoveryLog]         = useState([]);
  const [editingRecovery, setEditingRecovery] = useState(false);
  const [rec7Raw, setRec7Raw]                 = useState([]);

  useFocusEffect(
    useCallback(() => {
      const todayKey = getTodayKey();
      Promise.all([
        loadCheckin(todayKey),
        getStreakCount(),
        getRecentCheckins(7),
        get('recovery_log', []),
      ]).then(([ci, str, rec7, rlog]) => {
        setTodayCI(ci);
        setStreak(str);
        setRec7Raw(Array.isArray(rec7) ? rec7 : []);
        setRecoveryLog(Array.isArray(rlog) ? rlog : []);
      }).catch(() => {});
    }, [])
  );

  // Recovery arc
  const arcData         = recoveryLog.map(e => ({ date: e.date, value: e.value }));
  const currentRecovery = arcData.length ? arcData[arcData.length - 1].value : null;
  const peakIndex       = arcData.length
    ? arcData.reduce((mi, e, i, a) => e.value > a[mi].value ? i : mi, 0)
    : null;
  const projData        = arcData.length ? [...arcData, { date: '2026-09-01', value: 100 }] : [];
  const projectionFrom  = arcData.length || undefined;
  const arcXLabels      = arcData.length >= 2
    ? [new Date(arcData[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), 'now', "Sep '26"]
    : [];
  const prevChange      = arcData.length >= 2
    ? arcData[arcData.length - 1].value - arcData[arcData.length - 2].value
    : null;

  // Today
  const isDuta = isDutaDay();
  const activeMeds = MED.filter(m => m.id !== 'duta' || isDuta);
  const medStatus  = (key) => {
    if (!todayCI) return 'pending';
    return todayCI[key] === true ? 'done' : todayCI[key] === false ? 'skipped' : 'pending';
  };

  // 7-day dot grid — all 7 days, not just logged ones
  const entries7 = useMemo(() => {
    const map = new Map(rec7Raw.map(c => [c.date, c]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const dd   = String(d.getDate()).padStart(2, '0');
      const date = `${yyyy}-${mm}-${dd}`;
      return { date, dow: d.getDay(), entry: map.get(date) || null };
    });
  }, [rec7Raw]);

  const medAdherence = (key) => {
    if (!rec7Raw.length) return 0;
    return Math.round((rec7Raw.filter(c => c?.[key] === true).length / rec7Raw.length) * 100);
  };

  // Lifestyle 7d averages
  const sleepEntries  = rec7Raw.filter(c => typeof c?.sleep === 'number');
  const stressEntries = rec7Raw.filter(c => typeof c?.stress === 'number' && c.stress > 0);
  const avgSleep      = sleepEntries.length
    ? (sleepEntries.reduce((s, c) => s + c.sleep, 0) / sleepEntries.length).toFixed(1)
    : null;
  const avgStressNum  = stressEntries.length
    ? Math.round(stressEntries.reduce((s, c) => s + c.stress, 0) / stressEntries.length)
    : null;
  const avgCigsNum    = rec7Raw.length
    ? rec7Raw.reduce((s, c) => s + (c?.cigarettes ?? 0), 0) / rec7Raw.length
    : null;
  const sheddingDays  = rec7Raw.filter(c => c?.sheddingNoticed === true).length;

  const days   = daysToCheckpoint();
  const dayNum = Math.max(1, Math.round((new Date() - new Date('2026-06-01')) / 86400000) + 1);

  const handleSaveRecovery = async (value) => {
    const today = getTodayKey();
    const existing = recoveryLog.filter(e => e.date !== today);
    const updated = [...existing, { date: today, value }].sort((a, b) => a.date.localeCompare(b.date));
    await set('recovery_log', updated);
    setRecoveryLog(updated);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={s.eyebrow}>Day {dayNum} · {days} days to checkpoint</Text>
      <View style={s.titleRow}>
        <Text style={s.title}>Overview</Text>
        <View style={s.titleBadge}><Text style={s.titleBadgeTxt}>Phase 1</Text></View>
        {todayCI ? (
          <View style={s.loggedChip}><Text style={s.loggedChipTxt}>✓ Logged</Text></View>
        ) : (
          <View style={s.notLoggedChip}><Text style={s.notLoggedChipTxt}>Not logged</Text></View>
        )}
      </View>

      {/* ── TODAY ───────────────────────────────────────────────────────────── */}
      <SectionHeader
        label="Today"
        count={new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      />
      <Card flush style={s.overflowHidden}>
        {/* Med status chips */}
        <View style={s.chipRow}>
          {activeMeds.map(med => (
            <TodayMedChip key={med.id} med={med} status={medStatus(med.key)} />
          ))}
        </View>

        {/* Daily stats row */}
        {todayCI ? (
          <View style={s.todayStats}>
            <View style={s.statCell}>
              <Text style={s.statVal}>
                {todayCI.sleep ?? '—'}
                {todayCI.sleep != null && <Text style={s.statUnit}>h</Text>}
              </Text>
              <Text style={s.statLbl}>SLEEP</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statCell}>
              <Text style={s.statVal}>{todayCI.stress ? STRESS_LABEL[todayCI.stress] : '—'}</Text>
              <Text style={s.statLbl}>STRESS</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statCell}>
              <Text style={[s.statVal, (todayCI.cigarettes ?? 0) > 0 && { color: color.red }]}>
                {todayCI.cigarettes ?? 0}
              </Text>
              <Text style={s.statLbl}>CIGS</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statCell}>
              <Text style={[s.statVal, todayCI.sheddingNoticed && { color: color.warmA }]}>
                {todayCI.sheddingNoticed ? 'Yes' : 'No'}
              </Text>
              <Text style={s.statLbl}>SHED</Text>
            </View>
          </View>
        ) : (
          <Text style={s.notLoggedHint}>Log today to see daily stats</Text>
        )}
      </Card>

      {/* ── RECOVERY ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Recovery progress" />
      <Card flush style={s.overflowHidden}>
        <View style={s.recovTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.recovEyebrow}>CROWN RECOVERY</Text>
            <View style={s.recovNumRow}>
              <Text style={s.recovNum}>{currentRecovery != null ? Math.round(currentRecovery) : '—'}</Text>
              {currentRecovery != null && <Text style={s.recovUnit}>%</Text>}
            </View>
            {arcData.length > 0 && (
              <View style={s.metaRow}>
                {prevChange != null && (
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>CHANGE</Text>
                    <Text style={[s.metaVal, { color: prevChange >= 0 ? color.green : color.red }]}>
                      {prevChange >= 0 ? '+' : ''}{prevChange.toFixed(0)}%
                    </Text>
                  </View>
                )}
                {peakIndex != null && (
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>PEAK</Text>
                    <Text style={[s.metaVal, { color: color.warmA }]}>{arcData[peakIndex].value}%</Text>
                  </View>
                )}
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>GOAL</Text>
                  <Text style={[s.metaVal, { color: color.green }]}>100%</Text>
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditingRecovery(true)} style={s.updateBtn} activeOpacity={0.7}>
            <Text style={s.updateBtnTxt}>Update</Text>
          </TouchableOpacity>
        </View>
        <View style={s.arcSep} />
        {arcData.length >= 2 ? (
          <View style={s.arcWrap}>
            <RecoveryArc
              data={projData}
              peakIndex={peakIndex}
              projectionFrom={projectionFrom}
              xLabels={arcXLabels}
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingRecovery(true)} style={s.arcEmpty} activeOpacity={0.75}>
            <Text style={s.arcEmptyTxt}>Tap "Update" to log your first recovery estimate</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* ── THIS WEEK ───────────────────────────────────────────────────────── */}
      <SectionHeader label="This week" count={streak > 0 ? `${streak}d streak` : undefined} />
      <Card flush style={s.overflowHidden}>
        <WeekDots days={entries7} />
        <View style={s.barsWrap}>
          {activeMeds.map((med, i, arr) => (
            <AdherenceBar key={med.id} med={med} pct={medAdherence(med.key)} last={i === arr.length - 1} />
          ))}
        </View>
      </Card>

      {/* ── LIFESTYLE 7D AVG ────────────────────────────────────────────────── */}
      {rec7Raw.length > 0 && (
        <>
          <SectionHeader label="Lifestyle · 7d avg" />
          <Card flush style={s.overflowHidden}>
            <View style={s.lifeGrid}>
              <LifeStatCell
                label="SLEEP"
                value={avgSleep ? `${avgSleep}h` : null}
                accent={avgSleep && parseFloat(avgSleep) < 6 ? color.red : undefined}
              />
              <View style={s.lifeDiv} />
              <LifeStatCell
                label="STRESS"
                value={avgStressNum ? STRESS_LABEL[avgStressNum] : null}
                accent={avgStressNum >= 4 ? color.warmA : undefined}
              />
              <View style={s.lifeDiv} />
              <LifeStatCell
                label="CIGS / DAY"
                value={avgCigsNum != null ? avgCigsNum.toFixed(1) : null}
                accent={avgCigsNum > 0 ? color.red : undefined}
              />
              <View style={s.lifeDiv} />
              <LifeStatCell
                label="SHEDDING"
                value={`${sheddingDays}d`}
                accent={sheddingDays >= 4 ? color.warmA : undefined}
              />
            </View>
          </Card>
        </>
      )}

      <RecoveryEntryModal
        visible={editingRecovery}
        current={currentRecovery}
        onSave={handleSaveRecovery}
        onClose={() => setEditingRecovery(false)}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content:       { paddingHorizontal: 16 },
  overflowHidden:{ overflow: 'hidden' },

  eyebrow: { ...type.eyebrow, color: 'rgba(255,176,32,0.65)', marginBottom: 6 },

  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  title:            { ...type.screenTitle, color: color.warmA },
  titleBadge:       { backgroundColor: 'rgba(255,176,32,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,176,32,0.3)' },
  titleBadgeTxt:    { fontSize: 11, fontWeight: '700', color: color.warmA, letterSpacing: 0.3 },
  loggedChip:       { marginLeft: 'auto', backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(48,209,88,0.25)' },
  loggedChipTxt:    { fontSize: 11, fontWeight: '700', color: color.green, letterSpacing: 0.3 },
  notLoggedChip:    { marginLeft: 'auto', backgroundColor: color.card2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  notLoggedChipTxt: { fontSize: 11, fontWeight: '600', color: color.faint, letterSpacing: 0.3 },

  // Today card
  chipRow:       { flexDirection: 'row', gap: 8, padding: 12 },
  todayStats:    { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  statCell:      { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statDiv:       { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 10 },
  statVal:       { fontSize: 17, fontWeight: '700', letterSpacing: -0.4, color: color.txt, lineHeight: 22 },
  statUnit:      { fontSize: 12, fontWeight: '600', color: color.dim },
  statLbl:       { ...type.eyebrow, fontSize: 8, marginTop: 3 },
  notLoggedHint: { ...type.eyebrow, color: color.faint, textAlign: 'center', paddingVertical: 14 },

  // Recovery card
  recovTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 14 },
  recovEyebrow: { ...type.eyebrow, color: 'rgba(255,176,32,0.65)', marginBottom: 4 },
  recovNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  recovNum:     {
    ...type.heroNumber,
    color: color.warmA,
    lineHeight: 64,
    textShadowColor: 'rgba(255,176,32,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  recovUnit:   { fontSize: 28, fontWeight: '800', color: color.warmA, marginBottom: 8, letterSpacing: -1 },
  updateBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  updateBtnTxt:{ ...type.eyebrow, color: color.warmA, fontSize: 9 },

  metaRow:   { flexDirection: 'row', gap: 16 },
  metaItem:  { gap: 2 },
  metaLabel: { ...type.eyebrow, fontSize: 7 },
  metaVal:   { fontSize: 14, fontWeight: '700', letterSpacing: -0.3, fontFamily: 'System' },

  arcSep:     { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginHorizontal: 0 },
  arcWrap:    { paddingTop: 12, paddingBottom: 10, paddingHorizontal: 4 },
  arcEmpty:   { height: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: color.card2, borderRadius: radius.row, margin: 14 },
  arcEmptyTxt:{ ...type.eyebrow, color: color.faint, textAlign: 'center', paddingHorizontal: 16 },

  // Weekly
  barsWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },

  // Lifestyle
  lifeGrid: { flexDirection: 'row' },
  lifeDiv:  { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 14 },
});

const chip = StyleSheet.create({
  wrap:  { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.row, borderWidth: StyleSheet.hairlineWidth },
  name:  { fontSize: 10, fontWeight: '600', letterSpacing: 0.1 },
  badge: { fontSize: 13, fontWeight: '700' },
});

const wd = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  item:     { alignItems: 'center', gap: 6 },
  dow:      { ...type.eyebrow, fontSize: 8, color: color.faint },
  dot:      { width: 28, height: 28, borderRadius: 14, backgroundColor: color.card2, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  dotLogged:{ backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.35)' },
  dotToday: { borderColor: 'rgba(255,176,32,0.40)', borderWidth: 1.5 },
});

const ab = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingVertical: 11, gap: 10 },
  border:{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  strip: { width: 3, height: 20, borderRadius: 2 },
  name:  { fontSize: 13, fontWeight: '500', width: 66 },
  track: { flex: 1, height: 4, backgroundColor: color.card2, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: 4, borderRadius: 2 },
  pct:   { fontSize: 12, fontWeight: '700', width: 38, textAlign: 'right', letterSpacing: -0.2 },
});

const ls = StyleSheet.create({
  cell:  { flex: 1, alignItems: 'center', paddingVertical: 16 },
  val:   { ...type.statValue, fontSize: 18, color: color.txt },
  label: { ...type.eyebrow, marginTop: 5 },
});

const rem = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:   { backgroundColor: color.card, borderRadius: radius.card, padding: 24, width: '100%', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  label:   { ...type.heading, marginBottom: 8 },
  hint:    { fontSize: 13, color: color.dim, lineHeight: 18, marginBottom: 20 },
  inputRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  input:   { flex: 1, height: 56, backgroundColor: color.card2, borderRadius: radius.row, paddingHorizontal: 16, fontSize: 32, fontWeight: '800', color: color.warmA, letterSpacing: -1, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pct:     { fontSize: 28, fontWeight: '800', color: color.warmA },
  saveBtn: { height: 48, backgroundColor: color.warmA, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: 15, fontWeight: '700', color: '#1A1000' },
});
