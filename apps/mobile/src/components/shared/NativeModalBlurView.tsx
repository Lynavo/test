import React from 'react';
import {
  Platform,
  UIManager,
  View,
  requireNativeComponent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

export type NativeModalBlurStyle =
  | 'regular'
  | 'prominent'
  | 'extraLight'
  | 'light'
  | 'dark'
  | 'systemMaterial'
  | 'systemMaterialLight'
  | 'systemMaterialDark'
  | 'systemThinMaterial'
  | 'systemThinMaterialLight'
  | 'systemThinMaterialDark'
  | 'systemUltraThinMaterial'
  | 'systemUltraThinMaterialLight'
  | 'systemUltraThinMaterialDark';

interface NativeVividropBlurViewProps extends ViewProps {
  blurStyle?: NativeModalBlurStyle;
  intensity?: number;
}

interface NativeModalBlurViewProps {
  blurStyle?: NativeModalBlurStyle;
  fallbackColor?: string;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

const nativeComponentName = 'VividropBlurView';
const hasNativeBlurView =
  (Platform.OS === 'ios' || Platform.OS === 'android') &&
  typeof UIManager.getViewManagerConfig === 'function' &&
  UIManager.getViewManagerConfig(nativeComponentName) != null;

const NativeVividropBlurView = hasNativeBlurView
  ? requireNativeComponent<NativeVividropBlurViewProps>(nativeComponentName)
  : null;

export function NativeModalBlurView({
  blurStyle = 'systemUltraThinMaterial',
  fallbackColor = 'rgba(238,243,247,0.42)',
  intensity = 0.08,
  style,
}: NativeModalBlurViewProps) {
  if (NativeVividropBlurView) {
    return (
      <NativeVividropBlurView
        blurStyle={blurStyle}
        intensity={intensity}
        pointerEvents="none"
        style={style}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[style, { backgroundColor: fallbackColor }]}
    />
  );
}
