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

const PRIORITY_COLORS = { critical: C.red, positive: C.green, informational: C.accent };
const PROTOCOL_ICONS = { oral: '💊', topical: '💧', lllt: '🔴', dutalin: '🛡' };

const EVIDENCE_LEVELS = {
  'Very Strong — superior to finasteride in RCTs': 5,
  'Strong — multiple RCTs': 4,
  'Strong — FDA approved 30+ years': 4,
  'Moderate — Hairmax RCTs': 3,
};

function EvidenceBar({ evidence }) {
  const level = EVIDENCE_LEVELS[evidence] || 3;
  const colors = ['#1a4d3a', '#26a641', '#39d353', '#39d353', '#56e878'];
  return (
    <View style={eb.container}>
      <Text style={eb.label}>EVIDENCE STRENGTH</Text>
      <View style={eb.barRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={[eb.segment, { backgroundColor: i <= level ? colors[i - 1] : 'rgba(255,255,255,0.06)' }]} />
        ))}
      </View>
      <Text style={eb.evidenceText}>{evidence}</Text>
    </View>
  );
}
const eb = StyleSheet.create({
  container: { backgroundColor: 'rgba(44,44,46,0.6)', borderRadius: 12, padding: 12, marginTop: 4 },
  label: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.1, marginBottom: 8 },
  barRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  evidenceText: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },
});

function ProtocolMechanism({ id }) {
  const configs = {
    oral: { title: 'Mechanism: Systemic vasodilation', steps: ['Absorbed orally', 'Opens K⁺ ATP channels', 'Dilates scalp blood vessels', '↑ Nutrient delivery to follicles'], color: '#3B82F6' },
    topical: { title: 'Mechanism: Direct follicle stimulation', steps: ['Applied to crown', 'Penetrates to dermis', 'Activates hair follicle stem cells', 'Extends anagen (growth) phase'], color: '#30D158' },
    lllt: { title: 'Mechanism: Photobiomodulation', steps: ['650nm red light absorbed', '↑ ATP in follicle mitochondria', 'Reduces inflammation', 'Shifts follicles into anagen'], color: '#FF453A' },
    dutalin: { title: 'Mechanism: DHT suppression', steps: ['Blocks 5α-reductase I + II', '↓ DHT by ~90%', 'Follicles stop miniaturizing', 'Terminal hair regrowth resumes'], color: '#A855F7' },
  };
  const cfg = configs[id];
  if (!cfg) return null;
  return (
    <View style={[pm.container, { borderLeftColor: cfg.color }]}>
      <Text style={[pm.title, { color: cfg.color }]}>{cfg.title}</Text>
      <View style={pm.stepsRow}>
        {cfg.steps.map((step, i) => (
          <React.Fragment key={i}>
            <View style={pm.stepBubble}>
              <Text style={pm.stepNum}>{i + 1}</Text>
              <Text style={pm.stepText}>{step}</Text>
            </View>
            {i < cfg.steps.length - 1 && <Text style={[pm.arrow, { color: cfg.color }]}>→</Text>}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
const pm = StyleSheet.create({
  container: { backgroundColor: 'rgba(28,28,30,0.8)', borderRadius: 12, padding: 12, marginTop: 4, borderLeftWidth: 3 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 10 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  stepBubble: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 7, alignItems: 'center', minWidth: 64, maxWidth: 80 },
  stepNum: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', marginBottom: 3 },
  stepText: { fontSize: 9, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 12 },
  arrow: { fontSize: 14, fontWeight: '700', opacity: 0.5 },
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
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
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
                    <View style={s.protocolIconBubble}>
                      <Text style={s.protocolIconText}>{PROTOCOL_ICONS[item.id] || '●'}</Text>
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
                    {[['Timing', item.timing], ['Notes', item.notes]].map(([k, v]) => (
                      <View key={k} style={s.detailRow}>
                        <Text style={s.detailKey}>{k}</Text>
                        <Text style={s.detailVal}>{v}</Text>
                      </View>
                    ))}
                    <EvidenceBar evidence={item.evidence} />
                    <ProtocolMechanism id={item.id} />
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
  protocolIconBubble: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  protocolIconText: { fontSize: 20 },
  poweredBy: { alignItems: 'center', marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1C1C1E' },
  poweredByText: { fontSize: 11, color: '#3A3A3C', letterSpacing: 0.3 },
});
