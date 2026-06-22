import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  Platform, StyleSheet, Animated,
  Pressable, ScrollView, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { get, set, getRecentCheckins, getStreakCount, getTodayKey, loadCheckin } from '../utils/storage';
import { fetchWithTimeout } from '../utils/fetchTimeout';
import { color, type, radius, space } from '../theme/tokens';

const MODEL = 'claude-sonnet-4-6';
const MODEL_SHORT = 'Sonnet 4.6';

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
  { q: 'Why am I still shedding on minoxidil?',    icon: '❓' },
  { q: 'How much is smoking hurting my results?',  icon: '🚬' },
  { q: 'When realistically will I see regrowth?',  icon: '📅' },
  { q: "What's my biggest risk factor right now?", icon: '⚠️' },
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
    lines.push(`Today: oral=${today.oralMinoxidil ? 'yes' : today.oralMinoxidil === false ? 'no' : '?'}, topical=${today.topicalMinoxidil ? 'yes' : today.topicalMinoxidil === false ? 'no' : '?'}, cigs=${today.cigarettes ?? '?'}, sleep=${today.sleep ?? '?'}h, stress=${today.stress ?? '?'}/10, shedding=${today.sheddingNoticed === 'none' || today.sheddingNoticed === false ? 'none' : today.sheddingNoticed === 'light' || today.sheddingNoticed === true ? 'light' : today.sheddingNoticed === 'heavy' ? 'heavy' : '?'}`);
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

// ─── AI Glow Icon ─────────────────────────────────────────────────────────────

function AIGlowIcon() {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={gi.wrap}>
      <Animated.View style={[gi.outerRing, { opacity: pulse }]} />
      <View style={gi.midRing} />
      <View style={gi.core}>
        <Text style={gi.coreIcon}>✦</Text>
      </View>
    </View>
  );
}

const gi = StyleSheet.create({
  wrap:     { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  outerRing:{ position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,176,32,0.10)' },
  midRing:  { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,176,32,0.16)' },
  core:     { width: 44, height: 44, borderRadius: 22, backgroundColor: color.warmA, alignItems: 'center', justifyContent: 'center', shadowColor: color.warmA, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
  coreIcon: { fontSize: 18, color: '#1A1000' },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        Animated.delay(560),
      ])
    ).start();
    anim(d1, 0); anim(d2, 150); anim(d3, 300);
  }, []);
  return (
    <View style={[s.bubbleRow, s.bubbleRowLeft]}>
      <View style={s.assistantAvatar}>
        <Text style={s.assistantAvatarText}>✦</Text>
      </View>
      <View style={[s.bubble, s.bubbleAssistant, { paddingHorizontal: 16, paddingVertical: 14 }]}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {[d1, d2, d3].map((dot, i) => (
            <Animated.View key={i} style={[s.typingDot, { opacity: dot }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[s.bubbleRow, isUser ? s.bubbleRowRight : s.bubbleRowLeft]}>
      {!isUser && (
        <View style={s.assistantAvatar}>
          <Text style={s.assistantAvatarText}>✦</Text>
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
        <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{msg.content}</Text>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AskClaude() {
  const insets = useSafeAreaInsets();
  const [apiKey,       setApiKey]       = useState('');
  const [keyInput,     setKeyInput]     = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [invalidKey,   setInvalidKey]   = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [ctxData,      setCtxData]      = useState({ streak: 0, todayLogged: false, consistency: null });
  const listRef = useRef(null);

  useEffect(() => {
    Promise.all([
      get('api_key', ''),
      get('chat_history', []),
      getStreakCount(),
      loadCheckin(getTodayKey()),
      getRecentCheckins(7),
    ]).then(([k, h, streak, today, recent]) => {
      setApiKey(k || '');
      setMessages(h || []);
      const todayLogged = !!(today?.oralMinoxidil !== null && today?.oralMinoxidil !== undefined);
      const consistency = recent.length
        ? Math.round((recent.filter(c => c.oralMinoxidil && c.topicalMinoxidil).length / recent.length) * 100)
        : null;
      setCtxData({ streak, todayLogged, consistency });
    });
  }, []);

  useEffect(() => {
    if (!messages.length && !loading) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, loading]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => { setKeyboardHeight(e.endCoordinates.height); setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const openKeyModal = useCallback(() => { setShowKeyModal(true); setError(''); }, []);

  const saveKey = async () => {
    const k = keyInput.trim().replace(/\s+/g, '');
    if (!k.startsWith('sk-ant-')) { setError('Key must start with sk-ant-'); return; }
    await set('api_key', k);
    setApiKey(k); setShowKeyModal(false); setKeyInput(''); setError(''); setInvalidKey(false);
  };

  const removeKey = async () => {
    await set('api_key', ''); setApiKey(''); setShowKeyModal(false);
  };

  const send = async (text) => {
    if (!apiKey) { openKeyModal(); return; }
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput(''); setError('');
    const ctx = await buildContext();
    const displayMsg = { role: 'user', content: userText };
    const history = [...messages, displayMsg];
    setMessages(history);
    setLoading(true);
    const systemWithCtx = ctx ? SYSTEM_PROMPT + ctx : SYSTEM_PROMPT;
    const apiHistory = history.slice(-12).map(m => ({ role: m.role, content: m.content }));
    try {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: systemWithCtx, messages: apiHistory }),
      }, 40000);
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
    <View style={[s.root, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>

      {/* API Key Modal */}
      <Modal visible={showKeyModal} transparent animationType="slide" onRequestClose={() => setShowKeyModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowKeyModal(false)}>
          <Pressable style={[s.modalSheet, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <View style={s.modalIconRow}>
              <View style={s.modalIcon}>
                <Text style={s.modalIconText}>✦</Text>
              </View>
            </View>
            <Text style={s.modalTitle}>Anthropic API Key</Text>
            <Text style={s.modalSub}>Stored locally on your device. Only sent to api.anthropic.com.</Text>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              onSubmitEditing={saveKey}
              placeholder="sk-ant-api03-..."
              placeholderTextColor={color.faint}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              style={s.keyInput}
            />
            {!!error && <Text style={s.errorText}>{error}</Text>}
            <TouchableOpacity onPress={saveKey} style={s.saveKeyBtn} activeOpacity={0.8}>
              <Text style={s.saveKeyBtnText}>Save Key</Text>
            </TouchableOpacity>
            <View style={s.modalRow}>
              {!!apiKey && (
                <TouchableOpacity onPress={removeKey} style={[s.modalSecBtn, { flex: 1 }]} activeOpacity={0.8}>
                  <Text style={[s.modalSecBtnText, { color: color.red }]}>Remove Key</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowKeyModal(false)} style={[s.modalSecBtn, { flex: 1 }]} activeOpacity={0.8}>
                <Text style={[s.modalSecBtnText, { color: color.dim }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>AI hair coach · context loaded</Text>
              <Text style={s.title}>Ask Claude</Text>
            </View>
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
          <TouchableOpacity onPress={openKeyModal} style={s.modelPill} activeOpacity={0.7}>
            <View style={[s.pillDot, { backgroundColor: apiKey ? color.green : color.warmA }]} />
            <Text style={[s.pillText, { color: apiKey ? color.green : color.warmA }]}>
              {apiKey ? `${MODEL_SHORT} · connected` : 'Tap to set API key'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>

      {/* Empty state */}
      {isEmpty && !loading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.emptyScroll, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.iconWrap}>
            <AIGlowIcon />
            <Text style={s.emptyTitle}>Your AI Hair Coach</Text>
            <Text style={s.emptySub}>Protocol, bloodwork gaps, and tracked data{'\n'}pre-loaded into every message.</Text>
          </View>

          {/* Context chips */}
          <View style={s.chipsRow}>
            <View style={s.chip}>
              <Text style={s.chipIcon}>🔥</Text>
              <Text style={s.chipText}>{ctxData.streak}d streak</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipIcon}>{ctxData.todayLogged ? '✓' : '○'}</Text>
              <Text style={s.chipText}>{ctxData.todayLogged ? 'Today logged' : 'Not logged'}</Text>
            </View>
            {ctxData.consistency !== null && (
              <View style={s.chip}>
                <Text style={s.chipIcon}>📊</Text>
                <Text style={s.chipText}>{ctxData.consistency}% 7d</Text>
              </View>
            )}
          </View>

          {/* Quick asks — 2×2 grid */}
          <Text style={s.sectionLabel}>ASK ME ABOUT</Text>
          <View style={s.quickGrid}>
            {QUICK_ASKS.map(({ q, icon }) => (
              <TouchableOpacity key={q} onPress={() => send(q)} style={s.quickCard} activeOpacity={0.7}>
                <Text style={s.quickIcon}>{icon}</Text>
                <Text style={s.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Messages */
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MsgBubble msg={item} />}
          contentContainerStyle={[s.msgList, { paddingBottom: insets.bottom + 110 }]}
          style={s.msgFlatList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            <>
              {loading && <TypingIndicator />}
              {invalidKey && !loading && (
                <TouchableOpacity onPress={openKeyModal} style={s.invalidKeyBanner} activeOpacity={0.8}>
                  <Text style={s.invalidKeyBannerText}>⚠ API key invalid or expired — tap to re-enter</Text>
                </TouchableOpacity>
              )}
              {error && !invalidKey && (
                <View style={s.errorBox}>
                  <Text style={s.errorBoxText}>Error: {error}</Text>
                </View>
              )}
            </>
          }
        />
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: keyboardHeight > 0 ? 12 : insets.bottom + 90 }]}>
        <View style={s.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            placeholder="Ask about your protocol..."
            placeholderTextColor={color.faint}
            multiline
            style={s.textInput}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={loading || !input.trim()}
            style={[s.sendBtn, { backgroundColor: !loading && input.trim() ? color.warmA : color.card2 }]}
            activeOpacity={0.8}
          >
            <Text style={[s.sendBtnText, { color: !loading && input.trim() ? '#1A1000' : color.faint }]}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },

  // Header
  header:    { paddingHorizontal: 20, paddingBottom: 12, flexShrink: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow:   { ...type.eyebrow, marginBottom: 4 },
  title:     { ...type.screenTitle },
  clearBtn:      { backgroundColor: color.card, borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 8, marginTop: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  clearBtnText:  { ...type.eyebrow, fontSize: 12, color: color.dim },
  modelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pillDot:   { width: 6, height: 6, borderRadius: 3 },
  pillText:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },

  // Empty state
  emptyScroll: { paddingHorizontal: 20, paddingTop: 8 },
  iconWrap:    { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  emptyTitle:  { ...type.heading, fontSize: 22, marginTop: 16, textAlign: 'center' },
  emptySub:    { fontSize: 14, color: color.dim, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 28, flexWrap: 'wrap' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: color.card, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '600', color: color.txt },

  sectionLabel: { ...type.eyebrow, marginBottom: 12 },

  // Quick asks — 2×2 grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '48%',
    backgroundColor: color.card, borderRadius: radius.stat,
    padding: 14, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
    borderLeftWidth: 2, borderLeftColor: color.warmA,
  },
  quickIcon: { fontSize: 20 },
  quickText: { fontSize: 13, fontWeight: '500', color: color.txt, lineHeight: 18 },

  // Messages
  msgFlatList: { flex: 1 },
  msgList:     { paddingHorizontal: 16, paddingTop: 12, gap: 10 },

  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft:  { justifyContent: 'flex-start' },

  assistantAvatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: color.warmA, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  assistantAvatarText: { fontSize: 12, color: '#1A1000' },

  bubble:          { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleUser:      { backgroundColor: 'rgba(255,176,32,0.18)', borderBottomRightRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,176,32,0.35)' },
  bubbleAssistant: { backgroundColor: color.card, borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, borderLeftWidth: 2.5, borderLeftColor: color.warmA },
  bubbleText:      { fontSize: 15, color: color.txt, lineHeight: 22 },
  bubbleTextUser:  { color: color.txt },

  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.warmA },

  // Input bar
  inputBar:  { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, backgroundColor: color.bg },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: color.card, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line2 },
  textInput: { flex: 1, fontSize: 15, color: color.txt, maxHeight: 120, paddingVertical: 4, lineHeight: 22 },
  sendBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnText:{ fontSize: 18, fontWeight: '700', marginTop: -1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: color.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: color.line2, alignSelf: 'center', marginBottom: 20 },
  modalIconRow: { alignItems: 'center', marginBottom: 14 },
  modalIcon:    { width: 48, height: 48, borderRadius: 24, backgroundColor: color.warmA, alignItems: 'center', justifyContent: 'center' },
  modalIconText:{ fontSize: 18, color: '#1A1000' },
  modalTitle:   { ...type.heading, marginBottom: 6, textAlign: 'center' },
  modalSub:     { fontSize: 13, color: color.dim, marginBottom: 20, lineHeight: 19, textAlign: 'center' },
  keyInput:     { backgroundColor: color.card2, borderRadius: radius.row, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: color.txt, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  errorText:    { fontSize: 12, color: color.red, marginBottom: 10 },
  saveKeyBtn:   { backgroundColor: color.warmA, height: 52, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  saveKeyBtnText:{ fontSize: 16, fontWeight: '700', color: '#1A1000' },
  modalRow:     { flexDirection: 'row', gap: 8 },
  modalSecBtn:  { backgroundColor: color.card2, height: 48, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center' },
  modalSecBtnText:{ fontSize: 14, fontWeight: '600' },

  // Error/warning banners
  invalidKeyBanner:    { marginHorizontal: 8, marginTop: 4, backgroundColor: 'rgba(255,176,32,0.10)', borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,176,32,0.4)' },
  invalidKeyBannerText:{ fontSize: 13, color: color.warmA, fontWeight: '600', textAlign: 'center' },
  errorBox:            { marginHorizontal: 8, marginTop: 4, backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: color.red },
  errorBoxText:        { fontSize: 12, color: color.red, fontWeight: '500' },
});
