/**
 * 카드 문자·알림을 붙여넣으면 지출 칸을 채워주는 해석기 (v21).
 *
 * 서버·외부 API 없이 **이 폰 안에서** 글자 규칙만으로 뽑는다. 붙여넣은 글은 어디로도 보내지 않고 저장하지도 않는다.
 * 맞춘 형식(사용자가 실제로 쓰는 두 가지):
 *   ① 항목이 한 줄씩 — "금액 1,500원 / 사용처 … / 거래시간 11/11 23:15 / 누적금액 …"
 *   ② 한 줄 문장형 — "15,030원 결제 | 가게이름" + "잔액 …"
 * 그 밖의 형식은 '금액'만이라도 찾아 채운다 (나머지는 사용자가 고른다).
 *
 * 새 카드 형식을 더할 때: 여기 규칙을 넓히고 smsParse.test.ts 에 그 문자를 (이름·카드번호는 가짜로) 넣는다.
 */
import { DateKey, Expense, ExpenseCategory } from '../types';
import { alive, todayKey } from './budget';

export interface ParsedSms {
  amount: number;
  /** 가게 이름 — 못 찾으면 빈 글자 */
  content: string;
  /** 문자에 날짜가 있으면 그 날, 없으면 오늘 */
  date: DateKey;
  /** 문자에 날짜가 있었는지 (없어서 오늘로 채웠으면 false) */
  hasDate: boolean;
}

export type SmsResult =
  | { ok: true; parsed: ParsedSms }
  | { ok: false; reason: 'empty' | 'cancel' | 'noAmount' };

/** 이 말이 앞에 붙은 금액은 쓴 돈이 아니다 */
const NOT_SPEND = /(잔액|누적|한도|잔여|포인트|적립|할부원금|이용가능)/;

const toNumber = (s: string): number => Number(s.replace(/[^\d]/g, '')) || 0;

function findAmount(lines: string[]): number {
  // ① "금액 1,500원" — 줄 맨 앞이 딱 '금액' (누적금액·결제금액 줄과 구분)
  for (const l of lines) {
    const m = l.match(/^(?:결제|승인|이용|사용)?금액\s*:?\s*([\d,]+)\s*원/);
    if (m) return toNumber(m[1]);
  }
  // ② "15,030원 결제" 처럼 금액 바로 뒤에 쓴 말이 붙은 것
  for (const l of lines) {
    const m = l.match(/([\d,]+)\s*원\s*(?:결제|승인|사용|이용|출금)/);
    if (m && !NOT_SPEND.test(l.slice(0, m.index))) return toNumber(m[1]);
  }
  // ③ 그 밖 — 잔액·누적이 아닌 첫 금액
  for (const l of lines) {
    const re = /([\d,]+)\s*원/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(l))) {
      const before = l.slice(0, m.index);
      if (NOT_SPEND.test(before.slice(-12))) continue;
      const n = toNumber(m[1]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function findMerchant(lines: string[]): string {
  // ① "사용처 가게이름" / "가맹점 가게이름"
  for (const l of lines) {
    const m = l.match(/^(?:사용처|가맹점(?:명)?|이용처|상호)\s*:?\s*(.+)$/);
    if (m) return m[1].trim();
  }
  // ② "15,030원 결제 | 가게이름"
  for (const l of lines) {
    const m = l.match(/원\s*(?:결제|승인|사용|이용)\s*[|｜]\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return '';
}

/** "11/11 23:15" · "11.11" · "11월 11일" — 연도는 문자에 없으므로 오늘 기준으로 정한다 */
function findDate(lines: string[], now: Date): DateKey | null {
  const text = lines.filter(l => !NOT_SPEND.test(l)).join('\n');
  const m = text.match(/(?:^|[^\d])(\d{1,2})\s*[/.월]\s*(\d{1,2})(?:일)?(?=$|[^\d/.])/);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let y = now.getFullYear();
  // 1월에 12월 문자를 붙여넣는 경우 — 미래 날짜가 되면 작년으로 본다
  const key = (yy: number) => `${yy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (key(y) > todayKey(now)) y -= 1;
  return key(y);
}

export function parseSms(raw: string, now: Date = new Date()): SmsResult {
  const lines = (raw ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: 'empty' };
  // 취소 문자는 지출이 아니다 — 잘못 넣으면 쓴 돈이 두 번 잡힌다
  if (lines.some(l => /취소/.test(l))) return { ok: false, reason: 'cancel' };

  const amount = findAmount(lines);
  if (!(amount > 0)) return { ok: false, reason: 'noAmount' };

  const date = findDate(lines, now);
  return {
    ok: true,
    parsed: {
      amount,
      content: findMerchant(lines).slice(0, 40),
      date: date ?? todayKey(now),
      hasDate: date !== null,
    },
  };
}

// ---------------------- 카테고리 짐작 ----------------------

/** 가게 이름에 이 글자가 있으면 그 카테고리. 위에서부터 먼저 맞는 것 (쿠팡이츠가 쿠팡보다 먼저) */
const KEYWORDS: [ExpenseCategory, RegExp][] = [
  ['식비', /(쿠팡이츠|배달|배민|우아한형제|요기요|식당|반점|분식|국밥|치킨|피자|버거|맥도날드|롯데리아|카페|커피|스타벅스|이디야|메가엠지씨|컴포즈|빽다방|투썸|베이커리|파리바게|뚜레쥬르|편의점|GS25|CU|씨유|세븐일레븐|이마트24|마트|이마트|홈플러스|하나로|정육|반찬)/i],
  ['교통', /(주유|오일|에너지|충전소|택시|카카오T|카카오모빌리티|버스|지하철|철도|코레일|SRT|하이패스|도로공사|주차|티머니)/i],
  ['의료', /(약국|병원|의원|치과|한의원|소아과|내과|이비인후과|안과|피부과)/],
  ['육아', /(어린이집|유치원|키즈|아동|유아|완구|토이|베이비|학원|문구)/],
  ['여가', /(넷플릭스|유튜브|구글페이먼트|구글플레이|애플|디즈니|티빙|웨이브|왓챠|멜론|스포티파이|CGV|메가박스|롯데시네마|영화|노래|PC방|게임)/i],
  ['생활', /(크린토피아|세탁|빨래|관리비|도시가스|한국전력|수도|통신|KT|SKT|SK텔레콤|LG유플러스|유플러스|보험|미용|헤어|이발|철물|인테리어)/i],
  ['쇼핑', /(쿠팡|네이버페이|네이버파이낸셜|11번가|지마켓|옥션|SSG|무신사|다이소|올리브영|백화점|아울렛|유니클로|이케아)/i],
];

/**
 * 가게 이름으로 카테고리를 짐작한다.
 *  1) **전에 같은 이름으로 적은 적이 있으면 그때 고른 카테고리** — 한 번 고치면 다음부터 맞는다 (가장 최근 것)
 *  2) 없으면 흔한 가게 이름 글자로
 *  3) 그래도 모르면 null (화면에 골라져 있던 것을 그대로 둔다)
 */
export function guessCategory(content: string, history: Expense[]): ExpenseCategory | null {
  const name = (content ?? '').trim();
  if (!name) return null;
  let best: Expense | null = null;
  for (const e of history) {
    if (!alive(e) || e.noSpend || (e.content ?? '').trim() !== name) continue;
    if (!best || e.date > best.date || (e.date === best.date && e.createdAt > best.createdAt)) best = e;
  }
  if (best) return best.category;
  for (const [cat, re] of KEYWORDS) if (re.test(name)) return cat;
  return null;
}
