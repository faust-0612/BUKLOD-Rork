import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

const icon = (name: any, color: ColorValue, size: number) => <MaterialCommunityIcons name={name} color={color} size={size} />;
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown:false, tabBarActiveTintColor:'#1f7a3f', tabBarInactiveTintColor:'#758078', tabBarStyle:{height:66,paddingBottom:8,paddingTop:6,borderTopColor:'#e1e8e2'} }}>
    <Tabs.Screen name="home" options={{ title:'Classrooms', tabBarIcon:({color,size})=>icon('school-outline',color,size) }} />
    <Tabs.Screen name="tasks" options={{ title:'To Do', tabBarIcon:({color,size})=>icon('checkbox-marked-circle-outline',color,size) }} />
    <Tabs.Screen name="grades" options={{ title:'Grades', tabBarIcon:({color,size})=>icon('chart-box-outline',color,size) }} />
    <Tabs.Screen name="profile" options={{ title:'Me', tabBarIcon:({color,size})=>icon('account-circle-outline',color,size) }} />
  </Tabs>;
}
