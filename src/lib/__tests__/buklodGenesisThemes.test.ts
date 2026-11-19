import {
  BUKLOD_GLOBAL_PREFERENCE_OPTIONS,
  BUKLOD_PALETTE_PRESETS,
  DEFAULT_BUKLOD_THEME_PREFERENCE,
  accessibleTextOn,
  getBuklodGlobalTheme,
  isBuklodThemePreferenceId,
} from '../buklodTheme';
import {
  BUKLOD_MESSAGES_THEME_STORAGE_KEY,
  buildMessagesThemeRoles,
  resolveMessagesTheme,
} from '../messagesTheme';
import {
  GENESIS_ART_PERFORMANCE,
  GENESIS_SEASON2_VISUALS,
} from '../buklodSeasonVisuals';

const newThemeIds = [
  'evergreenSocial',
  'midnightMint',
  'warmCommunity',
  'sapphireFrost',
  'forestChampagne',
  'royalPlum',
  'terracottaSand',
  'graphiteLime',
  'oceanCoral',
] as const;

describe('BUKLOD optional global themes', () => {
  it.each(newThemeIds)('%s is selectable and has aligned chat colors', id => {
    expect(isBuklodThemePreferenceId(id)).toBe(true);
    expect(BUKLOD_GLOBAL_PREFERENCE_OPTIONS.find(option => option.id === id)).toBeDefined();

    const { roles } = getBuklodGlobalTheme(id);
    expect(roles.canvas).toMatch(/^#[0-9a-f]{6}$/i);
    expect(roles.brandHeaderSurface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(roles.brandLineAccent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(roles.navActiveIndicator).toBe(roles.accent);
    expect(roles.buttonPrimary).toBe(roles.accent);
    expect(roles.onAccent).toBe(accessibleTextOn(roles.accent));
    expect(BUKLOD_PALETTE_PRESETS[id].id).toBe(id);

    const messages = buildMessagesThemeRoles(id);
    expect(messages.accent).toBe(roles.accent);
    expect(messages.bubbleSent).toBeTruthy();
    expect(messages.textOnSentBubble).toBe(accessibleTextOn(roles.accent));
    expect(resolveMessagesTheme('followGlobal', id).effectivePaletteId).toBe(id);
  });

  it('does not change the defaults or persistent storage key', () => {
    expect(DEFAULT_BUKLOD_THEME_PREFERENCE).toBe('system');
    expect(BUKLOD_MESSAGES_THEME_STORAGE_KEY).toBe('buklod_messages_theme_v1');
  });
});

describe('Genesis Season 2 visual isolation', () => {
  it('keeps the proposed new identity and artwork tokens separate', () => {
    expect(GENESIS_SEASON2_VISUALS.id).toBe('genesis-seed-of-glory');
    expect(GENESIS_SEASON2_VISUALS.officialWorkingTitle).toBe('GENESIS: The Seed of Glory');
    expect(GENESIS_SEASON2_VISUALS.earliestProductionDatePht).toBe('2026-12-06');
    expect(GENESIS_SEASON2_VISUALS.motifs).toContain('glorySeed');
    expect(GENESIS_ART_PERFORMANCE.offscreenAnimation).toBe(false);
    expect(GENESIS_ART_PERFORMANCE.maxDecorativeOpacity).toBeLessThanOrEqual(0.18);
  });
});
