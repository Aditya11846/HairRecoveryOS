import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Platform, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  saveCheckin, loadCheckin, getTodayKey, getCustomProtocols,
  removeCustomProtocol, getProtocolGuide,
} from '../utils/storage';
import AddProtocolSheet from '../components/sheets/AddProtocolSheet';
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

function GuideModal({ guide, name, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={[gm.overlay]}>
        <View style={[gm.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={gm.header}>
            <Text style={gm.title}>{name}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn} activeOpacity={0.7}>
              <Text style={gm.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          {!guide ? (
            <View style={gm.loadingBox}>
              <ActivityIndicator color={C.accent} />
              <Text style={gm.loadingText}>Fetching usage guide from the web…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={gm.metaRow}>
                {guide.dose ? <View style={gm.metaChip}><Text style={gm.metaLabel}>DOSE</Text><Text style={gm.metaVal}>{guide.dose}</Text></View> : null}
                {guide.timing ? <View style={gm.metaChip}><Text style={gm.metaLabel}>TIMING</Text><Text style={gm.metaVal}>{guide.timing}</Text></View> : null}
              </View>
              {guide.mechanism ? (
                <View style={gm.section}>
                  <Text style={gm.sectionLabel}>HOW IT WORKS</Text>
                  <Text style={gm.body}>{guide.mechanism}</Text>
                </View>
              ) : null}
              {guide.evidence ? (
                <View style={gm.section}>
                  <Text style={gm.sectionLabel}>EVIDENCE</Text>
                  <Text style={gm.body}>{guide.evidence}</Text>
                </View>
              ) : null}
              {guide.steps?.length > 0 ? (
                <View style={gm.section}>
                  <Text style={gm.sectionLabel}>HOW TO USE</Text>
                  {guide.steps.map((step, i) => (
                    <View key={i} style={gm.step}>
                      <Text style={gm.stepIcon}>{step.icon || '•'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={gm.stepTitle}>{step.title}</Text>
                        <Text style={gm.stepBody}>{step.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {guide.caution ? (
                <View style={[gm.section, gm.cautionBox]}>
                  <Text style={gm.cautionText}>⚠ {guide.caution}</Text>
                </View>
              ) : null}
              {guide.note ? (
                <View style={gm.noteBox}>
                  <Text style={gm.noteText}>{guide.note}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
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
  const [editMode, setEditMode] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [viewingGuide, setViewingGuide] = useState(null); // { name, guide }
  const [loadingGuide, setLoadingGuide] = useState(false);
  const today = getTodayKey();
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const showDuta = isDutaDay();

  // Load check-in data once on mount (form state)
  useEffect(() => {
    loadCheckin(today).then(existing => {
      if (existing) { setForm(existing); setHadPrior(true); }
      if (existing?.customValues) setCustomValues(existing.customValues);
    }).catch(() => {});
  }, [today]);

  // Refresh protocol list every time screen is focused
  useFocusEffect(
    useCallback(() => {
      getCustomProtocols().then(protocols => {
        setCustomProtocols(protocols.filter(p => p.active));
      });
    }, [])
  );

  const refreshProtocols = () => {
    getCustomProtocols().then(protocols => {
      setCustomProtocols(protocols.filter(p => p.active));
    });
  };

  const field = key => val => { setForm(f => ({ ...f, [key]: val })); setSaved(false); };
  const customField = id => val => { setCustomValues(v => ({ ...v, [id]: val })); setSaved(false); };

  const handleSave = async () => {
    await saveCheckin({ ...form, customValues });
    setSaved(true);
    setHadPrior(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = async (id) => {
    await removeCustomProtocol(id);
    refreshProtocols();
  };

  const handleViewGuide = async (name) => {
    setLoadingGuide(true);
    setViewingGuide({ name, guide: null });
    const guide = await getProtocolGuide(name);
    setViewingGuide({ name, guide });
    setLoadingGuide(false);
  };

  const canSave = form.oralMinoxidil !== null && form.topicalMinoxidil !== null &&
    (!showDuta || form.dutasteride !== null);

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: C.bg }]}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.dateLabel}>{dateLabel}</Text>
          <View style={s.titleRow}>
            <Text style={s.title}>Daily Check-in</Text>
            <View style={s.headerBtns}>
              <TouchableOpacity
                onPress={() => setEditMode(e => !e)}
                style={[s.headerBtn, editMode && s.headerBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.headerBtnText, editMode && { color: C.accent }]}>
                  {editMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddSheetVisible(true)}
                style={s.headerBtn}
                activeOpacity={0.7}
              >
                <Text style={[s.headerBtnText, { color: C.accent, fontSize: 20, lineHeight: 22 }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {hadPrior && !saved && (
            <View style={s.priorBadge}>
              <Text style={s.priorBadgeText}>Previously saved</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <SectionLabel label="Medications" />
          <View style={s.card}>
            <ToggleRow label="Oral Minoxidil 2.5mg" icon="medical" value={form.oralMinoxidil} onChange={field('oralMinoxidil')} />
            <ToggleRow label="Novegrow 10% Solution" icon="water" value={form.topicalMinoxidil} onChange={field('topicalMinoxidil')} />
            {showDuta && (
              <ToggleRow label="Dutasteride 0.5mg" icon="shield-checkmark" value={form.dutasteride} onChange={field('dutasteride')} />
            )}
            <ToggleRow label="Red Light Comb" icon="flash" value={form.redLightComb} onChange={field('redLightComb')} last />
          </View>
        </View>

        <View style={s.section}>
          <SectionLabel label="Custom Protocol" />
          <View style={s.card}>
            {customProtocols.map((p, i) => (
              <View key={p.id} style={[s.customRow, i < customProtocols.length && s.rowBorder]}>
                {editMode && (
                  <TouchableOpacity onPress={() => handleDelete(p.id)} style={s.deleteBtn} activeOpacity={0.7}>
                    <Text style={s.deleteBtnText}>−</Text>
                  </TouchableOpacity>
                )}
                <View style={s.customRowInner}>
                  <View style={s.rowLeft}>
                    <Text style={s.rowLabel}>{p.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => handleViewGuide(p.name)} style={s.infoBtn} activeOpacity={0.7}>
                      <Text style={s.infoBtnText}>ⓘ</Text>
                    </TouchableOpacity>
                    <View style={s.toggleGroup}>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(false)}
                        style={[s.toggleBtn, customValues[p.id] === false && { backgroundColor: C.red }]}
                      >
                        <Text style={[s.toggleText, { color: customValues[p.id] === false ? '#fff' : C.sub }]}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(true)}
                        style={[s.toggleBtn, customValues[p.id] === true && { backgroundColor: C.green }]}
                      >
                        <Text style={[s.toggleText, { color: customValues[p.id] === true ? '#fff' : C.sub }]}>Yes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setAddSheetVisible(true)}
              style={s.addProtocolRow}
              activeOpacity={0.7}
            >
              <Text style={s.addProtocolText}>+ Add Protocol</Text>
            </TouchableOpacity>
          </View>
        </View>

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

      <AddProtocolSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onAdded={() => { refreshProtocols(); setAddSheetVisible(false); }}
      />

      {viewingGuide && (
        <GuideModal
          name={viewingGuide.name}
          guide={viewingGuide.guide}
          onClose={() => setViewingGuide(null)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 24 },
  dateLabel: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  title: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 40 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1C1C1E' },
  headerBtnActive: { backgroundColor: '#0A1628' },
  headerBtnText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  priorBadge: { alignSelf: 'flex-start', backgroundColor: '#1C3A2A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  priorBadgeText: { fontSize: 11, fontWeight: '600', color: '#30D158' },
  section: { marginBottom: 20 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 12, overflow: 'hidden' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C2C2E' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 56, paddingVertical: 12 },
  customRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 12, minHeight: 56 },
  customRowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  rowIcon: { marginRight: 10 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#FFFFFF', flex: 1 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  toggleText: { fontSize: 14, fontWeight: '600' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  deleteBtnText: { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 20 },
  infoBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { fontSize: 14, color: '#8E8E93' },
  addProtocolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  addProtocolText: { fontSize: 15, fontWeight: '600', color: '#3B82F6' },
  sliderRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sliderValue: { fontSize: 16, fontWeight: '700' },
  slider: { marginHorizontal: -4 },
  notesInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFFFFF', minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});

const gm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },
  loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { fontSize: 14, color: '#8E8E93' },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metaChip: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 10, padding: 10 },
  metaLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 4 },
  metaVal: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 8 },
  body: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  stepBody: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  cautionBox: { backgroundColor: '#2A1A00', borderRadius: 10, padding: 12 },
  cautionText: { fontSize: 13, color: '#FF9F0A', lineHeight: 18 },
  noteBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 8 },
  noteText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 16, fontStyle: 'italic' },
});
