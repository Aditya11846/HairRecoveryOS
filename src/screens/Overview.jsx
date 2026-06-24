import React, { useState, useCallback } from 'react';
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
import { color, type, radius, space, font } from '../theme/tokens';

const CAMPAIGN_START = new Date('2026-06-01');
const CAMPAIGN_END   = new Date('2026-09-01');
const TOTAL_DAYS     = Math.ceil((CAMPAIGN_END - CAMPAIGN_START) / 86400000);

const isDutaDay     = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;
const STRESS_LABEL  = ['', 'None', 'Low', 'Med', 'High', 'Extreme'];

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const MED = [
  { id: 'oral',    label: 'Oral Min', Icon: Pill,    accent: '#FFB020', key: 'oralMinoxidil' },
  { id: 'topical', label: 'Topical',  Icon: Droplet, accent: '#FF6B4A', key: 'topicalMinoxidil' },
  { id: 'rlc',     label: 'RLC',      Icon: Sun,     accent: '#FF9030', key: 'redLightComb' },
  { id: 'duta',    label: 'Duta',     Icon: Shield,  accent: '#CF8020', key: 'dutasteride' },
];

// ── Med Chip ──────────────────────────────────────────────────────────────────

function MedChip({ med, status }) {
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
      <med.Icon size={14} color={taken ? a : skipped ? color.red : color.faint} />
      <Text style={[chip.label, { color: taken ? a : skipped ? color.red : color.dim }]}>
        {med.label}
      </Text>
      <Text style={[chip.status, { color: taken ? a : skipped ? color.red : color.faint }]}>
        {taken ? '✓' : skipped ? '✕' : '—'}
      </Text>
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
  const [adherence7d, setAdherence7d]         = useState(null);
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
        const full = rec7.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length;
        setAdherence7d(rec7.length ? Math.round((full / rec7.length) * 100) : null);
        setRecoveryLog(Array.isArray(rlog) ? rlog : []);
      }).catch(() => {});
    }, [])
  );

  // ── Derived values ──────────────────────────────────────────────────────────

  const arcData         = recoveryLog.map(e => ({ date: e.date, value: e.value }));
  const currentRecovery = arcData.length ? arcData[arcData.length - 1].value : null;
  const peakIndex       = arcData.length
    ? arcData.reduce((mi, e, i, a) => e.value > a[mi].value ? i : mi, 0)
    : null;
  const projData       = arcData.length ? [...arcData, { date: '2026-09-01', value: 100 }] : [];
  const projectionFrom = arcData.length || undefined;
  const arcXLabels     = arcData.length >= 2
    ? [new Date(arcData[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), 'now', "Sep '26"]
    : [];
  const prevChange = arcData.length >= 2
    ? arcData[arcData.length - 1].value - arcData[arcData.length - 2].value
    : null;

  const dayNum      = Math.max(1, Math.ceil((new Date() - CAMPAIGN_START) / 86400000));
  const days        = daysToCheckpoint();
  const campaignPct = Math.min(98, Math.round((dayNum / TOTAL_DAYS) * 100));

  const isDuta     = isDutaDay();
  const activeMeds = MED.filter(m => m.id !== 'duta' || isDuta);
  const medStatus  = (key) => {
    if (!todayCI) return 'pending';
    return todayCI[key] === true ? 'done' : todayCI[key] === false ? 'skipped' : 'pending';
  };

  const adherenceColor = adherence7d == null
    ? color.dim
    : adherence7d >= 80 ? color.warmA
    : adherence7d >= 50 ? color.dim
    : color.red;

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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Text style={s.eyebrow}>Campaign · Phase 1 · Day {dayNum}</Text>
      <View style={s.titleRow}>
        <Text style={s.title}>Overview</Text>
        {todayCI ? (
          <View style={s.loggedChip}><Text style={s.loggedChipTxt}>✓ Logged</Text></View>
        ) : (
          <View style={s.notLoggedChip}><Text style={s.notLoggedChipTxt}>Not logged</Text></View>
        )}
      </View>

      {/* ── Recovery hero ────────────────────────────────────────────────────── */}
      <Card flush style={s.heroCard}>
        <View style={s.heroBody}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroEyebrow}>CROWN RECOVERY · MONTHLY EST.</Text>
            <View style={s.heroNumRow}>
              <Text style={s.heroNum}>{currentRecovery != null ? Math.round(currentRecovery) : '—'}</Text>
              {currentRecovery != null && <Text style={s.heroUnit}>%</Text>}
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

      {/* ── Campaign timeline ────────────────────────────────────────────────── */}
      <View style={s.timeline}>
        <View style={s.timelineHead}>
          <Text style={s.timelinePhase}>PHASE 1</Text>
          <Text style={s.timelineCheckpoint}>CHECKPOINT: SEP '26</Text>
        </View>
        <View style={s.timelineBarWrap}>
          <View style={s.timelineTrack}>
            <View style={[s.timelineFill, { width: `${campaignPct}%` }]} />
          </View>
          <View style={[s.timelineDot, { left: `${campaignPct}%` }]} />
        </View>
        <View style={s.timelineFoot}>
          <Text style={s.timelineLabel}>Day 1</Text>
          <Text style={s.timelineLabelNow}>Day {dayNum} of {TOTAL_DAYS}</Text>
          <Text style={s.timelineLabel}>Day {TOTAL_DAYS}</Text>
        </View>
      </View>

      {/* ── Status gauges ─────────────────────────────────────────────────────── */}
      <Card flush style={s.gaugeCard}>
        <View style={s.gaugeRow}>
          <View style={s.gauge}>
            <Text style={[s.gaugeNum, { color: streak > 0 ? color.cool : color.faint }]}>{streak}</Text>
            <Text style={s.gaugeLbl}>STREAK</Text>
            <Text style={s.gaugeSub}>days</Text>
          </View>
          <View style={s.gaugeDivider} />
          <View style={s.gauge}>
            <View style={s.gaugeNumRow}>
              <Text style={[s.gaugeNum, { color: adherenceColor }]}>{adherence7d ?? '—'}</Text>
              {adherence7d != null && <Text style={[s.gaugeUnit, { color: adherenceColor }]}>%</Text>}
            </View>
            <Text style={s.gaugeLbl}>7D ADHERENCE</Text>
            <Text style={s.gaugeSub}>oral + topical</Text>
          </View>
          <View style={s.gaugeDivider} />
          <View style={s.gauge}>
            <Text style={[s.gaugeNum, { color: days <= 14 ? color.warmA : color.dim }]}>{days}</Text>
            <Text style={s.gaugeLbl}>DAYS LEFT</Text>
            <Text style={s.gaugeSub}>to checkpoint</Text>
          </View>
        </View>
      </Card>

      {/* ── Today's deployment ───────────────────────────────────────────────── */}
      <SectionHeader label="Today's deployment" />
      <Card flush style={s.deployCard}>
        <View style={s.chipRow}>
          {activeMeds.map(med => (
            <MedChip key={med.id} med={med} status={medStatus(med.key)} />
          ))}
        </View>
        {todayCI ? (
          <View style={s.deployStats}>
            <View style={s.deployStat}>
              <Text style={s.deployStatVal}>
                {todayCI.sleep ?? '—'}{todayCI.sleep != null ? <Text style={s.deployStatUnit}>h</Text> : null}
              </Text>
              <Text style={s.deployStatLbl}>SLEEP</Text>
            </View>
            <View style={s.deployDivider} />
            <View style={s.deployStat}>
              <Text style={s.deployStatVal}>{todayCI.stress ? STRESS_LABEL[todayCI.stress] : '—'}</Text>
              <Text style={s.deployStatLbl}>STRESS</Text>
            </View>
            <View style={s.deployDivider} />
            <View style={s.deployStat}>
              <Text style={[(todayCI.cigarettes ?? 0) > 0 ? s.deployStatBad : s.deployStatVal]}>
                {todayCI.cigarettes ?? 0}
              </Text>
              <Text style={s.deployStatLbl}>CIGS</Text>
            </View>
            <View style={s.deployDivider} />
            <View style={s.deployStat}>
              <Text style={[todayCI.sheddingNoticed ? s.deployStatWarn : s.deployStatVal]}>
                {todayCI.sheddingNoticed ? 'Yes' : 'No'}
              </Text>
              <Text style={s.deployStatLbl}>SHEDDING</Text>
            </View>
          </View>
        ) : (
          <Text style={s.deployHint}>Log today to see deployment status</Text>
        )}
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

  eyebrow:  { ...type.eyebrow, color: 'rgba(255,176,32,0.65)', marginBottom: 6 },

  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  title:            { ...type.screenTitle, color: color.warmA, flex: 1 },
  loggedChip:       { backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(48,209,88,0.25)' },
  loggedChipTxt:    { fontSize: 11, fontWeight: '700', color: color.green, letterSpacing: 0.3 },
  notLoggedChip:    { backgroundColor: color.card2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  notLoggedChipTxt: { fontSize: 11, fontWeight: '600', color: color.faint, letterSpacing: 0.3 },

  // Hero
  heroCard:    { overflow: 'hidden', marginBottom: space.md },
  heroBody:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 18, paddingBottom: 14 },
  heroEyebrow: { ...type.eyebrow, color: 'rgba(255,176,32,0.65)', marginBottom: 6 },
  heroNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 10 },
  heroNum:     {
    fontFamily: font.display,
    fontSize: 72,
    letterSpacing: -3,
    lineHeight: 72,
    color: color.warmA,
    textShadowColor: 'rgba(255,176,32,0.30)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  heroUnit:    { fontFamily: font.displaySemi, fontSize: 32, letterSpacing: -1, color: color.warmA, marginBottom: 10 },
  metaRow:     { flexDirection: 'row', gap: 20 },
  metaItem:    { gap: 3 },
  metaLabel:   { ...type.eyebrow, fontSize: 7 },
  metaVal:     { fontFamily: font.mono, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  updateBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  updateBtnTxt:{ ...type.eyebrow, color: color.warmA, fontSize: 9 },
  arcSep:      { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  arcWrap:     { paddingTop: 10, paddingBottom: 10, paddingHorizontal: 4 },
  arcEmpty:    { height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: color.card2, borderRadius: radius.row, margin: 16 },
  arcEmptyTxt: { ...type.eyebrow, color: color.faint, textAlign: 'center', paddingHorizontal: 20 },

  // Campaign timeline
  timeline:         { marginBottom: space.md },
  timelineHead:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  timelinePhase:    { ...type.eyebrow, color: 'rgba(255,176,32,0.65)' },
  timelineCheckpoint:{ ...type.eyebrow, color: color.faint },
  timelineBarWrap:  { height: 20, justifyContent: 'center' },
  timelineTrack:    { height: 5, backgroundColor: color.card2, borderRadius: 3, overflow: 'hidden' },
  timelineFill:     { height: 5, backgroundColor: color.warmA, borderRadius: 3 },
  timelineDot:      {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: color.warmA,
    marginLeft: -7, top: 3,
    borderWidth: 2, borderColor: color.bg,
    shadowColor: color.warmA,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0.8,
  },
  timelineFoot:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timelineLabel:    { ...type.eyebrow, fontSize: 8, color: color.faint },
  timelineLabelNow: { ...type.eyebrow, fontSize: 8, color: color.warmA },

  // Gauges
  gaugeCard:    { overflow: 'hidden', marginBottom: space.md },
  gaugeRow:     { flexDirection: 'row' },
  gauge:        { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 3 },
  gaugeDivider: { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 14 },
  gaugeNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  gaugeNum:     { fontFamily: font.display, fontSize: 36, letterSpacing: -1.5, lineHeight: 40 },
  gaugeUnit:    { fontFamily: font.displaySemi, fontSize: 18, letterSpacing: -0.5, marginBottom: 3 },
  gaugeLbl:     { ...type.eyebrow },
  gaugeSub:     { fontSize: 10, color: color.faint, fontFamily: font.mono },

  // Today's deployment
  deployCard:    { overflow: 'hidden' },
  chipRow:       { flexDirection: 'row', gap: 8, padding: 12 },
  deployStats:   { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  deployStat:    { flex: 1, alignItems: 'center', paddingVertical: 13 },
  deployDivider: { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 10 },
  deployStatVal: { fontSize: 16, fontWeight: '700', color: color.txt, letterSpacing: -0.3, lineHeight: 20 },
  deployStatBad: { fontSize: 16, fontWeight: '700', color: color.red,  letterSpacing: -0.3, lineHeight: 20 },
  deployStatWarn:{ fontSize: 16, fontWeight: '700', color: color.warmA,letterSpacing: -0.3, lineHeight: 20 },
  deployStatUnit:{ fontSize: 12, fontWeight: '600', color: color.dim },
  deployStatLbl: { ...type.eyebrow, fontSize: 8, marginTop: 3 },
  deployHint:    { ...type.eyebrow, color: color.faint, textAlign: 'center', paddingVertical: 14 },
});

const chip = StyleSheet.create({
  wrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.row, borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  status:{ fontSize: 12, fontWeight: '700' },
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
