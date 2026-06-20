import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  Platform, StyleSheet, ActivityIndicator,
  Pressable, ScrollView, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { get, set, getRecentCheckins, getStreakCount, getTodayKey, loadCheckin } from '../utils/storage';
import { C } from '../theme';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are HairOS AI — a specialized hair recovery assistant embedded in Aditya's personal hair loss tracking app.

PATIENT PROFILE
Name: Aditya Singh | Age: 22 | Location: Pune, India
Hair Loss: Androgenetic Alopecia (AGA) — diffuse pattern, temple recession, crown thinning | Fitzpatrick IV (South Asian)

TIMELINE
- June 2022: First significant shedding
- 2022–2024: Progressive miniaturization
- 2024–present: Active treatment
- Recovery Checkpoint: September 2026

CURRENT PROTOCOL
1. Oral Minoxidil 2.5mg — once daily (morning). Systemic vasodilation. Superior to topical alone in RCTs.
2. Novegrow Topical Minoxidil 10% Solution (liquid) — nightly, all affected zones.
3. Red Light Comb (LLLT) — 15 min, 3× per week. 650nm photobiomodulation. Mild but consistent RCT efficacy.
4. Dutasteride 0.5mg (Dutalin) — Mon + Thu. Inhibits Type I + II 5α-reductase (~90% DHT suppression). Active.

SABOTAGE FACTORS (tracked daily)
- Smoking: Nicotine vasoconstriction directly opposes minoxidil. CRITICAL inhibitor. Target: 0.
- Sleep: GH pulses peak in deep sleep; poor sleep elevates cortisol. Target: ≥7h.
- Stress: Chronic cortisol triggers telogen effluvium. Target: ≤4/10.
- Consistency: Minoxidil requires continuous use; interruptions reset follicular priming.

BLOODWORK NEEDED (not yet done): DHT, Testosterone (free+total), Ferritin (target >70 ng/mL), TSH, Vitamin D3 (target >50 ng/mL), Zinc.

PHASE 1: 30-day streak, 0 cigarettes, bloodwork completed, ≥7h sleep 14 days, monthly photos, finasteride decision.

RESPONSE STYLE: Direct, specific, evidence-based. Reference his actual tracked data when provided. Cite mechanisms and studies. Set realistic timelines (AGA requires 12–18 months minimum). Flag anything needing GP/dermatologist. No fluff.`;

const QUICK_ASKS = [
  'Why am I still shedding on minoxidil?',
  'How much is smoking hurting my results?',
  'When realistically will I see regrowth?',
  "What's my biggest risk factor right now?",
];

async function buildContext() {
  const [recent, streak, today] = await Promise.all([
    getRecentCheckins(7),
    getStreakCount(),
    loadCheckin(getTodayKey()),
  ]);
  if (!recent.length && !today) return '';
  const lines = ['\n\n[TRACKED DATA FROM APP]'];
  lines.push(`Streak: ${streak} days`);
  if (today) {
    lines.push(`Today: oral=${today.oralMinoxidil ? 'yes' : today.oralMinoxidil === false ? 'no' : '?'}, topical=${today.topicalMinoxidil ? 'yes' : today.topicalMinoxidil === false ? 'no' : '?'}, cigs=${today.cigarettes ?? '?'}, sleep=${today.sleep ?? '?'}h, stress=${today.stress ?? '?'}/10, shedding=${today.sheddingNoticed === true ? 'yes' : today.sheddingNoticed === false ? 'no' : '?'}`);
  }
  if (recent.length > 1) {
    const avgCigs = (recent.reduce((s, c) => s + (c.cigarettes || 0), 0) / recent.length).toFixed(1);
    const avgSleep = (recent.reduce((s, c) => s + (c.sleep || 0), 0) / recent.length).toFixed(1);
    const pct = Math.round((recent.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / recent.length) * 100);
    lines.push(`7-day avg: ${avgCigs} cigs/day, ${avgSleep}h sleep, ${pct}% med consistency`);
  }
  lines.push('[END DATA]');
  return lines.join('\n');
}

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[s.bubbleWrap, isUser ? s.bubbleRight : s.bubbleLeft]}>
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
        <Text style={s.bubbleText}>{msg.content}</Text>
      </View>
    </View>
  );
}

export default function AskClaude() {
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalidKey, setInvalidKey] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    Promise.all([get('api_key', ''), get('chat_history', [])]).then(([k, h]) => {
      setApiKey(k || '');
      setMessages(h || []);
    });
  }, []);

  // Scroll to bottom after messages render and after keyboard appears
  useEffect(() => {
    if (!messages.length && !loading) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, loading]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openKeyModal = useCallback(() => { setShowKeyModal(true); setError(''); }, []);

  const saveKey = async () => {
    const k = keyInput.trim().replace(/\s+/g, '');
    if (!k.startsWith('sk-ant-')) { setError('Key must start with sk-ant-'); return; }
    await set('api_key', k);
    setApiKey(k);
    setShowKeyModal(false);
    setKeyInput('');
    setError('');
    setInvalidKey(false);
  };

  const removeKey = async () => {
    await set('api_key', '');
    setApiKey('');
    setShowKeyModal(false);
  };

  const send = async (text) => {
    if (!apiKey) { openKeyModal(); return; }
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');
    setError('');

    const ctx = await buildContext();
    const displayMsg = { role: 'user', content: userText };
    const history = [...messages, displayMsg];
    setMessages(history);
    setLoading(true);

    const systemWithCtx = ctx ? SYSTEM_PROMPT + ctx : SYSTEM_PROMPT;
    const apiHistory = history.slice(-12).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: systemWithCtx, messages: apiHistory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) setInvalidKey(true);
        throw new Error(errMsg);
      }
      const data = await res.json();
      const reply = data.content?.[0]?.text || '(empty response)';
      const final = [...history, { role: 'assistant', content: reply }];
      setMessages(final);
      await set('chat_history', final.slice(-40));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <View style={[s.root, { backgroundColor: C.bg, paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
      {/* API Key modal */}
      <Modal visible={showKeyModal} transparent animationType="slide" onRequestClose={() => setShowKeyModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowKeyModal(false)}>
          <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Anthropic API Key</Text>
            <Text style={s.modalSub}>Stored locally on your device. Sent only to api.anthropic.com.</Text>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              onSubmitEditing={saveKey}
              placeholder="sk-ant-api03-..."
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              style={s.keyInput}
            />
            {error ? <Text style={s.errorText}>{error}</Text> : null}
            <TouchableOpacity onPress={saveKey} style={s.saveKeyBtn} activeOpacity={0.8}>
              <Text style={s.saveKeyBtnText}>Save Key</Text>
            </TouchableOpacity>
            <View style={s.modalRow}>
              {apiKey ? (
                <TouchableOpacity onPress={removeKey} style={[s.modalSecBtn, { flex: 1 }]} activeOpacity={0.8}>
                  <Text style={[s.modalSecBtnText, { color: C.red }]}>Remove Key</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setShowKeyModal(false)} style={[s.modalSecBtn, { flex: 1 }]} activeOpacity={0.8}>
                <Text style={[s.modalSecBtnText, { color: C.sub }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{ flex: 1 }}>
        {/* Header — tap dismisses keyboard */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[s.header, { paddingTop: insets.top + 16 }]}>
            <View style={s.headerTop}>
              <Text style={s.title}>Ask Claude</Text>
              {!isEmpty && (
                <TouchableOpacity
                  onPress={async () => { setMessages([]); await set('chat_history', []); }}
                  style={s.clearBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={openKeyModal} style={s.keyStatusRow} activeOpacity={0.7}>
              <View style={[s.keyDot, { backgroundColor: apiKey ? C.green : C.orange }]} />
              <Text style={[s.keyStatusText, { color: apiKey ? C.green : C.orange }]}>
                {apiKey ? `${MODEL} · context loaded` : 'Tap to set API key'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>

        {/* Content */}
        {isEmpty && !loading ? (
          <>
            <View style={s.introPad}>
              <View style={s.introCard}>
                <View style={s.introIcon}>
                  <Text style={{ fontSize: 20 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.introTitle}>Your AI Hair Coach</Text>
                  <Text style={s.introSub}>Protocol, bloodwork gaps, and tracked data pre-loaded. Ask anything.</Text>
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <View style={s.quickAskGrid}>
              {QUICK_ASKS.map(q => (
                <TouchableOpacity key={q} onPress={() => send(q)} style={s.quickAskBtn} activeOpacity={0.7}>
                  <Text style={s.quickAskText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <MsgBubble msg={item} />}
            contentContainerStyle={s.msgList}
            style={s.msgFlatList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              <>
                {loading && (
                  <View style={s.bubbleLeft}>
                    <View style={[s.bubble, s.bubbleAssistant]}>
                      <ActivityIndicator size="small" color={C.accent} />
                    </View>
                  </View>
                )}
                {invalidKey && !loading && (
                  <TouchableOpacity
                    onPress={openKeyModal}
                    style={s.invalidKeyBanner}
                    activeOpacity={0.8}
                  >
                    <Text style={s.invalidKeyBannerText}>
                      API key invalid or expired — tap to re-enter
                    </Text>
                  </TouchableOpacity>
                )}
                {error && !invalidKey ? (
                  <View style={s.errorBox}>
                    <Text style={s.errorBoxText}>Error: {error}</Text>
                  </View>
                ) : null}
              </>
            }
          />
        )}
      </View>

      {/* Input bar — root paddingBottom handles keyboard lift; this just handles tab bar clearance */}
      <View style={[s.inputBar, {
        paddingBottom: keyboardHeight > 0 ? 12 : insets.bottom + 90,
      }]}>
        <View style={s.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            placeholder="Ask about your protocol..."
            placeholderTextColor={C.dim}
            multiline
            style={s.textInput}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={loading || !input.trim()}
            style={[s.sendBtn, { backgroundColor: !loading && input.trim() ? C.accent : C.card2 }]}
            activeOpacity={0.8}
          >
            <Text style={[s.sendBtnText, { color: !loading && input.trim() ? '#fff' : C.dim }]}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8, flexShrink: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 40 },
  clearBtn: { backgroundColor: '#2C2C2E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  keyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingVertical: 4 },
  keyDot: { width: 6, height: 6, borderRadius: 3 },
  keyStatusText: { fontSize: 12, fontWeight: '500' },
  introPad: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  introCard: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  introIcon: { width: 36, height: 36, backgroundColor: '#0A1628', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  introSub: { fontSize: 12, color: '#8E8E93', marginTop: 2, lineHeight: 18 },
  quickAskGrid: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAskBtn: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 12, width: '48%', minHeight: 52, justifyContent: 'center' },
  quickAskText: { fontSize: 12, fontWeight: '500', color: '#8E8E93', lineHeight: 16 },
  msgFlatList: { flex: 1 },
  msgList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 8 },
  bubbleWrap: { marginVertical: 2 },
  bubbleRight: { alignItems: 'flex-end' },
  bubbleLeft: { alignItems: 'flex-start' },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1C1C1E', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  invalidKeyBanner: { backgroundColor: '#2A1A00', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4, borderWidth: 1, borderColor: '#F97316' },
  invalidKeyBannerText: { fontSize: 13, color: '#F97316', fontWeight: '600', textAlign: 'center' },
  errorBox: { backgroundColor: '#2A1010', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  errorBoxText: { fontSize: 12, color: '#FF453A', fontWeight: '500' },
  inputBar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#000' },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1C1C1E', borderRadius: 20, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, gap: 8 },
  textInput: { flex: 1, fontSize: 14, color: '#FFFFFF', maxHeight: 120, paddingVertical: 6 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnText: { fontSize: 18, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#8E8E93', marginBottom: 16, lineHeight: 20 },
  keyInput: { backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#FFFFFF', marginBottom: 14 },
  errorText: { fontSize: 12, color: '#FF453A', marginBottom: 10 },
  saveKeyBtn: { backgroundColor: '#3B82F6', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  saveKeyBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  modalRow: { flexDirection: 'row', gap: 8 },
  modalSecBtn: { backgroundColor: '#2C2C2E', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSecBtnText: { fontSize: 14, fontWeight: '600' },
});
