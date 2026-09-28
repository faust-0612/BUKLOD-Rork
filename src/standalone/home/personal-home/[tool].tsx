import { Redirect, useLocalSearchParams } from 'expo-router';

import PersonalHomeBudgetScreen from '@/app/personal-home/budget';
import PersonalHomeMediaScreen from '@/app/personal-home/media';
import PersonalHomeRecipeScreen from '@/app/personal-home/recipe';
import PersonalHomeRemindersScreen from '@/app/personal-home/reminders';

const TOOLS = {
  budget: PersonalHomeBudgetScreen,
  media: PersonalHomeMediaScreen,
  recipe: PersonalHomeRecipeScreen,
  reminders: PersonalHomeRemindersScreen,
} as const;

export default function PersonalHomeToolRoute() {
  const params = useLocalSearchParams<{ tool?: string | string[] }>();
  const raw = Array.isArray(params.tool) ? params.tool[0] : params.tool;
  const Tool = raw ? TOOLS[raw as keyof typeof TOOLS] : undefined;

  if (!Tool) {
    return <Redirect href="/" />;
  }

  return <Tool />;
}
