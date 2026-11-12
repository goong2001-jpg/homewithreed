# 인수인계 — 우리집 하루수입 가계부 (couple-budget)

> 마지막 정리: **2026-11-12 · v16** · 이 문서는 다음 작업자(사람이든 다른 AI 모델이든)가
> 이 앱을 처음 보고도 안전하게 이어서 고칠 수 있게 쓴 것이다. 작업 전에 끝까지 읽는다.

---

## 0. 새 채팅 시작 문구 (그대로 복사해서 붙여넣기)

```
homewithreed 저장소의 couple-budget(우리집 하루수입 가계부) 작업을 이어서 해줘.

1. 먼저 couple-budget/HANDOFF.md 를 끝까지 읽고, couple-budget/CHANGELOG.md 맨 위 항목으로 현재 버전을 확인해줘.
2. HANDOFF.md 의 "꼭 지킬 규칙"을 그대로 따라줘. 특히
   - 사용자 데이터(localStorage 키·Firestore 경로·id 형식)는 절대 바꾸거나 지우지 말 것
   - 커밋 첫 줄은 "vNN: 무엇을 바꿨는지", 본문은 "- " 목록
   - CHANGELOG.md 는 손대지 말 것 (배포 후 자동 기록됨), 푸시 전에 git pull --rebase
   - 기본 브랜치 claude/intelligent-cannon-txjx76 로 PR → squash 병합 → 배포 성공까지 확인
3. 읽은 뒤에 ① 현재 버전 ② 마지막 배포 성공 여부 ③ 남은 일 을 3줄로 알려주고 내 지시를 기다려줘.

답은 한국어 반말로, 폰에서 읽기 좋게 짧게. 결론 먼저.
```

---

## 1. 한눈에

| 항목 | 값 |
|---|---|
| 무엇 | 부부(+자녀) 가계부. 월 수입을 **그 달의 실제 일수로 나눠 "하루 수입"**으로 보여주고, 돼지저금통이 비어가는 모양으로 형편을 보여준다 |
| 저장소 · 폴더 | `goong2001-jpg/homewithreed` · `couple-budget/` (한 저장소에 앱 ~20개가 폴더별로 들어 있다) |
| 기본 브랜치 (= 배포 브랜치) | `claude/intelligent-cannon-txjx76` — 이름이 이상해 보여도 **이게 main 이다** |
| 작업 브랜치 | 세션이 정해주는 이름을 쓴다. 지금까지는 `claude/couple-income-budget-app-9bvca4` |
| 배포 주소 | https://goong2001-jpg.github.io/homewithreed/couple-budget/ |
| 버전 확인 주소 | https://goong2001-jpg.github.io/homewithreed/couple-budget/version.json (배포 때 자동 생성, v16부터) |
| 배포 방식 | 기본 브랜치에 들어오면 GitHub Actions `deploy.yml` 이 자동 실행: 전체 앱 테스트(`ci.yml`) → 전체 앱 빌드 → GitHub Pages 배포 → 이 앱 CHANGELOG 자동 기록 |
| 현재 버전 확인 | ① `couple-budget/CHANGELOG.md` 맨 위 ② 위 version.json 의 `version` ③ `git log --first-parent -1 -- couple-budget` |
| 기술 | CRA(react-scripts 5) · React 19 · TypeScript 4.9 · Node 22(CI) · firebase 11 · xlsx · 서버 없음 |
| 외부 서비스 | **GitHub Pages**(호스팅) · **GitHub Actions**(테스트·배포·이력) · **Firebase Firestore**(선택, *사용자 본인 프로젝트*, 실시간 동기화) · 브라우저 Web Share(카톡 공유). 구글 시트·외부 API·결제 없음 |
| 비밀값 | 저장소·Actions 에 **이 앱 전용 비밀값은 없다**. Actions 는 기본 `GITHUB_TOKEN` 만 쓴다. Firebase 설정과 *우리집 코드*는 사용자가 **앱 안에서** 입력하고 그 폰 localStorage(`couple_budget_settings`)에만 있다 |
| 사용자 | 저장소 주인 부부. 둘 다 **폰 브라우저(홈 화면에 추가)**로 쓴다. 코딩은 안 한다 |

---

## 2. 꼭 지킬 규칙

### 2-1. 지우면 안 되는 데이터 (사용자 기록이 날아간다)

데이터는 서버가 아니라 **각 폰의 localStorage** 와 (동기화 켠 경우) **사용자 본인의 Firestore** 에 있다.
코드에서 이름 하나만 바꿔도 이미 쌓인 기록이 "안 보이게" 된다. 복구도 어렵다.

- **localStorage 키** (`src/utils/storage.ts` 의 `KEYS`) — 이름 변경·삭제 금지
  `couple_budget_persons` · `couple_budget_incomes` · `couple_budget_fixed` · `couple_budget_expenses` · `couple_budget_gifts` · `couple_budget_budgets` · `couple_budget_settings` · `couple_budget_seeded_room`
- **Firestore 경로** — `rooms/{우리집코드}/{persons|incomes|fixedExpenses|expenses|gifts|budgets}/{id}` 컬렉션 이름 변경 금지
- **id 형식** — 기본 사람 `p1`·`p2`, 카테고리 예산 `budget-식비` (카테고리에서 정해지는 id 라 두 폰이 같은 문서로 합쳐진다). 바꾸면 중복이 생긴다
- **삭제는 툼스톤** — `deleted: true` + `updatedAt` 갱신으로만 지운다. 배열에서 빼거나 Firestore 문서를 진짜로 지우면 **상대 폰에서 되살아난다**
- **`updatedAt` 은 `Date.now()`** — `serverTimestamp()` 로 바꾸지 말 것 (오프라인에서 null 이라 병합이 깨진다, `merge.ts` 주석)
- **필드 추가는 OK, 이름 변경·타입 변경은 금지** — 옛 기록은 새 필드가 없으므로 항상 없을 때의 기본값을 처리한다
- **백업 파일 형식** — `format: 'couple-budget-backup'`. 지금 `BACKUP_VERSION = 2`. 올릴 때는 **옛 버전 파일 읽기를 반드시 유지**
- `이 기기의 기록 모두 지우기` 같은 파괴적 기능을 새로 만들 땐 두 번 누르기 확인을 둔다 (기존 관례)

### 2-2. 바꾸면 안 되는 주소·구조

- `package.json` 의 `"homepage": "/homewithreed/couple-budget/"` — 바꾸면 배포 페이지가 하얗게 뜬다. 사용자 폰 홈 화면 아이콘도 이 주소다
- 기본 브랜치 이름 `claude/intelligent-cannon-txjx76` — `deploy.yml`·`ci.yml` 이 이 이름으로 걸려 있다
- `.github/workflows/deploy.yml` 은 **저장소의 모든 앱이 같이 쓴다.** 이 앱 때문에 고칠 때 다른 앱 빌드 단계를 건드리지 않는다. 테스트(`ci.yml`)가 하나라도 깨지면 **모든 앱 배포가 멈춘다**
- `src/sync/types.ts` 에 firebase import 금지 — firebase 는 `syncClient.ts` 에서만 **동적 import** (메인 번들에 들어가면 동기화 안 쓰는 사람도 수백 KB 를 받는다. `dev/check.sh` 가 검사한다)
- 경조사(`gifts`)와 카테고리 예산(`budgets`)은 **저금통 계산에 넣지 않는다** — 의도된 설계 (3-3 참고)
- 앱 안의 Firebase 설정 안내 문구는 사용자가 실제로 4번 막혔던 끝에 맞춘 것이다(3-4). 콘솔 화면을 확인하지 않고 추측으로 바꾸지 않는다

### 2-3. 버전 올리는 법 · 커밋 메시지 규칙

- **PR(또는 기본 브랜치에 들어가는 변경) 하나 = 버전 하나.** 다음 번호 = `CHANGELOG.md` 맨 위 버전 + 1 (지금 v16 → 다음 **v17**)
- 기본 브랜치에 들어가는 커밋(= squash 병합 커밋)의 메시지:

  ```
  v17: 무엇을 바꿨는지 한 줄 (#PR번호)

  - 바뀐 점 하나
  - 바뀐 점 둘
  - (왜 그렇게 했는지가 중요하면 한 줄 덧붙인다)
  ```

  - 첫 줄은 반드시 `vNN:` 으로 시작 — 자동 기록과 version.json 이 이걸 읽는다. 없으면 "버전 없음"으로 기록된다
  - 본문은 `- ` 목록. 사용자가 CHANGELOG 를 폰으로 읽으니 **사용자 말로** 쓴다 (함수 이름보다 "무엇이 달라졌나")
  - `## 제목` 은 써도 되지만 기록할 때 굵은 글씨로 바뀐다. `Co-Authored-By` 같은 꼬리표는 자동으로 빠진다
- `package.json` 의 `"version": "0.1.0"` 은 **쓰지 않는다** (CRA 기본값 그대로 둔다). 버전의 기준은 커밋 메시지다
- 앱 화면 안에는 버전 표시가 없다 (v16 기준). 버전은 version.json 과 CHANGELOG 로 본다

### 2-4. 브랜치 · PR 방식 (이 앱이 써 온 방식 그대로)

1. **작업 시작할 때마다 기본 브랜치 최신에서 작업 브랜치를 새로 만든다**
   ```bash
   git fetch origin claude/intelligent-cannon-txjx76
   git checkout -B <작업브랜치> origin/claude/intelligent-cannon-txjx76
   ```
   → squash 병합이라 예전 작업 커밋이 브랜치에 남아 있으면 다음 PR 이 **충돌(405)** 난다. 실제로 3번 겪었다
2. 작업 → `bash couple-budget/dev/check.sh` 전부 ✅
3. 커밋 (메시지 규칙 2-3) → **푸시 전에** `git pull --rebase origin claude/intelligent-cannon-txjx76`
   (배포 뒤 Actions 봇이 CHANGELOG 커밋을 기본 브랜치에 넣기 때문에, 오래 작업했으면 뒤처져 있다)
4. `git push -u origin <작업브랜치>` — 원격 작업 브랜치에 **이미 병합된 옛 커밋만** 남아 있어서 거절되면 `--force-with-lease` (병합 안 된 커밋이 있으면 절대 강제 푸시하지 말 것)
5. GitHub MCP 로 PR 생성: base = `claude/intelligent-cannon-txjx76`, 제목 = `v17: …`
6. **squash 병합**: `merge_pull_request(merge_method="squash", commit_title="v17: … (#PR번호)", commit_message="- …\n- …")`
   → `commit_title`·`commit_message` 를 **꼭 직접 넣는다.** 안 넣으면 GitHub 기본 제목이 들어가 버전이 빠진다
7. 배포 성공까지 확인 (4장). 끝나면 사용자에게 "폰에서 새로고침" 안내

> 참고: v14·v15 는 다른 세션이 병합 커밋(PR #46)으로 넣었다. 자동 기록은 병합 커밋도 PR 제목으로 한 줄 기록하지만, **이 앱은 squash 병합이 기본**이다.
> 다른 앱 작업이 기본 브랜치에 직접 푸시되는 일도 잦다. 그래서 1번(최신에서 새로 시작)이 중요하다.

### 2-5. CHANGELOG.md — 손대지 않는다

- 배포가 성공하면 `deploy.yml` 의 `couple-budget-changelog` 작업이 그 배포에 포함된 **이 앱 폴더를 바꾼 커밋**을 `CHANGELOG.md` 자동 영역 맨 위에 붙이고, `[skip ci]` 커밋으로 기본 브랜치에 푸시한다
- 사람(AI 포함)은 `CHANGELOG.md` 를 **수정하지 않는다.** 이력은 커밋 메시지로 남긴다
- 각 항목의 `<!-- sha:… -->` 와 `<!-- AUTO-CHANGELOG:START/END -->` 표시는 지우지 않는다 (중복 방지·삽입 위치)
- 기록이 실패해도 배포는 성공으로 남고, 빠진 커밋은 **다음 배포 때 따라잡는다**

### 2-6. 비밀값 취급

- 저장소는 **공개**다. 사용자의 Firebase `projectId`·`apiKey`·**우리집 코드**를 코드·문서·커밋·PR·테스트에 절대 쓰지 않는다
  - 예시가 필요하면 `wooricip-a1b2c` 같은 가짜 값을 쓴다 (실제로 사용자 projectId 를 README 예시에 넣었다가 지운 적이 있다)
- Firebase 웹 설정(`apiKey` 포함)은 원래 공개값이라 사용자끼리 카톡으로 보내도 되지만, **우리집 코드는 비밀번호**다 (README "꼭 알아둘 점")
- 새 외부 서비스·API 키가 필요해지면 저장소 Secrets 에 넣고 **이름만** 이 문서에 적는다 (지금은 없음)
- 사용자 이메일·실명·아이 이름을 문서·커밋에 넣지 않는다

### 2-7. 답변 스타일

- **한국어, 반말** (지금까지 그렇게 대화했다). 사용자는 **폰으로** 읽는다
- **결론 먼저, 짧게.** 표·목록 위주. 긴 코드 설명은 하지 않는다 — 사용자는 개발자가 아니다
- 끝에 "폰에서 새로고침하면 보여" 같은 **사용자가 할 일**을 분명히
- 사용자가 "만들지는 말고"라고 하면 코드를 건드리지 않고 제안만 한다
- 틀린 안내를 했으면 짧게 바로잡고 넘어간다. Firebase 콘솔처럼 화면이 바뀌는 안내는 **사용자 스크린샷 기준**으로

---

## 3. 구조

### 3-1. 파일별 역할

| 파일 | 역할 |
|---|---|
| **진입·상태** | |
| `src/App.tsx` | 화면 전환(탭 6개), 수정 중인 항목, 모든 돈 계산을 **한 번만** 해서 아래로 내려준다. 지출 저장 후 상한 넘김 토스트 |
| `src/hooks/useLedger.ts` | ★ **단일 진실 공급원.** 모든 기록의 state·localStorage 저장·클라우드 push·병합·백업 가져오기·자동 1회 올리기 |
| `src/hooks/useSync.ts` | Firebase 연결 수명. 작은 컬렉션은 전부, 지출은 **보고 있는 달만** 구독 |
| `src/hooks/useAppSettings.ts` | 동기화 설정(Firebase 설정 원문·우리집 코드). **절대 클라우드로 안 올림** |
| `src/hooks/useMonthNav.ts` | 보고 있는 달 이동 |
| **계산 (순수 함수, 테스트 있음)** | |
| `src/utils/budget.ts` | ★ 하루 수입·여유돈·저금통 비율·사람별·카테고리별·TOP·상한 상태·자주 쓰는 지출. `todayKey` 는 로컬 날짜 |
| `src/utils/gifts.ts` | 경조사 거르기·합계·상대별·사람별 집계 |
| `src/utils/weekly.ts` | 주간 리포트(월~일) 계산 |
| `src/utils/merge.ts` | id 기준 last-write-wins 병합, 로컬 승자 되밀기, Firestore undefined 제거 |
| `src/utils/backup.ts` | 파일로 주고받기 형식(v2) 만들기·읽기·요약 |
| `src/utils/roomCode.ts` | Firebase 설정 붙여넣기 파싱, 우리집 코드 생성·검사 |
| `src/utils/format.ts` | 원 표시, 날짜 라벨, 금액 입력 콤마 |
| `src/utils/storage.ts` | localStorage 키 목록 + 안전한 load/save |
| `src/utils/excelExport.ts` | Excel 내보내기 (xlsx 동적 import) |
| `src/utils/weeklyShare.ts` | 주간 리포트를 canvas PNG 로 그려 Web Share |
| `src/utils/id.ts` | `randomUUID` + 비보안 컨텍스트 대체 |
| **동기화** | |
| `src/sync/types.ts` | `SyncClient` 계약 (firebase import 금지) |
| `src/sync/syncClient.ts` | firebase 를 만지는 **유일한** 파일. 연결 테스트·오류를 "마법사 몇 단계 탓"으로 번역 |
| **화면 (탭 순서)** | |
| `HomeView` · `PiggyGauge` · `piggyShapes` · `StatRow` · `PersonBars` · `BudgetLimits` · `WeeklyReportCard` | 🐷 저금통 탭 |
| `AddView` · `ExpenseForm` · `IncomeForm` · `FrequentChips` | ➕ 입력 탭 (지출/수입 전환, 수정 겸용) |
| `HistoryView` · `ExpenseItem` · `CategoryBreakdown` | 📋 내역 탭 |
| `TopSpendView` | 🏆 TOP5 탭 |
| `GiftsView` · `GiftForm` | 🧧 경조사 탭 |
| `SettingsView` · `IncomeCard` · `FixedExpenseCard` · `CategoryBudgetCard` · `PersonsCard` · `SyncCard` · `ExchangeCard` | ⚙️ 설정 탭 |
| `TabBar` · `MonthHeader` · `SyncBadge` · `Toast` | 공용 |
| **문서·도구 (앱 기능과 무관)** | |
| `HANDOFF.md` · `CLAUDE.md` · `CHANGELOG.md` · `README.md` | 인수인계 · AI 작업 규칙 · 자동 이력 · 사용자용 설명(Firebase 설정법 포함) |
| `dev/check.sh` | 한 줄 점검 (4-2) |
| `dev/smoke.mjs` | 실제 빌드를 배포 경로로 띄워 브라우저로 클릭해 보는 점검 |
| `dev/history.mjs` · `changelog.mjs` · `record-changelog.sh` · `version-json.mjs` · `history.test.mjs` | 자동 이력·버전 표시 도구와 그 테스트 |

### 3-2. 데이터 구조 (`src/types/index.ts`)

모든 동기화 레코드는 `Syncable { id, updatedAt, deleted? }` 를 가진다.

| 종류 | 주요 필드 | 비고 |
|---|---|---|
| `Person` | name, color, order, createdAt | 부부 + 자녀. 기본 `p1`(나)·`p2`(와이프), `updatedAt: 0` = 손 안 댄 기본값 |
| `IncomeEntry` | month, personId, amount, memo | **건별** (급여 1건 + 부업 일당 여러 건) |
| `FixedExpense` | name, amount, startMonth, endMonth\|null, personId\|null | 매달 반복, 하루 수입 계산 **전에** 뺀다 |
| `Expense` | date, **month**(비정규화), amount, category, content, personId, createdAt | 카테고리 8종 고정 |
| `GiftEntry` | date, month, direction(in/out), amount, kind, counterparty, personId, memo | 경조사·용돈. 저금통과 무관 |
| `CategoryBudget` | category, monthlyLimit | id = `budget-{카테고리}` |
| `AppSettings.sync` | enabled, roomCode, firebaseConfigText | 로컬 전용, 클라우드 금지 |

계산 결과 `MonthBudget`(budget.ts `computeMonthBudget`)이 화면 전체의 숫자를 담는다.

### 3-3. 핵심 개념

- **하루 수입** = (월 총수입 − 월 고정지출) ÷ **그 달의 실제 일수** (6월 30, 7월 31, 윤년 2월 29). 320만원이면 7월 103,225원 — 사용자가 처음 말한 "106,000원"은 30일 기준
- **누적 방식 여유돈** = 경과일수 × 하루 수입 − 이달 누적 지출. 오늘 아끼면 내일 쓸 돈이 늘어난다
- **저금통 채움** = 이달 남은 예산 ÷ 쓸 수 있는 돈 (1일 가득 → 말일 0), **점선** = 오늘까지 목표선, **색** = 여유/주의(하루치 미만)/초과
- **로컬 우선** — 모든 변경은 localStorage 먼저, 네트워크는 기다리지 않고 던지기만. Firebase 없어도 완전히 동작
- **병합** — id 기준 `updatedAt` 큰 쪽이 이긴다(동점은 원격). 오프라인에서 묵은 수정이 서버 최신을 덮으면 `localWinners` 로 되밀기 + 규칙의 `updatedAt` 가드
- **동기화 범위** — 사람·수입·고정지출·경조사·예산은 **전부**, 지출은 **보고 있는 달만** 구독. 새 폰은 내역 탭 "지난 데이터 모두 불러오기"
- **자동 1회 올리기** — 연결되면 이 기기 기존 기록을 방에 한 번 올린다(2.5초 뒤, 먼저 받은 스냅샷과 병합 후). 방 코드별로 한 번(`couple_budget_seeded_room`)
- **둘이 쓰는 세 단계** — ① 혼자(설정 0) ② 파일로 주고받기(서버 0) ③ 본인 Firebase(실시간). **저장소 주인이 남의 데이터를 갖지 않는 구조**가 사용자 요구였다 — 공용 Firebase 를 만들어 주지 말 것
- **경조사·카테고리 예산은 저금통과 분리** — 축의금이 하루 예산에서 빠지면 "헤프게 썼다"는 신호가 아닌데 저금통이 빨개진다. 상한은 스스로의 약속일 뿐
- **안 적은 날 = 안 쓴 날로 계산된다** — 입력을 빼먹으면 여유돈이 실제보다 좋아 보인다 (6장 아이디어)

### 3-4. 지금까지 겪은 함정·버그와 해결법

| 증상 | 원인 | 해결 / 교훈 |
|---|---|---|
| 한국 새벽에 날짜가 어제로 | `toISOString()` 은 UTC | `todayKey()` 로컬 날짜만 쓴다 |
| CI 빌드만 실패 | `CI=true` 면 lint **경고도 실패** | 중복 style 키·exhaustive-deps 정리. `dev/check.sh` 가 같은 조건으로 빌드 |
| 연결 테스트가 "확인 중…"에서 영원히 | 틀린 projectId 에 Firestore 가 오류 없이 무한 재시도 | `withTimeout(15초)` → "4번 단계" 안내 |
| 파일 가져오기가 "0건"·클라우드에 안 올라감 | 병합을 `setState` 업데이터 안에서 해서 나중에 실행됨 | 현재 state 로 먼저 계산하고 결과를 통째로 set |
| 와이프 폰에서 추가한 자녀가 남편 폰에 안 보임 (v7) | 사람 목록이 설정 안에 있어 동기화 대상이 아니었음 | `persons` 컬렉션 + `loadPersons()` 이사(`updatedAt: 0`) |
| "기록 올리기 버튼이 없어" (v8) | 연결 테스트 직후에만 보였음 | 연결 중엔 상시 노출 + 자동 1회 올리기 |
| "카테고리 눌러도 안 보여" (v10) | 동작은 했는데 고정지출 15줄 아래로 결과가 밀림 | 고정지출을 맨 아래로. **"안 된다" = 화면 밖일 수 있다** |
| 금액만 고쳐도 순서가 튐 (v11) | 수정 때 `createdAt` 을 지금으로 덮음 | `existing?.createdAt ?? now` (수입·고정지출도) |
| 지난달 복사로 급여가 두 번 (v12) | 수입이 건별이 된 뒤 사람별 덮어쓰기 전제가 깨짐 | 이 달 수입이 하나라도 있으면 복사 안 함·버튼 숨김 |
| Firebase 안내대로 했는데 막힘 (4번) | 닉네임 칸 설명 부족 / 개편된 콘솔 메뉴 경로 / 규칙 자리에 설정 붙여넣기(`Unexpected '{'`) / "웹 API 키" 항목이 콘솔에 없음 | 앱 마법사·README 를 실제 화면 기준으로 고침. **콘솔 안내는 추측 금지** |
| README 에 사용자 실제 projectId 노출 | 예시로 실제 값을 씀 | 가짜 값 `wooricip-a1b2c`. 공개 저장소다 |
| PR 병합 405 (충돌) | squash 병합 뒤 같은 브랜치에 새 커밋을 얹음 | 매번 `checkout -B <브랜치> origin/<기본>` (+필요 시 cherry-pick) 후 `--force-with-lease` |
| `git rebase … \| tail` 후 충돌 상태로 진행 | 파이프의 종료 코드는 `tail` 것 | 리베이스 결과는 파이프로 거르지 않는다 |
| dev 서버 끄다가 셸이 죽음 | `pkill -f "react-scripts start"` 가 자기 명령줄도 매치 | `pgrep -f "[n]ode.*react-scripts" \| xargs -r kill` |
| `git log` 이력이 중간에 끊김 | 세션 저장소가 얕은 클론(shallow) | `git fetch --unshallow origin claude/intelligent-cannon-txjx76` |
| 테스트 돌리려니 `react-scripts` 없음 | 세션 사이에 `node_modules` 가 사라짐 | `npm ci` (check.sh 가 알아서) |
| Playwright 점검에서 홈 숫자가 안 맞음 | 실제 날짜와 시드 데이터의 달이 다름 | 테스트에서 `Date` 를 고정 |
| 전체 스크린샷에서 버튼이 안 보임 | 고정 탭바가 겹쳐 보임 | 실제 클릭으로 확인. 스크린샷만 믿지 않는다 |
| 클라우드 세션에서 배포 사이트가 안 열림 | 세션 프록시가 `github.io`·Actions 아티팩트를 막음, `gh` 미로그인 | 배포 확인은 GitHub MCP(Actions 실행·로그)로. version.json 은 Actions 로그에 찍힌다 |
| 백업 파일 버전 | v13 때는 "옛 앱 호환"을 이유로 v1 유지 → v15 에서 v2 로 올림 | 지금 v2. 옛 폰이 새 파일을 받으면 "상대방 앱이 더 최신"→ 새로고침 안내. v1 파일은 계속 읽는다 |
| firebase 12 설치 실패 | 12 는 Node 20+ (당시 CI Node 18) | `firebase@^11` 유지. CI 는 지금 Node 22 지만 올릴 이유가 생기기 전엔 그대로 |

---

## 4. 작업 → 테스트 → 배포 → 확인

### 4-1. 시작

```bash
cd <저장소 루트>                      # 보통 /home/user/homewithreed
git fetch origin claude/intelligent-cannon-txjx76
git checkout -B <작업브랜치> origin/claude/intelligent-cannon-txjx76
git rev-parse --is-shallow-repository   # true 면 → git fetch --unshallow origin claude/intelligent-cannon-txjx76
head -30 couple-budget/CHANGELOG.md     # 현재 버전
cd couple-budget && npm ci
```

### 4-2. 테스트 — 명령 한 줄

```bash
bash couple-budget/dev/check.sh          # 전부 (약 1~2분)
bash couple-budget/dev/check.sh --quick  # 단위 테스트만 (빌드·브라우저 생략)
```

| 단계 | 내용 |
|---|---|
| Node 버전 | 22 권장 (CI 와 같음), 18 이상 필수 |
| 의존성 | `node_modules` 없으면 `npm ci` |
| 단위 테스트 | `src/**/*.test.ts` — 계산·병합·백업·주간 리포트·경조사 (v16 기준 **178건**) |
| 이력 도구 테스트 | `dev/history.test.mjs` — 임시 git 저장소로 기록·중복 방지·따라잡기 (18건) |
| 문서 | HANDOFF·CLAUDE·CHANGELOG·README 있음, CHANGELOG 자동 표시 있음 |
| 배포 빌드 | `CI=true` (경고 = 실패, CI 와 같은 조건) |
| 빌드 결과 | firebase·xlsx 가 메인 번들 밖, 메인 번들 gzip 200KB 미만(지금 ~100KB), 배포 경로 `/homewithreed/couple-budget/` |
| 브라우저 스모크 | 실제 빌드를 배포 경로로 띄워 탭 6개 순회 → 수입 입력 → 하루 금액 → 지출 입력 → 새로고침 유지 → 경조사 탭 → 390px 가로 스크롤 없음 → 콘솔 오류 0. playwright 가 없으면 건너뜀 (`npm i --no-save playwright && npx playwright install chromium`) |

화면을 바꿨다면 **폰 폭(390px)으로 직접 눌러 보는 것**까지가 테스트다. 날짜에 따라 숫자가 바뀌는 화면은 `Date` 를 고정해서 본다.
개발 서버: `cd couple-budget && BROWSER=none PORT=3111 npx react-scripts start` → http://localhost:3111/homewithreed/couple-budget/

### 4-3. 커밋 · PR · 병합

```bash
cd <저장소 루트>
git add -A couple-budget                    # 다른 앱 폴더를 섞지 않는다
git commit -F - <<'EOF'
v17: 무엇을 바꿨는지

- 바뀐 점
- 바뀐 점
EOF
git pull --rebase origin claude/intelligent-cannon-txjx76
git push -u origin <작업브랜치>              # 거절되면 2-4 의 4번
```

그다음 GitHub MCP:
- `create_pull_request(owner="goong2001-jpg", repo="homewithreed", base="claude/intelligent-cannon-txjx76", head="<작업브랜치>", title="v17: …", body=…)`
- `merge_pull_request(…, pullNumber=N, merge_method="squash", commit_title="v17: … (#N)", commit_message="- …\n- …")`
- 405(충돌)가 나면: 2-4 의 1번처럼 브랜치를 최신에서 다시 만들고 내 커밋만 `cherry-pick` → `--force-with-lease` → 다시 병합

### 4-4. 배포 성공 확인

병합하면 `Deploy to GitHub Pages` 가 자동으로 돈다 (전체 앱 테스트 → 빌드 → 배포 → 이력 기록, **보통 5~10분**). `sleep` 으로 폴링하지 말고 몇 분 뒤 확인한다.

GitHub MCP 로:
1. `actions_list(method="list_workflow_runs", resource_id="deploy.yml", workflow_runs_filter={"branch":"claude/intelligent-cannon-txjx76"}, perPage=1)`
   → `head_sha` 가 방금 병합 커밋인지, `status: completed`, `conclusion: success` 인지
2. `actions_list(method="list_workflow_jobs", resource_id="<run id>")`
   → `test` · `build` · `deploy` · `couple-budget-changelog` 네 개가 모두 success
3. `get_job_logs(job_id=<couple-budget-changelog 의 id>, return_content=true, tail_lines=40)`
   → `CHANGELOG: 기록해서 푸시했습니다` 와 `배포 확인됨` + version.json 내용 (`"version": "v17"`)
4. 이력 반영 확인
   ```bash
   git fetch origin claude/intelligent-cannon-txjx76
   git show origin/claude/intelligent-cannon-txjx76:couple-budget/CHANGELOG.md | sed -n '/AUTO-CHANGELOG:START/,/^<!-- sha/p'
   ```

`gh` 가 로그인돼 있는 환경이면: `gh run list --workflow deploy.yml --branch claude/intelligent-cannon-txjx76 --limit 3` · `gh run view <id> --log | grep CHANGELOG`
브라우저가 되는 곳(사용자 폰 등)이면: 위 version.json 주소를 열어 `version` 확인.

실패하면: `get_job_logs(run_id=<id>, failed_only=true, return_content=true)`. `test` 단계는 **다른 앱 테스트**가 깨져도 실패하니, 이 앱 탓인지 먼저 본다.
`couple-budget-changelog` 만 실패한 거면 배포는 된 것이고(작업에 continue-on-error), 다음 배포 때 기록이 따라잡는다.

### 4-5. 사용자에게 알리기

"배포 끝났어. 폰에서 앱 열고 새로고침하면 보여 (와이프 폰도)." — 서비스워커가 없어서 새로고침이면 새 버전이 뜬다.

---

## 5. 변경 이력 요약

자세한 내용은 `CHANGELOG.md`. v16 부터는 배포 때 자동으로 쌓인다.

| 버전 | 날짜(KST) | PR | 내용 |
|---|---|---|---|
| v16 | 2026-11-12 | — | 인수인계 문서(HANDOFF·CLAUDE·CHANGELOG), `dev/` 점검 도구, 배포 후 이력 자동 기록, version.json |
| v15 | 2026-10-23 | #46 | 카테고리 월 상한·경고, 자주 쓰는 지출 칩, 주간 리포트·카톡 공유, 백업 v2 *(다른 세션)* |
| v14 | 2026-10-23 | #46 | 오프라인 낡은 수정 되밀기, 규칙 `updatedAt` 가드, CI 테스트 게이트·Node 22 *(다른 세션)* |
| v13 | 2026-09-19 | #32 | 경조사·용돈 장부 탭 |
| v12 | 2026-09-04 | #28 | 수입 건별 입력, 입력 탭 지출/수입 전환, TOP5 탭 |
| v11 | 2026-08-16 | #22 | 지출 금액·메모 수정 |
| v10 | 2026-08-06 | #15 | 고정지출 위치, 카테고리 선택 표시 |
| v9 | 2026-08-06 | #14 | 사람별 상세, 카테고리별 분석 |
| v8 | 2026-08-03 | #13 | 자동 1회 올리기, 올리기 버튼 상시 |
| v7 | 2026-08-03 | #12 | 사람 목록 동기화 |
| v6 | 2026-08-02 | #11 | 파일로 주고받기 |
| v2~v5 | 2026-07-30 | #7~#10 | Firebase 설정 마법사와 안내 문구 바로잡기 |
| v1 | 2026-07-30 | #6 | 첫 버전 — 하루 수입, 누적 여유돈, 돼지저금통, 동기화 |

---

## 6. 남은 일 · 아이디어 (우선순위 순)

입력이 힘들다는 사용자 피드백(2026-11-06)에 대한 제안 중 **아직 안 한 것**:

1. **이 폰은 누구 폰인지 기억** — 지금 입력 기본 사람이 항상 첫 번째(남편)라 와이프는 매번 한 번 더 누른다. **localStorage 에만** 두고 동기화하지 않는 게 핵심 (기기의 성질이라 같이 넘기면 서로 덮어쓴다). 가장 싸고 효과 큼
2. **안 적은 날 드러내기** — "3일째 입력이 없어요" + "그날은 안 썼어요"(0원 표시). 지금은 입력을 빼먹을수록 여유돈이 좋아 보인다 (정확성 문제)
3. **저장하고 계속 적기** — 지금은 저장하면 무조건 홈으로 간다(`App.tsx` `onDone`). 저녁에 몰아 적기 불편
4. **반복 지출 → 고정지출로 옮기기 제안** — 같은 금액·내용이 석 달 연속이면 물어보기
5. **오프라인에서도 앱이 열리게** — 서비스워커가 없어 신호 없는 곳에선 앱 자체가 안 뜰 수 있다 (기록 저장은 오프라인 OK)
6. **카드 문자 공유로 반자동 입력** — manifest `share_target` (안드로이드만, 아이폰 불가)
7. **앱 화면에 버전 표시** — 지금은 version.json 뿐 (설정 탭 맨 아래 한 줄이면 충분)

이미 된 것: 자주 쓰는 지출 원탭(v15, 최근 90일 상위 5개).

그 밖에:
- **주소에서 `goong2001` 숨기기** — 사용자가 아이디 노출을 꺼렸다. Cloudflare Pages 로 옮기는 안을 여러 번 제안했고 **사용자 결정 대기 중**. 옮기면 홈 화면 아이콘 주소가 바뀌니 두 폰 다시 추가해야 함
- Firebase 익명 인증으로 방 잠그기 (README 끝 참고) — 초대 절차가 생겨서 보류

## 7. 사용자가 직접 해야 하는 일

- [ ] **Firestore 보안 규칙 다시 게시** — v14 에서 README 의 규칙이 바뀌었다(`updatedAt` 가드·방 코드 형식). 옛 규칙도 동작은 하지만 새 규칙이 더 안전하다. Firebase 콘솔 → Firestore → 규칙 → README 의 규칙 전체 붙여넣기 → **게시**. *했는지 확인 안 됨*
- [ ] 새 버전이 배포되면 **두 폰 모두 새로고침**
- [ ] 두 폰 모두 **홈 화면에 추가**해서 쓰기 (매번 주소 치는 게 입력을 막는 가장 큰 벽)
- [ ] **우리집 코드**를 안전한 곳에 적어두기 — 잃어버리면 새 폰을 같은 방에 못 붙인다
- [ ] 가끔 **설정 → Excel 내보내기** 백업 (동기화 안 쓰면 폰 브라우저 데이터가 유일한 사본)
- [ ] `goong2001` 주소 숨길지 결정 (6장)
