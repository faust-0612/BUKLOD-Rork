// Standalone BUKLOD Report compatibility layer.
//
// Existing Report-era code imports BuklodScopeProvider/useBuklodScope from this
// path. On the standalone Report branch those names intentionally resolve to
// the read-only Report scope provider, which reads canonical Organization /
// Cluster memberships but never persists BUKLOD Main's active scope.
export {
  BuklodReportScopeProvider as BuklodScopeProvider,
  useBuklodReportScope as useBuklodScope,
} from '@/providers/BuklodReportScopeProvider';
