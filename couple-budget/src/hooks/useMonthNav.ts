import { useCallback, useState } from 'react';
import { MonthKey } from '../types';
import { addMonths, thisMonth } from '../utils/budget';

/** receipt-tracker/src/hooks/useMonthNav.ts 를 데이터와 무관하게 일반화한 것 */
export function useMonthNav() {
  const [month, setMonth] = useState<MonthKey>(() => thisMonth());

  const prev = useCallback(() => setMonth(m => addMonths(m, -1)), []);
  const next = useCallback(() => setMonth(m => addMonths(m, 1)), []);
  const goToToday = useCallback(() => setMonth(thisMonth()), []);

  return { month, setMonth, prev, next, goToToday };
}
