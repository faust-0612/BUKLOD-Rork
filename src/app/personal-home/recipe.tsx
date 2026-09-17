import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Recipe = {
  title: string;
  summary: string;
  ingredients: string[];
  steps: string[];
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  safety_note: string;
};

export default function PersonalHomeRecipeScreen() {
  const { profile } = useAuth();
  const userId = String(profile?.id ?? 'guest');
  const storageKey = useMemo(() => `buklod.personal-home.recipe.${userId}`, [userId]);
  const [request, setRequest] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [servings, setServings] = useState('2');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value);
        if (parsed?.title && Array.isArray(parsed?.ingredients) && Array.isArray(parsed?.steps)) {
          setRecipe(parsed);
        }
      } catch {
        // Ignore corrupt local cache; generation remains available.
      }
    });
  }, [storageKey]);

  const generate = async () => {
    const cleanRequest = request.trim();
    const ingredientList = ingredients
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!cleanRequest && !ingredientList.length) {
      setError('Ilagay ang gustong lutuin o mga ingredients na meron ka.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-home-ai', {
        body: {
          action: 'recipe',
          request: cleanRequest,
          ingredients: ingredientList,
          servings: Math.max(1, Math.min(20, Number(servings) || 2)),
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.recipe) throw new Error(data?.error || 'Walang recipe na naibalik.');
      const next = data.recipe as Recipe;
      setRecipe(next);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch (err: any) {
      setError(String(err?.message || 'Hindi makagawa ng recipe ngayon. Subukan muli.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={23} color="#234434" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>AI Recipe</Text>
          <Text style={styles.subtitle}>Sabihin kung anong gusto mong lutuin o kung anong meron sa kusina.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Anong gusto mong lutuin?</Text>
        <TextInput
          value={request}
          onChangeText={setRequest}
          placeholder="Hal. mabilis na ulam para sa hapunan"
          placeholderTextColor="#829083"
          style={styles.input}
        />
        <Text style={styles.label}>Ingredients na meron ka</Text>
        <TextInput
          value={ingredients}
          onChangeText={setIngredients}
          placeholder="manok, bawang, toyo, suka..."
          placeholderTextColor="#829083"
          style={[styles.input, styles.multi]}
          multiline
        />
        <Text style={styles.label}>Servings</Text>
        <TextInput
          value={servings}
          onChangeText={setServings}
          keyboardType="number-pad"
          style={[styles.input, styles.servings]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={generate} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="creation" size={19} color="#FFFFFF" />}
          <Text style={styles.primaryText}>{busy ? 'Gumagawa…' : 'Gumawa ng Recipe'}</Text>
        </Pressable>
      </View>

      {recipe ? (
        <View style={styles.card}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <Text style={styles.summary}>{recipe.summary}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{recipe.servings} servings</Text>
            <Text style={styles.meta}>Prep {recipe.prep_minutes}m</Text>
            <Text style={styles.meta}>Cook {recipe.cook_minutes}m</Text>
          </View>
          <Text style={styles.section}>Ingredients</Text>
          {recipe.ingredients.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.rowText}>• {item}</Text>
          ))}
          <Text style={styles.section}>Paraan</Text>
          {recipe.steps.map((item, index) => (
            <Text key={`${index}-${item}`} style={styles.rowText}>{index + 1}. {item}</Text>
          ))}
          {recipe.safety_note ? <Text style={styles.safety}>Safety: {recipe.safety_note}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F0E6' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6D7CB' },
  title: { fontSize: 24, fontWeight: '900', color: '#22382C' },
  subtitle: { marginTop: 3, color: '#66756A', fontSize: 12, lineHeight: 17 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#DADBCF' },
  label: { color: '#324B3B', fontWeight: '900', fontSize: 12, marginBottom: 6, marginTop: 6 },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#CFD6CF', paddingHorizontal: 12, color: '#21392B', backgroundColor: '#FBFCF9' },
  multi: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  servings: { maxWidth: 110 },
  primary: { marginTop: 15, minHeight: 48, borderRadius: 14, backgroundColor: '#2D6B4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.65 },
  error: { marginTop: 10, color: '#A43E35', fontWeight: '700', fontSize: 12 },
  recipeTitle: { fontSize: 22, fontWeight: '900', color: '#22382C' },
  summary: { marginTop: 6, color: '#5E6D62', lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  meta: { backgroundColor: '#EEF5EF', color: '#2D6B4F', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  section: { marginTop: 17, marginBottom: 6, color: '#2D6B4F', fontSize: 14, fontWeight: '900' },
  rowText: { color: '#34483A', lineHeight: 20, marginBottom: 5 },
  safety: { marginTop: 15, padding: 11, borderRadius: 12, backgroundColor: '#FFF7E4', color: '#735E2F', lineHeight: 18, fontSize: 12 },
});
