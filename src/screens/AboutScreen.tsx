import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function AboutScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.appName}>דברי</Text>
      <Text style={styles.description}>העוזרת הקולית בעברית</Text>
      <Text style={styles.version}>גרסה 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1A1A1A',
    writingDirection: 'rtl',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    color: '#666666',
    writingDirection: 'rtl',
    textAlign: 'center',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#aaa',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});
