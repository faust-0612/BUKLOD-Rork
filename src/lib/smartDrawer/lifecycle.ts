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
import {
  transitionSmartDrawerItem,
} from './service';

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
  let autoDone = 0;
  let autoArchived = 0;

  const activeLists =
    await querySmartDrawerItems(userId, {
      view: 'lists',
      limit: 100,
    });

  for (const item of activeLists) {
    if (
      item.listItems.length > 0 &&
      item.listItems.every(entry => entry.done)
    ) {
      await transitionSmartDrawerItem(
        userId,
        item.id,
        'DONE',
      );
      autoDone += 1;
    }
  }

  for (const view of ['events', 'appointments']) {
    const dated =
      await querySmartDrawerItems(userId, {
        view,
        limit: 100,
      });

    for (const item of dated) {
      const eventTime = Date.parse(
        item.eventAt ?? item.dueAt ?? '',
      );

      if (
        Number.isFinite(eventTime) &&
        eventTime < Date.now()
      ) {
        await transitionSmartDrawerItem(
          userId,
          item.id,
          'ARCHIVED',
        );
        autoArchived += 1;
      }
    }
  }

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

  return {
    removed,
    autoDone,
    autoArchived,
  };
}
