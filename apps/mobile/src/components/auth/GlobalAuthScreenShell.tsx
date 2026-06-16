import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const GLOBAL_AUTH_COLORS = {
  background: '#F7FBFF',
  surface: '#FFFFFF',
  surfaceBorder: '#DCE9FB',
  primary: '#1677D2',
  primaryPressed: '#0F66B7',
  primaryDisabled: '#C9D6E4',
  primaryTextDisabled: '#7B8490',
  text: '#17191C',
  textMuted: '#59616D',
  textFaint: '#7B8490',
  inputBackground: '#FAFCFF',
  inputBorder: '#DDE8F4',
  inputBorderStrong: '#1677D2',
  danger: '#E24D4D',
  link: '#1677D2',
} as const;

interface GlobalAuthScreenShellProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function GlobalAuthScreenShell({
  children,
  contentStyle,
}: GlobalAuthScreenShellProps) {
  return (
    <View style={styles.root}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="globalAuthBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFCF7" stopOpacity={0.98} />
            <Stop offset="38%" stopColor="#F7FCFF" stopOpacity={0.94} />
            <Stop offset="68%" stopColor="#EFF8FF" stopOpacity={0.92} />
            <Stop offset="100%" stopColor="#FFF8DC" stopOpacity={0.62} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#globalAuthBg)" />
      </Svg>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={GLOBAL_AUTH_COLORS.background}
      />
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            bounces={false}
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GLOBAL_AUTH_COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardRoot: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
});
