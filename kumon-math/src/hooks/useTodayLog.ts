import { useEffect, useState } from 'react';
import { DayLog, EMPTY_DAY, LOG_EVENT, readLog } from '../words/log';
import { isoToday } from '../words/dates';

/** 오늘 기록 — 기록이 바뀔 때마다(시간이 쌓일 때마다) 새로 읽는다 */
export function useTodayLog(): DayLog {
  const read = () => ({ ...EMPTY_DAY, ...readLog()[isoToday()] });
  const [day, setDay] = useState<DayLog>(read);
  useEffect(() => {
    const on = () => setDay(read());
    window.addEventListener(LOG_EVENT, on);
    return () => window.removeEventListener(LOG_EVENT, on);
  }, []);
  return day;
}
