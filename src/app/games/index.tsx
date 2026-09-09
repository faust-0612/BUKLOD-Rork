import React from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const GAME_CARDS = [
  {
    href: '/games/jawo-forest-trail' as const,
    character: 'Jawo',
    world: 'Whispering Forest',
    title: 'Forest Trail',
    mechanic: 'Swipe movement • obstacle reading • Trail Light collection • combo flow',
  },
  {
    href: '/games/trudice-playground-memory' as const,
    character: 'Trudice',
    world: "Children's Haven",
    title: 'Wonder Path',
    mechanic: 'Spatial sequence memory • progressive rounds • playground station interaction',
  },
  {
    href: '/games/ace-rescue-grid' as const,
    character: 'Ace',
    world: 'Strategy District',
    title: 'Rescue Grid',
    mechanic: 'Tactical routing • limited energy • rescue beacons • extraction planning',
  },
  {
    href: '/games/mitch-restore-mural' as const,
    character: 'Mitch',
    world: 'Art Village',
    title: 'Restore the Mural',
    mechanic: 'Direct drag restoration • precision placement • combo scoring • staged visual reveal',
  },
];

export default function BuklodGameLabScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.kicker}>BUKLOD KINGDOM</Text>
        <Text style={styles.title}>Game Lab</Text>
        <Text style={styles.copy}>
          Standalone premium gameplay modules. They intentionally do not write character XP, Kingdom progress, Circle Rank, or collectibles yet.
        </Text>
      </View>

      <View style={styles.grid}>
        {GAME_CARDS.map((game) => (
          <Link key={game.href} href={game.href} style={styles.link}>
            <View style={styles.card}>
              <Text style={styles.character}>{game.character}</Text>
              <Text style={styles.world}>{game.world}</Text>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.mechanic}>{game.mechanic}</Text>
              <Text style={styles.play}>PLAY GAME LAB →</Text>
            </View>
          </Link>
        ))}
      </View>

      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Integration rule</Text>
        <Text style={styles.ruleText}>
          Game Lab → verify gameplay → connect final character art and animation → attach result contract → place the game at its Kingdom map station → persist rewards and visible world changes. No game directly mutates live Kingdom progress before that integration stage.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: '#07130d',
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 72,
    gap: 24,
  },
  header: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    gap: 8,
  },
  kicker: {
    color: '#d5b85a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
  },
  copy: {
    color: '#b9cdbf',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  grid: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  link: {
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 300,
    textDecorationLine: 'none',
  },
  card: {
    minHeight: 230,
    borderRadius: 22,
    backgroundColor: '#10251a',
    borderWidth: 1,
    borderColor: '#294b37',
    padding: 20,
    gap: 6,
  },
  character: {
    color: '#d5b85a',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  world: {
    color: '#91b59d',
    fontSize: 13,
    fontWeight: '700',
  },
  gameTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 12,
  },
  mechanic: {
    color: '#c6d7cb',
    fontSize: 15,
    lineHeight: 22,
    flexGrow: 1,
  },
  play: {
    color: '#f3d779',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
  },
  ruleCard: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    borderRadius: 18,
    backgroundColor: '#0e2017',
    padding: 18,
    gap: 6,
  },
  ruleTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  ruleText: {
    color: '#a9c0af',
    lineHeight: 21,
  },
});
