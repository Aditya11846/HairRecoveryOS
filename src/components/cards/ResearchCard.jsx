import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import Badge from '../common/Badge';
import { isProtocolAdded } from '../../utils/storage';
import { C } from '../../theme';

const SOURCE_COLORS = {
  PubMed: '#3B82F6',
  Reddit: '#F97316',
  ClinicalTrial: '#A855F7',
  NewProduct: '#10B981',
  Technique: '#06B6D4',
};

const RELEVANCE_COLORS = {
  HIGH: '#30D158',
  MEDIUM: '#FF9F0A',
  LOW: '#8E8E93',
};

export default function ResearchCard({ item, onAddToProtocol }) {
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (item.canAddToProtocol) {
      isProtocolAdded(item.title).then(setAdded);
    }
  }, [item.title, item.canAddToProtocol]);

  const handleAdd = () => {
    setAdding(true);
    onAddToProtocol(item, () => {
      setAdded(true);
      setAdding(false);
    }, () => setAdding(false));
  };

  const sourceColor = SOURCE_COLORS[item.source] || C.accent;
  const relevanceColor = RELEVANCE_COLORS[item.relevance] || C.sub;
  const actionColor = item.action === 'ask_doctor' ? C.red : C.accent;
  const actionBg = item.action === 'ask_doctor' ? '#2A1A1A' : '#1A2A1F';
  const actionLabel = item.action === 'ask_doctor' ? 'Ask Dr.'
    : item.action === 'add_to_protocol' ? 'Add'
    : item.action === 'monitor' ? 'Monitor' : 'Info';

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.badgeRow}>
          <Badge label={item.source} color={sourceColor} />
          <Badge label={item.relevance} color={relevanceColor} />
        </View>
        <View style={[s.actionChip, { backgroundColor: actionBg }]}>
          <Text style={[s.actionText, { color: actionColor }]}>{actionLabel}</Text>
        </View>
      </View>

      <Text style={s.cardTitle}>{item.title}</Text>
      <Text style={s.cardSummary}>{item.summary}</Text>
      <Text style={s.cardReason}>{item.relevance_reason}</Text>

      {item.url ? (
        <TouchableOpacity onPress={() => Linking.openURL(item.url)} activeOpacity={0.7} style={s.urlRow}>
          <Text style={s.urlText} numberOfLines={1}>{item.url}</Text>
        </TouchableOpacity>
      ) : null}

      {item.canAddToProtocol && (
        <TouchableOpacity
          onPress={handleAdd}
          disabled={added || adding}
          style={[s.addBtn, (added || adding) && s.addBtnDone]}
          activeOpacity={0.7}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.addBtnText}>{added ? 'Added ✓' : 'Add to check-in'}</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  actionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  actionText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', lineHeight: 21, marginBottom: 6 },
  cardSummary: { fontSize: 13, color: '#8E8E93', lineHeight: 19, marginBottom: 6 },
  cardReason: { fontSize: 12, color: '#6C6C6C', fontStyle: 'italic', lineHeight: 17 },
  urlRow: { marginTop: 8 },
  urlText: { fontSize: 11, color: '#3B82F6', textDecorationLine: 'underline' },
  addBtn: { marginTop: 12, backgroundColor: '#3B82F6', borderRadius: 10, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtnDone: { backgroundColor: '#1A2A1F' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
