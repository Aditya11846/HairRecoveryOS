import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
  Modal, Pressable,
} from 'react-native';
import Svg, { Path, Line as SvgLine, Text as SvgText, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLast30Days, getLastNDays, getStreakCount, get, set } from '../utils/storage';
import { TIMELINE, PHASE1_OBJECTIVES } from '../constants/timeline';
import SectionLabel from '../components/common/SectionLabel';
import { C } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeeklyData(days) {
  const today = new Date();
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    let consistent = 0, known = 0;
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - (w * 7 + d));
      const dateStr = dt.toISOString().split('T')[0];
      const found = days.find(x => x.date === dateStr);
      if (found) {
        known++;
        if (found.data?.oralMinoxidil && found.data?.topicalMinoxidil) consistent++;
      }
    }
    const pct = known ? Math.round((consistent / known) * 100) : 0;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (w * 7 + 6));
    weeks.push({
      label: `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]}`,
      pct,
      hasDays: known > 0,
    });
  }
  return weeks;
}

function WeeklyBarChart({ weeks }) {
  const maxH = 80;
  return (
    <View style={[s.card, { paddingBottom: 12 }]}>
      <Text style={s.chartTitle}>Weekly Consistency</Text>
      <Text style={s.chartSub}>% days with full dual-minoxidil protocol</Text>
      <View style={s.barRow}>
        {weeks.map((w, i) => {
          const barH = Math.max(3, (w.pct / 100) * maxH);
          const barColor = w.pct >= 80 ? C.accent : w.pct >= 50 ? '#2563EB' : '#1D3461';
          return (
            <View key={i} style={s.barCol}>
              {w.pct > 0 && <Text style={s.barPct}>{w.pct}%</Text>}
              <View style={{ height: maxH, justifyContent: 'flex-end' }}>
                <View style={[s.bar, { height: barH, backgroundColor: barColor }]} />
              </View>
              <Text style={s.barLabel}>{w.label.split(' ')[0]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LineChart({ data, label, color, minY, maxY, unit }) {
  const { width } = useWindowDimensions();
  const svgW = width - 64;
  const svgH = 130;
  const pL = 34, pR = 10, pT = 10, pB = 28;
  const plotW = svgW - pL - pR;
  const plotH = svgH - pT - pB;

  const validData = data.filter(d => d.value !== null);
  if (validData.length < 2) {
    return (
      <View style={[s.card, s.chartMargin]}>
        <Text style={s.chartTitle}>{label}</Text>
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>No data yet</Text>
      </View>
    );
  }

  const xPos = i => pL + (i / Math.max(data.length - 1, 1)) * plotW;
  const yPos = v => pT + (1 - (v - minY) / (maxY - minY)) * plotH;

  let linePath = '';
  let fillPath = '';
  let lastX = null;
  let prevValid = false;

  data.forEach((d, i) => {
    if (d.value === null) { prevValid = false; return; }
    const x = xPos(i);
    const y = yPos(d.value);
    if (!prevValid) {
      linePath += `M${x.toFixed(1)},${y.toFixed(1)}`;
      fillPath += fillPath === '' ? `M${x.toFixed(1)},${(pT + plotH).toFixed(1)} L${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      linePath += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      fillPath += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    lastX = x;
    prevValid = true;
  });

  if (lastX !== null) fillPath += ` L${lastX.toFixed(1)},${(pT + plotH).toFixed(1)} Z`;

  const gridYVals = [maxY, (maxY + minY) / 2, minY];

  return (
    <View style={[s.card, s.chartMargin]}>
      <Text style={s.chartTitle}>{label}</Text>
      <Svg width={svgW} height={svgH} style={{ marginTop: 8 }}>
        {gridYVals.map((v, i) => (
          <SvgLine key={i} x1={pL} y1={yPos(v)} x2={pL + plotW} y2={yPos(v)} stroke="#2C2C2E" strokeWidth={1} />
        ))}
        {gridYVals.map((v, i) => (
          <SvgText key={i} x={pL - 4} y={yPos(v) + 3} fontSize={8} fill="#3A3A3C" textAnchor="end">
            {Number.isInteger(v) ? v : v.toFixed(0)}{unit}
          </SvgText>
        ))}
        {fillPath !== '' && <Path d={fillPath} fill={`${color}15`} />}
        {linePath !== '' && (
          <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {data.map((d, i) => d.value !== null && (
          <Circle key={i} cx={xPos(i)} cy={yPos(d.value)} r={2.5} fill={color} stroke="#000" strokeWidth={1.5} />
        ))}
        {/* X axis labels: show every 5th */}
        {data.map((d, i) => i % 5 === 0 && (
          <SvgText key={i} x={xPos(i)} y={svgH - 4} fontSize={7} fill="#3A3A3C" textAnchor="middle">
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function getCellColor(day) {
  if (!day || day.isFuture) return '#0D0D0D';
  if (!day.hasCheckin) return '#1C1C1E';
  const d = day.data;
  if (d?.oralMinoxidil && d?.topicalMinoxidil) return '#39d353';
  if (d?.oralMinoxidil || d?.topicalMinoxidil) return '#1a4d3a';
  return '#1C1C1E';
}

function buildHeatmapGrid(heatmapDays, todayStr) {
  const today = new Date(todayStr + 'T00:00:00');
  const todayDow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  const REF_OFFSET = 11 * 7 + todayDow; // days from ref Monday to today

  // 12 cols × 7 rows, prefill future markers
  const grid = Array.from({ length: 12 }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const daysFromRef = col * 7 + row;
      const daysAgo = REF_OFFSET - daysFromRef;
      return daysAgo < 0 ? { isFuture: true } : null;
    }),
  );

  heatmapDays.forEach(day => {
    const d = new Date(day.date + 'T00:00:00');
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff < 0 || diff > REF_OFFSET) return;
    const daysFromRef = REF_OFFSET - diff;
    const col = Math.floor(daysFromRef / 7);
    const row = daysFromRef % 7;
    if (col >= 0 && col < 12 && row >= 0 && row < 7) {
      grid[col][row] = day;
    }
  });

  return grid;
}

function DayModal({ day, visible, onClose }) {
  if (!day) return null;
  const d = day.data;
  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const check = (val) => val === true ? '✓' : val === false ? '✗' : '—';
  const checkColor = (val) => val === true ? '#39d353' : val === false ? '#FF453A' : '#3A3A3C';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={dm.overlay} onPress={onClose}>
        <Pressable style={dm.card} onPress={e => e.stopPropagation()}>
          <Text style={dm.date}>{dateLabel}</Text>
          {!day.hasCheckin ? (
            <Text style={dm.noCheckin}>No check-in recorded</Text>
          ) : (
            <>
              <View style={dm.grid}>
                {[
                  { label: 'Oral Minoxidil', val: d?.oralMinoxidil },
                  { label: 'Novegrow', val: d?.topicalMinoxidil },
                  { label: 'Red Light', val: d?.redLightComb },
                  { label: 'Dutasteride', val: d?.dutasteride },
                ].map(({ label, val }) => (
                  <View key={label} style={dm.row}>
                    <Text style={dm.rowLabel}>{label}</Text>
                    <Text style={[dm.rowVal, { color: checkColor(val) }]}>{check(val)}</Text>
                  </View>
                ))}
              </View>
              <View style={dm.divider} />
              <View style={dm.grid}>
                {d?.cigarettes != null && (
                  <View style={dm.row}>
                    <Text style={dm.rowLabel}>Cigarettes</Text>
                    <Text style={[dm.rowVal, { color: d.cigarettes === 0 ? '#39d353' : '#FF453A' }]}>{d.cigarettes}</Text>
                  </View>
                )}
                {d?.sleep != null && (
                  <View style={dm.row}>
                    <Text style={dm.rowLabel}>Sleep</Text>
                    <Text style={[dm.rowVal, { color: d.sleep >= 7 ? '#39d353' : '#F97316' }]}>{d.sleep}h</Text>
                  </View>
                )}
                {d?.stress != null && (
                  <View style={dm.row}>
                    <Text style={dm.rowLabel}>Stress</Text>
                    <Text style={[dm.rowVal, { color: d.stress <= 4 ? '#39d353' : d.stress <= 7 ? '#F97316' : '#FF453A' }]}>{d.stress}/10</Text>
                  </View>
                )}
              </View>
              {!!d?.notes && (
                <>
                  <View style={dm.divider} />
                  <Text style={dm.notes}>{d.notes}</Text>
                </>
              )}
            </>
          )}
          <TouchableOpacity onPress={onClose} style={dm.closeBtn} activeOpacity={0.8}>
            <Text style={dm.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Progress() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState([]);
  const [heatmapDays, setHeatmapDays] = useState([]);
  const [streak, setStreak] = useState(0);
  const [weeks, setWeeks] = useState([]);
  const [phase1, setPhase1] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([getLast30Days(), getLastNDays(84), getStreakCount(), get('phase1', {})]).then(([d, hd, str, ph]) => {
      setDays(d);
      setHeatmapDays(hd);
      setStreak(str);
      setWeeks(getWeeklyData(d));
      const derivedPh = str >= 30 ? { ...ph, streak30: true } : ph;
      if (str >= 30 && !ph.streak30) set('phase1', derivedPh);
      setPhase1(derivedPh);
    }).catch(() => {});
  }, []);

  const togglePhase1 = async (id) => {
    const next = { ...phase1, [id]: !phase1[id] };
    setPhase1(next);
    await set('phase1', next);
  };

  const checkedIn = days.filter(d => d.hasCheckin).length;

  const cigsData = days.map(d => ({ label: String(d.dayNum), value: d.data?.cigarettes ?? null }));
  const sleepData = days.map(d => ({ label: String(d.dayNum), value: d.data?.sleep ?? null }));
  const stressData = days.map(d => ({ label: String(d.dayNum), value: d.data?.stress ?? null }));

  const dotColors = { past: C.dim, milestone: C.accent, current: C.green, future: C.card2, goal: C.orange };
  const textColors = { past: C.sub, milestone: C.accent, current: C.green, future: C.dim, goal: C.orange };

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.dateLabel}>Last 30 days</Text>
        <Text style={s.title}>Progress</Text>
      </View>

      {/* Streak hero */}
      <View style={[s.card, s.streakCard]}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionLabel}>CURRENT STREAK</Text>
          <Text style={[s.streakNum, { color: streak >= 3 ? C.accent : C.text }]}>{streak}</Text>
          <Text style={s.streakSub}>
            {streak === 0 ? 'days — start today' : streak === 1 ? 'day — keep going' : 'consecutive days'}
          </Text>
        </View>
        <View style={s.loggedCol}>
          <Text style={s.sectionLabel}>LOGGED</Text>
          <Text style={s.loggedNum}>
            {checkedIn}<Text style={s.loggedDenom}>/30</Text>
          </Text>
          <View style={s.dotRow}>
            {Array.from({ length: 30 }, (_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i < checkedIn ? C.accent : C.card2 }]} />
            ))}
          </View>
        </View>
      </View>

      {/* Weekly bar chart */}
      <View style={s.section}>
        <SectionLabel label="Protocol Consistency" />
        {weeks.length > 0 && <WeeklyBarChart weeks={weeks} />}
      </View>

      {/* 12-week contribution heatmap */}
      <View style={s.section}>
        <SectionLabel label="12-Week Calendar" />
        <View style={s.card}>
          {heatmapDays.length > 0 && (() => {
            const heatmapGrid = buildHeatmapGrid(heatmapDays, todayStr);
            const labelW = 14;
            const labelGap = 4;
            const colGap = 3;
            const rowGap = 3;
            const gridW = width - 32 - 32 - labelW - labelGap; // screen - scrollview padding - card padding - label
            const cellSize = Math.floor((gridW - 11 * colGap) / 12);
            const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

            return (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Day-of-week labels */}
                <View style={{ width: labelW, marginRight: labelGap, marginTop: 0 }}>
                  {DOW_LABELS.map((d, i) => (
                    <View key={i} style={{ height: cellSize, marginBottom: i < 6 ? rowGap : 0, justifyContent: 'center' }}>
                      <Text style={s.hmLabel}>{d}</Text>
                    </View>
                  ))}
                </View>
                {/* Grid */}
                <View style={{ flexDirection: 'row', gap: colGap }}>
                  {heatmapGrid.map((col, ci) => (
                    <View key={ci} style={{ flexDirection: 'column', gap: rowGap }}>
                      {col.map((day, ri) => {
                        const isToday = day?.date === todayStr;
                        const isFuture = day?.isFuture;
                        return (
                          <TouchableOpacity
                            key={ri}
                            onPress={() => {
                              if (!isFuture && day !== null) {
                                setSelectedDay(day);
                                setShowModal(true);
                              }
                            }}
                            activeOpacity={isFuture ? 1 : 0.7}
                            style={[
                              {
                                width: cellSize,
                                height: cellSize,
                                borderRadius: Math.max(6, Math.floor(cellSize * 0.18)),
                                backgroundColor: getCellColor(day),
                                borderWidth: StyleSheet.hairlineWidth,
                                borderColor: 'rgba(255,255,255,0.04)',
                              },
                              isToday && { borderWidth: 2, borderColor: '#3B82F6' },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
          {/* Legend */}
          <View style={s.hmLegend}>
            {[['#1C1C1E', 'None'], ['#1a4d3a', 'Partial'], ['#39d353', 'Full protocol']].map(([color, label]) => (
              <View key={label} style={s.hmLegendItem}>
                <View style={[s.hmLegendDot, { backgroundColor: color }]} />
                <Text style={s.hmLegendText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <DayModal day={selectedDay} visible={showModal} onClose={() => setShowModal(false)} />

      {/* Line charts */}
      <View style={s.section}>
        <SectionLabel label="30-Day Trends" />
        <LineChart data={cigsData} label="Cigarettes / day" color={C.red} minY={0} maxY={20} unit="" />
        <LineChart data={sleepData} label="Sleep hours" color={C.green} minY={3} maxY={10} unit="h" />
        <LineChart data={stressData} label="Stress level" color={C.orange} minY={1} maxY={10} unit="" />
      </View>

      {/* Recovery timeline */}
      <View style={s.section}>
        <SectionLabel label="Recovery Timeline" />
        <View style={s.card}>
          {TIMELINE.map((ev, i) => (
            <View key={i} style={[s.timelineRow, i < TIMELINE.length - 1 && s.timelineRowBorder]}>
              <View style={s.timelineLine}>
                <View style={[s.timelineDot, { backgroundColor: dotColors[ev.type] }]} />
                {i < TIMELINE.length - 1 && <View style={s.timelineConnector} />}
              </View>
              <View style={s.timelineContent}>
                <Text style={s.timelineDate}>{ev.date}</Text>
                <Text style={[s.timelineLabel, { color: textColors[ev.type] }]}>{ev.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Phase 1 */}
      <View style={s.section}>
        <View style={s.phase1Header}>
          <SectionLabel label="Phase 1 Objectives" />
          <Text style={s.phase1Count}>
            {Object.values(phase1).filter(Boolean).length}/{PHASE1_OBJECTIVES.length}
          </Text>
        </View>
        <View style={[s.card, { overflow: 'hidden' }]}>
          {PHASE1_OBJECTIVES.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => togglePhase1(item.id)}
              style={[s.phase1Row, i > 0 && s.rowBorder]}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, { borderColor: phase1[item.id] ? C.accent : C.dim, backgroundColor: phase1[item.id] ? C.accent : 'transparent' }]}>
                {phase1[item.id] && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={[s.phase1Label, phase1[item.id] && s.phase1Done]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 24 },
  dateLabel: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8, lineHeight: 40, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 4 },
  card: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  streakCard: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  streakNum: { fontSize: 56, fontWeight: '900', lineHeight: 60, marginVertical: 4 },
  streakSub: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  loggedCol: { alignItems: 'flex-end' },
  loggedNum: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginVertical: 4 },
  loggedDenom: { fontSize: 18, fontWeight: '600', color: '#8E8E93' },
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, maxWidth: 100, marginTop: 4 },
  dot: { width: 6, height: 14, borderRadius: 2 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  chartSub: { fontSize: 12, color: '#8E8E93', marginTop: 2, marginBottom: 12 },
  chartMargin: { marginTop: 10 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  barPct: { fontSize: 6, color: '#3A3A3C', marginBottom: 2 },
  bar: { width: '100%', borderRadius: 3 },
  barLabel: { fontSize: 6, color: '#3A3A3C', marginTop: 4 },
  hmLabel: { fontSize: 8, fontWeight: '600', color: '#3A3A3C', textAlign: 'right' },
  hmLegend: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  hmLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hmLegendDot: { width: 10, height: 10, borderRadius: 2 },
  hmLegendText: { fontSize: 10, color: '#6C6C6C' },
  timelineRow: { flexDirection: 'row', paddingVertical: 10 },
  timelineRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C2C2E' },
  timelineLine: { width: 20, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  timelineConnector: { flex: 1, width: 1, backgroundColor: '#2C2C2E', marginTop: 4 },
  timelineContent: { flex: 1, paddingLeft: 12 },
  timelineDate: { fontSize: 10, fontWeight: '600', color: '#3A3A3C' },
  timelineLabel: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  phase1Header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  phase1Count: { fontSize: 12, fontWeight: '600', color: '#3B82F6', marginBottom: 10 },
  phase1Row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, minHeight: 56, gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  phase1Label: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', flex: 1, lineHeight: 20 },
  phase1Done: { color: '#3A3A3C', textDecorationLine: 'line-through' },
});

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  date: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  noCheckin: { fontSize: 14, color: '#8E8E93', marginBottom: 16 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: '#8E8E93' },
  rowVal: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E', marginVertical: 12 },
  notes: { fontSize: 13, color: '#8E8E93', fontStyle: 'italic', lineHeight: 18, marginTop: 4 },
  closeBtn: { marginTop: 20, backgroundColor: '#2C2C2E', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
});
