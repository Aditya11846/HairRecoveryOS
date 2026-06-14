import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedOrFreshExplore } from '../services/explore';
import { addCustomProtocol } from '../utils/storage';
import ResearchCard from '../components/cards/ResearchCard';
import AddToProtocolSheet from '../components/sheets/AddToProtocolSheet';
import { C } from '../theme';

function SourceStats({ sources }) {
  if (!sources) return null;
  return (
    <View style={s.sourceRow}>
      <View style={s.sourcePill}>
        <Text style={s.sourcePillText}>PubMed {sources.pubmed}</Text>
      </View>
      <View style={s.sourcePill}>
        <Text style={s.sourcePillText}>Trials {sources.trials}</Text>
      </View>
      <View style={s.sourcePill}>
        <Text style={s.sourcePillText}>Reddit {sources.reddit}</Text>
      </View>
    </View>
  );
}

export default function Explore() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [noApiKey, setNoApiKey] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetCb, setSheetCb] = useState(null);
  const [sheetCancelCb, setSheetCancelCb] = useState(null);
  const loaded = useRef(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load(false);
  }, []);

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

  const fetchedLabel = fetchedAt
    ? `${fromCache ? 'Cached' : 'Updated'} ${new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <AddToProtocolSheet item={sheetItem} visible={!!sheetItem} onConfirm={confirmAdd} onCancel={cancelAdd} />

      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.dateLabel}>From real databases · AI ranked</Text>
            <Text style={s.title}>Explore</Text>
          </View>
          <TouchableOpacity
            onPress={() => load(true)}
            disabled={loading}
            style={s.refreshBtn}
            activeOpacity={0.7}
          >
            <Text style={s.refreshBtnText}>{loading ? '…' : '↻ Refresh'}</Text>
          </TouchableOpacity>
        </View>
        {fetchedLabel && <Text style={s.fetchedLabel}>{fetchedLabel}</Text>}
        {sources && !loading && <SourceStats sources={sources} />}
      </View>

      {loading ? (
        <View style={s.centeredBox}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.loadingText}>Fetching PubMed, clinical trials, Reddit…</Text>
          <Text style={s.loadingSubText}>Then running AI analysis</Text>
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
        items.map((item, i) => (
          <ResearchCard key={i} item={item} onAddToProtocol={handleAdd} />
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dateLabel: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  title: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 40, marginTop: 2 },
  refreshBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
  fetchedLabel: { fontSize: 11, color: '#3A3A3C', marginTop: 6 },
  sourceRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  sourcePill: { backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sourcePillText: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  centeredBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14, color: '#8E8E93' },
  loadingSubText: { fontSize: 12, color: '#3A3A3C' },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptyBody: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  errorBox: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, gap: 12 },
  errorText: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
});
