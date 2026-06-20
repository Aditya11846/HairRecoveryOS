import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Circle as SvgCircle,
  Ellipse as SvgEllipse,
  Path as SvgPath,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { getTodayKey, getStreakCount, getRecentCheckins, loadCheckin, daysToCheckpoint, get, set } from '../utils/storage';
import { getCachedOrFreshInsights } from '../services/ai';
import { PROTOCOL_DETAILS } from '../constants/protocol';
import { C } from '../theme';

// ─── Streak Ring ──────────────────────────────────────────────────────────────

function StreakRing({ streak, max = 90 }) {
  const size = 110;
  const sw = 6;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(streak / max, 1);
  const offset = circ * (1 - pct);
  const color = streak >= 60 ? C.orange : streak >= 30 ? C.accent : C.accent;

  return (
    <View style={hr.ringWrap}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <SvgCircle cx={cx} cy={cy} r={r} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
        {streak > 0 && (
          <SvgCircle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={sw} fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx},${cy}`}
          />
        )}
      </Svg>
      <Text style={hr.ringNum}>{streak}</Text>
      <Text style={hr.ringLabel}>DAYS</Text>
    </View>
  );
}

// ─── Hero Card ────────────────────────────────────────────────────────────────

const MEDS = [
  { icon: '💊', key: 'oralMinoxidil', label: 'Oral' },
  { icon: '💧', key: 'topicalMinoxidil', label: 'Topical' },
  { icon: '🛡️', key: 'dutasteride', label: 'Duta', dutaOnly: true },
  { icon: '🔴', key: 'redLightComb', label: 'RLC' },
];

function HeroCard({ streak, todayCI }) {
  const isDuta = new Date().getDay() === 1 || new Date().getDay() === 4;
  const pct = Math.round(Math.min(streak / 90, 1) * 100);

  const visibleMeds = MEDS.filter(m => !m.dutaOnly || isDuta);

  return (
    <View style={hr.card}>
      {/* Streak section */}
      <View style={hr.top}>
        <View style={{ flex: 1 }}>
          <Text style={hr.streakHeading}>Current Streak</Text>
          <Text style={hr.streakNum}>{streak} <Text style={hr.streakUnit}>days</Text></Text>
          <View style={hr.progressBar}>
            <View style={[hr.progressFill, { width: `${pct}%`, backgroundColor: streak >= 30 ? C.green : C.accent }]} />
          </View>
          <Text style={hr.progressLabel}>{pct}% to 90-day mark</Text>
        </View>
        <StreakRing streak={streak} />
      </View>

      {/* Divider */}
      <View style={hr.divider} />

      {/* Today's meds */}
      <View style={hr.medsRow}>
        {visibleMeds.map(m => {
          const val = todayCI?.[m.key];
          const taken = val === true;
          const skipped = val === false;
          return (
            <View key={m.key} style={hr.medItem}>
              <View style={[hr.medIcon, taken && hr.medIconGreen, skipped && hr.medIconRed]}>
                <Text style={{ fontSize: 16 }}>{m.icon}</Text>
              </View>
              <Text style={[hr.medStatus, taken && { color: C.green }, skipped && { color: C.red }]}>
                {taken ? '✓' : skipped ? '✕' : '—'}
              </Text>
              <Text style={hr.medLabel}>{m.label}</Text>
            </View>
          );
        })}
      </View>
      {!todayCI && (
        <Text style={hr.noLogHint}>Log today's check-in to track your medications</Text>
      )}
    </View>
  );
}

// ─── Week Bars ────────────────────────────────────────────────────────────────

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function WeekBars({ recent }) {
  const slots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const ci = recent.find(c => c.date === key) || null;
    return { dow: DOW[d.getDay()], ci, isToday: i === 6 };
  });

  const MAX_H = 36;

  return (
    <View style={wb.wrap}>
      {slots.map((slot, i) => {
        const full = slot.ci?.oralMinoxidil === true && slot.ci?.topicalMinoxidil === true;
        const partial = slot.ci && (!full);
        const color = full ? C.green : partial ? C.orange : '#2C2C2E';
        const barH = full ? MAX_H : partial ? MAX_H * 0.55 : MAX_H * 0.22;
        return (
          <View key={i} style={wb.col}>
            <View style={wb.barTrack}>
              <View style={[wb.bar, { height: barH, backgroundColor: color }]} />
            </View>
            <Text style={[wb.day, slot.isToday && wb.dayActive]}>{slot.dow}</Text>
            {slot.isToday && <View style={wb.todayDot} />}
          </View>
        );
      })}
    </View>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, valueColor, sub, accent }) {
  return (
    <View style={[sc.card, { borderTopColor: accent || '#2C2C2E' }]}>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, { color: valueColor || '#fff' }]}>
        {value}
        {unit ? <Text style={sc.unit}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

const PRIORITY_ICONS = { critical: '🚨', positive: '✅', informational: 'ℹ️' };
const PRIORITY_COLORS = { critical: C.red, positive: C.green, informational: C.accent };

function InsightCard({ insight }) {
  const [open, setOpen] = useState(false);
  const color = PRIORITY_COLORS[insight.priority] || C.accent;
  const icon = PRIORITY_ICONS[insight.priority] || 'ℹ️';
  return (
    <TouchableOpacity
      onPress={() => setOpen(o => !o)}
      style={[ic.card, { borderLeftColor: color }]}
      activeOpacity={0.75}
    >
      <View style={ic.header}>
        <Text style={ic.icon}>{icon}</Text>
        <Text style={[ic.title, { color }]}>{insight.title}</Text>
        <Text style={[ic.chevron, open && ic.chevronOpen]}>›</Text>
      </View>
      {open && <Text style={ic.body}>{insight.body}</Text>}
    </TouchableOpacity>
  );
}

// ─── Evidence Bar ─────────────────────────────────────────────────────────────

const EVIDENCE_LEVELS = {
  'Very Strong — superior to finasteride in RCTs': 5,
  'Strong — multiple RCTs': 4,
  'Strong — FDA approved 30+ years': 4,
  'Moderate — Hairmax RCTs': 3,
};

function EvidenceBar({ evidence }) {
  const level = EVIDENCE_LEVELS[evidence] || 3;
  return (
    <View style={evb.wrap}>
      <Text style={evb.label}>EVIDENCE STRENGTH</Text>
      <View style={evb.row}>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={[evb.seg, { backgroundColor: i <= level ? C.green : '#2C2C2E' }]} />
        ))}
      </View>
      <Text style={evb.sub}>{evidence}</Text>
    </View>
  );
}

// ─── Application Guide ────────────────────────────────────────────────────────

const APPLICATION_GUIDES = {
  oral: {
    color: C.accent,
    title: 'How to take',
    steps: [
      { icon: '🌅', title: 'Morning with food', body: 'Take with breakfast — food reduces blood pressure side effects. Same time daily without fail.' },
      { icon: '⏰', title: 'Missed dose?', body: 'Take as soon as remembered. If next dose is within 6 hours, skip — never double up.' },
      { icon: '📈', title: 'What to expect', body: 'Increased shedding weeks 2–8 is normal and positive. First real regrowth visible at 3–6 months of strict consistency.' },
    ],
    note: 'Works systemically — affects all scalp hair, not just crown. Full effect takes 12+ months.',
  },
  topical: {
    color: C.green,
    title: 'How to apply Novegrow 10%',
    steps: [
      { icon: '💧', title: 'Dropper only, NOT spray', body: 'Dropper delivers precise 1mL to the scalp. Spray disperses product to hair shaft where it does nothing.' },
      { icon: '🦱', title: 'Part hair first', body: 'Part hair to expose scalp directly. Apply drops to the exposed scalp, not the hair. 4–5 drops across the crown patch.' },
      { icon: '👆', title: "Tap, don't rub", body: 'Light fingertip tapping to spread. Rubbing moves product off scalp onto surrounding hair.' },
      { icon: '🌙', title: 'Bedtime = best time', body: 'Must stay on scalp for minimum 4 hours. No washing, no heavy sweating. Sleep locks in absorption.' },
    ],
    note: '⚡ Research tip: Tretinoin 0.025% cream applied 30–60 min before minoxidil increases absorption ~33%.',
  },
  lllt: {
    color: C.red,
    title: 'How to use red light comb',
    steps: [
      { icon: '💆', title: 'Dry hair only', body: 'Water absorbs 650nm light before it reaches follicles. Completely dry hair and scalp before every session.' },
      { icon: '⏱️', title: '4 seconds per section', body: 'Slow, deliberate passes. Hold comb stationary for 4 seconds in each position. Count it out — most people go too fast.' },
      { icon: '🎯', title: 'Crown focus', body: 'Start at the crown patch edge and work inward in a grid pattern. 15 min total on the vertex.' },
      { icon: '📅', title: 'Mon / Wed / Fri', body: 'Three sessions per week. Follicles need 48h recovery between sessions. Daily use reduces effectiveness.' },
    ],
    note: '650nm light increases ATP in follicle mitochondria — literally energises the hair growth machinery.',
  },
  dutalin: {
    color: C.purple,
    title: 'How to take dutasteride',
    steps: [
      { icon: '📅', title: 'Monday + Thursday only', body: 'Twice weekly is evidence-based. Dutasteride half-life is ~5 weeks — it accumulates. Daily dosing is unnecessary.' },
      { icon: '🕐', title: 'Consistent timing', body: 'Same time of day on dose days. With or without food — no interaction. Set a phone alarm for both days.' },
      { icon: '🚫', title: 'Never double up', body: "Missed a dose? Skip it completely. The 5-week half-life means one missed dose is clinically irrelevant." },
      { icon: '🔬', title: 'Bloodwork note', body: "Dutasteride lowers PSA readings. Inform any doctor getting PSA tested — results need adjustment." },
    ],
    note: 'DHT suppression: dutasteride ~90%, finasteride ~70%. Full miniaturization reversal takes 12–18 months.',
  },
};

function ApplicationGuide({ id }) {
  const guide = APPLICATION_GUIDES[id];
  if (!guide) return null;
  return (
    <View style={[apg.wrap, { borderLeftColor: guide.color }]}>
      <Text style={[apg.title, { color: guide.color }]}>{guide.title}</Text>
      {guide.steps.map((step, i) => (
        <View key={i} style={apg.step}>
          <Text style={apg.icon}>{step.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={apg.stepTitle}>{step.title}</Text>
            <Text style={apg.stepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
      <View style={apg.note}>
        <Text style={apg.noteTxt}>{guide.note}</Text>
      </View>
    </View>
  );
}

// ─── Scalp Diagram ────────────────────────────────────────────────────────────

function ScalpDiagram() {
  const W = 220, H = 260;
  return (
    <View style={sdg.wrap}>
      <Text style={sdg.heading}>WHERE TO APPLY</Text>
      <View style={sdg.svgWrap}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <SvgEllipse cx={110} cy={112} rx={80} ry={94} fill="#1A1A1C" stroke="#3A3A3C" strokeWidth={1.5} />
          <SvgEllipse cx={110} cy={104} rx={63} ry={72} fill="rgba(59,130,246,0.07)" />
          <SvgEllipse cx={33} cy={118} rx={9} ry={14} fill="#242426" stroke="#3A3A3C" strokeWidth={1} />
          <SvgEllipse cx={187} cy={118} rx={9} ry={14} fill="#242426" stroke="#3A3A3C" strokeWidth={1} />
          <SvgEllipse cx={110} cy={100} rx={44} ry={50} fill="rgba(57,211,83,0.10)" />
          <SvgEllipse cx={72} cy={72} rx={20} ry={14} fill="rgba(57,211,83,0.13)" />
          <SvgEllipse cx={148} cy={72} rx={20} ry={14} fill="rgba(57,211,83,0.13)" />
          <SvgCircle cx={110} cy={104} r={26} fill="rgba(255,69,58,0.13)" />
          <SvgCircle cx={110} cy={104} r={14} fill="rgba(255,69,58,0.18)" />
          <SvgPath d="M 67 58 Q 110 32 153 58" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
          <SvgText x={110} y={94} textAnchor="middle" fill="rgba(255,69,58,0.9)" fontSize={8} fontWeight="700">LLLT</SvgText>
          <SvgText x={110} y={104} textAnchor="middle" fill="rgba(57,211,83,0.9)" fontSize={7} fontWeight="700">CROWN</SvgText>
          <SvgText x={110} y={113} textAnchor="middle" fill="rgba(57,211,83,0.7)" fontSize={6}>TOPICAL</SvgText>
          <SvgText x={72} y={71} textAnchor="middle" fill="rgba(57,211,83,0.8)" fontSize={6} fontWeight="700">L TEMPLE</SvgText>
          <SvgText x={148} y={71} textAnchor="middle" fill="rgba(57,211,83,0.8)" fontSize={6} fontWeight="700">R TEMPLE</SvgText>
          <SvgText x={110} y={46} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={6}>HAIRLINE</SvgText>
          <SvgText x={110} y={155} textAnchor="middle" fill="rgba(59,130,246,0.5)" fontSize={6.5}>whole scalp (systemic)</SvgText>
          <G transform="translate(12, 218)">
            <SvgCircle cx={7} cy={7} r={6} fill="rgba(255,69,58,0.25)" stroke="#FF453A" strokeWidth={1} />
            <SvgText x={16} y={11} fill="rgba(255,255,255,0.6)" fontSize={9}>LLLT — Crown focus</SvgText>
          </G>
          <G transform="translate(12, 234)">
            <SvgCircle cx={7} cy={7} r={6} fill="rgba(57,211,83,0.25)" stroke="#39d353" strokeWidth={1} />
            <SvgText x={16} y={11} fill="rgba(255,255,255,0.6)" fontSize={9}>Topical — Crown + temples</SvgText>
          </G>
          <G transform="translate(118, 218)">
            <SvgCircle cx={7} cy={7} r={6} fill="rgba(59,130,246,0.25)" stroke="#3B82F6" strokeWidth={1} />
            <SvgText x={16} y={11} fill="rgba(255,255,255,0.6)" fontSize={9}>Oral + Dut — Systemic</SvgText>
          </G>
        </Svg>
      </View>
      <View style={sdg.tips}>
        <View style={sdg.tip}><Text style={sdg.tipIcon}>💧</Text><Text style={sdg.tipTxt}>Part hair, apply dropper to scalp — NOT hair shaft</Text></View>
        <View style={sdg.tip}><Text style={sdg.tipIcon}>🔴</Text><Text style={sdg.tipTxt}>LLLT: 4 sec/section, grid pattern, crown inward</Text></View>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMetrics(recent14, streak) {
  const last7 = recent14.slice(0, 7);
  const prev7 = recent14.slice(7, 14);
  const avg = (arr, key) => arr.length ? arr.reduce((s, c) => s + (c[key] || 0), 0) / arr.length : 0;
  const avgCigs = avg(last7, 'cigarettes').toFixed(1);
  const prevAvgCigs = avg(prev7, 'cigarettes').toFixed(1);
  const cigsDelta = prevAvgCigs > 0 ? Math.round(((avgCigs - prevAvgCigs) / prevAvgCigs) * 100) : 0;
  const avgSleep = avg(last7, 'sleep').toFixed(1);
  const avgStress = avg(last7, 'stress').toFixed(1);
  const consistency = last7.length ? Math.round((last7.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / last7.length) * 100) : 0;
  const sheddingPct = last7.length ? Math.round((last7.filter(c => c.sheddingNoticed && c.sheddingNoticed !== 'none').length / last7.length) * 100) : 0;
  return { avgCigs, prevAvgCigs, cigsDelta, avgSleep, avgStress, consistency, sheddingPct, streak };
}

const PROTOCOL_ICONS = { oral: '💊', topical: '💧', lllt: '🔴', dutalin: '🛡️' };

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Overview() {
  const insets = useSafeAreaInsets();
  const [todayCI, setTodayCI] = useState(null);
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState([]);
  const [openProtocol, setOpenProtocol] = useState(null);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const insightsFetched = useRef('');

  useFocusEffect(
    useCallback(() => {
      const todayKey = getTodayKey();
      Promise.all([
        loadCheckin(todayKey),
        getStreakCount(),
        getRecentCheckins(14),
      ]).then(([ci, str, rec14]) => {
        setTodayCI(ci);
        setStreak(str);
        setRecent(rec14.slice(0, 7));
        loadInsights(rec14, str);
      }).catch(() => {});
    }, [])
  );

  const loadInsights = async (recent14, str) => {
    const todayStr = getTodayKey();
    if (insightsFetched.current === todayStr) return;
    insightsFetched.current = todayStr;
    setInsightsLoading(true);
    setNoApiKey(false);
    try {
      const apiKey = await get('api_key', '');
      if (!apiKey) { setNoApiKey(true); setInsightsLoading(false); return; }
      const metrics = computeMetrics(recent14, str);
      const result = await getCachedOrFreshInsights(metrics);
      if (result) { setInsights(result.insights); setInsightsUpdatedAt(result.cachedAt); }
    } catch { /* silent */ }
    setInsightsLoading(false);
  };

  const consistency7d = recent.length
    ? Math.round((recent.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / recent.length) * 100)
    : null;

  const avgSleep7 = recent.length
    ? (recent.reduce((s, c) => s + (c.sleep || 0), 0) / recent.length).toFixed(1)
    : null;

  const updatedLabel = insightsUpdatedAt ? (() => {
    const d = new Date(insightsUpdatedAt);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Updated today at ${time}` : `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  })() : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={s.title}>Overview</Text>
      </View>

      {/* Hero card */}
      <HeroCard streak={streak} todayCI={todayCI} />

      {/* Stats grid */}
      <Text style={s.sectionLabel}>TODAY</Text>
      <View style={s.statGrid}>
        <StatCard
          label="Cigarettes"
          value={todayCI?.cigarettes ?? '—'}
          valueColor={todayCI?.cigarettes === 0 ? C.green : todayCI?.cigarettes > 0 ? C.red : C.sub}
          accent={todayCI?.cigarettes === 0 ? C.green : todayCI?.cigarettes > 0 ? C.red : '#2C2C2E'}
          sub="target: 0 / day"
        />
        <StatCard
          label="Sleep"
          value={todayCI?.sleep ?? '—'}
          unit={todayCI?.sleep ? 'h' : ''}
          valueColor={todayCI?.sleep >= 7 ? C.green : todayCI?.sleep > 0 ? C.orange : C.sub}
          accent={todayCI?.sleep >= 7 ? C.green : todayCI?.sleep > 0 ? C.orange : '#2C2C2E'}
          sub="target: ≥7h"
        />
        <StatCard
          label="7d Consistency"
          value={consistency7d !== null ? `${consistency7d}%` : '—'}
          valueColor={consistency7d >= 80 ? C.green : consistency7d >= 50 ? C.orange : C.red}
          accent={consistency7d >= 80 ? C.green : consistency7d >= 50 ? C.orange : C.red}
          sub="oral + topical"
        />
        <StatCard
          label="Days to Sep '26"
          value={daysToCheckpoint()}
          valueColor={C.accent}
          accent={C.accent}
          sub="checkpoint"
        />
      </View>

      {/* Week chart */}
      {recent.length > 0 && (
        <>
          <Text style={s.sectionLabel}>LAST 7 DAYS</Text>
          <View style={s.card}>
            <WeekBars recent={recent} />
            <View style={s.chartLegend}>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.green }]} /><Text style={s.legendTxt}>Full</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.orange }]} /><Text style={s.legendTxt}>Partial</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#2C2C2E' }]} /><Text style={s.legendTxt}>Missed</Text></View>
              {avgSleep7 && <Text style={s.avgSleepTxt}>avg sleep {avgSleep7}h</Text>}
            </View>
          </View>
        </>
      )}

      {/* AI Insights */}
      <Text style={s.sectionLabel}>AI INSIGHTS</Text>
      {insightsLoading ? (
        <View style={s.loadingCard}>
          <ActivityIndicator color={C.accent} />
          <Text style={s.loadingTxt}>Analysing your data…</Text>
        </View>
      ) : noApiKey ? (
        <View style={s.placeholderCard}>
          <Text style={s.placeholderTxt}>Set your Claude API key in the Ask Claude tab to enable AI insights.</Text>
        </View>
      ) : insights.length === 0 ? (
        <View style={s.placeholderCard}>
          <Text style={s.placeholderTxt}>Log check-ins to generate personalized insights.</Text>
        </View>
      ) : (
        <View style={s.insightsList}>
          {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          {updatedLabel && <Text style={s.updatedLabel}>{updatedLabel}</Text>}
        </View>
      )}

      {/* Protocol guide */}
      <Text style={s.sectionLabel}>PROTOCOL GUIDE</Text>
      <ScalpDiagram />
      {PROTOCOL_DETAILS.map((item, idx) => {
        const isOpen = openProtocol === item.id;
        return (
          <View key={item.id} style={[s.accordion, idx > 0 && { marginTop: 8 }]}>
            <TouchableOpacity
              onPress={() => setOpenProtocol(isOpen ? null : item.id)}
              style={s.accordionHead}
              activeOpacity={0.7}
            >
              <View style={s.accordionLeft}>
                <View style={s.protoIconBubble}>
                  <Text style={{ fontSize: 20 }}>{PROTOCOL_ICONS[item.id] || '●'}</Text>
                </View>
                <View>
                  <Text style={s.protoName}>{item.name}</Text>
                  <Text style={s.protoDose}>{item.dose}</Text>
                </View>
              </View>
              <View style={s.accordionRight}>
                <View style={s.activeBadge}><Text style={s.activeBadgeTxt}>ACTIVE</Text></View>
                <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
              </View>
            </TouchableOpacity>
            {isOpen && (
              <View style={s.accordionBody}>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>Timing</Text>
                  <Text style={s.detailVal}>{item.timing}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>Notes</Text>
                  <Text style={s.detailVal}>{item.notes}</Text>
                </View>
                <EvidenceBar evidence={item.evidence} />
                <ApplicationGuide id={item.id} />
              </View>
            )}
          </View>
        );
      })}

      <View style={s.bloodwork}>
        <Text style={s.bloodworkTitle}>BLOODWORK NEEDED</Text>
        <Text style={s.bloodworkTxt}>
          Order: DHT, Testosterone (free+total), Ferritin (target &gt;70), TSH, Vitamin D3 (target &gt;50), Zinc. Ask GP for a "comprehensive hair loss panel."
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 20 },
  date: { fontSize: 13, fontWeight: '500', color: C.sub },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 42, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginTop: 28, marginBottom: 12 },

  card: { backgroundColor: '#1C1C1E', borderRadius: 16, overflow: 'hidden' },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Week chart
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, color: C.sub, fontWeight: '500' },
  avgSleepTxt: { marginLeft: 'auto', fontSize: 11, color: C.sub, fontWeight: '600' },

  // Insights
  insightsList: { gap: 8 },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16 },
  loadingTxt: { fontSize: 14, color: C.sub },
  placeholderCard: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16 },
  placeholderTxt: { fontSize: 14, color: C.sub, lineHeight: 20 },
  updatedLabel: { fontSize: 11, color: '#3A3A3C', marginTop: 4 },

  // Protocol accordion
  accordion: { backgroundColor: '#1C1C1E', borderRadius: 16, overflow: 'hidden' },
  accordionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  protoIconBubble: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  protoName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  protoDose: { fontSize: 12, color: C.sub, marginTop: 2 },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: { backgroundColor: '#1A2A1F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  activeBadgeTxt: { fontSize: 9, fontWeight: '700', color: C.green, letterSpacing: 0.5 },
  chevron: { fontSize: 22, color: C.sub, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E', gap: 10 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailKey: { fontSize: 12, color: C.sub, width: 60, flexShrink: 0 },
  detailVal: { fontSize: 14, color: '#fff', flex: 1, lineHeight: 20 },

  bloodwork: { marginTop: 8, marginBottom: 8, backgroundColor: '#1C1E2A', borderRadius: 16, padding: 16 },
  bloodworkTitle: { fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.8, marginBottom: 6 },
  bloodworkTxt: { fontSize: 12, color: C.sub, lineHeight: 18 },
});

// Hero card
const hr = StyleSheet.create({
  card: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 20 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  streakHeading: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginBottom: 6 },
  streakNum: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1, lineHeight: 46 },
  streakUnit: { fontSize: 18, fontWeight: '600', color: C.sub },
  progressBar: { height: 4, backgroundColor: '#2C2C2E', borderRadius: 2, marginTop: 10, marginBottom: 5, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: C.sub, fontWeight: '500' },
  ringWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  ringNum: { fontSize: 26, fontWeight: '900', color: '#fff', lineHeight: 30 },
  ringLabel: { fontSize: 8, fontWeight: '700', color: C.sub, letterSpacing: 1.2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E', marginBottom: 16 },
  medsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  medItem: { alignItems: 'center', gap: 5 },
  medIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  medIconGreen: { backgroundColor: 'rgba(48,209,88,0.18)' },
  medIconRed: { backgroundColor: 'rgba(255,69,58,0.18)' },
  medStatus: { fontSize: 14, fontWeight: '800', color: C.sub },
  medLabel: { fontSize: 10, fontWeight: '600', color: C.sub },
  noLogHint: { fontSize: 11, color: C.sub, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});

// Stat cards
const sc = StyleSheet.create({
  card: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, width: '48%', minHeight: 96, borderTopWidth: 2 },
  label: { fontSize: 10, fontWeight: '700', color: C.sub, letterSpacing: 0.5, marginBottom: 6 },
  value: { fontSize: 30, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  unit: { fontSize: 14, fontWeight: '600', color: C.sub },
  sub: { fontSize: 11, color: C.sub, marginTop: 4 },
});

// Week bars
const wb = StyleSheet.create({
  wrap: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 6 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 36, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 8 },
  day: { fontSize: 10, fontWeight: '600', color: C.sub },
  dayActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent },
});

// Insight card
const ic = StyleSheet.create({
  card: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16, borderLeftWidth: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  title: { fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  chevron: { fontSize: 20, color: C.sub, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  body: { fontSize: 13, color: C.sub, lineHeight: 19, marginTop: 10 },
});

// Evidence bar
const evb = StyleSheet.create({
  wrap: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 12, marginTop: 10 },
  label: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.1, marginBottom: 7 },
  row: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
});

// Application guide
const apg = StyleSheet.create({
  wrap: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, marginTop: 10, borderLeftWidth: 3 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1, marginBottom: 12 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  icon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  stepTitle: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 2 },
  stepBody: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
  note: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginTop: 4 },
  noteTxt: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16, fontStyle: 'italic' },
});

// Scalp diagram
const sdg = StyleSheet.create({
  wrap: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, marginBottom: 12 },
  heading: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.1, marginBottom: 10 },
  svgWrap: { alignItems: 'center', marginBottom: 12 },
  tips: { gap: 8 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  tipIcon: { fontSize: 15, width: 22, textAlign: 'center' },
  tipTxt: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
});
