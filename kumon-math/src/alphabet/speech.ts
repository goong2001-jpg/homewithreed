/**
 * 브라우저 음성 합성(Web Speech API)으로 알파벳/단어를 읽어준다.
 * 지원하지 않는 브라우저에서는 조용히 아무것도 하지 않는다(앱은 정상 동작).
 */

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 영어 목소리를 고른다. 아이용으로 또렷한 목소리를 우선 */
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (!en.length) return null;

  const preferred = ['samantha', 'google us english', 'karen', 'moira', 'aria', 'jenny', 'zira'];
  for (const name of preferred) {
    const found = en.find(v => v.name.toLowerCase().includes(name));
    if (found) return found;
  }
  return en.find(v => v.lang.toLowerCase() === 'en-us') ?? en[0];
}

/** 목소리 목록은 비동기로 로드되므로 미리 깨워둔다 */
export function warmUpVoices(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.getVoices();
}

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

/** 영어로 읽어주기 */
export function speak(text: string, { rate = 0.75, pitch = 1.15, onEnd }: SpeakOptions = {}): void {
  if (!speechSupported()) { onEnd?.(); return; }
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // 이전 발음이 남아있으면 끊고 새로 읽기

    const u = new SpeechSynthesisUtterance(text);

    // 목소리 지정은 실패해도 무시한다. 기기에 따라 할당이 막혀 있어도
    // 기본 목소리로는 읽어줄 수 있으므로 여기서 멈추면 안 된다.
    let voiceLang = 'en-US';
    try {
      const voice = pickEnglishVoice();
      if (voice) {
        u.voice = voice;
        voiceLang = voice.lang || voiceLang;
      }
    } catch {}
    u.lang = voiceLang;
    u.rate = rate;    // 아이가 따라할 수 있게 조금 천천히
    u.pitch = pitch;  // 살짝 높은 톤이 아이에게 친근함
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

/**
 * "A. A is for Apple." 처럼 글자 → 단어 순서로 읽어준다.
 * 글자 하나만 넘기면 발음이 뭉개지는 브라우저가 있어 문장으로 감싼다.
 */
export function speakLetterAndWord(letter: string, word: string): void {
  const upper = letter.toUpperCase();
  speak(`${upper}. ${upper} is for ${word}.`, { rate: 0.7 });
}

/** 글자만 읽기 */
export function speakLetter(letter: string): void {
  speak(`${letter.toUpperCase()}.`, { rate: 0.65 });
}

/** 단어만 읽기 */
export function speakWord(word: string): void {
  speak(word, { rate: 0.7 });
}
