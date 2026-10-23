# AI 사무실 (ai-office)

내 PC 에서 돌아가는 **Claude Code** 를 "회사"처럼 꾸며, 총괄 AI 가 지시를 받아 팀장·직원(서브에이전트)에게 일을 나눠 주고
결과를 모아 보고하는 모습을 **픽셀 사무실 화면**으로 지켜보는 앱입니다. 폰에서도 명령을 내리고 결과를 볼 수 있습니다.

다른 폴더의 앱과 달리 **GitHub Pages 에 올려서 쓰는 앱이 아닙니다.** PC 에서 작은 브리지 서버(Node)를 켜 두고,
그 서버가 화면도 서빙하고 Claude Code 도 실행합니다. Claude 호출은 전부 **내 Claude 구독(Claude Code 로그인)** 으로 이뤄지고, API 키는 쓰지 않습니다.

```
폰/PC 브라우저  ──(Tailscale)──▶  브리지 서버 (server/server.js, 7777)
                                     ├─ public/  사무실 화면
                                     └─ claude -p ... (총괄)
                                          ├─ plan_lead  기획팀장
                                          ├─ researcher 조사원   ┐ 동시 진행
                                          ├─ planner    기획자   ┘
                                          ├─ maker      제작자
                                          ├─ reviewer   검토자
                                          └─ build_lead 제작팀장
```

## 조직

| 캐릭터 | subagent | 하는 일 | 정의 파일 |
|---|---|---|---|
| 총괄 | (본 세션) | 지시 접수, 업무 분배, 최종 보고 | `office/ceo.md` |
| 기획팀장 | `plan_lead` | 작업 계획과 역할 분담 | `office/agents/plan_lead.md` |
| 제작팀장 | `build_lead` | 결과물 통합, 품질 확인 | `office/agents/build_lead.md` |
| 조사원 | `researcher` | 자료 조사(웹 검색 포함) | `office/agents/researcher.md` |
| 기획자 | `planner` | 구조·목차 설계 | `office/agents/planner.md` |
| 제작자 | `maker` | 문서·코드 작성 | `office/agents/maker.md` |
| 검토자 | `reviewer` | 검토와 개선안 | `office/agents/reviewer.md` |

Claude Code 의 서브에이전트는 다른 서브에이전트를 부를 수 없어서, 실제 호출은 전부 총괄이 합니다.
팀장은 "계획"과 "통합"을 맡는 역할이고, 화면에서는 총괄실로 보고하러 오가는 모습으로 표현됩니다.

직원을 바꾸거나 늘리려면 `office/agents/*.md` 를 고치거나 추가하고, `office/org.json` 에 캐릭터(이름, 색, 자리)를 넣고,
`office/ceo.md` 의 조직 목록에 한 줄 추가하면 됩니다. 서버는 작업을 시작할 때마다 이 파일들을 작업 폴더의 `.claude/agents/` 로 복사합니다.

## 설치 (Windows)

1. **Node.js LTS** 설치: https://nodejs.org
2. **Git for Windows** 설치: https://git-scm.com (Claude Code 가 Windows 에서 필요로 함)
3. **Claude Code** 설치: 터미널(PowerShell)에서
   ```
   npm install -g @anthropic-ai/claude-code
   ```
4. 이 저장소를 받고 `ai-office` 폴더로 이동
5. `config.example.json` 을 복사해 `config.json` 을 만들고 고칩니다.
   ```json
   {
     "port": 7777,
     "pin": "원하는숫자",
     "workspace": "C:/Users/내이름/ai-office-work",
     "accounts": [
       { "id": "main", "name": "내 계정", "configDir": "~/.claude-office-main" }
     ]
   }
   ```
   * `pin`: 화면을 열 때 묻는 비밀번호. 폰에서 접속하므로 꼭 설정하세요.
   * `workspace`: 직원들이 파일을 만드는 작업 폴더. 결과물은 그 아래 `output/날짜-제목/` 에 쌓입니다.
     이 폴더 **밖은 건드리지 않도록** 총괄 지침에 적혀 있지만, 중요한 파일이 있는 폴더는 피하세요.
6. 계정 로그인
   ```
   npm run login -- main
   ```
   Claude Code 가 열리면 안내에 따라 브라우저에서 로그인하고, 끝나면 `/exit` 로 나옵니다.
7. 서버 시작: `start.bat` 더블클릭 또는
   ```
   npm start
   ```
   Windows 방화벽이 물으면 **개인 네트워크 허용**을 고릅니다. 브라우저에서 `http://localhost:7777` 을 엽니다.

Claude 설정 전에 화면만 보고 싶으면 `npm run mock` 으로 켜거나, 화면의 **데모** 버튼을 누르세요. 가짜 회사가 돌아갑니다.

## 폰에서 쓰기 (Tailscale)

1. PC 와 폰에 **Tailscale** 을 설치하고 같은 계정으로 로그인합니다. https://tailscale.com
2. 폰 브라우저에서 `http://<PC의 Tailscale 이름 또는 100.x.x.x 주소>:7777` 을 엽니다.
   PC 이름은 Tailscale 앱의 기기 목록에 나옵니다(예: `http://desktop-abc:7777`).
3. PIN 을 입력하고, 브라우저 메뉴에서 **홈 화면에 추가**하면 앱처럼 쓸 수 있습니다.

집 밖에서도 PC 가 켜져 있고 Tailscale 이 연결돼 있으면 접속됩니다. PC 절전 설정을 "안 함"으로 두세요.

## 계정 여러 개

`config.json` 의 `accounts` 에 항목을 추가하고 각각 `npm run login -- <id>` 로 로그인합니다.

```json
"accounts": [
  { "id": "main",  "name": "내 계정",     "configDir": "~/.claude-office-main" },
  { "id": "wife",  "name": "아내 계정",   "configDir": "~/.claude-office-wife" }
]
```

화면 위쪽 **계정** 드롭다운에서 어느 계정으로 실행할지 고릅니다. 계정마다 로그인이 따로 저장되므로 한 계정의 사용량이 차면 다른 계정으로 바꿔 계속 쓸 수 있습니다.
Claude 구독은 1인 1계정이 원칙입니다. 가족이 각자 자기 계정을 등록해 쓰는 용도로 생각하세요.

## 화면 사용법

* **보내기**: 총괄에게 지시. 긴 작업이면 직원들이 자리와 총괄실을 오가며 일하는 모습이 보입니다. `Ctrl+Enter` 로도 보냅니다.
* **이어서**: 체크하면 바로 전 작업의 대화를 이어서 지시합니다("아까 문서 3장을 더 짧게").
* **중지**: 실행 중인 작업을 끊습니다. 대기 중인 작업은 대기열의 × 로 뺍니다.
* **실황**: 누가 무엇을 하는지(말, 도구 사용, 보고). **결과**: 총괄의 최종 보고. **기록**: 지난 작업 50개. **조직**: 직원 목록과 상태.
* 한 번에 한 작업만 돌고, 추가로 보낸 지시는 대기열에 들어갑니다.

## 사용량과 비용

명령 하나에 총괄 + 호출된 직원 수만큼 Claude 대화가 생깁니다(보통 5~10회). 구독 사용량 한도를 빨리 쓰므로
직원 정의 파일의 `model: sonnet` 처럼 역할별 모델을 가볍게 두거나, 단순한 지시는 총괄이 직접 처리하도록 두는 편이 좋습니다(`ceo.md` 에 이미 그렇게 적혀 있음).

## 설정 항목 (config.json)

| 키 | 기본값 | 뜻 |
|---|---|---|
| `port` / `host` | 7777 / 0.0.0.0 | 서버 포트와 바인드 주소 |
| `pin` | 1234 | 화면 PIN. 비우면 인증 없음(권장하지 않음) |
| `workspace` | `~/ai-office-work` | 작업 폴더 |
| `claudeCommand` | `claude` | Claude Code 실행 명령. PATH 에 없으면 전체 경로 |
| `model` | (비움) | 총괄 모델 지정. 비우면 Claude Code 기본값 |
| `permissionMode` | `acceptEdits` | 파일 쓰기는 자동 허용 |
| `allowedTools` | 읽기·쓰기·검색·웹 | 자동 허용되는 도구 목록. Bash 는 기본 제외 |
| `allowBash` | false | true 면 직원이 명령어 실행 가능(코드 작업에 필요하지만 위험도 있음) |
| `skipPermissions` | false | true 면 모든 권한 확인 생략. 작업 폴더가 격리돼 있을 때만 |
| `hooks` | true | 작업 폴더 `.claude/settings.local.json` 에 훅을 넣어 직원들의 세부 동작도 화면에 표시 |

환경변수 `AI_OFFICE_PORT`, `AI_OFFICE_PIN`, `AI_OFFICE_WORKSPACE`, `AI_OFFICE_CLAUDE`, `AI_OFFICE_MOCK=1` 로도 덮어쓸 수 있습니다.

## 문제가 생기면

* **"claude 실행 실패 … ENOENT"**: Claude Code 가 설치돼 있지 않거나 PATH 에 없음. 새 터미널에서 `claude --version` 이 되는지 확인하고, 안 되면 `claudeCommand` 에 전체 경로를 적습니다.
* **로그인하라는 오류로 바로 끝남**: 해당 계정으로 `npm run login -- <id>` 를 다시 실행합니다.
* **폰에서 401 / PIN 틀림**: `config.json` 의 `pin` 과 같은지 확인. 바꿨으면 서버를 다시 켭니다.
* **폰에서 접속 자체가 안 됨**: PC 와 폰의 Tailscale 이 둘 다 연결 상태인지, PC 방화벽이 7777 포트를 막지 않는지 확인.
* **직원 세부 동작이 안 보임**: 훅은 `node` 가 PATH 에 있어야 합니다. 안 보여도 총괄의 일 분배와 보고는 stream-json 으로 그대로 표시됩니다.
* **일하는 도중 멈춘 듯 보임**: 긴 조사나 작성은 한 직원이 몇 분씩 걸릴 수 있습니다. 실황 탭의 마지막 시각을 보세요.

## 테스트

```bash
cd ai-office
npm test            # stream-json 파서 테스트(가짜 claude 출력 사용)
npm run mock        # 가짜 회사로 서버 실행 후 http://localhost:7777
```

## 파일 구성

```
ai-office/
├─ server/server.js        브리지 서버(화면 서빙, 명령 큐, SSE, 기록)
├─ server/claude-runner.js claude -p 실행과 직원 정의·훅 설치
├─ server/office-events.js stream-json → 화면 이벤트 변환
├─ server/hook.js          Claude Code 훅(서버로 전달)
├─ server/login.js         계정별 로그인
├─ server/mock-claude.js   가짜 claude(데모·테스트)
├─ office/ceo.md           총괄 지침
├─ office/agents/*.md      직원 정의(Claude Code 서브에이전트 형식)
├─ office/org.json         캐릭터·자리 배치
├─ public/                 화면(HTML/CSS/JS, PWA)
└─ config.example.json     설정 본보기 → config.json 으로 복사
```
