import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, useWindowDimensions,
  Modal, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { getLast30Days, getLastNDays, getStreakCount, get, set, getTodayKey, saveCheckin, getScalpPhotos, getScalpPhotoSignedUrl } from '../utils/storage';
import { TIMELINE, PHASE1_OBJECTIVES } from '../constants/timeline';
import AreaChart from '../components/AreaChart';
import Sparkline from '../components/Sparkline';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import Heatmap, { HeatmapKey } from '../components/Heatmap';
import { Flask } from '../components/Icon';
import { color, type, radius, space } from '../theme/tokens';

const OBJ_ACCENTS = [color.warmA, color.cool, color.copper, color.warmB, color.amber, color.purple];

const PHASE_START = new Date('2026-06-01');
const PHASE_END   = new Date('2026-09-01');
const PHASE_TOTAL_DAYS = Math.floor((PHASE_END - PHASE_START) / 86400000);

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Phase Ring ────────────────────────────────────────────────────────────────

function PhaseRing({ pct }) {
  const size = 100;
  const sw   = 7;
  const r    = (size - sw * 2) / 2;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const p    = Math.min(pct, 100) / 100;
  const offset = circ * (1 - p);

  return (
    <View style={pr.wrap}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={color.line2} strokeWidth={sw} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={color.amber} strokeWidth={sw} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
          strokeLinecap="round" rotation="-90" origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={pr.center}>
        <Text style={pr.num}>{pct}%</Text>
        <Text style={pr.label}>COMPLETE</Text>
      </View>
    </View>
  );
}

const pr = StyleSheet.create({
  wrap:  {
    width: 100, height: 100, alignItems: 'center', justifyContent: 'center',
    shadowColor: color.amber, shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, shadowOpacity: 0.65,
  },
  center:{ position: 'absolute', alignItems: 'center' },
  num:   { ...type.statValue, fontSize: 23, color: color.amber },
  label: { ...type.eyebrow, fontSize: 8, marginTop: 3 },
});

// ── Phase Timeline ────────────────────────────────────────────────────────────

function PhaseTimeline() {
  const today = new Date();
  const elapsed = Math.max(0, Math.min(today - PHASE_START, PHASE_END - PHASE_START));
  const daysIn   = Math.floor(elapsed / 86400000);
  const daysLeft = Math.max(0, PHASE_TOTAL_DAYS - daysIn);
  const pct = Math.round((daysIn / PHASE_TOTAL_DAYS) * 100);

  return (
    <View style={pt.card}>
      <View style={pt.topRow}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={pt.title}>Phase 1 Journey</Text>
          <Text style={pt.sub}>Jun 1 → Sep 1, 2026</Text>
        </View>
        <PhaseRing pct={pct} />
      </View>

      {/* Plain progress bar (not a slider) */}
      <View style={pt.trackWrap}>
        <View style={pt.track}>
          <View style={[pt.fill, { width: `${Math.min(pct, 100)}%` }]} />
          {[30, 60, PHASE_TOTAL_DAYS].map(d => {
            const mp = Math.round((d / PHASE_TOTAL_DAYS) * 100);
            return (
              <View key={d} style={[pt.mDot, { left: `${mp}%` }]}>
                <View style={[pt.mDotInner, daysIn >= d && pt.mDotPassed]} />
              </View>
            );
          })}
          <View style={[pt.todayPin, { left: `${Math.min(pct, 99)}%` }]}>
            <View style={pt.todayDot} />
          </View>
        </View>
        <View style={pt.mLabels}>
          {[{ d: 30, lbl: '30d' }, { d: 60, lbl: '60d' }, { d: PHASE_TOTAL_DAYS, lbl: "Sep '26", last: true }].map(({ d, lbl, last }) => (
            <Text
              key={d}
              style={[pt.mLabel, last ? pt.mLabelLast : { left: `${Math.round((d / PHASE_TOTAL_DAYS) * 100)}%`, marginLeft: -10 }]}
            >{lbl}</Text>
          ))}
        </View>
      </View>

      <View style={pt.stats}>
        {[
          { num: daysIn, lbl: 'days in', color: color.warmA },
          { num: daysLeft, lbl: 'days left', color: color.cool },
          { num: PHASE_TOTAL_DAYS, lbl: 'total', color: color.faint },
        ].map(({ num, lbl, color: c }, i) => (
          <React.Fragment key={lbl}>
            {i > 0 && <View style={pt.statDiv} />}
            <View style={pt.statItem}>
              <Text style={[pt.statNum, { color: c }]}>{num}</Text>
              <Text style={pt.statLbl}>{lbl}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Day Modal ─────────────────────────────────────────────────────────────────

const DAY_DEFAULT = { oralMinoxidil: null, topicalMinoxidil: null, redLightComb: null, dutasteride: null, cigarettes: 0, sleep: 7, stress: 3, notes: '' };

function DayModal({ day, visible, onClose, onSaved }) {
  const [form, setForm] = useState(DAY_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(day?.data ? { ...DAY_DEFAULT, ...day.data } : DAY_DEFAULT);
  }, [visible, day?.date]);

  if (!day) return null;
  const dateLabel = day.date
    ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '—';
  const check = val => val === true ? '✓' : val === false ? '✗' : '—';
  const checkColor = val => val === true ? color.green : val === false ? color.red : color.faint;
  const cycle = key => () => setForm(f => ({ ...f, [key]: f[key] === null ? true : f[key] === true ? false : null }));
  const step = (key, delta, min, max) => () => setForm(f => ({ ...f, [key]: Math.max(min, Math.min(max, +(f[key] + delta).toFixed(1))) }));

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveCheckin(form, day.date);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={dm.overlay} onPress={onClose}>
        <Pressable style={dm.card} onPress={e => e.stopPropagation()}>
          <Text style={dm.date}>{dateLabel}</Text>
          {!day.hasCheckin && <Text style={dm.hint}>No check-in recorded — fill this in to backfill</Text>}

          <View style={dm.grid}>
            {[
              { label: 'Oral Minoxidil', key: 'oralMinoxidil' },
              { label: 'Novegrow Topical', key: 'topicalMinoxidil' },
              { label: 'Red Light Comb', key: 'redLightComb' },
              { label: 'Dutasteride', key: 'dutasteride' },
            ].map(({ label, key }) => (
              <View key={key} style={dm.row}>
                <Text style={dm.rowLabel}>{label}</Text>
                <TouchableOpacity onPress={cycle(key)} style={dm.chip} activeOpacity={0.7}>
                  <Text style={[dm.rowVal, { color: checkColor(form[key]) }]}>{check(form[key])}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={dm.div} />

          <View style={dm.grid}>
            <View style={dm.row}>
              <Text style={dm.rowLabel}>Cigarettes</Text>
              <View style={dm.stepper}>
                <TouchableOpacity onPress={step('cigarettes', -1, 0, 60)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>−</Text></TouchableOpacity>
                <Text style={[dm.rowVal, dm.stepVal, { color: form.cigarettes === 0 ? color.green : color.red }]}>{form.cigarettes}</Text>
                <TouchableOpacity onPress={step('cigarettes', 1, 0, 60)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>+</Text></TouchableOpacity>
              </View>
            </View>
            <View style={dm.row}>
              <Text style={dm.rowLabel}>Sleep</Text>
              <View style={dm.stepper}>
                <TouchableOpacity onPress={step('sleep', -0.5, 0, 14)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>−</Text></TouchableOpacity>
                <Text style={[dm.rowVal, dm.stepVal, { color: form.sleep >= 7 ? color.green : color.warmA }]}>{form.sleep}h</Text>
                <TouchableOpacity onPress={step('sleep', 0.5, 0, 14)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>+</Text></TouchableOpacity>
              </View>
            </View>
            <View style={dm.row}>
              <Text style={dm.rowLabel}>Stress</Text>
              <View style={dm.stepper}>
                <TouchableOpacity onPress={step('stress', -1, 1, 5)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>−</Text></TouchableOpacity>
                <Text style={[dm.rowVal, dm.stepVal]}>{form.stress}/5</Text>
                <TouchableOpacity onPress={step('stress', 1, 1, 5)} style={dm.stepBtn} activeOpacity={0.7}><Text style={dm.stepTxt}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={dm.div} />
          <TextInput
            value={form.notes}
            onChangeText={t => setForm(f => ({ ...f, notes: t }))}
            placeholder="Notes..."
            placeholderTextColor={color.faint}
            multiline
            selectionColor={color.warmA}
            style={dm.notesInput}
          />

          <View style={dm.footer}>
            <TouchableOpacity onPress={onClose} style={dm.cancelBtn} activeOpacity={0.8}>
              <Text style={dm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={dm.saveBtn} activeOpacity={0.8}>
              <Text style={dm.saveTxt}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Convert raw day records → Heatmap cells flat array ────────────────────────

function buildCells(heatmapDays, todayStr, weeks = 12) {
  const total = weeks * 7;
  const today = new Date(todayStr + 'T00:00:00');
  // Map date string → day record
  const byDate = {};
  heatmapDays.forEach(d => { byDate[d.date] = d; });

  return Array.from({ length: total }, (_, idx) => {
    const wi = Math.floor(idx / 7);
    const di = idx % 7; // 0=Sun
    // Earliest week is wi=0. Last slot (wi=weeks-1, di=today.getDay()) is today.
    const daysFromToday = (weeks - 1 - wi) * 7 + (today.getDay() - di);
    const cellDate = new Date(today);
    cellDate.setDate(today.getDate() - daysFromToday);
    if (cellDate > today) return { intensity: 0 };
    const yr = cellDate.getFullYear(), mo = String(cellDate.getMonth()+1).padStart(2,'0'), dy = String(cellDate.getDate()).padStart(2,'0');
    const dateStr = `${yr}-${mo}-${dy}`;
    const record = byDate[dateStr];
    if (!record || !record.hasCheckin) {
      // Past date with no check-in = miss (damage)
      return { intensity: 0, miss: cellDate < today, date: dateStr, hasCheckin: false };
    }
    const d = record.data;
    const oral    = d?.oralMinoxidil === true;
    const topical = d?.topicalMinoxidil === true;
    const rlc     = d?.redLightComb === true;
    const duta    = d?.dutasteride === true;
    let intensity = 0;
    if (oral && topical && rlc)       intensity = 3;
    else if (oral && topical)         intensity = 2;
    else if (oral || topical)         intensity = 1;
    return { intensity, date: dateStr, hasCheckin: true, data: d };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Progress({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [days, setDays]             = useState([]);
  const [heatmapDays, setHeatmapDays] = useState([]);
  const [streak, setStreak]         = useState(0);
  const [phase1, setPhase1]         = useState({});
  const [bloodworkData, setBloodworkData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [latestScalpPhoto, setLatestScalpPhoto] = useState(null);
  const [latestScalpPhotoUrl, setLatestScalpPhotoUrl] = useState(null);
  const latestScalpPhotoUrlPath = useRef(null);
  const todayStr = getTodayKey();

  const loadAll = useCallback(() => {
    return Promise.all([
      getLast30Days(),
      getLastNDays(84),
      getStreakCount(),
      get('phase1', {}),
      get('bloodwork', null),
      getScalpPhotos(),
    ]).then(([d, hd, str, ph, bw, scalpPhotos]) => {
      setDays(d);
      setHeatmapDays(hd);
      setStreak(str);
      const derivedPh = str >= 30 ? { ...ph, streak30: true } : ph;
      if (str >= 30 && !ph.streak30) set('phase1', derivedPh);
      setPhase1(derivedPh);
      setBloodworkData(bw);

      const latest = scalpPhotos.length ? scalpPhotos[scalpPhotos.length - 1] : null;
      setLatestScalpPhoto(latest);
      if (latest?.storage_path && latestScalpPhotoUrlPath.current !== latest.storage_path) {
        latestScalpPhotoUrlPath.current = latest.storage_path;
        getScalpPhotoSignedUrl(latest.storage_path).then(setLatestScalpPhotoUrl);
      }
    }).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const togglePhase1 = async id => {
    const next = { ...phase1, [id]: !phase1[id] };
    setPhase1(next);
    await set('phase1', next);
  };

  // Cigarette data for AreaChart (last 30 days, newest last) — only days actually
  // logged, so unlogged gaps don't show up as misleading "0 cigarettes" flatline
  const loggedDays  = days.filter(d => d.hasCheckin);
  const cigValues   = loggedDays.map(d => d.data?.cigarettes ?? 0);
  const sleepValues = days.map(d => d.data?.sleep ?? 0).filter(v => v > 0);
  const stressValues = days.map(d => d.data?.stress ?? 0).filter(v => v > 0);

  // Cigarette trend
  const last7Logged = loggedDays.slice(-7);
  const prev7Logged = loggedDays.slice(-14, -7);
  const last7cigs  = last7Logged.length ? last7Logged.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / last7Logged.length : 0;
  const prev7cigs  = prev7Logged.length ? prev7Logged.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / prev7Logged.length : 0;
  const cigChange  = prev7cigs > 0 ? Math.round(((last7cigs - prev7cigs) / prev7cigs) * 100) : null;
  const avgCigs    = loggedDays.length ? (loggedDays.reduce((s, d) => s + (d.data?.cigarettes ?? 0), 0) / loggedDays.length).toFixed(1) : '—';
  const waterValues = days.map(d => d.data?.water ?? 0).filter(v => v > 0);
  const sleepAvg  = sleepValues.length ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null;
  const stressAvg = stressValues.length ? stressValues.reduce((a, b) => a + b, 0) / stressValues.length : null;
  const waterAvg  = waterValues.length ? waterValues.reduce((a, b) => a + b, 0) / waterValues.length : null;

  // Heatmap summary stats
  const loggedInWindow = heatmapDays.filter(d => d.hasCheckin).length;

  // Lightweight data-driven insight — deterministic, no live AI call
  const insight = (() => {
    if (cigChange != null && cigChange > 15) return { text: `Cigarettes trending up ${cigChange}% this week — still your biggest lever.`, color: color.red };
    if (streak === 0) return { text: 'No active streak right now — log today to start building one.', color: color.warmA };
    if (sleepAvg != null && sleepAvg < 6.5) return { text: `Averaging ${sleepAvg.toFixed(1)}h sleep — aim for 7h+ to support recovery.`, color: color.cool };
    if (stressAvg != null && stressAvg >= 3.5) return { text: `Stress has been running high — chronic stress slows visible recovery.`, color: color.warmB };
    if (waterAvg != null && waterAvg < 1.5) return { text: `Hydration's averaging ${waterAvg.toFixed(1)}L — scalp health likes more water.`, color: color.cool };
    if (avgCigs !== '—' && avgCigs !== '0.0' && Number(avgCigs) > 0) return { text: `${avgCigs}/day average cigarettes — reducing this outranks every supplement.`, color: color.red };
    return { text: `Nothing off-track in your data right now — keep the streak going.`, color: color.green };
  })();

  // Bloodwork summary
  const bwLogged = bloodworkData?.values
    ? ['dht', 'ferritin', 'vitamin_d', 'tsh', 'test_total', 'test_free', 'zinc'].filter(k => bloodworkData.values[k]?.trim()).length
    : 0;

  // Heatmap cells
  const cells = buildCells(heatmapDays, todayStr, 12);

  const handleCellPress = (cell) => {
    if (cell && cell.hasCheckin !== undefined) {
      setSelectedDay({ date: cell.date, hasCheckin: cell.hasCheckin, data: cell.data });
      setShowModal(true);
    }
  };

  const objCompleted = Object.values(phase1).filter(Boolean).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={s.eyebrow}>Phase 1 · Jun–Sep 2026</Text>
      <Text style={s.title}>Progress</Text>

      {/* Phase timeline */}
      <PhaseTimeline />

      {/* Recovery Arc preview */}
      <SectionHeader label="Recovery Arc" />
      <TouchableOpacity onPress={() => navigation.navigate('RecoveryArc')} activeOpacity={0.8}>
        <Card style={[s.arcCard, s.borderCopper]}>
          <View style={s.arcRow}>
            {latestScalpPhoto?.base64 || latestScalpPhotoUrl ? (
              <Image source={{ uri: latestScalpPhoto?.base64 ? `data:image/jpeg;base64,${latestScalpPhoto.base64}` : latestScalpPhotoUrl }} style={s.arcThumb} />
            ) : (
              <View style={[s.arcThumb, s.arcThumbEmpty]}>
                <Text style={s.arcThumbGlyph}>📷</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              {latestScalpPhoto ? (
                <>
                  <Text style={s.arcTitle}>
                    {latestScalpPhoto.synced === false ? 'Syncing…' : latestScalpPhoto.verdict === 'improved' ? 'Improved' : latestScalpPhoto.verdict === 'worse' ? 'Worse' : latestScalpPhoto.verdict === 'stable' ? 'Stable' : 'Photo logged'}
                  </Text>
                  <Text style={s.arcSub}>Latest photo · {latestScalpPhoto.date}</Text>
                </>
              ) : (
                <>
                  <Text style={s.arcTitle}>No photos yet</Text>
                  <Text style={s.arcSub}>Take your first monthly crown photo</Text>
                </>
              )}
            </View>
            <Text style={s.arcChevron}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* Cigarettes area chart */}
      <SectionHeader
        label={`Cigarettes · 30 days`}
        count={cigChange != null ? `${cigChange >= 0 ? '+' : ''}${cigChange}%` : undefined}
        countColor={cigChange == null ? undefined : cigChange > 0 ? color.red : cigChange < 0 ? color.green : color.dim}
      />
      <Card flush style={s.borderRed}>
        <View style={s.chartHeader}>
          <Text style={[s.chartTitle, { color: avgCigs === '0.0' || avgCigs === '0' ? color.green : color.red }]}>
            {avgCigs === '0.0' || avgCigs === '0' ? 'Smoke-free' : `Trending · primary sabotage`}
          </Text>
          <Text style={s.chartMeta}>{avgCigs}/day avg</Text>
        </View>
        {loggedDays.length > 1 ? (
          <AreaChart
            data={cigValues}
            strokeColor={color.red}
            height={96}
            width={width - 32}
          />
        ) : (
          <View style={s.emptyChart}><Text style={s.emptyChartTxt}>Log check-ins to see trend</Text></View>
        )}
      </Card>

      {/* Lifestyle — sleep, stress, water in one card */}
      <SectionHeader label="Lifestyle · 30 days" />
      <Card style={s.borderCool}>
        <View style={s.lifeRow}>
          {[
            { label: 'Sleep', avg: sleepAvg, unit: 'h', dec: 1, accent: color.cool, data: sleepValues },
            { label: 'Stress', avg: stressAvg, unit: '/5', dec: 1, accent: color.warmA, data: stressValues },
            { label: 'Water', avg: waterAvg, unit: 'L', dec: 2, accent: color.warmB, data: waterValues },
          ].map(({ label, avg, unit, dec, accent, data }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={s.lifeDiv} />}
              <View style={s.lifeCol}>
                <Text style={s.lifeLabel}>{label}</Text>
                <Text style={[s.lifeVal, { color: avg != null ? accent : color.faint }]}>
                  {avg != null ? avg.toFixed(dec) : '—'}
                  {avg != null && <Text style={s.lifeUnit}>{unit}</Text>}
                </Text>
                <View style={{ height: 28, justifyContent: 'center' }}>
                  {data.length > 1 && <Sparkline data={data} strokeColor={accent} width={78} height={28} />}
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Card>

      {/* Suggested focus — deterministic insight from this screen's own data */}
      <Card style={s.insightCard}>
        <View style={s.insightHeader}>
          <View style={s.insightIconBox}>
            <Text style={s.insightGlyph}>✦</Text>
          </View>
          <Text style={s.insightEyebrow}>SUGGESTED FOCUS</Text>
        </View>
        <Text style={[s.insightBody, { color: insight.color }]}>{insight.text}</Text>
      </Card>

      {/* 12-week consistency heatmap */}
      <SectionHeader label="Consistency · 12 weeks" />
      <Card style={s.borderCopper}>
        <View style={s.heatStatsRow}>
          <View style={s.heatStat}>
            <Text style={[s.heatStatNum, { color: color.amber }]}>{loggedInWindow}<Text style={s.heatStatUnit}>/84</Text></Text>
            <Text style={s.heatStatLbl}>logged</Text>
          </View>
          <View style={s.heatStat}>
            <Text style={[s.heatStatNum, { color: streak > 0 ? color.warmA : color.faint }]}>{streak}</Text>
            <Text style={s.heatStatLbl}>day streak</Text>
          </View>
          <View style={s.heatStat}>
            <Text style={[s.heatStatNum, { color: color.dim }]}>{Math.round((loggedInWindow / 84) * 100)}<Text style={s.heatStatUnit}>%</Text></Text>
            <Text style={s.heatStatLbl}>consistency</Text>
          </View>
        </View>
        <View style={s.heatRangeRow}>
          <Text style={s.heatRangeLbl}>12 weeks ago</Text>
          <Text style={s.heatRangeLbl}>Today</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Heatmap cells={cells} weeks={12} onCellPress={handleCellPress} />
        </ScrollView>
        <HeatmapKey />
      </Card>

      {/* Bloodwork navigation card */}
      <SectionHeader label="Bloodwork" count={`${bwLogged}/7`} />
      <Card flush style={s.borderCoral}>
        <ListRow
          icon={<Flask size={16} color={bwLogged < 7 ? color.warmA : color.green} />}
          accent={bwLogged < 7 ? color.warmA : color.green}
          name="Lab markers"
          desc={bwLogged === 0 ? 'No markers logged yet' : bwLogged < 7 ? `${7 - bwLogged} to log · Tap to update` : 'All 7 markers logged'}
          onPress={() => navigation.navigate('Labs')}
          last
        />
      </Card>

      {/* Phase 1 objectives */}
      <SectionHeader label="Phase 1 Objectives" count={`${objCompleted}/${PHASE1_OBJECTIVES.length}`} />
      <Card flush style={s.borderAmber}>
        {PHASE1_OBJECTIVES.map((item, i) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => togglePhase1(item.id)}
            style={[s.objRow, i > 0 && s.objBorder]}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, !phase1[item.id] && { borderColor: OBJ_ACCENTS[i % OBJ_ACCENTS.length] }, phase1[item.id] && s.checkboxDone]}>
              {phase1[item.id] && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.objLabel, phase1[item.id] && s.objDone]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Recovery timeline */}
      <SectionHeader label="Recovery Timeline" />
      <Card flush style={s.borderCool}>
        {TIMELINE.map((ev, i) => {
          const isCurrent = ev.type === 'current';
          const isGoal    = ev.type === 'goal';
          const isPassed  = i < TL_CURRENT_INDEX;
          return (
            <View key={i} style={[tl.row, i < TIMELINE.length - 1 && tl.rowBorder, isCurrent && tl.rowCurrent, isGoal && tl.rowGoal]}>
              <View style={tl.lineCol}>
                <View style={[
                  tl.dot,
                  { backgroundColor: TL_DOT_COLOR[ev.type] },
                  (isCurrent || isGoal) && tl.dotBig,
                  isCurrent && tl.dotGlowCurrent,
                  isGoal && tl.dotGlowGoal,
                ]} />
                {i < TIMELINE.length - 1 && (
                  <View style={[tl.connector, isPassed ? { backgroundColor: color.warmA } : tl.connectorFuture]} />
                )}
              </View>
              <View style={tl.content}>
                <View style={tl.dateRow}>
                  <Text style={tl.date}>{ev.date}</Text>
                  {isCurrent && <View style={tl.badgeNow}><Text style={tl.badgeNowTxt}>TODAY</Text></View>}
                  {isGoal && <View style={tl.badgeGoal}><Text style={tl.badgeGoalTxt}>TARGET</Text></View>}
                </View>
                <Text style={[tl.label, { color: TL_TEXT_COLOR[ev.type] }, (isCurrent || isGoal) && tl.labelStrong]}>{ev.label}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <DayModal day={selectedDay} visible={showModal} onClose={() => setShowModal(false)} onSaved={loadAll} />
    </ScrollView>
  );
}

const TL_DOT_COLOR  = { past: color.faint, milestone: color.cool,  current: color.green, future: color.card2, goal: color.warmA };
const TL_TEXT_COLOR = { past: color.faint, milestone: color.cool,  current: color.green, future: color.dim,   goal: color.warmA };
const TL_CURRENT_INDEX = TIMELINE.findIndex(e => e.type === 'current');

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  eyebrow: { ...type.eyebrow, color: ra(color.warmA, 0.65), marginBottom: 6 },
  title:   { ...type.screenTitle, color: color.warmA, marginBottom: 20 },

  // Recovery Arc preview
  arcCard:      { marginBottom: space.md },
  arcRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  arcThumb:     { width: 44, height: 44, borderRadius: radius.stat, backgroundColor: color.card2 },
  arcThumbEmpty:{ borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  arcThumbGlyph:{ fontSize: 16, opacity: 0.5 },
  arcTitle:     { ...type.bodyStrong, marginBottom: 2 },
  arcSub:       { ...type.eyebrow, color: color.faint },
  arcChevron:   { fontSize: 20, color: color.faint },

  // Cigarette chart
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  chartTitle:  { ...type.bodyStrong },
  chartMeta:   { ...type.eyebrow, color: color.faint },
  emptyChart:  { height: 72, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginBottom: 14, backgroundColor: color.card2, borderRadius: radius.row },
  emptyChartTxt: { ...type.eyebrow, color: color.faint },

  // Card border tints (varied per section, same palette family)
  borderRed:    { borderWidth: 1, borderColor: ra(color.red, 0.32) },
  borderCool:   { borderWidth: 1, borderColor: ra(color.cool, 0.32) },
  borderCopper: { borderWidth: 1.5, borderColor: ra(color.copper, 0.55) },
  borderCoral:  { borderWidth: 1, borderColor: ra(color.warmB, 0.32) },
  borderAmber:  { borderWidth: 1, borderColor: ra(color.amber, 0.32) },

  // Lifestyle (merged sleep/stress/water card)
  lifeRow:  { flexDirection: 'row', alignItems: 'center' },
  lifeCol:  { flex: 1, alignItems: 'center', gap: 6 },
  lifeDiv:  { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 2 },
  lifeLabel:{ ...type.eyebrow },
  lifeVal:  { ...type.statValue, fontSize: 21 },
  lifeUnit: { fontSize: 12, fontWeight: '500', color: color.dim },

  // Suggested-focus insight card
  insightCard:  { marginBottom: space.md, borderWidth: 1, borderColor: ra(color.warmA, 0.30) },
  insightHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  insightIconBox:{ width: 26, height: 26, borderRadius: 9, backgroundColor: color.warmA, alignItems: 'center', justifyContent: 'center',
                   shadowColor: color.warmA, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity: 0.6 },
  insightGlyph: { fontSize: 13, color: color.bg, fontWeight: '700' },
  insightEyebrow:{ ...type.eyebrow, color: color.faint },
  insightBody:  { fontSize: 14, lineHeight: 20, fontWeight: '500' },

  // Consistency heatmap header
  heatStatsRow: { flexDirection: 'row', marginBottom: 16 },
  heatStat:     { flex: 1, alignItems: 'center' },
  heatStatNum:  { ...type.statValue, fontSize: 22 },
  heatStatUnit: { fontSize: 12, fontWeight: '500', color: color.dim },
  heatStatLbl:  { ...type.eyebrow, marginTop: 3 },
  heatRangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  heatRangeLbl: { ...type.eyebrow, fontSize: 8, color: color.faint },

  // Objectives
  objRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, gap: 12 },
  objBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.faint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxDone: { backgroundColor: color.green, borderColor: color.green },
  checkmark:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  objLabel: { ...type.body, flex: 1, lineHeight: 20 },
  objDone:  { color: color.faint, textDecorationLine: 'line-through' },
});

// Phase timeline
const pt = StyleSheet.create({
  card:      { backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1.5, borderColor: ra(color.amber, 0.38), padding: 22, marginBottom: space.md },
  topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, gap: 12 },
  title:     { ...type.heading, fontFamily: type.screenTitle.fontFamily, fontSize: 28, lineHeight: 32 },
  sub:       { fontSize: 13, color: color.dim, marginTop: 5 },
  trackWrap: { marginBottom: 8 },
  track:     { height: 7, backgroundColor: color.card2, borderRadius: 3.5, position: 'relative', overflow: 'visible', marginBottom: 24 },
  fill:      { height: 7, backgroundColor: color.warmA, borderRadius: 3.5, shadowColor: color.warmA, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.5 },
  todayPin:  { position: 'absolute', top: -4.5, marginLeft: -6 },
  todayDot:  { width: 15, height: 15, borderRadius: 7.5, backgroundColor: color.txt, borderWidth: 2, borderColor: color.warmA },
  mDot:      { position: 'absolute', top: -3.5, marginLeft: -5 },
  mDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.card2, borderWidth: 1.5, borderColor: color.line2 },
  mDotPassed:{ backgroundColor: color.warmA, borderColor: color.warmA },
  mLabels:   { position: 'relative', height: 16 },
  mLabel:    { position: 'absolute', ...type.eyebrow, fontSize: 8 },
  mLabelLast:{ position: 'absolute', ...type.eyebrow, fontSize: 8, right: 0, textAlign: 'right' },
  stats:     { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  statItem:  { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 5 },
  statDiv:   { width: StyleSheet.hairlineWidth, backgroundColor: color.line, alignSelf: 'stretch', marginVertical: 4 },
  statNum:   { ...type.statValue, fontSize: 28 },
  statLbl:   { ...type.eyebrow },
});

// Timeline
const tl = StyleSheet.create({
  row:       { flexDirection: 'row', paddingVertical: 13, paddingHorizontal: space.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  rowCurrent:{ backgroundColor: ra(color.green, 0.07) },
  rowGoal:   { backgroundColor: ra(color.warmA, 0.07) },
  lineCol:   { width: 20, alignItems: 'center' },
  dot:       { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  dotBig:    { width: 12, height: 12, borderRadius: 6, marginTop: 1 },
  dotGlowCurrent: { shadowColor: color.green, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity: 0.7 },
  dotGlowGoal:    { shadowColor: color.warmA, shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity: 0.7 },
  connector: { flex: 1, width: 2, backgroundColor: color.line, marginTop: 5, borderRadius: 1 },
  connectorFuture: { backgroundColor: 'transparent', borderStyle: 'dashed', borderLeftWidth: 2, borderLeftColor: color.line2, width: 0 },
  content:   { flex: 1, paddingLeft: 12 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  date:      { ...type.eyebrow, fontSize: 8 },
  label:     { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  labelStrong: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  badgeNow:    { backgroundColor: color.green, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1.5 },
  badgeNowTxt: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, color: '#04170B' },
  badgeGoal:    { backgroundColor: color.warmA, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1.5 },
  badgeGoalTxt: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, color: '#1A1000' },
});

// Day modal
const dm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:     { backgroundColor: color.card, borderRadius: radius.card, padding: 20, width: '100%', maxWidth: 360, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  date:     { ...type.bodyStrong, fontSize: 16, marginBottom: 14 },
  hint:     { ...type.body, fontSize: 12, color: color.dim, marginBottom: 14 },
  grid:     { gap: 10 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...type.body, color: color.dim },
  rowVal:   { ...type.bodyStrong, fontSize: 15 },
  chip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.card2 },
  stepper:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn:  { width: 26, height: 26, borderRadius: 13, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' },
  stepTxt:  { fontSize: 15, fontWeight: '700', color: color.warmA, lineHeight: 17 },
  stepVal:  { minWidth: 36, textAlign: 'center' },
  div:      { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: 12 },
  notesInput: { fontSize: 13, color: color.txt, lineHeight: 18, minHeight: 44, textAlignVertical: 'top' },
  footer:   { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: color.card2, height: 44, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: color.dim },
  saveBtn:  { flex: 1, backgroundColor: color.warmA, height: 44, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  saveTxt:  { fontSize: 15, fontWeight: '700', color: '#1A1000' },
});
