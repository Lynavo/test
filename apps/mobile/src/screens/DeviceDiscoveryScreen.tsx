import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function DeviceDiscoveryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>搜索设备</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#daeef8', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a3a5c' },
});
