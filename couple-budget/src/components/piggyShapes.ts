/**
 * 돼지저금통 도형 데이터.
 *
 * 베지어를 손으로 맞추는 대신 기본 도형(타원·삼각형·사각형)의 합집합으로 실루엣을 만든다.
 * 결과가 예측 가능하고, 나중에 사람 실루엣이나 밥상 모양을 넣고 싶으면
 * 이 파일에 상수 묶음을 하나 더 만들면 된다.
 *
 * 몸통과 주둥이는 '채워지는 부분'(clipPath 안), 귀·다리·꼬리는 채워지지 않는 장식이다.
 */

export const VIEWBOX = { w: 210, h: 172 };

/** 몸통 — 채워지는 주 영역 */
export const PIG_BODY = { cx: 98, cy: 90, rx: 70, ry: 52 };

/** 주둥이 — 몸통과 함께 채워진다 */
export const PIG_SNOUT = { cx: 170, cy: 99, rx: 22, ry: 17 };

/** 물이 차오르는 구간 = 몸통의 위/아래 끝 */
export const BODY_TOP = PIG_BODY.cy - PIG_BODY.ry;      // 38
export const BODY_BOTTOM = PIG_BODY.cy + PIG_BODY.ry;   // 142
export const BODY_H = BODY_BOTTOM - BODY_TOP;           // 104

/** 귀 두 개 (몸통 위에 얹힌 장식) */
export const PIG_EARS = 'M52 50 L66 26 L82 46 Z  M104 44 L122 26 L132 50 Z';

/** 다리 — 몸통 아래로 살짝 나온다 */
export const PIG_LEGS =
  'M52 132 h17 v22 q0 5 -8.5 5 t-8.5 -5 Z  M112 132 h17 v22 q0 5 -8.5 5 t-8.5 -5 Z';

/** 돼지꼬리 (왼쪽 나선) */
export const PIG_TAIL = 'M29 78 c-11 -6 -18 4 -10 11 c7 6 14 0 11 -7';

/** 동전 투입구 (등 위) */
export const PIG_SLOT = { x: 78, y: 40, w: 38, h: 8, r: 4 };

/** 눈 — 텍스트와 겹치지 않게 머리 위쪽에 둔다 */
export const PIG_EYE = { cx: 152, cy: 72, r: 4 };

/** 콧구멍 */
export const NOSTRIL_DY = 0;
export const NOSTRIL_DX = 6;

/** 예산을 넘겼을 때만 나타나는 금 — 가운데 금액 표시와 겹치지 않게 왼쪽 아래로 */
export const PIG_CRACK = 'M46 82 l11 13 l-9 10 l13 11';

/**
 * 수면 물결.
 * 한 주기 25단위로 -50 부터 260 까지 넉넉히 그려 두고
 * CSS로 좌우 50단위만 움직이면 이음매 없이 흐르는 것처럼 보인다.
 */
export const WAVE_PATH =
  'M-50 7 q12.5 -7 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V 70 H -50 Z';
