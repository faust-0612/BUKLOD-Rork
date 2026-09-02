const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/bible/index.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154v_scripture_link';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const oldLine=
`            <Text style={styles.reference}>{selected.bible_reference}</Text>`;

if(!t.includes(oldLine)){
  throw new Error(
    'Today Scripture reference anchor not found'
  );
}

const replacement=`
            {/* PATCH_154V_TODAYS_SCRIPTURE_LINK */}
            <Pressable
              disabled={selectedDate > today}
              onPress={openAssignedReading}
              accessibilityRole="button"
              accessibilityLabel="Open today's Scripture in Bible"
              style={({pressed})=>({
                opacity:
                  selectedDate > today
                    ? 0.45
                    : pressed
                      ? 0.72
                      : 1
              })}
            >
              <Text style={styles.reference}>
                {selected.bible_reference}
              </Text>

              <Text
                style={{
                  marginTop:5,
                  fontSize:11,
                  fontWeight:'900',
                  color:'#275D45'
                }}
              >
                OPEN IN BIBLE ›
              </Text>
            </Pressable>`;

t=t.replace(
  oldLine,
  replacement
);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-SCRIPTURE-LINK WRITTEN');
console.log('✓ Today Scripture is clickable');
console.log('✓ opens the assigned chapter in Bible reader');
console.log('✓ automatic Daily Bible reading preserved');
console.log('✓ existing READ button preserved');
console.log('✓ no DB change');
console.log('');

