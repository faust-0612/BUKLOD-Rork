import React from 'react';
import {
  Redirect,
  Slot,
  useLocalSearchParams,
  usePathname,
} from 'expo-router';

const firstParam = (
  value: string | string[] | undefined,
) => (Array.isArray(value) ? value[0] : value) ?? '';

export default function BibleLayout() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    source?: string | string[];
    assignedDate?: string | string[];
    assignment_id?: string | string[];
    book?: string | string[];
    chapter?: string | string[];
  }>();

  const source = firstParam(params.source).trim().toLowerCase();
  const assignedDate = firstParam(params.assignedDate).trim();
  const assignmentId = firstParam(params.assignment_id).trim();
  const book = firstParam(params.book).trim();
  const chapter = firstParam(params.chapter).trim();

  /*
   * BUKLOD_DAILY_READING_DIRECT_RESPONSE_R1
   *
   * Home's Daily doorway historically opened /bible/read first and required
   * another RESPOND tap before reaching the actual Daily Bible dashboard.
   * The real TODAY'S SCRIPTURE / READ button inside /bible supplies the
   * assignment/book/chapter parameters, so it must continue opening the
   * reader normally.
   *
   * A bare daily_plan doorway therefore goes straight to /bible, while the
   * real internal reading route is preserved unchanged.
   */
  const isBareDailyDoorway =
    pathname === '/bible/read' &&
    source === 'daily_plan' &&
    !assignmentId &&
    !book &&
    !chapter;

  if (isBareDailyDoorway) {
    return (
      <Redirect
        href={
          {
            pathname: '/bible',
            params: {
              ...(assignedDate ? { date: assignedDate } : {}),
              mode: 'respond',
            },
          } as any
        }
      />
    );
  }

  return <Slot />;
}
