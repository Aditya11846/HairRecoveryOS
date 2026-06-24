import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getTodayKey, getStreakCount, getRecentCheckins, loadCheckin,
  daysToCheckpoint, getLast30Days, get, set,
} from '../utils/storage';
import { getDailyRead } from '../services/ai';
import { Pill, Droplet, Sun, Shield, Flask, Dna, Check, Lightning, Cigarette } from '../components/Icon';
import Card from '../components/Card';
import { color, type, radius, space, font } from '../theme/tokens';

const CAMPAIGN_START = new Date('2026-06-01');
const CAMPAIGN_END   = new Date('2026-09-01');
const TOTAL_DAYS     = Math.ceil((CAMPAIGN_END - CAMPAIGN_START) / 86400000);

const isDutaDay = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const MED = [
  { id: 'oral',    label: 'Oral Min', Icon: Pill,    accent: color.warmA, key: 'oralMinoxidil',    timing: 'Morning' },
  { id: 'topical', label: 'Topical',  Icon: Droplet, accent: color.warmB, key: 'topicalMinoxidil', timing: 'Bedtime' },
  { id: 'rlc',     label: 'RLC',      Icon: Sun,     accent: color.amber, key: 'redLightComb',     timing: 'Anytime' },
  { id: 'duta',    label: 'Duta',     Icon: Shield,  accent: color.copper,key: 'dutasteride',      timing: 'Morning' },
];

// ── Completion ring ───────────────────────────────────────────────────────────

function CompletionRing({ done, total }) {
  const SIZE  = 80;
  const SW    = 5;
  const r     = (SIZE - SW * 2) / 2;
  const cx    = SIZE / 2;
  const cy    = SIZE / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = total > 0 ? done / total : 0;
  const allDone  = done === total && total > 0;
  const arcColor = allDone ? color.green : done > 0 ? color.warmA : color.faint;

  return (
    <View style={ring.wrap}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <SvgCircle cx={cx} cy={cy} r={r} stroke={color.line} strokeWidth={SW} fill="none" />
        {done > 0 && (
          <SvgCircle
            cx={cx} cy={cy} r={r}
            stroke={arcColor}
            strokeWidth={SW}
            fill="none"
            strokeDasharray={`${pct * circ} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx},${cy}`}
          />
        )}
      </Svg>
      {allDone ? (
        <Check size={22} color={color.green} />
      ) : (
        <Text style={[ring.label, { color: done > 0 ? color.warmA : color.faint }]}>
          {done}/{total}
        </Text>
      )}
    </View>
  );
}

// ── Med chip ──────────────────────────────────────────────────────────────────

function MedChip({ med, status }) {
  const done    = status === 'done';
  const skipped = status === 'skipped';
  const a       = med.accent;
  return (
    <View style={[
      chip.wrap,
      {
        backgroundColor: done ? ra(a, 0.10) : skipped ? ra(color.red, 0.07) : color.card2,
        borderColor:     done ? ra(a, 0.28) : skipped ? ra(color.red, 0.18) : color.line,
      },
    ]}>
      <med.Icon size={14} color={done ? a : skipped ? color.red : color.faint} />
      <Text style={[chip.label, { color: done ? a : skipped ? color.red : color.dim }]}>
        {med.label}
      </Text>
      <Text style={[chip.status, { color: done ? a : skipped ? color.red : color.faint }]}>
        {done ? '✓' : skipped ? '✕' : '—'}
      </Text>
    </View>
  );
}

// ── Signal row ────────────────────────────────────────────────────────────────

function SignalRow({ IconComp, iconColor, text, last }) {
  return (
    <View style={[sig.row, !last && sig.border]}>
      <View style={[sig.dot, { backgroundColor: ra(iconColor, 0.12), borderColor: ra(iconColor, 0.20) }]}>
        <IconComp size={13} color={iconColor} />
      </View>
      <Text style={sig.text}>{text}</Text>
    </View>
  );
}

// ── Coming-up row ─────────────────────────────────────────────────────────────

function AheadRow({ IconComp, iconColor, label, desc, value, last }) {
  return (
    <View style={[ah.row, !last && ah.border]}>
      <View style={[ah.iconBox, { backgroundColor: ra(iconColor, 0.10), borderColor: ra(iconColor, 0.18) }]}>
        <IconComp size={15} color={iconColor} />
      </View>
      <View style={ah.body}>
        <Text style={ah.label}>{label}</Text>
        {desc ? <Text style={ah.desc}>{desc}</Text> : null}
      </View>
      {value ? <Text style={[ah.value, { color: iconColor }]}>{value}</Text> : null}
    </View>
  );
}

// ── Recovery % entry modal ────────────────────────────────────────────────────

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
            <Text style={rem.heading}>Crown recovery estimate</Text>
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

export default function Overview({ navigation }) {
  const insets = useSafeAreaInsets();

  const [todayCI, setTodayCI]                 = useState(null);
  const [streak, setStreak]                   = useState(0);
  const [adherence7d, setAdherence7d]         = useState(null);
  const [recoveryLog, setRecoveryLog]         = useState([]);
  const [editingRecovery, setEditingRecovery] = useState(false);
  const [avg30dCigs, setAvg30dCigs]           = useState(null);
  const [bloodworkAt, setBloodworkAt]         = useState(null);
  const [dailyRead, setDailyRead]             = useState(null);

  useFocusEffect(
    useCallback(() => {
      const todayKey = getTodayKey();
      Promise.all([
        loadCheckin(todayKey),
        getStreakCount(),
        getRecentCheckins(7),
        get('recovery_log', []),
        getLast30Days(),
        get('bloodwork', null),
      ]).then(([ci, str, rec7, rlog, last30, bw]) => {
        setTodayCI(ci);
        setStreak(str);
        const full = rec7.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length;
        const adh  = rec7.length ? Math.round((full / rec7.length) * 100) : null;
        setAdherence7d(adh);
        setRecoveryLog(Array.isArray(rlog) ? rlog : []);
        setBloodworkAt(bw?.testedAt || null);

        const withData  = last30.filter(d => d.data !== null);
        const cigAvg    = withData.length > 0
          ? parseFloat((withData.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / withData.length).toFixed(1))
          : null;
        setAvg30dCigs(cigAvg);

        getDailyRead({
          streak: str,
          adherence7d: adh,
          todayLogged: ci !== null,
          cigsToday: ci?.cigarettes ?? 0,
          avg30dCigs: cigAvg,
          sleep: ci?.sleep ?? null,
          stress: ci?.stress ?? null,
        }).then(text => { if (text) setDailyRead(text); }).catch(() => {});
      }).catch(() => {});
    }, [])
  );

  // ── Derived ─────────────────────────────────────────────────────────────────

  const arcData         = recoveryLog.map(e => ({ date: e.date, value: e.value }));
  const currentRecovery = arcData.length ? arcData[arcData.length - 1].value : null;
  const peakRecovery    = arcData.length ? Math.max(...arcData.map(e => e.value)) : null;

  const dayNum     = Math.max(1, Math.ceil((new Date() - CAMPAIGN_START) / 86400000));
  const daysLeft   = daysToCheckpoint();
  const isDuta     = isDutaDay();
  const activeMeds = MED.filter(m => m.id !== 'duta' || isDuta);

  const medStatus = (key) => {
    if (!todayCI) return 'pending';
    return todayCI[key] === true ? 'done' : todayCI[key] === false ? 'skipped' : 'pending';
  };

  const doneMeds   = activeMeds.filter(m => medStatus(m.key) === 'done').length;
  const allDone    = doneMeds === activeMeds.length && activeMeds.length > 0;
  const nextDueMed = activeMeds.find(m => medStatus(m.key) === 'pending');

  const adherenceColor = adherence7d == null ? color.dim
    : adherence7d >= 80 ? color.warmA
    : adherence7d >= 50 ? color.dim
    : color.red;

  // Bloodwork coming-up state
  let bloodworkLabel, bloodworkDesc, bloodworkVal;
  if (!bloodworkAt) {
    bloodworkLabel = 'No bloodwork on file';
    bloodworkDesc  = 'Schedule first panel';
    bloodworkVal   = null;
  } else {
    const nextDate   = new Date(bloodworkAt);
    nextDate.setDate(nextDate.getDate() + 90);
    const daysUntil  = Math.ceil((nextDate - new Date()) / 86400000);
    if (daysUntil < 0) {
      bloodworkLabel = 'Bloodwork overdue';
      bloodworkDesc  = `${Math.abs(daysUntil)}d past due`;
      bloodworkVal   = null;
    } else {
      bloodworkLabel = 'Next bloodwork';
      bloodworkDesc  = daysUntil <= 14 ? 'Due soon' : null;
      bloodworkVal   = `${daysUntil}d`;
    }
  }

  // TODAY hero text
  let heroTitle, heroSub;
  if (!todayCI) {
    heroTitle = `${activeMeds.length} treatments due`;
    heroSub   = 'Nothing logged yet';
  } else if (allDone) {
    heroTitle = 'All logged today';
    heroSub   = 'Protocol complete';
  } else {
    heroTitle = `${doneMeds} of ${activeMeds.length} done`;
    heroSub   = nextDueMed ? `Next: ${nextDueMed.label} · ${nextDueMed.timing}` : '';
  }

  // Signals
  const signals = [];
  if (streak > 0 && !todayCI) {
    signals.push({ key: 'risk', Ic: Lightning, c: color.amber, text: `Streak at risk — log today to keep your ${streak}-day run` });
  } else if (streak > 0 && allDone) {
    signals.push({ key: 'streak', Ic: Check, c: color.green, text: `${streak}-day streak secured` });
  }
  if ((todayCI?.cigarettes ?? 0) > 0 && avg30dCigs != null) {
    const n = todayCI.cigarettes;
    signals.push({ key: 'cigs', Ic: Cigarette, c: color.red, text: `${n} cig${n !== 1 ? 's' : ''} today vs ${avg30dCigs} 30-day avg — #1 modifiable lever` });
  }

  const handleSaveRecovery = async (value) => {
    const today   = getTodayKey();
    const existing = recoveryLog.filter(e => e.date !== today);
    const updated  = [...existing, { date: today, value }].sort((a, b) => a.date.localeCompare(b.date));
    await set('recovery_log', updated);
    setRecoveryLog(updated);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* 1 ── Header ─────────────────────────────────────────────────────────── */}
      <Text style={s.eyebrow}>Campaign · Phase 1 · Day {dayNum}</Text>
      <Text style={s.title}>Overview</Text>

      {/* 2 ── North-star strip ───────────────────────────────────────────────── */}
      <Card flush style={s.nsCard}>
        <View style={s.nsRow}>
          <TouchableOpacity style={s.nsMain} onPress={() => navigation.navigate('Progress')} activeOpacity={0.75}>
            <View style={s.nsNumWrap}>
              <Text style={s.nsNum}>{currentRecovery != null ? Math.round(currentRecovery) : '—'}</Text>
              {currentRecovery != null && <Text style={s.nsUnit}>%</Text>}
            </View>
            <View style={s.nsBarOuter}>
              <View style={s.nsTrack}>
                <View style={[s.nsFill, { width: currentRecovery ? `${Math.min(currentRecovery, 100)}%` : '0%' }]} />
                {peakRecovery != null && (
                  <View style={[s.nsPeakDot, { left: `${Math.min(peakRecovery, 100)}%` }]} />
                )}
              </View>
              <Text style={s.nsMeta}>
                {peakRecovery != null ? `peak ${Math.round(peakRecovery)}` : 'no data'}{' · goal 100 · full arc ›'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.nsUpdateBtn} onPress={() => setEditingRecovery(true)} activeOpacity={0.7}>
            <Text style={s.nsUpdateTxt}>Update</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 3 ── TODAY hero ─────────────────────────────────────────────────────── */}
      <Card flush style={s.heroCard}>
        {/* Ring + status */}
        <View style={s.heroTop}>
          <CompletionRing done={doneMeds} total={activeMeds.length} />
          <View style={s.heroInfo}>
            <Text style={s.heroTitle}>{heroTitle}</Text>
            <Text style={s.heroSub}>{heroSub}</Text>
            {!todayCI && (
              <TouchableOpacity
                style={s.logBtn}
                onPress={() => navigation.navigate('Check-in')}
                activeOpacity={0.8}
              >
                <Text style={s.logBtnTxt}>Log today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Treatment chips */}
        <View style={s.chipRow}>
          {activeMeds.map(m => <MedChip key={m.id} med={m} status={medStatus(m.key)} />)}
        </View>

        {/* Secondary stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: streak > 0 ? color.cool : color.faint }]}>{streak}</Text>
            <Text style={s.statLbl}>STREAK</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
              <Text style={[s.statNum, { color: adherenceColor }]}>{adherence7d ?? '—'}</Text>
              {adherence7d != null && <Text style={[s.statUnit, { color: adherenceColor }]}>%</Text>}
            </View>
            <Text style={s.statLbl}>7D ADHRNC</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statNum, { color: daysLeft <= 14 ? color.warmA : color.dim }]}>{daysLeft}</Text>
            <Text style={s.statLbl}>DAYS LEFT</Text>
          </View>
        </View>
      </Card>

      {/* 4 ── Today's read (AI) ─────────────────────────────────────────────── */}
      {dailyRead ? (
        <Card style={s.readCard}>
          <Text style={s.readEyebrow}>TODAY'S READ</Text>
          <Text style={s.readText}>{dailyRead}</Text>
        </Card>
      ) : null}

      {/* 5 ── Signals ────────────────────────────────────────────────────────── */}
      {signals.length > 0 ? (
        <Card flush style={s.signalsCard}>
          {signals.map((sig, i) => (
            <SignalRow key={sig.key} IconComp={sig.Ic} iconColor={sig.c} text={sig.text} last={i === signals.length - 1} />
          ))}
        </Card>
      ) : null}

      {/* 6 ── Coming up ──────────────────────────────────────────────────────── */}
      <Text style={s.sectionLabel}>COMING UP</Text>
      <Card flush>
        {(!allDone && nextDueMed) ? (
          <AheadRow
            IconComp={nextDueMed.Icon}
            iconColor={nextDueMed.accent}
            label={nextDueMed.label}
            desc={nextDueMed.timing}
            value="Today"
          />
        ) : null}
        <AheadRow
          IconComp={Flask}
          iconColor={!bloodworkAt ? color.faint : color.cool}
          label={bloodworkLabel}
          desc={bloodworkDesc}
          value={bloodworkVal}
        />
        <AheadRow
          IconComp={Dna}
          iconColor={color.warmA}
          label="Phase 1 checkpoint"
          desc="Sep 1, 2026"
          value={`${daysLeft}d`}
          last
        />
      </Card>

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
  content: { paddingHorizontal: 16 },

  eyebrow: { ...type.eyebrow, color: ra(color.warmA, 0.65), marginBottom: 6 },
  title:   { ...type.screenTitle, color: color.warmA, marginBottom: 20 },

  // North-star strip
  nsCard:      { overflow: 'hidden', marginBottom: space.md },
  nsRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.lg },
  nsMain:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nsNumWrap:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2, minWidth: 56 },
  nsNum:       { fontFamily: font.display, fontSize: 32, letterSpacing: -1.5, color: color.warmA,
                 textShadowColor: ra(color.warmA, 0.30), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  nsUnit:      { fontFamily: font.displaySemi, fontSize: 16, letterSpacing: -0.5, color: color.warmA, marginBottom: 5 },
  nsBarOuter:  { flex: 1, gap: 7 },
  nsTrack:     { height: 4, backgroundColor: color.card2, borderRadius: 2, overflow: 'visible' },
  nsFill:      { height: 4, backgroundColor: color.warmA, borderRadius: 2 },
  nsPeakDot:   { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: color.warmA,
                 top: -1.5, marginLeft: -3.5, borderWidth: 1.5, borderColor: color.card },
  nsMeta:      { ...type.eyebrow, fontSize: 8, color: color.faint, letterSpacing: 0.8 },
  nsUpdateBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: color.card2,
                 borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, marginLeft: 10 },
  nsUpdateTxt: { ...type.eyebrow, color: color.warmA, fontSize: 9 },

  // TODAY hero
  heroCard:  { overflow: 'hidden', marginBottom: space.md },
  heroTop:   { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, paddingBottom: 14 },
  heroInfo:  { flex: 1 },
  heroTitle: { fontFamily: font.displaySemi, fontSize: 20, letterSpacing: -0.4, color: color.txt, marginBottom: 4 },
  heroSub:   { fontSize: 13, color: color.dim, fontFamily: font.body },
  logBtn:    { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
               borderRadius: radius.pill, backgroundColor: color.warmA },
  logBtnTxt: { fontSize: 12, fontWeight: '700', color: color.bg, letterSpacing: 0.2 },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12,
             paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },

  statsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  stat:     { flex: 1, alignItems: 'center', paddingVertical: 13, gap: 3 },
  statDiv:  { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 10 },
  statNum:  { fontFamily: font.display, fontSize: 24, letterSpacing: -1, lineHeight: 28 },
  statUnit: { fontFamily: font.displaySemi, fontSize: 13, letterSpacing: -0.3, marginBottom: 3 },
  statLbl:  { ...type.eyebrow, fontSize: 8 },

  // Today's read
  readCard:   { marginBottom: space.md },
  readEyebrow:{ ...type.eyebrow, color: ra(color.warmA, 0.65), marginBottom: 8 },
  readText:   { fontSize: 14, fontFamily: font.body, color: color.txt, lineHeight: 21 },

  // Signals
  signalsCard: { overflow: 'hidden', marginBottom: space.md },

  // Section label
  sectionLabel: { ...type.eyebrow, color: color.faint, marginBottom: 10, marginTop: 8 },
});

const ring = StyleSheet.create({
  wrap:  { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.displaySemi, fontSize: 18, letterSpacing: -0.5 },
});

const chip = StyleSheet.create({
  wrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 5, paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.row,
            borderWidth: StyleSheet.hairlineWidth },
  label:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  status: { fontSize: 12, fontWeight: '700' },
});

const sig = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingVertical: 13, paddingHorizontal: space.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  dot:    { width: 30, height: 30, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center',
            borderWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  text:   { flex: 1, fontSize: 13, fontFamily: font.body, color: color.txt, lineHeight: 18 },
});

const ah = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12,
             paddingVertical: 13, paddingHorizontal: space.lg },
  border:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBox: { width: 34, height: 34, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center',
             borderWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  body:    { flex: 1 },
  label:   { ...type.bodyStrong },
  desc:    { fontSize: 12, color: color.dim, marginTop: 2 },
  value:   { fontFamily: font.mono, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});

const rem = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: ra(color.bg, 0.75), justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:    { backgroundColor: color.card, borderRadius: radius.card, padding: 24, width: '100%', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  heading:  { ...type.heading, marginBottom: 8 },
  hint:     { fontSize: 13, color: color.dim, lineHeight: 18, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  input:    { flex: 1, height: 56, backgroundColor: color.card2, borderRadius: radius.row,
              paddingHorizontal: 16, fontSize: 32, fontWeight: '800', color: color.warmA,
              letterSpacing: -1, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pct:      { fontSize: 28, fontWeight: '800', color: color.warmA },
  saveBtn:  { height: 48, backgroundColor: color.warmA, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  saveTxt:  { fontSize: 15, fontWeight: '700', color: color.bg },
});
