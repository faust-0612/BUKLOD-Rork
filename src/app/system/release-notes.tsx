import { ScrollView, Text } from 'react-native';
import Constants from 'expo-constants';
import { Card, shared } from '@/components/UI';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function ReleaseNotes(){
  const {config}=useRuntimeConfig();
  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>{config?.release_title || "What's New"}</Text>
      <Text style={shared.muted}>App version {Constants.expoConfig?.version || '—'}</Text>
      <Card>
        <Text style={shared.body}>
          {config?.release_notes || 'No release notes are currently published.'}
        </Text>
      </Card>
    </ScrollView>
  )
}
