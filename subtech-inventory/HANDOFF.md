# 써브텍 재고앱 — 인수인계 (새 채팅에서 이어가기)

> 이 파일 하나만 읽으면 다음 작업자(사람이든 Claude든)가 **바로 고치고 배포까지** 할 수 있게 정리했습니다.
> 마지막 갱신: 2026-11-11 · 앱 버전 **v34** · 이후 변경은 [`CHANGELOG.md`](CHANGELOG.md) (자동 기록)

---

## 0. 새 채팅에서 이렇게 시작하세요 (복사해서 붙여넣기)

```
goong2001-jpg/homewithreed 저장소의 subtech-inventory(써브텍 재고앱) 작업을 이어서 할 거야.
브랜치: claude/spreadsheet-accessibility-opmsi3
먼저 subtech-inventory/HANDOFF.md 를 끝까지 읽고 규칙대로 해줘.
수정하면 버전 올리고, 테스트 돌리고, 커밋·푸시해서 자동 배포가 성공하는 것까지 확인해줘.
답은 한국어로, 폰으로 보니까 짧고 쉽게.

이번에 할 일: (여기에 요청)
```

---

## 1. 한눈에

| 항목 | 값 |
|---|---|
| 무엇 | 휴대폰용 재고관리 웹앱 (Google Apps Script 웹앱 + 구글 스프레드시트) |
| 저장소 / 폴더 | `goong2001-jpg/homewithreed` / `subtech-inventory/` (다른 폴더는 별개 앱) |
| 작업 브랜치 | `claude/spreadsheet-accessibility-opmsi3` (여기에 푸시하면 자동 배포) |
| 스프레드시트 | [써브텍 재고관리 시스템](https://docs.google.com/spreadsheets/d/1ZsMIBsYPHO5bPx0tuvyx15OPq9ljmZ_vY-1C_jF4LiI/edit) (ID `1ZsMIBsYPHO5bPx0tuvyx15OPq9ljmZ_vY-1C_jF4LiI`) |
| 웹앱 주소 | 고정 (자동 배포가 같은 배포를 새 버전으로 갱신). 사용자 폰 홈 화면에 있음. 시트 메뉴 `📦 재고관리 > 웹앱(폰 화면) 주소 보기` |
| 배포 | GitHub Actions `.github/workflows/deploy-subtech.yml` (clasp) — 푸시만 하면 됨 |
| 사용자 | 써브텍 대표(이현용). 삼성 폰(다크 모드)으로 사용, PC에선 Claude for Chrome으로 시트 작업. 한국어 |
| 버전 확인 | 앱 **입출고 탭 위쪽** `… · v33` |

---

## 2. 꼭 지킬 규칙

1. **새 배포 만들지 않기.** "배포 > 새 배포"를 하면 웹앱 주소가 바뀌어 모두의 폰 바로가기가 깨집니다. 자동 배포가 기존 배포를 새 버전으로 갱신합니다.
2. **시트 데이터 지우거나 덮어쓰지 않기.** 재고는 항상 `거래로그`에 줄을 **덧붙여서**(입고/출고/이동/조정) 바꿉니다. 시트 이름·열 구조 바꾸지 않기.
3. **버전 짝 맞추기.** 고칠 때마다 `Code.gs`의 `APP_VERSION`과 `Index.html`의 `HTML_VERSION`을 **같이** 올립니다 (예: `v33` → `v34`). 다르면 배포 워크플로가 막고, 앱이 "버전 불일치" 경고를 띄웁니다.
4. **코드는 GitHub에서만 고치기.** 자동 배포가 Apps Script 프로젝트 파일을 통째로 덮어씁니다 (편집기에서 직접 고친 건 사라짐).
5. **비밀값을 채팅·코드에 넣지 않기.** `CLASPRC_JSON` 등은 GitHub Secrets에만 있습니다. 사용자가 열쇠 파일을 붙여넣으려 하면 말리기.
6. **PR은 요청할 때만.** 커밋 메시지 끝에는 세션의 attribution 줄을 붙입니다. 저장소 산출물에 모델 이름 넣지 않기.
7. **푸시 후 배포 성공 확인까지가 작업 끝.** 아래 4-3 참고. 사용자에게는 "새로고침 후 vNN 확인"을 안내.
7-1. **변경 이력은 자동 기록** (`CHANGELOG.md`). 커밋 메시지 첫 줄이 곧 이력 제목이니 `vNN: 무엇을 바꿨는지` + 본문 `- ` 목록으로 쓴다. `CHANGELOG.md`는 손대지 않는다. 배포 뒤 봇이 커밋을 하나 더 올리므로 **작업 시작·푸시 전에 `git pull --rebase origin claude/spreadsheet-accessibility-opmsi3`**.
8. 사용자 응답은 **한국어, 짧게, 폰에서 읽기 쉽게**. 결정이 필요하면 추천안을 먼저.

---

## 3. 구조

### 파일
| 파일 | 역할 |
|---|---|
| `Code.gs` | 서버 본체: `doGet`, `appBoot`/`bootstrap`, 입출고(`save`, `moveStock`, `adjustStock`, `saveNote`), 품목, BOM·조립, 메모, 월별 리포트, 시트 메뉴(`onOpen`), `resetStock`, `computeStock_` |
| `Location.gs` | 위치도 서버: 저장(`locGet`/`locSave`/`locApply`), 칸 목록(`locSlots_`, `위치목록` 시트), 이동(`locMove`), 위치도에서 입고(`locQuickIn`)·출고(`locQuickOut`)·칸별 수량(`locSetQty`), 전체 초기화(`resetAllStock`). **배포 때 `LocationServer.gs` 이름으로 올라감** (HTML `Location`과 이름 충돌 방지) |
| `Index.html` | 앱 화면 전체 (한 페이지): 탭 = 📍위치도 · 🧮총수량 · ➕입출고 · 📊현재고 · 🧩조립 · 📝메모 |
| `Location.html` | 위치도 화면. `Index.html` 안에 `<?!= locInclude() ?>`로 끼워짐 (`window.LOC_HOSTED=true`) |
| `SpecMemos.gs` | 업체사양 263곳 → `메모` 탭 가져오기 (시트 메뉴, 백업/되돌리기) — 이미 실행 완료 |
| `SeedMemos.gs` | 옛 375개 카톡 추출 메모 일괄 등록 (예전 것) |
| `appsscript.json` | 웹앱: `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`(주소만 있으면 로그인 없이), V8 |
| `DEPLOY.md` | 자동 배포 최초 설정법 (PC에서 한 번, **이미 완료**) |
| `CHANGELOG.md` | 변경 이력 — v34부터 배포 성공 시 **자동 기록** (손으로 고치지 않음) |
| `dev/` | 테스트 도구 (배포되지 않음) — 4-2 참고 · `dev/changelog.js` = 이력 자동 기록 스크립트 |

### 시트 (스프레드시트 탭)
| 탭 | 내용 |
|---|---|
| `품목마스터` | 품목ID(`품명||분류`) · 품명 · 분류 · 기본박스입수 · 안전재고 · 비고 |
| `거래로그` | 13열: 일시 · 품목ID · 품명 · 분류 · **위치** · 구분(입고/출고/이동/조정/기록) · 박스수 · 박스당수량 · 총개수 · **증감수량** · 담당자 · 메모 · 사진. **재고 = 품목·위치별 증감수량 합계** (`computeStock_`) |
| `위치도` | 위치도 앱 데이터 JSON (A1 버전, A2부터 4만 자씩 나눠 저장). 직접 수정 금지 |
| `위치목록` | 위치도 칸 평면 목록 (시트 · 칸 · 이름 · 층 · 자재 · 적재방식) — 저장 때마다 자동 갱신, 보기용 |
| `현재고`, `월별리포트` | 보기용 집계 |
| `설정` | A열 담당자 목록 (앱 담당자 선택지) |
| `메모` | 업체 사양 메모 (274행) · `메모_백업_…` 백업 탭 |
| `BOM` | 조립 레시피 |
| `위치` | 옛 보관 위치 목록 (지금은 위치도가 주로 쓰임) |

### 핵심 개념
- **품목ID = `품명||분류`.** 같은 품명이 분류만 다르게 여러 개 있음 (예: `STT1.3`이 벌크·완포·기판·선작업완료·소박스). 화면에선 항상 `품명(분류)`로 구분해서 보여줌 (v33).
- **위치 이름(키) = `시트이름 칸코드`** + 2층 이상이면 `" N층"`. 예: `A동1층! D7`, `B동1층 C1 2층`. 칸코드: 줄 A–Z, AA…(엑셀식) + 칸 번호. 칸 **이름(label)은 표시용**이라 키에 안 들어감.
  - 그래서 칸을 옮기거나 시트 이름을 바꾸면 재고를 **이동/조정 줄로 따라 옮겨야** 함 → `locApply(json, baseVersion, mv)`가 위치도 저장과 재고 이동을 한 번에(원자적으로) 처리.
- **위치도 데이터(JSON)**: `{sheets:[{id,name,rows,cols,cells:{"r,c":{type:'slot'|'label'|'void', label, layers:[{t:메모, p:[{id,name}] (📌지정 제품)}], rs, cs, kind:'초록차'|'L카'|'파렛트'}}}], cur, order:{품목ID:{t,by,o?,ob?}}}`
  - `order` = 🚫재고X(`o` 없음) / 📦발주완료(`o` 있음). 모두에게 공유됨.
  - 저장은 **버전 확인**: 서버 버전과 다르면 `conflict`로 거절하고 최신을 돌려줌.
- **빠른 시작**: 마지막 데이터를 폰 `localStorage`(`subtek-boot-v1`)에 저장해 두고 먼저 그린 뒤 서버 최신으로 교체. 저장본을 보여주는 동안(`STALE`, 상태 "최신 확인 중…")엔 **고치기 막음** (옛 버전 저장 → 거절 → 입력 사라짐 방지, v27).

### 화면 ↔ 서버, 위치도 ↔ 재고앱
- 처음 한 번 `appBoot()` (품목·재고·담당자 + 위치도). 이후 탭 전환은 서버를 다시 부르지 않음. 위치별 재고(`STK`)는 `items[].locs`로 화면에서 계산.
- `Location.html` → `window.locApi`: `init(loc, cached)`, `setStock(items, staff)`, `search(q)`, `editLoc(key)`, `busy()`, `slots()`, `snapshot()`, `orders()`, `orderMap()`, `clearOut(id)`, `openOrders()`
- `Index.html` → `window.locHost`: `open(p)`, `itemUpserted(item)`, `stockChanged(stk)`, `mapChanged(slots)`, `orderChanged()`

---

## 4. 작업 → 테스트 → 배포

### 4-1. 고치기
- 밸런스/문구 등 작은 수정도 위 규칙 3(버전 짝) 필수.
- `google.script.run` 서버 함수는 **이름 끝이 `_`면 화면에서 못 부름** (비공개).
- ⚠️ 함정: 칸 창(`drawCell`)은 마지막에 `[data-a]` 버튼 전부에 공통 onclick을 덮어씀. 새 버튼은 **고유 속성**(`data-qsave`, `data-lconv` 등)을 쓸 것 (v28 버그 원인).
- ⚠️ 한글 입력(IME) 중인 입력칸은 다시 그리지 말 것 — 목록만 다시 그리기 (v19).
- **거래 취소(`undoTransaction(row, key)`)는 줄을 지우지 않는다** (v34): 같은 구분·위치로 총개수·증감수량만 부호 반대인 줄을 덧붙이고 메모에 `취소: 원래일시 구분 #시각키`. 이미 취소된 줄은 `undoneSet_`로 찾아 이력에 "취소됨"으로 표시.
- **다크 모드**: `Index.html` 스타일 맨 아래 `@media (prefers-color-scheme:dark)` 블록. 새 화면 요소에 밝은 배경을 쓰면 그 블록에도 추가할 것 (글자색을 JS 안 style로 넣지 말고 클래스로).
- 버튼은 **높이 44px 이상** (`Location.html` 스타일 맨 아래 v34 블록), 글씨는 12px 미만 쓰지 않기.
- ⚠️ 클릭 중 다시 그려진 버튼은 `isConnected=false` → 바깥 클릭 처리에서 무시 (검색 결과 창, v30).

### 4-2. 테스트 (클라우드 세션엔 Chromium·Playwright 이미 설치됨)
```bash
cd /home/user/homewithreed   # 저장소 루트
node subtech-inventory/dev/server-test.js            # 서버 함수 (가짜 시트로 node 실행)
node subtech-inventory/dev/mock-page.js && node subtech-inventory/dev/smoke.js   # 폰 화면 스모크 테스트
```
- `dev/mock-page.js`는 `Index.html`+`Location.html`을 합치고 가짜 `google.script.run`을 끼운 `dev/out/page.html`을 만듦 (견본 데이터). 실제 데이터로 보려면 `node dev/mock-page.js data.json` (`{map, items, ver}`) — **실데이터 파일은 커밋 금지**.
- 실제 시트를 봐야 하면 Google Drive 커넥터로 스프레드시트를 xlsx로 내려받아 읽을 수 있음 (v28 때 거래로그 확인에 사용).
- 화면 확인은 Playwright로 스크린샷(`devices['Galaxy S9+']`), 다크 모드는 `colorScheme:'dark'`.

### 4-3. 배포
1. 커밋 (메시지: `vNN: …` + `- ` 목록 — 그대로 이력이 됨) → `git pull --rebase origin claude/spreadsheet-accessibility-opmsi3` → `git push -u origin claude/spreadsheet-accessibility-opmsi3`
2. GitHub Actions **써브텍 재고앱 배포**가 자동 실행: 문법 검사 → 버전 짝 검사 → `clasp push --force` → 기존 배포 ID로 `clasp deploy -i` (주소 그대로)
3. 성공 확인 (1~2분):
   ```bash
   H=$(git rev-parse --short=7 HEAD)
   for i in $(seq 1 24); do sleep 15; out=$(gh api "repos/goong2001-jpg/homewithreed/actions/workflows/deploy-subtech.yml/runs?per_page=1" --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'); echo "$out" | grep -q "^$H completed" && break; done; echo "$out"
   ```
   `gh`가 없으면 GitHub MCP 도구 `actions_list`(workflow `deploy-subtech.yml`) / `get_job_logs`.
4. 배포가 성공하면 같은 실행의 **변경 이력 자동 기록** 단계가 `CHANGELOG.md` 맨 위에 그 커밋(들)을 추가하고 봇 커밋(`[skip ci] 변경 이력 자동 기록 (vNN)`)을 푸시함 → 로컬도 `git pull --rebase` 해서 맞춰 두기. (이 단계가 실패해도 배포는 성공 — 경고만 뜸)
5. 사용자에게: "폰에서 새로고침 → 입출고 탭 위쪽 **vNN** 확인".
- 실패하면: 빨간 단계 로그 확인. 배포 ID 문제면 워크플로가 가려진 배포 목록을 보여줌. Secrets: `CLASPRC_JSON`, `CLASP_SCRIPT_ID`, `CLASP_DEPLOYMENT_ID` (설정법 `DEPLOY.md`).
- 푸시가 "could not read Username"로 실패하면 세션의 GitHub 연결이 끊긴 것 → 사용자에게 연결 확인 요청.

---

## 5. 사용자가 시트에서 해야 하는 일 (Claude가 못 함)
- 시트 메뉴 `📦 재고관리` (Apps Script 메뉴)는 사용자가 PC에서 직접(또는 Claude for Chrome으로) 실행. 필요하면 **Claude for Chrome용 지시문**을 만들어 주면 됨.
- 앱 안에서 되는 것은 앱으로 안내 (예: 전체 초기화 = 🧮총수량 탭 맨 아래 버튼, "초기화" 입력).

---

## 6. 변경 이력

> **v34부터는 [`CHANGELOG.md`](CHANGELOG.md)에 자동 기록됩니다** — 배포가 성공할 때마다 GitHub Actions(`deploy-subtech.yml`의 "변경 이력 자동 기록" 단계, 스크립트 `dev/changelog.js`)가 그 푸시의 커밋 메시지(버전 · 한국 시간 · 커밋 해시 · 본문 목록)를 맨 위에 추가합니다. 아래 표는 v33까지의 정리본입니다 (같은 내용이 CHANGELOG.md 아래쪽에도 있음).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1–v7 | 06-27 ~ 07-02 | 입출고 기록 → 현재고 자동 계산, 박스수×박스당수량 줄, 품목 추가/삭제/이름변경, 분류 색, 현재고 검색·정렬, 메모 탭(업체 사양), BOM·조립 가능 수량, 월별 리포트, 재고 조정, 이력·취소, 거래 사진(최대 5장), 기존 써브텍 1회 가져오기(설정과 분리), 전체 0 초기화 메뉴, 버전 표시·불일치 검사 |
| v8 | 07-15 | 수량 없이 사진·메모만 기록, 분류 선택 목록 |
| v9 | 07-15 | 위치 간 이동, 조립 실행, 전체 이력, 품목 정보 수정 |
| v10–v11 | 09-27 ~ 10-06 | 창고 지도(초기 버전), 지도에서 현재 위치 표시·검색 · `SeedMemos.gs` 375개 메모 |
| v12–v13 | 10-07 | **자재 위치도** 도입 (시트별 칸 지도), 위치도 칸 = 입출고 보관 위치로 연결 |
| (위치도) | 10-14 ~ 10-22 | 50×50까지, 위치도 안에서 재고 이동(품목/층/칸째), 줄·칸 옮기기, 📌제품 지정, 재고 있는 시트 삭제·이름변경, 읽기 쉬운 칸·확대/축소, 줄 정리 |
| v15 | 10-27 | **한 페이지 앱**(위치도가 첫 화면), 품목별 위치·총수량, 빠른 로딩, **GitHub 자동 배포** · `SpecMemos.gs`(업체사양 → 메모 탭) |
| v16–v17 | 10-28 | 위치도에서 바로 입고(새 품목 생성 포함), 분류 드롭다운 |
| v18 | 10-28 | 조립·메모 탭 즉시 열림 (미리 받아 두기) · 시트 메뉴로 업체사양 가져오기/되돌리기 (사용자 실행 완료: 메모 274행) |
| v19 | 10-28 | 입고 품목 검색 한글 입력 수정, 박스당 수량이 기본값 따라감 |
| v20 | 11-02 | 칸 길게 눌러 끌어서 이동/맞바꾸기 (PC는 마우스 드래그) |
| v21 | 11-04 | 위치도 입고: 박스 줄 여러 개 |
| v22 | 11-05 | 어떤 칸이든 삭제 (재고 출고/조정으로 차감) |
| v23 | 11-05 | 칸 적재 방식 (초록차·L카 이동 / 파렛트 고정), "(L)" 표기 일괄 변환 |
| v24 | 11-09 | **칸별 수량 입력**(조정), **🧮 총수량 탭**("200개 (총수량 400개)"), 안전한 전체 초기화(조정 줄, 이력 유지) — 11-09 오전 사용자 초기화 실행 완료 |
| v25 | 11-09 | 수량 입력 = 박스 줄 + 낱개, 빠른 시작(폰 저장본), `appBoot` 경량화 |
| v26 | 11-09 | 시트별 색 + "📍 시트이름 · n/N" 표시줄, 패널 제목에 시트 배지 |
| v27 | 11-09 | 빠른 시작 저장본이 옛 버전일 때 저장 거절되던 문제 → 최신 오기 전 편집 막기, 저장본 수시 갱신 |
| v28 | 11-09 | 칸 창(일반 모드) 수량 **저장 버튼이 안 되던 버그** 수정 (`data-a` 덮어쓰기) |
| v29 | 11-09 | **위치도에서 바로 출고** (박스 줄 + 낱개, 이 칸 전부, 메모) |
| v30 | 11-10 | 검색: 같은 이름 한 카드(분류별 줄), 정확히 일치 먼저, `이름 분류` 띄어쓰기 검색, 분류 칩 — 위치도·입출고·총수량 공통 |
| v31 | 11-10 | **🚫 재고X** 표시 + 발주 목록(복사해서 카톡으로) |
| v32 | 11-10 | **📦 발주완료** 표시 (재고X 옆), 입고·수량 입력 시 자동 해제 |
| v33 | 11-11 | 위치도 칸·📌칩·보관칸 목록에 **품명(분류)** 표시, 제품 지정 검색도 `이름 분류` 지원 · 인수인계 문서와 `dev/` 테스트 도구 추가 |

자세한 기능 설명은 `README.md`, 커밋별 상세는 `git log -- subtech-inventory`.

---

## 7. 남은 일 · 아이디어 (요청 오면)
- 위치도 **입고 창에 낱개 칸** (출고·수량 입력엔 있음).
- 시트 색을 사용자가 직접 고르기 (지금은 시트 순서대로 자동 색).
- **보기 전용 주소**(`?view=1`) — 다른 사람에게 위치만 보여주기 (논의만 함).
- 앱 접근을 구글 로그인으로 제한 (지금은 주소만 알면 누구나 수정 가능 — 사용자에게 안내함).
- 사용자가 실사(칸별 수량 입력) 진행 중: 🧮 총수량 탭 "미입력 있음"으로 남은 칸 확인.
