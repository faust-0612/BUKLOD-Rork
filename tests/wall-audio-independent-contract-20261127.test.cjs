const test=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const calls=[];
const modules=new Map();

const postId='10000000-0000-4000-8000-000000000001';
const userId='20000000-0000-4000-8000-000000000001';
const trackId='30000000-0000-4000-8000-000000000001';

const mockSupabase={
  from(table){
    calls.push({table});
    return {
      select(columns){
        calls.push({select:columns});
        return {
          async in(){
            const row={
              post_id:postId,
              music_track_id:null,
              motion_preset:'none',
              music_clip_start_seconds:null,
              music_clip_duration_seconds:null
            };
            if(columns.includes('music_volume')){
              row.music_volume=0;
              row.video_volume=0.8;
            }
            return {data:[row],error:null};
          }
        };
      },
      async insert(payload){
        calls.push({insert:payload});
        return {error:null};
      }
    };
  }
};

function load(path){
  if(modules.has(path))return modules.get(path).exports;

  const mod={exports:{}};
  modules.set(path,mod);

  const compiled=ts.transpileModule(
    fs.readFileSync(path,'utf8'),{
      compilerOptions:{
        module:ts.ModuleKind.CommonJS,
        target:ts.ScriptTarget.ES2022,
        esModuleInterop:true
      }
    }
  ).outputText;

  const localRequire=name=>{
    if(name==='@/lib/supabase'){
      return {supabase:mockSupabase};
    }
    if(name.startsWith('@/')){
      return load('src/'+name.slice(2)+'.ts');
    }
    return require(name);
  };

  new Function('require','module','exports',compiled)(
    localRequire,mod,mod.exports
  );

  return mod.exports;
}

const ranks=load('src/lib/buklodCircleRankArt.ts');
const designs=load('src/lib/buklodWallPostDesigns.ts');
const styles=load('src/lib/buklodWallPostStylePersistence.ts');
const flags=load('src/lib/buklodWallAudioReleaseFlags.ts');
const audio=load('src/lib/buklodPostCreatives.ts');

const sql=fs.readFileSync(
  'supabase/drafts/wall-audio-independent/wall-styles.sql',
  'utf8'
);

const rankNames=ranks.BUKLOD_CIRCLE_RANK_FAMILIES.flatMap(
  family=>ranks.BUKLOD_CIRCLE_RANK_LEVELS.map(
    level=>family+' '+level
  )
);

function configure(environment,enabled){
  process.env.EXPO_PUBLIC_APP_ENV=environment;
  process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW='true';
  process.env.EXPO_PUBLIC_BUKLOD_WALL_STYLES_ENABLED=enabled;
  process.env.EXPO_PUBLIC_BUKLOD_WALL_AUDIO_MIX_ENABLED=enabled;
}

test('activation defaults off and production cannot enable it',()=>{
  configure('staging','false');
  a.equal(flags.wallStylePersistenceEnabled(),false);
  a.equal(flags.wallAudioMixEnabled(),false);

  configure('production','true');
  a.equal(flags.wallStylePersistenceEnabled(),false);
  a.equal(flags.wallAudioMixEnabled(),false);

  configure('staging','true');
  a.equal(flags.wallStylePersistenceEnabled(),true);
  a.equal(flags.wallAudioMixEnabled(),true);
});

test('all 21 designs match SQL for all 40 ranks',()=>{
  const entries=[...sql.matchAll(
    /\('([a-z-]+)',\s*(\d+),\s*(\d+)\)/g
  )];

  a.equal(entries.length,21);
  a.equal(designs.WALL_POST_DESIGNS.length,21);
  a.equal(rankNames.length,40);

  for(const [,id,minRank,minMotion] of entries){
    const design=designs.resolveWallPostDesign(id);
    a.ok(design,id);

    a.equal(design.minRankOrder,Number(minRank));

    for(const [i,name] of rankNames.entries()){
      a.equal(
        designs.canSelectWallPostDesign(id,name),
        i+1>=Number(minRank),
        id+' rank '+(i+1)
      );

      a.equal(
        designs.wallDesignMotionAllowed(design,name),
        i+1>=Number(minMotion),
        id+' motion '+(i+1)
      );
    }
  }
});

test('all seven typography presets match SQL rank requirements',()=>{
  for(const font of designs.WALL_FONT_PRESETS){
    const match=sql.match(
      new RegExp("when '"+font.id+"' then (\\d+)")
    );

    a.ok(match,font.id);

    for(const [i,name] of rankNames.entries()){
      a.equal(
        designs.canSelectWallFont(font.id,name),
        i+1>=Number(match[1])
      );
    }
  }
});

test('viewers need no rank; media and bonus restrictions remain',()=>{
  const draft={
    designId:'divine-cosmos',
    fontId:'divine',
    animated:true,
    bonusKey:'rank-frame-40',
    alignment:'center'
  };

  const low=styles.authorizeWallPostStyle(
    draft,rankNames[0],false,['rank-frame-40']
  );

  a.equal(low.designId,null);
  a.equal(low.fontId,'standard');
  a.equal(low.animated,false);
  a.equal(low.bonusKey,null);
  a.equal(low.alignment,'auto');

  const high=styles.authorizeWallPostStyle(
    draft,rankNames[39],false,['rank-frame-40']
  );

  a.equal(high.designId,'divine-cosmos');
  a.equal(high.animated,true);
  a.equal(high.bonusKey,null);

  a.equal(
    styles.isDefaultWallPostStyle(
      styles.authorizeWallPostStyle(
        draft,rankNames[39],true
      )
    ),
    true
  );

  a.ok(designs.visibleWallPostDesign('divine-cosmos',false));
  a.equal(
    designs.visibleWallPostDesign('divine-cosmos',true),
    null
  );
});

test('disabled style persistence performs no database operations',async()=>{
  configure('staging','false');
  calls.length=0;

  await a.rejects(
    styles.persistWallPostStyle(postId,userId,{
      ...styles.DEFAULT_WALL_POST_STYLE,
      designId:'emerald-faith'
    })
  );

  a.equal(calls.length,0);
});

const input={
  postId,
  userId,
  musicTrackId:trackId,
  motionPreset:'none',
  clipStartSeconds:10,
  clipDurationSeconds:30,
  musicVolume:0,
  videoVolume:0.8
};

test('legacy music reads and writes omit undeployed columns',async()=>{
  configure('staging','false');
  calls.length=0;

  const rows=await audio.loadBuklodPostCreatives([postId]);

  a.equal(rows[postId].music_volume,null);

  await audio.saveBuklodPostCreative(input);

  const query=calls.find(x=>x.select).select;
  const payload=calls.find(x=>x.insert).insert;

  a.ok(!query.includes('music_volume'));
  a.ok(!query.includes('video_volume'));
  a.ok(!Object.hasOwn(payload,'music_volume'));
  a.ok(!Object.hasOwn(payload,'video_volume'));
  a.equal(payload.music_clip_duration_seconds,30);
});

test('enabled mix preserves zero volume and independent levels',async()=>{
  configure('staging','true');
  calls.length=0;

  const rows=await audio.loadBuklodPostCreatives([postId]);

  a.equal(rows[postId].music_volume,0);
  a.equal(rows[postId].video_volume,0.8);

  await audio.saveBuklodPostCreative(input);

  const payload=calls.find(x=>x.insert).insert;

  a.equal(payload.music_volume,0);
  a.equal(payload.video_volume,0.8);
});

test('invalid audio levels fail before a database request',async()=>{
  configure('staging','true');

  for(const patch of [
    {musicVolume:-1},
    {musicVolume:1.01},
    {musicVolume:NaN},
    {videoVolume:-0.1},
    {videoVolume:Infinity}
  ]){
    calls.length=0;

    await a.rejects(
      audio.saveBuklodPostCreative({...input,...patch})
    );

    a.equal(calls.length,0);
  }
});

test('video rendering and ad isolation remain intact',()=>{
  const video=fs.readFileSync(
    'src/components/CommunityVideo.tsx','utf8'
  );

  for(const token of [
    'firstFrameFallback',
    'showManualPlay',
    'beginCommunityVideoPosterGeneration',
    'ImaCommunityVideo'
  ]){
    a.ok(video.includes(token),token);
  }

  const persistence=fs.readFileSync(
    'src/lib/buklodWallPostStylePersistence.ts','utf8'
  );

  a.ok(!persistence.includes('buklod_rank_bonus_ledger_v1'));
});
