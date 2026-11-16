import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const shortcuts = [
  {label:'Bible', icon:'book-open-page-variant-outline', route:'/bible'},
  {label:'KL', icon:'school-outline', route:'/kabihasnang-ligaw'},
  {label:'Quiz', icon:'trophy-outline', route:'/faith/bible-quiz'},
  {label:'Music', icon:'headphones', route:'/faith/hymns'},
  {label:'More', icon:'view-grid-outline', route:'/feature-search'},
] as const;

/** One compact row of non-tab quick actions; standard touch sizes and safe scaling. */
export default function BuklodExecutiveQuickAccess() {
  const { theme } = useBuklodTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View accessibilityLabel="BUKLOD quick services" style={{ gap: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection:'row', gap:7, paddingVertical:1 }}>
        {shortcuts.map(item => (
          <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={'Open ' + item.label}
            onPress={() => router.push(item.route as any)}
            style={({pressed}) => ({
              minWidth: fontScale >= 1.4 ? 84 : 75, minHeight: 64,
              borderWidth:1, borderColor:theme.border,
              backgroundColor:pressed ? theme.accentSoft : theme.cardSurface,
              borderRadius:12, alignItems:'center', justifyContent:'center',
              paddingVertical:7, paddingHorizontal:10, gap:4,
            })}>
            <MaterialCommunityIcons name={item.icon} size={21} color={theme.accent}/>
            <Text allowFontScaling numberOfLines={1} style={{color:theme.textPrimary,fontSize:12,fontWeight:'800'}}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
