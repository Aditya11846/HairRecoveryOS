import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Pressable, Linking, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedOrFreshExplore } from '../services/explore';
import { addCustomProtocol, isProtocolAdded } from '../utils/storage';
import { C } from '../theme';

const SOURCE_COLORS = {
  PubMed: '#3B82F6',
  Reddit: '#F97316',
  ClinicalTrial: '#A855F7',
  YouTube: '#EF4444',
  DermNet: '#10B981',
};

const SOURCE_ICONS = {
  PubMed: '🔬',
  Reddit: '💬',
  ClinicalTrial: '🏥',
  YouTube: '▶',
  DermNet: '🩺',
};

const RELEVANCE_COLORS = {
  HIGH: C.green,
  MEDIUM: C.orange,
  LOW: C.sub,
};

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'PubMed', label: 'Studies' },
  { id: 'ClinicalTrial', label: 'Trials' },
  { id: 'Reddit', label: 'Reddit' },
  { id: 'YouTube', label: 'Video' },
];

const PINNED_QA = [
  {
    id: 'shedding',
    question: 'Is hair shedding in the shower a reliable loss indicator?',
    answer: 'Not reliably. Up to 100 hairs/day is normal. Minoxidil causes intentional telogen effluvium in months 1–3 — increased shedding often means the drug is working, pushing weak hairs out to make room for stronger terminal hairs. Track trends over weeks, not individual shower counts.',
    icon: '🚿',
    color: C.accent,
  },
  {
    id: 'isotretinoin',
    question: 'Should isotretinoin be applied before minoxidil for better absorption?',
    answer: "Not recommended without Dr. Soni's guidance. Isotretinoin (Tretiva) affects sebaceous glands systemically when taken orally — it's not applied topically. If referring to tretinoin (retinoic acid) as a topical pre-treatment: some evidence suggests tretinoin 0.025% increases minoxidil scalp absorption by ~40%, but it can cause irritation and must be dosed carefully. Ask Dr. Soni specifically about tretinoin + minoxidil combination.",
    icon: '💊',
    color: '#A855F7',
  },
  {
    id: 'smoking',
    question: 'How much is smoking actually hurting results?',
    answer: "Significantly. Nicotine is a vasoconstrictor — it directly counters minoxidil's vasodilatory mechanism. Studies show smokers have 2–3× worse response to minoxidil than non-smokers. At 5–6 cigarettes/day, you're partially blocking your most important drug. This is the highest-leverage lifestyle change available — more impactful than any protocol addition.",
    icon: '🚬',
    color: C.red,
  },
];

function PinnedQACard({ item }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      style={[s.pinnedCard, { borderLeftColor: item.color }]}
    >
      <View style={s.pinnedHeader}>
        <Text style={s.pinnedIcon}>{item.icon}</Text>
        <Text style={s.pinnedQuestion}>{item.question}</Text>
        <Text style={s.expandChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={s.pinnedAnswer}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  );
}

function FilterTabs({ active, onChange, counts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
      {FILTER_TABS.map(tab => {
        const isActive = active === tab.id;
        const count = tab.id === 'ALL' ? null : counts[tab.id] || 0;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[s.filterTab, isActive && s.filterTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.filterTabText, isActive && s.filterTabTextActive]}>
              {tab.label}{count !== null ? ` ${count}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function ExploreCard({ item, onAddToProtocol }) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const sourceColor = SOURCE_COLORS[item.source] || C.accent;
  const relevanceColor = RELEVANCE_COLORS[item.relevance] || C.sub;
  const icon = SOURCE_ICONS[item.source] || '📄';

  useEffect(() => {
    if (item.canAddToProtocol) isProtocolAdded(item.title).then(setAdded);
  }, [item.title, item.canAddToProtocol]);

  const handleAdd = () => {
    setAdding(true);
    onAddToProtocol(item, () => { setAdded(true); setAdding(false); }, () => setAdding(false));
  };

  return (
    <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85} style={s.card}>
      <View style={s.cardHeaderRow}>
        <View style={[s.sourceIconBubble, { backgroundColor: sourceColor + '22' }]}>
          <Text style={s.sourceIconText}>{icon}</Text>
        </View>
        <View style={s.cardHeaderMeta}>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: sourceColor + '22' }]}>
              <Text style={[s.badgeText, { color: sourceColor }]}>{item.source}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: relevanceColor + '22' }]}>
              <Text style={[s.badgeText, { color: relevanceColor }]}>{item.relevance}</Text>
            </View>
            {item.readTime ? (
              <View style={[s.badge, { backgroundColor: C.card2 }]}>
                <Text style={[s.badgeText, { color: C.sub }]}>{item.readTime}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.cardTitle} numberOfLines={expanded ? 0 : 2}>{item.title}</Text>
        </View>
        <Text style={s.cardChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      <Text style={s.cardSummary} numberOfLines={expanded ? 0 : 3}>{item.summary}</Text>

      {expanded && (
        <View style={s.cardExpanded}>
          <View style={s.relevanceReasonBox}>
            <Text style={s.relevanceReasonLabel}>WHY THIS MATTERS FOR YOU</Text>
            <Text style={s.relevanceReason}>{item.relevance_reason}</Text>
          </View>

          <View style={[s.actionChip, {
            backgroundColor: item.action === 'ask_doctor' ? C.red + '22' :
                             item.action === 'add_to_protocol' ? C.green + '22' :
                             item.action === 'monitor' ? C.orange + '22' : C.card2,
          }]}>
            <Text style={[s.actionText, {
              color: item.action === 'ask_doctor' ? C.red :
                     item.action === 'add_to_protocol' ? C.green :
                     item.action === 'monitor' ? C.orange : C.sub,
            }]}>
              {item.action === 'ask_doctor' ? '🩺 Ask Dr. Soni' :
               item.action === 'add_to_protocol' ? '✚ Add to Protocol' :
               item.action === 'monitor' ? '👁 Monitor' : 'ℹ Info only'}
            </Text>
          </View>

          {item.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.url)} style={s.readMoreBtn} activeOpacity={0.7}>
              <Text style={s.readMoreText}>Read full study →</Text>
            </TouchableOpacity>
          ) : null}

          {item.canAddToProtocol && (
            <TouchableOpacity
              onPress={handleAdd}
              disabled={added || adding}
              style={[s.addBtn, (added || adding) && s.addBtnDone]}
              activeOpacity={0.7}
            >
              {adding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.addBtnText}>{added ? 'Added to check-in ✓' : '+ Add to check-in'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function AddSheet({ item, visible, onConfirm, onCancel }) {
  if (!item) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Add to daily check-in?</Text>
          <Text style={s.sheetItem}>{item.title}</Text>
          <Text style={s.sheetNote}>Always consult Dr. Soni before starting anything new.</Text>
          <TouchableOpacity onPress={onConfirm} style={s.confirmBtn} activeOpacity={0.8}>
            <Text style={s.confirmBtnText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={s.cancelBtn} activeOpacity={0.8}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Explore() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sources, setSources] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [noApiKey, setNoApiKey] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetCb, setSheetCb] = useState(null);
  const [sheetCancelCb, setSheetCancelCb] = useState(null);
  const loaded = useRef(false);

  const load = useCallback(async (force = false) => {
    if (!force) setLoading(true);
    setError('');
    setNoApiKey(false);
    const result = await getCachedOrFreshExplore(force);
    if (!result || result.noApiKey) {
      setNoApiKey(true);
    } else if (result.apiError) {
      setError(result.errorDetail || 'Failed to fetch. Try again.');
    } else {
      setItems(result.items || []);
      setSources(result.sources || null);
      setFetchedAt(result.fetchedAt);
      setFromCache(result.fromCache);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleAdd = (item, onDone, onFail) => {
    setSheetItem(item);
    setSheetCb(() => onDone);
    setSheetCancelCb(() => onFail);
  };

  const confirmAdd = async () => {
    if (!sheetItem) return;
    const result = await addCustomProtocol(sheetItem.title, sheetItem.source);
    setSheetItem(null);
    if (result && sheetCb) sheetCb();
    else if (!result && sheetCancelCb) sheetCancelCb();
  };

  const cancelAdd = () => {
    setSheetItem(null);
    if (sheetCancelCb) sheetCancelCb();
  };

  const filteredItems = activeFilter === 'ALL'
    ? items
    : items.filter(item => item.source === activeFilter);

  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {});

  const cacheAge = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60))
    : null;

  const cacheLabel = cacheAge !== null
    ? cacheAge < 1 ? 'Updated just now'
    : cacheAge === 1 ? 'Updated 1 hour ago'
    : cacheAge < 24 ? `Updated ${cacheAge}h ago`
    : `Updated ${Math.round(cacheAge / 24)}d ago`
    : null;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
      }
    >
      <AddSheet item={sheetItem} visible={!!sheetItem} onConfirm={confirmAdd} onCancel={cancelAdd} />

      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.dateLabel}>From real databases · AI ranked</Text>
            <Text style={s.title}>Explore</Text>
          </View>
          <View style={s.headerRight}>
            {cacheLabel && <Text style={s.cacheLabel}>{fromCache ? '📦 ' : '🔄 '}{cacheLabel}</Text>}
            <TouchableOpacity onPress={() => load(true)} disabled={loading} style={s.refreshBtn} activeOpacity={0.7}>
              <Text style={s.refreshBtnText}>{loading ? '…' : '↻'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {sources && !loading && (
          <View style={s.sourceRow}>
            {sources.pubmed > 0 && <View style={s.sourcePill}><Text style={s.sourcePillText}>🔬 PubMed {sources.pubmed}</Text></View>}
            {sources.trials > 0 && <View style={s.sourcePill}><Text style={s.sourcePillText}>🏥 Trials {sources.trials}</Text></View>}
            {sources.reddit > 0 && <View style={s.sourcePill}><Text style={s.sourcePillText}>💬 Reddit {sources.reddit}</Text></View>}
            {sources.youtube > 0 && <View style={s.sourcePill}><Text style={s.sourcePillText}>▶ Video {sources.youtube}</Text></View>}
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.centeredBox}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.loadingText}>Fetching PubMed, trials, Reddit, video…</Text>
          <Text style={s.loadingSubText}>Running AI curation for your protocol</Text>
        </View>
      ) : noApiKey ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>🔑</Text>
          <Text style={s.emptyTitle}>API key needed</Text>
          <Text style={s.emptyBody}>Set your Claude API key in the Claude tab to enable AI-powered research.</Text>
        </View>
      ) : error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} style={s.retryBtn} activeOpacity={0.7}>
            <Text style={s.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={s.sectionLabel}>YOUR QUESTIONS, ANSWERED</Text>
          {PINNED_QA.map(item => <PinnedQACard key={item.id} item={item} />)}

          <Text style={[s.sectionLabel, { marginTop: 24 }]}>CURATED FEED</Text>
          <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={sourceCounts} />

          {filteredItems.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyBody}>No items from this source yet. Pull down to refresh.</Text>
            </View>
          ) : (
            filteredItems.map((item, i) => (
              <ExploreCard key={i} item={item} onAddToProtocol={handleAdd} />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  dateLabel: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8, lineHeight: 40, marginTop: 2 },
  cacheLabel: { fontSize: 11, color: '#3A3A3C', textAlign: 'right' },
  refreshBtn: { backgroundColor: '#1C1C1E', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  refreshBtnText: { fontSize: 16, fontWeight: '600', color: C.accent },
  sourceRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  sourcePill: { backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourcePillText: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, marginBottom: 10 },
  filterScroll: { marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1C1C1E' },
  filterTabActive: { backgroundColor: C.accent },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  filterTabTextActive: { color: '#FFFFFF' },
  pinnedCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pinnedHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pinnedIcon: { fontSize: 20, marginTop: 1 },
  pinnedQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 20 },
  expandChevron: { fontSize: 10, color: '#8E8E93', marginTop: 4 },
  pinnedAnswer: { fontSize: 13, color: '#8E8E93', lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E' },
  card: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  sourceIconBubble: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sourceIconText: { fontSize: 16 },
  cardHeaderMeta: { flex: 1 },
  cardChevron: { fontSize: 10, color: '#8E8E93', marginTop: 4, flexShrink: 0 },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 6 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', lineHeight: 19 },
  cardSummary: { fontSize: 13, color: '#8E8E93', lineHeight: 19 },
  cardExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E', gap: 10 },
  relevanceReasonBox: {
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  relevanceReasonLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 4 },
  relevanceReason: { fontSize: 13, color: '#AEAEB2', lineHeight: 18, fontStyle: 'italic' },
  actionChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  actionText: { fontSize: 12, fontWeight: '700' },
  readMoreBtn: { alignSelf: 'flex-start' },
  readMoreText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  addBtn: { backgroundColor: C.accent, borderRadius: 14, height: 42, alignItems: 'center', justifyContent: 'center' },
  addBtnDone: { backgroundColor: '#1A2A1F' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  centeredBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  loadingSubText: { fontSize: 12, color: '#3A3A3C', textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptyBody: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  errorBox: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  errorText: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  sheetItem: { fontSize: 15, fontWeight: '600', color: C.accent, marginBottom: 12, lineHeight: 21 },
  sheetNote: { fontSize: 13, color: '#8E8E93', lineHeight: 19, marginBottom: 24 },
  confirmBtn: { backgroundColor: C.accent, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cancelBtn: { backgroundColor: '#2C2C2E', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
});
