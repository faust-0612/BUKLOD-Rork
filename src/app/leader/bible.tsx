import BibleReadingMonitor from '@/components/BibleReadingMonitor';
import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';

export default function BibleMonitorRoute() {
  return <BuklodFaithRouteBoundary><BibleReadingMonitor /></BuklodFaithRouteBoundary>;
}
