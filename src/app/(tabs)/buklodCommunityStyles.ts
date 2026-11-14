import { buklodVisual } from '@/lib/buklodVisual';
import { StyleSheet } from 'react-native';
import type { LegacyThemeColors } from '@/lib/buklodThemePresentation';

export function createCommunityStyles(c: LegacyThemeColors) {
  return StyleSheet.create({
content:{
 paddingHorizontal:0,
 paddingTop:8,
 paddingBottom:50
},eyebrow:{fontSize:12,fontWeight:'900',color:c.greenDark,letterSpacing:.8},label:{fontSize:12,fontWeight:'900',color:c.muted,marginBottom:7},
wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},

audienceRow:{
 flexDirection:'row',
 gap:6
},

categoryRow:{
 flexDirection:'row',
 gap:5
},

compactChip:{
 minHeight:buklodVisual.size.touch,
 paddingVertical:7,
 paddingHorizontal:7,
 borderRadius:18,
 borderWidth:1,
 borderColor:c.line,
 backgroundColor:c.white,
 alignItems:'center',
 justifyContent:'center'
},

audienceChip:{
 flex:1
},

categoryChip:{
 flex:1
},

compactChipText:{
 fontSize:12,
 fontWeight:'900',
 color:c.text
},

chip:{
 paddingVertical:8,
 paddingHorizontal:10,
 borderRadius:20,
 borderWidth:1,
 borderColor:c.line,
 backgroundColor:c.white
},

chipOn:{
 borderColor:c.green,
 backgroundColor:c.greenSoft
},

chipText:{
 fontSize:13,
 fontWeight:'900',
 color:c.text
},

audienceHelp:{
 marginTop:5,
 fontSize:12,
 lineHeight:17,
 color:c.muted
},

typeLabel:{
 marginTop:9,
 marginBottom:6,
 fontSize:12,
 fontWeight:'900',
 color:c.muted
},
area:{
 minHeight:96,
 maxHeight:200,
 marginTop:5,
 paddingHorizontal:8,
 paddingVertical:8,
 borderWidth:1,
 borderColor:c.line,
 borderRadius:11,
 textAlignVertical:'top',
 backgroundColor:c.white,
 fontSize:16
},

mentioned:{
 marginTop:6,
 fontSize:13,
 fontWeight:'800',
 color:c.greenDark
},
row:{
 flexDirection:'row',
 gap:7,
 marginTop:7
},

tool:{
 flex:1,
 minHeight:buklodVisual.size.touch,
 paddingVertical:6,
 borderWidth:1,
 borderColor:c.line,
 borderRadius:10,
 alignItems:'center',
 justifyContent:'center',
 flexDirection:'row',
 gap:4
},

toolText:{
 fontSize:12,
 fontWeight:'900',
 color:c.greenDark
},
preview:{width:'100%',height:210,borderRadius:12,marginTop:10,marginBottom:8},filter:{gap:7,paddingBottom:4},rank:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:9,marginTop:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:c.line},rankNo:{width:30,fontWeight:'900',color:c.greenDark},rankName:{flex:1,fontWeight:'900',color:c.text},rankPts:{fontSize:11,fontWeight:'900',color:c.greenDark},
author:{fontSize:15,fontWeight:'800',color:c.text},meta:{marginTop:3,fontSize:12,color:c.muted},body:{marginTop:6,fontSize:16,lineHeight:24,color:c.text},postImage:{width:'100%',height:240,borderRadius:12,marginTop:10},
rx:{
 flexDirection:'row',
 alignItems:'center',
 justifyContent:'space-between',
 gap:5,
 marginTop:10
},

rxBtn:{
 flex:1,
 minWidth:0,
 minHeight:buklodVisual.size.touch,
 borderRadius:18,
 flexDirection:'row',
 alignItems:'center',
 justifyContent:'center',
 gap:3,
 backgroundColor:c.background,
 borderWidth:1,
 borderColor:'transparent'
},

rxBtnActive:{
 backgroundColor:c.greenSoft,
 borderColor:c.green
},

rxCount:{
 fontSize:12,
 fontWeight:'900',
 color:c.muted
},

rxCountActive:{
 color:c.greenDark
},
footer:{marginTop:10,paddingTop:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:c.line,flexDirection:'row',gap:8},footBtn:{flex:1,minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderRadius:10,backgroundColor:'#F7F7F7'},footText:{fontSize:13,fontWeight:'900',color:c.greenDark},
overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},drawer:{minHeight:'58%',maxHeight:'82%',padding:18,paddingBottom:24,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:c.background},drawerTitle:{fontSize:20,fontWeight:'900',color:c.text,marginBottom:10},search:{borderWidth:1,borderColor:c.line,borderRadius:12,padding:12,backgroundColor:c.white},
member:{minHeight:57,padding:11,borderWidth:1,borderColor:c.line,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:c.white},memberOn:{borderColor:c.green,backgroundColor:c.greenSoft},memberName:{fontSize:15,fontWeight:'900',color:c.text},memberMeta:{marginTop:3,fontSize:12,color:c.muted}
,

 communityComposerPhotos:{
  marginTop:10,
  marginBottom:8,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:5
 },

 communityComposerPhoto:{
  width:'31.8%',
  height:92,
  position:'relative',
  backgroundColor:'#E8ECE9'
 },

 communityComposerPhotoImage:{
  width:'100%',
  height:'100%'
 },

 communityComposerPhotoRemove:{
  position:'absolute',
  top:4,
  right:4,
  width:26,
  height:26,
  alignItems:'center',
  justifyContent:'center',
  borderRadius:13,
  backgroundColor:'rgba(0,0,0,.68)'
 },


 communityMediaGrid:{
  marginTop:10,
  marginHorizontal:-12,
  flexDirection:'row',
  flexWrap:'wrap',
  gap:2,
  overflow:'hidden',
  backgroundColor:'#E7EBE8'
 },

 communityMediaTile:{
  overflow:'hidden',
  backgroundColor:'#DDE4DF'
 },

 communityMediaOne:{
  width:'100%',
  height:310
 },

 communityMediaHalfTall:{
  width:'49.7%',
  height:250
 },

 communityMediaWide:{
  width:'100%',
  height:210
 },

 communityMediaHalf:{
  width:'49.7%',
  height:165
 },

 communityMediaHalfSmall:{
  width:'49.7%',
  height:140
 },

 communityMediaImage:{
  width:'100%',
  height:'100%'
 },


 communityViewerScreen:{
  flex:1,
  backgroundColor:'#000000'
 },

 communityViewerImage:{
  width:'100%',
  height:'100%'
 },

 communityViewerTop:{
  position:'absolute',
  top:0,
  left:0,
  right:0,
  paddingTop:44,
  paddingHorizontal:16,
  flexDirection:'row',
  alignItems:'center',
  justifyContent:'space-between'
 },

 communityViewerCount:{
  color:'#FFFFFF',
  fontSize:13,
  fontWeight:'900',
  textShadowColor:'rgba(0,0,0,.7)',
  textShadowRadius:4
 },

 communityViewerClose:{
  width:42,
  height:42,
  borderRadius:21,
  backgroundColor:'rgba(0,0,0,.55)',
  alignItems:'center',
  justifyContent:'center'
 },

 communityViewerHint:{
  position:'absolute',
  bottom:132,
  alignSelf:'center',
  paddingHorizontal:12,
  paddingVertical:7,
  borderRadius:16,
  backgroundColor:'rgba(0,0,0,.58)',
  color:'#FFFFFF',
  fontSize:10,
  fontWeight:'800'
 },


 communityCommentOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:'rgba(0,0,0,.30)'
 },

 communityCommentDrawer:{
  maxHeight:'88%',
  height:'82%',
  backgroundColor:c.background,
  borderTopLeftRadius:18,
  borderTopRightRadius:18,
  // Keep overflow visible so the write-comment blank + tools are not clipped
  // under the Android keyboard / phone nav pane.
  overflow:'visible'
 },

 communityDrawerHandle:{
  width:42,
  height:4,
  marginTop:8,
  marginBottom:6,
  borderRadius:2,
  alignSelf:'center',
  backgroundColor:'#BAC4BD'
 },

 communityCommentHeader:{
  minHeight:58,
  paddingHorizontal:13,
  paddingBottom:9,
  flexDirection:'row',
  alignItems:'center',
  borderBottomWidth:
   StyleSheet.hairlineWidth,
  borderBottomColor:
   c.line,
  backgroundColor:
   c.white
 },

 communityCommentTitle:{
  fontSize:17,
  fontWeight:'900',
  color:c.text
 },

 communityCommentPostMeta:{
  marginTop:2,
  fontSize:9.5,
  color:c.muted
 },

 communityDrawerClose:{
  width:38,
  height:38,
  alignItems:'center',
  justifyContent:'center'
 },

 communityCommentList:{
  paddingHorizontal:10,
  paddingTop:10,
  paddingBottom:18,
  gap:8
 },

 communityCommentEmpty:{
  paddingVertical:32,
  textAlign:'center',
  fontSize:11,
  color:c.muted
 },

 communityCommentItem:{
  flexDirection:'row',
  alignItems:'flex-start',
  gap:7
 },

 communityReplyItem:{
  marginLeft:22
 },

 communityCommentBubble:{
  paddingHorizontal:10,
  paddingVertical:8,
  backgroundColor:'#F0F3F1',
  borderRadius:10
 },

 communityCommentName:{
  fontSize:14,
  fontWeight:'900',
  color:c.text
 },

 communityCommentMeta:{
  marginTop:1,
  fontSize:12,
  color:c.muted
 },

 communityReplyingTo:{
  marginTop:5,
  fontSize:9,
  fontWeight:'800',
  color:c.greenDark
 },

 communityCommentBody:{
  marginTop:4,
  fontSize:16,
  lineHeight:23,
  color:c.text
 },

 communityCommentActions:{
  marginTop:3,
  paddingLeft:5,
  flexDirection:'row',
  alignItems:'center',
  gap:14
 },

 communityCommentReactButton:{
  flexDirection:'row',
  alignItems:'center',
  gap:3
 },

 communityCommentActionText:{
  fontSize:13,
  fontWeight:'800',
  color:c.muted
 },

 communityCommentActionActive:{
  color:c.greenDark
 },

 communityReplyBanner:{
  paddingHorizontal:12,
  paddingVertical:7,
  flexDirection:'row',
  alignItems:'center',
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   c.line,
  backgroundColor:'#EDF5EF'
 },

 communityReplyBannerLabel:{
  fontSize:12,
  color:c.muted
 },

 communityReplyBannerName:{
  marginTop:1,
  fontSize:14,
  fontWeight:'900',
  color:c.greenDark
 },

 communityCommentComposer:{
  minHeight:62,
  paddingHorizontal:6,
  paddingTop:7,
  paddingBottom:10,
  flexDirection:'row',
  alignItems:'flex-end',
  gap:7,
  borderTopWidth:
   StyleSheet.hairlineWidth,
  borderTopColor:
   c.line,
  backgroundColor:
   c.white
 },

 communityCommentInput:{
  flex:1,
  minHeight:48,
  maxHeight:150,
  paddingHorizontal:8,
  paddingVertical:8,
  borderWidth:1,
  borderColor:c.line,
  borderRadius:12,
  textAlignVertical:'top',
  backgroundColor:
   c.background,
  fontSize: 16,
  },

 communityCommentSend:{
  width:42,
  height:42,
  borderRadius:21,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:
   c.green
 },


 communityReactionOverlay:{
  flex:1,
  justifyContent:'flex-end',
  backgroundColor:
   'rgba(0,0,0,.20)'
 },

 communityReactionPicker:{
  marginBottom:24,
  padding:8,
  flexDirection:'row',
  justifyContent:'space-between',
  gap:3,
  borderRadius:18,
  backgroundColor:
   c.white,
  borderWidth:1,
  borderColor:
   c.line
 },

 communityReactionChoice:{
  flex:1,
  minHeight:57,
  alignItems:'center',
  justifyContent:'center',
  gap:3,
  borderRadius:12
 },

 communityReactionChoiceActive:{
  backgroundColor:
   c.greenSoft
 },

 communityReactionChoiceText:{
  fontSize:7.5,
  fontWeight:'800',
  textAlign:'center',
  color:c.text
 }
,

 communityViewerActions:{
  position:'absolute',
  left:8,
  right:8,
  bottom:0,
  paddingHorizontal:12,
  paddingVertical:6,
  borderRadius:22,
  backgroundColor:'rgba(0,0,0,.52)'
 },

 communityViewerActionTitle:{
  marginBottom:6,
  paddingLeft:3,
  color:'#FFFFFF',
  fontSize:9,
  fontWeight:'800'
 },

 communityViewerReactionRow:{
  flexDirection:'row',
  alignItems:'center',
  gap:4
 },

 communityViewerReactionButton:{
  flex:1,
  minWidth:35,
  height:40,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.14)'
 },

 communityViewerReactionButtonActive:{
  backgroundColor:c.green
 },

 communityViewerReactionCount:{
  position:'absolute',
  top:1,
  right:3,
  minWidth:15,
  height:15,
  paddingHorizontal:3,
  borderRadius:8,
  overflow:'hidden',
  textAlign:'center',
  color:'#FFFFFF',
  backgroundColor:c.greenDark,
  fontSize:8,
  fontWeight:'900'
 },

 communityViewerSaveButton:{
  minWidth:52,
  height:40,
  paddingHorizontal:6,
  borderRadius:20,
  alignItems:'center',
  justifyContent:'center',
  backgroundColor:'rgba(255,255,255,.16)'
 },

 communityViewerSaveText:{
  marginTop:1,
  color:'#FFFFFF',
  fontSize:7.5,
  fontWeight:'800'
 },

 communityViewerReactionSummary:{
  marginTop:0,
  paddingLeft:0,
  color:'#E7EFEA',
  fontSize:11
 }
  });
}
