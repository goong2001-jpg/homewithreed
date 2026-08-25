/**
 * 브라우저 음성 합성(Web Speech API)으로 중국어를 읽어준다.
 * 안드로이드 크롬은 기기에 설치된 중국어 TTS 음성을 그대로 쓴다.
 * 지원하지 않는 기기에서는 조용히 아무것도 하지 않는다(앱은 정상 동작).
 */

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

/** zh-CN(보통화) 목소리를 고른다. 대만/홍콩 음성은 발음이 달라 뒤로 미룬다 */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  const voices = allVoices();
  if (!voices.length) return null;

  const zh = voices.filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('zh'));
  if (!zh.length) return null;

  const lang = (v: SpeechSynthesisVoice) => (v.lang || '').toLowerCase().replace('_', '-');
  const mandarin = zh.filter((v) => lang(v).startsWith('zh-cn') || lang(v) === 'zh');
  const pool = mandarin.length ? mandarin : zh;

  const preferred = ['xiaoxiao', 'yaoyao', 'huihui', 'tingting', 'google 普通话', 'chinese (china)'];
  for (const name of preferred) {
    const found = pool.find((v) => v.name.toLowerCase().includes(name));
    if (found) return found;
  }
  return pool[0];
}

/** 기기에 중국어 음성이 깔려 있는지 */
export function chineseVoiceAvailable(): boolean {
  return pickChineseVoice() !== null;
}

/** 목소리 목록은 비동기로 로드되므로 미리 깨워두고, 다 불러오면 알려준다 */
export function warmUpVoices(onReady?: () => void): void {
  if (!speechSupported()) return;
  allVoices();
  if (!onReady) return;
  try {
    window.speechSynthesis.addEventListener('voiceschanged', () => onReady(), { once: true });
  } catch {
    // 구형 브라우저: 이벤트가 없어도 기본 음성으로는 읽어준다
  }
}

interface SpeakOptions {
  /** 0.5 = 아주 느리게, 1 = 보통 */
  rate?: number;
  onEnd?: () => void;
}

/** 중국어로 읽어주기 */
export function speak(text: string, { rate = 0.85, onEnd }: SpeakOptions = {}): void {
  if (!speechSupported()) {
    onEnd?.();
    return;
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // 이전 발음이 남아있으면 끊고 새로 읽기

    const u = new SpeechSynthesisUtterance(text);

    // 목소리 지정이 막힌 기기라도 lang만으로 읽어주는 경우가 있으므로
    // 실패해도 여기서 멈추지 않는다.
    let voiceLang = 'zh-CN';
    try {
      const voice = pickChineseVoice();
      if (voice) {
        u.voice = voice;
        voiceLang = voice.lang || voiceLang;
      }
    } catch {}
    u.lang = voiceLang;
    u.rate = rate;
    u.pitch = 1;
    u.volume = 1;
    if (onEnd) {
      u.onend = () => onEnd();
      u.onerror = () => onEnd();
    }
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}

/** 읽던 것 멈추기 (화면을 옮길 때) */
export function stopSpeaking(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}
