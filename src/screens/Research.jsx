import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedOrFreshResearch } from '../services/ai';
import { addCustomProtocol } from '../utils/storage';
import ResearchCard from '../components/cards/ResearchCard';
import AddToProtocolSheet from '../components/sheets/AddToProtocolSheet';
import { C } from '../theme';

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.aiDot, { opacity }]} />;
}

export default function Research() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [noApiKey, setNoApiKey] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetCallback, setSheetCallback] = useState(null);
  const [sheetCancelCallback, setSheetCancelCallback] = useState(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    setNoApiKey(false);
    const result = await getCachedOrFreshResearch(force);
    if (!result || result.noApiKey) {
      setNoApiKey(true);
    } else if (result.apiError) {
      setError(result.errorDetail || result.error || 'Network request failed — check API key and connection.');
    } else {
      setItems(result.items);
      setFetchedAt(result.fetchedAt);
      setFromCache(result.fromCache);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(false); }, []);

  const handleAddToProtocol = (item, onDone, onFail) => {
    setSheetItem(item);
    setSheetCallback(() => onDone);
    setSheetCancelCallback(() => onFail);
  };

  const confirmAdd = async () => {
    if (!sheetItem) return;
    const result = await addCustomProtocol(sheetItem.title, sheetItem.source);
    setSheetItem(null);
    if (result && sheetCallback) sheetCallback();
    else if (!result && sheetCancelCallback) sheetCancelCallback();
  };

  const cancelAdd = () => {
    setSheetItem(null);
    if (sheetCancelCallback) sheetCancelCallback();
  };

  const fetchedLabel = fetchedAt
    ? `${fromCache ? 'Cached' : 'Updated'} ${new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <AddToProtocolSheet
        item={sheetItem}
        visible={!!sheetItem}
        onConfirm={confirmAdd}
        onCancel={cancelAdd}
      />

      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.dateLabel}>AI web search · 48h cache</Text>
            <Text style={s.title}>Research</Text>
          </View>
          <TouchableOpacity
            onPress={() => load(true)}
            disabled={loading}
            style={s.refreshBtn}
            activeOpacity={0.7}
          >
            <Text style={s.refreshBtnText}>{loading ? '…' : '↻ Live search'}</Text>
          </TouchableOpacity>
        </View>
        {fetchedLabel && <Text style={s.fetchedLabel}>{fetchedLabel}</Text>}
        <View style={s.aiIndicatorRow}>
          <PulsingDot />
          <Text style={s.aiIndicatorText}>AI WEB SEARCH</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centeredBox}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.loadingText}>Searching the web for latest research…</Text>
        </View>
      ) : noApiKey ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>🔑</Text>
          <Text style={s.emptyTitle}>API key needed</Text>
          <Text style={s.emptyBody}>
            Set your Claude API key in the Claude tab to enable AI-powered research.
          </Text>
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
          <ResearchCard
            key={i}
            item={item}
            onAddToProtocol={handleAddToProtocol}
          />
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
  dateLabel: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8, lineHeight: 40, marginTop: 2 },
  refreshBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  fetchedLabel: { fontSize: 11, color: '#3A3A3C', marginTop: 6 },
  aiIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  aiDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3B82F6' },
  aiIndicatorText: { fontSize: 10, fontWeight: '700', color: '#3B82F6', letterSpacing: 0.8 },
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#8E8E93' },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptyBody: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  errorBox: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, gap: 12 },
  errorText: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
});
