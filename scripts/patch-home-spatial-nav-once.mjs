import fs from 'node:fs';

const file = 'src/components/home/BuklodSpatialHome.tsx';
let src = fs.readFileSync(file, 'utf8');

const required = [
  'style={styles.bottomNav}',
  'onPress={() => router.back()}',
  'accessibilityLabel="Back to Community Map"',
];
for (const marker of required) {
  if (!src.includes(marker)) throw new Error(`Expected marker missing: ${marker}`);
}

src = src.replace(
`        bottomNav: {\n          minHeight: 66,\n          flexDirection: 'row',\n          backgroundColor: palette.surface,\n          borderTopWidth: 1,\n          borderTopColor: palette.border,\n          paddingHorizontal: 6,\n          paddingVertical: 6,\n        },\n        navItem: {\n          flex: 1,\n          alignItems: 'center',\n          justifyContent: 'center',\n          gap: 2,\n          borderRadius: 12,\n        },\n        navActive: {\n          backgroundColor: palette.primarySoft,\n        },\n        navText: {\n          color: palette.muted,\n          fontSize: 7,\n          fontWeight: '900',\n        },\n`,
'',
);

src = src.replace(
`          <Pressable\n            onPress={() => router.back()}\n            style={styles.logoBlock}\n            accessibilityRole="button"\n            accessibilityLabel="Back to Community Map"\n          >\n            <MaterialCommunityIcons name="home" size={25} color="#FFFFFF" />\n          </Pressable>`,
`          <View style={styles.logoBlock}>\n            <MaterialCommunityIcons name="home" size={25} color="#FFFFFF" />\n          </View>`,
);

src = src.replace(
`          <Pressable\n            onPress={() => router.back()}\n            style={styles.door}\n            accessibilityLabel="Exit Home to Community Map"\n          >`,
`          <Pressable\n            onPress={() => router.replace('/city' as any)}\n            style={styles.door}\n            accessibilityRole="button"\n            accessibilityLabel="Return to BUKLOD City"\n          >`,
);

src = src.replace(
`              <Text style={styles.doorText}>COMMUNITY MAP</Text>`,
`              <Text style={styles.doorText}>BUKLOD CITY</Text>`,
);

src = src.replace(
`            <Text style={styles.rugText}>Home · real life connected</Text>`,
`            <Text style={styles.rugText}>Community Map · outside your Home</Text>`,
);

const bottomStart = src.indexOf('        <View style={styles.bottomNav}>');
const pickerStart = src.indexOf('      <BuklodHomeThemePicker', bottomStart);
if (bottomStart < 0 || pickerStart < 0) throw new Error('Bottom navigation block not found');
src = src.slice(0, bottomStart) + '      </View>\n\n' + src.slice(pickerStart);

if (src.includes('style={styles.bottomNav}')) throw new Error('Bottom nav still present');
if (!src.includes("router.replace('/city' as any)")) throw new Error('BUKLOD City route not applied');

fs.writeFileSync(file, src);
console.log('Patched spatial Home: bottom nav removed; BUKLOD City door is the return path.');
