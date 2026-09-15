export type BuklodHomeMode = 'home' | 'work' | 'school' | 'business';

export type BuklodHomeDaypart =
  | 'morning'
  | 'day'
  | 'evening'
  | 'night';

export type BuklodHomeTodayItem = {
  id: string;
  title: string;
  detail: string;
};

export function getBuklodHomeDaypart(
  date: Date = new Date(),
): BuklodHomeDaypart {
  const hour = date.getHours();

  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  if (hour < 21) return 'evening';
  return 'night';
}

export function getBuklodHomeGreeting(
  daypart: BuklodHomeDaypart,
): string {
  switch (daypart) {
    case 'morning':
      return 'Good morning';
    case 'day':
      return 'Good day';
    case 'evening':
      return 'Good evening';
    case 'night':
      return 'Good night';
  }
}

export function getBuklodHomeDaypartLabel(
  daypart: BuklodHomeDaypart,
): string {
  switch (daypart) {
    case 'morning':
      return 'START THE DAY';
    case 'day':
      return 'TODAY';
    case 'evening':
      return 'WIND DOWN';
    case 'night':
      return 'READY FOR TOMORROW';
  }
}

export function getBuklodHomeModeLabel(
  mode: BuklodHomeMode,
): string {
  switch (mode) {
    case 'home':
      return 'Home';
    case 'work':
      return 'Work';
    case 'school':
      return 'School';
    case 'business':
      return 'Business';
  }
}

function modePriority(
  mode: BuklodHomeMode,
): BuklodHomeTodayItem {
  switch (mode) {
    case 'home':
      return {
        id: 'mode-priority',
        title: 'Check home priorities',
        detail: 'Meals, errands, household reminders, and what needs attention first.',
      };
    case 'work':
      return {
        id: 'mode-priority',
        title: 'Check work priorities',
        detail: 'Review today’s main task, reports, meetings, and deadlines.',
      };
    case 'school':
      return {
        id: 'mode-priority',
        title: 'Check school priorities',
        detail: 'Review classes, assignments, quizzes, and deadlines.',
      };
    case 'business':
      return {
        id: 'mode-priority',
        title: 'Check business priorities',
        detail: 'Review orders, records, capital, collections, and deadlines.',
      };
  }
}

export function getBuklodHomeTodayItems({
  daypart,
  mode,
  showFaithContent,
}: {
  daypart: BuklodHomeDaypart;
  mode: BuklodHomeMode;
  showFaithContent: boolean;
}): BuklodHomeTodayItem[] {
  const faithOrFocus: BuklodHomeTodayItem = showFaithContent
    ? {
        id: 'faith-or-focus',
        title: 'Start with encouragement',
        detail: 'Open your Bible or devotional when you are ready.',
      }
    : {
        id: 'faith-or-focus',
        title: 'Choose one important thing',
        detail: 'Keep today simple: finish the one thing that matters most first.',
      };

  if (daypart === 'morning') {
    return [
      faithOrFocus,
      modePriority(mode),
      {
        id: 'morning-reminders',
        title: 'Check reminders',
        detail: 'Look at due items, appointments, and anything you should not forget today.',
      },
    ];
  }

  if (daypart === 'day') {
    return [
      modePriority(mode),
      {
        id: 'day-focus',
        title: 'Finish your main task',
        detail: 'Work on the highest-priority item before adding more things.',
      },
      {
        id: 'day-rest',
        title: 'Take a short reset',
        detail: 'Drink water, rest a little, then continue with the next useful task.',
      },
    ];
  }

  if (daypart === 'evening') {
    return [
      {
        id: 'evening-open-items',
        title: 'Check what is still open',
        detail: 'See unfinished tasks, messages, bills, and reminders before relaxing.',
      },
      modePriority(mode),
      {
        id: 'evening-tomorrow',
        title: 'Prepare tomorrow',
        detail: 'Choose tomorrow’s first task and set the alarm you need.',
      },
    ];
  }

  return [
    {
      id: 'night-alarm',
      title: 'Set tomorrow’s alarm',
      detail: 'Choose a realistic wake-up time before you sleep.',
    },
    {
      id: 'night-check',
      title: 'Check tomorrow’s due items',
      detail: 'Review bills, appointments, assignments, work, and important reminders.',
    },
    {
      id: 'night-rest',
      title: 'Rest',
      detail: 'Put unfinished non-urgent items in the Drawer and continue tomorrow.',
    },
  ];
}

export function formatBuklodHomeDate(
  date: Date = new Date(),
): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
