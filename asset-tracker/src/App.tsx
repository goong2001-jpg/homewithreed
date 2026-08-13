import React, { useMemo, useState } from 'react';
import AssetSheet from './components/AssetSheet';
import AssetsView from './components/AssetsView';
import GoalSheet from './components/GoalSheet';
import GoalsView from './components/GoalsView';
import HomeView from './components/HomeView';
import KindSheet from './components/KindSheet';
import LoanSheet from './components/LoanSheet';
import OutflowView from './components/OutflowView';
import RecurringSheet from './components/RecurringSheet';
import SettingsView from './components/SettingsView';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import { COLOR } from './components/ui';
import { CollName, useAssets } from './hooks/useAssets';
import { Asset, AssetKind, ETC_KIND_ID, Goal, Loan, Recurring, View } from './types';
import { backupSummary, parseBackup } from './utils/backup';
import { todayKey } from './utils/date';
import { goalProgressAll } from './utils/goal';
import { newId } from './utils/id';
import { alive } from './utils/merge';
import { summarize } from './utils/summary';

const TITLE: Record<View, string> = {
  home: '내 자산',
  assets: '자산',
  outflow: '나가는 돈',
  goals: '목표',
  settings: '설정',
};

/** 지금 열려 있는 편집 시트. null이면 아무것도 안 떠 있다 */
type Editing =
  | { kind: 'asset'; target: Asset | null; defaultKindId: string }
  | { kind: 'loan'; target: Loan | null }
  | { kind: 'recurring'; target: Recurring | null }
  | { kind: 'assetKind'; target: AssetKind | null }
  | { kind: 'goal'; target: Goal | null }
  | null;

export default function App() {
  const [view, setView] = useState<View>('home');
  const [editing, setEditing] = useState<Editing>(null);
  const store = useAssets(newId);

  // 자정을 넘겨도 D-day가 하루 어긋나지 않게 매 렌더에서 오늘을 다시 읽는다
  const today = todayKey();

  // 모든 돈 계산은 여기 한 번. 자식 컴포넌트는 다시 계산하지 않는다.
  const summary = useMemo(
    () => summarize({
      kinds: store.kinds,
      assets: store.assets,
      loans: store.loans,
      recurrings: store.recurrings,
    }, today),
    [store.kinds, store.assets, store.loans, store.recurrings, today],
  );

  const goalProgress = useMemo(
    () => goalProgressAll(store.goals, store.assets, summary.equityByAsset, today),
    [store.goals, store.assets, summary.equityByAsset, today],
  );

  const liveKinds = alive(store.kinds).slice().sort((a, b) => a.order - b.order);
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

      {view === 'home' && (
        <HomeView
          summary={summary}
          kinds={store.kinds}
          assets={store.assets}
          loans={store.loans}
          today={today}
          onEditAsset={a => setEditing({ kind: 'asset', target: a, defaultKindId: a.kindId })}
          onEditLoan={l => setEditing({ kind: 'loan', target: l })}
          onGo={setView}
        />
      )}

      {view === 'assets' && (
        <AssetsView
          kinds={store.kinds}
          assets={store.assets}
          totalAsset={summary.totalAsset}
          equityByAsset={summary.equityByAsset}
          today={today}
          onAdd={kindId => setEditing({ kind: 'asset', target: null, defaultKindId: kindId })}
          onEdit={a => setEditing({ kind: 'asset', target: a, defaultKindId: a.kindId })}
          onAddKind={() => setEditing({ kind: 'assetKind', target: null })}
          onEditKind={k => setEditing({ kind: 'assetKind', target: k })}
        />
      )}

      {view === 'outflow' && (
        <OutflowView
          loans={store.loans}
          recurrings={store.recurrings}
          monthlyLoanPayment={summary.monthlyLoanPayment}
          monthlyFixed={summary.monthlyFixed}
          today={today}
          onAddLoan={() => setEditing({ kind: 'loan', target: null })}
          onEditLoan={l => setEditing({ kind: 'loan', target: l })}
          onAddRecurring={() => setEditing({ kind: 'recurring', target: null })}
          onEditRecurring={r => setEditing({ kind: 'recurring', target: r })}
        />
      )}

      {view === 'goals' && (
        <GoalsView
          goals={store.goals}
          progress={goalProgress}
          today={today}
          onAdd={() => setEditing({ kind: 'goal', target: null })}
          onEdit={g => setEditing({ kind: 'goal', target: g })}
          onToggleAchieved={g =>
            store.goalOps.update(g.id, { achievedAt: g.achievedAt ? null : today })}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          kinds={store.kinds}
          assets={store.assets}
          loans={store.loans}
          recurrings={store.recurrings}
          goals={store.goals}
          onImport={handleImport}
          onRestore={handleRestore}
          onReset={store.resetAll}
        />
      )}

      {/* ── 편집 시트 ─────────────────────────── */}

      {editing?.kind === 'asset' && (
        <AssetSheet
          asset={editing.target}
          kinds={liveKinds}
          defaultKindId={editing.defaultKindId || liveKinds[0]?.id || ETC_KIND_ID}
          equity={editing.target ? summary.equityByAsset[editing.target.id] : undefined}
          onClose={close}
          onDelete={editing.target
            ? () => { store.assetOps.remove(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.assetOps.update(editing.target.id, v);
            else store.assetOps.add(v);
            close();
          }}
        />
      )}

      {editing?.kind === 'loan' && (
        <LoanSheet
          loan={editing.target}
          assets={store.assets}
          onClose={close}
          onDelete={editing.target
            ? () => { store.loanOps.remove(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.loanOps.update(editing.target.id, v);
            else store.loanOps.add(v);
            close();
          }}
        />
      )}

      {editing?.kind === 'recurring' && (
        <RecurringSheet
          recurring={editing.target}
          onClose={close}
          onDelete={editing.target
            ? () => { store.recurringOps.remove(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.recurringOps.update(editing.target.id, v);
            else store.recurringOps.add(v);
            close();
          }}
        />
      )}

      {editing?.kind === 'assetKind' && (
        <KindSheet
          kind={editing.target}
          usedBy={editing.target
            ? alive(store.assets).filter(a => a.kindId === editing.target!.id).length
            : 0}
          onClose={close}
          // 마지막 남은 분류까지 지우면 자산을 넣을 곳이 없어진다
          onDelete={editing.target && liveKinds.length > 1
            ? () => { store.kindOps.remove(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.kindOps.update(editing.target.id, v);
            else store.kindOps.add({ ...v, builtin: false });
            close();
          }}
        />
      )}

      {editing?.kind === 'goal' && (
        <GoalSheet
          goal={editing.target}
          assets={store.assets}
          equityByAsset={summary.equityByAsset}
          today={today}
          onClose={close}
          onDelete={editing.target
            ? () => { store.goalOps.remove(editing.target!.id); close(); }
            : undefined}
          onSave={v => {
            if (editing.target) store.goalOps.update(editing.target.id, v);
            else store.goalOps.add(v);
            close();
          }}
        />
      )}

      <TabBar active={view} onChange={setView} />
    </div>
  );
}
