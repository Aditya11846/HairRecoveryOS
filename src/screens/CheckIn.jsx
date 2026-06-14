import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { saveCheckin, loadCheckin, getTodayKey, getCustomProtocols } from '../utils/storage';
import SectionLabel from '../components/common/SectionLabel';
import { C } from '../theme';

function ToggleRow({ label, icon, value, onChange, last = false }) {
  return (
    <View style={[s.toggleRow, !last && s.rowBorder]}>
      <View style={s.rowLeft}>
        {icon && <Ionicons name={icon} size={18} color={C.sub} style={s.rowIcon} />}
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <View style={s.toggleGroup}>
        <TouchableOpacity
          onPress={() => onChange(false)}
          style={[s.toggleBtn, value === false && { backgroundColor: C.red }]}
        >
          <Text style={[s.toggleText, { color: value === false ? '#fff' : C.sub }]}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange(true)}
          style={[s.toggleBtn, value === true && { backgroundColor: C.green }]}
        >
          <Text style={[s.toggleText, { color: value === true ? '#fff' : C.sub }]}>Yes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, display, last = false }) {
  return (
    <View style={[s.sliderRow, !last && s.rowBorder]}>
      <View style={s.sliderHeader}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={[s.sliderValue, { color: C.accent }]}>{display(value)}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={C.accent}
        maximumTrackTintColor={C.card2}
        thumbTintColor={Platform.OS === 'android' ? C.accent : '#FFFFFF'}
        style={s.slider}
      />
    </View>
  );
}

const DEFAULT = {
  oralMinoxidil: null,
  topicalMinoxidil: null,
  dutasteride: null,
  cigarettes: 0,
  sleep: 7,
  stress: 5,
  redLightComb: null,
  sheddingNoticed: null,
  notes: '',
};

function isDutaDay(date = new Date()) {
  return date.getDay() === 1 || date.getDay() === 4;
}

export default function CheckIn() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [hadPrior, setHadPrior] = useState(false);
  const [customProtocols, setCustomProtocols] = useState([]);
  const [customValues, setCustomValues] = useState({});
  const today = getTodayKey();
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const showDuta = isDutaDay();

  useEffect(() => {
    Promise.all([
      loadCheckin(today),
      getCustomProtocols(),
    ]).then(([existing, protocols]) => {
      if (existing) { setForm(existing); setHadPrior(true); }
      setCustomProtocols(protocols.filter(p => p.active));
      if (existing?.customValues) setCustomValues(existing.customValues);
    });
  }, [today]);

  const field = key => val => { setForm(f => ({ ...f, [key]: val })); setSaved(false); };
  const customField = id => val => { setCustomValues(v => ({ ...v, [id]: val })); setSaved(false); };

  const handleSave = async () => {
    await saveCheckin({ ...form, customValues });
    setSaved(true);
    setHadPrior(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const canSave = form.oralMinoxidil !== null && form.topicalMinoxidil !== null &&
    (!showDuta || form.dutasteride !== null);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <Text style={s.dateLabel}>{dateLabel}</Text>
        <Text style={s.title}>Daily Check-in</Text>
        {hadPrior && !saved && (
          <View style={s.priorBadge}>
            <Text style={s.priorBadgeText}>Previously saved</Text>
          </View>
        )}
      </View>

      <View style={s.section}>
        <SectionLabel label="Medications" />
        <View style={s.card}>
          <ToggleRow
            label="Oral Minoxidil 2.5mg"
            icon="medical"
            value={form.oralMinoxidil}
            onChange={field('oralMinoxidil')}
          />
          <ToggleRow
            label="Novegrow 10% Solution"
            icon="water"
            value={form.topicalMinoxidil}
            onChange={field('topicalMinoxidil')}
          />
          {showDuta && (
            <ToggleRow
              label="Dutasteride 0.5mg"
              icon="shield-checkmark"
              value={form.dutasteride}
              onChange={field('dutasteride')}
            />
          )}
          <ToggleRow
            label="Red Light Comb"
            icon="flash"
            value={form.redLightComb}
            onChange={field('redLightComb')}
            last
          />
        </View>
      </View>

      {customProtocols.length > 0 && (
        <View style={s.section}>
          <SectionLabel label="Custom Protocol" />
          <View style={s.card}>
            {customProtocols.map((p, i) => (
              <ToggleRow
                key={p.id}
                label={p.name}
                icon="add-circle"
                value={customValues[p.id] ?? null}
                onChange={customField(p.id)}
                last={i === customProtocols.length - 1}
              />
            ))}
          </View>
        </View>
      )}

      <View style={s.section}>
        <SectionLabel label="Lifestyle" />
        <View style={s.card}>
          <SliderRow label="Cigarettes" value={form.cigarettes} min={0} max={20}
            onChange={field('cigarettes')} display={v => v === 0 ? '0 ✓' : String(v)} />
          <SliderRow label="Sleep" value={form.sleep} min={3} max={10} step={0.5}
            onChange={field('sleep')} display={v => `${v}h`} />
          <SliderRow label="Stress level" value={form.stress} min={1} max={10}
            onChange={field('stress')} display={v => `${v}/10`} last />
        </View>
      </View>

      <View style={s.section}>
        <SectionLabel label="Observations" />
        <View style={s.card}>
          <ToggleRow label="Shedding noticed" value={form.sheddingNoticed} onChange={field('sheddingNoticed')} last />
        </View>
      </View>

      <View style={s.section}>
        <SectionLabel label="Notes" />
        <View style={s.card}>
          <TextInput
            value={form.notes}
            onChangeText={field('notes')}
            placeholder="Anything unusual, side effects, observations..."
            placeholderTextColor={C.dim}
            multiline
            style={s.notesInput}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={!canSave}
        style={[s.saveBtn, { backgroundColor: saved ? C.green : canSave ? C.accent : C.card2 }]}
        activeOpacity={0.8}
      >
        <Text style={[s.saveBtnText, { color: canSave || saved ? '#fff' : C.sub }]}>
          {saved ? '✓ Saved' : canSave ? 'Save Check-in' : 'Select medication status to save'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 24 },
  dateLabel: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  title: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 40, marginTop: 2 },
  priorBadge: { alignSelf: 'flex-start', backgroundColor: '#1C3A2A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  priorBadgeText: { fontSize: 11, fontWeight: '600', color: '#30D158' },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 12, overflow: 'hidden' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C2C2E' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 56, paddingVertical: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  rowIcon: { marginRight: 10 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#FFFFFF', flex: 1 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  toggleText: { fontSize: 14, fontWeight: '600' },
  sliderRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sliderValue: { fontSize: 16, fontWeight: '700' },
  slider: { marginHorizontal: -4 },
  notesInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFFFFF', minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
