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
  daysToCheckpoint, getLast30Days, get, set, getScalpPhotos,
} from '../utils/storage';
import { getDailyRead } from '../services/ai';
import { Pill, Droplet, Sun, Shield, Check, Lightning, Cigarette, Star } from '../components/Icon';
import Card from '../components/Card';
import GradientText from '../components/GradientText';
import { color, type, radius, space, font } from '../theme/tokens';

const CAMPAIGN_START = new Date('2026-06-01');
const CAMPAIGN_END   = new Date('2026-09-01');

const isDutaDay = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const formatCachedTime = (iso) => {
  if (!iso) return '';
  try {
    return 'cached ' + new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).toLowerCase();
  } catch { return ''; }
};

const MED = [
  { id: 'oral',    label: 'Oral Min', fullName: 'Oral minoxidil 2.5mg',  Icon: Pill,    accent: color.warmA, key: 'oralMinoxidil',    timing: 'Morning', time: '7 AM'  },
  { id: 'topical', label: 'Topical',  fullName: 'Topical minoxidil 10%', Icon: Droplet, accent: color.warmB, key: 'topicalMinoxidil', timing: 'Bedtime', time: '11 PM' },
  { id: 'rlc',     label: 'RLC',      fullName: 'Red light comb',        Icon: Sun,     accent: color.amber, key: 'redLightComb',     timing: 'Anytime', time: null    },
  { id: 'duta',    label: 'Duta',     fullName: 'Dutasteride 0.5mg',     Icon: Shield,  accent: color.copper,key: 'dutasteride',      timing: 'Morning', time: '9 AM'  },
];

// ── Completion ring (ring on right — accent, not centerpiece) ─────────────────

function CompletionRing({ done, total }) {
  const SIZE  = 68;
  const SW    = 6;
  const r     = (SIZE - SW * 2) / 2;
  const cx    = SIZE / 2;
  const cy    = SIZE / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = total > 0 ? done / total : 0;
  const allDone  = done === total && total > 0;
  const arcColor = allDone ? color.amber : done > 0 ? color.warmA : color.faint;

  return (
    <View style={ring.wrap}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <SvgCircle cx={cx} cy={cy} r={r} stroke={color.line} strokeWidth={SW} fill="none" />
        {done > 0 && (
          <>
            <SvgCircle
              cx={cx} cy={cy} r={r}
              stroke={arcColor} strokeWidth={SW + 1.5} fill="none"
              strokeDasharray={allDone ? undefined : `${pct * circ} ${circ}`}
              strokeLinecap={allDone ? undefined : 'round'}
              rotation="-90" origin={`${cx},${cy}`}
              opacity={0.30}
            />
            <SvgCircle
              cx={cx} cy={cy} r={r}
              stroke={arcColor} strokeWidth={SW} fill="none"
              strokeDasharray={allDone ? undefined : `${pct * circ} ${circ}`}
              strokeLinecap={allDone ? undefined : 'round'}
              rotation="-90" origin={`${cx},${cy}`}
            />
          </>
        )}
      </Svg>
      {allDone ? (
        <Check size={18} color={color.amber} />
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
  const txtColor    = done ? med.accent : skipped ? color.red : ra(med.accent, 0.45);
  const bgColor     = done ? ra(med.accent, 0.14) : skipped ? ra(color.red, 0.07) : 'transparent';
  const borderColor = done ? ra(med.accent, 0.35) : skipped ? ra(color.red, 0.18) : color.line;
  return (
    <View style={[chip.wrap, { backgroundColor: bgColor, borderColor }]}>
      <med.Icon size={13} color={txtColor} />
      <Text style={[chip.label, { color: txtColor }]}>{med.label}</Text>
      {done    && <Text style={[chip.status, { color: color.warmA }]}>✓</Text>}
      {skipped && <Text style={[chip.status, { color: color.red }]}>✕</Text>}
    </View>
  );
}

// ── Signal card (each signal is its own Card) ─────────────────────────────────

function SignalCard({ Ic, c, bold, text, tag }) {
  return (
    <Card style={sig.card}>
      <View style={sig.row}>
        <View style={[sig.icon, { backgroundColor: ra(c, 0.12), borderColor: ra(c, 0.20) }]}>
          <Ic size={14} color={c} />
        </View>
        <Text style={sig.text}>
          <Text style={sig.bold}>{bold}</Text>
          <Text>{text}</Text>
        </Text>
        {tag ? <Text style={sig.tag}>{tag}</Text> : null}
      </View>
    </Card>
  );
}

// ── Coming-up row (date tag + label + right value, no icon) ───────────────────

function AheadRow({ dateTag, label, value, last }) {
  return (
    <View style={[ah.row, !last && ah.border]}>
      <Text style={ah.tag}>{dateTag}</Text>
      <Text style={ah.label}>{label}</Text>
      {value ? <Text style={ah.value}>{value}</Text> : null}
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

  const [todayCI, setTodayCI]                   = useState(null);
  const [streak, setStreak]                     = useState(0);
  const [adherence7d, setAdherence7d]           = useState(null);
  const [recoveryLog, setRecoveryLog]           = useState([]);
  const [editingRecovery, setEditingRecovery]   = useState(false);
  const [avg30dCigs, setAvg30dCigs]             = useState(null);
  const [bloodworkAt, setBloodworkAt]           = useState(null);
  const [dailyRead, setDailyRead]               = useState(null);   // { observe, action, cachedAt } | null
  const [dailyReadLoading, setDailyReadLoading] = useState(false);
  const [dailyReadNoApiKey, setDailyReadNoApiKey] = useState(false);
  const [latestScalpVerdict, setLatestScalpVerdict] = useState(null); // 'improved'|'stable'|'worse'|null, current month only

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
        getScalpPhotos(),
      ]).then(([ci, str, rec7, rlog, last30, bw, scalpPhotos]) => {
        const latestPhoto = scalpPhotos.length ? scalpPhotos[scalpPhotos.length - 1] : null;
        setLatestScalpVerdict(latestPhoto?.date?.slice(0, 7) === todayKey.slice(0, 7) ? latestPhoto.verdict : null);
        setTodayCI(ci);
        setStreak(str);
        const full = rec7.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length;
        const adh  = Math.round((full / 7) * 100);
        setAdherence7d(adh);
        setRecoveryLog(Array.isArray(rlog) ? rlog : []);
        setBloodworkAt(bw?.testedAt || null);

        const withData = last30.filter(d => d.data !== null);
        const cigAvg   = withData.length > 0
          ? parseFloat((withData.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / withData.length).toFixed(1))
          : null;
        setAvg30dCigs(cigAvg);

        if (!dailyRead) setDailyReadLoading(true);
        getDailyRead({
          streak: str, adherence7d: adh, todayLogged: ci !== null,
          cigsToday: ci?.cigarettes ?? 0, avg30dCigs: cigAvg,
          sleep: ci?.sleep ?? null, stress: ci?.stress ?? null,
        }).then(res => {
          if (res?.noApiKey) setDailyReadNoApiKey(true);
          else if (res) setDailyRead(res);
          setDailyReadLoading(false);
        }).catch(() => { setDailyReadLoading(false); });
      }).catch(e => console.warn('[Overview] data load failed', e));
    }, [])
  );

  // ── Derived ─────────────────────────────────────────────────────────────────

  const arcData         = recoveryLog.map(e => ({ date: e.date, value: e.value }));
  const currentRecovery = arcData.length ? arcData[arcData.length - 1].value : null;
  const peakRecovery    = arcData.length ? Math.max(...arcData.map(e => e.value)) : null;

  const dayNum   = Math.max(1, Math.ceil((new Date() - CAMPAIGN_START) / 86400000));
  const daysLeft = daysToCheckpoint();
  const isDuta   = isDutaDay();
  const activeMeds = MED.filter(m => m.id !== 'duta' || isDuta);

  const medStatus = (key) => {
    if (!todayCI) return 'pending';
    return todayCI[key] === true ? 'done' : todayCI[key] === false ? 'skipped' : 'pending';
  };

  const doneMeds   = activeMeds.filter(m => medStatus(m.key) === 'done').length;
  const allDone    = doneMeds === activeMeds.length && activeMeds.length > 0;
  const nextDueMed = activeMeds.find(m => medStatus(m.key) === 'pending');
  const heroBarColor = allDone ? color.amber : doneMeds > 0 ? color.warmA : color.faint;

  const adherenceColor = adherence7d == null ? color.dim
    : adherence7d >= 80 ? color.warmA
    : color.dim;

  // Hero title text + color
  let heroTitle, heroTitleColor, heroSub;
  if (!todayCI) {
    heroTitle      = 'Nothing logged';
    heroTitleColor = color.txt;
    heroSub        = `${activeMeds.length} treatments due today`;
  } else if (allDone) {
    heroTitle      = 'All done';
    heroTitleColor = color.amber;
    heroSub        = 'Protocol complete';
  } else {
    heroTitle      = nextDueMed
      ? `${nextDueMed.label} due ${nextDueMed.timing === 'Bedtime' ? 'tonight' : nextDueMed.timing === 'Anytime' ? 'today' : 'soon'}`
      : 'Almost done';
    heroTitleColor = color.amber;
    heroSub        = nextDueMed
      ? `${nextDueMed.time ?? nextDueMed.timing} · ${doneMeds} of ${activeMeds.length} done`
      : `${doneMeds} of ${activeMeds.length} done`;
  }

  // Bloodwork
  let bloodworkTag = 'Soon', bloodworkLabel = 'Schedule first bloodwork', bloodworkVal = null;
  if (bloodworkAt) {
    const nextDate  = new Date(bloodworkAt);
    nextDate.setDate(nextDate.getDate() + 90);
    const daysUntil = Math.ceil((nextDate - new Date()) / 86400000);
    bloodworkTag    = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    bloodworkLabel  = daysUntil < 0 ? 'Bloodwork overdue' : 'Bloodwork — 7 markers due';
    bloodworkVal    = daysUntil < 0 ? `${Math.abs(daysUntil)}d past` : `${daysUntil}d`;
  }

  const checkpointTag = CAMPAIGN_END.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Signals
  const signals = [];
  if (streak > 0 && !todayCI) {
    signals.push({ id: 'risk', Ic: Lightning, c: color.amber, bold: 'Streak at risk', text: ` — log today to keep your ${streak}-day run`, tag: null });
  } else if (streak > 0 && allDone) {
    signals.push({ id: 'streak', Ic: Check, c: color.green, bold: 'Streak secured', text: ` through today. Day ${streak} — keep building.`, tag: null });
  }
  if ((todayCI?.cigarettes ?? 0) > 0 && avg30dCigs != null) {
    const n       = todayCI.cigarettes;
    const diff    = parseFloat((n - avg30dCigs).toFixed(1));
    const compare = diff <= 0 ? 'on track to beat your avg' : `${diff} above your avg`;
    signals.push({ id: 'cigs', Ic: Cigarette, c: color.red, bold: `${n} cigarette${n !== 1 ? 's' : ''}`, text: ` so far — ${compare}`, tag: '#1\nlever' });
  }

  const handleSaveRecovery = async (value) => {
    const today    = getTodayKey();
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
      <GradientText style={s.title} colors={['#FFB020', '#FF8C30']}>Overview</GradientText>

      {/* 2 ── North-star strip ───────────────────────────────────────────────── */}
      <Card flush style={s.nsCard}>
        <View style={s.nsRow}>
          <TouchableOpacity style={s.nsMain} onPress={() => setEditingRecovery(true)} activeOpacity={0.75}>
            <View style={s.nsIconBox}>
              <Star size={14} color={color.bg} filled />
            </View>
            <Text style={s.nsNum}>{`${Math.round(currentRecovery ?? 0)}%`}</Text>
            <View style={s.nsBarOuter}>
              <View style={s.nsTrack}>
                <View style={[s.nsFill, { width: `${Math.min(currentRecovery ?? 0, 100)}%` }]} />
                {peakRecovery != null && (
                  <View style={[s.nsPeakDot, { left: `${Math.min(peakRecovery, 100)}%` }]} />
                )}
              </View>
              <View style={s.nsMetaRow}>
                <Text style={s.nsMeta}>
                  {peakRecovery != null ? `peak ${Math.round(peakRecovery)} · goal 100` : 'goal 100'}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RecoveryArc')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.nsMetaAction}>
                    {latestScalpVerdict === 'improved' ? '✓ ' : latestScalpVerdict === 'worse' ? '⚑ ' : ''}Full arc ›
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 3 ── TODAY hero ─────────────────────────────────────────────────────── */}
      <Card flush style={s.heroCard}>
        {/* Title row: BIG text LEFT, ring RIGHT */}
        <View style={s.heroTop}>
          <View style={s.heroInfo}>
            <Text style={[s.heroTitle, heroTitleColor !== color.txt && s.heroTitleGlow, { color: heroTitleColor }]}>{heroTitle}</Text>
            <Text style={s.heroSub}>{heroSub}</Text>
            <View style={s.heroSegments}>
              {activeMeds.map(m => (
                <View
                  key={m.id}
                  style={[s.heroSegment, { backgroundColor: medStatus(m.key) === 'done' ? heroBarColor : color.line }]}
                />
              ))}
            </View>
            {!todayCI && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Check-in')} activeOpacity={0.85}
                style={{ marginTop: 14, paddingVertical: 20, borderRadius: radius.row, alignItems: 'center', backgroundColor: color.warmA }}
              >
                <Text style={s.logBtnTxt}>Log today</Text>
              </TouchableOpacity>
            )}
          </View>
          <CompletionRing done={doneMeds} total={activeMeds.length} />
        </View>

        {/* Treatment chips */}
        <View style={s.chipRow}>
          {activeMeds.map(m => <MedChip key={m.id} med={m} status={medStatus(m.key)} />)}
        </View>

        {/* Secondary stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: streak > 0 ? color.copper : color.faint }]}>{streak}</Text>
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
            {todayCI ? (
              <>
                <Text style={[s.statNum, { color: (todayCI.cigarettes ?? 0) > 0 ? color.red : color.green }]}>{todayCI.cigarettes ?? 0}</Text>
                <Text style={s.statLbl}>CIGS TODAY</Text>
              </>
            ) : (
              <>
                <Text style={[s.statNum, { color: daysLeft <= 14 ? color.warmA : color.dim }]}>{daysLeft}</Text>
                <Text style={s.statLbl}>DAYS LEFT</Text>
              </>
            )}
          </View>
        </View>
      </Card>

      {/* 4 ── Today's read (AI) ─────────────────────────────────────────────── */}
      <Card style={s.readCard}>
        <View style={s.readHeader}>
          <View style={s.readIconBox}>
            <Text style={{ fontSize: 13, color: color.bg, fontWeight: '700' }}>✦</Text>
          </View>
          <Text style={s.readEyebrow}>TODAY'S READ</Text>
          {dailyRead?.cachedAt ? (
            <Text style={s.readCached}>{formatCachedTime(dailyRead.cachedAt)}</Text>
          ) : null}
        </View>
        {dailyReadLoading ? (
          <View style={s.skeletonWrap}>
            <View style={s.skLine} />
            <View style={[s.skLine, { width: '75%' }]} />
          </View>
        ) : dailyRead ? (
          <Text style={s.readBody}>
            {dailyRead.observe ? (
              <>
                <Text style={s.readObserve}>{dailyRead.observe}{dailyRead.action ? ' ' : ''}</Text>
                {dailyRead.action ? <Text style={s.readAction}>{dailyRead.action}</Text> : null}
              </>
            ) : null}
          </Text>
        ) : dailyReadNoApiKey ? (
          <Text style={s.readObserve}>Set your Claude API key in the Ask Claude tab to get a daily read.</Text>
        ) : (
          <Text style={s.readObserve}>Nothing to read yet — check back later.</Text>
        )}
      </Card>

      {/* 5 ── Signals ────────────────────────────────────────────────────────── */}
      {signals.length > 0 ? (
        <>
          <Text style={s.sectionLabel}>TODAY'S SIGNALS</Text>
          {signals.map(sig => <SignalCard key={sig.id} {...sig} />)}
        </>
      ) : null}

      {/* 6 ── Coming up ──────────────────────────────────────────────────────── */}
      <Text style={s.sectionLabel}>COMING UP</Text>
      <Card flush style={{ borderWidth: 1, borderColor: '#2A2114' }}>
        {(!allDone && nextDueMed) ? (
          <AheadRow
            dateTag={nextDueMed.timing === 'Bedtime' ? 'Tonight' : 'Today'}
            label={nextDueMed.fullName}
            value={nextDueMed.time ?? nextDueMed.timing}
          />
        ) : null}
        <AheadRow
          dateTag={bloodworkTag}
          label={bloodworkLabel}
          value={bloodworkVal}
        />
        <AheadRow
          dateTag={checkpointTag}
          label="Phase 1 checkpoint"
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
  title:   { ...type.screenTitle, marginBottom: 22 },

  // North-star strip
  nsCard:      { overflow: 'hidden', marginBottom: space.md, borderWidth: 1, borderColor: '#2A2114' },
  nsRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: space.lg },
  nsMain:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nsIconBox:   { width: 28, height: 28, borderRadius: 9, backgroundColor: color.warmA,
                 alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nsNum:       { fontFamily: font.display, fontSize: 30, letterSpacing: -1.5, color: color.txt },
  nsBarOuter:  { flex: 1, gap: 9 },
  nsTrack:     { height: 6, backgroundColor: color.card2, borderRadius: 3, overflow: 'visible' },
  nsFill:      { height: 6, backgroundColor: color.warmA, borderRadius: 3 },
  nsMetaRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nsMetaAction:{ ...type.eyebrow, fontSize: 8, color: color.warmA, letterSpacing: 0.8 },
  nsPeakDot:   { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color.copper,
                 top: -1, marginLeft: -4, borderWidth: 1.5, borderColor: color.card },
  nsMeta:      { ...type.eyebrow, fontSize: 8, color: color.faint, letterSpacing: 0.8 },
  // TODAY hero
  heroCard:  { overflow: 'hidden', marginBottom: space.md, borderWidth: 1, borderColor: '#2A2114' },
  heroTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 28, paddingBottom: 24 },
  heroInfo:  { flex: 1 },
  heroTitle: { fontFamily: font.display, fontSize: 32, letterSpacing: -1, lineHeight: 35, marginBottom: 10 },
  heroTitleGlow: { textShadowColor: ra(color.amber, 0.30), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  heroSub:   { fontSize: 13, fontFamily: font.body, color: color.dim, lineHeight: 18 },
  heroSegments: { flexDirection: 'row', gap: 5, marginTop: 14 },
  heroSegment:  { flex: 1, height: 5, borderRadius: 2.5 },
  logBtnTxt: { fontSize: 15, fontWeight: '700', color: '#1A1000', letterSpacing: 0.3 },

  chipRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 20,
             borderTopWidth: 1, borderTopColor: '#2A2114', paddingTop: 20 },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2A2114' },
  stat:     { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  statDiv:  { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 10 },
  statNum:  { fontFamily: font.display, fontSize: 22, letterSpacing: -1, lineHeight: 26 },
  statUnit: { fontFamily: font.displaySemi, fontSize: 12, letterSpacing: -0.3, marginBottom: 2 },
  statLbl:  { ...type.eyebrow, fontSize: 8 },

  // Today's read
  readCard:   { marginBottom: space.md, borderColor: '#2A2114' },
  readHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  readIconBox:{ width: 26, height: 26, borderRadius: 9, backgroundColor: color.warmA,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: color.warmA, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity: 0.6 },
  readEyebrow:{ ...type.eyebrow, color: color.faint, flex: 1 },
  readCached: { ...type.eyebrow, fontSize: 8, color: color.faint },
  readBody:   { fontSize: 14, lineHeight: 22 },
  readObserve:{ fontFamily: font.body, color: color.dim },
  readAction: { fontFamily: font.bodyMed, color: color.warmA },
  skeletonWrap:{ gap: 8, paddingTop: 2 },
  skLine:     { height: 11, borderRadius: 6, backgroundColor: color.line, width: '100%' },

  // Signals
  sectionLabel: { ...type.eyebrow, color: color.faint, marginBottom: 12, marginTop: 8 },

  // Coming up
});

const ring = StyleSheet.create({
  wrap:  { width: 68, height: 68, marginTop: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontFamily: font.displaySemi, fontSize: 17, letterSpacing: -0.5 },
});

const chip = StyleSheet.create({
  wrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 4, paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.row,
            borderWidth: StyleSheet.hairlineWidth },
  label:  { fontSize: 11, fontFamily: font.bodyMed, letterSpacing: 0.1 },
  status: { fontSize: 11, fontFamily: font.bodyMed },
});

const sig = StyleSheet.create({
  card: { marginBottom: 8, borderWidth: 1, borderColor: ra(color.amber, 0.18) },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 32, height: 32, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: font.body, color: color.txt },
  bold: { fontFamily: font.bodyMed, color: color.txt },
  tag:  { fontSize: 8.5, fontFamily: font.mono, color: color.faint, textAlign: 'right', lineHeight: 12 },
});

const ah = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingVertical: 14, paddingHorizontal: space.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  tag:    { fontFamily: font.mono, fontSize: 10, color: color.warmA, letterSpacing: 0.3, minWidth: 42 },
  label:  { flex: 1, ...type.bodyStrong },
  value:  { fontFamily: font.mono, fontSize: 12, color: color.faint, letterSpacing: 0.2 },
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
