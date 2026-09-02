const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const file = path.resolve('src/app/(tabs)/home.tsx');
const backup = file + '.bak154j';

if (!fs.existsSync(file)) throw new Error('home.tsx not found');

let t = fs.readFileSync(file, 'utf8');

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log('Backup created:', backup);
}

/* =========================================================
   A. ALL APPLICABLE CREATED MISSION BULLETINS
========================================================= */

const bs = t.indexOf('function HomeMissionBulletins()');
const be = t.indexOf('PATCH 153H-5A', bs);

if (bs >= 0 && be > bs) {
  let b = t.slice(bs, be);

  b = b
    .replace(/\s*\.eq\(\s*'is_published'\s*,\s*true\s*\)/g, '')
    .replace(/\s*\.lte\(\s*'starts_at'\s*,\s*now\s*\)/g, '')
    .replace(
      /\s*\.or\(\s*`expires_at\.is\.null,expires_at\.gt\.\$\{now\}`\s*\)/g,
      ''
    )
    .replace(
      /\s*const now\s*=\s*new Date\(\)\.toISOString\(\);\s*/g,
      '\n'
    )
    .replace(
      /No active Mission Bulletin\./g,
      'No Mission Bulletins yet.'
    );

  t = t.slice(0, bs) + b + t.slice(be);

  console.log('Mission Bulletins: created-item filters removed');
} else {
  console.log('Mission Bulletins helper not isolated - skipped safely');
}

/* =========================================================
   B. COMPACT DAILY BIBLE STRIP
========================================================= */

if (!t.includes('function HomeDailyBibleStrip()')) {
  const anchor = '/* ============================================================\n   PATCH 154B';

  const component = `
/* ============================================================
   PATCH 154J
   COMPACT HOME DAILY BIBLE
============================================================ */

function HomeDailyBibleStrip() {
  const router = useRouter();

  const [reading, setReading] = useState<{
    reading_date: string;
    bible_reference: string;
    chapters_today: number;
  } | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data } =
          await (supabase as any).rpc(
            'get_automatic_bible_today'
          );

        if (!active) return;

        const raw =
          Array.isArray(data)
            ? data[0] ?? null
            : data ?? null;

        if (raw) {
          setReading({
            reading_date:
              String(
                raw.reading_date ?? ''
              ),

            bible_reference:
              String(
                raw.bible_reference ??
                  'Daily Bible Reading'
              ),

            chapters_today:
              Number(
                raw.chapters_today ?? 1
              ),
          });
        }
      } catch {
        if (active) {
          setReading(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const openReading = () => {
    if (
      reading?.reading_date
    ) {
      router.push({
        pathname: '/bible/read',
        params: {
          source: 'daily_plan',
          assignedDate:
            reading.reading_date,
        },
      } as any);

      return;
    }

    router.push('/bible' as any);
  };

  return (
    <Pressable
      onPress={openReading}
      accessibilityRole="button"
      accessibilityLabel="Open Daily Bible Reading"
      style={({ pressed }) => ({
        marginTop: 8,
        marginBottom: 10,
        minHeight: 64,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        paddingHorizontal: 11,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor:
            colors.greenSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons
          name="book-open-page-variant-outline"
          size={21}
          color={colors.greenDark}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
            color: colors.greenDark,
          }}
        >
          DAILY BIBLE READING
        </Text>

        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontSize: 13.5,
            fontWeight: '900',
            color: colors.text,
          }}
        >
          {loading
            ? 'Loading today’s reading...'
            : reading?.bible_reference ||
              'Open today’s reading'}
        </Text>

        {!loading &&
          !!reading && (
            <Text
              style={{
                marginTop: 1,
                fontSize: 9.5,
                color: colors.muted,
              }}
            >
              {reading.chapters_today}{' '}
              {reading.chapters_today === 1
                ? 'chapter'
                : 'chapters'}{' '}
              today
            </Text>
          )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={23}
        color={colors.greenDark}
      />
    </Pressable>
  );
}

`;

  let pos = t.indexOf(anchor);

  if (pos < 0) {
    pos = t.indexOf(
      'function HomeMissionBulletins()'
    );
  }

  if (pos < 0) {
    throw new Error(
      'Could not find Home helper insertion anchor'
    );
  }

  t =
    t.slice(0, pos) +
    component +
    t.slice(pos);

  console.log('Compact Daily Bible component added');
}

/* =========================================================
   C. REMOVE OLD DAILY DEVOTION SECTION
========================================================= */

t = t.replace(
  /\s*\{\/\*\s*PATCH_154B2_HOME_DAILY_DEVOTION\s*\*\/\}[\s\S]*?<SectionTitle>\s*DAILY DEVOTION\s*<\/SectionTitle>\s*<HomeDailyBibleReminder\s*\/>\s*/g,
  '\n'
);

t = t.replace(
  /\s*<SectionTitle>\s*DAILY DEVOTION\s*<\/SectionTitle>\s*<HomeDailyBibleReminder\s*\/>\s*/g,
  '\n'
);

/* =========================================================
   D. PLACE IT DIRECTLY BELOW NAME + RANK
========================================================= */

if (
  !t.includes(
    'PATCH_154J_HOME_DAILY_BIBLE_POSITION'
  )
) {
  const actions =
    '{/* PATCH_154A_HOME_ACTIONS */}';

  const ai = t.indexOf(actions);

  if (ai < 0) {
    throw new Error(
      'PATCH_154A_HOME_ACTIONS anchor not found'
    );
  }

  const insert = `
        {/* PATCH_154J_HOME_DAILY_BIBLE_POSITION */}
        <HomeDailyBibleStrip />

        `;

  t =
    t.slice(0, ai) +
    insert +
    t.slice(ai);
}

fs.writeFileSync(file, t, 'utf8');

console.log('');
console.log('PATCH 154J WRITTEN');
console.log(' - Daily Bible moved below name/rank');
console.log(' - Daily Bible changed to compact horizontal card');
console.log(' - Old Daily Devotion section removed');
console.log(' - Mission Bulletin filters cleaned');
console.log('');

const tsc = path.resolve(
  'node_modules/.bin/tsc.cmd'
);

const result = cp.spawnSync(
  tsc,
  ['--noEmit'],
  {
    stdio: 'inherit',
    shell: true,
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('');
console.log('PATCH 154J - TYPESCRIPT PASS');
