import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ChildSafetyPage() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>BUKLOD Child Safety Standards</Text>

        <Text style={styles.text}>
          BUKLOD has zero tolerance for child sexual abuse and exploitation
          (CSAE) and child sexual abuse material (CSAM).
        </Text>

        <Text style={styles.text}>
          Users must not create, upload, share, request, promote, or facilitate
          content or conduct that sexually exploits, abuses, grooms, traffics,
          or endangers minors.
        </Text>

        <Text style={styles.text}>
          BUKLOD may remove prohibited content, restrict or terminate accounts,
          preserve relevant evidence when legally appropriate, and cooperate
          with competent law-enforcement or child-protection authorities.
        </Text>

        <Text style={styles.text}>
          Users may report suspected child-safety violations through BUKLOD's
          in-app reporting tools. Reports involving suspected CSAE or CSAM are
          reviewed and acted upon in accordance with applicable laws and
          BUKLOD's safety standards.
        </Text>

        <Text style={styles.text}>
          BUKLOD complies with applicable child-safety laws and maintains
          procedures for reporting confirmed CSAM to appropriate regional or
          national authorities where required.
        </Text>

        <Text style={styles.subtitle}>Child Safety Contact</Text>

        <Text style={styles.text}>
          For child-safety concerns related to BUKLOD, contact:
          efmagaj@gmail.com
        </Text>

        <Text style={styles.footer}>
          BUKLOD — MZB Ministry Inc.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 850,
    backgroundColor: '#ffffff',
    padding: 28,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 16,
  },
  footer: {
    marginTop: 28,
    fontSize: 14,
    opacity: 0.7,
  },
});