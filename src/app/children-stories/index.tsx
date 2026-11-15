import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/providers/AuthProvider';
import StoryArt from '@/features/childrenStories/StoryArt';
import { BIBLE_STORY_METADATA, type BibleTestament } from '@/features/childrenStories/bibleExpansion';
import { BUNDLED_CHILDREN_STORIES, ChildrenStory, StoryCategory, StoryLanguage, STORY_CATEGORIES, localize } from '@/features/childrenStories/catalog';
import { fetchChildrenStoryLibrary, formatStoryAge, readStoryProgress, StoryProgress } from '@/features/childrenStories/service';

type CategoryFilter = StoryCategory | 'All';
const categoryLabels: Record<CategoryFilter,string> = {
  All:'Lahat', Bible:'Bible', Values:'Good Values', Filipino:'Kuwentong Pinoy', Bedtime:'Bedtime'
};
export default function ChildrenStoriesLibrary() {
  const {user} = useAuth();
  const {width,fontScale} = useWindowDimensions();
  const columns = width > 610 && fontScale < 1.4 ? 2 : 1;
  const [language,setLanguage] = useState<StoryLanguage>('tl');
  const [category,setCategory] = useState<CategoryFilter>('All');
  const [testament,setTestament] = useState<'all'|BibleTestament>('all');
  const [age,setAge] = useState<number | null>(null);
  const [search,setSearch] = useState('');
  const [stories,setStories] = useState<ChildrenStory[]>(BUNDLED_CHILDREN_STORIES);
  const [progress,setProgress] = useState<StoryProgress>({});
  useEffect(() => {
    let active = true;
    // Bundled stories paint on the first frame; the editorial library is optional.
    setStories(BUNDLED_CHILDREN_STORIES);
    setProgress({});
    void readStoryProgress(user?.id).then(data => {if(active)setProgress(data)});
    void fetchChildrenStoryLibrary(user?.id).then(data => {if(active)setStories(data)});
    return () => {active=false};
  },[user?.id]);
  const visible = useMemo(() => {
    const q=search.trim().toLocaleLowerCase();
    return stories.filter(s =>
      (category==='All'||s.category===category) &&
      (testament==='all'||(s.category==='Bible'&&BIBLE_STORY_METADATA[s.id]?.testament===testament)) &&
      (!age||(age>=s.minAge&&age<=s.maxAge)) &&
      (!q||[s.title.tl,s.title.en,s.summary.tl,s.summary.en,BIBLE_STORY_METADATA[s.id]?.book,BIBLE_STORY_METADATA[s.id]?.reference].some(t=>t?.toLocaleLowerCase().includes(q)))
    );
  },[stories,category,testament,age,search]);
  const completed = Object.values(progress).filter(p=>p.completed).length;
  const finished = Math.min(completed,stories.length);
  return (
    <View style={styles.screen}>
      <FlatList key={columns} data={visible} numColumns={columns}
        columnWrapperStyle={columns===2?styles.columns:undefined}
        keyExtractor={item=>item.id} contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <Pressable accessibilityRole="button" onPress={()=>router.back()} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#21554F"/>
            <Text style={styles.backText}>Back to Home</Text>
          </Pressable>
          <LinearGradient colors={['#173A63','#267B79','#49A78B']} style={styles.hero}>
            <Text style={styles.eyebrow}>BUKLOD KIDS · SAFE READING SPACE</Text>
            <Text style={styles.heroTitle}>Children's Story World</Text>
            <Text style={styles.heroDescription}>{language==='tl'?'Mga kuwento, aral, at pangarap — sama-samang basahin.':'Stories, lessons and dreams — read together.'}</Text>
            <View style={styles.heroFooter}>
              <Text style={styles.heroMeta}>{finished}/{stories.length} finished · {BUNDLED_CHILDREN_STORIES.length} offline stories</Text>
              <View style={styles.switcher}>
                {(['tl','en'] as const).map(v=><Pressable key={v} onPress={()=>setLanguage(v)}
                  accessibilityRole="button" accessibilityState={{selected:language===v}}
                  style={[styles.langButton,language===v&&styles.langSelected]}>
                  <Text style={[styles.langText,language===v&&styles.langSelectedText]}>{v==='tl'?'Filipino':'English'}</Text>
                </Pressable>)}
              </View>
            </View>
          </LinearGradient>
          <Text style={styles.sectionTitle}>{language==='tl'?'Pumili ng kuwento':'Choose a story'}</Text>
          <TextInput value={search} onChangeText={setSearch}
            placeholder={language==='tl'?'Hanapin ang kuwento…':'Search stories…'}
            placeholderTextColor="#687E79" accessibilityLabel="Search children's stories"
            style={styles.search}/>
          <View style={styles.filters}>
            {(['All',...STORY_CATEGORIES] as CategoryFilter[]).map(v=><Pressable key={v}
              onPress={()=>{setCategory(v);if(v!=='Bible')setTestament('all')}} accessibilityRole="button" accessibilityState={{selected:category===v}}
              style={[styles.filter,category===v&&styles.filterOn]}>
              <Text style={[styles.filterText,category===v&&styles.filterTextOn]}>{categoryLabels[v]}</Text>
            </Pressable>)}
          </View>
          {category==='Bible' ? <View style={styles.filters}>
            {(['all','old','new'] as const).map(v=><Pressable key={v}
              onPress={()=>setTestament(v)} accessibilityRole="button" accessibilityState={{selected:testament===v}}
              style={[styles.filter,testament===v&&styles.filterOn]}>
              <Text style={[styles.filterText,testament===v&&styles.filterTextOn]}>
                {v==='all'?(language==='tl'?'Buong Bibliya':'Whole Bible'):v==='old'?(language==='tl'?'Lumang Tipan':'Old Testament'):(language==='tl'?'Bagong Tipan':'New Testament')}
              </Text>
            </Pressable>)}
          </View> : null}
          <View style={styles.filters}>
            {[null,3,6,9].map(v=><Pressable key={v??'all'}
              onPress={()=>setAge(v)} accessibilityRole="button" accessibilityState={{selected:age===v}}
              style={[styles.age,age===v&&styles.ageOn]}>
              <Text style={[styles.ageText,age===v&&styles.ageTextOn]}>{v===null?'All ages':v===3?'3–5':v===6?'6–8':'9–12'}</Text>
            </Pressable>)}
          </View>
        </>}
        renderItem={({item})=><Pressable
          accessibilityRole="button" accessibilityLabel={localize(item.title,language)}
          onPress={()=>router.push({pathname:'/children-stories/[id]' as any,params:{id:item.id,lang:language}})}
          style={({pressed})=>[styles.card,columns===2&&styles.half,pressed&&{opacity:.82}]}>
          <StoryArt story={item} compact />
          <View style={styles.cardBody}>
            <View style={styles.tags}>
              <Text style={styles.category}>{categoryLabels[item.category]}</Text>
              <Text style={styles.ageLabel}>{BIBLE_STORY_METADATA[item.id]?.reference ?? `Ages ${formatStoryAge(item)}`}</Text>
            </View>
            <Text style={styles.cardTitle}>{localize(item.title,language)}</Text>
            <Text style={styles.cardSummary} numberOfLines={2}>{localize(item.summary,language)}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.readText}>{progress[item.id]?.completed?'✓ Completed':'Read · Listen · Learn'}</Text>
              <MaterialCommunityIcons name="arrow-right-circle" size={23} color="#227D68"/>
            </View>
          </View>
        </Pressable>}
        ListEmptyComponent={<Text style={styles.empty}>Walang kuwentong tumugma. Baguhin ang filter.</Text>}
        ListFooterComponent={<Text style={styles.footer}>Gamitin kasama ang magulang o guardian. Walang chats, ads, o child accounts dito. Ang {BUNDLED_CHILDREN_STORIES.length} orihinal na kuwento ay naka-bundle para sa offline reading. Ang mga biblical adaptation ay may talatang sanggunian at maaaring hanapin ayon sa aklat at tipan.</Text>}
      />
    </View>
  );
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F5F8F4'},content:{padding:15,paddingBottom:32,gap:12,maxWidth:980,width:'100%',alignSelf:'center'},
  back:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:3,minHeight:40},
  backText:{color:'#21554F',fontSize:14,fontWeight:'800'},
  hero:{borderRadius:25,padding:22,gap:10,marginBottom:7},
  eyebrow:{color:'#B2F3DF',fontWeight:'900',fontSize:11,letterSpacing:1.2},
  heroTitle:{color:'white',fontSize:30,fontWeight:'900',lineHeight:35},
  heroDescription:{color:'#E5F9F3',fontSize:14,lineHeight:21},
  heroFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:9,marginTop:4},
  heroMeta:{color:'#DBFFF4',fontSize:12,fontWeight:'700'},
  switcher:{flexDirection:'row',backgroundColor:'rgba(255,255,255,.17)',padding:3,borderRadius:20,gap:3},
  langButton:{paddingVertical:8,paddingHorizontal:12,borderRadius:17},
  langSelected:{backgroundColor:'white'},
  langText:{color:'white',fontSize:12,fontWeight:'800'},
  langSelectedText:{color:'#205F56'},
  sectionTitle:{fontSize:21,color:'#173F3B',fontWeight:'900',marginTop:8},
  search:{borderWidth:1,borderColor:'#C4DCD0',backgroundColor:'white',padding:13,minHeight:48,borderRadius:14,color:'#193F37',fontSize:15},
  filters:{flexDirection:'row',gap:7,flexWrap:'wrap'},
  filter:{paddingVertical:9,paddingHorizontal:12,backgroundColor:'#E6EEE7',borderRadius:18},
  filterOn:{backgroundColor:'#266E5E'},
  filterText:{fontSize:12,fontWeight:'700',color:'#42665A'},
  filterTextOn:{color:'white'},
  age:{paddingVertical:7,paddingHorizontal:12,borderRadius:12,borderWidth:1,borderColor:'#CFDFD4'},
  ageOn:{borderColor:'#286E61',backgroundColor:'#E4F6EC'},
  ageText:{fontSize:12,color:'#5D7167',fontWeight:'700'},
  ageTextOn:{color:'#205D49'},
  columns:{gap:12},card:{backgroundColor:'white',borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#DEEAE2',marginBottom:1,shadowColor:'#204337',shadowOpacity:.08,shadowRadius:6,elevation:2},
  half:{flex:1,maxWidth:'49.5%'},cardBody:{padding:14,gap:8},
  tags:{flexDirection:'row',justifyContent:'space-between',gap:4},
  category:{fontSize:11,fontWeight:'900',color:'#237261',textTransform:'uppercase'},
  ageLabel:{fontSize:11,color:'#77877B',fontWeight:'700'},
  cardTitle:{fontSize:19,fontWeight:'900',color:'#163D37'},
  cardSummary:{fontSize:13,lineHeight:19,color:'#5E7669',minHeight:38},
  cardBottom:{borderTopWidth:1,borderTopColor:'#E5EEE9',paddingTop:9,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  readText:{fontSize:12,fontWeight:'800',color:'#267B68'},empty:{padding:20,color:'#4A655B'},
  footer:{fontSize:12,color:'#73857C',textAlign:'center',lineHeight:18,padding:12}
});
