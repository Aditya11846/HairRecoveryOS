import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
  Modal, Pressable,
} from 'react-native';
import Svg, { Path, Line as SvgLine, Text as SvgText, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getLast30Days, getLastNDays, getStreakCount, get, set } from '../utils/storage';
import { TIMELINE, PHASE1_OBJECTIVES } from '../constants/timeline';
import { C } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHASE_START = new Date('2026-06-01');
const PHASE_END = new Date('2026-09-01');
const PHASE_TOTAL_DAYS = Math.floor((PHASE_END - PHASE_START) / 86400000);

// ─── Phase Timeline ───────────────────────────────────────────────────────────

function PhaseTimeline() {
  const today = new Date();
  const elapsed = Math.max(0, Math.min(today - PHASE_START, PHASE_END - PHASE_START));
  const daysIn = Math.floor(elapsed / 86400000);
  const daysLeft = Math.max(0, PHASE_TOTAL_DAYS - daysIn);
  const pct = Math.round((daysIn / PHASE_TOTAL_DAYS) * 100);

  const milestones = [
    { days: 30, label: '30d' },
    { days: 60, label: '60d' },
    { days: PHASE_TOTAL_DAYS, label: 'Sep 1' },
  ];

  return (
    <View style={pt.card}>
      <View style={pt.topRow}>
        <View>
          <Text style={pt.title}>Phase 1 Journey</Text>
          <Text style={pt.sub}>Jun 1 → Sep 1, 2026</Text>
        </View>
        <View style={pt.pctBubble}>
          <Text style={pt.pctNum}>{pct}%</Text>
          <Text style={pt.pctLbl}>done</Text>
        </View>
      </View>

      <View style={pt.trackWrap}>
        <View style={pt.track}>
          <View style={[pt.fill, { width: `${Math.min(pct, 100)}%` }]} />
          {milestones.map(m => {
            const mPct = Math.round((m.days / PHASE_TOTAL_DAYS) * 100);
            const passed = daysIn >= m.days;
            return (
              <View key={m.days} style={[pt.mDot, { left: `${mPct}%` }]}>
                <View style={[pt.mDotInner, passed && pt.mDotPassed]} />
              </View>
            );
          })}
          <View style={[pt.todayPin, { left: `${Math.min(pct, 99)}%` }]}>
            <View style={pt.todayDot} />
          </View>
        </View>
        <View style={pt.mLabels}>
          {milestones.map(m => (
            <Text key={m.days} style={[pt.mLabel, { left: `${Math.round((m.days / PHASE_TOTAL_DAYS) * 100)}%` }]}>{m.label}</Text>
          ))}
        </View>
      </View>

      <View style={pt.stats}>
        {[
          { num: daysIn, lbl: 'days in' },
          { num: daysLeft, lbl: 'days left' },
          { num: PHASE_TOTAL_DAYS, lbl: 'total' },
        ].map(({ num, lbl }) => (
          <View key={lbl} style={pt.statItem}>
            <Text style={pt.statNum}>{num}</Text>
            <Text style={pt.statLbl}>{lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Milestone Badges ─────────────────────────────────────────────────────────

const MILESTONE_DEFS = [
  { days: 7,  icon: '🌱', label: 'First Week',  color: C.green },
  { days: 30, icon: '🔥', label: 'Month One',   color: C.orange },
  { days: 60, icon: '⚡', label: 'Two Months',  color: C.purple },
  { days: 90, icon: '👑', label: '90 Days',     color: '#FFD700' },
];

function MilestoneBadges({ streak }) {
  return (
    <View style={mb.row}>
      {MILESTONE_DEFS.map(m => {
        const achieved = streak >= m.days;
        const progress = Math.min(streak / m.days, 1);
        const size = 52;
        const sw = 3;
        const r = (size - sw * 2) / 2;
        const cx = size / 2;
        const cy = size / 2;
        const circ = 2 * Math.PI * r;
        const offset = circ * (1 - progress);

        return (
          <View key={m.days} style={[mb.badge, achieved && { borderColor: m.color }]}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Circle cx={cx} cy={cy} r={r} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
                {streak > 0 && (
                  <Circle
                    cx={cx} cy={cy} r={r}
                    stroke={achieved ? m.color : C.sub}
                    strokeWidth={sw} fill="none"
                    strokeDasharray={`${circ}`}
                    strokeDashoffset={`${offset}`}
                    strokeLinecap="round"
                    rotation="-90" origin={`${cx},${cy}`}
                  />
                )}
              </Svg>
              <Text style={[mb.icon, !achieved && { opacity: 0.3 }]}>{achieved ? m.icon : '🔒'}</Text>
            </View>
            <Text style={[mb.days, achieved && { color: m.color }]}>{m.days}d</Text>
            <Text style={mb.label} numberOfLines={1}>
              {achieved ? m.label : streak >= m.days - 14 ? `${m.days - streak}d away` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Adherence Rings ──────────────────────────────────────────────────────────

function AdherenceRing({ icon, label, color, pct }) {
  const size = 72;
  const sw = 5;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const valColor = pct >= 80 ? color : pct >= 50 ? C.orange : C.red;

  return (
    <View style={ar.item}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={cx} cy={cy} r={r} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
          {pct > 0 && (
            <Circle
              cx={cx} cy={cy} r={r}
              stroke={valColor} strokeWidth={sw} fill="none"
              strokeDasharray={`${circ}`}
              strokeDashoffset={`${offset}`}
              strokeLinecap="round"
              rotation="-90" origin={`${cx},${cy}`}
            />
          )}
        </Svg>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={[ar.pct, { color: valColor }]}>{pct}%</Text>
      <Text style={ar.label}>{label}</Text>
    </View>
  );
}

function AdherenceRings({ days }) {
  const count = key => days.filter(d => d.data?.[key] === true).length;
  const dutaDays = days.filter(d => {
    if (!d.date) return false;
    const dow = new Date(d.date + 'T00:00:00').getDay();
    return dow === 1 || dow === 4;
  });
  const dutaTotal = Math.max(dutaDays.length, 1);

  const meds = [
    { icon: '💊', label: 'Oral',    color: C.accent,  pct: Math.round(count('oralMinoxidil') / 30 * 100) },
    { icon: '💧', label: 'Topical', color: C.green,   pct: Math.round(count('topicalMinoxidil') / 30 * 100) },
    { icon: '🛡️', label: 'Duta',    color: C.purple,  pct: Math.round(dutaDays.filter(d => d.data?.dutasteride === true).length / dutaTotal * 100) },
    { icon: '🔴', label: 'RLC',     color: C.red,     pct: Math.round(count('redLightComb') / 30 * 100) },
  ];

  return (
    <View style={ar.wrap}>
      {meds.map(m => <AdherenceRing key={m.label} {...m} />)}
    </View>
  );
}

// ─── Heatmap (4-level) ────────────────────────────────────────────────────────

function getCellColor(day) {
  if (!day || day.isFuture) return '#0D0D0D';
  if (!day.hasCheckin) return '#1A1A1C';
  const d = day.data;
  const full = d?.oralMinoxidil === true && d?.topicalMinoxidil === true;
  if (full && d?.redLightComb === true) return '#64FF8A';
  if (full) return '#39d353';
  if (d?.oralMinoxidil === true || d?.topicalMinoxidil === true) return '#1a4d3a';
  return '#1A1A1C';
}

function buildHeatmapGrid(heatmapDays, todayStr) {
  const today = new Date(todayStr + 'T00:00:00');
  const todayDow = (today.getDay() + 6) % 7;
  const REF_OFFSET = 11 * 7 + todayDow;
  const grid = Array.from({ length: 12 }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const daysAgo = REF_OFFSET - (col * 7 + row);
      return daysAgo < 0 ? { isFuture: true } : null;
    })
  );
  heatmapDays.forEach(day => {
    const d = new Date(day.date + 'T00:00:00');
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff < 0 || diff > REF_OFFSET) return;
    const daysFromRef = REF_OFFSET - diff;
    const col = Math.floor(daysFromRef / 7);
    const row = daysFromRef % 7;
    if (col >= 0 && col < 12 && row >= 0 && row < 7) grid[col][row] = day;
  });
  return grid;
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function getWeeklyData(days) {
  const today = new Date();
  return Array.from({ length: 8 }, (_, w) => {
    let consistent = 0, known = 0;
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - ((7 - w - 1) * 7 + d));
      const dateStr = dt.toISOString().split('T')[0];
      const found = days.find(x => x.date === dateStr);
      if (found) { known++; if (found.data?.oralMinoxidil && found.data?.topicalMinoxidil) consistent++; }
    }
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((7 - w - 1) * 7 + 6));
    return { label: `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]}`, pct: known ? Math.round((consistent / known) * 100) : 0, hasDays: known > 0 };
  });
}

function WeeklyBarChart({ weeks }) {
  const maxH = 72;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Weekly Consistency</Text>
      <Text style={s.cardSub}>% days with oral + topical protocol</Text>
      <View style={wbc.row}>
        {weeks.map((w, i) => {
          const barH = Math.max(4, (w.pct / 100) * maxH);
          const color = w.pct >= 80 ? C.accent : w.pct >= 50 ? '#2563EB' : '#1D3461';
          return (
            <View key={i} style={wbc.col}>
              {w.pct > 0 && <Text style={wbc.pct}>{w.pct}%</Text>}
              <View style={{ height: maxH, justifyContent: 'flex-end' }}>
                <View style={[wbc.bar, { height: barH, backgroundColor: color }]} />
              </View>
              <Text style={wbc.lbl}>{w.label.split(' ')[0]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

function LineChart({ data, label, color, minY, maxY, unit }) {
  const { width } = useWindowDimensions();
  const svgW = width - 64;
  const svgH = 120;
  const pL = 30, pR = 10, pT = 10, pB = 24;
  const plotW = svgW - pL - pR;
  const plotH = svgH - pT - pB;
  const validData = data.filter(d => d.value !== null);
  if (validData.length < 2) return (
    <View style={[s.card, { marginTop: 10 }]}>
      <Text style={s.cardTitle}>{label}</Text>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 8 }}>Not enough data yet</Text>
    </View>
  );
  const xPos = i => pL + (i / Math.max(data.length - 1, 1)) * plotW;
  const yPos = v => pT + (1 - (v - minY) / (maxY - minY)) * plotH;
  let linePath = '', fillPath = '', lastX = null, prevValid = false;
  data.forEach((d, i) => {
    if (d.value === null) { prevValid = false; return; }
    const x = xPos(i), y = yPos(d.value);
    if (!prevValid) {
      linePath += `M${x.toFixed(1)},${y.toFixed(1)}`;
      fillPath += fillPath === '' ? `M${x.toFixed(1)},${(pT + plotH).toFixed(1)} L${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
    } else { linePath += ` L${x.toFixed(1)},${y.toFixed(1)}`; fillPath += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
    lastX = x; prevValid = true;
  });
  if (lastX !== null) fillPath += ` L${lastX.toFixed(1)},${(pT + plotH).toFixed(1)} Z`;
  const gridYVals = [maxY, (maxY + minY) / 2, minY];
  return (
    <View style={[s.card, { marginTop: 10 }]}>
      <Text style={s.cardTitle}>{label}</Text>
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
        {linePath !== '' && <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {data.map((d, i) => d.value !== null && (
          <Circle key={i} cx={xPos(i)} cy={yPos(d.value)} r={2.5} fill={color} stroke="#000" strokeWidth={1.5} />
        ))}
        {data.map((d, i) => i % 5 === 0 && (
          <SvgText key={i} x={xPos(i)} y={svgH - 4} fontSize={7} fill="#3A3A3C" textAnchor="middle">{d.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ─── Day Modal ────────────────────────────────────────────────────────────────

function DayModal({ day, visible, onClose }) {
  if (!day) return null;
  const d = day.data;
  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const check = val => val === true ? '✓' : val === false ? '✗' : '—';
  const checkColor = val => val === true ? C.green : val === false ? C.red : '#3A3A3C';
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
                {d?.cigarettes != null && <View style={dm.row}><Text style={dm.rowLabel}>Cigarettes</Text><Text style={[dm.rowVal, { color: d.cigarettes === 0 ? C.green : C.red }]}>{d.cigarettes}</Text></View>}
                {d?.sleep != null && <View style={dm.row}><Text style={dm.rowLabel}>Sleep</Text><Text style={[dm.rowVal, { color: d.sleep >= 7 ? C.green : C.orange }]}>{d.sleep}h</Text></View>}
                {d?.stress != null && <View style={dm.row}><Text style={dm.rowLabel}>Stress</Text><Text style={dm.rowVal}>{d.stress}/5</Text></View>}
              </View>
              {!!d?.notes && (<><View style={dm.div} /><Text style={dm.notes}>{d.notes}</Text></>)}
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  useFocusEffect(
    useCallback(() => {
      Promise.all([getLast30Days(), getLastNDays(84), getStreakCount(), get('phase1', {})]).then(([d, hd, str, ph]) => {
        setDays(d);
        setHeatmapDays(hd);
        setStreak(str);
        setWeeks(getWeeklyData(d));
        const derivedPh = str >= 30 ? { ...ph, streak30: true } : ph;
        if (str >= 30 && !ph.streak30) set('phase1', derivedPh);
        setPhase1(derivedPh);
      }).catch(() => {});
    }, [])
  );

  const togglePhase1 = async id => {
    const next = { ...phase1, [id]: !phase1[id] };
    setPhase1(next);
    await set('phase1', next);
  };

  const checkedIn = days.filter(d => d.hasCheckin).length;
  const cigsData = days.map(d => ({ label: String(d.dayNum), value: d.data?.cigarettes ?? null }));
  const sleepData = days.map(d => ({ label: String(d.dayNum), value: d.data?.sleep ?? null }));

  const dotColors = { past: C.dim, milestone: C.accent, current: C.green, future: C.card2, goal: C.orange };
  const textColors = { past: C.sub, milestone: C.accent, current: C.green, future: C.dim, goal: C.orange };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.dateLabel}>Last 30 days</Text>
        <Text style={s.title}>Progress</Text>
      </View>

      {/* Phase Timeline */}
      <PhaseTimeline />

      {/* Streak + Logged */}
      <Text style={s.sectionLabel}>STREAK</Text>
      <View style={[s.card, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.streakNum, { color: streak >= 3 ? C.accent : '#fff' }]}>{streak}</Text>
          <Text style={s.streakSub}>{streak === 0 ? 'days — start today' : streak === 1 ? 'day — keep going' : 'consecutive days'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.loggedNum}>{checkedIn}<Text style={s.loggedDenom}>/30</Text></Text>
          <Text style={s.loggedLbl}>logged this month</Text>
          <View style={s.dotRow}>
            {Array.from({ length: 30 }, (_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i < checkedIn ? C.accent : '#2C2C2E' }]} />
            ))}
          </View>
        </View>
      </View>

      {/* Milestone Badges */}
      <Text style={s.sectionLabel}>MILESTONES</Text>
      <View style={s.card}>
        <MilestoneBadges streak={streak} />
      </View>

      {/* Adherence Rings */}
      <Text style={s.sectionLabel}>30-DAY PROTOCOL ADHERENCE</Text>
      <View style={s.card}>
        <AdherenceRings days={days} />
        <Text style={ar.hint}>Duta % based on scheduled days (Mon + Thu) only</Text>
      </View>

      {/* 12-week heatmap */}
      <Text style={s.sectionLabel}>12-WEEK CALENDAR</Text>
      <View style={s.card}>
        {heatmapDays.length > 0 && (() => {
          const grid = buildHeatmapGrid(heatmapDays, todayStr);
          const labelW = 14, labelGap = 4, colGap = 3, rowGap = 3;
          const gridW = width - 32 - 32 - labelW - labelGap;
          const cellSize = Math.floor((gridW - 11 * colGap) / 12);
          const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
          return (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: labelW, marginRight: labelGap }}>
                {DOW.map((d, i) => (
                  <View key={i} style={{ height: cellSize, marginBottom: i < 6 ? rowGap : 0, justifyContent: 'center' }}>
                    <Text style={s.hmLabel}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: colGap }}>
                {grid.map((col, ci) => (
                  <View key={ci} style={{ flexDirection: 'column', gap: rowGap }}>
                    {col.map((day, ri) => {
                      const isToday = day?.date === todayStr;
                      const isFuture = day?.isFuture;
                      return (
                        <TouchableOpacity
                          key={ri}
                          onPress={() => { if (!isFuture && day !== null) { setSelectedDay(day); setShowModal(true); } }}
                          activeOpacity={isFuture ? 1 : 0.7}
                          style={[{
                            width: cellSize, height: cellSize,
                            borderRadius: Math.max(4, Math.floor(cellSize * 0.18)),
                            backgroundColor: getCellColor(day),
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: 'rgba(255,255,255,0.04)',
                          }, isToday && { borderWidth: 2, borderColor: C.accent }]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          );
        })()}
        <View style={s.hmLegend}>
          {[['#1A1A1C', 'Missed'], ['#1a4d3a', 'Partial'], ['#39d353', 'Full'], ['#64FF8A', 'Full + RLC']].map(([color, label]) => (
            <View key={label} style={s.hmItem}>
              <View style={[s.hmDot, { backgroundColor: color }]} />
              <Text style={s.hmTxt}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Weekly consistency bars */}
      <Text style={s.sectionLabel}>WEEKLY CONSISTENCY</Text>
      {weeks.length > 0 && <WeeklyBarChart weeks={weeks} />}

      {/* 30-day trends */}
      <Text style={[s.sectionLabel, { marginTop: 24 }]}>30-DAY TRENDS</Text>
      <LineChart data={cigsData} label="Cigarettes / day" color={C.red} minY={0} maxY={20} unit="" />
      <LineChart data={sleepData} label="Sleep hours" color={C.green} minY={3} maxY={12} unit="h" />

      {/* Phase 1 Objectives */}
      <Text style={[s.sectionLabel, { marginTop: 24 }]}>
        PHASE 1 OBJECTIVES
        <Text style={s.objCount}>  {Object.values(phase1).filter(Boolean).length}/{PHASE1_OBJECTIVES.length}</Text>
      </Text>
      <View style={[s.card, { overflow: 'hidden', padding: 0 }]}>
        {PHASE1_OBJECTIVES.map((item, i) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => togglePhase1(item.id)}
            style={[s.objRow, i > 0 && s.rowBorder]}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, { borderColor: phase1[item.id] ? C.accent : '#3A3A3C', backgroundColor: phase1[item.id] ? C.accent : 'transparent' }]}>
              {phase1[item.id] && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.objLabel, phase1[item.id] && s.objDone]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recovery Timeline */}
      <Text style={[s.sectionLabel, { marginTop: 24 }]}>RECOVERY TIMELINE</Text>
      <View style={[s.card, { padding: 0, overflow: 'hidden' }]}>
        {TIMELINE.map((ev, i) => (
          <View key={i} style={[tl.row, i < TIMELINE.length - 1 && tl.rowBorder]}>
            <View style={tl.lineCol}>
              <View style={[tl.dot, { backgroundColor: dotColors[ev.type] }]} />
              {i < TIMELINE.length - 1 && <View style={tl.connector} />}
            </View>
            <View style={tl.content}>
              <Text style={tl.date}>{ev.date}</Text>
              <Text style={[tl.label, { color: textColors[ev.type] }]}>{ev.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <DayModal day={selectedDay} visible={showModal} onClose={() => setShowModal(false)} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 20 },
  dateLabel: { fontSize: 13, fontWeight: '500', color: C.sub },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 42, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginTop: 28, marginBottom: 12 },
  objCount: { color: C.accent, fontWeight: '700' },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardSub: { fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 12 },

  // Streak
  streakNum: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  streakSub: { fontSize: 13, fontWeight: '600', color: C.sub, marginTop: 2 },
  loggedNum: { fontSize: 28, fontWeight: '700', color: '#fff' },
  loggedDenom: { fontSize: 16, fontWeight: '600', color: C.sub },
  loggedLbl: { fontSize: 11, color: C.sub, marginTop: 2, marginBottom: 6 },
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, maxWidth: 96, marginTop: 4 },
  dot: { width: 5, height: 12, borderRadius: 2 },

  // Heatmap
  hmLabel: { fontSize: 8, fontWeight: '600', color: '#3A3A3C', textAlign: 'right' },
  hmLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  hmItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hmDot: { width: 10, height: 10, borderRadius: 2 },
  hmTxt: { fontSize: 10, color: '#6C6C6C' },

  // Phase 1 objectives
  objRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  objLabel: { fontSize: 14, fontWeight: '500', color: '#fff', flex: 1, lineHeight: 20 },
  objDone: { color: '#3A3A3C', textDecorationLine: 'line-through' },
});

// Phase timeline
const pt = StyleSheet.create({
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 18 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 12, color: C.sub, marginTop: 2 },
  pctBubble: { alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  pctNum: { fontSize: 22, fontWeight: '900', color: C.accent },
  pctLbl: { fontSize: 9, fontWeight: '700', color: C.sub, letterSpacing: 0.5 },
  trackWrap: { marginBottom: 6 },
  track: { height: 8, backgroundColor: '#2C2C2E', borderRadius: 4, position: 'relative', overflow: 'visible', marginBottom: 20 },
  fill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },
  todayPin: { position: 'absolute', top: -3, marginLeft: -6 },
  todayDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 2, borderColor: C.accent },
  mDot: { position: 'absolute', top: -2, marginLeft: -5 },
  mDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3A3A3C', borderWidth: 1.5, borderColor: '#555' },
  mDotPassed: { backgroundColor: C.accent, borderColor: C.accent },
  mLabels: { position: 'relative', height: 16 },
  mLabel: { position: 'absolute', fontSize: 9, color: C.sub, fontWeight: '600', marginLeft: -10 },
  stats: { flexDirection: 'row', marginTop: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 10, color: C.sub, fontWeight: '500', marginTop: 2 },
});

// Milestone badges
const mb = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  badge: { alignItems: 'center', gap: 6, padding: 8, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  icon: { fontSize: 22 },
  days: { fontSize: 13, fontWeight: '800', color: C.sub },
  label: { fontSize: 9, fontWeight: '600', color: C.sub, maxWidth: 64, textAlign: 'center' },
});

// Adherence rings
const ar = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  item: { alignItems: 'center', gap: 6 },
  pct: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', color: C.sub },
  hint: { fontSize: 10, color: '#3A3A3C', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});

// Weekly bar chart
const wbc = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  col: { flex: 1, alignItems: 'center' },
  pct: { fontSize: 6, color: '#3A3A3C', marginBottom: 2 },
  bar: { width: '100%', borderRadius: 3 },
  lbl: { fontSize: 6, color: '#3A3A3C', marginTop: 4 },
});

// Timeline
const tl = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C2C2E' },
  lineCol: { width: 20, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  connector: { flex: 1, width: 1, backgroundColor: '#2C2C2E', marginTop: 4 },
  content: { flex: 1, paddingLeft: 12 },
  date: { fontSize: 10, fontWeight: '600', color: '#3A3A3C' },
  label: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
});

// Day modal
const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  date: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 14 },
  empty: { fontSize: 14, color: C.sub, marginBottom: 16 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: C.sub },
  rowVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E', marginVertical: 12 },
  notes: { fontSize: 13, color: C.sub, fontStyle: 'italic', lineHeight: 18, marginTop: 4 },
  closeBtn: { marginTop: 20, backgroundColor: '#2C2C2E', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 15, fontWeight: '600', color: C.sub },
});
