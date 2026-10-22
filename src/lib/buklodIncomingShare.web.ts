export function useIncomingShare(): any {
  return {
    isResolving: false,
    sharedPayloads: [],
    resolvedSharedPayloads: [],
    error: null,
    clearSharedPayloads: async () => {},
    clearResolvedSharedPayloads: async () => {},
    clear: async () => {},
  };
}
