import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle as SvgCircle, Path, Line } from 'react-native-svg';
import {
  getTodayKey, getStreakCount, getRecentCheckins, loadCheckin,
  daysToCheckpoint, get, set,
} from '../utils/storage';
import { PROTOCOL_DETAILS } from '../constants/protocol';
import { Pill, Droplet, Sun, Shield } from '../components/Icon';
import RecoveryArc from '../components/RecoveryArc';
import StatTile from '../components/StatTile';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import { color, type, radius, space } from '../theme/tokens';

const isDutaDay = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;

const PROTOCOL_ICON = {
  oral:    <Pill    size={15} color={color.dim} />,
  topical: <Droplet size={15} color={color.dim} />,
  lllt:    <Sun     size={15} color={color.dim} />,
  dutalin: <Shield  size={15} color={color.dim} />,
};

const STORAGE_KEY = {
  dutalin: 'dutasteride',
  lllt:    'redLightComb',
  oral:    'oralMinoxidil',
  topical: 'topicalMinoxidil',
};

// ── Scalp application diagram (topical minoxidil) ─────────────────────────────
function ApplicationDiagram() {
  const W = 200, H = 170, cx = 100, cy = 88;
  return (
    <View style={ad.wrap}>
      <Text style={ad.title}>APPLICATION ZONES</Text>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Head outline */}
        <SvgCircle cx={cx} cy={cy} r={70} fill="none" stroke={color.line2} strokeWidth={1.5} />
        {/* Hairline arc — front */}
        <Path
          d={`M ${cx - 48} ${cy - 42} Q ${cx} ${cy - 76} ${cx + 48} ${cy - 42}`}
          fill="none" stroke={color.warmA} strokeWidth={2.5} strokeLinecap="round"
        />
        {/* Crown zone */}
        <SvgCircle cx={cx} cy={cy - 8} r={26}
          fill="rgba(255,176,32,0.13)" stroke={color.warmA} strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        {/* Left temple */}
        <SvgCircle cx={cx - 54} cy={cy + 4} r={13}
          fill="rgba(255,176,32,0.10)" stroke={color.warmA} strokeWidth={1}
        />
        {/* Right temple */}
        <SvgCircle cx={cx + 54} cy={cy + 4} r={13}
          fill="rgba(255,176,32,0.10)" stroke={color.warmA} strokeWidth={1}
        />
        {/* Hairline label tick */}
        <Line x1={cx} y1={cy - 78} x2={cx} y2={cy - 90} stroke={color.faint} strokeWidth={1} />
      </Svg>
      <View style={ad.legend}>
        <View style={ad.legendItem}>
          <Path />
          <View style={[ad.legendDot, { backgroundColor: color.warmA }]} />
          <Text style={ad.legendTxt}>Hairline</Text>
        </View>
        <View style={ad.legendItem}>
          <View style={[ad.legendDot, { backgroundColor: color.warmA, opacity: 0.5 }]} />
          <Text style={ad.legendTxt}>Crown</Text>
        </View>
        <View style={ad.legendItem}>
          <View style={[ad.legendDot, { backgroundColor: color.warmA, opacity: 0.3 }]} />
          <Text style={ad.legendTxt}>Temples</Text>
        </View>
      </View>
    </View>
  );
}

// ── Adherence Ring ─────────────────────────────────────────────────────────────
function AdherenceRing({ pct = 0, status, icon }) {
  const SIZE = 44, r = 19;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(pct / 100, 1)) * circ;
  const arcColor = status === 'done'
    ? color.green
    : pct >= 80 ? color.green
    : pct >= 50 ? color.warmA
    : pct > 0   ? color.red
    : color.line;

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <SvgCircle cx={SIZE/2} cy={SIZE/2} r={r} stroke={color.line} strokeWidth={1.5} fill="none" />
        {pct > 0 && (
          <SvgCircle cx={SIZE/2} cy={SIZE/2} r={r}
            stroke={arcColor} strokeWidth={2} fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE/2}, ${SIZE/2}`}
          />
        )}
      </Svg>
      <View style={s.ringInner}>{icon}</View>
    </View>
  );
}

// ── Expandable Protocol Row ────────────────────────────────────────────────────
function ProtocolRow({ item, status, adherencePct, last, expanded, onToggle }) {
  const icon = PROTOCOL_ICON[item.id];
  const statusColor = status === 'done' ? color.green : status === 'skipped' ? color.red : color.faint;

  return (
    <View>
      <TouchableOpacity
        style={[s.protoRow, !expanded && !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line }]}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <AdherenceRing pct={adherencePct} status={status} icon={icon} />
        <View style={s.protoText}>
          <Text style={s.protoName}>{item.name}</Text>
          <Text style={s.protoDose}>{item.dose}</Text>
        </View>
        <View style={s.protoRight}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          {adherencePct > 0 && <Text style={s.adherencePct}>{adherencePct}%</Text>}
          <Text style={s.chevron}>{expanded ? '⌃' : '⌄'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[s.detail, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line }]}>
          <View style={s.detailGrid}>
            <View style={s.detailCell}>
              <Text style={s.detailLabel}>TIMING</Text>
              <Text style={s.detailVal}>{item.timing}</Text>
            </View>
            <View style={s.detailCell}>
              <Text style={s.detailLabel}>EVIDENCE</Text>
              <Text style={[s.detailVal, { color: color.green }]}>{item.evidence}</Text>
            </View>
          </View>
          <Text style={s.detailNotes}>{item.notes}</Text>
          {item.id === 'topical' && <ApplicationDiagram />}
        </View>
      )}
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

  const [todayCI, setTodayCI]         = useState(null);
  const [streak, setStreak]           = useState(0);
  const [adherence7d, setAdherence7d] = useState(null);
  const [recoveryLog, setRecoveryLog] = useState([]);
  const [editingRecovery, setEditingRecovery] = useState(false);
  const [rec7Raw, setRec7Raw]         = useState([]);
  const [expandedId, setExpandedId]   = useState(null);

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

  const handleSaveRecovery = async (value) => {
    const today = getTodayKey();
    const existing = recoveryLog.filter(e => e.date !== today);
    const updated = [...existing, { date: today, value }].sort((a, b) => a.date.localeCompare(b.date));
    await set('recovery_log', updated);
    setRecoveryLog(updated);
  };

  const arcData = recoveryLog.map(e => ({ date: e.date, value: e.value }));
  const currentRecovery = arcData.length ? arcData[arcData.length - 1].value : null;
  const peakIndex = arcData.length
    ? arcData.reduce((mi, e, i, a) => e.value > a[mi].value ? i : mi, 0)
    : null;

  const projData       = arcData.length ? [...arcData, { date: '2026-09-01', value: 100 }] : [];
  const projectionFrom = arcData.length || undefined;
  const arcXLabels     = arcData.length >= 2
    ? [new Date(arcData[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), 'now', "Sep '26"]
    : [];
  const prevChange     = arcData.length >= 2
    ? arcData[arcData.length - 1].value - arcData[arcData.length - 2].value
    : null;

  const days   = daysToCheckpoint();
  const dayNum = Math.max(1, Math.round((new Date() - new Date('2026-06-01')) / 86400000) + 1);
  const isDuta = isDutaDay();

  const medStatus    = (key) => {
    if (!todayCI) return 'pending';
    return todayCI[key] === true ? 'done' : todayCI[key] === false ? 'skipped' : 'pending';
  };
  const medAdherence = (key) => {
    if (!rec7Raw.length) return 0;
    return Math.round((rec7Raw.filter(c => c && c[key] === true).length / rec7Raw.length) * 100);
  };

  const activeProtocol = PROTOCOL_DETAILS.filter(p => p.id !== 'dutalin' || isDuta);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={s.eyebrow}>Day {dayNum} · {days} to checkpoint</Text>
      <View style={s.titleRow}>
        <Text style={s.title}>Campaign</Text>
        <View style={s.titleBadge}>
          <Text style={s.titleBadgeTxt}>Phase 1</Text>
        </View>
      </View>

      {/* Recovery hero card */}
      <View style={s.heroCard}>
        <Text style={s.heroEyebrow}>Crown recovery · monthly photo est.</Text>
        <View style={s.heroNumRow}>
          <Text style={s.heroNum}>{currentRecovery != null ? Math.round(currentRecovery) : '—'}</Text>
          {currentRecovery != null && <Text style={s.heroNumUnit}>%</Text>}
          <TouchableOpacity onPress={() => setEditingRecovery(true)} style={s.heroEditBtn} activeOpacity={0.7}>
            <Text style={s.heroEditTxt}>Update</Text>
          </TouchableOpacity>
        </View>

        {arcData.length > 0 && (
          <View style={s.metaRow}>
            {peakIndex != null && (
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Peak</Text>
                <Text style={[s.metaVal, { color: color.warmA }]}>{arcData[peakIndex].value}%</Text>
              </View>
            )}
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Goal</Text>
              <Text style={[s.metaVal, { color: color.green }]}>100%</Text>
            </View>
            {prevChange != null && (
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Change</Text>
                <Text style={[s.metaVal, { color: prevChange >= 0 ? color.green : color.red }]}>
                  {prevChange >= 0 ? '+' : ''}{prevChange.toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={s.arcWrap}>
          {arcData.length >= 2 ? (
            <RecoveryArc
              data={projData}
              peakIndex={peakIndex}
              projectionFrom={projectionFrom}
              xLabels={arcXLabels}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingRecovery(true)} style={s.arcEmpty} activeOpacity={0.75}>
              <Text style={s.arcEmptyTxt}>Tap "Update" to log your first recovery estimate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      <SectionHeader label="This week" />
      <View style={s.statRow}>
        <StatTile label="Streak" value={streak} sub="consecutive days" tone="cool" style={{ flex: 1, marginRight: space.sm }} />
        <StatTile
          label="7d Adherence"
          value={adherence7d != null ? `${adherence7d}%` : '—'}
          sub="oral + topical"
          tone={adherence7d == null ? 'default' : adherence7d >= 80 ? 'warm' : adherence7d >= 50 ? 'default' : 'red'}
          style={{ flex: 1 }}
        />
      </View>

      {/* Today's protocol */}
      <SectionHeader label="Today's protocol" count={!todayCI ? 'not logged' : undefined} />
      <Card flush>
        {activeProtocol.map((item, i, arr) => (
          <ProtocolRow
            key={item.id}
            item={item}
            status={medStatus(STORAGE_KEY[item.id])}
            adherencePct={medAdherence(STORAGE_KEY[item.id])}
            last={i === arr.length - 1 && isDuta}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
        {!isDuta && (
          <View style={s.dutaNote}>
            <View style={s.dutaDot} />
            <Text style={s.dutaNoteTxt}>Dutasteride not scheduled today (Mon / Thu only)</Text>
          </View>
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
  eyebrow: { ...type.eyebrow, marginBottom: 6 },

  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  title:         { ...type.screenTitle },
  titleBadge:    { backgroundColor: 'rgba(255,176,32,0.12)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,176,32,0.3)' },
  titleBadgeTxt: { fontSize: 11, fontWeight: '700', color: color.warmA, letterSpacing: 0.3 },

  heroCard:    { backgroundColor: color.card, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, padding: space.lg, marginBottom: space.md },
  heroEyebrow: { ...type.eyebrow, marginBottom: 10 },
  heroNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 12 },
  heroNum:     { ...type.heroNumber, color: color.warmA, lineHeight: 72 },
  heroNumUnit: { fontSize: 32, fontWeight: '800', color: color.warmA, marginBottom: 10, letterSpacing: -1 },
  heroEditBtn: { marginLeft: 'auto', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  heroEditTxt: { ...type.eyebrow, color: color.warmA, fontSize: 10 },

  metaRow:   { flexDirection: 'row', gap: 24, marginBottom: 14 },
  metaItem:  { gap: 2 },
  metaLabel: { ...type.eyebrow, fontSize: 8 },
  metaVal:   { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, fontFamily: 'System' },

  arcWrap:     { marginHorizontal: -4, marginTop: 4 },
  arcEmpty:    { height: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: color.card2, borderRadius: radius.row },
  arcEmptyTxt: { ...type.eyebrow, color: color.faint, textAlign: 'center' },

  statRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },

  // Protocol rows
  protoRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  ringInner:   { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 17, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  protoText:   { flex: 1 },
  protoName:   { fontSize: 15, fontWeight: '600', color: color.txt, marginBottom: 2 },
  protoDose:   { fontSize: 12, color: color.dim },
  protoRight:  { alignItems: 'center', gap: 3 },
  statusDot:   { width: 9, height: 9, borderRadius: 4.5 },
  adherencePct:{ fontSize: 9, fontWeight: '700', color: color.faint, letterSpacing: 0.3 },
  chevron:     { fontSize: 12, color: color.faint, marginTop: 2 },

  // Expanded detail panel
  detail:      { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(255,176,32,0.04)' },
  detailGrid:  { flexDirection: 'row', gap: 16, marginBottom: 10 },
  detailCell:  { flex: 1, backgroundColor: color.card2, borderRadius: radius.row, padding: 10 },
  detailLabel: { ...type.eyebrow, fontSize: 8, marginBottom: 4 },
  detailVal:   { fontSize: 13, fontWeight: '600', color: color.txt, lineHeight: 18 },
  detailNotes: { fontSize: 13, color: color.dim, lineHeight: 19, marginBottom: 4 },

  dutaNote:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  dutaDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: color.faint },
  dutaNoteTxt: { fontSize: 12, color: color.faint },
});

const ad = StyleSheet.create({
  wrap:       { alignItems: 'center', marginTop: 12 },
  title:      { ...type.eyebrow, fontSize: 8, marginBottom: 8 },
  legend:     { flexDirection: 'row', gap: 20, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt:  { fontSize: 11, color: color.dim },
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
