import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  bookName: string;
  chapterNo: number;
  translationLabel: string;
  onBack: () => void;
  onSearch: () => void;
  onBookmark: () => void;
};

/**
 * BUKLOD-owned scenic Bible chrome. Pure decoration: no remote photo fetches
 * or embedded screenshot UI; controls remain legible on weak connections.
 */
export default function BuklodBibleScenicHeader({
  bookName, chapterNo, translationLabel, onBack, onSearch, onBookmark,
}: Props) {
  return (
    <View style={styles.frame}>
      <LinearGradient
        colors={['#153F35', '#47745A', '#D6B27E', '#F1DAB0']}
        locations={[0, 0.40, 0.77, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 390 172"
        preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Circle cx="280" cy="50" r="31" fill="#FFF0AC" opacity=".92" />
        <Path d="M0 123 L68 57 L102 83 L156 26 L231 107 L271 66 L338 122 L390 64 L390 172 L0 172Z"
          fill="#37644A" opacity=".72" />
        <Path d="M0 141 L79 98 L138 121 L213 67 L265 134 L337 102 L390 131 L390 172 L0 172Z"
          fill="#244D3A" opacity=".8" />
        <Path d="M0 158 C80 127 137 163 203 145 C282 116 321 137 390 121 L390 172 L0 172Z"
          fill="#173E30" opacity=".91" />
      </Svg>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Bumalik"
          onPress={onBack} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={25} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headline}>
          <Text style={styles.reference} numberOfLines={1}>{bookName} {chapterNo}</Text>
          <Text style={styles.translation} numberOfLines={1}>
            Ang Salita ng Diyos ({translationLabel})
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Maghanap sa Bible"
          onPress={onSearch} style={styles.iconButton}>
          <MaterialCommunityIcons name="magnify" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Buksan ang tala sa kasalukuyang talata"
          onPress={onBookmark} style={styles.iconButton}>
          <MaterialCommunityIcons name="bookmark-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.bookDecoration} pointerEvents="none">
        <MaterialCommunityIcons name="book-open-variant" size={65} color="#FBE6B9" />
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  frame:{height:174,marginHorizontal:-16,marginTop:-16,marginBottom:12,overflow:'hidden',backgroundColor:'#204A35'},
  headerRow:{flexDirection:'row',alignItems:'center',paddingTop:15,paddingHorizontal:9,gap:3},
  iconButton:{minWidth:38,minHeight:42,alignItems:'center',justifyContent:'center'},
  headline:{flex:1,minWidth:0,marginLeft:2},
  reference:{fontSize:24,fontWeight:'900',color:'#FFFFFF',textShadowColor:'#133124',textShadowRadius:5,textShadowOffset:{width:0,height:1}},
  translation:{fontSize:12,fontWeight:'700',color:'#F7EEE1',marginTop:3},
  bookDecoration:{position:'absolute',right:24,bottom:5,transform:[{rotate:'-13deg'}],opacity:.82}
});
