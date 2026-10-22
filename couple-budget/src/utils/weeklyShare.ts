import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types';
import { won } from './format';
import {
  WeeklyReport, deltaLabel, diffLabel, shortDate, weekRangeLabel, weeklyReportText,
} from './weekly';

/**
 * 주간 리포트를 카톡으로 보내기.
 *
 * 1) 오프스크린 canvas 로 PNG 를 그려 Web Share 로 파일 공유 (폰 공유창 → 카톡)
 * 2) 파일 공유가 안 되면 글자 요약을 공유
 * 3) Web Share 자체가 없으면(PC 브라우저) PNG 를 내려받는다
 *
 * 새 의존성 없이 시스템 글꼴로만 그린다. 흐름과 안내 문구는 ExchangeCard 와 같다.
 */

const W = 1080;
const H = 1350;
const FONT = "-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(
  ctx: Ctx, s: string, x: number, y: number,
  opt: { size: number; weight?: number; color?: string; align?: CanvasTextAlign } ,
) {
  ctx.font = `${opt.weight ?? 500} ${opt.size}px ${FONT}`;
  ctx.fillStyle = opt.color ?? '#2c3e50';
  ctx.textAlign = opt.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

/** 너무 긴 메모는 … 으로 줄인다 */
function clip(ctx: Ctx, s: string, maxWidth: number): string {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** 리포트를 1080×1350 PNG 로 그린다. canvas 를 못 쓰는 환경이면 throw. */
export function drawWeeklyReport(r: WeeklyReport): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 를 쓸 수 없는 브라우저예요.');

  // 배경 — 앱과 같은 회색 바탕, 흰 카드
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  const pad = 72;
  let y = 150;

  text(ctx, '🐷 우리집 주간 리포트', pad, y, { size: 56, weight: 800 });
  y += 64;
  text(ctx, weekRangeLabel(r), pad, y, { size: 34, color: '#8a959b' });
  y += 70;

  // 카드 1 — 이번 주 지출 · 예산 대비
  const over = r.hasIncome && r.diff < 0;
  const accent = !r.hasIncome ? '#95a5a6' : over ? '#e74c3c' : '#27ae60';
  ctx.fillStyle = '#fff';
  roundRect(ctx, pad, y, W - pad * 2, 300, 28);
  ctx.fill();
  text(ctx, '이번 주 쓴 돈', pad + 48, y + 72, { size: 30, color: '#888' });
  text(ctx, won(r.totalSpent), pad + 48, y + 160, { size: 84, weight: 800, color: '#2c3e50' });
  text(ctx, `${r.count}건`, W - pad - 48, y + 160, { size: 32, color: '#b0bec5', align: 'right' });
  ctx.fillStyle = `${accent}22`;
  roundRect(ctx, pad + 48, y + 198, W - pad * 2 - 96, 66, 33);
  ctx.fill();
  text(ctx, diffLabel(r), pad + 80, y + 243, { size: 30, weight: 700, color: accent });
  y += 300 + 28;

  // 카드 2 — 하루 수입 × 7
  if (r.hasIncome) {
    ctx.fillStyle = '#fff';
    roundRect(ctx, pad, y, W - pad * 2, 130, 28);
    ctx.fill();
    text(ctx, '쓸 수 있던 돈', pad + 48, y + 56, { size: 28, color: '#888' });
    text(
      ctx,
      `하루 ${won(Math.floor(r.dailyIncome))} × 7일 = ${won(Math.floor(r.weeklyBudget))}`,
      pad + 48, y + 100, { size: 32, weight: 700 },
    );
    y += 130 + 28;
  }

  // 카드 3 — 많이 쓴 곳 (막대)
  ctx.fillStyle = '#fff';
  const catH = 96 + Math.max(1, r.topCategories.length) * 92;
  roundRect(ctx, pad, y, W - pad * 2, catH, 28);
  ctx.fill();
  text(ctx, '많이 쓴 곳', pad + 48, y + 60, { size: 30, weight: 700 });
  if (!r.topCategories.length) {
    text(ctx, '이번 주 지출이 없어요', pad + 48, y + 130, { size: 28, color: '#b0bec5' });
  } else {
    const max = r.topCategories[0].amount || 1;
    r.topCategories.forEach((c, i) => {
      const cy = y + 100 + i * 92;
      text(ctx, `${CATEGORY_EMOJI[c.category]} ${c.category}`, pad + 48, cy + 34, { size: 30, weight: 600 });
      text(ctx, won(c.amount), W - pad - 48, cy + 34, { size: 30, weight: 700, color: '#e74c3c', align: 'right' });
      const bx = pad + 48;
      const bw = W - pad * 2 - 96;
      ctx.fillStyle = '#f1f3f5';
      roundRect(ctx, bx, cy + 50, bw, 16, 8);
      ctx.fill();
      ctx.fillStyle = CATEGORY_COLOR[c.category];
      roundRect(ctx, bx, cy + 50, Math.max(16, bw * (c.amount / max)), 16, 8);
      ctx.fill();
    });
  }
  y += catH + 28;

  // 카드 4 — 큰 지출 TOP3
  const topH = 96 + Math.max(1, r.topExpenses.length) * 72;
  ctx.fillStyle = '#fff';
  roundRect(ctx, pad, y, W - pad * 2, topH, 28);
  ctx.fill();
  text(ctx, '큰 지출 TOP 3', pad + 48, y + 60, { size: 30, weight: 700 });
  if (!r.topExpenses.length) {
    text(ctx, '없어요', pad + 48, y + 130, { size: 28, color: '#b0bec5' });
  } else {
    r.topExpenses.forEach((e, i) => {
      const ey = y + 118 + i * 72;
      ctx.font = `500 28px ${FONT}`;
      const label = clip(ctx, `${i + 1}. ${shortDate(e.date)} ${e.content}`, W - pad * 2 - 96 - 260);
      text(ctx, label, pad + 48, ey, { size: 28, color: '#455a64' });
      text(ctx, won(e.amount), W - pad - 48, ey, { size: 28, weight: 700, align: 'right' });
    });
  }
  y += topH + 28;

  // 지난주 대비
  const d = r.deltaRatio;
  const dColor = d === null ? '#8a959b' : d > 0.005 ? '#e74c3c' : d < -0.005 ? '#27ae60' : '#8a959b';
  text(ctx, deltaLabel(r), W / 2, y + 60, { size: 34, weight: 700, color: dColor, align: 'center' });
  if (r.prevTotal > 0) {
    text(ctx, `지난주 ${won(r.prevTotal)}`, W / 2, y + 108, { size: 26, color: '#b0bec5', align: 'center' });
  }

  text(ctx, '우리집 하루수입 가계부', W / 2, H - 60, { size: 24, color: '#c5ced2', align: 'center' });
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요.'))), 'image/png');
  });
}

export function weeklyFileName(r: WeeklyReport): string {
  return `주간리포트_${r.weekStart.replace(/-/g, '')}.png`;
}

export type ShareOutcome = { tone: 'ok' | 'err' | 'info'; message: string };

/** 카톡으로 공유 — 결과 문구는 화면에 그대로 보여준다 */
export async function shareWeeklyReport(r: WeeklyReport): Promise<ShareOutcome> {
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  const title = '우리집 주간 리포트';
  const summary = weeklyReportText(r);

  // 1) 이미지 파일 공유
  let file: File | null = null;
  try {
    const blob = await toBlob(drawWeeklyReport(r));
    file = new File([blob], weeklyFileName(r), { type: 'image/png' });
  } catch (e) {
    console.warn('리포트 이미지 생성 실패:', e);
  }

  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: `${weekRangeLabel(r)} 주간 리포트예요` });
      return { tone: 'ok', message: '보냈어요.' };
    } catch (e) {
      // 사용자가 공유창을 닫은 경우 — 조용히 끝낸다
      if ((e as Error)?.name === 'AbortError') return { tone: 'info', message: '' };
      console.warn('이미지 공유 실패, 글로 다시 시도:', e);
    }
  }

  // 2) 글자 요약 공유
  if (nav.share) {
    try {
      await nav.share({ title, text: summary });
      return { tone: 'ok', message: '글로 보냈어요. (이 브라우저는 이미지 공유를 지원하지 않아요)' };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return { tone: 'info', message: '' };
      return { tone: 'err', message: `공유에 실패했어요: ${(e as Error).message}` };
    }
  }

  // 3) PNG 내려받기 (PC)
  if (file) {
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { tone: 'ok', message: `${file.name} 파일로 저장했어요. 카톡으로 보내주세요.` };
    } catch (e) {
      return { tone: 'err', message: `저장에 실패했어요: ${(e as Error).message}` };
    }
  }

  // 4) 아무것도 안 되면 글자라도 복사
  try {
    await navigator.clipboard.writeText(summary);
    return { tone: 'ok', message: '요약을 복사했어요. 카톡에 붙여넣기 하세요.' };
  } catch {
    return { tone: 'err', message: '이 브라우저에서는 공유할 수 없어요.' };
  }
}
