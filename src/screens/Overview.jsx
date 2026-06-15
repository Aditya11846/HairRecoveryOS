import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTodayKey, getStreakCount, getRecentCheckins, loadCheckin, daysToCheckpoint, get, set } from '../utils/storage';
import { getCachedOrFreshInsights } from '../services/ai';
import { PROTOCOL_DETAILS } from '../constants/protocol';
import SectionLabel from '../components/common/SectionLabel';
import { C } from '../theme';
import Svg, { Rect as SvgRect, Path as SvgPath } from 'react-native-svg';

const PRIORITY_COLORS = { critical: C.red, positive: C.green, informational: C.accent };
const PROTOCOL_ICONS = { oral: '💊', topical: '💧', lllt: '🔴', dutalin: '🛡️' };

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
          <View
            key={i}
            style={[evb.seg, { backgroundColor: i <= level ? '#39d353' : 'rgba(255,255,255,0.07)' }]}
          />
        ))}
      </View>
      <Text style={evb.sub}>{evidence}</Text>
    </View>
  );
}
const evb = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(44,44,46,0.7)', borderRadius: 12, padding: 12, marginTop: 10 },
  label: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.1, marginBottom: 7 },
  row: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
});

const APPLICATION_GUIDES = {
  oral: {
    color: '#3B82F6',
    title: 'How to take',
    steps: [
      { icon: '🌅', title: 'Morning with food', body: 'Take with breakfast — food reduces blood pressure side effects. Same time daily without fail.' },
      { icon: '⏰', title: 'Missed dose?', body: 'Take as soon as remembered. If next dose is within 6 hours, skip — never double up.' },
      { icon: '📈', title: 'What to expect', body: 'Increased shedding weeks 2–8 is normal and positive. First real regrowth visible at 3–6 months of strict consistency.' },
    ],
    note: 'Works systemically — affects all scalp hair, not just crown. Full effect takes 12+ months.',
  },
  topical: {
    color: '#30D158',
    title: 'How to apply Novegrow 10% solution',
    steps: [
      { icon: '💧', title: 'Dropper only, NOT spray', body: 'Dropper delivers precise 1mL to the scalp. Spray disperses product to hair shaft where it does nothing. Use dropper.' },
      { icon: '🦱', title: 'Part hair first', body: 'Part hair to expose scalp directly. Apply drops to the exposed scalp, not the hair. 4–5 drops across the crown patch.' },
      { icon: '👆', title: "Tap, don't rub", body: 'Light fingertip tapping to spread. Rubbing moves product off scalp onto surrounding hair. Tap gently and let absorb.' },
      { icon: '🌙', title: 'Bedtime = best time', body: 'Must stay on scalp for minimum 4 hours. No washing, no heavy sweating, no helmet. Sleep locks in absorption.' },
    ],
    note: '⚡ Research tip: Tretinoin 0.025% cream applied 30–60 min before minoxidil increases absorption ~33%. Ask Dr. Soni about adding this.',
  },
  lllt: {
    color: '#FF453A',
    title: 'How to use red light comb',
    steps: [
      { icon: '💆', title: 'Dry hair only', body: 'Water absorbs 650nm light before it reaches follicles. Completely dry hair and scalp before every session.' },
      { icon: '⏱️', title: '4 seconds per section', body: 'Slow, deliberate passes. Hold comb stationary for 4 seconds in each position. Count it out — most people go too fast.' },
      { icon: '🎯', title: 'Crown focus', body: 'Start at the crown patch edge and work inward in a grid pattern. 15 min total on the vertex — not spread across whole head.' },
      { icon: '📅', title: 'Mon / Wed / Fri', body: 'Three sessions per week. Follicles need 48h recovery between photobiomodulation sessions. Daily use reduces effectiveness.' },
    ],
    note: '650nm light increases ATP in follicle mitochondria — literally energises the hair growth machinery. Consistent rhythm matters more than duration.',
  },
  dutalin: {
    color: '#A855F7',
    title: 'How to take dutasteride',
    steps: [
      { icon: '📅', title: 'Monday + Thursday only', body: 'Twice weekly is evidence-based. Dutasteride half-life is ~5 weeks — it accumulates. Daily dosing is unnecessary.' },
      { icon: '🕐', title: 'Consistent timing', body: 'Same time of day on dose days. With or without food — no interaction. Set a phone alarm for both days.' },
      { icon: '🚫', title: 'Never double up', body: "Missed a dose? Skip it completely. The 5-week half-life means one missed dose is clinically irrelevant — just continue normal schedule." },
      { icon: '🔬', title: 'Bloodwork note', body: "Dutasteride lowers PSA readings. If ever getting PSA tested, inform the doctor you're on dutasteride — results need adjustment." },
    ],
    note: 'DHT suppression: dutasteride ~90%, finasteride ~70%. Full miniaturization reversal takes 12–18 months. Do not switch or stop early.',
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
          <View style={apg.textBlock}>
            <Text style={apg.stepTitle}>{step.title}</Text>
            <Text style={apg.stepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
      <View style={apg.noteBox}>
        <Text style={apg.noteText}>{guide.note}</Text>
      </View>
    </View>
  );
}
const apg = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderRadius: 12, padding: 14, marginTop: 10, borderLeftWidth: 3,
  },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1, marginBottom: 12 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  icon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  textBlock: { flex: 1 },
  stepTitle: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 2 },
  stepBody: { fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 17 },
  noteBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginTop: 4 },
  noteText: { fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 16, fontStyle: 'italic' },
});

function StatCard({ label, value, unit, valueColor = C.text, sub }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.statValue, { color: valueColor }]}>
        {value}{unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function InsightCard({ insight }) {
  const color = PRIORITY_COLORS[insight.priority] || C.accent;
  return (
    <View style={[s.insightCard, { borderLeftColor: color, shadowColor: color }]}>
      <View style={s.insightHeader}>
        <View style={[s.insightDot, { backgroundColor: color }]} />
        <Text style={s.insightTitle}>{insight.title}</Text>
      </View>
      <Text style={s.insightBody}>{insight.body}</Text>
    </View>
  );
}

function computeMetrics(recent14, recent7, streak) {
  const last7 = recent14.slice(0, 7);
  const prev7 = recent14.slice(7, 14);

  const avg = (arr, key) => arr.length
    ? arr.reduce((s, c) => s + (c[key] || 0), 0) / arr.length
    : 0;

  const avgCigs = avg(last7, 'cigarettes').toFixed(1);
  const prevAvgCigs = avg(prev7, 'cigarettes').toFixed(1);
  const cigsDelta = prevAvgCigs > 0
    ? Math.round(((avgCigs - prevAvgCigs) / prevAvgCigs) * 100)
    : 0;

  const avgSleep = avg(last7, 'sleep').toFixed(1);
  const avgStress = avg(last7, 'stress').toFixed(1);

  const consistency = last7.length
    ? Math.round((last7.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / last7.length) * 100)
    : 0;

  const sheddingPct = last7.length
    ? Math.round((last7.filter(c => c.sheddingNoticed).length / last7.length) * 100)
    : 0;

  return { avgCigs, prevAvgCigs, cigsDelta, avgSleep, avgStress, consistency, sheddingPct, streak };
}

export default function Overview() {
  const insets = useSafeAreaInsets();
  const [todayCI, setTodayCI] = useState(null);
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState([]);
  const [openProtocol, setOpenProtocol] = useState(null);
  const [protocolDone, setProtocolDone] = useState({});
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const insightsFetched = useRef('');

  useEffect(() => {
    const todayKey = getTodayKey();
    Promise.all([
      loadCheckin(todayKey),
      getStreakCount(),
      getRecentCheckins(14),
      get(`protocol_today_${todayKey}`, {}),
    ]).then(([ci, str, rec14, pd]) => {
      setTodayCI(ci);
      setStreak(str);
      setRecent(rec14.slice(0, 7));
      setProtocolDone(pd);
      loadInsights(rec14, str);
    }).catch(() => {});
  }, []);

  const loadInsights = async (recent14, str) => {
    const todayStr = getTodayKey();
    if (insightsFetched.current === todayStr) return;
    insightsFetched.current = todayStr;

    setInsightsLoading(true);
    setNoApiKey(false);
    try {
      const apiKey = await get('api_key', '');
      if (!apiKey) { setNoApiKey(true); setInsightsLoading(false); return; }

      const metrics = computeMetrics(recent14, [], str);
      const result = await getCachedOrFreshInsights(metrics);
      if (result) {
        setInsights(result.insights);
        setInsightsUpdatedAt(result.cachedAt);
      }
    } catch { /* silent */ }
    setInsightsLoading(false);
  };

  const toggleProtocol = async (id) => {
    const todayKey = getTodayKey();
    const next = { ...protocolDone, [id]: !protocolDone[id] };
    setProtocolDone(next);
    await set(`protocol_today_${todayKey}`, next);
  };

  const avgCigs7 = recent.length
    ? (recent.reduce((s, c) => s + (c.cigarettes || 0), 0) / recent.length).toFixed(1)
    : '—';
  const consistency7d = recent.length
    ? Math.round((recent.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / recent.length) * 100)
    : null;

  const updatedLabel = insightsUpdatedAt ? (() => {
    const d = new Date(insightsUpdatedAt);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return isToday
      ? `Updated today at ${time}`
      : `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
  })() : null;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.dateLabel}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={s.title}>Overview</Text>
      </View>

      {/* Stat grid */}
      <View style={s.section}>
        <SectionLabel label="Status" />
        <View style={s.statGrid}>
          <StatCard label="Streak" value={streak} unit="days"
            valueColor={streak >= 7 ? C.green : streak >= 3 ? C.accent : C.text}
            sub={streak === 0 ? 'Start today' : `${Math.max(0, 30 - streak)} to 30-day goal`} />
          <StatCard label="Cigs Today" value={todayCI?.cigarettes ?? '—'}
            valueColor={todayCI?.cigarettes === 0 ? C.green : todayCI?.cigarettes > 0 ? C.red : C.sub}
            sub="target: 0" />
          <StatCard label="Sleep" value={todayCI?.sleep ?? '—'} unit={todayCI?.sleep ? 'h' : ''}
            valueColor={todayCI?.sleep >= 7 ? C.green : todayCI?.sleep > 0 ? C.orange : C.sub}
            sub="target: ≥7h" />
          <StatCard label="Days to Sep '26" value={daysToCheckpoint()} valueColor={C.accent}
            sub="recovery checkpoint" />
        </View>
      </View>

      {/* 7-day averages */}
      {recent.length > 0 && (
        <View style={s.section}>
          <View style={[s.card, s.avgRow]}>
            <View style={s.avgItem}>
              <Text style={[s.avgValue, { color: avgCigs7 === '0.0' ? C.green : Number(avgCigs7) > 3 ? C.red : C.orange }]}>{avgCigs7}</Text>
              <Text style={s.avgLabel}>cigs/day</Text>
            </View>
            <View style={s.avgDivider} />
            <View style={s.avgItem}>
              <Text style={[s.avgValue, { color: consistency7d >= 80 ? C.green : consistency7d >= 50 ? C.orange : C.red }]}>
                {consistency7d !== null ? `${consistency7d}%` : '—'}
              </Text>
              <Text style={s.avgLabel}>consistency</Text>
            </View>
            <View style={s.avgDivider} />
            <View style={s.avgItem}>
              <Text style={[s.avgValue, { color: C.accent }]}>{streak}</Text>
              <Text style={s.avgLabel}>day streak</Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Insights */}
      <View style={s.section}>
        <SectionLabel label="AI Insights" />
        {insightsLoading ? (
          <View style={s.insightsLoading}>
            <ActivityIndicator color={C.accent} />
            <Text style={s.insightsLoadingText}>Analysing your data…</Text>
          </View>
        ) : noApiKey ? (
          <View style={s.insightPlaceholder}>
            <Text style={s.insightPlaceholderText}>Set your Claude API key in the Ask Claude tab to enable AI insights.</Text>
          </View>
        ) : insights.length === 0 ? (
          <View style={s.insightPlaceholder}>
            <Text style={s.insightPlaceholderText}>Log check-ins to generate personalized insights.</Text>
          </View>
        ) : (
          <>
            {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            {updatedLabel && <Text style={s.updatedLabel}>{updatedLabel}</Text>}
          </>
        )}
      </View>

      {/* Protocol guide */}
      <View style={s.section}>
        <SectionLabel label="Protocol Guide" />
        <View style={s.cardList}>
          {PROTOCOL_DETAILS.map((item, idx) => {
            const isOpen = openProtocol === item.id;
            return (
              <View key={item.id} style={[s.accordionCard, idx > 0 && s.cardMarginTop]}>
                <TouchableOpacity
                  onPress={() => setOpenProtocol(isOpen ? null : item.id)}
                  style={s.accordionHeader}
                  activeOpacity={0.7}
                >
                  <View style={s.accordionLeft}>
                    <View style={s.protoIconBubble}>
                      <Text style={s.protoIconText}>{PROTOCOL_ICONS[item.id] || '●'}</Text>
                    </View>
                    <View>
                      <Text style={s.accordionTitle}>{item.name}</Text>
                      <Text style={s.accordionDose}>{item.dose}</Text>
                    </View>
                  </View>
                  <View style={s.accordionRight}>
                    <View style={s.activeBadge}><Text style={s.activeBadgeText}>ACTIVE</Text></View>
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
        </View>

        <View style={s.bloodworkCard}>
          <Text style={s.bloodworkTitle}>BLOODWORK NEEDED</Text>
          <Text style={s.bloodworkText}>
            Order: DHT, Testosterone (free+total), Ferritin (target &gt;70), TSH, Vitamin D3 (target &gt;50), Zinc. Ask GP for a "comprehensive hair loss panel."
          </Text>
        </View>
      </View>

      <View style={s.poweredBy}>
        <Text style={s.poweredByText}>Powered by React Native · HairOS v1.0</Text>
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
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 16,
    padding: 14,
    width: '47.5%',
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 6 },
  statValue: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', lineHeight: 36 },
  statUnit: { fontSize: 16, fontWeight: '600', color: '#8E8E93' },
  statSub: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  avgRow: { flexDirection: 'row', alignItems: 'center' },
  avgItem: { flex: 1, alignItems: 'center' },
  avgValue: { fontSize: 22, fontWeight: '700' },
  avgLabel: { fontSize: 10, fontWeight: '500', color: '#8E8E93', marginTop: 2 },
  avgDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: '#2C2C2E' },
  insightsLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(28, 28, 30, 0.9)', borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  insightsLoadingText: { fontSize: 14, color: '#8E8E93' },
  insightPlaceholder: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)', borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  insightPlaceholderText: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  insightCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)', borderRadius: 16, padding: 16,
    borderLeftWidth: 3, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  insightDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  insightBody: { fontSize: 13, color: '#8E8E93', lineHeight: 19 },
  updatedLabel: { fontSize: 11, color: '#3A3A3C', marginTop: 4, paddingHorizontal: 4 },
  cardList: {},
  accordionCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)', borderRadius: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardMarginTop: { marginTop: 8 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  accordionTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  accordionDose: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: { backgroundColor: '#1A2A1F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: '#30D158', letterSpacing: 0.5 },
  chevron: { fontSize: 20, color: '#8E8E93', transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E', gap: 10, paddingTop: 12 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailKey: { fontSize: 12, color: '#8E8E93', width: 64, flexShrink: 0 },
  detailVal: { fontSize: 14, color: '#FFFFFF', flex: 1, lineHeight: 20 },
  bloodworkCard: { marginTop: 8, backgroundColor: '#1C1E2A', borderRadius: 16, padding: 16 },
  bloodworkTitle: { fontSize: 10, fontWeight: '700', color: '#3B82F6', letterSpacing: 0.8, marginBottom: 6 },
  bloodworkText: { fontSize: 12, color: '#8E8E93', lineHeight: 18 },
  protocolIconBubble: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  protocolIconText: { fontSize: 18 },
  protoIconBubble: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 4,
  },
  protoIconText: { fontSize: 20 },
  evidenceContainer: { marginTop: 8 },
  evidenceLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 5 },
  evidenceBarRow: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  evidenceSegment: { flex: 1, height: 4, borderRadius: 2 },
  evidenceText: { fontSize: 11, color: '#8E8E93', fontStyle: 'italic' },
  poweredBy: { alignItems: 'center', marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1C1C1E' },
  poweredByText: { fontSize: 11, color: '#3A3A3C', letterSpacing: 0.3 },
});
