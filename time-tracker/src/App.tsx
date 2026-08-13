import React, { useMemo, useState } from 'react';
import CategoriesView from './components/CategoriesView';
import CategorySheet from './components/CategorySheet';
import EntrySheet from './components/EntrySheet';
import SettingsView from './components/SettingsView';
import StatsView from './components/StatsView';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import TodayView from './components/TodayView';
import { COLOR } from './components/ui';
import { useNow } from './hooks/useNow';
import { CollName, useTracker } from './hooks/useTracker';
import { Category, DateKey, Entry, Span, View } from './types';
import { backupSummary, parseBackup } from './utils/backup';
import { gapsOf, segmentsOfDay } from './utils/entry';
import { newId } from './utils/id';
import { alive } from './utils/merge';
import { compareByCategory, summarize } from './utils/summary';
import { addDays, addMonths, monthEnd, monthStart, todayKey, weekStart } from './utils/time';

const TITLE: Record<View, string> = {
  today: '내 시간',
  stats: '돌아보기',
  categories: '분류',
  settings: '설정',
};

/** 지금 열려 있는 편집 시트. null이면 아무것도 안 떠 있다 */
type Editing =
  | { kind: 'entry'; target: Entry | null; prefill: { start: number; end: number } | null }
  | { kind: 'category'; target: Category | null }
  | null;

/** 통계 화면이 보고 있는 기간 */
function periodOf(anchor: DateKey, span: Span): { from: DateKey; to: DateKey } {
  if (span === 'week') {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: monthStart(anchor), to: monthEnd(anchor) };
}

export default function App() {
  const [view, setView] = useState<View>('today');
  const [editing, setEditing] = useState<Editing>(null);
  const store = useTracker(newId);

  // '지금'은 여기서 한 번만 만든다.
  //
  // tick은 '언제 다시 그릴지'만 정한다 — 30초면 합계가 어긋나 보이지 않을 만큼 촘촘하고,
  // 화면 전체를 초 단위로 다시 그리지도 않는다 (타이머 숫자는 RunningCard가 따로 센다).
  // 값 자체는 매 렌더에서 새로 읽는다. 안 그러면 방금 시작한 기록이 다음 tick까지
  // 목록에도 막대에도 안 나타나서 '눌렀는데 아무 일도 안 일어난' 것처럼 보인다.
  const tick = useNow(30_000);
  const now = Math.max(tick, Date.now());
  const today = todayKey(new Date(now));

  const [day, setDay] = useState<DateKey>(() => todayKey());
  const [span, setSpan] = useState<Span>('week');
  const [anchor, setAnchor] = useState<DateKey>(() => todayKey());

  const liveCategories = useMemo(
    () => alive(store.categories).slice().sort((a, b) => a.order - b.order),
    [store.categories],
  );

  // ── 오늘(또는 고른 날) ───────────────────────
  const daySegments = useMemo(
    () => segmentsOfDay(store.entries, day, now),
    [store.entries, day, now],
  );

  const dayGaps = useMemo(
    () => gapsOf(daySegments, day, now),
    [daySegments, day, now],
  );

  const daySummary = useMemo(
    () => summarize({ entries: store.entries, categories: store.categories }, day, day, now),
    [store.entries, store.categories, day, now],
  );

  // ── 돌아보기 ────────────────────────────────
  const { from, to } = periodOf(anchor, span);
  const prevAnchor = span === 'week' ? addDays(anchor, -7) : addMonths(anchor, -1);
  const prev = periodOf(prevAnchor, span);

  const statsSummary = useMemo(
    () => summarize({ entries: store.entries, categories: store.categories }, from, to, now),
    [store.entries, store.categories, from, to, now],
  );

  const prevSummary = useMemo(
    () => summarize({ entries: store.entries, categories: store.categories }, prev.from, prev.to, now),
    [store.entries, store.categories, prev.from, prev.to, now],
  );

  const delta = useMemo(
    () => compareByCategory(statsSummary, prevSummary),
    [statsSummary, prevSummary],
  );

  const useCount = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of alive(store.entries)) out[e.categoryId] = (out[e.categoryId] ?? 0) + 1;
    return out;
  }, [store.entries]);

  const close = () => setEditing(null);

  const handleImport = (text: string) => {
    const parsed = parseBackup(text);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    store.importBackup(parsed.backup);
    return { ok: true, message: `불러왔어요. (${backupSummary(parsed.backup)})` };
  };

  const handleRestore = (coll: CollName, id: string) => store.restore(coll, id);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: TAB_BAR_HEIGHT + 8 }}>
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(248,249,250,0.94)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${COLOR.line}`,
          padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px' }}>
          {TITLE[view]}
        </h1>
      </header>

      {view === 'today' && (
        <TodayView
          day={day}
          today={today}
          onChangeDay={setDay}
          categories={liveCategories}
          allCategories={store.categories}
          segments={daySegments}
          gaps={dayGaps}
          summary={daySummary}
          running={store.running}
          now={now}
          onStart={id => store.start(id)}
          onStop={() => store.stop()}
          onEditEntry={id => {
            const target = store.entries.find(e => e.id === id);
            if (target) setEditing({ kind: 'entry', target, prefill: null });
          }}
          onAdd={range => setEditing({ kind: 'entry', target: null, prefill: range ?? null })}
        />
      )}

      {view === 'stats' && (
        <StatsView
          span={span}
          onChangeSpan={s => { setSpan(s); setAnchor(today); }}
          onShift={n => setAnchor(span === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n))}
          canForward={to < today}
          summary={statsSummary}
          delta={delta}
          today={today}
        />
      )}

      {view === 'categories' && (
        <CategoriesView
          categories={liveCategories}
          useCount={useCount}
          onAdd={() => setEditing({ kind: 'category', target: null })}
          onEdit={c => setEditing({ kind: 'category', target: c })}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          categories={store.categories}
          entries={store.entries}
          onImport={handleImport}
          onRestore={handleRestore}
          onReset={store.resetAll}
        />
      )}

      {/* ── 편집 시트 ─────────────────────────── */}

      {editing?.kind === 'entry' && (
        <EntrySheet
          entry={editing.target}
          prefill={editing.prefill}
          categories={liveCategories}
          allCategories={store.categories}
          entries={store.entries}
          today={today}
          now={now}
          onClose={close}
          onDelete={editing.target
            ? () => { store.removeEntry(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            // 돌아가는 기록은 언제나 하나뿐이어야 한다
            if (v.endedAt == null) store.stop();
            if (editing.target) store.updateEntry(editing.target.id, v);
            else store.addEntry(v);
            close();
          }}
        />
      )}

      {editing?.kind === 'category' && (
        <CategorySheet
          category={editing.target}
          usedBy={editing.target ? (useCount[editing.target.id] ?? 0) : 0}
          onClose={close}
          // 마지막 남은 분류까지 지우면 기록을 넣을 곳이 없어진다
          onDelete={editing.target && liveCategories.length > 1
            ? () => { store.removeCategory(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.updateCategory(editing.target.id, v);
            else store.addCategory(v);
            close();
          }}
        />
      )}

      <TabBar active={view} onChange={setView} live={!!store.running} />
    </div>
  );
}
