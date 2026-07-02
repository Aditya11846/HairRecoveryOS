import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Pressable,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCustomProtocol, isProtocolAdded, saveProtocolGuide, get } from '../../utils/storage';
import { getSuggestedProtocols, fetchProtocolGuide } from '../../services/ai';
import { Lightning, Pill, Droplet, Shield, Sun, Moon, Flask, Dna, Butterfly, Star } from '../Icon';
import { color, type, radius } from '../../theme/tokens';

const ICON_ACCENT = {
  lightning: '#FFB020',
  pill:      '#CF8020',
  droplet:   '#FF6B4A',
  shield:    '#5B8DEF',
  sun:       '#FF9030',
  moon:      '#A78BFA',
  flask:     '#30D158',
  dna:       '#BF5AF2',
  butterfly: '#FF9030',
  star:      '#FFD60A',
};

const ICON_OPTIONS = [
  { key: 'lightning', label: 'Treatment', Comp: Lightning },
  { key: 'pill',      label: 'Supplement', Comp: Pill },
  { key: 'droplet',   label: 'Topical',    Comp: Droplet },
  { key: 'shield',    label: 'Protective', Comp: Shield },
  { key: 'sun',       label: 'Light',      Comp: Sun },
  { key: 'moon',      label: 'Nighttime',  Comp: Moon },
  { key: 'flask',     label: 'Research',   Comp: Flask },
  { key: 'dna',       label: 'Biological', Comp: Dna },
  { key: 'butterfly', label: 'Growth',     Comp: Butterfly },
  { key: 'star',      label: 'Special',    Comp: Star },
];

const FREQ_OPTIONS = ['Daily', '3x / Week', '2x / Week', 'Weekly'];

const ra = (hex, a) => {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export default function AddProtocolSheet({ visible, onClose, onAdded }) {
  const insets = useSafeAreaInsets();

  const [tab, setTab]       = useState('create');
  const [name, setName]     = useState('');
  const [dose, setDose]     = useState('');
  const [freq, setFreq]     = useState('Daily');
  const [icon, setIcon]     = useState('lightning');
  const [adding, setAdding] = useState(false);

  const [suggestions, setSuggestions]             = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addedNames, setAddedNames]               = useState({});
  const [hasApiKey, setHasApiKey]                 = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTab('create');
    setName(''); setDose(''); setFreq('Daily'); setIcon('lightning'); setAdding(false);
    get('api_key', '').then(k => setHasApiKey(!!k));
  }, [visible]);

  const loadSuggestions = useCallback(async () => {
    if (suggestions.length > 0) {
      // Suggestion list already fetched this session — just refresh added/dedupe
      // status, since a protocol may have been added elsewhere since last open.
      const statuses = {};
      await Promise.all(suggestions.map(async s => { statuses[s.name] = await isProtocolAdded(s.name); }));
      setAddedNames(statuses);
      return;
    }
    setLoadingSuggestions(true);
    const results = await getSuggestedProtocols();
    const statuses = {};
    await Promise.all(results.map(async s => { statuses[s.name] = await isProtocolAdded(s.name); }));
    setSuggestions(results);
    setAddedNames(statuses);
    setLoadingSuggestions(false);
  }, [suggestions]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setAdding(true);
    const result = await addCustomProtocol({ name: name.trim(), icon, dose: dose.trim(), frequency: freq });
    if (result) {
      fetchProtocolGuide(name.trim()).then(guide => { if (guide) saveProtocolGuide(name.trim(), guide); });
      onAdded();
      onClose();
    }
    setAdding(false);
  };

  const handleAddSuggestion = async (s) => {
    if (addedNames[s.name]) return;
    setAddedNames(prev => ({ ...prev, [s.name]: 'loading' }));
    await addCustomProtocol({ name: s.name, icon: 'lightning', source: s.category || 'Research' });
    fetchProtocolGuide(s.name).then(guide => { if (guide) saveProtocolGuide(s.name, guide); });
    setAddedNames(prev => ({ ...prev, [s.name]: true }));
    onAdded();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Add Protocol</Text>

          {/* Tab switcher */}
          <View style={s.tabRow}>
            {['create', 'discover'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setTab(t); if (t === 'discover') loadSuggestions(); }}
                style={[s.tabBtn, tab === t && s.tabActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                  {t === 'create' ? 'Create' : 'Discover'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'create' ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={s.fieldLabel}>NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Microneedling, Ketoconazole…"
                placeholderTextColor={color.faint}
                style={s.textInput}
                autoCapitalize="words"
                returnKeyType="next"
                selectionColor={color.warmA}
              />

              {/* Dose / Notes */}
              <Text style={s.fieldLabel}>
                DOSE / NOTES{'  '}<Text style={s.optional}>optional</Text>
              </Text>
              <TextInput
                value={dose}
                onChangeText={setDose}
                placeholder="e.g. 0.5mm depth, 1mg, topical…"
                placeholderTextColor={color.faint}
                style={s.textInput}
                returnKeyType="done"
                selectionColor={color.warmA}
              />

              {/* Frequency */}
              <Text style={s.fieldLabel}>FREQUENCY</Text>
              <View style={s.chipRow}>
                {FREQ_OPTIONS.map(f => (
                  <TouchableOpacity key={f} onPress={() => setFreq(f)} style={[s.chip, freq === f && s.chipActive]} activeOpacity={0.7}>
                    <Text style={[s.chipTxt, freq === f && s.chipTxtActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icon picker */}
              <Text style={s.fieldLabel}>ICON</Text>
              <View style={s.iconGrid}>
                {ICON_OPTIONS.map(opt => {
                  const sel = icon === opt.key;
                  const ac  = ICON_ACCENT[opt.key];
                  return (
                    <TouchableOpacity key={opt.key} onPress={() => setIcon(opt.key)} style={[s.iconCell, sel && { backgroundColor: ac + '26', borderWidth: 1.5, borderColor: ac + '80' }]} activeOpacity={0.7}>
                      <opt.Comp size={22} color={sel ? ac : ac + '80'} />
                      <Text style={[s.iconLabel, { color: sel ? ac : color.faint }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add button */}
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!name.trim() || adding}
                style={[s.addBtn, (!name.trim() || adding) && s.addBtnDisabled]}
                activeOpacity={0.8}
              >
                {adding
                  ? <ActivityIndicator size="small" color="#1A1000" />
                  : <Text style={s.addBtnText}>Add Protocol</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Discover tab */
            !hasApiKey ? (
              <Text style={s.noKeyText}>Set your API key in the Claude tab to see AI-powered suggestions.</Text>
            ) : loadingSuggestions ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={color.warmA} />
                <Text style={s.loadingText}>Finding evidence-backed additions…</Text>
              </View>
            ) : suggestions.length === 0 ? (
              <Text style={s.noKeyText}>No suggestions available. Check your connection.</Text>
            ) : (
              <ScrollView style={s.suggestionList} showsVerticalScrollIndicator={false}>
                {suggestions.map((s2, i) => {
                  const isAdded   = addedNames[s2.name] === true;
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
            )
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', alignSelf: 'center', marginBottom: 20 },
  title:    { fontSize: 20, fontWeight: '700', color: color.txt, marginBottom: 16 },

  tabRow:       { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 12, padding: 3, marginBottom: 20 },
  tabBtn:       { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: color.warmA },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: color.dim },
  tabTxtActive: { color: '#1A1000' },

  fieldLabel: { ...type.eyebrow, color: color.dim, marginBottom: 8, marginTop: 16 },
  optional:   { fontSize: 10, color: color.faint, fontWeight: '400' },
  textInput:  { backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: color.txt },

  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#2C2C2E' },
  chipActive:    { backgroundColor: ra('#FFB020', 0.20), borderWidth: 1, borderColor: ra('#FFB020', 0.45) },
  chipTxt:       { fontSize: 13, color: color.dim },
  chipTxtActive: { color: color.warmA, fontWeight: '600' },

  iconGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  iconCell:        { width: '18%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconCellActive:  { backgroundColor: ra('#FFB020', 0.15), borderWidth: 1.5, borderColor: ra('#FFB020', 0.50) },
  iconLabel:       { fontSize: 9, color: color.faint, textAlign: 'center' },
  iconLabelActive: { color: color.warmA },

  addBtn:         { backgroundColor: color.warmA, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  addBtnDisabled: { backgroundColor: '#2C2C2E' },
  addBtnText:     { fontSize: 16, fontWeight: '700', color: '#1A1000' },

  noKeyText:   { fontSize: 13, color: color.dim, lineHeight: 18, paddingVertical: 8 },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: color.dim },
  suggestionList: { flexGrow: 0 },
});

const sg = StyleSheet.create({
  card:       { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  name:       { fontSize: 14, fontWeight: '700', color: color.txt, marginBottom: 2 },
  evidence:   { fontSize: 11, color: color.dim },
  addBtn:     { backgroundColor: color.warmA, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  addBtnDone: { backgroundColor: '#1A2A1F' },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#1A1000' },
  why:        { fontSize: 12, color: color.dim, lineHeight: 17, marginBottom: 4 },
  caution:    { fontSize: 11, color: '#FF9F0A', lineHeight: 16 },
});
