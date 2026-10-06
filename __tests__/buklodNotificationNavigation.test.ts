import {
  resolveBuklodNotificationTarget,
} from '@/lib/buklodNotificationNavigation';

describe(
  'Daily Reading notification navigation',
  () => {
    it(
      'opens the canonical Daily Reading doorway and does not pass assignment_id',
      () => {
        const target =
          resolveBuklodNotificationTarget(
            'formation_daily_reading_reminder',
            {
              assignment_id:
                'assignment-old-route',
              date:
                '2026-10-06',
            }
          );

        expect(target?.path).toBe(
          '/bible/read?source=daily_plan&assignedDate=2026-10-06'
        );

        expect(
          target?.path.includes(
            'assignment_id'
          )
        ).toBe(false);
      }
    );

    it(
      'still opens the canonical Daily Reading doorway when assignment id is absent',
      () => {
        const target =
          resolveBuklodNotificationTarget(
            'formation_daily_reading_reminder',
            {
              date:
                '2026-10-06',
            }
          );

        expect(target?.path).toBe(
          '/bible/read?source=daily_plan&assignedDate=2026-10-06'
        );
      }
    );
  }
);
