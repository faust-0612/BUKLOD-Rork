/**
 * Personal BUKLOD Wall moments.
 * All inputs must already be authorized for the signed-in viewer.
 * This module never reads another person's birthday or announces a member publicly.
 */
export type BuklodLivingMoment = {
  key: string;
  kind: 'birthday' | 'welcome' | 'kl_release' | 'occasion' | 'activity' | 'suggestion';
  title: string;
  message: string;
  actionLabel: string;
  route: '/me' | '/hub' | '/buklod' | '/messages' | '/clusters' | '/notifications' | '/kabihasnang-ligaw';
  priority: number;
};

export type BuklodLivingMomentInput = {
  now: Date;
  userId: string;
  firstName?: string | null;
  joinedAt?: string | null;
  birthDate?: string | null;
  latestKl?: {
    id: string;
    title: string;
    episode_number: number;
    release_at: string;
  } | null;
  faithEnabled: boolean;
  unreadCount?: number;
};

export function buklodManilaDay(now: Date): string {
  if (!Number.isFinite(now.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return get('year') + '-' + get('month') + '-' + get('day');
}

function safeName(value: string | null | undefined): string {
  const name = String(value ?? '').trim().split(/\s+/)[0] || '';
  return name.slice(0, 36).replace(/[<>{}]/g, '');
}

function elapsedDays(now: Date, timestamp: string | null | undefined): number {
  const at = Date.parse(String(timestamp ?? ''));
  if (!Number.isFinite(at)) return Infinity;
  const delta = now.getTime() - at;
  return delta >= 0 ? delta / 86400000 : Infinity;
}

export function buildBuklodLivingMoments(
  input: BuklodLivingMomentInput
): BuklodLivingMoment[] {
  if (!input.userId || !Number.isFinite(input.now.getTime())) return [];
  const today = buklodManilaDay(input.now);
  if (!today) return [];
  const nickname = safeName(input.firstName);
  const greeting = nickname ? ', ' + nickname : '';
  const result: BuklodLivingMoment[] = [];
  const datePart = today.slice(5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.birthDate ?? '')) &&
      String(input.birthDate).slice(5) === datePart) {
    result.push({
      key: 'birthday:' + today,
      kind: 'birthday',
      title: 'Maligayang kaarawan' + greeting + '! 🎉',
      message: 'Mula sa buong BUKLOD, salamat sa pagiging bahagi ng ating komunidad. Ang pagbating ito ay para lamang sa iyong account.',
      actionLabel: 'Tingnan ang Profile',
      route: '/me',
      priority: 100,
    });
  }

  if (elapsedDays(input.now, input.joinedAt) <= 5) {
    result.push({
      key: 'welcome:' + input.userId,
      kind: 'welcome',
      title: 'Welcome sa BUKLOD' + greeting + '! 💚',
      message: 'May lugar ka rito. Kilalanin ang komunidad, sumali sa isang Cluster, at magbahagi ng unang kuwento sa Wall.',
      actionLabel: 'Kilalanin ang Cluster',
      route: '/clusters',
      priority: 90,
    });
  }

  const kl = input.latestKl;
  if (kl && Number.isInteger(kl.episode_number) && kl.episode_number > 0 &&
      kl.id && elapsedDays(input.now, kl.release_at) <= 14) {
    result.push({
      key: 'kl:' + kl.id,
      kind: 'kl_release',
      title: 'Bagong kabanata sa Kabihasnang Ligaw! 📖',
      message: 'Kabanata ' + kl.episode_number + ': ' + String(kl.title ?? '').trim().slice(0, 110),
      actionLabel: 'Basahin ngayon',
      route: '/kabihasnang-ligaw',
      priority: 80,
    });
  }

  const occasions: Record<string, { title: string; message: string; faith?: boolean }> = {
    '01-01': {
      title: 'Manigong Bagong Taon! ✨',
      message: 'Isang bagong simula, sama-sama sa BUKLOD.',
    },
    '06-12': {
      title: 'Maligayang Araw ng Kalayaan! 🇵🇭',
      message: 'Ipinagdiriwang natin ang malasakit, pagkakaisa at paglilingkod sa bayan.',
    },
    '11-30': {
      title: 'Araw ni Bonifacio! 🇵🇭',
      message: 'Sama-sama nating alalahanin ang katapangan at paglilingkod sa bayan.',
    },
    '12-30': {
      title: 'Araw ni Rizal! 🇵🇭',
      message: 'Mula sa BUKLOD, alalahanin natin ang ating kasaysayan at pagkakaisa.',
    },
    '12-25': {
      title: 'Maligayang Pasko mula sa BUKLOD! 🎄',
      message: 'Nawa ay mapuno ng pagmamahalan at pag-asa ang inyong tahanan.',
      faith: true,
    },
  };
  const occasion = occasions[datePart];
  if (occasion && (!occasion.faith || input.faithEnabled)) {
    result.push({
      key: 'occasion:' + today,
      kind: 'occasion',
      title: occasion.title,
      message: occasion.message,
      actionLabel: 'Buksan ang Home',
      route: '/hub',
      priority: 70,
    });
  }

  const unread = Math.max(0, Math.min(999, Math.floor(Number(input.unreadCount ?? 0) || 0)));
  if (unread > 0) {
    result.push({
      key: 'activity:' + today,
      kind: 'activity',
      title: 'May ' + unread + ' bagong update para sa iyo 🔔',
      message: 'Silipin ang mga mensahe at mahahalagang pangyayari sa iyong BUKLOD notifications.',
      actionLabel: 'Tingnan ang notifications',
      route: '/notifications',
      priority: 60,
    });
  }

  const suggestions = [
    {
      title: 'May makukumusta ka ba ngayon?',
      message: 'Isang simpleng mensahe ay maaaring magpasaya sa araw ng isang kaibigan.',
      actionLabel: 'Buksan ang Connect',
      route: '/messages' as const,
    },
    {
      title: 'Mas masaya kapag magkakasama.',
      message: 'Bisitahin ang iyong Cluster para sa updates at mga bagong gawain.',
      actionLabel: 'Tingnan ang Cluster',
      route: '/clusters' as const,
    },
    {
      title: 'May kuwentong gusto mong ibahagi?',
      message: 'Ang isang maikling post ay maaaring makahikayat at makatulong sa iba.',
      actionLabel: 'Tingnan ang Wall',
      route: '/buklod' as const,
    },
  ];
  const dayIndex = Math.floor(Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10))
  ) / 86400000);
  const prompt = suggestions[((dayIndex % suggestions.length) + suggestions.length) % suggestions.length];
  result.push({
    key: 'suggestion:' + today,
    kind: 'suggestion',
    title: prompt.title,
    message: prompt.message,
    actionLabel: prompt.actionLabel,
    route: prompt.route,
    priority: 10,
  });
  return result.sort((a, b) => b.priority - a.priority);
}
