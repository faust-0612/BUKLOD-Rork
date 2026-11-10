import React, {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_SMART_DRAWER_SETTINGS,
  loadSmartDrawerSettings,
  saveSmartDrawerSettings,
  type SmartDrawerReminderStyle,
  type SmartDrawerSettings,
} from '@/lib/smartDrawer/settings';
import { useAuth } from '@/providers/AuthProvider';
import { generateSmartDrawerRecoveryKey, shareSmartDrawerBackup, restoreSmartDrawerBackup } from '@/lib/smartDrawer/portableBackup';
import * as Clipboard from 'expo-clipboard';

const STYLES: Array<{
  key: SmartDrawerReminderStyle;
  title: string;
  description: string;
}> = [
  {
    key: 'MINIMAL',
    title: 'Minimal',
    description: 'Due-time reminder only.',
  },
  {
    key: 'NORMAL',
    title: 'Normal',
    description: 'Advance reminder plus due-time reminder when useful.',
  },
  {
    key: 'PERSISTENT',
    title: 'Persistent',
    description: 'Adds an earlier reminder for important upcoming dates without repeating endlessly.',
  },
];

const RETENTION = [7, 14, 30, 60, 90] as const;

export default function SmartDrawerSettingsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] =
    useState<SmartDrawerSettings>(
      DEFAULT_SMART_DRAWER_SETTINGS,
    );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user?.id) {
        setLoading(false);
        return () => {
          active = false;
        };
      }

      setLoading(true);
      void loadSmartDrawerSettings(user.id)
        .then(next => {
          if (active) setSettings(next);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNotice, setBackupNotice] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');

  const prepareKey = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupNotice('');
    try {
      const key = await generateSmartDrawerRecoveryKey();
      setRecoveryKey(key);
      setBackupNotice('New recovery key generated. Copy it and store it separately from your cloud backup. Losing this key means the archive cannot be restored.');
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : 'Could not generate a recovery key.');
    } finally {
      setBackupBusy(false);
    }
  };

  const exportBackup = () => {
    if (!user?.id || backupBusy) return;
    if (!/^[a-fA-F0-9]{64}$/.test(recoveryKey.trim())) {
      setBackupNotice('Generate and safely copy a 64-character recovery key before exporting.');
      return;
    }
    Alert.alert(
      'Export encrypted backup?',
      'Your archive is encrypted with AES-GCM and the key shown on this screen. BUKLOD cannot recover a lost key. Save the key somewhere different from your cloud backup. Only export to your private cloud storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          setBackupBusy(true);
          setBackupNotice('');
          void shareSmartDrawerBackup(user.id, recoveryKey.trim())
            .then(({ count }) => setBackupNotice(`${count} encrypted notes prepared for sharing. Confirm in your cloud app that upload completed. Keep your recovery key safely.`))
            .catch(error => setBackupNotice(error instanceof Error ? error.message : 'Backup failed. Your notes remain on this phone.'))
            .finally(() => setBackupBusy(false));
        } },
      ],
    );
  };

  const importBackup = () => {
    if (!user?.id || backupBusy) return;
    if (!/^[a-fA-F0-9]{64}$/.test(recoveryKey.trim())) {
      setBackupNotice('Paste the original 64-character recovery key before restoring.');
      return;
    }
    Alert.alert(
      'Restore encrypted backup?',
      'Select the backup file from your cloud provider using the file picker. This must belong to the same BUKLOD account. Existing notes are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose Backup', onPress: () => {
          setBackupBusy(true);
          setBackupNotice('');
          void restoreSmartDrawerBackup(user.id, recoveryKey.trim())
            .then(result => {
              if (!result.canceled) setBackupNotice(`Restored ${result.restored} notes. Skipped ${result.skipped} existing notes.`);
            })
            .catch(error => setBackupNotice(error instanceof Error ? error.message : 'Restore failed.'))
            .finally(() => setBackupBusy(false));
        } },
      ],
    );
  };

  const save = async () => {
    if (!user?.id || busy) return;

    setBusy(true);
    setNotice('');
    try {
      const next =
        await saveSmartDrawerSettings(
          user.id,
          settings,
        );
      setSettings(next);
      setNotice('Drawer settings saved on this account.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not save Drawer settings.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/drawer' as any)
          }
          accessibilityLabel="Back"
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#173B63"
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Drawer Settings
          </Text>
          <Text style={styles.headerSub}>
            Private, local-first preferences
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#0A6EBD" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Math.max(28, insets.bottom + 20),
            },
          ]}
        >
          <Text style={styles.sectionTitle}>My Storage & Backup</Text>
          <Text style={styles.sectionHint}>
            Local Only is always free. Your files stay on this device. Optional backup uses your own Google Drive, OneDrive, Dropbox or other file provider through the phone share sheet — BUKLOD does not host these files.
          </Text>
          <View style={styles.privacy}>
            <MaterialCommunityIcons name="cellphone" size={24} color="#0A6EBD" />
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>Local Only (default)</Text>
              <Text style={styles.privacyText}>
                Works offline. Uninstalling or clearing app data can erase local notes. Portable backups are manual, not real-time sync.
              </Text>
            </View>
          </View>
          {Platform.OS === 'web' ? (
            <Text style={styles.sectionHint}>Portable backup and restore require the Android/iOS app.</Text>
          ) : (
            <>
              <Pressable onPress={() => void prepareKey()} disabled={backupBusy} style={styles.option}>
                <MaterialCommunityIcons name="key-variant" size={24} color="#0A6EBD" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Generate New Recovery Key</Text>
                  <Text style={styles.optionText}>Needed to encrypt a new backup. Copy and keep it securely outside the backup folder.</Text>
                </View>
              </Pressable>
              <TextInput
                value={recoveryKey}
                onChangeText={setRecoveryKey}
                placeholder="Paste 64-character backup recovery key"
                placeholderTextColor="#7D94A6"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                selectTextOnFocus
                style={[styles.option, { minHeight: 68, color: '#173B63', fontSize: 12 }]}
              />
              {!!recoveryKey && <Pressable onPress={() => void Clipboard.setStringAsync(recoveryKey)} style={styles.option}>
                <MaterialCommunityIcons name="content-copy" size={21} color="#0A6EBD" />
                <Text style={styles.optionTitle}>Copy Recovery Key</Text>
              </Pressable>}
              <Pressable onPress={exportBackup} disabled={backupBusy} style={styles.option}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color="#0A6EBD" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Back Up to My Own Cloud</Text>
                  <Text style={styles.optionText}>Exports up to 20 MB including files. Select your personal cloud app. AES-GCM encrypted file. Back up to your private folder and store the recovery key separately.</Text>
                </View>
              </Pressable>
              <Pressable onPress={importBackup} disabled={backupBusy} style={styles.option}>
                <MaterialCommunityIcons name="cloud-download-outline" size={24} color="#0A6EBD" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Restore My Backup</Text>
                  <Text style={styles.optionText}>Select a previously exported BUKLOD backup file. Additive restore; existing notes are preserved.</Text>
                </View>
              </Pressable>
              {backupBusy && <ActivityIndicator color="#0A6EBD" />}
              {!!backupNotice && <Text style={styles.notice}>{backupNotice}</Text>}
            </>
          )}

          <Text style={styles.sectionTitle}>
            Reminder Style
          </Text>
          <Text style={styles.sectionHint}>
            BUKLOD detects meaningful dates automatically. You do not need to create reminders manually.
          </Text>

          {STYLES.map(option => {
            const selected =
              settings.reminderStyle === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() =>
                  setSettings(current => ({
                    ...current,
                    reminderStyle: option.key,
                  }))
                }
                style={[
                  styles.option,
                  selected && styles.optionSelected,
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    selected
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={21}
                  color={
                    selected
                      ? '#0A6EBD'
                      : '#7F97AA'
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>
                    {option.title}
                  </Text>
                  <Text style={styles.optionText}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.sectionTitle}>
            Recently Removed
          </Text>
          <Text style={styles.sectionHint}>
            Only items you have already moved to Recently Removed can be permanently cleaned after this window. Writing, poems, ideas, overdue tasks and uncertain active content are not age-deleted.
          </Text>

          <View style={styles.retentionRow}>
            {RETENTION.map(days => {
              const selected =
                settings.recentlyRemovedRetentionDays ===
                days;
              return (
                <Pressable
                  key={days}
                  onPress={() =>
                    setSettings(current => ({
                      ...current,
                      recentlyRemovedRetentionDays:
                        days,
                    }))
                  }
                  style={[
                    styles.retention,
                    selected &&
                      styles.retentionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.retentionText,
                      selected &&
                        styles.retentionTextSelected,
                    ]}
                  >
                    {days}d
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.privacy}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={24}
              color="#0A6EBD"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>
                Private by default
              </Text>
              <Text style={styles.privacyText}>
                Drawer content is scoped to your signed-in BUKLOD account. Organization admins, school/employer/church admins, Community Wall users and ordinary BSOC operators do not receive your private notes.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/help?category=TECHNICAL&sourceRoute=%2Fdrawer%2Fsettings' as any,
              )
            }
            style={styles.help}
          >
            <MaterialCommunityIcons
              name="lifebuoy"
              size={21}
              color="#0A6EBD"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.helpTitle}>
                Help & Support
              </Text>
              <Text style={styles.helpText}>
                Run BUKLOD Help with privacy-safe Drawer diagnostics. Your private notes and images are not attached.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#7D94A6"
            />
          </Pressable>

          {!!notice && (
            <Text style={styles.notice}>
              {notice}
            </Text>
          )}

          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[
              styles.save,
              busy && { opacity: 0.55 },
            ]}
          >
            {busy && (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            )}
            <Text style={styles.saveText}>
              {busy ? 'Saving…' : 'Save Settings'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F9FD',
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DFE8F0',
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#173B63',
    fontSize: 17,
    fontWeight: '900',
  },
  headerSub: {
    marginTop: 2,
    color: '#778C9D',
    fontSize: 10,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 14,
  },
  sectionTitle: {
    marginTop: 8,
    color: '#173B63',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 9,
    color: '#6F8496',
    fontSize: 10.5,
    lineHeight: 16,
  },
  option: {
    marginBottom: 7,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE7F0',
    backgroundColor: '#FFFFFF',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  optionSelected: {
    backgroundColor: '#EAF4FC',
    borderColor: '#8FBBDB',
  },
  optionTitle: {
    color: '#294D69',
    fontWeight: '900',
    fontSize: 11.5,
  },
  optionText: {
    marginTop: 2,
    color: '#718698',
    fontSize: 9.5,
    lineHeight: 14,
  },
  retentionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  retention: {
    minWidth: 48,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E2EC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  retentionSelected: {
    backgroundColor: '#0B70C9',
    borderColor: '#0B70C9',
  },
  retentionText: {
    color: '#5F788C',
    fontSize: 10,
    fontWeight: '900',
  },
  retentionTextSelected: {
    color: '#FFFFFF',
  },
  privacy: {
    marginTop: 20,
    borderRadius: 15,
    backgroundColor: '#EAF4FC',
    padding: 13,
    flexDirection: 'row',
    gap: 10,
  },
  privacyTitle: {
    color: '#173B63',
    fontWeight: '900',
    fontSize: 12,
  },
  privacyText: {
    marginTop: 3,
    color: '#587188',
    fontSize: 10,
    lineHeight: 15,
  },
  help: {
    marginTop: 16,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E5EE',
    backgroundColor: '#FFFFFF',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  helpTitle: {
    color: '#294D69',
    fontSize: 11.5,
    fontWeight: '900',
  },
  helpText: {
    marginTop: 2,
    color: '#718698',
    fontSize: 9.5,
    lineHeight: 14,
  },
  notice: {
    marginTop: 12,
    color: '#315873',
    fontSize: 10.5,
    lineHeight: 15,
  },
  save: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0B70C9',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
