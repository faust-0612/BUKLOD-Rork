import { Redirect, useLocalSearchParams } from 'expo-router';
export default function IgpatPost() {
  const {postId}=useLocalSearchParams<{postId:string}>();
  if(!postId)return <Redirect href="/igpat" />;
  return <Redirect href={('/post/'+encodeURIComponent(postId)) as any} />;
}
