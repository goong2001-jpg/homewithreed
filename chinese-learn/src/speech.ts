/**
 * 브라우저 음성 합성(Web Speech API)으로 중국어를 읽어준다.
 *
 * 중요: 기기에 중국어 음성이 없으면 **읽지 않는다**.
 * lang만 'zh-CN'으로 주고 읽히면 한국어 엔진이 한자를 한국 한자음으로 읽어
 * 你好를 "니호"라고 발음해 버린다. 잘못된 발음을 배우느니 안 읽는 게 낫다.
 */

export type VoiceStatus =
  | 'ok'          // 중국어 음성이 있다
  | 'no-voice'    // 음성 합성은 되는데 중국어 음성이 없다
  | 'unsupported' // 이 브라우저는 음성 합성 자체를 못 한다
  | 'loading';    // 목소리 목록을 아직 불러오는 중

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function allVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

function normalizeLang(voice: SpeechSynthesisVoice): string {
  return (voice.lang || '').toLowerCase().replace(/_/g, '-');
}

/**
 * 중국어 음성인지 본다.
 * 엔진마다 표기가 제각각이다: zh-CN, zh_CN_#Hans, cmn-Hans-CN, "Chinese (China)" 등.
 */
function isChinese(voice: SpeechSynthesisVoice): boolean {
  const lang = normalizeLang(voice);
  if (lang.startsWith('zh') || lang.startsWith('cmn') || lang.startsWith('yue')) return true;
  const name = (voice.name || '').toLowerCase();
  return name.includes('chinese') || name.includes('中文') || name.includes('普通话');
}

/** 보통화(중국 본토) 발음인지. 대만·홍콩 음성보다 먼저 고르기 위한 것 */
function isMandarinCN(voice: SpeechSynthesisVoice): boolean {
  const lang = normalizeLang(voice);
  return (
    lang.includes('cn') ||
    lang.includes('hans') ||
    lang === 'zh' ||
    lang === 'cmn' ||
    (voice.name || '').includes('普通话')
  );
}

/** 쓸 수 있는 중국어 목소리. 없으면 null */
export function chineseVoice(): SpeechSynthesisVoice | null {
  const zh = allVoices().filter(isChinese);
  if (!zh.length) return null;

  const pool = zh.filter(isMandarinCN);
  const candidates = pool.length ? pool : zh; // 대만·홍콩 음성이라도 한국어보다는 낫다

  const preferred = ['xiaoxiao', 'yaoyao', 'huihui', 'tingting', 'google 普通话', 'chinese (china)'];
  for (const name of preferred) {
    const found = candidates.find((v) => (v.name || '').toLowerCase().includes(name));
    if (found) return found;
  }
  return candidates[0];
}

/** 지금 읽어줄 수 있는 상태인지 */
export function voiceStatus(): VoiceStatus {
  if (!speechSupported()) return 'unsupported';
  if (chineseVoice()) return 'ok';
  return allVoices().length === 0 ? 'loading' : 'no-voice';
}

export function chineseVoiceAvailable(): boolean {
  return voiceStatus() === 'ok';
}

/** 지금 잡힌 목소리 이름 (안내 화면에 보여준다) */
export function chineseVoiceName(): string | null {
  const v = chineseVoice();
  return v ? `${v.name}${v.lang ? ` (${v.lang})` : ''}` : null;
}

/**
 * 목소리 목록은 비동기로 로드된다. 목록이 바뀔 때마다 알려준다.
 * 안드로이드는 음성을 새로 설치하면 앱을 껐다 켜지 않아도 목록이 갱신되는 경우가 있다.
 */
export function onVoicesChanged(callback: () => void): () => void {
  if (!speechSupported()) return () => {};
  allVoices(); // 목록 로드를 깨운다
  const handler = () => callback();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    return () => {
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
      } catch {}
    };
  } catch {
    return () => {};
  }
}

interface SpeakOptions {
  /** 0.5 = 아주 느리게, 1 = 보통 */
  rate?: number;
  onEnd?: () => void;
  /** 중국어 음성이 없어서 읽지 못했을 때 */
  onUnavailable?: (status: VoiceStatus) => void;
}

/**
 * 중국어로 읽어주기.
 * 중국어 목소리를 찾지 못하면 아무 소리도 내지 않고 'no-voice'를 돌려준다.
 */
export function speak(text: string, { rate = 0.85, onEnd, onUnavailable }: SpeakOptions = {}): VoiceStatus {
  const voice = speechSupported() ? chineseVoice() : null;
  if (!voice) {
    const status = voiceStatus();
    onUnavailable?.(status);
    onEnd?.();
    return status;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // 이전 발음이 남아있으면 끊고 새로 읽기

    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || 'zh-CN';
    u.rate = rate;
    u.pitch = 1;
    u.volume = 1;
    if (onEnd) {
      u.onend = () => onEnd();
      u.onerror = () => onEnd();
    }
    synth.speak(u);
    return 'ok';
  } catch {
    onEnd?.();
    onUnavailable?.('no-voice');
    return 'no-voice';
  }
}

/** 읽던 것 멈추기 (화면을 옮길 때) */
export function stopSpeaking(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}
