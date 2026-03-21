import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Vibration,
  NativeModules,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

type CodeVerifyNavProp = StackNavigationProp<RootStackParamList, 'CodeVerify'>;
type CodeVerifyRouteProp = RouteProp<RootStackParamList, 'CodeVerify'>;

const CODE_LENGTH = 6;
const VERIFY_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// CodeVerifyScreen
// ---------------------------------------------------------------------------

export function CodeVerifyScreen() {
  const navigation = useNavigation<CodeVerifyNavProp>();
  const route = useRoute<CodeVerifyRouteProp>();
  const { deviceId, host, port, deviceName } = route.params;

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // -----------------------------------------------------------------------
  // Submit code — try native module, fallback to mock
  // -----------------------------------------------------------------------

  const submitCode = useCallback(
    async (fullCode: string) => {
      setVerifying(true);
      setError(false);

      try {
        const { NativeSyncEngine } = NativeModules;
        if (NativeSyncEngine) {
          await NativeSyncEngine.pairDevice({
            deviceId,
            host,
            port,
            connectionCode: fullCode,
          });
          setVerifying(false);
          navigation.replace('SyncStatus');
          return;
        }
      } catch (e) {
        console.warn('Native pairing failed or unavailable, falling back to mock');
        // If native module threw an actual pairing error, show error state
        setVerifying(false);
        setError(true);
        setCode(Array(CODE_LENGTH).fill(''));
        Vibration.vibrate(300);
        inputRefs.current[0]?.focus();
        return;
      }

      // Mock fallback: always succeed after delay
      setTimeout(() => {
        setVerifying(false);
        navigation.replace('SyncStatus');
      }, VERIFY_DELAY_MS);
    },
    [navigation, deviceId, host, port],
  );

  // -----------------------------------------------------------------------
  // Handle digit input
  // -----------------------------------------------------------------------

  const handleChangeText = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1);

      const newCode = [...code];
      newCode[index] = digit;
      setCode(newCode);
      setError(false);

      if (digit && index < CODE_LENGTH - 1) {
        // Advance focus to next box
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when 6th digit entered
      if (index === CODE_LENGTH - 1 && digit) {
        const fullCode = newCode.join('');
        if (fullCode.length === CODE_LENGTH) {
          submitCode(fullCode);
        }
      }
    },
    [code, submitCode],
  );

  // -----------------------------------------------------------------------
  // Handle backspace on empty box -> move to previous
  // -----------------------------------------------------------------------

  const handleKeyPress = useCallback(
    (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Device name context */}
        <Text style={styles.deviceLabel}>{'\u6B63\u5728\u8FDE\u63A5'}: {deviceName}</Text>

        {/* Prompt */}
        <Text style={styles.prompt}>{'\u8BF7\u8F93\u5165\u7535\u8111\u7AEF\u663E\u793A\u7684 6 \u4F4D\u8FDE\u63A5\u7801'}</Text>

        {/* Code input boxes */}
        <View style={styles.codeRow}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.codeBox,
                digit ? styles.codeBoxFilled : styles.codeBoxEmpty,
                error && styles.codeBoxError,
                verifying && styles.codeBoxDisabled,
              ]}
              value={digit}
              onChangeText={(value) => handleChangeText(index, value)}
              onKeyPress={(e) => handleKeyPress(index, e)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={index === 0}
              editable={!verifying}
              selectTextOnFocus
              textContentType="oneTimeCode"
            />
          ))}
        </View>

        {/* Status: verifying */}
        {verifying && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>{'\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5\u7801...'}</Text>
          </View>
        )}

        {/* Status: error */}
        {error && (
          <Text style={styles.errorText}>{'\u8FDE\u63A5\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165'}</Text>
        )}

        {/* Help text */}
        <View style={styles.helpCard}>
          <Text style={styles.helpText}>
            {'\u8BF7\u786E\u4FDD\u624B\u673A\u4E0E\u7535\u8111\u5904\u4E8E\u540C\u4E00\u5C40\u57DF\u7F51\u4E0B\uFF0C\u5728\u7535\u8111\u7AEF\u6253\u5F00\u5E94\u7528\u5373\u53EF\u770B\u5230\u8FDE\u63A5\u7801'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#c4e4f5',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  // Device label
  deviceLabel: {
    fontSize: 13,
    color: '#6a96b8',
    marginBottom: 24,
  },

  // Prompt
  prompt: {
    fontSize: 14,
    color: colors.foreground,
    opacity: 0.7,
    letterSpacing: 0.5,
    marginBottom: 32,
  },

  // Code row
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  codeBox: {
    width: 44,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  codeBoxEmpty: {
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  codeBoxFilled: {
    borderColor: 'rgba(42,108,181,0.4)',
    backgroundColor: '#ffffff',
  },
  codeBoxError: {
    borderColor: colors.destructive,
  },
  codeBoxDisabled: {
    opacity: 0.6,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 14,
    color: colors.primary,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    marginTop: 4,
  },

  // Help card
  helpCard: {
    marginTop: 40,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(26,42,60,0.5)',
    lineHeight: 18,
    textAlign: 'center',
  },
});
