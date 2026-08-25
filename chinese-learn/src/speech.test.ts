import { chineseVoice, chineseVoiceName, speak, voiceStatus } from './speech';

type FakeVoice = { name: string; lang: string };

/** window.speechSynthesis 를 흉내 낸다. spoken 에 읽은 내용이 쌓인다 */
function installSynth(voices: FakeVoice[]) {
  const spoken: { text: string; voice: string | null; lang: string }[] = [];
  const synth = {
    getVoices: () => voices as unknown as SpeechSynthesisVoice[],
    speak: (u: SpeechSynthesisUtterance) => {
      spoken.push({
        text: u.text,
        voice: u.voice ? u.voice.name : null,
        lang: u.lang,
      });
    },
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  (window as any).SpeechSynthesisUtterance = function (this: any, text: string) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
  };
  return spoken;
}

const KOREAN: FakeVoice = { name: 'Google 한국의', lang: 'ko-KR' };
const ENGLISH: FakeVoice = { name: 'Samantha', lang: 'en-US' };
const MANDARIN: FakeVoice = { name: 'Google 普通话（中国大陆）', lang: 'zh-CN' };
const TAIWAN: FakeVoice = { name: 'Google 國語（臺灣）', lang: 'zh-TW' };
const CMN: FakeVoice = { name: 'Chinese China', lang: 'cmn-Hans-CN' };

describe('중국어 음성 고르기', () => {
  it('중국어 음성이 없으면 읽지 않는다 (한국어로 "니호"라고 읽는 것을 막는다)', () => {
    const spoken = installSynth([KOREAN, ENGLISH]);
    const onUnavailable = jest.fn();
    expect(speak('你好', { onUnavailable })).toBe('no-voice');
    expect(spoken).toHaveLength(0);
    expect(onUnavailable).toHaveBeenCalledWith('no-voice');
    expect(voiceStatus()).toBe('no-voice');
  });

  it('중국어 음성이 있으면 그 목소리를 지정해 읽는다', () => {
    const spoken = installSynth([KOREAN, MANDARIN, ENGLISH]);
    expect(speak('你好')).toBe('ok');
    expect(spoken).toEqual([{ text: '你好', voice: MANDARIN.name, lang: 'zh-CN' }]);
  });

  it('본토 보통화 음성을 대만 음성보다 먼저 고른다', () => {
    installSynth([TAIWAN, MANDARIN]);
    expect(chineseVoice()?.lang).toBe('zh-CN');
  });

  it('대만 음성뿐이면 그거라도 쓴다 (한국어보다는 낫다)', () => {
    installSynth([KOREAN, TAIWAN]);
    expect(chineseVoice()?.lang).toBe('zh-TW');
    expect(voiceStatus()).toBe('ok');
  });

  it('cmn-Hans-CN 처럼 다르게 표기하는 엔진도 알아본다', () => {
    installSynth([KOREAN, CMN]);
    expect(chineseVoice()?.name).toBe(CMN.name);
    expect(chineseVoiceName()).toBe('Chinese China (cmn-Hans-CN)');
  });

  it('목록이 아직 비어 있으면 loading 으로 본다 (없다고 단정하지 않는다)', () => {
    installSynth([]);
    expect(voiceStatus()).toBe('loading');
  });
});
