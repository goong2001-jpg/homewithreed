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

**API 토큰도, 시크릿 등록도 필요 없습니다.** Cloudflare 대시보드에서 저장소를
연결하고, 알림 키는 KV 에 넣어두면 Worker 가 알아서 읽어 씁니다.

브라우저에서만 하면 되는 일이라 사람이 직접 해도 되고, 브라우저를 다루는
AI 에이전트에게 시켜도 됩니다.

### 1. Cloudflare 가입

<https://dash.cloudflare.com/sign-up> — 무료, 카드 등록 불필요

### 2. KV 만들기

Storage & Databases → KV → **Create Instance** → 이름 `HABIT_KV`

만들어지면 목록에 **Namespace ID**(32자리)가 나옵니다. 이 값을
`habit-push/wrangler.toml` 의 `id = "..."` 자리에 넣어야 합니다.
비밀값이 아니니 그대로 커밋하면 됩니다.

### 3. 알림 키를 KV 에 넣기

배포된 앱의 `/keygen.html` 을 엽니다.
예: `https://<계정>.github.io/homewithreed/habit-talk/keygen.html`
**키 만들기** 를 누르면 세 값이 나옵니다. 키는 그 브라우저 안에서만
만들어지고 어디로도 전송되지 않습니다.

방금 만든 KV 에서 **Add entry** 로 두 개를 넣으세요.

| Key | Value |
|---|---|
| `config:vapid` | `{"publicKey":"<공개키>","privateKey":"<개인키>"}` |
| `config:passphrase` | `<알림 암호>` |

`config:vapid` 는 위 형태의 JSON 한 줄이어야 합니다. keygen 페이지가
붙여넣기 좋게 만들어 줍니다.

알림 암호는 나중에 폰 앱 **설정 → 알림 암호** 에도 똑같이 넣어야 하니
기억해 두세요.

### 4. 저장소 연결해서 배포

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

같은 일을 CLI 로도 할 수 있습니다.

```bash
cd habit-push
npm install
npx wrangler login
npx wrangler kv namespace create HABIT_KV    # 나온 id 를 wrangler.toml 에
npm run keys                                 # 키 만들기

# 키와 암호를 KV 에 넣는다
npx wrangler kv key put --binding HABIT_KV "config:vapid" '{"publicKey":"...","privateKey":"..."}'
npx wrangler kv key put --binding HABIT_KV "config:passphrase" "정한암호"

npm run deploy
```

KV 대신 Worker 시크릿을 쓰고 싶으면 `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY`
`PASSPHRASE` 를 넣어도 됩니다. 그쪽이 있으면 KV 보다 우선합니다.

---

## 로컬에서 확인하기

```bash
npm test        # 발송 시각 고르는 로직 테스트
npm run typecheck
```

Worker 를 직접 띄워보려면 `wrangler.toml` 을 `wrangler.local.toml` 로 복사하고
(KV `id` 는 아무 문자열이나 넣으면 됩니다) 키를 로컬 KV 에 넣으세요.

```bash
npx wrangler kv key put --local --config wrangler.local.toml --binding HABIT_KV \
  "config:vapid" '{"publicKey":"...","privateKey":"..."}'
npx wrangler kv key put --local --config wrangler.local.toml --binding HABIT_KV \
  "config:passphrase" "아무암호"

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
| `GET /health` | 서버 상태와 VAPID 공개키. 앱이 이걸로 구독합니다 (아무 데서나 읽을 수 있음) |
