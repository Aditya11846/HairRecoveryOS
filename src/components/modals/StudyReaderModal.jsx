import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme';

const SOURCE_COLORS = {
  PubMed: '#3B82F6', Reddit: '#F97316',
  ClinicalTrial: '#A855F7', YouTube: '#EF4444', DermNet: '#10B981',
};

async function fetchPubMedAbstract(url) {
  try {
    const match = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    if (!match) return null;
    const pmid = match[1];
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`,
      { headers: { 'User-Agent': 'HairRecoveryOS/1.0' } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text.replace(/\n{3,}/g, '\n\n').trim();
  } catch { return null; }
}

export default function StudyReaderModal({ item, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [abstract, setAbstract] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !item) { setAbstract(null); return; }
    if (item.source === 'PubMed' && item.url) {
      setLoading(true);
      fetchPubMedAbstract(item.url).then(t => { setAbstract(t); setLoading(false); });
    }
  }, [visible, item?.url]);

  if (!item) return null;

  const sourceColor = SOURCE_COLORS[item.source] || C.accent;
  const actionColor = {
    ask_doctor: C.red, add_to_protocol: C.green, monitor: C.orange,
  }[item.action] || C.sub;
  const actionLabel = {
    ask_doctor: '🩺 Ask Dr. Soni at your next appointment',
    add_to_protocol: '✚ Consider adding to your protocol',
    monitor: '👁 Monitor — note any changes in check-ins',
    informational: 'ℹ For your information only',
  }[item.action] || 'ℹ For your information only';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={r.root}>
        <View style={r.topBar}>
          <View style={r.handle} />
          <TouchableOpacity onPress={onClose} style={r.doneBtn} activeOpacity={0.7}>
            <Text style={r.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={[r.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <View style={[r.sourceBadge, { backgroundColor: sourceColor + '22' }]}>
            <Text style={[r.sourceText, { color: sourceColor }]}>{item.source}</Text>
          </View>
          <Text style={r.title}>{item.title}</Text>
          <View style={r.section}>
            <Text style={r.sectionLabel}>AI SUMMARY</Text>
            <Text style={r.bodyText}>{item.summary}</Text>
          </View>
          <View style={[r.section, { borderLeftWidth: 3, borderLeftColor: sourceColor }]}>
            <Text style={r.sectionLabel}>WHY THIS MATTERS FOR YOU</Text>
            <Text style={[r.bodyText, { fontStyle: 'italic', color: 'rgba(255,255,255,0.68)' }]}>{item.relevance_reason}</Text>
          </View>
          {item.source === 'Reddit' && item.excerpt ? (
            <View style={r.section}>
              <Text style={r.sectionLabel}>POST CONTENT</Text>
              <Text style={[r.bodyText, { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.65)' }]}>{item.excerpt}</Text>
            </View>
          ) : null}
          {item.source === 'PubMed' && (
            <View style={r.section}>
              <Text style={r.sectionLabel}>FULL ABSTRACT</Text>
              {loading
                ? <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />
                : <Text style={[r.bodyText, { fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.6)' }]}>{abstract || 'Abstract unavailable.'}</Text>
              }
            </View>
          )}
          <View style={[r.actionBox, { backgroundColor: actionColor + '18', borderColor: actionColor + '40' }]}>
            <Text style={[r.actionText, { color: actionColor }]}>{actionLabel}</Text>
          </View>
          {item.url && (
            <TouchableOpacity onPress={() => Linking.openURL(item.url)} style={r.externalBtn} activeOpacity={0.7}>
              <Text style={r.externalText}>Open original source ↗</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { alignItems: 'center', paddingTop: 14, paddingBottom: 8, position: 'relative' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C' },
  doneBtn: { position: 'absolute', right: 20, top: 14 },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  content: { padding: 20 },
  sourceBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  sourceText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26, marginBottom: 20, letterSpacing: -0.3 },
  section: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.1, marginBottom: 8 },
  bodyText: { fontSize: 15, color: '#fff', lineHeight: 22 },
  actionBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  actionText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  externalBtn: { alignItems: 'center', paddingVertical: 14, backgroundColor: '#1C1C1E', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)' },
  externalText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
});
