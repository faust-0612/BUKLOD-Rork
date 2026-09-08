from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "app.config.js",
    "  const appTarget = (process.env.BUKLOD_APP_TARGET || 'main').trim().toLowerCase();\n  const isClassroom = appTarget === 'classroom';",
    "  /* BUKLOD_CLASSROOM_SOURCE_LOCK_R5 — protected Classroom source cannot silently become Main. */\n  const appTarget = (process.env.BUKLOD_APP_TARGET || 'classroom').trim().toLowerCase();\n  if (appTarget !== 'classroom') {\n    throw new Error('BUKLOD Classroom source lock: refusing a non-Classroom build target.');\n  }\n  const isClassroom = true;",
)

Path("src/lib/appTarget.ts").write_text("""import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

const rawTarget = String(
  Constants.expoConfig?.extra?.appTarget ?? 'main'
).trim().toLowerCase();

export const buklodAppTarget: BuklodAppTarget =
  rawTarget === 'classroom' ? 'classroom' : 'main';

export const isClassroomApp = buklodAppTarget === 'classroom';
export const buklodAppDisplayName = isClassroomApp ? 'BUKLOD Classroom' : 'BUKLOD';
""")

replace_once(
    "src/app/index.tsx",
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';",
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\nimport { isClassroomApp } from '@/lib/appTarget';",
)
replace_once(
    "src/app/index.tsx",
    "  useEffect(() => {\n    if (\n      !session?.user?.id ||",
    "  useEffect(() => {\n    if (isClassroomApp) {\n      setBootReady(Boolean(session?.user?.id));\n      return;\n    }\n\n    if (\n      !session?.user?.id ||",
)
replace_once(
    "src/app/index.tsx",
    '  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;\n\n  /*',
    '  if (requiresAcceptance) return <Redirect href="/privacy/consent" />;\n  if (isClassroomApp) return <Redirect href="/classroom" />;\n\n  /*',
)

replace_once(
    "src/app/(tabs)/_layout.tsx",
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';",
    "import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';\nimport { isClassroomApp } from '@/lib/appTarget';",
)
replace_once(
    "src/app/(tabs)/_layout.tsx",
    "  useEffect(() => {\n    warmBuklodInterstitial();\n  }, []);",
    "  useEffect(() => {\n    if (!isClassroomApp) {\n      warmBuklodInterstitial();\n    }\n  }, []);",
)
replace_once(
    "src/app/(tabs)/_layout.tsx",
    '  if (requiresAcceptance) {\n    return <Redirect href="/privacy/consent" />;\n  }\n\n  const hasCommunityAccess =',
    '  if (requiresAcceptance) {\n    return <Redirect href="/privacy/consent" />;\n  }\n  if (isClassroomApp) {\n    return <Redirect href="/classroom" />;\n  }\n\n  const hasCommunityAccess =',
)

replace_once(
    "src/app/(auth)/login.tsx",
    "} from '@/components/HomeMotion';",
    "} from '@/components/HomeMotion';\nimport { isClassroomApp } from '@/lib/appTarget';",
)
replace_once(
    "src/app/(auth)/login.tsx",
    "    router.replace(\n      '/(tabs)/home'\n    );",
    "    router.replace(\n      isClassroomApp\n        ? '/classroom'\n        : '/(tabs)/home'\n    );",
)
replace_once(
    "src/app/(auth)/login.tsx",
    "              source={require('../../../assets/release/buklod-generic-photo.jpg')}",
    "              source={\n                isClassroomApp\n                  ? require('../../../assets/classroom/app-icon.png')\n                  : require('../../../assets/release/buklod-generic-photo.jpg')\n              }",
)
replace_once(
    "src/app/(auth)/login.tsx",
    "            <Text style={styles.title}>BUKLOD</Text>",
    "            <Text style={styles.title}>\n              {isClassroomApp ? 'BUKLOD Classroom' : 'BUKLOD'}\n            </Text>",
)
replace_once(
    "src/app/(auth)/login.tsx",
    "            <Text style={styles.tagline}>\n              Samahang Binuklod ng Pag-ibig\n            </Text>",
    "            <Text style={styles.tagline}>\n              {isClassroomApp\n                ? 'Classes • Faculty • Students • One BUKLOD Login'\n                : 'Samahang Binuklod ng Pag-ibig'}\n            </Text>",
)

Path("src/app/classroom").mkdir(parents=True, exist_ok=True)
Path("src/app/classroom/index.tsx").write_text("""import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { isClassroomApp } from '@/lib/appTarget';

export default function ClassroomAppHome() {
  const { session, loading, profile } = useAuth();
  if (!isClassroomApp) return <Redirect href="/" />;
  if (loading && !session) return <View style={styles.loading}><Text style={styles.loadingText}>Opening BUKLOD Classroom...</Text></View>;
  if (!session) return <Redirect href="/(auth)/login" />;

  const displayName = String(profile?.full_name || profile?.display_name || profile?.username || 'BUKLOD Learner');
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/(auth)/login'); };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <Image source={require('../../../assets/classroom/app-icon.png')} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>STANDALONE LEARNING APP</Text>
          <Text style={styles.title}>BUKLOD Classroom</Text>
          <Text style={styles.subtitle}>Welcome, {displayName}</Text>
        </View>
      </View>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="google-classroom" size={34} color="#1f7a3f" />
        <Text style={styles.heroTitle}>Dedicated Classroom experience</Text>
        <Text style={styles.heroText}>Classes, live sessions, attendance, activities, submissions, materials, grading and results stay inside Classroom. Your BUKLOD account remains shared intentionally.</Text>
      </View>
      <Pressable style={styles.card} onPress={() => router.push('/profile/buklod-classrooms' as any)}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name="account-school-outline" size={28} color="#1f7a3f" /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>My Classroom</Text><Text style={styles.cardText}>Student classes, discussions, live sessions, activities, materials and grades.</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#7d8b81" />
      </Pressable>
      <Pressable style={styles.card} onPress={() => router.push('/profile/buklod-faculty' as any)}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name="teach" size={28} color="#1f7a3f" /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Faculty</Text><Text style={styles.cardText}>Classes, roster, attendance, assessments, grading, files and live teaching.</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#7d8b81" />
      </Pressable>
      <Text style={styles.integration}>BUKLOD ecosystem account • Classroom-specific app identity</Text>
      <Pressable style={styles.signOut} onPress={() => void signOut()}><MaterialCommunityIcons name="logout" size={18} color="#6d2f2f" /><Text style={styles.signOutText}>Sign out</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f2f6f1'}, content:{width:'100%',maxWidth:760,alignSelf:'center',padding:20,paddingTop:42,paddingBottom:64},
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f2f6f1'}, loadingText:{color:'#526159',fontWeight:'800'},
  brandRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}, logo:{width:72,height:72,borderRadius:20}, eyebrow:{color:'#1f7a3f',fontSize:10,fontWeight:'900',letterSpacing:1.2},
  title:{color:'#17311f',fontSize:30,fontWeight:'900',marginTop:2}, subtitle:{color:'#68736b',marginTop:3}, hero:{backgroundColor:'#fff',borderRadius:24,padding:20,marginBottom:14},
  heroTitle:{color:'#17311f',fontSize:20,fontWeight:'900',marginTop:10}, heroText:{color:'#68736b',lineHeight:20,marginTop:6}, card:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#fff',borderRadius:20,padding:16,marginBottom:11},
  cardIcon:{width:50,height:50,borderRadius:15,backgroundColor:'#e7f4e9',alignItems:'center',justifyContent:'center'}, cardTitle:{color:'#203328',fontSize:17,fontWeight:'900'}, cardText:{color:'#6b776e',lineHeight:18,marginTop:3},
  integration:{textAlign:'center',color:'#7b877e',fontSize:11,fontWeight:'700',marginTop:16}, signOut:{alignSelf:'center',flexDirection:'row',gap:7,alignItems:'center',padding:12,marginTop:8}, signOutText:{color:'#6d2f2f',fontWeight:'800'}
});
""")

replace_once(
    "src/app/+html.tsx",
    '        <meta charSet="utf-8" />',
    '        <meta charSet="utf-8" />\n        <title>BUKLOD Classroom</title>\n        <meta name="application-name" content="BUKLOD Classroom" />',
)

Path("scripts/verify-classroom-identity.mjs").write_text("""import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.BUKLOD_APP_TARGET='classroom';
process.env.APP_VARIANT=process.env.APP_VARIANT||'production';
process.env.EXPO_PUBLIC_APP_ENV=process.env.EXPO_PUBLIC_APP_ENV||'production';
process.env.CLASSROOM_GOOGLE_SERVICES_FILE=process.env.CLASSROOM_GOOGLE_SERVICES_FILE||'./google-services.classroom.json';
const profile=String(process.env.EAS_BUILD_PROFILE||'');
if(profile && !profile.startsWith('classroom-')) throw new Error(`Classroom source refused EAS profile ${profile}`);
const config=require('../app.config.js')({config:{extra:{}}});
assert.equal(config.name,'BUKLOD Classroom');
assert.equal(config.slug,'buklod-classroom');
assert.equal(config.scheme,'buklod-classroom');
assert.equal(config.android.package,'org.mzbministry.buklod.classroom');
assert.equal(config.extra.appTarget,'classroom');
assert.equal(config.extra.eas.projectId,'14100ed1-7f25-4551-9627-09d280498241');
assert.equal(config.icon,'./assets/classroom/app-icon.png');
assert.equal(config.android.adaptiveIcon.foregroundImage,'./assets/classroom/adaptive-icon.png');
assert.equal(config.web.favicon,'./assets/classroom/favicon.png');
assert.equal(config.android.googleServicesFile,'./google-services.classroom.json');
const google=JSON.parse(fs.readFileSync('google-services.classroom.json','utf8'));
const packages=(google.client||[]).map(x=>x?.client_info?.android_client_info?.package_name).filter(Boolean);
assert.ok(packages.includes('org.mzbministry.buklod.classroom'));
const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
assert.equal(eas.build['classroom-production'].env.BUKLOD_APP_TARGET,'classroom');
assert.equal(eas.build['classroom-production-apk'].extends,'classroom-production');
console.log('BUKLOD_CLASSROOM_IDENTITY_GUARD=PASS');
""")

package = json.loads(Path("package.json").read_text())
package.setdefault("scripts", {})["classroom:identity"] = "node scripts/verify-classroom-identity.mjs"
package["scripts"]["eas-build-pre-install"] = "node scripts/verify-classroom-identity.mjs"
Path("package.json").write_text(json.dumps(package, indent=2) + "\n")

qa = Path(".github/workflows/classroom_r4_qa.yml")
q = qa.read_text()
start = q.index("      - name: Classroom app target isolation")
end = q.index("      - name: Web export", start)
q = q[:start] + """      - name: Classroom source identity lock
        shell: bash
        env:
          BUKLOD_APP_TARGET: classroom
          APP_VARIANT: production
          EXPO_PUBLIC_APP_ENV: production
          CLASSROOM_GOOGLE_SERVICES_FILE: ./google-services.classroom.json
        run: node scripts/verify-classroom-identity.mjs
""" + q[end:]
q = q.replace(
    "      - name: Web export\n        env:\n          EXPO_NO_TELEMETRY: '1'\n        run: npx expo export --platform web --output-dir dist-classroom-r4-qa",
    "      - name: Web export\n        env:\n          EXPO_NO_TELEMETRY: '1'\n          BUKLOD_APP_TARGET: classroom\n          EXPO_PUBLIC_BUKLOD_APP_TARGET: classroom\n          APP_VARIANT: production\n          EXPO_PUBLIC_APP_ENV: production\n          CLASSROOM_GOOGLE_SERVICES_FILE: ./google-services.classroom.json\n        run: npx expo export --platform web --output-dir dist-classroom-r4-qa",
)
qa.write_text(q)

Path(".classroom-source-lock").write_text("BUKLOD Classroom\norg.mzbministry.buklod.classroom\n14100ed1-7f25-4551-9627-09d280498241\n")
print("CLASSROOM_IDENTITY_SOURCE_PATCH=READY")
