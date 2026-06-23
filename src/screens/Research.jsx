import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Animated, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getCachedOrFreshResearch, fetchCommunityViaAI } from '../services/ai';
import { searchPubMed, DEFAULT_PUBMED_QUERY } from '../services/pubmed';
import { searchOpenAlex, DEFAULT_OPENALEX_QUERY } from '../services/openalex';
import { searchClinicalTrials, DEFAULT_TRIALS_QUERY, getTrialStatus } from '../services/clinicaltrials';
import { DEFAULT_COMMUNITY_SUBS, ALL_COMMUNITY_SUBS } from '../services/reddit';
import StudyReaderModal from '../components/modals/StudyReaderModal';
import AddToProtocolSheet from '../components/sheets/AddToProtocolSheet';
import Segmented from '../components/Segmented';
import { Star } from '../components/Icon';
import { addCustomProtocol, get, set } from '../utils/storage';
import { color, type, radius, space } from '../theme/tokens';

// Token-mapped source colors
const SOURCE_COLOR = {
  PubMed:       color.cool,
  OpenAlex:     color.purple,
  Reddit:       '#FF6314',
  ClinicalTrial:color.green,
  NewProduct:   color.warmA,
  Technique:    color.warmA,
};

const ACTION_META = {
  ask_doctor:      { label: 'Ask Dr.',    tint: color.red  },
  add_to_protocol: { label: '+ Protocol', tint: color.green },
  monitor:         { label: 'Monitor',    tint: color.warmA },
  informational:   { label: 'Info',       tint: color.faint },
};

const RELEVANCE_DOT = { HIGH: color.green, MEDIUM: color.warmA, LOW: color.faint };
const SAVED_KEY = 'research_saved_v2';
const TABS = ['For you', 'Papers', 'Trials', 'Reddit', 'Saved'];
const DEFAULT_PAPERS_QUERY = DEFAULT_PUBMED_QUERY.replace(/\d{4,}/g, '').trim();

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.pulsingDot, { opacity }]} />;
}

// ─── Trial status badge ───────────────────────────────────────────────────────

function TrialStatusBadge({ status }) {
  const { label, color: c } = getTrialStatus(status);
  return (
    <View style={[tsb.badge, { backgroundColor: c + '22', borderColor: c + '55' }]}>
      <View style={[tsb.dot, { backgroundColor: c }]} />
      <Text style={[tsb.label, { color: c }]}>{label}</Text>
    </View>
  );
}

// ─── Research card ────────────────────────────────────────────────────────────

function ResearchCard({ item, saved, onToggleSave, onRead, onAddToProtocol, forYou }) {
  const [open, setOpen] = useState(false);
  const srcColor   = SOURCE_COLOR[item.source] || color.faint;
  const relColor   = RELEVANCE_DOT[item.relevance] || color.faint;
  const actionMeta = ACTION_META[item.action] || ACTION_META.informational;
  const leftBorder = forYou ? color.warmA : srcColor;

  let subtitleLeft = null;
  if (item.isTrial)                           subtitleLeft = item.phases?.length ? `Phase ${item.phases.join('/')}` : 'Trial';
  else if (item.isOpenAlex && item.citedBy != null) subtitleLeft = `${item.citedBy} citations${item.isOpenAccess ? ' · Open access' : ''}`;
  else if (item.isReddit)                     subtitleLeft = `↑ ${item.score || '—'} · ${item.numComments || 0} comments · r/${item.subreddit || 'tressless'}`;
  else if (item.journal)                      subtitleLeft = `${item.journal}${item.pubDate ? ' · ' + item.pubDate : ''}`;

  return (
    <View style={[card.wrap, { borderLeftColor: leftBorder }]}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.75} style={card.touch}>
        <View style={card.topRow}>
          <View style={[card.srcBadge, { backgroundColor: srcColor + '18' }]}>
            <Text style={[card.srcTxt, { color: srcColor }]}>{item.source}</Text>
          </View>
          {item.relevance && !item.isTrial && <View style={[card.relDot, { backgroundColor: relColor }]} />}
          {item.isTrial && <TrialStatusBadge status={item.status} />}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onToggleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={card.bookmarkBtn}>
            <Star size={16} color={saved ? color.warmA : color.faint} filled={saved} />
          </TouchableOpacity>
          <Text style={[card.chevron, open && card.chevronOpen]}>›</Text>
        </View>

        {subtitleLeft && <Text style={card.subtitle} numberOfLines={1}>{subtitleLeft}</Text>}
        <Text style={card.title} numberOfLines={open ? undefined : 2}>{item.title}</Text>
        {item.authors && !open && <Text style={card.authors} numberOfLines={1}>{item.authors}</Text>}
      </TouchableOpacity>

      {open && (
        <View style={card.body}>
          {item.authors && <Text style={card.authors}>{item.authors}</Text>}

          {item.isTrial && item.interventions?.length > 0 && (
            <View style={card.tagRow}>
              {item.interventions.map((iv, i) => (
                <View key={i} style={[card.tag, { backgroundColor: color.green + '18' }]}>
                  <Text style={[card.tagTxt, { color: color.green }]}>{iv}</Text>
                </View>
              ))}
            </View>
          )}
          {item.isTrial && item.countries?.length > 0 && <Text style={card.metaLine}>{item.countries.join(', ')}</Text>}
          {item.isTrial && item.sponsor && <Text style={card.metaLine}>{item.sponsor}</Text>}

          {item.isReddit && item.tags?.length > 0 && (
            <View style={card.tagRow}>
              {item.tags.map((t, i) => (
                <View key={i} style={[card.tag, { backgroundColor: '#FF631418' }]}>
                  <Text style={[card.tagTxt, { color: '#FF6314' }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {item.isReddit && item.sentiment && (
            <Text style={[card.metaLine, { color: item.sentiment === 'positive' ? color.green : item.sentiment === 'negative' ? color.red : color.faint }]}>
              {item.sentiment === 'positive' ? '↑ Positive experience' : item.sentiment === 'negative' ? '↓ Negative experience' : '→ Neutral'}
            </Text>
          )}

          {!!item.summary && <Text style={card.summary}>{item.summary}</Text>}

          {/* "Why this matters" callout — shown on For you tab */}
          {forYou && !!item.relevance_reason && (
            <View style={card.whyCard}>
              <Text style={card.whyLabel}>WHY THIS MATTERS</Text>
              <Text style={card.whyTxt}>{item.relevance_reason}</Text>
            </View>
          )}
          {!forYou && !!item.relevance_reason && (
            <Text style={card.reason}>{item.relevance_reason}</Text>
          )}

          <View style={card.actionsRow}>
            <View style={[card.actionPill, { backgroundColor: actionMeta.tint + '18' }]}>
              <Text style={[card.actionTxt, { color: actionMeta.tint }]}>{actionMeta.label}</Text>
            </View>
            {item.url && (
              <TouchableOpacity onPress={() => onRead(item)} style={[card.readBtn, { backgroundColor: color.cool + '18' }]} activeOpacity={0.8}>
                <Text style={[card.readTxt, { color: color.cool }]}>{item.isTrial ? 'View trial ›' : 'Read in app ›'}</Text>
              </TouchableOpacity>
            )}
            {item.canAddToProtocol && (
              <TouchableOpacity onPress={() => onAddToProtocol(item)} style={[card.readBtn, { backgroundColor: color.green + '18' }]} activeOpacity={0.8}>
                <Text style={[card.readTxt, { color: color.green }]}>+ Protocol</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onToggleSave} style={[card.readBtn, { backgroundColor: saved ? color.warmA + '18' : color.card2 }]} activeOpacity={0.8}>
              <Text style={[card.readTxt, { color: saved ? color.warmA : color.faint }]}>{saved ? '★ Saved' : '☆ Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, onSubmit, placeholder, btnColor }) {
  const bc = btnColor || color.cool;
  return (
    <View style={sb.row}>
      <TextInput
        style={sb.input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        selectionColor={bc}
      />
      <TouchableOpacity onPress={onSubmit} style={[sb.btn, { backgroundColor: bc }]} activeOpacity={0.8}>
        <Text style={sb.btnTxt}>Search</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Subreddit selector ───────────────────────────────────────────────────────

function SubSelector({ selected, onToggle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
      {ALL_COMMUNITY_SUBS.map(sub => {
        const active = selected.includes(sub);
        return (
          <TouchableOpacity key={sub} onPress={() => onToggle(sub)} style={[ss.pill, active && ss.pillActive]} activeOpacity={0.75}>
            <Text style={[ss.pillTxt, active && ss.pillTxtActive]}>r/{sub}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Section hdr (internal) ───────────────────────────────────────────────────

function SectionHdr({ label, count, loading, tint }) {
  const c = tint || color.faint;
  return (
    <View style={sh.row}>
      {loading && <ActivityIndicator size="small" color={c} style={{ marginRight: 6 }} />}
      <Text style={[sh.label, { color: c }]}>{label}</Text>
      {count != null && <Text style={sh.count}>{count}</Text>}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon, title, sub }) {
  return (
    <View style={em.wrap}>
      <Text style={em.icon}>{icon}</Text>
      <Text style={em.title}>{title}</Text>
      {sub && <Text style={em.sub}>{sub}</Text>}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Research() {
  const insets = useSafeAreaInsets();

  const [aiItems,        setAiItems]        = useState([]);
  const [pubmedItems,    setPubmedItems]    = useState([]);
  const [openAlexItems,  setOpenAlexItems]  = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [trialItems,     setTrialItems]     = useState([]);
  const [savedItems,     setSavedItems]     = useState([]);

  const [aiLoading,        setAiLoading]        = useState(false);
  const [papersLoading,    setPapersLoading]    = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [trialsLoading,    setTrialsLoading]    = useState(false);

  const [aiError,        setAiError]        = useState('');
  const [noApiKey,       setNoApiKey]       = useState(false);
  const [communityNoKey, setCommunityNoKey] = useState(false);
  const [aiCachedAt,     setAiCachedAt]     = useState(null);
  const [fromCache,      setFromCache]      = useState(false);

  const [activeTab,      setActiveTab]      = useState('For you');
  const [papersInput,    setPapersInput]    = useState(DEFAULT_PAPERS_QUERY);
  const [communityInput, setCommunityInput] = useState('');
  const [trialsInput,    setTrialsInput]    = useState(DEFAULT_TRIALS_QUERY);
  const [selectedSubs,   setSelectedSubs]   = useState(DEFAULT_COMMUNITY_SUBS);
  const [readerItem,     setReaderItem]     = useState(null);
  const [sheetItem,      setSheetItem]      = useState(null);
  const [sheetCb,        setSheetCb]        = useState(null);
  const [sheetCancelCb,  setSheetCancelCb]  = useState(null);

  const loadAI = useCallback(async (force = false) => {
    setAiLoading(true); setAiError(''); setNoApiKey(false);
    const result = await getCachedOrFreshResearch(force);
    if (!result || result.noApiKey)  setNoApiKey(true);
    else if (result.apiError)        setAiError(result.errorDetail || 'Search failed.');
    else { setAiItems(result.items || []); setAiCachedAt(result.fetchedAt); setFromCache(result.fromCache); }
    setAiLoading(false);
  }, []);

  const loadPapers = useCallback(async (query = DEFAULT_PAPERS_QUERY) => {
    setPapersLoading(true);
    const [pm, oa] = await Promise.all([searchPubMed(query), searchOpenAlex(query)]);
    setPubmedItems(pm); setOpenAlexItems(oa);
    setPapersLoading(false);
  }, []);

  const loadCommunity = useCallback(async ({ force = false, query = '', subs = DEFAULT_COMMUNITY_SUBS } = {}) => {
    setCommunityLoading(true); setCommunityNoKey(false);
    const result = await fetchCommunityViaAI({ forceRefresh: force, query, subreddits: subs });
    if (result.noApiKey) setCommunityNoKey(true);
    else if (!result.apiError) setCommunityItems(result.items || []);
    setCommunityLoading(false);
  }, []);

  const loadTrials = useCallback(async (query = DEFAULT_TRIALS_QUERY) => {
    setTrialsLoading(true);
    setTrialItems(await searchClinicalTrials(query));
    setTrialsLoading(false);
  }, []);

  const loadSaved = useCallback(async () => {
    const saved = await get(SAVED_KEY, []);
    setSavedItems(Array.isArray(saved) ? saved : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAI(false); loadPapers(); loadCommunity(); loadTrials(); loadSaved();
    }, [loadAI, loadPapers, loadCommunity, loadTrials, loadSaved])
  );

  const toggleSave = async (item) => {
    const current = await get(SAVED_KEY, []);
    const existing = Array.isArray(current) ? current : [];
    const idx = existing.findIndex(x => (x.id && x.id === item.id) || x.title === item.title);
    const next = idx >= 0 ? existing.filter((_, i) => i !== idx) : [item, ...existing];
    await set(SAVED_KEY, next);
    setSavedItems(next);
  };

  const isSaved = (item) => savedItems.some(x => (x.id && x.id === item.id) || x.title === item.title);

  const handleAddToProtocol = (item) => {
    setSheetItem(item);
    setSheetCb(() => async () => { await addCustomProtocol({ name: item.title, source: item.source }); setSheetItem(null); });
    setSheetCancelCb(() => () => setSheetItem(null));
  };

  const toggleSub = (sub) => {
    setSelectedSubs(prev =>
      prev.includes(sub) ? (prev.length > 1 ? prev.filter(s => s !== sub) : prev) : [...prev, sub]
    );
  };

  const renderCard = (item, i, { forYou = false } = {}) => (
    <ResearchCard
      key={item.id || item.title || i}
      item={item}
      saved={isSaved(item)}
      onToggleSave={() => toggleSave(item)}
      onRead={setReaderItem}
      onAddToProtocol={handleAddToProtocol}
      forYou={forYou}
    />
  );

  const cachedLabel = aiCachedAt
    ? `${fromCache ? 'Cached' : 'Updated'} ${new Date(aiCachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(aiCachedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: color.bg }}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={s.eyebrowRow}>
              <PulsingDot />
              <Text style={s.eyebrow}>curated for you · PubMed · Trials · Reddit</Text>
            </View>
            <Text style={s.title}>Research</Text>
            {cachedLabel && <Text style={s.cachedLabel}>{cachedLabel}</Text>}
          </View>
          <TouchableOpacity onPress={() => loadAI(true)} disabled={aiLoading} style={s.refreshBtn} activeOpacity={0.8}>
            {aiLoading
              ? <ActivityIndicator size="small" color={color.warmA} />
              : <Text style={s.refreshTxt}>↻</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Segmented tabs */}
        <View style={s.tabsWrap}>
          <Segmented
            options={TABS.map(t => t === 'Saved' && savedItems.length > 0 ? `${t} ${savedItems.length}` : t)}
            selected={activeTab === 'Saved' && savedItems.length > 0 ? `Saved ${savedItems.length}` : activeTab}
            onSelect={(opt) => setActiveTab(opt.startsWith('Saved') ? 'Saved' : opt)}
          />
        </View>

        {/* For you — AI picks with warm border */}
        {activeTab === 'For you' && (
          <>
            <SectionHdr label="AI PICKS" loading={aiLoading} tint={color.warmA} count={aiLoading ? null : aiItems.length} />
            {noApiKey && <Empty icon="🔑" title="API key needed" sub="Set your Claude API key in the Ask Claude tab." />}
            {aiError && !noApiKey && (
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>{aiError}</Text>
                <TouchableOpacity onPress={() => loadAI(true)} style={s.retryBtn} activeOpacity={0.8}>
                  <Text style={s.retryTxt}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
            {!aiLoading && !noApiKey && !aiError && aiItems.length === 0 && (
              <Empty icon="✦" title="No AI picks yet" sub="Tap ↻ to load curated research." />
            )}
            {aiItems.map((item, i) => renderCard(item, i, { forYou: true }))}

            <SectionHdr label="TOP PAPERS" loading={papersLoading} tint={color.cool} count={papersLoading ? null : pubmedItems.length + openAlexItems.length} />
            {pubmedItems.slice(0, 2).map((item, i) => renderCard(item, i))}
            {openAlexItems.slice(0, 2).map((item, i) => renderCard(item, i))}

            <SectionHdr label="COMMUNITY" loading={communityLoading} tint="#FF6314" count={communityLoading ? null : communityItems.length} />
            {!communityLoading && communityItems.length === 0 && <Empty icon="📭" title="No posts" sub="Switch to Reddit tab to search." />}
            {communityItems.slice(0, 3).map((item, i) => renderCard(item, i))}

            <SectionHdr label="CLINICAL TRIALS" loading={trialsLoading} tint={color.green} count={trialsLoading ? null : trialItems.length} />
            {trialItems.slice(0, 2).map((item, i) => renderCard(item, i))}
          </>
        )}

        {/* Papers */}
        {activeTab === 'Papers' && (
          <>
            <SectionHdr label="SEARCH PAPERS" tint={color.cool} />
            <SearchBar
              value={papersInput}
              onChange={setPapersInput}
              onSubmit={() => { Keyboard.dismiss(); loadPapers(papersInput.trim() || DEFAULT_PAPERS_QUERY); }}
              placeholder="e.g. dutasteride androgenetic alopecia"
              btnColor={color.cool}
            />
            <Text style={s.metaHint}>PubMed · OpenAlex · free · no API key needed</Text>
            {papersLoading && (
              <View style={s.loadingRow}>
                <ActivityIndicator color={color.cool} />
                <Text style={s.loadingTxt}>Searching papers…</Text>
              </View>
            )}
            {!papersLoading && (
              <>
                <SectionHdr label="PUBMED" tint={color.cool} count={pubmedItems.length} />
                {pubmedItems.length === 0 ? <Empty icon="📄" title="No PubMed results" sub="Try broader keywords." /> : pubmedItems.map((item, i) => renderCard(item, i))}
                <SectionHdr label="OPENALEX — BY CITATIONS" tint={color.purple} count={openAlexItems.length} />
                {openAlexItems.length === 0 ? <Empty icon="📄" title="No OpenAlex results" /> : openAlexItems.map((item, i) => renderCard(item, i))}
              </>
            )}
          </>
        )}

        {/* Trials */}
        {activeTab === 'Trials' && (
          <>
            <SectionHdr label="CLINICAL TRIALS" tint={color.green} />
            <SearchBar
              value={trialsInput}
              onChange={setTrialsInput}
              onSubmit={() => { Keyboard.dismiss(); loadTrials(trialsInput.trim() || DEFAULT_TRIALS_QUERY); }}
              placeholder="e.g. androgenetic alopecia minoxidil"
              btnColor={color.green}
            />
            <Text style={s.metaHint}>ClinicalTrials.gov · free · no API key</Text>
            {trialsLoading && (
              <View style={s.loadingRow}>
                <ActivityIndicator color={color.green} />
                <Text style={s.loadingTxt}>Searching ClinicalTrials.gov…</Text>
              </View>
            )}
            {!trialsLoading && trialItems.length === 0 && <Empty icon="🔬" title="No trials found" sub="Try 'hair loss' or 'alopecia'." />}
            {!trialsLoading && trialItems.length > 0 && (() => {
              const recruiting = trialItems.filter(t => t.status === 'RECRUITING' || t.status === 'NOT_YET_RECRUITING');
              const active     = trialItems.filter(t => t.status === 'ACTIVE_NOT_RECRUITING' || t.status === 'ENROLLING_BY_INVITATION');
              const other      = trialItems.filter(t => !['RECRUITING','NOT_YET_RECRUITING','ACTIVE_NOT_RECRUITING','ENROLLING_BY_INVITATION'].includes(t.status));
              return (
                <>
                  {recruiting.length > 0 && <><Text style={s.groupLabel}>CURRENTLY RECRUITING</Text>{recruiting.map((item, i) => renderCard(item, i))}</>}
                  {active.length > 0 && <><Text style={s.groupLabel}>ACTIVE</Text>{active.map((item, i) => renderCard(item, i))}</>}
                  {other.length > 0 && <><Text style={s.groupLabel}>COMPLETED / OTHER</Text>{other.map((item, i) => renderCard(item, i))}</>}
                </>
              );
            })()}
          </>
        )}

        {/* Reddit */}
        {activeTab === 'Reddit' && (
          <>
            <SectionHdr label="COMMUNITY SEARCH" tint="#FF6314" />
            <SearchBar
              value={communityInput}
              onChange={setCommunityInput}
              onSubmit={() => { Keyboard.dismiss(); loadCommunity({ force: true, query: communityInput.trim(), subs: selectedSubs }); }}
              placeholder="e.g. oral minoxidil 6 month update"
              btnColor="#FF6314"
            />
            <SubSelector selected={selectedSubs} onToggle={toggleSub} />
            <Text style={s.metaHint}>Searching via Claude AI web search · 6h cache on default query</Text>
            {communityLoading && (
              <View style={s.loadingRow}>
                <ActivityIndicator color="#FF6314" />
                <Text style={s.loadingTxt}>Searching communities…</Text>
              </View>
            )}
            {communityNoKey && <Empty icon="🔑" title="API key needed" sub="Set your Claude API key in the Ask Claude tab." />}
            {!communityLoading && !communityNoKey && communityItems.length === 0 && <Empty icon="📭" title="No posts found" sub="Try a search above." />}
            {communityItems.map((item, i) => renderCard(item, i))}
            {!communityLoading && communityItems.length > 0 && (
              <TouchableOpacity
                onPress={() => loadCommunity({ force: true, query: communityInput.trim(), subs: selectedSubs })}
                style={s.retryBtn}
                activeOpacity={0.8}
              >
                <Text style={s.retryTxt}>↻ Refresh community posts</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Saved */}
        {activeTab === 'Saved' && (
          <>
            <SectionHdr label="SAVED ARTICLES" count={savedItems.length} />
            {savedItems.length === 0 && <Empty icon="★" title="Nothing saved yet" sub="Tap ☆ on any card to bookmark it here." />}
            {savedItems.map((item, i) => renderCard(item, i))}
          </>
        )}
      </ScrollView>

      <StudyReaderModal item={readerItem} visible={!!readerItem} onClose={() => setReaderItem(null)} />
      <AddToProtocolSheet
        item={sheetItem}
        visible={!!sheetItem}
        onConfirm={async () => { if (sheetCb) await sheetCb(); }}
        onCancel={() => { if (sheetCancelCb) sheetCancelCb(); }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  eyebrow: { ...type.eyebrow, color: color.warmA },
  title: { ...type.screenTitle },
  cachedLabel: { fontSize: 10, color: color.faint, marginTop: 4 },
  refreshBtn: { backgroundColor: color.card, padding: 10, borderRadius: radius.row, marginTop: 14, width: 40, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  refreshTxt: { fontSize: 18, color: color.warmA },
  tabsWrap: { marginBottom: 20 },
  pulsingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.warmA },
  errorBox: { backgroundColor: color.card, borderRadius: radius.row, padding: 16, gap: 12, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  errorTxt: { fontSize: 13, color: color.dim, lineHeight: 19 },
  retryBtn: { backgroundColor: color.card2, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, marginBottom: 8 },
  retryTxt: { fontSize: 13, fontWeight: '600', color: color.warmA },
  metaHint: { fontSize: 10, color: color.faint, marginBottom: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingTxt: { fontSize: 14, color: color.dim },
  groupLabel: { ...type.eyebrow, marginTop: 16, marginBottom: 8 },
});

const card = StyleSheet.create({
  wrap: { backgroundColor: color.card, borderRadius: radius.row, marginBottom: 10, borderLeftWidth: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  touch: { padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  srcBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  srcTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  relDot: { width: 6, height: 6, borderRadius: 3 },
  bookmarkBtn: { marginLeft: 4 },
  chevron: { fontSize: 18, color: color.faint, marginLeft: 2, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  subtitle: { fontSize: 10, color: color.faint, marginBottom: 5 },
  title: { fontSize: 15, fontWeight: '700', color: color.txt, lineHeight: 21 },
  authors: { fontSize: 11, color: color.faint, marginTop: 4, lineHeight: 15 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  tagTxt: { fontSize: 10, fontWeight: '600' },
  metaLine: { fontSize: 11, color: color.dim, marginBottom: 4 },
  summary: { fontSize: 13, color: color.dim, lineHeight: 19, marginBottom: 8, marginTop: 4 },
  reason: { fontSize: 12, color: color.faint, fontStyle: 'italic', lineHeight: 17, marginBottom: 10 },
  whyCard: { backgroundColor: 'rgba(255,176,32,0.08)', borderRadius: 8, padding: 10, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: color.warmA },
  whyLabel: { ...type.eyebrow, color: color.warmA, fontSize: 8, marginBottom: 4 },
  whyTxt: { fontSize: 12, color: color.txt, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  actionTxt: { fontSize: 11, fontWeight: '700' },
  readBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  readTxt: { fontSize: 11, fontWeight: '700' },
});

const tsb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  dot:   { width: 5, height: 5, borderRadius: 2.5 },
  label: { fontSize: 10, fontWeight: '700' },
});

const sb = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: color.card, borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: color.txt, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  btn:   { borderRadius: radius.row, paddingHorizontal: 16, justifyContent: 'center' },
  btnTxt:{ fontSize: 14, fontWeight: '700', color: '#fff' },
});

const ss = StyleSheet.create({
  pill:       { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: color.card, borderRadius: radius.full, borderWidth: 1, borderColor: color.line },
  pillActive: { backgroundColor: '#FF631418', borderColor: '#FF6314' },
  pillTxt:    { fontSize: 12, fontWeight: '600', color: color.faint },
  pillTxtActive:{ color: '#FF6314' },
});

const sh = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  label: { ...type.eyebrow },
  count: { fontSize: 11, color: color.faint, marginLeft: 6 },
});

const em = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  icon:  { fontSize: 32, marginBottom: 10 },
  title: { ...type.bodyStrong, fontSize: 16, marginBottom: 6 },
  sub:   { fontSize: 13, color: color.dim, textAlign: 'center', lineHeight: 18 },
});
