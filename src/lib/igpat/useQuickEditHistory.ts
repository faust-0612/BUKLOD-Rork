import { useCallback, useRef, useState } from 'react';
import {
  DEFAULT_IGPAT_QUICK_EDIT,
  normalizeIgpatQuickEdit,
  type IgpatQuickEditState,
} from './quickEdit';

const IGPAT_EDIT_HISTORY_LIMIT = 24;

type IgpatEditHistoryState = {
  past: IgpatQuickEditState[];
  present: IgpatQuickEditState;
  future: IgpatQuickEditState[];
};

function sameEdit(a: IgpatQuickEditState, b: IgpatQuickEditState): boolean {
  return (
    a.trimStartSeconds === b.trimStartSeconds &&
    a.trimEndSeconds === b.trimEndSeconds &&
    a.speed === b.speed &&
    a.muted === b.muted &&
    a.textOverlay === b.textOverlay &&
    a.contentFit === b.contentFit &&
    a.rotation === b.rotation &&
    a.coverSeconds === b.coverSeconds
  );
}

function pushBounded(
  values: IgpatQuickEditState[],
  value: IgpatQuickEditState
): IgpatQuickEditState[] {
  return [...values, value].slice(-IGPAT_EDIT_HISTORY_LIMIT);
}

export function useIgpatQuickEditHistory(durationSeconds?: number | null) {
  const [history, setHistory] = useState<IgpatEditHistoryState>(() => ({
    past: [],
    present: { ...DEFAULT_IGPAT_QUICK_EDIT },
    future: [],
  }));
  const presentRef = useRef<IgpatQuickEditState>(history.present);
  const transactionBaseRef = useRef<IgpatQuickEditState | null>(null);

  const normalize = useCallback(
    (next: IgpatQuickEditState) => {
      const duration = Number(durationSeconds ?? 0);
      return duration >= 1
        ? normalizeIgpatQuickEdit(next, duration)
        : { ...next };
    },
    [durationSeconds]
  );

  const updateHistory = useCallback(
    (updater: (current: IgpatEditHistoryState) => IgpatEditHistoryState) => {
      setHistory(current => {
        const next = updater(current);
        presentRef.current = next.present;
        return next;
      });
    },
    []
  );

  const reset = useCallback(
    (next: IgpatQuickEditState = { ...DEFAULT_IGPAT_QUICK_EDIT }) => {
      const normalized = normalize(next);
      transactionBaseRef.current = null;
      presentRef.current = normalized;
      setHistory({ past: [], present: normalized, future: [] });
    },
    [normalize]
  );

  const commit = useCallback(
    (next: IgpatQuickEditState) => {
      transactionBaseRef.current = null;
      updateHistory(current => {
        const normalized = normalize(next);
        if (sameEdit(current.present, normalized)) return current;
        return {
          past: pushBounded(current.past, current.present),
          present: normalized,
          future: [],
        };
      });
    },
    [normalize, updateHistory]
  );

  const commitPatch = useCallback(
    (patch: Partial<IgpatQuickEditState>) => {
      commit({ ...presentRef.current, ...patch });
    },
    [commit]
  );

  const beginTransaction = useCallback(() => {
    if (transactionBaseRef.current) return;
    transactionBaseRef.current = presentRef.current;
  }, []);

  const updateTransaction = useCallback(
    (next: IgpatQuickEditState) => {
      updateHistory(current => ({
        ...current,
        present: normalize(next),
        future: [],
      }));
    },
    [normalize, updateHistory]
  );

  const updateTransactionPatch = useCallback(
    (patch: Partial<IgpatQuickEditState>) => {
      updateTransaction({ ...presentRef.current, ...patch });
    },
    [updateTransaction]
  );

  const endTransaction = useCallback(() => {
    const base = transactionBaseRef.current;
    transactionBaseRef.current = null;
    if (!base) return;

    updateHistory(current => {
      if (sameEdit(base, current.present)) return current;
      return {
        past: pushBounded(current.past, base),
        present: current.present,
        future: [],
      };
    });
  }, [updateHistory]);

  const undo = useCallback(() => {
    const activeBase = transactionBaseRef.current;
    transactionBaseRef.current = null;

    updateHistory(current => {
      if (activeBase && !sameEdit(activeBase, current.present)) {
        return {
          past: current.past,
          present: activeBase,
          future: [current.present, ...current.future].slice(0, IGPAT_EDIT_HISTORY_LIMIT),
        };
      }
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, IGPAT_EDIT_HISTORY_LIMIT),
      };
    });
  }, [updateHistory]);

  const redo = useCallback(() => {
    transactionBaseRef.current = null;
    updateHistory(current => {
      if (!current.future.length) return current;
      const next = current.future[0];
      return {
        past: pushBounded(current.past, current.present),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, [updateHistory]);

  return {
    edit: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
    commit,
    commitPatch,
    beginTransaction,
    updateTransaction,
    updateTransactionPatch,
    endTransaction,
    undo,
    redo,
  };
}
