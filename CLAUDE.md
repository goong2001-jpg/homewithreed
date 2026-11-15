# homewithreed

폴더마다 독립된 정적 앱이 들어 있다. 각 앱 작업은 해당 폴더 README를 따른다.

## 가계부 (couple-budget)
`couple-budget`(우리집 하루수입 가계부) 작업은 시작 전에 `couple-budget/HANDOFF.md` 를 먼저 읽고 `couple-budget/CLAUDE.md` 규칙을 따른다.
`couple-budget/CHANGELOG.md` 는 배포 때 자동 기록되므로 손대지 않는다.

## 기술 학습 코치
사용자가 "시작", "복습", "면접모드"라고 하거나 기술 학습 코칭을 요청하면
`tech-coach/CLAUDE.md` 지침을 읽고 그대로 진행한다.

## 게임 앱
`hunter-town`(헌터 마을)과 `god-village`(신의 마을)는 코드로 그린 픽셀 게임이다.
`god-village`는 숫자·시대·기술·건물·대사가 전부 `god-village/data.js`에 있으니 밸런스나 내용 수정은 그 파일부터 본다. 자세한 구조와 고치는 법은 `god-village/README.md`.

## 씨앗 마을 (seed-town)
`seed-town`(아이가 커 가며 투자를 배우는 가족 게임) 작업은 시작 전에 `seed-town/HANDOFF.md` 를 먼저 읽는다.
기획·결정사항·단계 로드맵·중단 기준이 거기 있고, 작업이 끝나면 그 파일의 "지금 상태"와 "다음 할 일"을 고친다.
숫자·가게·소식·배지는 전부 `seed-town/data.js`, 규칙은 `seed-town/engine.js` 에 있다.
