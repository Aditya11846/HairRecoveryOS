import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Platform, Modal, ActivityIndicator, Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  saveCheckin, loadCheckin, getTodayKey, getCustomProtocols,
  removeCustomProtocol, getProtocolGuide, getStreakCount,
} from '../utils/storage';
import AddProtocolSheet from '../components/sheets/AddProtocolSheet';
import { C } from '../theme';

// ─── Streak Ring ──────────────────────────────────────────────────────────────

function StreakRing({ streak, max = 90 }) {
  const size = 88;
  const sw = 5;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(streak / max, 1);
  const offset = circ * (1 - pct);
  const color = streak >= 60 ? C.orange : C.accent;

  return (
    <View style={ring.wrap}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
        {streak > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={sw} fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx},${cy}`}
          />
        )}
      </Svg>
      <Text style={ring.num}>{streak}</Text>
      <Text style={ring.label}>DAYS</Text>
    </View>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ fields }) {
  const all = fields.every(f => f.filled);
  return (
    <View style={pd.row}>
      {fields.map((f, i) => (
        <View key={i} style={pd.item}>
          <View style={[pd.dot, f.filled && pd.dotFilled, all && pd.dotAll]} />
          <Text style={[pd.lbl, f.filled && pd.lblFilled]}>{f.label}</Text>
        </View>
      ))}
      {all && <Text style={pd.allText}>All logged ✓</Text>}
    </View>
  );
}

// ─── Medication Card ──────────────────────────────────────────────────────────

function MedCard({ icon, label, dose, value, onChange, last = false }) {
  const taken = value === true;
  const skipped = value === false;
  return (
    <View style={[mc.card, taken && mc.cardTaken, skipped && mc.cardSkipped, !last && mc.cardBorder]}>
      <View style={[mc.bar, taken && mc.barTaken, skipped && mc.barSkipped]} />
      <View style={[mc.iconWrap, taken && mc.iconGreen, skipped && mc.iconRed]}>
        <Text style={mc.icon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={mc.name}>{label}</Text>
        <Text style={mc.dose}>{dose}</Text>
      </View>
      <View style={mc.btns}>
        <TouchableOpacity
          onPress={() => onChange(skipped ? null : false)}
          style={[mc.skipBtn, skipped && mc.skipActive]}
          activeOpacity={0.7}
        >
          <Text style={[mc.skipTxt, { color: skipped ? '#fff' : C.sub }]}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange(taken ? null : true)}
          style={[mc.takeBtn, taken && mc.takeActive]}
          activeOpacity={0.7}
        >
          <Text style={[mc.takeTxt, { color: taken ? '#fff' : C.sub }]}>
            {taken ? '✓ Taken' : 'Take'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Cigarette Stepper ────────────────────────────────────────────────────────

function CigStepper({ value, onChange }) {
  const color = value === 0 ? C.green : value >= 10 ? C.red : value >= 5 ? C.orange : '#fff';
  return (
    <View style={cig.wrap}>
      <View style={cig.titleRow}>
        <Text style={cig.title}>🚬 Cigarettes</Text>
        <Text style={cig.hint}>today</Text>
      </View>
      <View style={cig.control}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(0, value - 1))}
          style={[cig.btn, value === 0 && cig.btnOff]}
          disabled={value === 0}
          activeOpacity={0.7}
        >
          <Text style={cig.btnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={[cig.num, { color }]}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(value + 1)} style={cig.btn} activeOpacity={0.7}>
          <Text style={cig.btnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      {value === 0 && <Text style={cig.zeroNote}>Smoke-free today 🎉</Text>}
    </View>
  );
}

// ─── Sleep Row ────────────────────────────────────────────────────────────────

function SleepArc({ value }) {
  const size = 52;
  const sw = 4;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min((value - 3) / (12 - 3), 1));
  const offset = circ * (1 - pct);
  const color = value >= 7 ? C.green : value >= 6 ? C.orange : C.red;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
          strokeLinecap="round" rotation="-90" origin={`${cx},${cy}`}
        />
      </Svg>
      <Text style={{ fontSize: 13, fontWeight: '900', color }}>{value}</Text>
    </View>
  );
}

function SleepRow({ value, onChange }) {
  const color = value >= 7 ? C.green : value >= 6 ? C.orange : C.red;
  return (
    <View style={slp.wrap}>
      <View style={slp.header}>
        <Text style={slp.label}>Sleep</Text>
        <View style={slp.rightSide}>
          <SleepArc value={value} />
          <Text style={[slp.unit, { color }]}>hrs</Text>
        </View>
      </View>
      <Slider
        minimumValue={3} maximumValue={12} step={0.5}
        value={value} onValueChange={onChange}
        minimumTrackTintColor={color}
        maximumTrackTintColor="#2C2C2E"
        thumbTintColor={Platform.OS === 'android' ? color : '#FFFFFF'}
        style={slp.slider}
      />
      <View style={slp.markers}>
        {['3h', '5h', '7h', '9h', '12h'].map(h => (
          <Text key={h} style={slp.marker}>{h}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Stress Row ───────────────────────────────────────────────────────────────

const STRESS_OPTS = [
  { value: 1, emoji: '😌', label: 'Calm', color: '#30D158' },
  { value: 2, emoji: '🙂', label: 'Mild', color: '#30D158' },
  { value: 3, emoji: '😐', label: 'Moderate', color: '#FF9F0A' },
  { value: 4, emoji: '😤', label: 'High', color: '#FF6B35' },
  { value: 5, emoji: '🤯', label: 'Extreme', color: '#FF453A' },
];

function StressRow({ value, onChange }) {
  const safe = value > 5 ? Math.ceil(value / 2) : value;
  return (
    <View style={str.wrap}>
      <Text style={str.title}>Stress Level</Text>
      <View style={str.opts}>
        {STRESS_OPTS.map(opt => {
          const active = safe === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[str.btn, active && { backgroundColor: opt.color + '22', borderColor: opt.color, borderWidth: 1.5 }]}
              activeOpacity={0.75}
            >
              <View style={[str.emojiWrap, active && { transform: [{ scale: 1.18 }] }]}>
                <Text style={str.emoji}>{opt.emoji}</Text>
              </View>
              <Text style={[str.lbl, { color: active ? opt.color : C.sub }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Shedding Row ─────────────────────────────────────────────────────────────

const SHED_OPTS = [
  { value: 'none', label: 'None', color: C.green },
  { value: 'light', label: 'Light', color: C.orange },
  { value: 'heavy', label: 'Heavy', color: C.red },
];

function ShedRow({ value, onChange }) {
  const norm = value === true ? 'light' : value === false ? 'none' : value;
  return (
    <View style={shed.wrap}>
      <Text style={shed.title}>Shedding Noticed</Text>
      <View style={shed.opts}>
        {SHED_OPTS.map(opt => {
          const active = norm === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[shed.btn, active && { backgroundColor: opt.color, borderColor: opt.color }]}
              activeOpacity={0.75}
            >
              <Text style={[shed.txt, { color: active ? '#fff' : C.sub }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Guide Modal ──────────────────────────────────────────────────────────────

function GuideModal({ guide, name, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={gm.overlay}>
        <View style={[gm.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={gm.header}>
            <Text style={gm.title}>{name}</Text>
            <TouchableOpacity onPress={onClose} style={gm.closeBtn} activeOpacity={0.7}>
              <Text style={gm.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          {!guide ? (
            <View style={gm.loading}>
              <ActivityIndicator color={C.accent} />
              <Text style={gm.loadingTxt}>Fetching usage guide…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={gm.metaRow}>
                {guide.dose ? <View style={gm.chip}><Text style={gm.chipLabel}>DOSE</Text><Text style={gm.chipVal}>{guide.dose}</Text></View> : null}
                {guide.timing ? <View style={gm.chip}><Text style={gm.chipLabel}>TIMING</Text><Text style={gm.chipVal}>{guide.timing}</Text></View> : null}
              </View>
              {guide.mechanism ? <View style={gm.sec}><Text style={gm.secLabel}>HOW IT WORKS</Text><Text style={gm.body}>{guide.mechanism}</Text></View> : null}
              {guide.evidence ? <View style={gm.sec}><Text style={gm.secLabel}>EVIDENCE</Text><Text style={gm.body}>{guide.evidence}</Text></View> : null}
              {guide.steps?.length > 0 ? (
                <View style={gm.sec}>
                  <Text style={gm.secLabel}>HOW TO USE</Text>
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
              {guide.caution ? <View style={gm.caution}><Text style={gm.cautionTxt}>⚠ {guide.caution}</Text></View> : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_TAGS = ['Side effect', 'Missed window', 'Scalp irritation', 'Extra tired', 'Feeling good', 'No issues'];

const DEFAULT = {
  oralMinoxidil: null, topicalMinoxidil: null, dutasteride: null,
  cigarettes: 0, sleep: 7, stress: 3, redLightComb: null,
  sheddingNoticed: null, notes: '',
};

const isDutaDay = (d = new Date()) => d.getDay() === 1 || d.getDay() === 4;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CheckIn() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [hadPrior, setHadPrior] = useState(false);
  const [streak, setStreak] = useState(0);
  const [customProtocols, setCustomProtocols] = useState([]);
  const [customValues, setCustomValues] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [viewingGuide, setViewingGuide] = useState(null);

  // Save burst animation
  const saveScale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      angle: (i * 60) * (Math.PI / 180),
    }))
  ).current;

  const today = getTodayKey();
  const showDuta = isDutaDay();
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    Promise.all([loadCheckin(today), getStreakCount()]).then(([existing, str]) => {
      if (existing) {
        setForm(existing);
        setHadPrior(true);
        if (existing.customValues) setCustomValues(existing.customValues);
      }
      setStreak(str);
    }).catch(() => {});
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      getCustomProtocols().then(p => setCustomProtocols(p.filter(x => x.active)));
      getStreakCount().then(setStreak);
    }, [])
  );

  const refreshProtocols = () =>
    getCustomProtocols().then(p => setCustomProtocols(p.filter(x => x.active)));

  const field = key => val => { setForm(f => ({ ...f, [key]: val })); setSaved(false); };
  const customField = id => val => { setCustomValues(v => ({ ...v, [id]: val })); setSaved(false); };

  const triggerBurst = () => {
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, friction: 3, tension: 300, useNativeDriver: true }),
    ]).start();

    ringScale.setValue(0.2);
    ringOpacity.setValue(0.9);
    Animated.parallel([
      Animated.timing(ringScale, { toValue: 3, duration: 650, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]).start();

    const D = 64;
    particles.forEach(p => {
      p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(1);
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(p.angle) * D, duration: 520, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(p.angle) * D, duration: 520, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSave = async () => {
    await saveCheckin({ ...form, customValues });
    setSaved(true);
    triggerBurst();
    setHadPrior(true);
    getStreakCount().then(setStreak);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = async id => {
    await removeCustomProtocol(id);
    refreshProtocols();
  };

  const handleViewGuide = async name => {
    setViewingGuide({ name, guide: null });
    const guide = await getProtocolGuide(name);
    setViewingGuide({ name, guide });
  };

  const appendTag = tag => {
    const cur = form.notes;
    field('notes')(cur + (cur.trim() ? ' · ' : '') + tag);
  };

  const trackable = [
    { filled: form.oralMinoxidil !== null, label: 'Oral' },
    { filled: form.topicalMinoxidil !== null, label: 'Topical' },
    ...(showDuta ? [{ filled: form.dutasteride !== null, label: 'Duta' }] : []),
    { filled: form.redLightComb !== null, label: 'RLC' },
    { filled: form.sheddingNoticed !== null, label: 'Shed' },
  ];

  const canSave = form.oralMinoxidil !== null && form.topicalMinoxidil !== null &&
    (!showDuta || form.dutasteride !== null);

  const PARTICLE_COLORS = [C.accent, C.green, C.orange, C.accent, C.green, C.orange];

  return (
    <>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 180 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateLabel}>{dateLabel}</Text>
              <Text style={s.title}>Daily Log</Text>
              {hadPrior && !saved && (
                <View style={s.priorBadge}>
                  <Text style={s.priorBadgeTxt}>Previously saved</Text>
                </View>
              )}
              <View style={s.headerBtns}>
                <TouchableOpacity
                  onPress={() => setEditMode(e => !e)}
                  style={[s.hBtn, editMode && s.hBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.hBtnTxt, editMode && { color: C.accent }]}>{editMode ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAddSheetVisible(true)} style={s.hBtn} activeOpacity={0.7}>
                  <Text style={[s.hBtnTxt, { color: C.accent, fontSize: 20, lineHeight: 22 }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <StreakRing streak={streak} />
          </View>

          {/* ── Progress Dots ── */}
          <ProgressDots fields={trackable} />

          {/* ── Medications ── */}
          <Text style={s.sectionLabel}>MEDICATIONS</Text>
          <View style={s.medGroup}>
            <MedCard icon="💊" label="Oral Minoxidil" dose="2.5mg · Daily" value={form.oralMinoxidil} onChange={field('oralMinoxidil')} />
            <MedCard icon="💧" label="Novegrow Topical" dose="10% solution · Nightly" value={form.topicalMinoxidil} onChange={field('topicalMinoxidil')} />
            {showDuta && <MedCard icon="🛡️" label="Dutasteride" dose="0.5mg · Mon & Thu" value={form.dutasteride} onChange={field('dutasteride')} />}
            <MedCard icon="🔴" label="Red Light Comb" dose="LLLT · 3× per week" value={form.redLightComb} onChange={field('redLightComb')} last />
          </View>
          {!showDuta && (
            <Text style={s.dutaHint}>Dutasteride not scheduled today (Mon + Thu only)</Text>
          )}

          {/* ── Custom Protocol ── */}
          {customProtocols.length > 0 && (
            <>
              <Text style={s.sectionLabel}>CUSTOM PROTOCOL</Text>
              <View style={s.medGroup}>
                {customProtocols.map((p, i) => (
                  <View key={p.id} style={[mc.card, i < customProtocols.length - 1 && mc.cardBorder]}>
                    <View style={mc.bar} />
                    {editMode && (
                      <TouchableOpacity onPress={() => handleDelete(p.id)} style={mc.delBtn} activeOpacity={0.7}>
                        <Text style={mc.delTxt}>−</Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={mc.name}>{p.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleViewGuide(p.name)} style={mc.infoBtn} activeOpacity={0.7}>
                      <Text style={mc.infoTxt}>ⓘ</Text>
                    </TouchableOpacity>
                    <View style={mc.btns}>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(customValues[p.id] === false ? null : false)}
                        style={[mc.skipBtn, customValues[p.id] === false && mc.skipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[mc.skipTxt, { color: customValues[p.id] === false ? '#fff' : C.sub }]}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(customValues[p.id] === true ? null : true)}
                        style={[mc.takeBtn, customValues[p.id] === true && mc.takeActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[mc.takeTxt, { color: customValues[p.id] === true ? '#fff' : C.sub }]}>
                          {customValues[p.id] === true ? '✓ Taken' : 'Take'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
          <TouchableOpacity onPress={() => setAddSheetVisible(true)} style={s.addRow} activeOpacity={0.7}>
            <Text style={s.addTxt}>+ Add Protocol</Text>
          </TouchableOpacity>

          {/* ── Lifestyle ── */}
          <Text style={s.sectionLabel}>LIFESTYLE</Text>
          <View style={s.card}>
            <CigStepper value={form.cigarettes} onChange={field('cigarettes')} />
          </View>
          <View style={[s.card, { marginTop: 10 }]}>
            <SleepRow value={form.sleep} onChange={field('sleep')} />
          </View>
          <View style={[s.card, { marginTop: 10 }]}>
            <StressRow value={form.stress} onChange={field('stress')} />
          </View>

          {/* ── Observations ── */}
          <Text style={s.sectionLabel}>OBSERVATIONS</Text>
          <View style={s.card}>
            <ShedRow value={form.sheddingNoticed} onChange={field('sheddingNoticed')} />
          </View>

          {/* ── Notes ── */}
          <Text style={s.sectionLabel}>NOTES</Text>
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagRow}>
              {QUICK_TAGS.map(tag => (
                <TouchableOpacity key={tag} onPress={() => appendTag(tag)} style={s.tagChip} activeOpacity={0.7}>
                  <Text style={s.tagChipTxt}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.tagDivider} />
            <TextInput
              value={form.notes}
              onChangeText={field('notes')}
              placeholder="Anything unusual, side effects, observations..."
              placeholderTextColor={C.sub}
              multiline
              style={s.notes}
            />
          </View>

          {/* ── Save Button (in scroll) ── */}
          <Animated.View style={[{ marginTop: 24 }, { transform: [{ scale: saveScale }] }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[fbt.btn, {
                backgroundColor: saved ? C.green : canSave ? C.accent : '#2C2C2E',
                shadowColor: saved ? C.green : canSave ? C.accent : 'transparent',
              }]}
              activeOpacity={0.85}
            >
              <Text style={[fbt.btnTxt, { color: canSave || saved ? '#fff' : C.sub }]}>
                {saved ? '✓ Saved' : canSave
                  ? 'Save Check-in'
                  : `${trackable.filter(f => !f.filled).length} required fields left`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* ── Burst animation overlay (pointerEvents none — never blocks scroll) ── */}
        <View style={fbt.burstOverlay} pointerEvents="none">
          <Animated.View
            style={[fbt.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
          />
          {particles.map((p, i) => (
            <Animated.View
              key={i}
              style={[fbt.particle, {
                backgroundColor: PARTICLE_COLORS[i],
                transform: [{ translateX: p.x }, { translateY: p.y }],
                opacity: p.opacity,
              }]}
            />
          ))}
        </View>

      </View>

      <AddProtocolSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onAdded={() => { refreshProtocols(); setAddSheetVisible(false); }}
      />

      {viewingGuide && (
        <GuideModal name={viewingGuide.name} guide={viewingGuide.guide} onClose={() => setViewingGuide(null)} />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  dateLabel: { fontSize: 13, fontWeight: '500', color: C.sub, marginBottom: 2 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 42 },
  priorBadge: { alignSelf: 'flex-start', backgroundColor: '#1C3A2A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  priorBadgeTxt: { fontSize: 11, fontWeight: '600', color: C.green },
  headerBtns: { flexDirection: 'row', gap: 6, marginTop: 10 },
  hBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, backgroundColor: '#1C1C1E' },
  hBtnActive: { backgroundColor: '#0A1628' },
  hBtnTxt: { fontSize: 14, fontWeight: '600', color: C.sub },

  // Section labels
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginTop: 24, marginBottom: 10, marginLeft: 2 },

  // Med group / generic card
  medGroup: { borderRadius: 16, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, overflow: 'hidden' },
  dutaHint: { fontSize: 11, color: C.sub, marginTop: 6, marginLeft: 4 },

  // Add protocol
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  addTxt: { fontSize: 14, fontWeight: '600', color: C.accent },

  // Quick tags
  tagRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  tagChip: { backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  tagChipTxt: { fontSize: 12, fontWeight: '600', color: C.sub },
  tagDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2C2C2E', marginHorizontal: 16 },
  notes: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#fff', minHeight: 80, textAlignVertical: 'top' },
});

// Streak ring
const ring = StyleSheet.create({
  wrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  num: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 28 },
  label: { fontSize: 8, fontWeight: '700', color: C.sub, letterSpacing: 1.2 },
});

// Progress dots
const pd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  item: { alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2C2C2E' },
  dotFilled: { backgroundColor: C.accent },
  dotAll: { backgroundColor: C.green },
  lbl: { fontSize: 9, fontWeight: '600', color: C.sub },
  lblFilled: { color: C.accent },
  allText: { fontSize: 11, fontWeight: '700', color: C.green, marginLeft: 8 },
});

// Med card
const mc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, paddingVertical: 14, minHeight: 72, backgroundColor: 'transparent' },
  cardBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2C2C2E' },
  cardTaken: { backgroundColor: 'rgba(48,209,88,0.06)' },
  cardSkipped: { backgroundColor: 'rgba(255,69,58,0.06)' },
  bar: { width: 3, alignSelf: 'stretch', backgroundColor: '#2C2C2E', borderRadius: 2, marginRight: 12 },
  barTaken: { backgroundColor: C.green },
  barSkipped: { backgroundColor: C.red },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconGreen: { backgroundColor: 'rgba(48,209,88,0.18)' },
  iconRed: { backgroundColor: 'rgba(255,69,58,0.18)' },
  icon: { fontSize: 20 },
  name: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  dose: { fontSize: 12, color: C.sub },
  btns: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  skipBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  skipActive: { backgroundColor: C.red },
  skipTxt: { fontSize: 14, fontWeight: '700' },
  takeBtn: { paddingHorizontal: 14, height: 36, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  takeActive: { backgroundColor: C.green },
  takeTxt: { fontSize: 13, fontWeight: '700' },
  delBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginLeft: 12 },
  delTxt: { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 20 },
  infoBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  infoTxt: { fontSize: 14, color: C.sub },
});

// Cigarette stepper
const cig = StyleSheet.create({
  wrap: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff' },
  hint: { fontSize: 12, color: C.sub },
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  btn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  btnOff: { opacity: 0.3 },
  btnTxt: { fontSize: 28, fontWeight: '300', color: '#fff', lineHeight: 34 },
  num: { fontSize: 64, fontWeight: '900', lineHeight: 70, letterSpacing: -2, minWidth: 80, textAlign: 'center' },
  zeroNote: { textAlign: 'center', fontSize: 12, color: C.green, fontWeight: '600', marginTop: 8 },
});

// Sleep
const slp = StyleSheet.create({
  wrap: { padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#fff' },
  rightSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: { fontSize: 13, fontWeight: '700' },
  slider: { marginHorizontal: -4 },
  markers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  marker: { fontSize: 10, color: C.sub, fontWeight: '500' },
});

// Stress
const str = StyleSheet.create({
  wrap: { padding: 18 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 14 },
  opts: { flexDirection: 'row', gap: 6 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#2C2C2E', borderWidth: 1.5, borderColor: 'transparent' },
  emojiWrap: { marginBottom: 5 },
  emoji: { fontSize: 22 },
  lbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
});

// Shedding
const shed = StyleSheet.create({
  wrap: { padding: 18 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 14 },
  opts: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  txt: { fontSize: 14, fontWeight: '700' },
});

// Floating button
const fbt = StyleSheet.create({
  // Full-screen overlay just for the burst animation — never captures touches
  burstOverlay: {
    position: 'absolute', bottom: 120, left: 0, right: 0,
    height: 200, alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: C.green,
  },
  particle: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
  },
  btn: {
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnTxt: { fontSize: 16, fontWeight: '700' },
});

// Guide modal
const gm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, color: C.sub, fontWeight: '600' },
  loading: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingTxt: { fontSize: 14, color: C.sub },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 10, padding: 10 },
  chipLabel: { fontSize: 9, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginBottom: 4 },
  chipVal: { fontSize: 13, fontWeight: '600', color: '#fff' },
  sec: { marginBottom: 14 },
  secLabel: { fontSize: 9, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginBottom: 8 },
  body: { fontSize: 14, color: '#fff', lineHeight: 20 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  stepBody: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  caution: { backgroundColor: '#2A1A00', borderRadius: 10, padding: 12, marginBottom: 8 },
  cautionTxt: { fontSize: 13, color: '#FF9F0A', lineHeight: 18 },
});
