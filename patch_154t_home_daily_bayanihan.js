const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/(tabs)/home.tsx'
);

if(!fs.existsSync(file)){
  throw new Error('home.tsx not found');
}

let t=fs.readFileSync(file,'utf8');

const backup=file+'.bak154t';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

/* ============================================================
   1. REPLACE ONLY CURRENT HOME DAILY BIBLE CALL
============================================================ */

const oldCall=`{/* PATCH_154J_HOME_DAILY_BIBLE_POSITION */}
      <HomeDailyBibleStrip />`;

if(!t.includes(oldCall)){
  throw new Error(
    'HomeDailyBibleStrip home anchor not found'
  );
}

t=t.replace(
  oldCall,
`{/* PATCH_154T_HOME_DAILY_BAYANIHAN_PAIR */}
      <HomeDailyBayanihanPair />`
);

/* ============================================================
   2. INSERT NEW HOME PAIR BEFORE OLD HomeDailyBibleStrip
   Old component remains untouched for safety.
============================================================ */

const componentAnchor=
  'function HomeDailyBibleStrip()';

const anchorAt=
  t.indexOf(componentAnchor);

if(anchorAt<0){
  throw new Error(
    'HomeDailyBibleStrip component anchor not found'
  );
}

const pairComponent=`
/* ============================================================
   PATCH 154T
   HOME DAILY DEVOTION + BAYANIHAN CURRENT BALANCE
============================================================ */

function HomeDailyBayanihanPair() {
  const [reading,setReading] =
    useState<{
      bible_reference:string;
      chapters_today:number;
    } | null>(null);

  const [bayanihanBalance,setBayanihanBalance] =
    useState<number | null>(null);

  const [readingLoading,setReadingLoading] =
    useState(true);

  const [balanceLoading,setBalanceLoading] =
    useState(true);

  useEffect(()=>{
    let active=true;

    const load=async()=>{
      try{
        const [
          bibleResult,
          balanceResult
        ]=await Promise.all([
          (supabase as any).rpc(
            'get_automatic_bible_today'
          ),

          (supabase as any).rpc(
            'get_my_bayanihan_current_balance_v1'
          )
        ]);

        if(!active)return;

        const bibleRaw=
          Array.isArray(bibleResult.data)
            ? bibleResult.data[0] ?? null
            : bibleResult.data ?? null;

        if(bibleRaw){
          setReading({
            bible_reference:String(
              bibleRaw.bible_reference ?? ''
            ),

            chapters_today:Number(
              bibleRaw.chapters_today ?? 1
            )
          });
        }

        const balanceRaw=
          Array.isArray(balanceResult.data)
            ? balanceResult.data[0] ?? null
            : balanceResult.data;

        if(
          balanceResult.error
        ){
          console.warn(
            'Home Bayanihan balance:',
            balanceResult.error.message
          );

          setBayanihanBalance(null);
        }else{
          const value=
            balanceRaw &&
            typeof balanceRaw==='object'
              ? (
                  balanceRaw.current_balance ??
                  balanceRaw.balance ??
                  0
                )
              : (
                  balanceRaw ?? 0
                );

          setBayanihanBalance(
            Number(value || 0)
          );
        }

      }catch(error){
        console.warn(
          'Home dashboard pair:',
          error
        );
      }finally{
        if(active){
          setReadingLoading(false);
          setBalanceLoading(false);
        }
      }
    };

    void load();

    return()=>{
      active=false;
    };
  },[]);

  const money=(value:number)=>{
    return Number(value || 0)
      .toLocaleString(
        'en-PH',
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      );
  };

  return(
    <View
      style={{
        flexDirection:'row',
        gap:10,
        alignItems:'stretch',
        marginTop:3,
        marginBottom:8
      }}
    >
      {/* DAILY DEVOTION */}
      <Pressable
        onPress={()=>
          router.push('/bible' as any)
        }
        accessibilityRole="button"
        accessibilityLabel="Open Daily Devotion"
        style={({pressed})=>({
          flex:1,
          opacity:pressed ? 0.82 : 1
        })}
      >
        <View
          style={{
            minHeight:132,
            height:'100%',
            borderWidth:1,
            borderColor:colors.line,
            borderRadius:16,
            backgroundColor:colors.white,
            padding:12
          }}
        >
          <View
            style={{
              flexDirection:'row',
              alignItems:'center',
              gap:6
            }}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={18}
              color={colors.greenDark}
            />

            <Text
              style={{
                flex:1,
                fontSize:10,
                fontWeight:'900',
                color:colors.greenDark,
                letterSpacing:.5
              }}
            >
              DAILY DEVOTION
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              marginTop:10,
              fontSize:15,
              lineHeight:19,
              fontWeight:'900',
              color:colors.text
            }}
          >
            {
              readingLoading
                ? 'Loading...'
                : reading?.bible_reference ||
                  'Daily Bible Reading'
            }
          </Text>

          <Text
            style={{
              marginTop:6,
              fontSize:10,
              lineHeight:14,
              color:colors.muted
            }}
          >
            {
              reading
                ? \`\${reading.chapters_today} \${reading.chapters_today===1 ? 'chapter' : 'chapters'} today\`
                : 'Open today’s reading'
            }
          </Text>

          <View style={{flex:1}} />

          <Text
            style={{
              marginTop:7,
              fontSize:10,
              fontWeight:'900',
              color:colors.greenDark
            }}
          >
            OPEN ›
          </Text>
        </View>
      </Pressable>


      {/* BUKLOD BAYANIHAN */}
      <Pressable
        onPress={()=>
          router.push('/bayanihan' as any)
        }
        accessibilityRole="button"
        accessibilityLabel="Open BUKLOD Bayanihan"
        style={({pressed})=>({
          flex:1,
          opacity:pressed ? 0.82 : 1
        })}
      >
        <View
          style={{
            minHeight:132,
            height:'100%',
            borderWidth:1,
            borderColor:colors.line,
            borderRadius:16,
            backgroundColor:colors.white,
            padding:12
          }}
        >
          <View
            style={{
              flexDirection:'row',
              alignItems:'center',
              gap:6
            }}
          >
            <MaterialCommunityIcons
              name="hand-heart-outline"
              size={18}
              color={colors.greenDark}
            />

            <Text
              style={{
                flex:1,
                fontSize:10,
                fontWeight:'900',
                color:colors.greenDark,
                letterSpacing:.4
              }}
            >
              BUKLOD BAYANIHAN
            </Text>
          </View>

          <Text
            style={{
              marginTop:9,
              fontSize:9,
              fontWeight:'800',
              color:colors.muted,
              letterSpacing:.3
            }}
          >
            CURRENT BALANCE
          </Text>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              marginTop:3,
              fontSize:18,
              lineHeight:23,
              fontWeight:'900',
              color:colors.text
            }}
          >
            {
              balanceLoading
                ? '...'
                : bayanihanBalance===null
                  ? 'Unavailable'
                  : \`₱\${money(bayanihanBalance)}\`
            }
          </Text>

          <Text
            style={{
              marginTop:5,
              fontSize:9,
              lineHeight:12,
              color:colors.muted
            }}
          >
            Reference value only. Not personal cash or automatic property of the member.
          </Text>

          <View style={{flex:1}} />

          <Text
            style={{
              marginTop:5,
              fontSize:10,
              fontWeight:'900',
              color:colors.greenDark
            }}
          >
            VIEW ›
          </Text>
        </View>
      </Pressable>
    </View>
  );
}


`;

t=
  t.slice(0,anchorAt)+
  pairComponent+
  t.slice(anchorAt);

fs.writeFileSync(
  file,
  t,
  'utf8'
);


/* ============================================================
   3. CREATE DATABASE RPC FOR AUTHENTICATED MEMBER'S OWN
      CURRENT BAYANIHAN BALANCE

   current_balance = credits - debits
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812022000_patch154t_my_bayanihan_current_balance.sql'
);

const sql=`-- PATCH 154T
-- Member-safe own BUKLOD Bayanihan current balance.
-- This is a reference/accounting value, not a declaration
-- that the amount is personal cash or automatically withdrawable.

create or replace function
public.get_my_bayanihan_current_balance_v1()
returns table (
  current_balance numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      sum(
        case
          when bl.direction = 'credit'
            then bl.amount
          when bl.direction = 'debit'
            then -bl.amount
          else 0
        end
      ),
      0
    )::numeric
    as current_balance
  from public.bayanihan_ledger bl
  where bl.user_id =
    (select auth.uid());
$$;

revoke all on function
public.get_my_bayanihan_current_balance_v1()
from public;

grant execute on function
public.get_my_bayanihan_current_balance_v1()
to authenticated;

comment on function
public.get_my_bayanihan_current_balance_v1()
is
'Returns only the authenticated member own BUKLOD Bayanihan current balance: credits minus debits. Reference/accounting value only.';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154T WRITTEN');
console.log('✓ Daily Devotion + Bayanihan are side-by-side');
console.log('✓ Bayanihan shows CURRENT BALANCE');
console.log('✓ exact credits minus debits value');
console.log('✓ normal readable amount, not oversized');
console.log('✓ reference-value disclaimer included');
console.log('✓ Bayanihan card opens /bayanihan');
console.log('✓ DB migration created');
console.log('');

