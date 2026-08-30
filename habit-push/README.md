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

두 가지 방법이 있습니다. 어느 쪽이든 결과는 같습니다.

### 방법 A — 브라우저만으로 (터미널 없이)

Cloudflare와 GitHub 웹 화면에서만 하면 됩니다. 사람이 직접 해도 되고,
브라우저를 다루는 AI 에이전트에게 시켜도 됩니다.

**1. Cloudflare 가입** — <https://dash.cloudflare.com/sign-up> (무료, 카드 등록 불필요)

**2. 계정 ID 확인** — 대시보드 우측 하단 또는 Workers & Pages 화면의 `Account ID` 를 복사

**3. KV 네임스페이스 만들기**
Storage & Databases → KV → **Create Instance** → 이름 `HABIT_KV` → 만든 뒤 표시되는 ID 복사

**4. API 토큰 만들기**
My Profile → API Tokens → **Create Token** → *Edit Cloudflare Workers* 템플릿 사용 →
Account Resources 에서 본인 계정 선택 → 만든 뒤 토큰 복사
(이 화면을 벗어나면 다시 볼 수 없습니다)

**5. 알림 키 만들기**
배포된 앱의 `/keygen.html` 을 엽니다. 예: `https://<계정>.github.io/homewithreed/habit-talk/keygen.html`
**키 만들기** 를 누르면 공개키·개인키·알림 암호가 나옵니다.
키는 그 브라우저 안에서만 만들어지고 어디로도 전송되지 않습니다.

**6. GitHub 에 값 등록**
저장소 → Settings → Secrets and variables → **Actions**

| 탭 | 이름 | 값 |
|---|---|---|
| Secrets | `CLOUDFLARE_API_TOKEN` | 4번 토큰 |
| Secrets | `VAPID_PRIVATE_KEY` | 5번 개인키 |
| Secrets | `PUSH_PASSPHRASE` | 5번 알림 암호 |
| Variables | `CLOUDFLARE_ACCOUNT_ID` | 2번 계정 ID |
| Variables | `HABIT_KV_ID` | 3번 KV ID |
| Variables | `VAPID_PUBLIC_KEY` | 5번 공개키 |

**7. 배포**
Actions → **Deploy push worker** → Run workflow.
끝나면 요약 화면에 Worker 주소가 나옵니다.

**8. 앱에 연결**
Variables 탭에 `PUSH_ENDPOINT` 라는 이름으로 7번 주소를 등록하고,
Actions → **Deploy to GitHub Pages** 를 다시 실행합니다.

**9. 폰에서 켜기**
앱을 홈 화면에 추가 → **홈 화면 아이콘으로 다시 열기** →
설정 → 알림 암호에 `PUSH_PASSPHRASE` 와 같은 값 입력 → 푸시 알림 스위치 켜기

---

### 방법 B — 터미널에서

```bash
cd habit-push
npm install
npx wrangler login

npx wrangler kv namespace create HABIT_KV   # 나온 id 를 wrangler.toml 에 넣기
npm run keys                                # 공개키는 wrangler.toml 에, 개인키는 아래로

npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put PASSPHRASE

# wrangler.toml 의 ALLOWED_ORIGIN(앱 주소) 과 VAPID_SUBJECT(본인 이메일) 도 채우기
npm run deploy
```

배포 후 나온 주소를 GitHub 저장소 Variables 에 `PUSH_ENDPOINT` 로,
공개키를 `VAPID_PUBLIC_KEY` 로 등록하고 Pages 워크플로를 다시 실행하면 됩니다.

---

## 로컬에서 확인하기

```bash
npm test        # 발송 시각 고르는 로직 테스트
npm run typecheck
```

Worker를 직접 띄워보려면 `wrangler.toml`을 복사해 `wrangler.local.toml`을 만들고
(KV `id`는 아무 문자열이나 넣으면 됩니다), `.dev.vars`에 시크릿을 적은 뒤:

```bash
npx wrangler dev --config wrangler.local.toml --test-scheduled --local
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*"   # 크론 강제 실행
```

두 파일 모두 `.gitignore`에 들어 있습니다.

---

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
| `GET /health` | 서버가 떠 있는지, 키가 설정됐는지 확인 |
