import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  supabase,
} from '@/lib/supabase';

import {
  useAuth,
} from '@/providers/AuthProvider';

type Ctx = {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Context =
  createContext<Ctx | undefined>(
    undefined
  );

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    user,
  } = useAuth();

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const refreshUnread =
    useCallback(
      async () => {
        if (!user?.id) {
          setUnreadCount(0);
          return;
        }

        const {
          count,
          error,
        } =
          await supabase
            .from('notifications')
            .select(
              'id',
              {
                count: 'exact',
                head: true,
              }
            )
            .eq(
              'user_id',
              user.id
            )
            .is(
              'read_at',
              null
            );

        if (error) {
          console.warn(
            'Notification count',
            error.message
          );
          return;
        }

        setUnreadCount(
          count ?? 0
        );
      },
      [
        user?.id,
      ]
    );

  const markAllRead =
    useCallback(
      async () => {
        if (!user?.id) {
          return;
        }

        const {
          error,
        } =
          await supabase
            .from('notifications')
            .update({
              read_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'user_id',
              user.id
            )
            .is(
              'read_at',
              null
            );

        if (error) {
          throw error;
        }

        await refreshUnread();
      },
      [
        user?.id,
        refreshUnread,
      ]
    );

  useEffect(
    () => {
      void refreshUnread();
    },
    [
      refreshUnread,
    ]
  );

  useEffect(
    () => {
      if (!user?.id) {
        return;
      }

      const channel =
        supabase
          .channel(
            `web-notifs:${user.id}`
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'notifications',
              filter:
                `user_id=eq.${user.id}`,
            },
            () => {
              void refreshUnread();
            }
          )
          .subscribe();

      return () => {
        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      user?.id,
      refreshUnread,
    ]
  );

  const value =
    useMemo(
      () => ({
        unreadCount,
        refreshUnread,
        markAllRead,
      }),
      [
        unreadCount,
        refreshUnread,
        markAllRead,
      ]
    );

  return (
    <Context.Provider
      value={value}
    >
      {children}
    </Context.Provider>
  );
}

export function
useNotifications() {
  const value =
    useContext(
      Context
    );

  if (!value) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider'
    );
  }

  return value;
}