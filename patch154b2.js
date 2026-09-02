
const fs=require('fs'),p='src/app/(tabs)/home.tsx',b=p+'.bak154b2';
if(!fs.existsSync(p)) throw new Error('home.tsx not found');
let t=fs.readFileSync(p,'utf8');
if(!fs.existsSync(b)) fs.copyFileSync(p,b);

function esc(s){return s.replace(/[.*+?^${}()|[\]\\\]/g,'\\$&')}
function hideBetween(startLabel,nextLabel,marker){
  const re=new RegExp('(\\\\s*<SectionTitle>\\\s*'+esc(startLabel)+'\\\s*<\\/SectionTitle>[\\\s]*?)(?=\\\\s*<SectionTitle>\\\s*'+esc(nextLabel)+'\\\s*<\\/SectionTitle>)');
  const m=t.match(re);
  if(m && !t.includes(marker)){
    t=t.replace(re,'\n      {/* '+marker+' */}\n      {false && (<>'+$1</>)}\n');
  }
}
hideBetween('IMPORTANT UPDATES','TOP BUKLOD THIS WEEK,��'PATCH_154B2_IMPORTANT_UPDATES_REMOVED');
hideBetween("THIS WEEK'S DEVOTIONAL",'YOUR JOURNEY','PATCH_154B2_WEEKLY_DEVOTIONAL_REMOVED');

if(!t.includes('PATCH_154B2_HOME_DAILY_DEVOTION')){
  const old=/\\\\s*\\/\\\*\\\sWPATCH_154B_REMINDERS_REMOVED\\\s*\\\*\\/\\\s*\\\\{false\\\s*&&\\\s*<HomeDailyBibleReminder\\\\s*\\\/\\\s*>\\\s*\\\\}\\\s*/;
  const daily='\n      {/* PATCH_154B2_HOME_DAILY_DEVOTION */}\n      <SectionTitle>\n        DAILY DEVOTION\n      </SectionTitle>\n      <HomeDailyBibleReminder />\n';
  if(old.test(t) t=t.replace(old,daily);
  else {
    const anchor=/<SectionTitle>\\\s*CHURCH LIFE\\\s*<\\/SectionTitle>/;
    if(!anchor.test(t)) throw new Error('CHURCH LIFE anchor not found');
    t=t.replace(anchor,daily+'\n      <SectionTitle>\n        CHURCH LIFE\n      </SectionTitle>');
  }
}

t=t.replace(/…/g,'|').replace(/—k/g,'-').replace(/§/g,'|');

if(!t.includes('PATCH_154B2_CHURCH_LIFE_CARD')){
  const re=/(<SectionTitle>\\\s*CHURCH LIFE\\\s*<\\/SectionTitle>\\\\s*)<Card>([\\\S\\\s]*?)<\\/Card>(\\\s*<\\/ScrollView>)/;
  const m=t.match(re);
  if(!m) throw new Error('CHURCH LIFE card not found');
  let body=m[2].replace(/\\\\s*<View\\\s*style=\\\{{\\\\s*marginTop:\\\s*12,\\\\s*\\\\}}\\\\s*>\\\s*<Button\\\s*title="OPEN CHURCH LIFE"\\\\s*onPress=\\\{\\\\(\\\|\\\\)\\\s*=>\\\\s*router\\\\.push\\\\('\\\/church'\\\)\\\\s*\\\\}\\\s*\\\/>\\\\s*<\\/View>\\\\s*/m,'\n');
  const rep=`${m[1]}{/* PATCH_154B2_CHURCH_LIFE_CARD */}
      <Pressable
        onPress={() => router.push('/church')}
        accessibilityRole="button"
        accessibilityLabel="Open Church Life"
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
      >
        <Card>${body}
        </Card>
      </Pressable>${m[3]}`;
  t=t.replace(re,rep);
}

fs.writeFileSync(p,t,'utf8');
console.log('PATCH 154B-2 HOME UPDATE APPLIED');
