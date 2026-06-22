import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
  Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getLast30Days, getLastNDays, getStreakCount, get, set } from '../utils/storage';
import { TIMELINE, PHASE1_OBJECTIVES } from '../constants/timeline';
import AreaChart from '../components/AreaChart';
import Sparkline from '../components/Sparkline';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import Heatmap, { HeatmapKey } from '../components/Heatmap';
import { Flask } from '../components/Icon';
import { color, type, radius, space } from '../theme/tokens';

const PHASE_START = new Date('2026-06-01');
const PHASE_END   = new Date('2026-09-01');
const PHASE_TOTAL_DAYS = Math.floor((PHASE_END - PHASE_START) / 86400000);

// ── Phase Timeline ────────────────────────────────────────────────────────────

function PhaseTimeline() {
  const today = new Date();
  const elapsed = Math.max(0, Math.min(today - PHASE_START, PHASE_END - PHASE_START));
  const daysIn   = Math.floor(elapsed / 86400000);
  const daysLeft = Math.max(0, PHASE_TOTAL_DAYS - daysIn);
  const pct = Math.round((daysIn / PHASE_TOTAL_DAYS) * 100);

  return (
    <View style={pt.card}>
      <View style={pt.topRow}>
        <View>
          <Text style={pt.title}>Phase 1 Journey</Text>
          <Text style={pt.sub}>Jun 1 → Sep 1, 2026</Text>
        </View>
        <View style={pt.pctBubble}>
          <Text style={pt.pctNum}>{pct}%</Text>
          <Text style={pt.pctLbl}>complete</Text>
        </View>
      </View>

      {/* Plain progress bar (not a slider) */}
      <View style={pt.trackWrap}>
        <View style={pt.track}>
          <View style={[pt.fill, { width: `${Math.min(pct, 100)}%` }]} />
          {[30, 60, PHASE_TOTAL_DAYS].map(d => {
            const mp = Math.round((d / PHASE_TOTAL_DAYS) * 100);
            return (
              <View key={d} style={[pt.mDot, { left: `${mp}%` }]}>
                <View style={[pt.mDotInner, daysIn >= d && pt.mDotPassed]} />
              </View>
            );
          })}
          <View style={[pt.todayPin, { left: `${Math.min(pct, 99)}%` }]}>
            <View style={pt.todayDot} />
          </View>
        </View>
        <View style={pt.mLabels}>
          {[{ d: 30, lbl: '30d' }, { d: 60, lbl: '60d' }, { d: PHASE_TOTAL_DAYS, lbl: "Sep '26" }].map(({ d, lbl }) => (
            <Text key={d} style={[pt.mLabel, { left: `${Math.round((d / PHASE_TOTAL_DAYS) * 100)}%` }]}>{lbl}</Text>
          ))}
        </View>
      </View>

      <View style={pt.stats}>
        {[{ num: daysIn, lbl: 'days in' }, { num: daysLeft, lbl: 'days left' }, { num: PHASE_TOTAL_DAYS, lbl: 'total' }].map(({ num, lbl }) => (
          <View key={lbl} style={pt.statItem}>
            <Text style={pt.statNum}>{num}</Text>
            <Text style={pt.statLbl}>{lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Day Modal ─────────────────────────────────────────────────────────────────

function DayModal({ day, visible, onClose }) {
  if (!day) return null;
  const d = day.data;
  const dateLabel = day.date
    ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '—';
  const check = val => val === true ? '✓' : val === false ? '✗' : '—';
  const checkColor = val => val === true ? color.green : val === false ? color.red : color.faint;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={dm.overlay} onPress={onClose}>
        <Pressable style={dm.card} onPress={e => e.stopPropagation()}>
          <Text style={dm.date}>{dateLabel}</Text>
          {!day.hasCheckin ? (
            <Text style={dm.empty}>No check-in recorded</Text>
          ) : (
            <>
              <View style={dm.grid}>
                {[
                  { label: 'Oral Minoxidil', val: d?.oralMinoxidil },
                  { label: 'Novegrow Topical', val: d?.topicalMinoxidil },
                  { label: 'Red Light Comb', val: d?.redLightComb },
                  { label: 'Dutasteride', val: d?.dutasteride },
                ].map(({ label, val }) => (
                  <View key={label} style={dm.row}>
                    <Text style={dm.rowLabel}>{label}</Text>
                    <Text style={[dm.rowVal, { color: checkColor(val) }]}>{check(val)}</Text>
                  </View>
                ))}
              </View>
              <View style={dm.div} />
              <View style={dm.grid}>
                {d?.cigarettes != null && <View style={dm.row}><Text style={dm.rowLabel}>Cigarettes</Text><Text style={[dm.rowVal, { color: d.cigarettes === 0 ? color.green : color.red }]}>{d.cigarettes}</Text></View>}
                {d?.sleep != null       && <View style={dm.row}><Text style={dm.rowLabel}>Sleep</Text><Text style={[dm.rowVal, { color: d.sleep >= 7 ? color.green : color.warmA }]}>{d.sleep}h</Text></View>}
                {d?.stress != null      && <View style={dm.row}><Text style={dm.rowLabel}>Stress</Text><Text style={dm.rowVal}>{d.stress}/5</Text></View>}
              </View>
              {!!d?.notes && <><View style={dm.div} /><Text style={dm.notes}>{d.notes}</Text></>}
            </>
          )}
          <TouchableOpacity onPress={onClose} style={dm.closeBtn} activeOpacity={0.8}>
            <Text style={dm.closeTxt}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Convert raw day records → Heatmap cells flat array ────────────────────────

function buildCells(heatmapDays, todayStr, weeks = 12) {
  const total = weeks * 7;
  const today = new Date(todayStr + 'T00:00:00');
  // Map date string → day record
  const byDate = {};
  heatmapDays.forEach(d => { byDate[d.date] = d; });

  return Array.from({ length: total }, (_, idx) => {
    const wi = Math.floor(idx / 7);
    const di = idx % 7; // 0=Sun
    // Earliest week is wi=0. Last slot (wi=weeks-1, di=today.getDay()) is today.
    const daysFromToday = (weeks - 1 - wi) * 7 + (today.getDay() - di);
    const cellDate = new Date(today);
    cellDate.setDate(today.getDate() - daysFromToday);
    if (cellDate > today) return { intensity: 0 };
    const dateStr = cellDate.toISOString().split('T')[0];
    const record = byDate[dateStr];
    if (!record || !record.hasCheckin) {
      // Past date with no check-in = miss (damage)
      return { intensity: 0, miss: cellDate < today, date: dateStr, hasCheckin: false };
    }
    const d = record.data;
    const oral    = d?.oralMinoxidil === true;
    const topical = d?.topicalMinoxidil === true;
    const rlc     = d?.redLightComb === true;
    const duta    = d?.dutasteride === true;
    let intensity = 0;
    if (oral && topical && rlc)       intensity = 3;
    else if (oral && topical)         intensity = 2;
    else if (oral || topical)         intensity = 1;
    return { intensity, date: dateStr, hasCheckin: true, data: d };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Progress({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [days, setDays]             = useState([]);
  const [heatmapDays, setHeatmapDays] = useState([]);
  const [streak, setStreak]         = useState(0);
  const [phase1, setPhase1]         = useState({});
  const [bloodworkData, setBloodworkData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getLast30Days(),
        getLastNDays(84),
        getStreakCount(),
        get('phase1', {}),
        get('bloodwork', null),
      ]).then(([d, hd, str, ph, bw]) => {
        setDays(d);
        setHeatmapDays(hd);
        setStreak(str);
        const derivedPh = str >= 30 ? { ...ph, streak30: true } : ph;
        if (str >= 30 && !ph.streak30) set('phase1', derivedPh);
        setPhase1(derivedPh);
        setBloodworkData(bw);
      }).catch(() => {});
    }, [])
  );

  const togglePhase1 = async id => {
    const next = { ...phase1, [id]: !phase1[id] };
    setPhase1(next);
    await set('phase1', next);
  };

  // Cigarette data for AreaChart (last 30 days, newest last)
  const cigValues = days.map(d => d.data?.cigarettes ?? 0);
  const sleepValues = days.map(d => d.data?.sleep ?? 0).filter(v => v > 0);
  const stressValues = days.map(d => d.data?.stress ?? 0).filter(v => v > 0);

  // Cigarette trend
  const last7cigs  = days.slice(0, 7).reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / 7;
  const prev7cigs  = days.slice(7, 14).reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / 7;
  const cigChange  = prev7cigs > 0 ? Math.round(((last7cigs - prev7cigs) / prev7cigs) * 100) : null;
  const avgCigs    = days.length ? (days.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / days.length).toFixed(1) : '—';

  // Bloodwork summary
  const bwLogged = bloodworkData?.values
    ? ['dht', 'ferritin', 'vitamin_d', 'tsh', 'test_total', 'test_free', 'zinc'].filter(k => bloodworkData.values[k]?.trim()).length
    : 0;

  // Heatmap cells
  const cells = buildCells(heatmapDays, todayStr, 12);

  const handleCellPress = (cell) => {
    if (cell && cell.hasCheckin !== undefined) {
      setSelectedDay({ date: cell.date, hasCheckin: cell.hasCheckin, data: cell.data });
      setShowModal(true);
    }
  };

  const objCompleted = Object.values(phase1).filter(Boolean).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={s.eyebrow}>Phase 1 · Jun–Sep 2026</Text>
      <Text style={s.title}>Progress</Text>

      {/* Phase timeline */}
      <PhaseTimeline />

      {/* Cigarettes area chart */}
      <SectionHeader
        label={`Cigarettes · 30 days`}
        count={cigChange != null ? `${cigChange >= 0 ? '+' : ''}${cigChange}%` : undefined}
      />
      <Card flush>
        <View style={s.chartHeader}>
          <Text style={s.chartTitle}>
            {avgCigs === '0.0' || avgCigs === '0' ? 'Smoke-free' : `Trending · primary sabotage`}
          </Text>
          <Text style={s.chartMeta}>{avgCigs}/day avg</Text>
        </View>
        {cigValues.length > 1 ? (
          <AreaChart
            data={cigValues}
            strokeColor={color.red}
            height={96}
            width={width - 32}
          />
        ) : (
          <View style={s.emptyChart}><Text style={s.emptyChartTxt}>Log check-ins to see trend</Text></View>
        )}
      </Card>

      {/* Sleep + Stress sparklines */}
      <SectionHeader label="Lifestyle · 30 days" />
      <View style={s.sparkRow}>
        <Card style={s.sparkCard}>
          <Text style={s.sparkLabel}>Sleep</Text>
          <Text style={[s.sparkVal, { color: color.cool }]}>
            {sleepValues.length ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1) : '—'}
            <Text style={s.sparkUnit}>h avg</Text>
          </Text>
          <Sparkline data={sleepValues} strokeColor={color.cool} width={100} height={36} />
        </Card>
        <Card style={s.sparkCard}>
          <Text style={s.sparkLabel}>Stress</Text>
          <Text style={[s.sparkVal, { color: color.warmA }]}>
            {stressValues.length ? (stressValues.reduce((a, b) => a + b, 0) / stressValues.length).toFixed(1) : '—'}
            <Text style={s.sparkUnit}>/5 avg</Text>
          </Text>
          <Sparkline data={stressValues} strokeColor={color.warmA} width={100} height={36} />
        </Card>
      </View>

      {/* 12-week consistency heatmap */}
      <SectionHeader label="Consistency · 12 weeks" />
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Heatmap cells={cells} weeks={12} onCellPress={handleCellPress} />
        </ScrollView>
        <HeatmapKey />
      </Card>

      {/* Bloodwork navigation card */}
      <SectionHeader label="Bloodwork" count={`${bwLogged}/7`} />
      <Card flush>
        <ListRow
          icon={<Flask size={16} color={bwLogged < 7 ? color.warmA : color.green} />}
          name="Lab markers"
          desc={bwLogged === 0 ? 'No markers logged yet' : bwLogged < 7 ? `${7 - bwLogged} to log · Tap to update` : 'All 7 markers logged'}
          onPress={() => navigation.navigate('Labs')}
          last
        />
      </Card>

      {/* Phase 1 objectives */}
      <SectionHeader label="Phase 1 Objectives" count={`${objCompleted}/${PHASE1_OBJECTIVES.length}`} />
      <Card flush>
        {PHASE1_OBJECTIVES.map((item, i) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => togglePhase1(item.id)}
            style={[s.objRow, i > 0 && s.objBorder]}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, phase1[item.id] && s.checkboxDone]}>
              {phase1[item.id] && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.objLabel, phase1[item.id] && s.objDone]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Recovery timeline */}
      <SectionHeader label="Recovery Timeline" />
      <Card flush>
        {TIMELINE.map((ev, i) => (
          <View key={i} style={[tl.row, i < TIMELINE.length - 1 && tl.rowBorder]}>
            <View style={tl.lineCol}>
              <View style={[tl.dot, { backgroundColor: TL_DOT_COLOR[ev.type] }]} />
              {i < TIMELINE.length - 1 && <View style={tl.connector} />}
            </View>
            <View style={tl.content}>
              <Text style={tl.date}>{ev.date}</Text>
              <Text style={[tl.label, { color: TL_TEXT_COLOR[ev.type] }]}>{ev.label}</Text>
            </View>
          </View>
        ))}
      </Card>

      <DayModal day={selectedDay} visible={showModal} onClose={() => setShowModal(false)} />
    </ScrollView>
  );
}

const TL_DOT_COLOR  = { past: color.faint, milestone: color.cool,  current: color.green, future: color.card2, goal: color.warmA };
const TL_TEXT_COLOR = { past: color.faint, milestone: color.cool,  current: color.green, future: color.dim,   goal: color.warmA };

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  eyebrow: { ...type.eyebrow, marginBottom: 6 },
  title:   { ...type.screenTitle, marginBottom: 20 },

  // Cigarette chart
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  chartTitle:  { ...type.bodyStrong, color: color.red },
  chartMeta:   { ...type.eyebrow, color: color.faint },
  emptyChart:  { height: 72, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginBottom: 14, backgroundColor: color.card2, borderRadius: radius.row },
  emptyChartTxt: { ...type.eyebrow, color: color.faint },

  // Sparklines
  sparkRow:  { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  sparkCard: { flex: 1, marginBottom: 0 },
  sparkLabel:{ ...type.eyebrow, marginBottom: 4 },
  sparkVal:  { ...type.statValue, fontSize: 20, marginBottom: 8 },
  sparkUnit: { fontSize: 12, fontWeight: '500', color: color.dim },

  // Objectives
  objRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, gap: 12 },
  objBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.faint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxDone: { backgroundColor: color.green, borderColor: color.green },
  checkmark:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  objLabel: { ...type.body, flex: 1, lineHeight: 20 },
  objDone:  { color: color.faint, textDecorationLine: 'line-through' },
});

// Phase timeline
const pt = StyleSheet.create({
  card:      { backgroundColor: color.card, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, padding: space.lg, marginBottom: space.md },
  topRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  title:     { ...type.bodyStrong, fontSize: 16 },
  sub:       { fontSize: 12, color: color.dim, marginTop: 2 },
  pctBubble: { alignItems: 'center', backgroundColor: color.card2, borderRadius: radius.row, paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pctNum:    { ...type.statValue, color: color.warmA },
  pctLbl:    { ...type.eyebrow, fontSize: 8, marginTop: 2 },
  trackWrap: { marginBottom: 6 },
  track:     { height: 6, backgroundColor: color.card2, borderRadius: 3, position: 'relative', overflow: 'visible', marginBottom: 22 },
  fill:      { height: 6, backgroundColor: color.warmA, borderRadius: 3 },
  todayPin:  { position: 'absolute', top: -4, marginLeft: -6 },
  todayDot:  { width: 14, height: 14, borderRadius: 7, backgroundColor: color.txt, borderWidth: 2, borderColor: color.warmA },
  mDot:      { position: 'absolute', top: -3, marginLeft: -5 },
  mDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.card2, borderWidth: 1.5, borderColor: color.line2 },
  mDotPassed:{ backgroundColor: color.warmA, borderColor: color.warmA },
  mLabels:   { position: 'relative', height: 16 },
  mLabel:    { position: 'absolute', ...type.eyebrow, fontSize: 8, marginLeft: -10 },
  stats:     { flexDirection: 'row', marginTop: 10 },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { ...type.statValue, fontSize: 20 },
  statLbl:   { ...type.eyebrow, marginTop: 3 },
});

// Timeline
const tl = StyleSheet.create({
  row:       { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: space.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  lineCol:   { width: 20, alignItems: 'center' },
  dot:       { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  connector: { flex: 1, width: 1, backgroundColor: color.line, marginTop: 4 },
  content:   { flex: 1, paddingLeft: 12 },
  date:      { ...type.eyebrow, fontSize: 8, marginBottom: 3 },
  label:     { fontSize: 12, fontWeight: '500', lineHeight: 16 },
});

// Day modal
const dm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:     { backgroundColor: color.card, borderRadius: radius.card, padding: 20, width: '100%', maxWidth: 360, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  date:     { ...type.bodyStrong, fontSize: 16, marginBottom: 14 },
  empty:    { ...type.body, color: color.dim, marginBottom: 16 },
  grid:     { gap: 10 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...type.body, color: color.dim },
  rowVal:   { ...type.bodyStrong, fontSize: 15 },
  div:      { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: 12 },
  notes:    { fontSize: 13, color: color.dim, fontStyle: 'italic', lineHeight: 18, marginTop: 4 },
  closeBtn: { marginTop: 20, backgroundColor: color.card2, height: 44, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 15, fontWeight: '600', color: color.dim },
});
