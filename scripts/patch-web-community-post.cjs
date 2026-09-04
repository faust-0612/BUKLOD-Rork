const fs = require('node:fs');

const file = 'src/components/BuklodExclusiveScopeCommunity.tsx';
let source = fs.readFileSync(file, 'utf8');

function fail(message) {
  throw new Error(`[BUKLOD WEB COMMUNITY POST] ${message}`);
}

const publishStart = source.indexOf('  const publish =');
const publishEnd = source.indexOf('\n  const react =', publishStart);

if (publishStart < 0 || publishEnd < 0) {
  fail('Could not locate the scoped Community publish function.');
}

let publishChunk = source.slice(publishStart, publishEnd);
const busyOld = "      setBody('');\n      clearMedia();\n      setBusy(false);\n      setPublishNotice(";
const busyNew = "      setBody('');\n      clearMedia();\n      setBusy(true);\n      setPublishNotice(";

if (publishChunk.includes(busyOld)) {
  publishChunk = publishChunk.replace(busyOld, busyNew);
  source = source.slice(0, publishStart) + publishChunk + source.slice(publishEnd);
} else if (!publishChunk.includes(busyNew)) {
  fail('Publish busy-state anchor changed; refusing an unsafe web export.');
}

const publishPressMarker = "onPress={() =>\n              void publish()\n            }";
const markerIndex = source.indexOf(publishPressMarker);

if (markerIndex < 0) {
  fail('Could not locate the scoped Community Post button.');
}

const openStart = source.lastIndexOf('<Pressable', markerIndex);
const openEndMarker = '\n          >';
const openEndStart = source.indexOf(openEndMarker, markerIndex);

if (openStart < 0 || openEndStart < 0) {
  fail('Could not isolate the scoped Community Post button opening tag.');
}

const fixedOpening = `<Pressable
            disabled={busy}
            onPress={() =>
              void publish()
            }
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'reels'
                ? 'Publish Reel'
                : 'Post to this community'
            }
            style={[
              styles.publish,
              busy &&
                styles.publishDisabled,
            ]}
          >`;

source =
  source.slice(0, openStart) +
  fixedOpening +
  source.slice(openEndStart + openEndMarker.length);

if (!source.includes("clearMedia();\n      setBusy(true);\n      setPublishNotice(")) {
  fail('Busy-state fix verification failed.');
}
if (!source.includes('disabled={busy}')) {
  fail('Post-button enabled-state fix verification failed.');
}
if (!source.includes(': \'Post to this community\'')) {
  fail('Post-button accessibility verification failed.');
}

fs.writeFileSync(file, source, 'utf8');
console.log('BUKLOD web scoped Community Post hotfix applied and verified.');

/*
 * PATCH_20260904_WEB_SCOPED_GUIDE_PROFILE_EXIT
 *
 * On desktop web the floating illustrated guide/avatar is mounted outside the
 * routed scope screen. The old handler opened /me with returnScopeId and also
 * dismissed the router stack. That return-mode contract can put the guide back
 * into the Cluster workspace instead of leaving the scoped environment cleanly.
 *
 * Web rule: tapping the guide/avatar from /scope always means My BUKLOD.
 * Restore PUBLIC first, then replace the scoped route with /me. Do not carry a
 * returnScopeId and do not dismiss the stack. Native source remains unchanged;
 * this patch is applied only by the production web export workflow.
 */
const guideFile = 'src/components/BuklodGuideAvatar.tsx';
let guideSource = fs.readFileSync(guideFile, 'utf8');
const guideStartMarker = '  /* PATCH_167I_AVATAR_IS_PROFILE */';
const guideEndMarker = '  const badgeText =';
const guideStart = guideSource.indexOf(guideStartMarker);
const guideEnd = guideSource.indexOf(guideEndMarker, guideStart);

if (guideStart < 0 || guideEnd < 0) {
  fail('Could not locate the BUKLOD Guide avatar profile handler.');
}

const fixedGuideHandler = `  /* PATCH_167I_AVATAR_IS_PROFILE */
  /* PATCH_20260904_WEB_SCOPED_GUIDE_PROFILE_EXIT */
  const onPress = () => {
    animateTap();
    scheduleGuideHide(3600);

    const openingProfileFromScopedWorkspace =
      !isProfileRoute &&
      scopedWorkspaceActive &&
      isBuklodScopedWorkspacePath(
        pathname
      );

    if (openingProfileFromScopedWorkspace) {
      void (async () => {
        const publicScope =
          scopes.find(
            (scope) =>
              scope.scope_type ===
              'PUBLIC'
          );

        if (publicScope) {
          try {
            await selectScope(
              publicScope.scope_id
            );
          } catch (error) {
            console.warn(
              'BUKLOD web guide public scope reset:',
              error
            );
          }
        }

        router.replace(
          '/me' as any
        );
      })();

      return;
    }

    router.navigate(
      '/me' as any
    );
  };
`;

guideSource =
  guideSource.slice(0, guideStart) +
  fixedGuideHandler +
  guideSource.slice(guideEnd);

if (!guideSource.includes('PATCH_20260904_WEB_SCOPED_GUIDE_PROFILE_EXIT')) {
  fail('Guide avatar profile-exit marker verification failed.');
}
if (!guideSource.includes("router.replace(\n          '/me' as any")) {
  fail('Guide avatar /me replacement verification failed.');
}

fs.writeFileSync(guideFile, guideSource, 'utf8');
console.log('BUKLOD web scoped Guide avatar -> My BUKLOD exit applied and verified.');
