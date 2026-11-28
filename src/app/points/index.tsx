import React from 'react';
import {Redirect} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import BuklodPointsRewardsScreen from '@/components/points/BuklodPointsRewardsScreen';
export default function PointsRoute(){
 const {hasRole}=useAuth();
 return hasRole('system_admin')?<Redirect href="/admin/buklod-official"/>:<BuklodPointsRewardsScreen/>;
}
