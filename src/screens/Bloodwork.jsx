import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { get, set } from '../utils/storage';
import RangeBar from '../components/RangeBar';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import { Dna, Flask, Lightning, Moon, Pill } from '../components/Icon';
import { color, type, radius, space } from '../theme/tokens';

// ─── Marker definitions ───────────────────────────────────────────────────────

const CRITICAL_MARKERS = [
  {
    id: 'dht', name: 'DHT', unit: 'pg/mL',
    rangeLabel: 'Target < 60',
    rangeBar: { min: 0, max: 150, threshold: 60, direction: 'below' },
    info: 'Primary driver of AGA. Dutasteride suppresses DHT ~90%. Lower = better follicle protection.',
  },
  {
    id: 'ferritin', name: 'Ferritin', unit: 'ng/mL',
    rangeLabel: 'Target > 70',
    rangeBar: { min: 0, max: 250, threshold: 70, direction: 'above' },
    info: 'Iron stores. Low ferritin is a hidden trigger of shedding. Target >70 for active regrowth.',
  },
  {
    id: 'vitamin_d', name: 'Vitamin D3', unit: 'ng/mL',
    rangeLabel: 'Target > 50',
    rangeBar: { min: 0, max: 120, threshold: 50, direction: 'above' },
    info: 'Deficiency is near-universal in India. Hair follicle cycling depends on the Vitamin D receptor.',
  },
];

const HORMONAL_MARKERS = [
  { id: 'tsh',       name: 'TSH',                unit: 'mIU/L', rangeLabel: '0.4 – 4.0',   range: { min: 0.4, max: 4.0 },   direction: 'range' },
  { id: 'test_total',name: 'Testosterone Total',  unit: 'ng/dL', rangeLabel: '300 – 1000', range: { min: 300, max: 1000 },  direction: 'range' },
  { id: 'test_free', name: 'Testosterone Free',   unit: 'pg/mL', rangeLabel: '50 – 210',   range: { min: 50,  max: 210 },   direction: 'range' },
  { id: 'zinc',      name: 'Zinc',                unit: 'μg/dL', rangeLabel: '60 – 120',   range: { min: 60,  max: 120 },   direction: 'range' },
];

const ALL_IDS = [...CRITICAL_MARKERS.map(m => m.id), ...HORMONAL_MARKERS.map(m => m.id)];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRangeStatus(marker, valueStr) {
  const v = parseFloat(valueStr);
  if (!valueStr || isNaN(v)) return null;
  if (marker.rangeBar) {
    const { threshold, direction } = marker.rangeBar;
    return direction === 'below' ? (v <= threshold ? 'ok' : 'high') : (v >= threshold ? 'ok' : 'low');
  }
  if (marker.range) {
    if (v < marker.range.min) return 'low';
    if (v > marker.range.max) return 'high';
    return 'ok';
  }
  return null;
}

function formatDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const localDs = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayStr     = () => localDs();
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return localDs(d); };

// ─── Critical Marker Card ─────────────────────────────────────────────────────

function CriticalCard({ marker, value, onChange }) {
  const [open, setOpen] = useState(false);
  const status = getRangeStatus(marker, value);
  const dotColor = status === 'ok' ? color.green : status ? color.red : color.faint;
  const numValue = parseFloat(value);

  return (
    <View style={cc.card}>
      <TouchableOpacity style={cc.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={cc.iconWrap}>
          <Dna size={16} color={dotColor === color.faint ? color.dim : dotColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cc.name}>{marker.name}</Text>
          <Text style={cc.range}>{marker.rangeLabel} · {marker.unit}</Text>
        </View>
        {status && <View style={[cc.pill, { borderColor: dotColor, backgroundColor: dotColor + '18' }]}>
          <View style={[cc.pilldot, { backgroundColor: dotColor }]} />
          <Text style={[cc.pillTxt, { color: dotColor }]}>
            {status === 'ok' ? 'In range' : status === 'low' ? 'Low' : 'High'}
          </Text>
        </View>}
      </TouchableOpacity>

      <View style={cc.valueRow}>
        <TextInput
          style={cc.input}
          value={value}
          onChangeText={onChange}
          placeholder="—"
          placeholderTextColor={color.faint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={8}
        />
        <Text style={cc.unit}>{marker.unit}</Text>
      </View>

      {!isNaN(numValue) && value.trim() !== '' && (
        <View style={cc.rangeBarWrap}>
          <RangeBar
            value={numValue}
            min={marker.rangeBar.min}
            max={marker.rangeBar.max}
            threshold={marker.rangeBar.threshold}
            direction={marker.rangeBar.direction}
            unit={` ${marker.unit}`}
          />
        </View>
      )}

      {open && (
        <View style={cc.info}>
          <Text style={cc.infoTxt}>{marker.info}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Hormonal ListRow right element ──────────────────────────────────────────

function HormonalRight({ marker, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const status = getRangeStatus(marker, value);
  const dotColor = status === 'ok' ? color.green : status ? color.warmA : color.faint;

  if (editing) {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={() => setEditing(false)}
        placeholder="—"
        placeholderTextColor={color.faint}
        keyboardType="decimal-pad"
        style={hr.input}
        autoFocus
        maxLength={8}
      />
    );
  }

  return (
    <TouchableOpacity onPress={() => setEditing(true)} style={hr.wrap} activeOpacity={0.7}>
      <Text style={[hr.val, { color: status ? dotColor : color.faint }]}>
        {value || 'tap'}
      </Text>
      <Text style={hr.unit}>{marker.unit}</Text>
      <View style={[hr.dot, { backgroundColor: dotColor }]} />
    </TouchableOpacity>
  );
}

// ─── Date Modal ───────────────────────────────────────────────────────────────

function DateModal({ visible, onClose, onSelect }) {
  const insets = useSafeAreaInsets();
  const [custom, setCustom] = useState('');
  const [err, setErr] = useState('');

  const pick = (str) => { onSelect(str); onClose(); };
  const submitCustom = () => {
    const d = new Date(custom);
    if (isNaN(d)) { setErr('Use format YYYY-MM-DD'); return; }
    pick(custom);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dm.overlay} onPress={onClose}>
        <Pressable style={[dm.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
          <View style={dm.handle} />
          <Text style={dm.title}>When did you get tested?</Text>
          <TouchableOpacity style={dm.option} onPress={() => pick(todayStr())} activeOpacity={0.7}>
            <Text style={dm.optionText}>Today</Text>
            <Text style={dm.optionSub}>{formatDate(todayStr())}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dm.option} onPress={() => pick(yesterdayStr())} activeOpacity={0.7}>
            <Text style={dm.optionText}>Yesterday</Text>
            <Text style={dm.optionSub}>{formatDate(yesterdayStr())}</Text>
          </TouchableOpacity>
          <View style={dm.divider} />
          <Text style={dm.customLabel}>ENTER DATE</Text>
          <View style={dm.customRow}>
            <TextInput
              style={dm.customInput}
              value={custom}
              onChangeText={t => { setCustom(t); setErr(''); }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={color.faint}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={submitCustom}
            />
            <TouchableOpacity style={dm.customBtn} onPress={submitCustom} activeOpacity={0.8}>
              <Text style={dm.customBtnText}>Set</Text>
            </TouchableOpacity>
          </View>
          {err ? <Text style={dm.err}>{err}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Bloodwork({ navigation }) {
  const insets = useSafeAreaInsets();
  const [values, setValues]       = useState({});
  const [testedAt, setTestedAt]   = useState(null);
  const [saved, setSaved]         = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);

  useFocusEffect(useCallback(() => {
    get('bloodwork', null).then(data => {
      if (data) {
        setValues(data.values || {});
        setTestedAt(data.testedAt || null);
        setLastSaved(data.savedAt || null);
      }
    });
  }, []));

  const setValue = (id, val) => {
    setSaved(false);
    setValues(v => ({ ...v, [id]: val }));
  };

  const handleSave = async () => {
    const data = { values, testedAt, savedAt: new Date().toISOString() };
    await set('bloodwork', data);
    const allFilled = ALL_IDS.every(id => values[id]?.trim());
    if (allFilled) {
      const phase1 = await get('phase1', {});
      await set('phase1', { ...phase1, bloodwork: true });
    }
    setSaved(true);
    setLastSaved(new Date().toISOString());
    setTimeout(() => setSaved(false), 2500);
  };

  const loggedCount = ALL_IDS.filter(id => values[id]?.trim()).length;
  const allStatuses = ALL_IDS.map(id => {
    const m = [...CRITICAL_MARKERS, ...HORMONAL_MARKERS].find(x => x.id === id);
    return m ? getRangeStatus(m, values[id]) : null;
  });
  const inRangeCount = allStatuses.filter(s => s === 'ok').length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back affordance */}
        {navigation?.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backTxt}>‹ Progress</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <Text style={s.eyebrow}>Phase 1 · Objective #3</Text>
        <Text style={s.title}>Bloodwork</Text>

        {/* Summary 2-up */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Logged</Text>
            <Text style={[s.summaryVal, { color: loggedCount === 7 ? color.green : color.warmA }]}>
              {loggedCount}<Text style={s.summaryDenom}>/7</Text>
            </Text>
            {/* Status dot row */}
            <View style={s.dotRow}>
              {ALL_IDS.map((id, i) => {
                const m = [...CRITICAL_MARKERS, ...HORMONAL_MARKERS].find(x => x.id === id);
                const st = m ? getRangeStatus(m, values[id]) : null;
                const dotC = st === 'ok' ? color.green : st ? (CRITICAL_MARKERS.find(x => x.id === id) ? color.red : color.warmA) : (values[id]?.trim() ? color.faint : color.line2);
                return <View key={id} style={[s.dot, { backgroundColor: dotC }]} />;
              })}
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowDateModal(true)} style={s.summaryCard} activeOpacity={0.75}>
            <Text style={s.summaryLabel}>Test date</Text>
            <Text style={[s.summaryVal, { color: testedAt ? color.txt : color.faint, fontSize: 16 }]} numberOfLines={1}>
              {testedAt ? formatDate(testedAt) : 'Tap to set'}
            </Text>
            <Text style={s.summaryHint}>{inRangeCount}/{loggedCount || 7} in range</Text>
          </TouchableOpacity>
        </View>

        {/* Critical markers */}
        <SectionHeader label="Critical Markers" />
        {CRITICAL_MARKERS.map(m => (
          <CriticalCard
            key={m.id}
            marker={m}
            value={values[m.id] || ''}
            onChange={v => setValue(m.id, v)}
          />
        ))}

        {/* Hormonal panel */}
        <SectionHeader label="Hormonal Panel" />
        <Card flush>
          {HORMONAL_MARKERS.map((m, i) => (
            <ListRow
              key={m.id}
              icon={<Flask size={16} color={color.dim} />}
              name={m.name}
              desc={m.rangeLabel + ' ' + m.unit}
              right={<HormonalRight marker={m} value={values[m.id] || ''} onChange={v => setValue(m.id, v)} />}
              last={i === HORMONAL_MARKERS.length - 1}
            />
          ))}
        </Card>

        <View style={s.note}>
          <Text style={s.noteTxt}>Tap any critical marker to read clinical context. Values stored locally. Share with your dermatologist.</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saved && s.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnTxt}>{saved ? '✓ Saved' : 'Save Results'}</Text>
        </TouchableOpacity>

        {lastSaved && !saved && (
          <Text style={s.lastSaved}>Last saved {new Date(lastSaved).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        )}
      </ScrollView>

      <DateModal
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        onSelect={d => { setTestedAt(d); setSaved(false); }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backTxt: { ...type.eyebrow, color: color.warmA, fontSize: 13, letterSpacing: 0 },
  eyebrow: { ...type.eyebrow, marginBottom: 6 },
  title:   { ...type.screenTitle, marginBottom: 20 },

  summaryRow:  { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  summaryCard: { flex: 1, backgroundColor: color.card, borderRadius: radius.stat, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, padding: space.lg },
  summaryLabel:{ ...type.eyebrow, marginBottom: 6 },
  summaryVal:  { ...type.statValue, marginBottom: 8 },
  summaryDenom:{ fontSize: 16, color: color.faint, fontWeight: '500' },
  summaryHint: { ...type.eyebrow, fontSize: 8, marginTop: 4 },
  dotRow:      { flexDirection: 'row', gap: 4 },
  dot:         { flex: 1, height: 4, borderRadius: 2 },

  note:    { backgroundColor: color.card, borderRadius: radius.row, padding: 14, marginTop: 12, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  noteTxt: { fontSize: 12, color: color.dim, lineHeight: 18 },
  saveBtn: { backgroundColor: color.warmA, borderRadius: radius.card, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnDone: { backgroundColor: color.green },
  saveBtnTxt:  { fontSize: 16, fontWeight: '700', color: '#1A1000' },
  lastSaved:   { fontSize: 12, color: color.faint, textAlign: 'center', marginTop: 10 },
});

const cc = StyleSheet.create({
  card:       { backgroundColor: color.card, borderRadius: radius.card, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  iconWrap:   { width: 32, height: 32, borderRadius: 9, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  name:       { ...type.bodyStrong, fontSize: 15 },
  range:      { fontSize: 12, color: color.dim, marginTop: 2 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  pilldot:    { width: 5, height: 5, borderRadius: 2.5 },
  pillTxt:    { fontSize: 11, fontWeight: '700' },
  valueRow:   { flexDirection: 'row', alignItems: 'baseline', marginHorizontal: 14, marginBottom: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, paddingTop: 10 },
  input:      { fontSize: 28, fontWeight: '800', color: color.txt, letterSpacing: -0.5, minWidth: 80 },
  unit:       { fontSize: 13, color: color.dim, fontWeight: '500' },
  rangeBarWrap:{ marginHorizontal: 14, marginBottom: 12 },
  info:       { marginHorizontal: 14, marginBottom: 12, backgroundColor: color.card2, borderRadius: 10, padding: 10 },
  infoTxt:    { fontSize: 13, color: color.dim, lineHeight: 18 },
});

const hr = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  val:   { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  unit:  { fontSize: 10, color: color.faint },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  input: { fontSize: 15, fontWeight: '700', color: color.warmA, minWidth: 60, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: color.warmA, paddingBottom: 2 },
});

const dm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: color.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: color.line2, alignSelf: 'center', marginBottom: 20 },
  title:        { ...type.bodyStrong, fontSize: 17, marginBottom: 16, textAlign: 'center' },
  option:       { backgroundColor: color.card2, borderRadius: radius.row, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText:   { ...type.bodyStrong },
  optionSub:    { fontSize: 13, color: color.dim },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: 14 },
  customLabel:  { ...type.eyebrow, marginBottom: 10 },
  customRow:    { flexDirection: 'row', gap: 8 },
  customInput:  { flex: 1, backgroundColor: color.card2, borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: color.txt, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  customBtn:    { backgroundColor: color.warmA, borderRadius: radius.row, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  customBtnText:{ fontSize: 15, fontWeight: '700', color: '#1A1000' },
  err:          { fontSize: 12, color: color.red, marginTop: 8 },
});
