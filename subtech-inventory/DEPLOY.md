# 자동 배포 설정 (집 PC에서 한 번만, 약 15분)

설정이 끝나면 GitHub에 코드가 올라올 때마다 **자동으로 Apps Script에 반영되고 같은 웹앱 주소로 새 버전 배포**됩니다.
크롬으로 파일 붙여넣기, "배포 관리 > 새 버전" 누르기가 더 이상 필요 없습니다.

> 설정 전에는 GitHub 쪽 배포 작업이 "Secrets 없음"으로 **건너뛰기만** 하므로, 지금 쓰는 앱에는 아무 영향이 없습니다.

## 준비물
- 재고 스프레드시트 **주인 구글 계정**으로 로그인된 PC (Windows/Mac 모두 가능)
- GitHub `goong2001-jpg/homewithreed` 저장소 관리자 권한

## 1. Apps Script API 켜기
1. https://script.google.com/home/usersettings 접속
2. **Google Apps Script API** → **사용(ON)**

## 2. Node.js 설치
https://nodejs.org → **LTS** 버전 내려받아 설치 (다음 → 다음 → 완료)

## 3. clasp 로그인 → 열쇠 파일 만들기
1. 터미널 열기 — Windows: 시작 메뉴에서 `PowerShell`, Mac: `터미널`
2. 아래 한 줄 입력 후 Enter
   ```
   npx @google/clasp@2.4.2 login
   ```
   (처음이면 `Ok to proceed? (y)` → `y` Enter)
3. 브라우저가 열리면 **재고 시트 주인 계정**으로 로그인 → **허용**
4. 터미널에 `Authorization successful` 비슷한 문구가 나오면 성공
5. 만들어진 열쇠 파일을 메모장으로 열어 **내용 전체 복사**
   - Windows: PowerShell에 `notepad $HOME\.clasprc.json`
   - Mac: 터미널에 `open -e ~/.clasprc.json`

## 4. 스크립트 ID · 배포 ID 복사
1. 재고 스프레드시트 → **확장 프로그램 > Apps Script**
2. 왼쪽 **⚙️ 프로젝트 설정** → **스크립트 ID** 복사
3. 오른쪽 위 **배포 > 배포 관리** → 지금 쓰는 웹앱 배포를 눌러 **배포 ID**(`AKfycb…`로 시작) 복사
   - 웹앱 주소 `https://script.google.com/macros/s/여기/exec` 의 `여기` 부분과 같습니다.

## 5. GitHub에 비밀값 3개 넣기
GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Name (정확히 이대로) | Secret (붙여넣을 값) |
|---|---|
| `CLASPRC_JSON` | 3번에서 복사한 열쇠 파일 내용 전체 |
| `CLASP_SCRIPT_ID` | 4-2의 스크립트 ID |
| `CLASP_DEPLOYMENT_ID` | 4-3의 배포 ID |

## 6. 첫 배포 확인
1. GitHub 저장소 → **Actions** 탭 → 왼쪽 **써브텍 재고앱 배포** → **Run workflow** → (브랜치 `claude/spreadsheet-accessibility-opmsi3`) → **Run workflow**
2. 1~2분 뒤 초록 체크 ✅ 가 뜨면 성공 → 폰에서 앱을 새로고침해 버전(입출고 탭 위쪽 `v…`) 확인
3. 빨간 ❌ 이면 그 실행을 눌러 빨간 단계의 메시지를 캡처해서 보내주세요.

## 꼭 알아둘 점
- **이제부터 코드는 GitHub에서만 고칩니다.** 자동 배포는 Apps Script 프로젝트의 파일을 GitHub 내용으로 **통째로 바꿉니다**.
  편집기에서 직접 고친 내용은 다음 배포 때 사라집니다.
- 서버 파일 `Location`은 자동 배포 때 `LocationServer`라는 이름으로 바뀌어 올라갑니다(HTML `Location`과 이름이 겹치지 않게). 정상입니다.
- 3번의 열쇠 파일은 **구글 계정의 스크립트·드라이브에 접근할 수 있는 열쇠**입니다.
  - 메신저·메일로 보내지 말고 GitHub Secrets에만 넣으세요. 넣은 뒤 PC의 파일은 지워도 됩니다.
  - GitHub 계정에 **2단계 인증**을 꼭 켜두세요.
  - 끊고 싶을 때: https://myaccount.google.com/permissions → "clasp" 액세스 삭제 (그 뒤엔 다시 3~5번 필요)
- 배포는 `claude/spreadsheet-accessibility-opmsi3` 또는 `main` 브랜치에 `subtech-inventory/` 변경이 올라올 때 실행됩니다.
  배포 전에 문법 검사와 `Code.gs`·`Index.html` 버전 짝 검사를 하고, 틀리면 배포하지 않습니다.
