#!/usr/bin/env bash
# GitHub Actions 전용 — 배포가 성공한 뒤 CHANGELOG.md 를 갱신해 기본 브랜치에 푸시한다.
# (deploy.yml 의 couple-budget-changelog 작업이 부른다. 손으로 돌릴 일은 없다.)
#
# 필요한 환경변수: BRANCH(기본 브랜치 이름), DEPLOYED_SHA(이번에 배포된 커밋)
#
# - 기록 커밋 메시지에 [skip ci] 를 넣고, GITHUB_TOKEN 으로 푸시하므로
#   이 커밋이 배포 워크플로를 다시 돌리지 않는다.
# - 다른 푸시와 엇갈리면 최신 브랜치에서 처음부터 다시 만든다 (기록은 몇 번 돌려도 같다).
set -euo pipefail
: "${BRANCH:?BRANCH 가 필요합니다}" "${DEPLOYED_SHA:?DEPLOYED_SHA 가 필요합니다}"

FILE=couple-budget/CHANGELOG.md
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in 1 2 3 4; do
  git fetch --quiet origin "$BRANCH"
  git reset --quiet --hard "origin/$BRANCH"

  node couple-budget/dev/changelog.mjs --upto "$DEPLOYED_SHA"

  if git diff --quiet -- "$FILE"; then
    echo "CHANGELOG: 이미 최신입니다."
    exit 0
  fi

  git add "$FILE"
  git commit --quiet -m "couple-budget: CHANGELOG 자동 기록 (${DEPLOYED_SHA:0:7}) [skip ci]"
  if git push --quiet origin "HEAD:$BRANCH"; then
    echo "CHANGELOG: 기록해서 푸시했습니다 → $(git rev-parse --short HEAD)"
    exit 0
  fi
  echo "CHANGELOG: 푸시가 엇갈렸습니다. 최신 브랜치에서 다시 만듭니다 ($attempt/4)"
  sleep $((attempt * 5))
done

echo "CHANGELOG: 4번 모두 푸시에 실패했습니다. 다음 배포 때 빠진 기록을 따라잡습니다."
exit 1
