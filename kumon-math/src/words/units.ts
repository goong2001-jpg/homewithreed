/**
 * 소리 단계표 — 하루에 소리 두 개를 짝지어 배운다.
 *
 * 순서는 알파벳 순서가 아니라 파닉스 교육 순서(s a t p i n …)를 따른다.
 * 앞쪽일수록 소리가 또렷하고 단어가 많아 처음 배우는 아이가 덜 헷갈린다.
 * 짝은 서로 다르게 들리는 소리끼리 묶어서, 문제에서 첫소리만 듣고도
 * 보기를 가려낼 수 있게 했다.
 */
export interface SoundDef {
  /** phonics.ts 의 firstSound 값과 같다 */
  key: string;
  /** 화면에 보여줄 글자 */
  label: string;
  /** 이 소리를 내는 첫 글자들 (wh 처럼 같은 소리를 내는 글자 포함) */
  letters: string[];
  /** 한글 소리 */
  ko: string;
}

const S = (key: string, label: string, letters: string[], ko: string): SoundDef => ({ key, label, letters, ko });

export const UNITS: [SoundDef, SoundDef][] = [
  [S('suh', 's', ['s'], '스'),        S('ah', 'a', ['a'], '애')],
  [S('tuh', 't', ['t'], '트'),        S('puh', 'p', ['p'], '프')],
  [S('ih', 'i', ['i'], '이'),         S('nuh', 'n', ['n'], '느')],
  [S('muh', 'm', ['m'], '므'),        S('duh', 'd', ['d'], '드')],
  [S('guh', 'g', ['g'], '그'),        S('aw', 'o', ['o'], '아')],
  [S('kuh', 'c k', ['c', 'k'], '크'), S('eh', 'e', ['e'], '에')],
  [S('uh', 'u', ['u'], '어'),         S('ruh', 'r', ['r'], '르')],
  [S('huh', 'h', ['h'], '흐'),        S('buh', 'b', ['b'], '브')],
  [S('fuh', 'f', ['f'], '프'),        S('luh', 'l', ['l'], '르')],
  [S('juh', 'j', ['j'], '즈'),        S('wuh', 'w', ['w', 'wh'], '워')],
  [S('vuh', 'v', ['v'], '브'),        S('yuh', 'y', ['y'], '유')],
  [S('zuh', 'z', ['z'], '즈'),        S('kwuh', 'qu', ['qu'], '쿠')],
  [S('shuh', 'sh', ['sh'], '쉬'),     S('chuh', 'ch', ['ch'], '츄')],
  [S('thuh', 'th', ['th'], '쓰'),     S('fuh', 'f', ['f'], '프')],
];

/**
 * 한 단계를 문제 묶음 몇 번으로 하는지.
 * 묶음 하나(단어 10개 + 문제)를 끝낼 때마다 진도가 오르고,
 * 같은 소리를 두 번 연습하면 다음 소리로 넘어간다.
 */
export const SETS_PER_UNIT = 2;
