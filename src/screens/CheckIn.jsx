import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Platform, Modal, ActivityIndicator, Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  saveCheckin, loadCheckin, getTodayKey, getCustomProtocols,
  removeCustomProtocol, getProtocolGuide, getStreakCount,
} from '../utils/storage';
import { cancelTodayReminder } from '../services/notifications';
import AddProtocolSheet from '../components/sheets/AddProtocolSheet';
import { Pill, Droplet, Shield, Sun, Check, Cigarette, Moon, Lightning } from '../components/Icon';
import SectionHeader from '../components/SectionHeader';
import { color, type, radius, space } from '../theme/tokens';

// ─── Streak Ring ──────────────────────────────────────────────────────────────

function StreakRing({ streak, max = 90 }) {
  const size = 80;
  const sw = 4;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(streak / max, 1);
  const offset = circ * (1 - pct);
  return (
    <View style={ring.wrap}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r} stroke={color.line2} strokeWidth={sw} fill="none" />
        {streak > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={color.cool} strokeWidth={sw} fill="none"
            strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
            strokeLinecap="round" rotation="-90" origin={`${cx},${cy}`}
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

// ─── Warm gradient button fill ────────────────────────────────────────────────

function WarmGradientFill({ borderRadius = radius.card }) {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color.warmA} />
          <Stop offset="1" stopColor={color.warmB} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={borderRadius} fill="url(#btnGrad)" />
    </Svg>
  );
}

// ─── Med Toggle Row ───────────────────────────────────────────────────────────

const MED_ICONS = {
  oral:     Pill,
  topical:  Droplet,
  duta:     Shield,
  rlc:      Sun,
};

function MedToggle({ iconKey, label, dose, value, onChange, last }) {
  const taken   = value === true;
  const skipped = value === false;
  const IconComp = MED_ICONS[iconKey] || Pill;
  const iconColor = taken ? color.warmA : skipped ? color.red : color.faint;

  return (
    <View style={[mt.row, !last && mt.border, taken && mt.rowTaken, skipped && mt.rowSkipped]}>
      {/* Left accent strip */}
      <View style={[mt.strip, taken && mt.stripWarm, skipped && mt.stripRed]} />

      {/* Icon */}
      <View style={[mt.iconWrap, taken && mt.iconWarm, skipped && mt.iconRed]}>
        <IconComp size={18} color={iconColor} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={[mt.name, taken && { color: color.warmA }, skipped && { color: color.red }]}>{label}</Text>
        <Text style={mt.dose}>{dose}</Text>
      </View>

      {/* Skip / Take */}
      <View style={mt.btns}>
        <TouchableOpacity
          onPress={() => onChange(skipped ? null : false)}
          style={[mt.skipBtn, skipped && mt.skipActive]}
          activeOpacity={0.7}
        >
          <Text style={[mt.skipTxt, { color: skipped ? '#fff' : color.faint }]}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange(taken ? null : true)}
          style={[mt.takeBtn, taken && { overflow: 'hidden' }]}
          activeOpacity={0.7}
        >
          {taken && <WarmGradientFill borderRadius={radius.row} />}
          <Text style={[mt.takeTxt, taken && { color: '#1A1000' }, !taken && { color: color.dim }]}>
            {taken ? '✓ Done' : 'Log'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Cigarette Stepper (damage card — red is intentional here) ────────────────

function CigStepper({ value, onChange }) {
  const numColor = value === 0 ? color.green : color.red;
  return (
    <View style={cig.wrap}>
      <View style={cig.titleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Cigarette size={18} color={color.red} />
          <Text style={cig.title}>Cigarettes</Text>
        </View>
        <Text style={cig.hint}>today · target 0</Text>
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
        <Text style={[cig.num, { color: numColor }]}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(value + 1)} style={cig.btn} activeOpacity={0.7}>
          <Text style={cig.btnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      {value === 0 && <Text style={cig.zeroNote}>Smoke-free today</Text>}
    </View>
  );
}

// ─── Sleep Row ────────────────────────────────────────────────────────────────

function SleepRow({ value, onChange }) {
  const val = value ?? 7;
  const displayColor = val >= 7 ? color.green : val >= 6 ? color.warmA : color.red;
  return (
    <View style={slp.wrap}>
      <View style={slp.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Moon size={18} color={color.cool} />
          <Text style={slp.label}>Sleep</Text>
        </View>
        <Text style={[slp.value, { color: displayColor }]}>{val}<Text style={slp.unit}> h</Text></Text>
      </View>
      <Slider
        minimumValue={3} maximumValue={12} step={0.5}
        value={val} onValueChange={onChange}
        minimumTrackTintColor={color.cool}
        maximumTrackTintColor={color.line2}
        thumbTintColor={Platform.OS === 'android' ? color.cool : '#FFFFFF'}
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
  { value: 1, emoji: '😌', label: 'Calm',    fillColor: color.green },
  { value: 2, emoji: '🙂', label: 'Mild',    fillColor: color.green },
  { value: 3, emoji: '😐', label: 'Moderate',fillColor: color.warmA },
  { value: 4, emoji: '😤', label: 'High',    fillColor: color.warmB },
  { value: 5, emoji: '🤯', label: 'Extreme', fillColor: color.red },
];

function StressRow({ value, onChange }) {
  const safe = value > 5 ? Math.ceil(value / 2) : value;
  return (
    <View style={str.wrap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Lightning size={18} color={color.warmA} />
        <Text style={str.title}>Stress Level</Text>
      </View>
      <View style={str.opts}>
        {STRESS_OPTS.map(opt => {
          const active = safe === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[str.btn, active && { backgroundColor: opt.fillColor + '22', borderColor: opt.fillColor, borderWidth: 1.5 }]}
              activeOpacity={0.75}
            >
              <Text style={str.emoji}>{opt.emoji}</Text>
              <Text style={[str.lbl, { color: active ? opt.fillColor : color.faint }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Shedding Row ─────────────────────────────────────────────────────────────

const SHED_OPTS = [
  { value: 'none',  label: 'None',  fillColor: color.green },
  { value: 'light', label: 'Light', fillColor: color.warmA },
  { value: 'heavy', label: 'Heavy', fillColor: color.red },
];

function ShedRow({ value, onChange }) {
  const norm = value === true ? 'light' : value === false ? 'none' : value;
  return (
    <View style={shed.wrap}>
      <Text style={shed.title}>Shedding noticed</Text>
      <View style={shed.opts}>
        {SHED_OPTS.map(opt => {
          const active = norm === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[shed.btn, active && { backgroundColor: opt.fillColor, borderColor: opt.fillColor }]}
              activeOpacity={0.75}
            >
              <Text style={[shed.txt, { color: active ? (opt.value === 'none' ? '#001A0A' : '#fff') : color.dim }]}>
                {opt.label}
              </Text>
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
              <ActivityIndicator color={color.warmA} />
              <Text style={gm.loadingTxt}>Fetching usage guide…</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={gm.metaRow}>
                {guide.dose   && <View style={gm.chip}><Text style={gm.chipLabel}>DOSE</Text><Text style={gm.chipVal}>{guide.dose}</Text></View>}
                {guide.timing && <View style={gm.chip}><Text style={gm.chipLabel}>TIMING</Text><Text style={gm.chipVal}>{guide.timing}</Text></View>}
              </View>
              {guide.mechanism && <View style={gm.sec}><Text style={gm.secLabel}>HOW IT WORKS</Text><Text style={gm.body}>{guide.mechanism}</Text></View>}
              {guide.evidence  && <View style={gm.sec}><Text style={gm.secLabel}>EVIDENCE</Text><Text style={gm.body}>{guide.evidence}</Text></View>}
              {guide.steps?.length > 0 && (
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
              )}
              {guide.caution && <View style={gm.caution}><Text style={gm.cautionTxt}>⚠ {guide.caution}</Text></View>}
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

  const medCount = [
    form.oralMinoxidil === true,
    form.topicalMinoxidil === true,
    showDuta && form.dutasteride === true,
    form.redLightComb === true,
  ].filter(Boolean).length;
  const medTotal = showDuta ? 4 : 3;

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
    cancelTodayReminder();
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

  const PARTICLE_COLORS = [color.warmA, color.green, color.warmB, color.cool, color.green, color.warmA];

  return (
    <>
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 180 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{dateLabel}</Text>
              <Text style={s.title}>Log today</Text>
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
                  <Text style={[s.hBtnTxt, editMode && { color: color.warmA }]}>{editMode ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAddSheetVisible(true)} style={s.hBtn} activeOpacity={0.7}>
                  <Text style={[s.hBtnTxt, { color: color.warmA, fontSize: 20, lineHeight: 22 }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <StreakRing streak={streak} />
          </View>

          <ProgressDots fields={trackable} />

          {/* Medications */}
          <SectionHeader label="Medications" count={`${medCount}/${medTotal}`} />
          <View style={s.medGroup}>
            <MedToggle iconKey="oral"    label="Oral Minoxidil"    dose="2.5mg · Daily"          value={form.oralMinoxidil}    onChange={field('oralMinoxidil')} />
            <MedToggle iconKey="topical" label="Novegrow Topical"  dose="10% solution · Nightly" value={form.topicalMinoxidil} onChange={field('topicalMinoxidil')} />
            {showDuta && <MedToggle iconKey="duta" label="Dutasteride" dose="0.5mg · Mon & Thu" value={form.dutasteride} onChange={field('dutasteride')} />}
            <MedToggle iconKey="rlc"     label="Red Light Comb"    dose="LLLT · 3× per week"     value={form.redLightComb}     onChange={field('redLightComb')} last />
          </View>
          {!showDuta && (
            <Text style={s.dutaHint}>Dutasteride not scheduled today (Mon + Thu only)</Text>
          )}

          {/* Custom protocols */}
          {customProtocols.length > 0 && (
            <>
              <SectionHeader label="Custom Protocol" />
              <View style={s.medGroup}>
                {customProtocols.map((p, i) => (
                  <View key={p.id} style={[mt.row, i < customProtocols.length - 1 && mt.border]}>
                    <View style={mt.strip} />
                    {editMode && (
                      <TouchableOpacity onPress={() => handleDelete(p.id)} style={s.delBtn} activeOpacity={0.7}>
                        <Text style={s.delTxt}>−</Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={mt.name}>{p.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleViewGuide(p.name)} style={s.infoBtn} activeOpacity={0.7}>
                      <Text style={s.infoTxt}>ⓘ</Text>
                    </TouchableOpacity>
                    <View style={mt.btns}>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(customValues[p.id] === false ? null : false)}
                        style={[mt.skipBtn, customValues[p.id] === false && mt.skipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[mt.skipTxt, { color: customValues[p.id] === false ? '#fff' : color.faint }]}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => customField(p.id)(customValues[p.id] === true ? null : true)}
                        style={[mt.takeBtn, customValues[p.id] === true && { overflow: 'hidden' }]}
                        activeOpacity={0.7}
                      >
                        {customValues[p.id] === true && <WarmGradientFill borderRadius={radius.row} />}
                        <Text style={[mt.takeTxt, customValues[p.id] === true && { color: '#1A1000' }, customValues[p.id] !== true && { color: color.dim }]}>
                          {customValues[p.id] === true ? '✓ Done' : 'Log'}
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

          {/* Lifestyle */}
          <SectionHeader label="Lifestyle" />
          <View style={s.damageCard}>
            <CigStepper value={form.cigarettes} onChange={field('cigarettes')} />
          </View>
          <View style={[s.card, { marginTop: 10 }]}>
            <SleepRow value={form.sleep} onChange={field('sleep')} />
          </View>
          <View style={[s.card, { marginTop: 10 }]}>
            <StressRow value={form.stress} onChange={field('stress')} />
          </View>

          {/* Observations */}
          <SectionHeader label="Observations" />
          <View style={s.card}>
            <ShedRow value={form.sheddingNoticed} onChange={field('sheddingNoticed')} />
          </View>

          {/* Notes */}
          <SectionHeader label="Notes" />
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
              placeholderTextColor={color.faint}
              multiline
              style={s.notes}
            />
          </View>

          {/* Save button */}
          <Animated.View style={[{ marginTop: 28 }, { transform: [{ scale: saveScale }] }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[s.saveBtn, (!canSave && !saved) && s.saveBtnDisabled, saved && s.saveBtnDone]}
              activeOpacity={0.85}
            >
              {(canSave && !saved) && <WarmGradientFill />}
              {saved && (
                <Svg style={StyleSheet.absoluteFill}>
                  <Rect x="0" y="0" width="100%" height="100%" rx={radius.card} fill={color.green} />
                </Svg>
              )}
              <Text style={[s.saveTxt, (!canSave && !saved) && { color: color.faint }]}>
                {saved ? '✓ Saved' : canSave
                  ? 'Save today\'s log'
                  : `${trackable.filter(f => !f.filled).length} required field${trackable.filter(f => !f.filled).length === 1 ? '' : 's'} left`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Burst overlay — pointerEvents none */}
        <View style={s.burstOverlay} pointerEvents="none">
          <Animated.View style={[s.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          {particles.map((p, i) => (
            <Animated.View
              key={i}
              style={[s.particle, {
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
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { ...type.eyebrow, marginBottom: 6 },
  title: { ...type.screenTitle },
  priorBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  priorBadgeTxt: { fontSize: 11, fontWeight: '600', color: color.green },
  headerBtns: { flexDirection: 'row', gap: 6, marginTop: 12 },
  hBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.row, backgroundColor: color.card },
  hBtnActive: { backgroundColor: 'rgba(255,176,32,0.12)' },
  hBtnTxt: { fontSize: 14, fontWeight: '600', color: color.dim },

  medGroup: { borderRadius: radius.card, backgroundColor: color.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  card: { backgroundColor: color.card, borderRadius: radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  damageCard: { backgroundColor: color.card, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,69,58,0.2)' },
  dutaHint: { fontSize: 11, color: color.faint, marginTop: 6, marginLeft: 4 },

  addRow: { marginTop: 12 },
  addTxt: { fontSize: 14, fontWeight: '600', color: color.warmA },

  tagRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  tagChip: { backgroundColor: color.card2, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  tagChipTxt: { fontSize: 12, fontWeight: '600', color: color.dim },
  tagDivider: { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginHorizontal: 16 },
  notes: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: color.txt, minHeight: 80, textAlignVertical: 'top' },

  saveBtn: { height: 54, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  saveBtnDisabled: { backgroundColor: color.card },
  saveBtnDone: {},
  saveTxt: { fontSize: 16, fontWeight: '700', color: '#1A1000', zIndex: 1 },

  burstOverlay: { position: 'absolute', bottom: 120, left: 0, right: 0, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: color.warmA },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },

  delBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.red, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginLeft: 12 },
  delTxt: { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 20 },
  infoBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  infoTxt: { fontSize: 14, color: color.dim },
});

const ring = StyleSheet.create({
  wrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  num: { ...type.statValue, fontSize: 22 },
  label: { ...type.eyebrow, fontSize: 8 },
});

const pd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  item: { alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.line2 },
  dotFilled: { backgroundColor: color.cool },
  dotAll: { backgroundColor: color.green },
  lbl: { fontSize: 9, fontWeight: '600', color: color.faint },
  lblFilled: { color: color.cool },
  allText: { fontSize: 11, fontWeight: '700', color: color.green, marginLeft: 8 },
});

const mt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, paddingVertical: 14, minHeight: 72 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  rowTaken: { backgroundColor: 'rgba(255,176,32,0.06)' },
  rowSkipped: { backgroundColor: 'rgba(255,69,58,0.05)' },
  strip: { width: 3, alignSelf: 'stretch', backgroundColor: color.line, borderRadius: 2, marginRight: 12 },
  stripWarm: { backgroundColor: color.warmA },
  stripRed:  { backgroundColor: color.red },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  iconWarm: { backgroundColor: 'rgba(255,176,32,0.15)', borderColor: 'rgba(255,176,32,0.3)' },
  iconRed:  { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: 'rgba(255,69,58,0.25)' },
  name: { fontSize: 15, fontWeight: '600', color: color.txt, marginBottom: 2 },
  dose: { fontSize: 12, color: color.dim },
  btns: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  skipBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  skipActive: { backgroundColor: color.red },
  skipTxt: { fontSize: 14, fontWeight: '700' },
  takeBtn: { paddingHorizontal: 14, height: 36, borderRadius: radius.row, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  takeTxt: { fontSize: 13, fontWeight: '700', zIndex: 1 },
});

const cig = StyleSheet.create({
  wrap: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', color: color.red },
  hint: { fontSize: 12, color: color.faint },
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  btn: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  btnOff: { opacity: 0.3 },
  btnTxt: { fontSize: 28, fontWeight: '300', color: color.txt, lineHeight: 34 },
  num: { fontSize: 64, fontWeight: '900', lineHeight: 70, letterSpacing: -2, minWidth: 80, textAlign: 'center' },
  zeroNote: { textAlign: 'center', fontSize: 12, color: color.green, fontWeight: '600', marginTop: 8 },
});

const slp = StyleSheet.create({
  wrap: { padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: color.txt },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 14, fontWeight: '500', color: color.dim },
  slider: { marginHorizontal: -4 },
  markers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  marker: { fontSize: 10, color: color.faint, fontWeight: '500' },
});

const str = StyleSheet.create({
  wrap: { padding: 18 },
  title: { fontSize: 16, fontWeight: '600', color: color.txt },
  opts: { flexDirection: 'row', gap: 6 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.row, backgroundColor: color.card2, borderWidth: 1.5, borderColor: 'transparent' },
  emoji: { fontSize: 22, marginBottom: 5 },
  lbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
});

const shed = StyleSheet.create({
  wrap: { padding: 18 },
  title: { fontSize: 16, fontWeight: '600', color: color.txt, marginBottom: 14 },
  opts: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 44, borderRadius: radius.row, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  txt: { fontSize: 14, fontWeight: '700' },
});

const gm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: color.txt, flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, color: color.dim, fontWeight: '600' },
  loading: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingTxt: { fontSize: 14, color: color.dim },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: { flex: 1, backgroundColor: color.card2, borderRadius: 10, padding: 10 },
  chipLabel: { fontSize: 9, fontWeight: '700', color: color.faint, letterSpacing: 0.8, marginBottom: 4 },
  chipVal: { fontSize: 13, fontWeight: '600', color: color.txt },
  sec: { marginBottom: 14 },
  secLabel: { fontSize: 9, fontWeight: '700', color: color.faint, letterSpacing: 0.8, marginBottom: 8 },
  body: { fontSize: 14, color: color.txt, lineHeight: 20 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  stepTitle: { fontSize: 13, fontWeight: '700', color: color.txt, marginBottom: 2 },
  stepBody: { fontSize: 12, color: color.dim, lineHeight: 17 },
  caution: { backgroundColor: 'rgba(255,176,32,0.1)', borderRadius: 10, padding: 12, marginBottom: 8 },
  cautionTxt: { fontSize: 13, color: color.warmA, lineHeight: 18 },
});
