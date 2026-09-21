import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import BuklodCanonicalMarkdown from '@/components/BuklodCanonicalMarkdown';
import { CanonicalReferenceGate } from '@/components/CanonicalReferenceGate';
import {
  canonicalRiskNeedsDiff,
  canonicalRiskNeedsElevatedPublish,
  compareCanonicalVersions,
  copyCanonicalMarkdown,
  copyCanonicalSection,
  createCanonicalDraft,
  decideCanonicalReview,
  loadCanonicalCurrent,
  loadCanonicalHistory,
  loadCanonicalSection,
  loadCanonicalSectionList,
  loadCanonicalVersion,
  markCanonicalDiffReviewed,
  publishCanonicalVersion,
  saveCanonicalDraftSection,
  searchCanonicalReference,
  setCanonicalImplementation,
  submitCanonicalReview,
  updateCanonicalDraftMetadata,
  type CanonicalCompareRow,
  type CanonicalCurrentSnapshot,
  type CanonicalImplementationStatus,
  type CanonicalRiskLevel,
  type CanonicalSearchResult,
  type CanonicalSection,
  type CanonicalSectionSummary,
  type CanonicalVerificationStatus,
  type CanonicalVersion,
} from '@/lib/buklodCanonicalReference';
import { colors } from '@/lib/theme';

type ViewMode =
  | 'READ'
  | 'EDIT'
  | 'COMPARE';

type Notice = {
  tone: 'success' | 'warning' | 'error' | 'info';
  text: string;
} | null;

const RISK_LEVELS: CanonicalRiskLevel[] = [
  'NORMAL',
  'HIGH',
  'FINANCIAL',
  'SECURITY',
  'PRIVACY',
];

const IMPLEMENTATION_STATUSES: CanonicalImplementationStatus[] = [
  'DOC_ONLY',
  'PLANNED',
  'BUILDING',
  'VERIFIED',
  'LIVE',
];

const VERIFICATION_STATUSES: CanonicalVerificationStatus[] = [
  'MATCHED',
  'PENDING_IMPLEMENTATION',
  'CONFLICT_DETECTED',
  'VERIFICATION_REQUIRED',
];

function compactDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function nextVersion(value: string) {
  const parts = String(value ?? '')
    .split('.')
    .map(part => Number.parseInt(part, 10));

  if (
    parts.length >= 2 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1])
  ) {
    return `${parts[0]}.${parts[1] + 1}`;
  }

  return `${value || '1.0'}.1`;
}

function toneStyle(tone: Notice extends infer T ? T : never) {
  return tone;
}

function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'green' && styles.pillGreen,
        tone === 'amber' && styles.pillAmber,
        tone === 'red' && styles.pillRed,
        tone === 'blue' && styles.pillBlue,
      ]}
    >
      <Text style={styles.pillText}>
        {label.replaceAll('_', ' ')}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
  secondary,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.actionSecondary,
        danger && styles.actionDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={16}
        color={
          secondary
            ? colors.greenDark
            : '#FFFFFF'
        }
      />
      <Text
        style={[
          styles.actionText,
          secondary && styles.actionTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ReferenceCenterBody() {
  const params = useLocalSearchParams<{
    section?: string | string[];
  }>();
  const requestedSection = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  const { width } = useWindowDimensions();
  const desktop = width >= 1120;

  const [snapshot, setSnapshot] =
    useState<CanonicalCurrentSnapshot | null>(null);
  const [history, setHistory] =
    useState<CanonicalVersion[]>([]);
  const [selectedVersion, setSelectedVersion] =
    useState<CanonicalVersion | null>(null);
  const [sections, setSections] =
    useState<CanonicalSectionSummary[]>([]);
  const [selectedSection, setSelectedSection] =
    useState<CanonicalSection | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [sectionLoading, setSectionLoading] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [notice, setNotice] =
    useState<Notice>(null);
  const [mode, setMode] =
    useState<ViewMode>('READ');

  const [search, setSearch] = useState('');
  const [includeHistory, setIncludeHistory] =
    useState(false);
  const [searching, setSearching] =
    useState(false);
  const [searchResults, setSearchResults] =
    useState<CanonicalSearchResult[]>([]);

  const [compareRows, setCompareRows] =
    useState<CanonicalCompareRow[]>([]);
  const [compareSelectedKey, setCompareSelectedKey] =
    useState<string | null>(null);

  const [editTitle, setEditTitle] =
    useState('');
  const [editContent, setEditContent] =
    useState('');
  const [editReason, setEditReason] =
    useState('');

  const [draftOpen, setDraftOpen] =
    useState(false);
  const [draftVersion, setDraftVersion] =
    useState('');
  const [draftSummary, setDraftSummary] =
    useState('');
  const [draftModules, setDraftModules] =
    useState('');
  const [draftRisk, setDraftRisk] =
    useState<CanonicalRiskLevel>('NORMAL');
  const [draftNotes, setDraftNotes] =
    useState('');

  const [metadataSummary, setMetadataSummary] =
    useState('');
  const [metadataModules, setMetadataModules] =
    useState('');
  const [metadataRisk, setMetadataRisk] =
    useState<CanonicalRiskLevel>('NORMAL');
  const [metadataNotes, setMetadataNotes] =
    useState('');

  const [implementationStatus, setImplementationStatus] =
    useState<CanonicalImplementationStatus>('DOC_ONLY');
  const [verificationStatus, setVerificationStatus] =
    useState<CanonicalVerificationStatus>('VERIFICATION_REQUIRED');
  const [implementationRef, setImplementationRef] =
    useState('');
  const [implementationReason, setImplementationReason] =
    useState('');

  const selectedIsCurrent =
    snapshot?.version.id === selectedVersion?.id;

  const compareChangedRows = useMemo(
    () =>
      compareRows.filter(
        row => row.change_type !== 'UNCHANGED',
      ),
    [compareRows],
  );

  const compareSelected = useMemo(
    () =>
      compareChangedRows.find(
        row => row.section_key === compareSelectedKey,
      ) ??
      compareChangedRows[0] ??
      null,
    [compareChangedRows, compareSelectedKey],
  );

  const syncVersionFields = useCallback(
    (version: CanonicalVersion | null) => {
      if (!version) return;
      setMetadataSummary(version.change_summary ?? '');
      setMetadataModules(
        (version.affected_modules ?? []).join(', '),
      );
      setMetadataRisk(version.risk_level);
      setMetadataNotes(version.notes ?? '');
      setImplementationStatus(
        version.implementation_status,
      );
      setVerificationStatus(
        version.verification_status,
      );
      setImplementationRef(
        version.implementation_ref ?? '',
      );
    },
    [],
  );

  const loadSection = useCallback(
    async (
      versionId: string,
      sectionKey: string,
    ) => {
      setSectionLoading(true);
      try {
        const section =
          await loadCanonicalSection(
            versionId,
            sectionKey,
          );
        setSelectedSection(section);
        setEditTitle(section.title);
        setEditContent(section.content_markdown);
        setEditReason('');
      } catch (error: any) {
        setNotice({
          tone: 'error',
          text:
            String(error?.message ?? '') ||
            'Could not load the selected section.',
        });
      } finally {
        setSectionLoading(false);
      }
    },
    [],
  );

  const selectVersion = useCallback(
    async (
      version: CanonicalVersion,
      preferredSection?: string | null,
    ) => {
      setBusy(true);
      setMode('READ');
      setCompareRows([]);
      setCompareSelectedKey(null);
      try {
        const nextSections =
          await loadCanonicalSectionList(version.id);
        setSelectedVersion(version);
        setSections(nextSections);
        syncVersionFields(version);

        const target =
          nextSections.find(
            row =>
              row.section_key === preferredSection,
          ) ??
          nextSections[0] ??
          null;

        if (target) {
          await loadSection(
            version.id,
            target.section_key,
          );
        } else {
          setSelectedSection(null);
        }
      } finally {
        setBusy(false);
      }
    },
    [loadSection, syncVersionFields],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [current, versions] =
        await Promise.all([
          loadCanonicalCurrent(),
          loadCanonicalHistory(25, 0),
        ]);

      setSnapshot(current);
      setHistory(versions);

      const currentVersion =
        versions.find(
          version =>
            version.id === current.version.id,
        ) ?? current.version;

      setSelectedVersion(currentVersion);
      setSections(current.sections);
      syncVersionFields(currentVersion);

      const target =
        current.sections.find(
          row =>
            row.section_key === requestedSection,
        ) ??
        current.sections[0] ??
        null;

      if (target) {
        await loadSection(
          currentVersion.id,
          target.section_key,
        );
      }
    } catch (error: any) {
      setNotice({
        tone: 'error',
        text:
          String(error?.message ?? '') ||
          'Could not load the Canonical Reference.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    loadSection,
    requestedSection,
    syncVersionFields,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const q = search.trim();

    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      void searchCanonicalReference(
        q,
        includeHistory,
      )
        .then(setSearchResults)
        .catch(error => {
          setNotice({
            tone: 'error',
            text:
              String(error?.message ?? '') ||
              'Search failed.',
          });
        })
        .finally(() => setSearching(false));
    }, 320);

    return () => clearTimeout(timer);
  }, [search, includeHistory]);

  const openSearchResult = useCallback(
    async (result: CanonicalSearchResult) => {
      setSearch('');
      setSearchResults([]);

      let version =
        history.find(
          item => item.id === result.version_id,
        ) ?? null;

      if (!version) {
        version =
          await loadCanonicalVersion(
            result.version_id,
          );
      }

      await selectVersion(
        version,
        result.section_key,
      );
    },
    [history, selectVersion],
  );

  const createDraft = useCallback(async () => {
    if (
      !snapshot ||
      !selectedVersion ||
      !draftVersion.trim() ||
      !draftSummary.trim()
    ) {
      setNotice({
        tone: 'warning',
        text:
          'Version and change summary are required.',
      });
      return;
    }

    setBusy(true);
    setNotice({
      tone: 'info',
      text: 'Creating draft…',
    });

    try {
      const id = await createCanonicalDraft({
        version: draftVersion.trim(),
        changeSummary: draftSummary.trim(),
        affectedModules: draftModules
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        riskLevel: draftRisk,
        notes: draftNotes.trim() || null,
        sourceVersionId: selectedVersion.id,
        requestId: `canonical-draft:${draftVersion.trim()}:${Date.now()}`,
      });

      const version =
        await loadCanonicalVersion(id);
      const versions =
        await loadCanonicalHistory(25, 0);
      setHistory(versions);
      setDraftOpen(false);
      setDraftVersion('');
      setDraftSummary('');
      setDraftModules('');
      setDraftNotes('');
      setDraftRisk('NORMAL');
      await selectVersion(
        version,
        selectedSection?.section_key,
      );
      setMode('EDIT');
      setNotice({
        tone: 'success',
        text:
          `Draft v${version.version} created. Published history was not modified.`,
      });
    } catch (error: any) {
      setNotice({
        tone: 'error',
        text:
          String(error?.message ?? '') ||
          'Draft creation failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [
    draftModules,
    draftNotes,
    draftRisk,
    draftSummary,
    draftVersion,
    selectedSection?.section_key,
    selectedVersion,
    selectVersion,
    snapshot,
  ]);

  const saveSection = useCallback(async () => {
    if (
      !selectedVersion ||
      !selectedSection
    ) {
      return;
    }

    if (!editReason.trim()) {
      setNotice({
        tone: 'warning',
        text:
          'Enter the reason for this section change before saving.',
      });
      return;
    }

    setBusy(true);
    setNotice({
      tone: 'info',
      text: 'Saving draft section…',
    });

    try {
      const section =
        await saveCanonicalDraftSection({
          versionId: selectedVersion.id,
          sectionKey:
            selectedSection.section_key,
          title: editTitle,
          contentMarkdown: editContent,
          expectedRevision:
            selectedSection.revision,
          reason: editReason.trim(),
        });
      setSelectedSection(section);
      setEditReason('');
      setNotice({
        tone: 'success',
        text:
          'Draft section saved. Any previous diff acknowledgement was cleared because content changed.',
      });
    } catch (error: any) {
      const message = String(
        error?.message ?? '',
      );
      setNotice({
        tone: 'error',
        text: message.includes(
          'STALE_CANONICAL_SECTION',
        )
          ? 'Conflict detected: this section changed after you opened it. Reload before editing again; nothing was overwritten.'
          : message ||
            'Section save failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [
    editContent,
    editReason,
    editTitle,
    selectedSection,
    selectedVersion,
  ]);

  const saveMetadata = useCallback(async () => {
    if (!selectedVersion) return;
    if (!editReason.trim()) {
      setNotice({
        tone: 'warning',
        text:
          'Enter a reason before changing draft metadata.',
      });
      return;
    }

    setBusy(true);
    try {
      const version =
        await updateCanonicalDraftMetadata({
          versionId: selectedVersion.id,
          changeSummary: metadataSummary,
          affectedModules: metadataModules
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          riskLevel: metadataRisk,
          notes: metadataNotes || null,
          expectedRevision:
            selectedVersion.revision,
          reason: editReason.trim(),
        });
      setSelectedVersion(version);
      syncVersionFields(version);
      setHistory(current =>
        current.map(item =>
          item.id === version.id
            ? version
            : item,
        ),
      );
      setEditReason('');
      setNotice({
        tone: 'success',
        text:
          'Draft metadata saved with concurrency protection.',
      });
    } catch (error: any) {
      const message = String(
        error?.message ?? '',
      );
      setNotice({
        tone: 'error',
        text: message.includes(
          'STALE_CANONICAL_VERSION',
        )
          ? 'Conflict detected: the draft metadata changed after you opened it. Reload before saving again.'
          : message ||
            'Draft metadata save failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [
    editReason,
    metadataModules,
    metadataNotes,
    metadataRisk,
    metadataSummary,
    selectedVersion,
    syncVersionFields,
  ]);

  const runCompare = useCallback(async () => {
    if (
      !selectedVersion?.supersedes_version_id
    ) {
      setNotice({
        tone: 'warning',
        text:
          'This version has no superseded base to compare.',
      });
      return;
    }

    setBusy(true);
    try {
      const rows =
        await compareCanonicalVersions(
          selectedVersion.supersedes_version_id,
          selectedVersion.id,
        );
      setCompareRows(rows);
      const changed = rows.find(
        row =>
          row.change_type !== 'UNCHANGED',
      );
      setCompareSelectedKey(
        changed?.section_key ?? null,
      );
      setMode('COMPARE');
      setNotice({
        tone: 'info',
        text:
          `${rows.filter(row => row.change_type !== 'UNCHANGED').length} section change(s) detected.`,
      });
    } catch (error: any) {
      setNotice({
        tone: 'error',
        text:
          String(error?.message ?? '') ||
          'Version comparison failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [selectedVersion]);

  const acknowledgeDiff = useCallback(async () => {
    if (!selectedVersion) return;

    setBusy(true);
    try {
      const version =
        await markCanonicalDiffReviewed(
          selectedVersion.id,
          selectedVersion.revision,
        );
      setSelectedVersion(version);
      setHistory(current =>
        current.map(item =>
          item.id === version.id
            ? version
            : item,
        ),
      );
      setNotice({
        tone: 'success',
        text:
          'Diff review recorded in the audit trail.',
      });
    } catch (error: any) {
      setNotice({
        tone: 'error',
        text:
          String(error?.message ?? '') ||
          'Could not record diff review.',
      });
    } finally {
      setBusy(false);
    }
  }, [selectedVersion]);

  const submitReview = useCallback(async () => {
    if (!selectedVersion) return;

    setBusy(true);
    try {
      const version =
        await submitCanonicalReview(
          selectedVersion.id,
          selectedVersion.revision,
          metadataNotes || null,
        );
      setSelectedVersion(version);
      setHistory(current =>
        current.map(item =>
          item.id === version.id
            ? version
            : item,
        ),
      );
      setMode('READ');
      setNotice({
        tone: 'success',
        text:
          'Draft submitted for review. Draft editing is now locked until review is resolved.',
      });
    } catch (error: any) {
      setNotice({
        tone: 'error',
        text:
          String(error?.message ?? '') ||
          'Review submission failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [
    metadataNotes,
    selectedVersion,
  ]);

  const reviewDecision = useCallback(
    async (approve: boolean) => {
      if (!selectedVersion) return;

      if (!metadataNotes.trim()) {
        setNotice({
          tone: 'warning',
          text:
            'Review notes are required for approval or rejection.',
        });
        return;
      }

      setBusy(true);
      try {
        const version =
          await decideCanonicalReview({
            versionId: selectedVersion.id,
            approve,
            expectedRevision:
              selectedVersion.revision,
            notes: metadataNotes.trim(),
          });
        setSelectedVersion(version);
        setHistory(current =>
          current.map(item =>
            item.id === version.id
              ? version
              : item,
          ),
        );
        setNotice({
          tone: 'success',
          text: approve
            ? 'Version approved. It is not canonical until Publish succeeds.'
            : 'Review rejected. The version returned to DRAFT.',
        });
      } catch (error: any) {
        const message = String(
          error?.message ?? '',
        );
        setNotice({
          tone: 'error',
          text: message.includes(
            'DIFF_REVIEW_REQUIRED',
          )
            ? 'This risk level requires a recorded diff review before approval.'
            : message ||
              'Review decision failed.',
        });
      } finally {
        setBusy(false);
      }
    },
    [metadataNotes, selectedVersion],
  );

  const publish = useCallback(() => {
    if (!selectedVersion) return;

    const elevated =
      canonicalRiskNeedsElevatedPublish(
        selectedVersion.risk_level,
      );
    const warning =
      elevated
        ? '\n\nThis is a FINANCIAL / SECURITY / PRIVACY class change. Elevated publish authority is required.'
        : '';

    Alert.alert(
      'Publish Canonical Reference',
      'Publishing updates the canonical documentation only. It does NOT change runtime money rules, RLS, permissions, settlement behavior, feature flags, or production code.' +
        warning,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'PUBLISH',
          onPress: () => {
            setBusy(true);
            setNotice({
              tone: 'info',
              text:
                'Publishing authoritative version…',
            });

            void publishCanonicalVersion(
              selectedVersion.id,
              selectedVersion.revision,
            )
              .then(async version => {
                await loadAll();
                setNotice({
                  tone: 'success',
                  text:
                    `Version ${version.version} is now EFFECTIVE. Runtime implementation status remains separate.`,
                });
              })
              .catch((error: any) => {
                const message = String(
                  error?.message ?? '',
                );
                setNotice({
                  tone: 'error',
                  text: message.includes(
                    'DIFF_REVIEW_REQUIRED',
                  )
                    ? 'Publish blocked: this risk level requires a recorded diff review.'
                    : message.includes(
                          'STALE_CANONICAL_BASE',
                        )
                      ? 'Publish blocked: the effective canonical version changed after this draft was created. Create/rebase a new draft; history was not changed.'
                      : message ||
                        'Publish failed. No Published state is shown because authoritative confirmation was not received.',
                });
              })
              .finally(() =>
                setBusy(false),
              );
          },
        },
      ],
    );
  }, [loadAll, selectedVersion]);

  const saveImplementation =
    useCallback(async () => {
      if (!selectedVersion) return;
      if (!implementationReason.trim()) {
        setNotice({
          tone: 'warning',
          text:
            'Enter a reason for the implementation-status change.',
        });
        return;
      }

      setBusy(true);
      try {
        const version =
          await setCanonicalImplementation({
            versionId: selectedVersion.id,
            implementationStatus,
            verificationStatus,
            implementationRef:
              implementationRef.trim() || null,
            expectedRevision:
              selectedVersion.revision,
            reason:
              implementationReason.trim(),
          });
        setSelectedVersion(version);
        setHistory(current =>
          current.map(item =>
            item.id === version.id
              ? version
              : item,
          ),
        );
        syncVersionFields(version);
        setImplementationReason('');
        setNotice({
          tone: 'success',
          text:
            'Implementation linkage updated. Canonical policy content was not changed.',
        });
      } catch (error: any) {
        setNotice({
          tone: 'error',
          text:
            String(error?.message ?? '') ||
            'Implementation status update failed.',
        });
      } finally {
        setBusy(false);
      }
    }, [
      implementationReason,
      implementationRef,
      implementationStatus,
      selectedVersion,
      syncVersionFields,
      verificationStatus,
    ]);

  const copySection = useCallback(async () => {
    if (
      !selectedVersion ||
      !selectedSection
    ) {
      return;
    }
    await copyCanonicalSection({
      version: selectedVersion,
      section: selectedSection,
    });
    setNotice({
      tone: 'success',
      text:
        'Section copied with version and implementation context.',
    });
  }, [selectedSection, selectedVersion]);

  const copyAll = useCallback(async () => {
    await copyCanonicalMarkdown(
      selectedVersion?.id ?? null,
    );
    setNotice({
      tone: 'success',
      text:
        'Clean Markdown copied for authorized implementation use.',
    });
  }, [selectedVersion?.id]);

  const perms = snapshot?.permissions;
  const canEdit =
    selectedVersion?.status === 'DRAFT' &&
    perms?.can_draft === true;

  const leftPanel = (
    <View style={styles.leftPanel}>
      <View style={styles.leftHeader}>
        <Text style={styles.leftEyebrow}>
          SECTIONS
        </Text>
        <Text style={styles.leftTitle}>
          Reference Map
        </Text>
      </View>

      <ScrollView
        style={styles.leftScroll}
        contentContainerStyle={styles.leftContent}
      >
        {sections.map(section => {
          const active =
            selectedSection?.section_key ===
            section.section_key;

          return (
            <Pressable
              key={section.section_key}
              onPress={() =>
                void loadSection(
                  selectedVersion?.id ?? '',
                  section.section_key,
                )
              }
              style={({ pressed }) => [
                styles.sectionRow,
                active &&
                  styles.sectionRowActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sectionNo}>
                {String(
                  section.sort_order,
                ).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    active &&
                      styles.sectionTitleActive,
                  ]}
                >
                  {section.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={styles.sectionKey}
                >
                  {section.section_key}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const comparePanel =
    mode === 'COMPARE' ? (
      <View style={styles.compareRoot}>
        <View style={styles.compareHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.editorEyebrow}>
              VERSION DIFF
            </Text>
            <Text style={styles.editorTitle}>
              {selectedVersion?.version ?? ''}
            </Text>
          </View>
          {(perms?.can_review ||
            perms?.can_approve) &&
            selectedVersion &&
            ['DRAFT', 'REVIEW'].includes(
              selectedVersion.status,
            ) && (
              <ActionButton
                icon="check-decagram-outline"
                label="MARK DIFF REVIEWED"
                onPress={() =>
                  void acknowledgeDiff()
                }
                disabled={busy}
                secondary
              />
            )}
        </View>

        <View style={styles.diffList}>
          {compareChangedRows.length ? (
            compareChangedRows.map(row => (
              <Pressable
                key={row.section_key}
                onPress={() =>
                  setCompareSelectedKey(
                    row.section_key,
                  )
                }
                style={[
                  styles.diffRow,
                  compareSelected?.section_key ===
                    row.section_key &&
                    styles.diffRowActive,
                ]}
              >
                <StatusPill
                  label={row.change_type}
                  tone={
                    row.change_type === 'ADDED'
                      ? 'green'
                      : row.change_type ===
                          'REMOVED'
                        ? 'red'
                        : 'amber'
                  }
                />
                <Text
                  style={styles.diffRowTitle}
                >
                  {row.title}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No section changes.
            </Text>
          )}
        </View>

        {compareSelected && (
          <View
            style={[
              styles.diffColumns,
              !desktop &&
                styles.diffColumnsMobile,
            ]}
          >
            <View style={styles.diffColumn}>
              <Text style={styles.diffLabel}>
                PREVIOUS
              </Text>
              <ScrollView
                style={styles.diffScroll}
              >
                <Text style={styles.diffText}>
                  {compareSelected.before_content ??
                    '—'}
                </Text>
              </ScrollView>
            </View>
            <View style={styles.diffColumn}>
              <Text style={styles.diffLabel}>
                PROPOSED
              </Text>
              <ScrollView
                style={styles.diffScroll}
              >
                <Text style={styles.diffText}>
                  {compareSelected.after_content ??
                    '—'}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    ) : null;

  const centerPanel = (
    <View style={styles.centerPanel}>
      {comparePanel ?? (
        <>
          <View style={styles.editorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorEyebrow}>
                {mode === 'EDIT'
                  ? 'DRAFT EDITOR'
                  : 'CANONICAL SECTION'}
              </Text>
              <Text style={styles.editorTitle}>
                {selectedSection?.title ??
                  'Select a section'}
              </Text>
            </View>
            {selectedSection && (
              <StatusPill
                label={
                  selectedSection.visibility_scope
                }
                tone="blue"
              />
            )}
          </View>

          {sectionLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator
                color={colors.green}
              />
              <Text style={styles.emptyText}>
                Loading section…
              </Text>
            </View>
          ) : selectedSection ? (
            mode === 'EDIT' && canEdit ? (
              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={
                  styles.editorContent
                }
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.fieldLabel}>
                  SECTION TITLE
                </Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>
                  CONTROLLED MARKDOWN
                </Text>
                <TextInput
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    styles.markdownEditor,
                  ]}
                />

                <Text style={styles.fieldLabel}>
                  EDIT REASON
                </Text>
                <TextInput
                  value={editReason}
                  onChangeText={setEditReason}
                  placeholder="Why is this section changing?"
                  placeholderTextColor="#91A097"
                  multiline
                  style={[
                    styles.input,
                    styles.reasonInput,
                  ]}
                />

                <View style={styles.inlineActions}>
                  <ActionButton
                    icon="content-save-outline"
                    label="SAVE DRAFT"
                    onPress={() =>
                      void saveSection()
                    }
                    disabled={busy}
                  />
                  <ActionButton
                    icon="eye-outline"
                    label="PREVIEW"
                    onPress={() =>
                      setMode('READ')
                    }
                    secondary
                  />
                </View>
              </ScrollView>
            ) : (
              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={
                  styles.editorContent
                }
              >
                <BuklodCanonicalMarkdown
                  markdown={
                    selectedSection.content_markdown
                  }
                />
              </ScrollView>
            )
          ) : (
            <View style={styles.centerLoading}>
              <Text style={styles.emptyText}>
                No section selected.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  const rightPanel = (
    <View style={styles.rightPanel}>
      {selectedVersion ? (
        <ScrollView
          contentContainerStyle={styles.rightContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.rightEyebrow}>
            CURRENT VIEW
          </Text>
          <Text style={styles.rightVersion}>
            v{selectedVersion.version}
          </Text>

          <View style={styles.pillWrap}>
            <StatusPill
              label={selectedVersion.status}
              tone={
                selectedVersion.status ===
                'EFFECTIVE'
                  ? 'green'
                  : selectedVersion.status ===
                      'APPROVED'
                    ? 'blue'
                    : selectedVersion.status ===
                        'REVIEW'
                      ? 'amber'
                      : 'neutral'
              }
            />
            <StatusPill
              label={
                selectedVersion.risk_level
              }
              tone={
                canonicalRiskNeedsDiff(
                  selectedVersion.risk_level,
                )
                  ? 'red'
                  : 'neutral'
              }
            />
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>
              CURRENT EFFECTIVE VERSION
            </Text>
            <Text style={styles.bannerValue}>
              v{snapshot?.version.version ?? '—'}
            </Text>
            <Text style={styles.bannerMeta}>
              Effective:{' '}
              {compactDate(
                snapshot?.version.effective_at,
              )}
            </Text>
            <Text style={styles.bannerMeta}>
              Implementation:{' '}
              {snapshot?.version.implementation_status ??
                '—'}
            </Text>
          </View>

          {selectedVersion.status !==
            'EFFECTIVE' && (
            <View style={styles.warningCard}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color="#8A6312"
              />
              <Text style={styles.warningText}>
                This is not the current canonical
                version. Draft/review/approved text
                must never be presented as production
                policy.
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>
            CHANGE SUMMARY
          </Text>
          <TextInput
            editable={canEdit}
            value={metadataSummary}
            onChangeText={setMetadataSummary}
            multiline
            style={[
              styles.input,
              styles.smallTextarea,
              !canEdit && styles.readOnlyInput,
            ]}
          />

          <Text style={styles.fieldLabel}>
            AFFECTED MODULES
          </Text>
          <TextInput
            editable={canEdit}
            value={metadataModules}
            onChangeText={setMetadataModules}
            placeholder="Main, Economy, Organization…"
            placeholderTextColor="#91A097"
            style={[
              styles.input,
              !canEdit && styles.readOnlyInput,
            ]}
          />

          <Text style={styles.fieldLabel}>
            RISK
          </Text>
          <View style={styles.choiceWrap}>
            {RISK_LEVELS.map(risk => (
              <Pressable
                key={risk}
                disabled={!canEdit}
                onPress={() =>
                  setMetadataRisk(risk)
                }
                style={[
                  styles.choice,
                  metadataRisk === risk &&
                    styles.choiceOn,
                  !canEdit &&
                    styles.disabledChoice,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    metadataRisk === risk &&
                      styles.choiceTextOn,
                  ]}
                >
                  {risk}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            NOTES / REVIEW NOTES
          </Text>
          <TextInput
            editable={
              canEdit ||
              selectedVersion.status ===
                'REVIEW'
            }
            value={metadataNotes}
            onChangeText={setMetadataNotes}
            multiline
            style={[
              styles.input,
              styles.smallTextarea,
              !canEdit &&
                selectedVersion.status !==
                  'REVIEW' &&
                styles.readOnlyInput,
            ]}
          />

          {canEdit && (
            <>
              <Text style={styles.fieldLabel}>
                METADATA CHANGE REASON
              </Text>
              <TextInput
                value={editReason}
                onChangeText={setEditReason}
                placeholder="Required for metadata save"
                placeholderTextColor="#91A097"
                style={styles.input}
              />
              <ActionButton
                icon="content-save-cog-outline"
                label="SAVE DRAFT METADATA"
                onPress={() =>
                  void saveMetadata()
                }
                disabled={busy}
                secondary
              />
            </>
          )}

          <View style={styles.divider} />

          <Text style={styles.rightEyebrow}>
            IMPLEMENTATION LINK
          </Text>
          <Text style={styles.bannerMeta}>
            Policy approval and runtime implementation
            are deliberately separate.
          </Text>

          <Text style={styles.fieldLabel}>
            IMPLEMENTATION STATUS
          </Text>
          <View style={styles.choiceWrap}>
            {IMPLEMENTATION_STATUSES.map(
              item => (
                <Pressable
                  key={item}
                  disabled={
                    !perms?.can_implementation
                  }
                  onPress={() =>
                    setImplementationStatus(item)
                  }
                  style={[
                    styles.choice,
                    implementationStatus ===
                      item &&
                      styles.choiceOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      implementationStatus ===
                        item &&
                        styles.choiceTextOn,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <Text style={styles.fieldLabel}>
            REFERENCE / IMPLEMENTATION MATCH
          </Text>
          <View style={styles.choiceWrap}>
            {VERIFICATION_STATUSES.map(
              item => (
                <Pressable
                  key={item}
                  disabled={
                    !perms?.can_implementation
                  }
                  onPress={() =>
                    setVerificationStatus(item)
                  }
                  style={[
                    styles.choice,
                    verificationStatus === item &&
                      styles.choiceOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      verificationStatus ===
                        item &&
                        styles.choiceTextOn,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <Text style={styles.fieldLabel}>
            IMPLEMENTATION REF
          </Text>
          <TextInput
            editable={perms?.can_implementation}
            value={implementationRef}
            onChangeText={setImplementationRef}
            placeholder="Commit SHA / release / migration / task"
            placeholderTextColor="#91A097"
            style={[
              styles.input,
              !perms?.can_implementation &&
                styles.readOnlyInput,
            ]}
          />

          {perms?.can_implementation && (
            <>
              <Text style={styles.fieldLabel}>
                IMPLEMENTATION UPDATE REASON
              </Text>
              <TextInput
                value={implementationReason}
                onChangeText={
                  setImplementationReason
                }
                style={styles.input}
              />
              <ActionButton
                icon="source-commit"
                label="UPDATE IMPLEMENTATION"
                onPress={() =>
                  void saveImplementation()
                }
                disabled={busy}
                secondary
              />
            </>
          )}

          <View style={styles.divider} />

          <Text style={styles.rightEyebrow}>
            VERSION HISTORY
          </Text>
          {history.map(version => (
            <Pressable
              key={version.id}
              onPress={() =>
                void selectVersion(
                  version,
                  selectedSection?.section_key,
                )
              }
              style={[
                styles.historyRow,
                selectedVersion.id ===
                  version.id &&
                  styles.historyRowActive,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={styles.historyVersion}
                >
                  v{version.version}
                </Text>
                <Text
                  style={styles.historyMeta}
                >
                  {version.status} •{' '}
                  {compactDate(
                    version.effective_at ??
                      version.created_at,
                  )}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={colors.green}
        />
        <Text style={styles.loadingText}>
          Loading Canonical Reference…
        </Text>
      </View>
    );
  }

  if (!snapshot || !selectedVersion) {
    return (
      <View style={styles.loadingScreen}>
        <MaterialCommunityIcons
          name="book-alert-outline"
          size={40}
          color={colors.greenDark}
        />
        <Text style={styles.loadingText}>
          {notice?.text ??
            'Canonical Reference is unavailable.'}
        </Text>
        <ActionButton
          icon="refresh"
          label="RETRY"
          onPress={() => void loadAll()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.greenDark}
          />
        </Pressable>

        <View style={styles.topTitle}>
          <Text style={styles.topEyebrow}>
            ADMINISTRATION
          </Text>
          <Text style={styles.topHeading}>
            BUKLOD Canonical Reference
          </Text>
        </View>

        <View style={styles.topActions}>
          {perms?.can_draft && (
            <ActionButton
              icon="file-plus-outline"
              label="NEW DRAFT"
              onPress={() => {
                setDraftVersion(
                  nextVersion(
                    snapshot.version.version,
                  ),
                );
                setDraftSummary('');
                setDraftModules('');
                setDraftRisk('NORMAL');
                setDraftNotes('');
                setDraftOpen(true);
              }}
              secondary
            />
          )}

          {canEdit && mode !== 'EDIT' && (
            <ActionButton
              icon="pencil-outline"
              label="EDIT"
              onPress={() =>
                setMode('EDIT')
              }
              secondary
            />
          )}

          {selectedVersion.supersedes_version_id && (
            <ActionButton
              icon="compare"
              label="COMPARE"
              onPress={() =>
                void runCompare()
              }
              secondary
            />
          )}

          {selectedVersion.status ===
            'DRAFT' &&
            perms?.can_review && (
              <ActionButton
                icon="send-outline"
                label="SUBMIT REVIEW"
                onPress={() =>
                  void submitReview()
                }
                disabled={busy}
              />
            )}

          {selectedVersion.status ===
            'REVIEW' &&
            perms?.can_approve && (
              <>
                <ActionButton
                  icon="close-circle-outline"
                  label="REJECT"
                  onPress={() =>
                    void reviewDecision(false)
                  }
                  danger
                  disabled={busy}
                />
                <ActionButton
                  icon="check-circle-outline"
                  label="APPROVE"
                  onPress={() =>
                    void reviewDecision(true)
                  }
                  disabled={busy}
                />
              </>
            )}

          {selectedVersion.status ===
            'APPROVED' &&
            perms?.can_publish && (
              <ActionButton
                icon="publish"
                label="PUBLISH"
                onPress={publish}
                disabled={busy}
              />
            )}
        </View>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons
          name="magnify"
          size={19}
          color={colors.muted}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder='Search "7%", referral, Sub-Org, Quiz, BSOC…'
          placeholderTextColor="#89968F"
          style={styles.searchInput}
        />
        {searching && (
          <ActivityIndicator
            size="small"
            color={colors.green}
          />
        )}
        <View style={styles.historyToggle}>
          <Switch
            value={includeHistory}
            onValueChange={setIncludeHistory}
          />
          <Text style={styles.historyToggleText}>
            Include history
          </Text>
        </View>
        <Pressable
          onPress={() =>
            void copySection()
          }
          disabled={!selectedSection}
          style={styles.copyButton}
        >
          <MaterialCommunityIcons
            name="content-copy"
            size={16}
            color={colors.greenDark}
          />
          <Text style={styles.copyText}>
            Copy Section
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void copyAll()}
          style={styles.copyButton}
        >
          <MaterialCommunityIcons
            name="file-export-outline"
            size={16}
            color={colors.greenDark}
          />
          <Text style={styles.copyText}>
            Copy Current Rules
          </Text>
        </Pressable>
      </View>

      {!!search.trim() && (
        <View style={styles.searchResults}>
          {searchResults.length ? (
            searchResults.map(result => (
              <Pressable
                key={`${result.version_id}:${result.section_key}`}
                onPress={() =>
                  void openSearchResult(result)
                }
                style={styles.searchResult}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.searchResultTitle}
                  >
                    {result.section_title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={styles.searchExcerpt}
                  >
                    {result.excerpt}
                  </Text>
                </View>
                <View style={styles.searchBadges}>
                  <StatusPill
                    label={`v${result.version}`}
                  />
                  <StatusPill
                    label={
                      result.version_status
                    }
                    tone={
                      result.version_status ===
                        'EFFECTIVE'
                        ? 'green'
                        : 'neutral'
                    }
                  />
                </View>
              </Pressable>
            ))
          ) : !searching ? (
            <Text style={styles.emptyText}>
              No matching canonical rule.
            </Text>
          ) : null}
        </View>
      )}

      {notice && (
        <View
          style={[
            styles.notice,
            notice.tone === 'success' &&
              styles.noticeSuccess,
            notice.tone === 'warning' &&
              styles.noticeWarning,
            notice.tone === 'error' &&
              styles.noticeError,
          ]}
        >
          <Text style={styles.noticeText}>
            {notice.text}
          </Text>
          <Pressable
            onPress={() => setNotice(null)}
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={colors.text}
            />
          </Pressable>
        </View>
      )}

      {draftOpen && (
        <View style={styles.draftPanel}>
          <View style={styles.draftHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorEyebrow}>
                CREATE NEW VERSION
              </Text>
              <Text style={styles.editorTitle}>
                Draft from v
                {selectedVersion.version}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                setDraftOpen(false)
              }
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.greenDark}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.draftGrid,
              !desktop &&
                styles.draftGridMobile,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                NEW VERSION
              </Text>
              <TextInput
                value={draftVersion}
                onChangeText={setDraftVersion}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.fieldLabel}>
                WHAT CHANGED / WHY
              </Text>
              <TextInput
                value={draftSummary}
                onChangeText={setDraftSummary}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.fieldLabel}>
                AFFECTED MODULES
              </Text>
              <TextInput
                value={draftModules}
                onChangeText={setDraftModules}
                placeholder="Comma-separated"
                placeholderTextColor="#91A097"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.choiceWrap}>
            {RISK_LEVELS.map(risk => (
              <Pressable
                key={risk}
                onPress={() =>
                  setDraftRisk(risk)
                }
                style={[
                  styles.choice,
                  draftRisk === risk &&
                    styles.choiceOn,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    draftRisk === risk &&
                      styles.choiceTextOn,
                  ]}
                >
                  {risk}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={draftNotes}
            onChangeText={setDraftNotes}
            placeholder="Optional notes"
            placeholderTextColor="#91A097"
            style={styles.input}
          />

          <View style={styles.inlineActions}>
            <ActionButton
              icon="file-plus-outline"
              label="CREATE DRAFT"
              onPress={() =>
                void createDraft()
              }
              disabled={busy}
            />
            <ActionButton
              icon="close"
              label="CANCEL"
              onPress={() =>
                setDraftOpen(false)
              }
              secondary
            />
          </View>
        </View>
      )}

      <View
        style={[
          styles.workspace,
          !desktop &&
            styles.workspaceMobile,
        ]}
      >
        {leftPanel}
        {centerPanel}
        {rightPanel}
      </View>
    </View>
  );
}

export default function CanonicalReferenceScreen() {
  return (
    <CanonicalReferenceGate>
      <ReferenceCenterBody />
    </CanonicalReferenceGate>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F5F3',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F2F5F3',
  },
  loadingText: {
    color: colors.muted,
    textAlign: 'center',
  },
  topbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE5E0',
    backgroundColor: '#FFFFFF',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4F0',
  },
  topTitle: {
    flex: 1,
    minWidth: 180,
  },
  topEyebrow: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  topHeading: {
    marginTop: 2,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  action: {
    minHeight: 36,
    borderRadius: 9,
    backgroundColor: colors.greenDark,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8D8CF',
  },
  actionDanger: {
    backgroundColor: '#9C3C3C',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  actionTextSecondary: {
    color: colors.greenDark,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  searchBar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE5E0',
    backgroundColor: '#FAFBFA',
  },
  searchInput: {
    flex: 1,
    minWidth: 180,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#D4DED8',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    color: colors.text,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyToggleText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  copyButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#CFDDD4',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  copyText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  searchResults: {
    maxHeight: 270,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE5E0',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  searchResult: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8E4',
  },
  searchResultTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  searchExcerpt: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 14,
  },
  searchBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  notice: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EAF0EC',
    borderBottomWidth: 1,
    borderBottomColor: '#D6E0DA',
  },
  noticeSuccess: {
    backgroundColor: '#E8F5EC',
  },
  noticeWarning: {
    backgroundColor: '#FFF5D9',
  },
  noticeError: {
    backgroundColor: '#FCEAEA',
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
  },
  workspaceMobile: {
    flexDirection: 'column',
  },
  leftPanel: {
    width: 250,
    minWidth: 220,
    maxWidth: 280,
    backgroundColor: '#F8FAF8',
    borderRightWidth: 1,
    borderRightColor: '#DCE5E0',
  },
  leftHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8E4',
  },
  leftEyebrow: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  leftTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  leftScroll: {
    flex: 1,
  },
  leftContent: {
    padding: 7,
    gap: 2,
  },
  sectionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 9,
  },
  sectionRowActive: {
    backgroundColor: '#E8F2EC',
  },
  sectionNo: {
    width: 25,
    color: '#819087',
    fontSize: 9,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#52635A',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
  },
  sectionTitleActive: {
    color: colors.greenDark,
  },
  sectionKey: {
    marginTop: 1,
    color: '#96A199',
    fontSize: 8.5,
  },
  centerPanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  editorHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E7E3',
  },
  editorEyebrow: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  editorTitle: {
    marginTop: 3,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    padding: 18,
    paddingBottom: 90,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  rightPanel: {
    width: 310,
    minWidth: 280,
    maxWidth: 340,
    backgroundColor: '#F8FAF8',
    borderLeftWidth: 1,
    borderLeftColor: '#DCE5E0',
  },
  rightContent: {
    padding: 12,
    paddingBottom: 70,
    gap: 8,
  },
  rightEyebrow: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rightVersion: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 999,
    backgroundColor: '#E9EEEB',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillGreen: {
    backgroundColor: '#DCF2E3',
  },
  pillAmber: {
    backgroundColor: '#FFF0C7',
  },
  pillRed: {
    backgroundColor: '#F7DADA',
  },
  pillBlue: {
    backgroundColor: '#DCEAF5',
  },
  pillText: {
    color: '#33463D',
    fontSize: 8.5,
    fontWeight: '900',
  },
  banner: {
    marginTop: 4,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CADACF',
    backgroundColor: '#EEF6F1',
    padding: 10,
  },
  bannerLabel: {
    color: colors.greenDark,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bannerValue: {
    marginTop: 2,
    color: colors.greenDark,
    fontSize: 17,
    fontWeight: '900',
  },
  bannerMeta: {
    marginTop: 2,
    color: '#52675D',
    fontSize: 10,
    lineHeight: 14,
  },
  warningCard: {
    flexDirection: 'row',
    gap: 7,
    borderRadius: 10,
    backgroundColor: '#FFF5D9',
    padding: 9,
  },
  warningText: {
    flex: 1,
    color: '#6F591F',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  fieldLabel: {
    marginTop: 5,
    color: '#687870',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#D4DED8',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 12,
  },
  readOnlyInput: {
    backgroundColor: '#F0F3F1',
    color: '#66736C',
  },
  markdownEditor: {
    minHeight: 420,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  reasonInput: {
    minHeight: 70,
  },
  smallTextarea: {
    minHeight: 68,
  },
  inlineActions: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  choice: {
    minHeight: 27,
    borderWidth: 1,
    borderColor: '#D2DDD6',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: {
    backgroundColor: '#E6F1E9',
    borderColor: colors.green,
  },
  disabledChoice: {
    opacity: 0.6,
  },
  choiceText: {
    color: '#5E6E65',
    fontSize: 8.5,
    fontWeight: '900',
  },
  choiceTextOn: {
    color: colors.greenDark,
  },
  divider: {
    height: 1,
    marginVertical: 6,
    backgroundColor: '#DCE5E0',
  },
  historyRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  historyRowActive: {
    backgroundColor: '#E7F1EA',
  },
  historyVersion: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  historyMeta: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 8.5,
  },
  compareRoot: {
    flex: 1,
    minHeight: 0,
  },
  compareHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E7E3',
  },
  diffList: {
    maxHeight: 190,
    padding: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E7E3',
  },
  diffRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  diffRowActive: {
    backgroundColor: '#EEF4F0',
  },
  diffRowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  diffColumns: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
  },
  diffColumnsMobile: {
    flexDirection: 'column',
  },
  diffColumn: {
    flex: 1,
    minWidth: 0,
    borderRightWidth:
      StyleSheet.hairlineWidth,
    borderRightColor: '#DEE5E1',
    padding: 10,
  },
  diffLabel: {
    marginBottom: 6,
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  diffScroll: {
    flex: 1,
  },
  diffText: {
    color: '#33463D',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  draftPanel: {
    borderBottomWidth: 1,
    borderBottomColor: '#D8E1DB',
    backgroundColor: '#F8FBF9',
    padding: 12,
    gap: 8,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  draftGridMobile: {
    flexDirection: 'column',
  },
});
