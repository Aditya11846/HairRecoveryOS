import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Pressable,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCustomProtocol, isProtocolAdded, saveProtocolGuide, get } from '../../utils/storage';
import { getSuggestedProtocols, fetchProtocolGuide } from '../../services/ai';

export default function AddProtocolSheet({ visible, onClose, onAdded }) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addedNames, setAddedNames] = useState({});
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setAdding(false);
    get('api_key', '').then(k => setHasApiKey(!!k));
    loadSuggestions();
  }, [visible]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    const results = await getSuggestedProtocols();
    // Check which are already added
    const statuses = {};
    await Promise.all(results.map(async s => {
      statuses[s.name] = await isProtocolAdded(s.name);
    }));
    setSuggestions(results);
    setAddedNames(statuses);
    setLoadingSuggestions(false);
  }, []);

  const handleAdd = async (name, source = 'Manual') => {
    if (!name.trim()) return;
    setAdding(true);
    const result = await addCustomProtocol(name.trim(), source);
    if (result) {
      // Fire-and-forget guide fetch
      fetchProtocolGuide(name.trim()).then(guide => {
        if (guide) saveProtocolGuide(name.trim(), guide);
      });
      onAdded();
      onClose();
    }
    setAdding(false);
  };

  const handleAddSuggestion = async (s) => {
    if (addedNames[s.name]) return;
    setAddedNames(prev => ({ ...prev, [s.name]: 'loading' }));
    await addCustomProtocol(s.name, s.category || 'Research');
    fetchProtocolGuide(s.name).then(guide => {
      if (guide) saveProtocolGuide(s.name, guide);
    });
    setAddedNames(prev => ({ ...prev, [s.name]: true }));
    onAdded();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Add Protocol</Text>
          <Text style={s.sub}>Track any new treatment in your daily check-in.</Text>

          {/* Manual add */}
          <View style={s.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="e.g. Microneedling, Ketoconazole..."
              placeholderTextColor="#3A3A3C"
              style={s.textInput}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => handleAdd(input)}
            />
            <TouchableOpacity
              onPress={() => handleAdd(input)}
              disabled={!input.trim() || adding}
              style={[s.addBtn, (!input.trim() || adding) && s.addBtnDisabled]}
              activeOpacity={0.8}
            >
              {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addBtnText}>Add</Text>}
            </TouchableOpacity>
          </View>

          {/* AI suggestions */}
          <Text style={s.sectionLabel}>AI SUGGESTIONS</Text>
          {!hasApiKey ? (
            <Text style={s.noKeyText}>Set your API key in the Claude tab to see AI-powered suggestions.</Text>
          ) : loadingSuggestions ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={s.loadingText}>Searching for evidence-backed additions…</Text>
            </View>
          ) : suggestions.length === 0 ? (
            <Text style={s.noKeyText}>No suggestions available. Check your connection.</Text>
          ) : (
            <ScrollView style={s.suggestionList} showsVerticalScrollIndicator={false}>
              {suggestions.map((s2, i) => {
                const isAdded = addedNames[s2.name] === true;
                const isLoading = addedNames[s2.name] === 'loading';
                return (
                  <View key={i} style={sg.card}>
                    <View style={sg.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={sg.name}>{s2.name}</Text>
                        <Text style={sg.evidence}>{s2.evidence}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleAddSuggestion(s2)}
                        disabled={isAdded || isLoading}
                        style={[sg.addBtn, isAdded && sg.addBtnDone]}
                        activeOpacity={0.8}
                      >
                        {isLoading
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={sg.addBtnText}>{isAdded ? 'Added ✓' : '+ Add'}</Text>
                        }
                      </TouchableOpacity>
                    </View>
                    <Text style={sg.why}>{s2.whyRelevant}</Text>
                    {s2.caution ? <Text style={sg.caution}>⚠ {s2.caution}</Text> : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  sub: { fontSize: 13, color: '#8E8E93', marginBottom: 16, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  textInput: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF' },
  addBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, minWidth: 60, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#2C2C2E' },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 10 },
  noKeyText: { fontSize: 13, color: '#8E8E93', lineHeight: 18, paddingVertical: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: '#8E8E93' },
  suggestionList: { flexGrow: 0 },
});

const sg = StyleSheet.create({
  card: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  name: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  evidence: { fontSize: 11, color: '#8E8E93' },
  addBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  addBtnDone: { backgroundColor: '#1A2A1F' },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  why: { fontSize: 12, color: '#8E8E93', lineHeight: 17, marginBottom: 4 },
  caution: { fontSize: 11, color: '#FF9F0A', lineHeight: 16 },
});
