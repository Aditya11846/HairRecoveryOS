import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, StatusBar,
} from 'react-native';
import { C } from '../../theme';

async function fetchPubMedAbstract(url) {
  try {
    const match = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    if (!match) return null;
    const pmid = match[1];
    const xmlRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`
    );
    return await xmlRes.text();
  } catch {
    return null;
  }
}

export default function StudyReaderModal({ item, visible, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !item) return;
    setContent(null);

    if (item.source === 'PubMed' && item.url) {
      setLoading(true);
      fetchPubMedAbstract(item.url).then(text => {
        setContent(text);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [visible, item]);

  if (!item) return null;

  const sourceColor = {
    PubMed: '#3B82F6', Reddit: '#F97316',
    ClinicalTrial: '#A855F7', YouTube: '#EF4444', DermNet: '#10B981',
  }[item.source] || C.accent;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.container}>
        <StatusBar barStyle="light-content" />

        <View style={s.topBar}>
          <View style={s.handle} />
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.sourceBadge, { backgroundColor: sourceColor + '22' }]}>
            <Text style={[s.sourceText, { color: sourceColor }]}>{item.source}</Text>
          </View>
          <Text style={s.title}>{item.title}</Text>

          <View style={s.section}>
            <Text style={s.sectionLabel}>AI SUMMARY</Text>
            <Text style={s.summaryText}>{item.summary}</Text>
          </View>

          <View style={[s.section, s.highlightSection]}>
            <Text style={s.sectionLabel}>WHY THIS MATTERS FOR YOU</Text>
            <Text style={s.reasonText}>{item.relevance_reason}</Text>
          </View>

          {item.source === 'PubMed' && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>FULL ABSTRACT</Text>
              {loading ? (
                <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
              ) : content ? (
                <Text style={s.abstractText}>{content}</Text>
              ) : (
                <Text style={s.abstractText}>Abstract not available. Read on PubMed →</Text>
              )}
            </View>
          )}

          {item.source === 'Reddit' && item.excerpt && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>POST EXCERPT</Text>
              <Text style={s.abstractText}>{item.excerpt}</Text>
            </View>
          )}

          {item.source === 'YouTube' && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>VIDEO</Text>
              <Text style={s.abstractText}>This is a video resource. Tap below to watch in YouTube.</Text>
            </View>
          )}

          <View style={[s.section, s.actionSection]}>
            <Text style={s.sectionLabel}>RECOMMENDED ACTION</Text>
            <Text style={[s.actionText, {
              color: item.action === 'ask_doctor' ? C.red :
                     item.action === 'add_to_protocol' ? C.green :
                     item.action === 'monitor' ? C.orange : C.sub
            }]}>
              {item.action === 'ask_doctor' ? '🩺 Discuss with Dr. Soni at your next appointment' :
               item.action === 'add_to_protocol' ? '✚ Consider adding to your protocol' :
               item.action === 'monitor' ? '👁 Monitor and note any changes in your check-ins' :
               'ℹ For your information only'}
            </Text>
          </View>

          {item.url && (
            <TouchableOpacity onPress={() => Linking.openURL(item.url)} style={s.externalBtn} activeOpacity={0.7}>
              <Text style={s.externalBtnText}>Open original source ↗</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C' },
  closeBtn: { position: 'absolute', right: 20, top: 16 },
  closeBtnText: { fontSize: 16, fontWeight: '600', color: C.accent },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sourceBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  sourceText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 28, marginBottom: 24, letterSpacing: -0.4 },
  section: { backgroundColor: 'rgba(28,28,30,0.9)', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  highlightSection: { borderColor: 'rgba(59,130,246,0.3)', borderLeftWidth: 3, borderLeftColor: C.accent },
  actionSection: { borderColor: 'rgba(255,255,255,0.05)' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, marginBottom: 10 },
  summaryText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  reasonText: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 21, fontStyle: 'italic' },
  abstractText: { fontSize: 13, color: '#8E8E93', lineHeight: 20 },
  actionText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  externalBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 14, backgroundColor: 'rgba(28,28,30,0.9)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  externalBtnText: { fontSize: 14, fontWeight: '600', color: C.sub },
});
