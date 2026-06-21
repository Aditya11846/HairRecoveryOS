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
import { addCustomProtocol, get, set } from '../utils/storage';
import { C } from '../theme';

const SOURCE_COLORS = {
  PubMed:       '#3B82F6',
  OpenAlex:     '#8B5CF6',
  Reddit:       '#FF6314',
  ClinicalTrial:'#10B981',
  NewProduct:   '#06B6D4',
  Technique:    '#06B6D4',
};

const ACTION_META = {
  ask_doctor:      { label: 'Ask Dr.',    color: C.red    },
  add_to_protocol: { label: '+ Protocol', color: C.green  },
  monitor:         { label: 'Monitor',    color: C.orange },
  informational:   { label: 'Info',       color: C.sub    },
};

const RELEVANCE_COLORS = { HIGH: C.green, MEDIUM: C.orange, LOW: C.sub };
const SAVED_KEY = 'research_saved_v2';
const TABS = ['All', 'AI Picks', 'Papers', 'Community', 'Trials', 'Saved'];
const DEFAULT_PAPERS_QUERY = DEFAULT_PUBMED_QUERY.replace(/\d{4,}/g, '').trim();

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot({ color = C.accent }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.pulsingDot, { backgroundColor: color, opacity }]} />;
}

// ─── Trial status badge ───────────────────────────────────────────────────────

function TrialStatusBadge({ status }) {
  const { label, color } = getTrialStatus(status);
  return (
    <View style={[tsb.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[tsb.dot, { backgroundColor: color }]} />
      <Text style={[tsb.label, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Research card ────────────────────────────────────────────────────────────

function ResearchCard({ item, saved, onToggleSave, onRead, onAddToProtocol }) {
  const [open, setOpen] = useState(false);
  const srcColor   = SOURCE_COLORS[item.source] || C.sub;
  const relColor   = RELEVANCE_COLORS[item.relevance] || C.sub;
  const actionMeta = ACTION_META[item.action] || ACTION_META.informational;

  // Subtitle line under source badge
  let subtitleLeft = null;
  if (item.isTrial) {
    subtitleLeft = item.phases?.length ? `Phase ${item.phases.join('/')}` : 'Trial';
  } else if (item.isOpenAlex && item.citedBy != null) {
    subtitleLeft = `📊 ${item.citedBy} citations${item.isOpenAccess ? ' · Open access' : ''}`;
  } else if (item.isReddit) {
    subtitleLeft = `↑ ${item.score || '—'}  · ${item.numComments || 0} comments · r/${item.subreddit || 'tressless'}`;
  } else if (item.journal) {
    subtitleLeft = `${item.journal}${item.pubDate ? ' · ' + item.pubDate : ''}`;
  }

  return (
    <View style={[card.wrap, { borderLeftColor: srcColor }]}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.75} style={card.touch}>
        {/* Top row */}
        <View style={card.topRow}>
          <View style={[card.srcBadge, { backgroundColor: srcColor + '22' }]}>
            <Text style={[card.srcTxt, { color: srcColor }]}>{item.source}</Text>
          </View>
          {item.relevance && !item.isTrial && (
            <View style={[card.relDot, { backgroundColor: relColor }]} />
          )}
          {item.isTrial && <TrialStatusBadge status={item.status} />}
          <View style={{ flex: 1 }} />
          {/* Bookmark — always visible */}
          <TouchableOpacity
            onPress={onToggleSave}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={card.bookmarkBtn}
          >
            <Text style={saved ? card.bookmarkOn : card.bookmarkOff}>
              {saved ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
          <Text style={[card.chevron, open && card.chevronOpen]}>›</Text>
        </View>

        {/* Subtitle */}
        {subtitleLeft && (
          <Text style={card.subtitle} numberOfLines={1}>{subtitleLeft}</Text>
        )}

        {/* Title */}
        <Text style={card.title} numberOfLines={open ? undefined : 2}>{item.title}</Text>

        {/* Authors (collapsed only) */}
        {item.authors && !open && (
          <Text style={card.authors} numberOfLines={1}>{item.authors}</Text>
        )}
      </TouchableOpacity>

      {/* Expanded body */}
      {open && (
        <View style={card.body}>
          {item.authors ? <Text style={card.authors}>{item.authors}</Text> : null}

          {/* Trial-specific */}
          {item.isTrial && item.interventions?.length > 0 && (
            <View style={card.tagRow}>
              {item.interventions.map((iv, i) => (
                <View key={i} style={[card.tag, { backgroundColor: '#10B98122' }]}>
                  <Text style={[card.tagTxt, { color: '#10B981' }]}>{iv}</Text>
                </View>
              ))}
            </View>
          )}
          {item.isTrial && item.countries?.length > 0 && (
            <Text style={card.metaLine}>📍 {item.countries.join(', ')}</Text>
          )}
          {item.isTrial && item.sponsor ? (
            <Text style={card.metaLine}>🏛 {item.sponsor}</Text>
          ) : null}

          {/* Reddit tags */}
          {item.isReddit && item.tags?.length > 0 && (
            <View style={card.tagRow}>
              {item.tags.map((t, i) => (
                <View key={i} style={[card.tag, { backgroundColor: '#FF631422' }]}>
                  <Text style={[card.tagTxt, { color: '#FF6314' }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {item.isReddit && item.sentiment && (
            <Text style={[card.metaLine, { color: item.sentiment === 'positive' ? C.green : item.sentiment === 'negative' ? C.red : C.sub }]}>
              {item.sentiment === 'positive' ? '↑ Positive experience' : item.sentiment === 'negative' ? '↓ Negative experience' : '→ Neutral'}
            </Text>
          )}

          {/* Summary */}
          {!!item.summary && <Text style={card.summary}>{item.summary}</Text>}
          {!!item.relevance_reason && !item.isTrial && (
            <Text style={card.reason}>{item.relevance_reason}</Text>
          )}

          {/* Action row */}
          <View style={card.actionsRow}>
            <View style={[card.actionPill, { backgroundColor: actionMeta.color + '22' }]}>
              <Text style={[card.actionTxt, { color: actionMeta.color }]}>{actionMeta.label}</Text>
            </View>
            {item.url ? (
              <TouchableOpacity onPress={() => onRead(item)} style={card.readBtn} activeOpacity={0.8}>
                <Text style={card.readTxt}>{item.isTrial ? 'View trial ›' : 'Read in app ›'}</Text>
              </TouchableOpacity>
            ) : null}
            {item.canAddToProtocol && (
              <TouchableOpacity onPress={() => onAddToProtocol(item)} style={[card.readBtn, { backgroundColor: C.green + '22' }]} activeOpacity={0.8}>
                <Text style={[card.readTxt, { color: C.green }]}>+ Protocol</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onToggleSave} style={[card.readBtn, { backgroundColor: saved ? C.accent + '22' : '#2C2C2E' }]} activeOpacity={0.8}>
              <Text style={[card.readTxt, { color: saved ? C.accent : C.sub }]}>{saved ? '★ Saved' : '☆ Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Shared search bar ────────────────────────────────────────────────────────

function SearchBar({ value, onChange, onSubmit, placeholder, btnColor = C.accent }) {
  return (
    <View style={sb.row}>
      <TextInput
        style={sb.input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor="#3A3A3C"
        selectionColor={btnColor}
      />
      <TouchableOpacity onPress={onSubmit} style={[sb.btn, { backgroundColor: btnColor }]} activeOpacity={0.8}>
        <Text style={sb.btnTxt}>Search</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Subreddit selector pills ─────────────────────────────────────────────────

function SubSelector({ selected, onToggle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
      {ALL_COMMUNITY_SUBS.map(sub => {
        const active = selected.includes(sub);
        return (
          <TouchableOpacity
            key={sub}
            onPress={() => onToggle(sub)}
            style={[ss.pill, active && ss.pillActive]}
            activeOpacity={0.75}
          >
            <Text style={[ss.pillTxt, active && ss.pillTxtActive]}>r/{sub}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHdr({ label, count, loading, color = C.sub }) {
  return (
    <View style={sh.row}>
      {loading && <ActivityIndicator size="small" color={color} style={{ marginRight: 6 }} />}
      <Text style={[sh.label, { color }]}>{label}</Text>
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
      {sub ? <Text style={em.sub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Research() {
  const insets = useSafeAreaInsets();

  const [aiItems,       setAiItems]       = useState([]);
  const [pubmedItems,   setPubmedItems]   = useState([]);
  const [openAlexItems, setOpenAlexItems] = useState([]);
  const [communityItems,setCommunityItems]= useState([]);
  const [trialItems,    setTrialItems]    = useState([]);
  const [savedItems,    setSavedItems]    = useState([]);

  const [aiLoading,        setAiLoading]        = useState(false);
  const [papersLoading,    setPapersLoading]    = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [trialsLoading,    setTrialsLoading]    = useState(false);

  const [aiError,       setAiError]       = useState('');
  const [noApiKey,      setNoApiKey]      = useState(false);
  const [communityNoKey,setCommunityNoKey]= useState(false);
  const [aiCachedAt,    setAiCachedAt]    = useState(null);
  const [fromCache,     setFromCache]     = useState(false);

  const [activeTab,      setActiveTab]      = useState('All');
  const [papersInput,    setPapersInput]    = useState(DEFAULT_PAPERS_QUERY);
  const [communityInput, setCommunityInput] = useState('');
  const [trialsInput,    setTrialsInput]    = useState(DEFAULT_TRIALS_QUERY);
  const [selectedSubs,   setSelectedSubs]   = useState(DEFAULT_COMMUNITY_SUBS);
  const [readerItem,     setReaderItem]     = useState(null);
  const [sheetItem,      setSheetItem]      = useState(null);
  const [sheetCb,        setSheetCb]        = useState(null);
  const [sheetCancelCb,  setSheetCancelCb]  = useState(null);

  const loadAI = useCallback(async (force = false) => {
    setAiLoading(true);
    setAiError('');
    setNoApiKey(false);
    const result = await getCachedOrFreshResearch(force);
    if (!result || result.noApiKey)        setNoApiKey(true);
    else if (result.apiError)              setAiError(result.errorDetail || 'Search failed.');
    else {
      setAiItems(result.items || []);
      setAiCachedAt(result.fetchedAt);
      setFromCache(result.fromCache);
    }
    setAiLoading(false);
  }, []);

  const loadPapers = useCallback(async (query = DEFAULT_PAPERS_QUERY) => {
    setPapersLoading(true);
    const [pm, oa] = await Promise.all([
      searchPubMed(query),
      searchOpenAlex(query),
    ]);
    setPubmedItems(pm);
    setOpenAlexItems(oa);
    setPapersLoading(false);
  }, []);

  const loadCommunity = useCallback(async ({ force = false, query = '', subs = DEFAULT_COMMUNITY_SUBS } = {}) => {
    setCommunityLoading(true);
    setCommunityNoKey(false);
    const result = await fetchCommunityViaAI({ forceRefresh: force, query, subreddits: subs });
    if (result.noApiKey)  setCommunityNoKey(true);
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
      loadAI(false);
      loadPapers();
      loadCommunity();
      loadTrials();
      loadSaved();
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

  const isSaved = (item) =>
    savedItems.some(x => (x.id && x.id === item.id) || x.title === item.title);

  const handleAddToProtocol = (item) => {
    setSheetItem(item);
    setSheetCb(() => async () => { await addCustomProtocol(item.title, item.source); setSheetItem(null); });
    setSheetCancelCb(() => () => setSheetItem(null));
  };

  const toggleSub = (sub) => {
    setSelectedSubs(prev =>
      prev.includes(sub)
        ? prev.length > 1 ? prev.filter(s => s !== sub) : prev
        : [...prev, sub]
    );
  };

  const renderCard = (item, i) => (
    <ResearchCard
      key={item.id || item.title || i}
      item={item}
      saved={isSaved(item)}
      onToggleSave={() => toggleSave(item)}
      onRead={setReaderItem}
      onAddToProtocol={handleAddToProtocol}
    />
  );

  const cachedLabel = aiCachedAt
    ? `${fromCache ? 'Cached' : 'Updated'} ${new Date(aiCachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(aiCachedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.aiRow}>
                <PulsingDot />
                <Text style={styles.aiLabel}>AI · PubMed · OpenAlex · ClinicalTrials</Text>
              </View>
              <Text style={styles.title}>Research</Text>
              {cachedLabel && <Text style={styles.cachedLabel}>{cachedLabel}</Text>}
            </View>
            <TouchableOpacity onPress={() => loadAI(true)} disabled={aiLoading} style={styles.liveBtn} activeOpacity={0.8}>
              {aiLoading
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={styles.liveBtnTxt}>↻ Refresh AI</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabsContent}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            const badge = tab === 'Saved' ? savedItems.length : 0;
            return (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, active && styles.tabActive]} activeOpacity={0.75}>
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>
                  {tab}{badge > 0 ? ` ${badge}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── All ── */}
        {activeTab === 'All' && (
          <>
            <SectionHdr label="AI PICKS" loading={aiLoading} color={C.accent} count={aiLoading ? null : aiItems.length} />
            {noApiKey && <Empty icon="🔑" title="API key needed" sub="Set your Claude API key in the Ask Claude tab." />}
            {!aiLoading && !noApiKey && aiItems.length === 0 && <Empty icon="🔍" title="Tap Refresh AI" sub="Live AI web search for latest AGA research." />}
            {aiItems.slice(0, 3).map(renderCard)}

            <SectionHdr label="TOP PAPERS" loading={papersLoading} color="#8B5CF6" count={papersLoading ? null : pubmedItems.length + openAlexItems.length} />
            {pubmedItems.slice(0, 2).map(renderCard)}
            {openAlexItems.slice(0, 2).map(renderCard)}

            <SectionHdr label="COMMUNITY" loading={communityLoading} color="#FF6314" count={communityLoading ? null : communityItems.length} />
            {communityNoKey && <Empty icon="🔑" title="API key needed" sub="Needed for community search." />}
            {!communityLoading && !communityNoKey && communityItems.length === 0 && <Empty icon="📭" title="No posts" sub="Go to Community tab to search." />}
            {communityItems.slice(0, 3).map(renderCard)}

            <SectionHdr label="CLINICAL TRIALS" loading={trialsLoading} color="#10B981" count={trialsLoading ? null : trialItems.length} />
            {!trialsLoading && trialItems.length === 0 && <Empty icon="🔬" title="No trials found" />}
            {trialItems.slice(0, 2).map(renderCard)}
          </>
        )}

        {/* ── AI Picks ── */}
        {activeTab === 'AI Picks' && (
          <>
            <SectionHdr label="CLAUDE AI WEB SEARCH" loading={aiLoading} color={C.accent} />
            {noApiKey && <Empty icon="🔑" title="API key needed" sub="Set your Claude API key in the Ask Claude tab." />}
            {aiError && !noApiKey && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTxt}>{aiError}</Text>
                <TouchableOpacity onPress={() => loadAI(true)} style={styles.retryBtn} activeOpacity={0.8}>
                  <Text style={styles.retryTxt}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
            {!aiLoading && !noApiKey && !aiError && aiItems.length === 0 && (
              <Empty icon="🔍" title="No results" sub="Tap Refresh AI above." />
            )}
            {aiItems.map(renderCard)}
            <View style={styles.metaBox}>
              <Text style={styles.metaTxt}>Claude Sonnet 4.6 with live web search · results cached 48h</Text>
            </View>
          </>
        )}

        {/* ── Papers ── */}
        {activeTab === 'Papers' && (
          <>
            <SectionHdr label="SEARCH PAPERS" color="#8B5CF6" />
            <SearchBar
              value={papersInput}
              onChange={setPapersInput}
              onSubmit={() => { Keyboard.dismiss(); loadPapers(papersInput.trim() || DEFAULT_PAPERS_QUERY); }}
              placeholder="e.g. dutasteride androgenetic alopecia"
              btnColor="#8B5CF6"
            />
            <Text style={styles.metaHint}>PubMed · OpenAlex · free · no API key needed</Text>

            {papersLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#8B5CF6" />
                <Text style={styles.loadingTxt}>Searching papers…</Text>
              </View>
            )}

            {!papersLoading && (
              <>
                <SectionHdr label="PUBMED" color="#3B82F6" count={pubmedItems.length} />
                {pubmedItems.length === 0 ? <Empty icon="📄" title="No PubMed results" sub="Try broader keywords." /> : pubmedItems.map(renderCard)}

                <SectionHdr label="OPENALEX — SORTED BY CITATIONS" color="#8B5CF6" count={openAlexItems.length} />
                <Text style={styles.metaHint}>Citation count = how influential the paper is in the field</Text>
                {openAlexItems.length === 0 ? <Empty icon="📄" title="No OpenAlex results" /> : openAlexItems.map(renderCard)}
              </>
            )}
          </>
        )}

        {/* ── Community ── */}
        {activeTab === 'Community' && (
          <>
            <SectionHdr label="COMMUNITY SEARCH" color="#FF6314" />
            <SearchBar
              value={communityInput}
              onChange={setCommunityInput}
              onSubmit={() => {
                Keyboard.dismiss();
                loadCommunity({ force: true, query: communityInput.trim(), subs: selectedSubs });
              }}
              placeholder="e.g. oral minoxidil 6 month update"
              btnColor="#FF6314"
            />
            <SubSelector selected={selectedSubs} onToggle={toggleSub} />
            <Text style={styles.metaHint}>Searching via Claude AI web search · 6h cache on default query</Text>

            {communityLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FF6314" />
                <Text style={styles.loadingTxt}>Searching communities…</Text>
              </View>
            )}
            {communityNoKey && <Empty icon="🔑" title="API key needed" sub="Set your Claude API key in the Ask Claude tab to enable community search." />}
            {!communityLoading && !communityNoKey && communityItems.length === 0 && (
              <Empty icon="📭" title="No posts found" sub="Try a search above, or tap the refresh button." />
            )}
            {communityItems.map(renderCard)}
            {!communityLoading && communityItems.length > 0 && (
              <TouchableOpacity
                onPress={() => loadCommunity({ force: true, query: communityInput.trim(), subs: selectedSubs })}
                style={styles.retryBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.retryTxt}>↻ Refresh community posts</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Trials ── */}
        {activeTab === 'Trials' && (
          <>
            <SectionHdr label="CLINICAL TRIALS" color="#10B981" />
            <SearchBar
              value={trialsInput}
              onChange={setTrialsInput}
              onSubmit={() => { Keyboard.dismiss(); loadTrials(trialsInput.trim() || DEFAULT_TRIALS_QUERY); }}
              placeholder="e.g. androgenetic alopecia minoxidil"
              btnColor="#10B981"
            />
            <Text style={styles.metaHint}>ClinicalTrials.gov · free · no API key · sorted by last update</Text>

            {trialsLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#10B981" />
                <Text style={styles.loadingTxt}>Searching ClinicalTrials.gov…</Text>
              </View>
            )}
            {!trialsLoading && trialItems.length === 0 && (
              <Empty icon="🔬" title="No trials found" sub="Try broader keywords like 'hair loss'." />
            )}

            {/* Group by status: Recruiting first */}
            {!trialsLoading && trialItems.length > 0 && (() => {
              const recruiting = trialItems.filter(t => t.status === 'RECRUITING' || t.status === 'NOT_YET_RECRUITING');
              const active     = trialItems.filter(t => t.status === 'ACTIVE_NOT_RECRUITING' || t.status === 'ENROLLING_BY_INVITATION');
              const completed  = trialItems.filter(t => !['RECRUITING','NOT_YET_RECRUITING','ACTIVE_NOT_RECRUITING','ENROLLING_BY_INVITATION'].includes(t.status));
              return (
                <>
                  {recruiting.length > 0 && <><Text style={styles.groupLabel}>CURRENTLY RECRUITING</Text>{recruiting.map(renderCard)}</>}
                  {active.length > 0 && <><Text style={styles.groupLabel}>ACTIVE</Text>{active.map(renderCard)}</>}
                  {completed.length > 0 && <><Text style={styles.groupLabel}>COMPLETED / OTHER</Text>{completed.map(renderCard)}</>}
                </>
              );
            })()}
          </>
        )}

        {/* ── Saved ── */}
        {activeTab === 'Saved' && (
          <>
            <SectionHdr label="SAVED ARTICLES" count={savedItems.length} />
            {savedItems.length === 0 && (
              <Empty icon="★" title="Nothing saved yet" sub="Tap ☆ or 'Save' on any card to bookmark it here." />
            )}
            {savedItems.map(renderCard)}
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 0.5 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 42, marginTop: 2 },
  cachedLabel: { fontSize: 10, color: '#3A3A3C', marginTop: 4 },
  liveBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 14, minWidth: 110, alignItems: 'center' },
  liveBtnTxt: { fontSize: 13, fontWeight: '600', color: C.accent },
  tabsWrap: { marginBottom: 20, flexGrow: 0 },
  tabsContent: { paddingRight: 16, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1C1C1E', borderRadius: 20 },
  tabActive: { backgroundColor: C.accent },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.sub },
  tabTxtActive: { color: '#fff' },
  errorBox: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 16, gap: 12, marginBottom: 12 },
  errorTxt: { fontSize: 13, color: C.sub, lineHeight: 19 },
  retryBtn: { backgroundColor: '#2C2C2E', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, marginBottom: 8 },
  retryTxt: { fontSize: 13, fontWeight: '600', color: C.accent },
  metaHint: { fontSize: 10, color: '#3A3A3C', marginBottom: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingTxt: { fontSize: 14, color: C.sub },
  metaBox: { marginTop: 20, padding: 14, backgroundColor: '#1C1C1E', borderRadius: 12 },
  metaTxt: { fontSize: 11, color: '#3A3A3C', lineHeight: 17, textAlign: 'center' },
  groupLabel: { fontSize: 10, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  pulsingDot: { width: 7, height: 7, borderRadius: 3.5 },
});

// Card
const card = StyleSheet.create({
  wrap: { backgroundColor: '#1C1C1E', borderRadius: 14, marginBottom: 10, borderLeftWidth: 3, overflow: 'hidden' },
  touch: { padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  srcBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  srcTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  relDot: { width: 6, height: 6, borderRadius: 3 },
  bookmarkBtn: { marginLeft: 4 },
  bookmarkOff: { fontSize: 17, color: '#555' },
  bookmarkOn: { fontSize: 17, color: C.accent },
  chevron: { fontSize: 18, color: C.sub, marginLeft: 2, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 5 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 21 },
  authors: { fontSize: 11, color: '#3A3A3C', marginTop: 4, lineHeight: 15 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagTxt: { fontSize: 10, fontWeight: '600' },
  metaLine: { fontSize: 11, color: C.sub, marginBottom: 4 },
  summary: { fontSize: 13, color: C.sub, lineHeight: 19, marginBottom: 8, marginTop: 4 },
  reason: { fontSize: 12, color: '#555', fontStyle: 'italic', lineHeight: 17, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  actionTxt: { fontSize: 11, fontWeight: '700' },
  readBtn: { backgroundColor: C.accent + '22', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  readTxt: { fontSize: 11, fontWeight: '700', color: C.accent },
});

// Trial status badge
const tsb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  label: { fontSize: 10, fontWeight: '700' },
});

// Search bar
const sb = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2C2C2E' },
  btn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  btnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// Subreddit selector
const ss = StyleSheet.create({
  pill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1C1C1E', borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: '#FF631422', borderColor: '#FF6314' },
  pillTxt: { fontSize: 12, fontWeight: '600', color: C.sub },
  pillTxtActive: { color: '#FF6314' },
});

// Section header
const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  count: { fontSize: 11, color: C.sub, marginLeft: 6 },
});

// Empty
const em = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  icon: { fontSize: 32, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub: { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18 },
});
