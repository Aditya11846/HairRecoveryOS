import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { launchCamera } from 'react-native-image-picker';
import {
  get, getTodayKey, getScalpPhotos, captureScalpPhoto,
  getScalpPhotoSignedUrl, fetchImageAsBase64,
} from '../utils/storage';
import { getCrownAssessment, isLowCreditError } from '../services/ai';
import RecoveryArcChart from '../components/RecoveryArc';
import Card from '../components/Card';
import { color, type, radius, space } from '../theme/tokens';

const MIN_DAYS_BETWEEN = 27;

const verdictColor = (v) => v === 'improved' ? color.green : v === 'worse' ? color.red : color.dim;
const verdictLabel = (v) => v === 'improved' ? 'Improved' : v === 'worse' ? 'Worse' : v === 'stable' ? 'Stable' : 'Unclear';

const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

function ThumbRow({ photos, urls }) {
  if (!photos.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
      {photos.map(p => (
        <View key={p.id} style={s.thumbWrap}>
          {p.base64 || urls[p.storage_path] ? (
            <Image source={{ uri: p.base64 ? `data:image/jpeg;base64,${p.base64}` : urls[p.storage_path] }} style={s.thumb} />
          ) : (
            <View style={[s.thumb, s.thumbPlaceholder]} />
          )}
          <Text style={s.thumbDate}>{p.date}</Text>
          {p.synced === false ? (
            <Text style={[s.thumbVerdict, { color: color.faint }]}>Syncing…</Text>
          ) : p.verdict && (
            <Text style={[s.thumbVerdict, { color: verdictColor(p.verdict) }]}>{verdictLabel(p.verdict)}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

export default function RecoveryArc({ navigation }) {
  const insets = useSafeAreaInsets();
  const [recoveryLog, setRecoveryLog] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [urls, setUrls] = useState({});
  const urlsRef = useRef({});
  const [capturing, setCapturing] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [log, scalpPhotos] = await Promise.all([get('recovery_log', []), getScalpPhotos()]);
      setRecoveryLog(Array.isArray(log) ? [...log].sort((a, b) => a.date.localeCompare(b.date)) : []);
      setPhotos(scalpPhotos);

      // Lazily resolve signed URLs for whatever we don't already have cached
      // (urlsRef, not state, since this closure only runs once per focus)
      scalpPhotos.forEach(p => {
        if (!p.storage_path || urlsRef.current[p.storage_path]) return;
        getScalpPhotoSignedUrl(p.storage_path).then(url => {
          if (!url) return;
          urlsRef.current = { ...urlsRef.current, [p.storage_path]: url };
          setUrls(prev => ({ ...prev, [p.storage_path]: url }));
        });
      });
    })();
  }, []));

  const chartData = recoveryLog.map(d => ({ value: d.value }));
  const xLabels = recoveryLog.length
    ? [recoveryLog[0].date.slice(5), recoveryLog[recoveryLog.length - 1].date.slice(5)]
    : [];
  const peakIndex = chartData.length
    ? chartData.reduce((best, d, i) => d.value > chartData[best].value ? i : best, 0)
    : null;

  const lastPhoto = photos.length ? photos[photos.length - 1] : null;
  const daysSinceLast = lastPhoto ? daysBetween(lastPhoto.date, getTodayKey()) : Infinity;
  const canCapture = daysSinceLast >= MIN_DAYS_BETWEEN;
  const nextAvailable = lastPhoto && !canCapture
    ? new Date(new Date(lastPhoto.date).getTime() + MIN_DAYS_BETWEEN * 86400000).toISOString().slice(0, 10)
    : null;

  const handleCapture = async () => {
    const response = await launchCamera({ mediaType: 'photo', includeBase64: true, maxWidth: 1024, maxHeight: 1024, quality: 0.7 });
    if (response.didCancel || response.errorCode) return;
    const asset = response.assets?.[0];
    if (!asset?.base64) return;

    setCapturing(true);
    try {
      const dateStr = getTodayKey();
      const toB64 = (p) => !p ? null : p.base64 ? Promise.resolve(p.base64) : getScalpPhotoSignedUrl(p.storage_path).then(u => u && fetchImageAsBase64(u));
      const baseline = photos[0];
      const previous = photos[photos.length - 1];
      const [baselineB64, previousB64] = await Promise.all([toB64(baseline), toB64(previous)]);

      const assessment = await getCrownAssessment({ baselineB64, previousB64, currentB64: asset.base64 });
      if (assessment?.noApiKey) {
        Alert.alert('API key needed', 'Set your Claude API key in the Ask Claude tab to get an AI verdict. Your photo was still saved.');
      } else if (isLowCreditError(assessment?.error)) {
        Alert.alert('Out of API credits', 'Your Claude API credit balance is too low to get an AI verdict right now. Your photo was still saved.');
      } else if (!assessment?.verdict) {
        Alert.alert('AI read failed', 'Your photo was saved, but the AI comparison couldn\'t complete this time. You can try again next month.');
      }

      const saved = await captureScalpPhoto({
        date: dateStr,
        base64: asset.base64,
        verdict: assessment?.verdict ?? null,
        confidence: assessment?.confidence ?? null,
        notes: assessment?.notes ?? (assessment?.error || ''),
      });
      if (!saved.synced) {
        Alert.alert('Saved offline', 'No connection right now — your photo is saved on this device and will upload automatically next time you\'re online.');
      }

      const refreshed = await getScalpPhotos();
      setPhotos(refreshed);
    } catch (e) {
      Alert.alert('Something went wrong', e.message || 'Could not save this photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const latestVerdictPhoto = photos.length ? photos[photos.length - 1] : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {navigation?.canGoBack?.() && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backTxt}>‹ Back</Text>
        </TouchableOpacity>
      )}

      <Text style={s.eyebrow}>Crown Recovery</Text>
      <Text style={s.title}>Full Arc</Text>

      <Card>
        <Text style={s.sectionLabel}>SELF-REPORTED %</Text>
        <RecoveryArcChart data={chartData} peakIndex={peakIndex} xLabels={xLabels} />
      </Card>

      <Text style={s.sectionLabel}>MONTHLY PHOTOS</Text>
      {photos.length ? (
        <ThumbRow photos={photos} urls={urls} />
      ) : (
        <Text style={s.emptyTxt}>No photos yet — take your first one below.</Text>
      )}

      <Card>
        {latestVerdictPhoto?.verdict && (
          <View style={{ marginBottom: space.md }}>
            <Text style={s.sectionLabel}>LATEST AI READ · {latestVerdictPhoto.date}</Text>
            <Text style={[s.verdictTxt, { color: verdictColor(latestVerdictPhoto.verdict) }]}>
              {verdictLabel(latestVerdictPhoto.verdict)}
              {latestVerdictPhoto.confidence != null ? ` · ${Math.round(latestVerdictPhoto.confidence * 100)}% confidence` : ''}
            </Text>
            {latestVerdictPhoto.notes ? <Text style={s.notesTxt}>{latestVerdictPhoto.notes}</Text> : null}
          </View>
        )}

        {canCapture ? (
          <>
            {lastPhoto && urls[lastPhoto.storage_path] && (
              <View style={{ marginBottom: space.md }}>
                <Text style={s.sectionLabel}>MATCH THIS ANGLE</Text>
                <Image source={{ uri: urls[lastPhoto.storage_path] }} style={s.referenceImg} />
              </View>
            )}
            <TouchableOpacity onPress={handleCapture} disabled={capturing} activeOpacity={0.85} style={s.captureBtn}>
              <Text style={s.captureBtnTxt}>{capturing ? 'Analyzing…' : '📷  Take this month\'s photo'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={s.emptyTxt}>Next photo available on {nextAvailable}.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:  { paddingHorizontal: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backTxt: { ...type.eyebrow, color: color.warmA, fontSize: 13, letterSpacing: 0 },
  eyebrow: { ...type.eyebrow, color: ra(color.warmA, 0.65), marginBottom: 6 },
  title:   { ...type.screenTitle, marginBottom: 20 },

  sectionLabel: { ...type.eyebrow, color: color.faint, marginBottom: 10 },
  emptyTxt:     { fontFamily: type.body.fontFamily, fontSize: 13, color: color.dim, marginBottom: space.md },

  thumbWrap:      { marginRight: 10, alignItems: 'center', width: 72 },
  thumb:          { width: 72, height: 72, borderRadius: radius.row, backgroundColor: color.card2 },
  thumbPlaceholder: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  thumbDate:      { ...type.eyebrow, fontSize: 8, color: color.faint, marginTop: 4 },
  thumbVerdict:   { ...type.eyebrow, fontSize: 8, marginTop: 2 },

  verdictTxt: { ...type.heading, fontSize: 17, marginBottom: 4 },
  notesTxt:   { fontFamily: type.body.fontFamily, fontSize: 13, color: color.dim, lineHeight: 19 },

  referenceImg: { width: '100%', height: 180, borderRadius: radius.row, backgroundColor: color.card2 },

  captureBtn:    { backgroundColor: color.warmA, borderRadius: radius.row, paddingVertical: 16, alignItems: 'center' },
  captureBtnTxt: { fontSize: 15, fontWeight: '700', color: '#1A1000', letterSpacing: 0.3 },
});

function ra(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
