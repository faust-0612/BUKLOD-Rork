import {
  buklodInstantReplace,
} from '@/lib/buklodInstantNavigation';

export type BuklodPrimaryTabName =
  | 'home'
  | 'messages'
  | 'buklod'
  | 'prayer';

const TAB_ROUTES: Record<
  BuklodPrimaryTabName,
  string
> = {
  home: '/hub',
  messages: '/messages',
  buklod: '/buklod',
  prayer: '/prayer',
};

export function primaryTabHref(
  tab: BuklodPrimaryTabName
) {
  return TAB_ROUTES[tab];
}

export function primaryTabFromBottomRoute(
  route:
    | '/hub'
    | '/home'
    | '/messages'
    | '/buklod'
    | '/prayer'
    | '/notifications'
): BuklodPrimaryTabName | null {
  switch (route) {
    case '/hub':
    case '/home':
      return 'home';
    case '/messages':
      return 'messages';
    case '/buklod':
      return 'buklod';
    case '/prayer':
      return 'prayer';
    default:
      return null;
  }
}

/** Same path as Notifications → Community: always stack replace. */
export function navigateToPrimaryTab(
  tab: BuklodPrimaryTabName
) {
  buklodInstantReplace(
    primaryTabHref(tab) as any
  );
}
