import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { fetchProtocolGuide } from '../../services/ai';
import { saveProtocolGuide } from '../../utils/storage';

export default function AddToProtocolSheet({ item, visible, onConfirm, onCancel }) {
  const [fetching, setFetching] = useState(false);
  if (!item) return null;

  const handleConfirm = () => {
    setFetching(true);
    onConfirm();
    // Background guide fetch — don't block the sheet from closing
    fetchProtocolGuide(item.title).then(guide => {
      if (guide) saveProtocolGuide(item.title, guide);
      setFetching(false);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.title}>Add to daily check-in?</Text>
          <Text style={s.item}>{item.title}</Text>
          <Text style={s.note}>Always consult Dr. Soni before starting anything new.</Text>
          {fetching && <Text style={s.fetchingNote}>Fetching usage guide from the web…</Text>}
          <TouchableOpacity onPress={handleConfirm} style={s.confirmBtn} activeOpacity={0.8}>
            <Text style={s.confirmText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={s.cancelBtn} activeOpacity={0.8}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  item: { fontSize: 15, fontWeight: '600', color: '#3B82F6', marginBottom: 12, lineHeight: 21 },
  note: { fontSize: 13, color: '#8E8E93', lineHeight: 19, marginBottom: 8 },
  fetchingNote: { fontSize: 12, color: '#3B82F6', marginBottom: 16, fontStyle: 'italic' },
  confirmBtn: { backgroundColor: '#3B82F6', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cancelBtn: { backgroundColor: '#2C2C2E', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
});
