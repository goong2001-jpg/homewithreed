import { createContext, useContext } from 'react';
import { VoiceStatus } from './speech';

interface VoiceGuideValue {
  status: VoiceStatus;
  /** 중국어 음성이 없을 때 설치 안내를 띄운다 */
  openGuide: () => void;
}

export const VoiceGuideContext = createContext<VoiceGuideValue>({
  status: 'ok',
  openGuide: () => {},
});

export function useVoiceGuide(): VoiceGuideValue {
  return useContext(VoiceGuideContext);
}
