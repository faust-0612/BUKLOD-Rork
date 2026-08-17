import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function ChurchesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .order('name');

    if (error) {
      Alert.alert('Churches', error.message);
      return;
    }

    setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      return Alert.alert('Church', 'Name is required.');
    }

    const { error } = await supabase.rpc('create_church', {
      p_name: name.trim(),
      p_code: code.trim() || null
    });

    if (error) {
      return Alert.alert('Could not create church', error.message);
    }

    setName('');
    setCode('');
    await load();

    Alert.alert('Local Church', 'Local church created successfully.');
  };

  const beginEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name ?? '');
    setEditCode(item.code ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCode('');
  };

  const saveEdit = async () => {
    if (!editingId) return;

    if (!editName.trim()) {
      return Alert.alert('Church', 'Name is required.');
    }

    const { error } = await supabase
      .from('churches')
      .update({
        name: editName.trim(),
        code: editCode.trim() || null
      })
      .eq('id', editingId);

    if (error) {
      return Alert.alert('Could not update church', error.message);
    }

    cancelEdit();
    await load();

    Alert.alert('Local Church', 'Changes saved.');
  };

  const toggleActive = (item: any) => {
    const nextActive = !item.is_active;

    Alert.alert(
      nextActive ? 'Activate local church?' : 'Deactivate local church?',
      nextActive
        ? `Activate ${item.name}?`
        : `Deactivate ${item.name}? Existing records will remain ?????ed and members will not be deleted.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: nextActive ? 'ACTIVATE' : 'DEACTIVATE',
          style: nextActive ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('churches')
              .update({ is_active: nextActive })
              .eq('id', item.id);

            if (error) {
              return Alert.alert(
                'Could not update church',
                error.message
              );
            }

            await load();
          }
        }
      ]
    );
  };

  return (
    <AdminGate>
      <FlatList
        style={shared.screen}
        contentContainerStyle={shared.content}
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Local Churches</Text>

            <SectionTitle>ADD LOCAL CHURCH</SectionTitle>

            <Card>
              <TextInput
                style={styles.input}
                placeholder="Church name"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.input}
                placeholder="Code (optional)"
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
              />

              <Button title="ADD CHURCH" onPress={create} />
            </Card>

            <SectionTitle>LOCAL CHURCHES</SectionTitle>
          </View>
        }
        renderItem={({ item }) => {
          const editing = editingId === item.id;

          return (
            <Card>
              {editing ? (
                <>
                  <Text style={shared.muted}>EDIT LOCAL CHURCH</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Church name"
                    value={editName}
                    onChangeText={setEditName}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Code (optional)"
                    autoCapitalize="characters"
                    value={editCode}
                    onChangeText={setEditCode}
                  />

                  <Button title="SAVE CHANGES" onPress={saveEdit} />

                  <View style={{ height: 8 }} />

                  <Button
                    title="CANCEL"
                    outline
                    onPress={cancelEdit}
                  />
                </>
              ) : (
                <>
                  <Text style={shared.h2}>{item.name}</Text>

                  <Text style={shared.muted}>
                    {item.code || 'No code'} ? {item.is_active ? 'Active' : 'Inactive'}
                  </Text>

                  <View style={{ height: 10 }} />

                  <Button
                    title="EDIT LOCAL"
                    outline
                    onPress={() => beginEdit(item)}
                  />

                  <View style={{ height: 8 }} />

                  <Button
                    title={item.is_active ? 'DEACTIVATE LOCAL' : 'ACTIVATE LOCAL'}
                    outline
                    onPress={() => toggleActive(item)}
                  />
                </>
              )}
            </Card>
          );
        }}
      />
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    marginBottom: 8
  }
});
