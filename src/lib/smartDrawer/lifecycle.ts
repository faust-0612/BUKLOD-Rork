import {
  getSmartDrawerItem,
  permanentlyDeleteSmartDrawerItem,
  querySmartDrawerItems,
} from './localStore';
import {
  deleteSmartDrawerAsset,
} from './assets';
import {
  loadSmartDrawerSettings,
} from './settings';

export async function runSmartDrawerLifecycleCleanup(
  userId: string,
) {
  if (!userId) {
    return { removed: 0 };
  }

  const settings =
    await loadSmartDrawerSettings(userId);
  const cutoff =
    Date.now() -
    settings.recentlyRemovedRetentionDays *
      24 *
      60 *
      60 *
      1000;

  let offset = 0;
  let removed = 0;

  while (true) {
    const page =
      await querySmartDrawerItems(userId, {
        view: 'recently-removed',
        limit: 100,
        offset,
      });

    if (!page.length) break;

    let pageRemoved = 0;

    for (const summary of page) {
      const item =
        await getSmartDrawerItem(
          userId,
          summary.id,
        );

      if (!item || item.status !== 'RECENTLY_REMOVED') {
        continue;
      }

      const removedAt = Date.parse(
        item.deletedAt ?? item.updatedAt,
      );

      if (
        !Number.isFinite(removedAt) ||
        removedAt > cutoff
      ) {
        continue;
      }

      await Promise.all(
        item.assets.map(asset =>
          deleteSmartDrawerAsset(asset),
        ),
      );

      if (
        await permanentlyDeleteSmartDrawerItem(
          userId,
          item.id,
        )
      ) {
        removed += 1;
        pageRemoved += 1;
      }
    }

    if (page.length < 100) break;

    /*
     * Rows deleted above collapse the result set.
     * Keep offset stable only when this page actually removed rows.
     */
    if (pageRemoved === 0) {
      offset += page.length;
    }
  }

  return { removed };
}
