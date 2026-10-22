# habit-push — 톡톡 습관친구 푸시 알림 서버

`habit-talk` 앱에 **진짜 폰 알림**을 보내주는 Cloudflare Worker입니다.
1분마다 깨어나서 "지금 알림 보낼 시간인가" 확인하고, 맞으면 푸시를 쏩니다.

**이 서버 없이도 앱은 정상 동작합니다.** 다만 알림이 안 오고, 앱을 열었을 때
그 시간대에 왔어야 할 메시지가 밀려 있는 형태가 됩니다.

## 왜 카카오톡이 아니라 이 방식인가

진짜 카카오톡으로 자녀에게 메시지를 보내려면 카카오 비즈니스 채널 심사 +
건당 유료 알림톡 + 상시 서버가 필요합니다. 개인이 쓰기엔 문턱이 너무 높아서,
**카톡처럼 생긴 앱을 폰에 설치하고 웹 푸시로 알림을 받는** 방식으로 만들었습니다.

## 비용

전부 무료 한도 안에서 돌아갑니다.

| 항목 | 사용량 | 무료 한도 |
|---|---|---|
| Worker 요청 | 하루 약 1,440회 (1분마다) | 하루 100,000회 |
| KV 읽기 | 하루 약 1,500회 | 하루 100,000회 |
| KV 쓰기 | 하루 5~10회 | 하루 1,000회 |

KV 쓰기가 제일 빡빡한 한도라, 설정이 바뀌지 않으면 앱이 아예 업로드를 건너뛰고
Worker도 내용이 같으면 저장을 생략합니다. `list()`는 쓰지 않습니다 —
1분마다 부르면 그것만으로 하루 한도를 넘깁니다.

---

## 설치

알림 키와 암호는 **Worker 시크릿**에 넣는 것이 기본입니다. KV 는 대시보드에서
누구나 값을 열어 볼 수 있어서 개인키를 두기에 맞지 않습니다. 시크릿은 한 번
넣으면 Cloudflare 가 보관하고, 재배포해도 그대로 남습니다.

터미널(`npx wrangler`)이 한 번은 필요합니다. 대시보드만으로 하고 싶다면
Workers & Pages → 해당 Worker → **Settings → Variables and Secrets** 에서
같은 이름으로 **Secret** 타입을 골라 넣어도 됩니다.

### 1. Cloudflare 가입

<https://dash.cloudflare.com/sign-up> — 무료, 카드 등록 불필요

### 2. KV 만들기

Storage & Databases → KV → **Create Instance** → 이름 `HABIT_KV`

만들어지면 목록에 **Namespace ID**(32자리)가 나옵니다. 이 값을
`habit-push/wrangler.toml` 의 `id = "..."` 자리에 넣어야 합니다.
비밀값이 아니니 그대로 커밋하면 됩니다.

### 3. 알림 키와 암호를 시크릿에 넣기

키는 두 가지 방법으로 만들 수 있습니다.

- 터미널: `cd habit-push && npm install && npm run keys`
- 브라우저: 배포된 앱의 `/keygen.html`
  (예: `https://<계정>.github.io/homewithreed/habit-talk/keygen.html`).
  키는 그 브라우저 안에서만 만들어지고 어디로도 전송되지 않습니다.

나온 세 값을 Worker 시크릿으로 넣습니다. 값을 물어보면 붙여넣으세요.

```bash
cd habit-push
npx wrangler login
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put PASSPHRASE
```

| 시크릿 | 값 |
|---|---|
| `VAPID_PUBLIC_KEY` | 공개키 (공개돼도 되는 값) |
| `VAPID_PRIVATE_KEY` | 개인키 — **절대 커밋하거나 KV 에 넣지 마세요** |
| `PASSPHRASE` | 알림 암호 — 폰 앱 **설정 → 알림 암호** 에 똑같이 넣습니다 |

Worker 를 아직 한 번도 배포하지 않았다면 `wrangler secret put` 이 "Worker 가 없다"고
할 수 있습니다. 그때는 4번을 먼저 하고 돌아와서 넣으세요.

**KV 는 공개키 보조 저장소일 뿐입니다.** 시크릿이 없을 때만 Worker 가
KV 의 `config:vapid` (`{"publicKey":"<공개키>"}`) 와 `config:passphrase` 를 읽습니다.
예전처럼 `config:vapid` 에 `privateKey` 까지 넣어 두면 아직 동작은 하지만
로그에 경고가 남습니다 — 시크릿으로 옮기고 KV 항목은 지우세요.

### 4. 배포

두 가지 중 하나를 고르세요.

**(a) Cloudflare 가 저장소를 보고 직접 배포** —
Workers & Pages → **Create** → **Workers** 탭 → **Import a repository**
→ GitHub 연결 후 이 저장소 선택

빌드 설정:

| 항목 | 값 |
|---|---|
| Root directory | `habit-push` |
| Build command | `npm install` |
| Deploy command | `npx wrangler deploy` |

배포되면 `https://habit-push.<계정>.workers.dev` 같은 주소가 나옵니다.
앞으로는 이 폴더가 바뀔 때마다 Cloudflare 가 알아서 다시 배포합니다.

**(b) GitHub Actions 로 배포** — 타입체크와 테스트는 `.github/workflows/ci.yml`
의 `worker` 잡이 모든 push·PR 에서 돌립니다. `.github/workflows/habit-push.yml` 은
기본 브랜치에 `habit-push/**` 가 push 되면 한 번 더 확인한 뒤 `wrangler deploy` 를
실행합니다. 이 워크플로는 저장소 시크릿 `CLOUDFLARE_API_TOKEN` (Workers 편집 권한
토큰)이 있어야 합니다.
**시크릿을 넣지 않으면 이 배포 워크플로만 실패하고 테스트 결과에는 영향이 없습니다.**
(a) 방식을 쓰거나 Actions 배포가 필요 없으면 그 실패는 무시해도 되고,
`habit-push.yml` 을 지워도 됩니다. `wrangler.toml` 의 KV `id` 가
아직 자리표시자면 어느 방식이든 배포는 실패합니다.

### 5. 앱에 주소 알려주기

`habit-talk/public/push-config.json` 의 `endpoint` 에 4번 주소를 넣고
커밋하면, GitHub Pages 가 다시 배포되면서 앱에 알림 기능이 켜집니다.

```json
{ "endpoint": "https://habit-push.<계정>.workers.dev" }
```

공개키는 여기 적지 않습니다 — 앱이 Worker 의 `/health` 에서 직접 받아옵니다.
그래서 나중에 키를 바꿔도 앱은 손댈 필요가 없습니다.

### 6. 폰에서 켜기

1. 앱을 **홈 화면에 추가**
2. **홈 화면 아이콘으로 다시 열기** (아이폰은 사파리 탭에서 알림이 안 됩니다)
3. 설정 → **알림 암호** 에 3번의 암호 입력
4. **푸시 알림** 스위치 켜기 → 권한 허용

잘 됐는지 보려면 설정에서 아무 시간대나 1~2분 뒤로 바꿔두고 기다려 보세요.

---

### 터미널이 편하다면

처음부터 끝까지 CLI 로 하면 이렇습니다.

```bash
cd habit-push
npm install
npx wrangler login
npx wrangler kv namespace create HABIT_KV    # 나온 id 를 wrangler.toml 에
npm run deploy                               # 먼저 한 번 올려야 시크릿을 넣을 수 있다
npm run keys                                 # 키 만들기

npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put PASSPHRASE
```

---

## 로컬에서 확인하기

```bash
npm test        # 발송 시각 고르는 로직 테스트
npm run typecheck
```

Worker 를 직접 띄워보려면 `wrangler.toml` 을 `wrangler.local.toml` 로 복사하고
(KV `id` 는 아무 문자열이나 넣으면 됩니다) 키와 암호를 `.dev.vars` 에 적으세요.
이 파일은 `.gitignore` 에 들어 있습니다.

```
# .dev.vars
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PASSPHRASE=아무암호
```

```bash
npx wrangler dev --config wrangler.local.toml --test-scheduled --local
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*"   # 크론 강제 실행
```

`wrangler.local.toml` 은 `.gitignore` 에 들어 있습니다.

## 알아둘 것

**알림 시각이 몇 분 늦을 수 있습니다.** Cloudflare 크론은 정시를 보장하지 않습니다.
그래서 Worker는 예정 시각부터 **5분 안**이면 발송합니다. 7:30 알림이 7:33에
올 수는 있어도 아예 안 오지는 않습니다.

**드물게 알림이 두 번 올 수 있습니다.** KV는 방금 쓴 값이 바로 안 보일 수 있어서
(최대 1분쯤), 중복 방지 표시가 늦게 반영되면 같은 알림이 한 번 더 갈 수 있습니다.
메모리 캐시로 대부분 막지만 완전히 없애려면 Durable Objects가 필요합니다.
"양치했어?"가 두 번 오는 건 안 오는 것보다 낫다고 보고 이대로 뒀습니다.

**아이폰은 조건이 까다롭습니다.**
* iOS **16.4 이상**만 됩니다.
* **홈 화면에 추가한 앱 안에서만** 알림이 됩니다. 사파리 탭에서는 안 됩니다.
* 사파리와 홈 화면 앱은 **저장소가 완전히 분리**돼 있습니다. 사파리에서 설정한
  아이 이름·친구·시간표는 홈 화면 앱에 안 넘어갑니다. 홈 화면 앱에서 새로
  설정하거나, 설정 → 백업 내보내기/불러오기로 옮기세요.

**시간표를 바꿔도 재배포할 필요가 없습니다.** 알림 시각은 크론이 아니라 KV에
들어 있어서, 앱에서 시간을 바꾸면 앱이 알아서 다시 올립니다.

## API

| 경로 | 하는 일 |
|---|---|
| `POST /subscribe` | 구독 + 시간표 등록 (암호 필요). 내용이 같으면 저장을 건너뜁니다 |
| `POST /unsubscribe` | 등록 해제 (암호 필요) |
| `GET /health` | 서버 상태, VAPID 공개키, 마지막 cron 시각(`lastTickAt`). 앱이 이걸로 구독합니다 (아무 데서나 읽을 수 있음) |
| `POST /bank/subscribe` | 엄마아빠 은행: 부모 폰 구독 등록 (아래 참고) |
| `POST /bank/unsubscribe` | 엄마아빠 은행: 부모 폰 등록 해제 |
| `POST /bank/notify` | 엄마아빠 은행: 등록된 부모 폰 전부에 푸시 한 통 |

쓰기 경로(`/subscribe`, `/unsubscribe`, `/bank/*`)는 `ALLOWED_ORIGIN` 과 다른 `Origin` 에서 오면 403,
본문이 64KB 를 넘으면 413, 같은 IP 에서 1분에 10번을 넘으면 429 를 돌려줍니다.
횟수 제한은 요청마다 KV 쓰기 한 번을 쓰지만, 이 경로들은 하루에 몇 번 안 불립니다.

## 엄마아빠 은행 알림

같은 저장소의 `family-bank`(엄마아빠 은행)도 이 Worker 를 그대로 씁니다. 따로 배포할 것이 없고,
**암호(`PASSPHRASE`)와 VAPID 키를 습관친구와 공유**합니다. 아이가 은행 기기에서 "찾기 신청"을
누르면 그 기기가 `/bank/notify` 를 부르고, Worker 가 등록된 부모 폰 전부에 푸시를 보냅니다.
cron 과는 무관하고 KV 의 `bank:parents` 키 하나만 더 씁니다.

| 경로 | 본문 | 하는 일 |
|---|---|---|
| `POST /bank/subscribe` | `{ passphrase, subscription, deviceId, role: "parent" }` | 부모 폰 구독을 `bank:parents` 에 저장. 최대 4대, 같은 기기·같은 구독은 하나만, 내용이 같으면 쓰기를 건너뜁니다 |
| `POST /bank/unsubscribe` | `{ passphrase, deviceId }` | 그 기기만 뺍니다 |
| `POST /bank/notify` | `{ passphrase, title?, body, url?, tag? }` | 모든 부모 폰에 `{title, body, url, tag}` 페이로드로 푸시. 죽은 구독(404/410)은 지우고 `{ sent, parents }` 를 돌려줍니다 |

`/bank/notify` 는 암호 하나(=한 가족) 기준으로 **한 시간에 30번**까지만 보냅니다(넘으면 429).
`body` 는 300자, `title` 은 60자까지이고 `url` 은 `http(s)://` 로 시작해야 합니다.
앱 쪽 설정 방법은 `family-bank/README.md` 의 "출금 신청 알림"을 보세요.
`ALLOWED_ORIGIN` 은 GitHub Pages 의 출처(`https://<계정>.github.io`)라서 같은 사이트에 있는
은행 앱도 그대로 통과합니다.
