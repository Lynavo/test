import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { DiscoveredDeviceDTO, RecentDesktopDTO } from '@syncflow/contracts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { ModalBlurBackdrop } from '../components/shared/ModalBlurBackdrop';
import { NativeModalBlurView } from '../components/shared/NativeModalBlurView';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useRecentDesktops } from '../stores/recent-desktops-store';
import {
  hasSeenUnconnectedGuide,
  markUnconnectedGuideSeen,
} from '../utils/onboardingStorage';
import { isVisualQaEnabled } from '../dev/visualQa';
import { buildManualPairDevice } from './deviceDiscoveryManualPairing';
import { shouldKeepCachedDevicesVisible } from './deviceDiscoveryRefresh';

type NavigationProp = StackNavigationProp<
  RootStackParamList,
  'DeviceDiscovery'
>;

type DiscoveredDevice = Pick<
  DiscoveredDeviceDTO,
  'deviceId' | 'name' | 'ip' | 'type' | 'port'
> & {
  availability?: DeviceAvailability;
  deviceKind?: 'desktop' | 'laptop';
};

type DeviceAvailability = 'available' | 'busy';
type ConnectionFlowStatus =
  | 'scanning'
  | 'ready'
  | 'empty'
  | 'failed'
  | 'timeout'
  | 'cameraDenied';
type ConnectionModalStep = 'method' | 'manualPair' | 'cameraPermission' | 'code';
type FlowStateTone = 'neutral' | 'danger' | 'warning';
type FlowStateContent = {
  title: string;
  description: string;
  actionLabel: string;
  icon: string;
  tone: FlowStateTone;
  onAction: () => void;
};

type SpotlightLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const VISUAL_QA_LAN_DEVICES: DiscoveredDevice[] = [
  {
    deviceId: 'visual-qa-openimde-mac-mini',
    name: 'openimdeMac-mini',
    ip: '192.168.31.21',
    type: 'mac',
    port: 39393,
    availability: 'available',
    deviceKind: 'desktop',
  },
  {
    deviceId: 'visual-qa-macbook-pro',
    name: 'MacBook Pro',
    ip: '192.168.31.36',
    type: 'mac',
    port: 39393,
    availability: 'available',
    deviceKind: 'laptop',
  },
  {
    deviceId: 'visual-qa-windows-workstation',
    name: 'Windows Workstation',
    ip: '192.168.31.52',
    type: 'win',
    port: 39393,
    availability: 'busy',
    deviceKind: 'desktop',
  },
];

function PulseDot() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.scanDot, { opacity }]} />;
}

export function DeviceDiscoveryGlobalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeviceDiscovery'>>();
  const insets = useSafeAreaInsets();
  const mode = route.params?.mode ?? 'initial';
  const { recentDesktops, addDesktop } = useRecentDesktops();

  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(true);
  const [manualHost, setManualHost] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(
    null,
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionFlowStatus>('scanning');
  const [connectionModalStep, setConnectionModalStep] =
    useState<ConnectionModalStep | null>(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [spotlightLayout, setSpotlightLayout] =
    useState<SpotlightLayout | null>(null);
  const containerRef = useRef<React.ElementRef<typeof View>>(null);
  const devicesCardRef = useRef<React.ElementRef<typeof View>>(null);
  const devicesRef = useRef<DiscoveredDevice[]>([]);
  const preserveCachedDevicesRef = useRef(false);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    if (mode === 'switch') {
      setShowGuide(false);
      return;
    }

    let cancelled = false;
    void hasSeenUnconnectedGuide().then(seen => {
      if (!cancelled) {
        setShowGuide(!seen);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    preserveCachedDevicesRef.current = devicesRef.current.length > 0;
    setScanning(devicesRef.current.length === 0);
    setConnectionStatus(devicesRef.current.length === 0 ? 'scanning' : 'ready');

    let subscription: { remove: () => void } | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let visualQaTimer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    if (isVisualQaEnabled()) {
      visualQaTimer = setTimeout(() => {
        if (!active || devicesRef.current.length > 0) return;
        preserveCachedDevicesRef.current = false;
        setDevices(VISUAL_QA_LAN_DEVICES);
        setScanning(false);
        setConnectionStatus('ready');
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = undefined;
        }
      }, 900);
    }

    try {
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        timeoutTimer = setTimeout(() => {
          preserveCachedDevicesRef.current = false;
          setScanning(false);
          setConnectionStatus('empty');
        }, 8000);
        return () => {
          if (visualQaTimer) clearTimeout(visualQaTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
        };
      }

      const emitter = new NativeEventEmitter(NativeSyncEngine);
      subscription = emitter.addListener(
        'onDiscoveredDevicesChanged',
        (nextDevices: DiscoveredDevice[]) => {
          if (
            shouldKeepCachedDevicesVisible({
              currentDeviceCount: devicesRef.current.length,
              nextDeviceCount: nextDevices.length,
              preserveCachedDevices: preserveCachedDevicesRef.current,
            })
          ) {
            return;
          }

          preserveCachedDevicesRef.current = false;
          setDevices(nextDevices);
          if (nextDevices.length > 0) {
            setScanning(false);
            setConnectionStatus('ready');
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = undefined;
            }
          }
        },
      );

      NativeSyncEngine.stopDiscovery()
        .catch(() => undefined)
        .then(() => {
          if (!active) return undefined;
          return NativeSyncEngine.startDiscovery();
        })
        .catch(() => undefined);

      timeoutTimer = setTimeout(() => {
        preserveCachedDevicesRef.current = false;
        setScanning(false);
        if (devicesRef.current.length === 0) {
          setConnectionStatus('empty');
        }
      }, 8000);
    } catch {
      timeoutTimer = setTimeout(() => {
        preserveCachedDevicesRef.current = false;
        setScanning(false);
        if (devicesRef.current.length === 0) {
          setConnectionStatus('empty');
        }
      }, 8000);
    }

    return () => {
      active = false;
      subscription?.remove();
      if (visualQaTimer) clearTimeout(visualQaTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      preserveCachedDevicesRef.current = false;
      try {
        NativeModules.NativeSyncEngine?.stopDiscovery?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const discoveredCount = devices.length + recentDesktops.length;
  const isShowingSkeleton = scanning && discoveredCount === 0;
  const statusLabel = isShowingSkeleton
    ? '扫描中...'
    : `已发现 ${discoveredCount} 台`;

  const measureGuideTarget = useCallback(() => {
    const containerNode = containerRef.current;
    const devicesCardNode = devicesCardRef.current;
    if (
      !containerNode ||
      !devicesCardNode ||
      typeof containerNode.measureInWindow !== 'function' ||
      typeof devicesCardNode.measureInWindow !== 'function'
    ) {
      return;
    }

    containerNode.measureInWindow((containerX, containerY) => {
      devicesCardNode.measureInWindow((cardX, cardY, width, height) => {
        if (width <= 0 || height <= 0) return;
        const nextLayout = {
          x: cardX - containerX,
          y: cardY - containerY,
          width,
          height,
        };
        setSpotlightLayout(previous => {
          if (
            previous &&
            Math.abs(previous.x - nextLayout.x) < 1 &&
            Math.abs(previous.y - nextLayout.y) < 1 &&
            Math.abs(previous.width - nextLayout.width) < 1 &&
            Math.abs(previous.height - nextLayout.height) < 1
          ) {
            return previous;
          }
          return nextLayout;
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!showGuide) {
      setSpotlightLayout(null);
      return undefined;
    }

    const frame = requestAnimationFrame(measureGuideTarget);
    return () => cancelAnimationFrame(frame);
  }, [
    showGuide,
    isShowingSkeleton,
    devices.length,
    recentDesktops.length,
    connectionStatus,
    measureGuideTarget,
  ]);

  const goBack = useCallback(() => {
    if (mode === 'switch' || navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [mode, navigation]);

  const openMethodModal = useCallback((device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setConnectionCode('');
    setCodeError(null);
    if (device.availability === 'busy') {
      setConnectionStatus('timeout');
      return;
    }
    setConnectionStatus('ready');
    setConnectionModalStep('method');
  }, []);

  const openRecentDesktop = useCallback(
    (recent: RecentDesktopDTO) => {
      const device: DiscoveredDevice = {
        deviceId: recent.desktopDeviceId,
        name: recent.desktopName,
        ip: recent.host,
        port: recent.port,
        type: 'mac',
      };
      openMethodModal(device);
    },
    [openMethodModal],
  );

  const handleManualPair = useCallback(() => {
    const manualDevice = buildManualPairDevice(manualHost);
    if (!manualDevice) {
      setManualError('请输入有效的 IP 地址或主机名');
      return;
    }
    setManualError(null);
    setSelectedDevice(manualDevice);
    setConnectionCode('');
    setCodeError(null);
    setConnectionStatus('ready');
    setConnectionModalStep('code');
  }, [manualHost]);

  const handleVerifyCode = useCallback(async () => {
    if (!selectedDevice || !connectionCode.trim()) return;

    const normalizedCode = connectionCode.trim().toUpperCase();
    setVerifying(true);
    setCodeError(null);
    try {
      if (isVisualQaEnabled()) {
        if (normalizedCode !== 'A8X2K9') {
          setVerifying(false);
          setConnectionModalStep(null);
          setConnectionStatus('failed');
          return;
        }

        await addDesktop({
          desktopDeviceId: selectedDevice.deviceId,
          desktopName: selectedDevice.name,
          host: selectedDevice.ip,
          port: selectedDevice.port || 39393,
          authorizationStatus: 'authorized',
        });
        setVerifying(false);
        setConnectionModalStep(null);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'SyncActivity' }],
          }),
        );
        return;
      }

      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        throw new Error('NativeSyncEngine unavailable');
      }

      await NativeSyncEngine.pairDevice({
        deviceId: selectedDevice.deviceId,
        host: selectedDevice.ip,
        port: selectedDevice.port || 39393,
        connectionCode: normalizedCode,
      });
      await addDesktop({
        desktopDeviceId: selectedDevice.deviceId,
        desktopName: selectedDevice.name,
        host: selectedDevice.ip,
        port: selectedDevice.port || 39393,
        authorizationStatus: 'authorized',
      });

      setVerifying(false);
      setConnectionModalStep(null);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'SyncActivity' }],
        }),
      );
    } catch {
      setVerifying(false);
      setConnectionModalStep(null);
      setConnectionStatus('failed');
    }
  }, [addDesktop, connectionCode, navigation, selectedDevice]);

  const handleRescan = useCallback(() => {
    setDevices([]);
    setScanning(true);
    setConnectionStatus('scanning');
    if (isVisualQaEnabled()) {
      setTimeout(() => {
        setDevices(VISUAL_QA_LAN_DEVICES);
        setScanning(false);
        setConnectionStatus('ready');
      }, 900);
      return;
    }
    try {
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        setTimeout(() => {
          setScanning(false);
          setConnectionStatus('empty');
        }, 8000);
        return;
      }
      NativeSyncEngine.stopDiscovery()
        .catch(() => undefined)
        .then(() => NativeSyncEngine.startDiscovery())
        .catch(() => undefined);
      setTimeout(() => {
        setScanning(false);
        if (devicesRef.current.length === 0) {
          setConnectionStatus('empty');
        }
      }, 8000);
    } catch {
      setScanning(false);
      setConnectionStatus('empty');
    }
  }, []);

  const connectionStateContent: FlowStateContent | null =
    !isShowingSkeleton && connectionStatus === 'empty'
      ? {
          title: '未发现可连接设备',
          description:
            '没有扫到同一局域网内的电脑，请确认电脑端已打开并连接同一 Wi‑Fi。',
          actionLabel: '手动配对',
          icon: 'desktop-outline',
          tone: 'neutral',
          onAction: () => {
            setManualHost('');
            setManualError(null);
            setConnectionModalStep('manualPair');
          },
        }
      : !isShowingSkeleton && connectionStatus === 'failed'
        ? {
            title: '连接失败',
            description:
              '连接码错误或电脑端拒绝了本次配对，请重新输入电脑端显示的 6 位连接码。',
            actionLabel: '重新输入',
            icon: 'alert-circle-outline',
            tone: 'danger',
            onAction: () => {
              setConnectionCode('');
              setCodeError(null);
              setConnectionModalStep('code');
            },
          }
        : !isShowingSkeleton && connectionStatus === 'timeout'
          ? {
              title: '连接超时',
              description: '电脑端长时间没有响应，可能正在使用中或客户端离线。',
              actionLabel: '再次扫描',
              icon: 'time-outline',
              tone: 'warning',
              onAction: handleRescan,
            }
          : !isShowingSkeleton && connectionStatus === 'cameraDenied'
            ? {
                title: '相机权限被拒绝',
                description:
                  '无法打开相机扫码，可以改用电脑端显示的连接码完成配对。',
                actionLabel: '输入连接码',
                icon: 'camera-outline',
                tone: 'warning',
                onAction: () => {
                  setConnectionCode('');
                  setCodeError(null);
                  setConnectionModalStep('code');
                },
              }
            : null;

  const activeConnectionModalStep =
    connectionModalStep === 'manualPair' || selectedDevice !== null
      ? connectionModalStep
      : null;

  const closeConnectionModal = useCallback(() => {
    if (verifying) return;
    setConnectionModalStep(null);
  }, [verifying]);

  const dismissGuide = useCallback(async () => {
    await markUnconnectedGuideSeen();
    setShowGuide(false);
  }, []);

  const continuePreview = useCallback(async () => {
    await markUnconnectedGuideSeen();
    setShowGuide(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'SyncActivity' }],
      }),
    );
  }, [navigation]);

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View ref={containerRef} style={styles.container}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              activeOpacity={0.76}
              accessibilityRole="button"
              accessibilityLabel="返回"
              onPress={goBack}
              style={styles.backButton}
            >
              <Icon name="chevron-back" size={22} color="#42566E" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'switch' ? '切换电脑' : '连接你的电脑'}
              </Text>
              <Text style={styles.subtitle}>
                先扫描同一局域网下的电脑设备，再选择扫码连接或输入连接码。
              </Text>
            </View>

            <View
              ref={devicesCardRef}
              style={styles.devicesCard}
              onLayout={measureGuideTarget}
            >
              <View style={styles.devicesHeader}>
                <Text style={styles.devicesTitle}>同一局域网下的电脑设备</Text>
                <View style={styles.statusPill}>
                  {scanning ? <PulseDot /> : null}
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </View>

              {isShowingSkeleton ? (
                <View style={styles.skeletonStack}>
                  {[0, 1, 2].map(item => (
                    <View key={item} style={styles.skeletonRow} />
                  ))}
                </View>
              ) : (
                <View style={styles.deviceStack}>
                  {connectionStateContent ? (
                    <FlowStateCard state={connectionStateContent} />
                  ) : null}
                  {!connectionStateContent
                    ? devices.map(device => (
                        <DeviceRow
                          key={device.deviceId}
                          title={device.name}
                          subtitle={device.ip}
                          status={
                            device.availability === 'busy' ? '使用中' : '可连接'
                          }
                          iconName={
                            device.deviceKind === 'laptop'
                              ? 'laptop-outline'
                              : 'desktop-outline'
                          }
                          availability={device.availability ?? 'available'}
                          onPress={() => openMethodModal(device)}
                        />
                      ))
                    : null}
                  {!connectionStateContent
                    ? recentDesktops.map(recent => (
                        <DeviceRow
                          key={recent.desktopDeviceId}
                          title={recent.desktopName}
                          subtitle={`${recent.host}:${recent.port}`}
                          status="可连接"
                          iconName="desktop-outline"
                          availability="available"
                          onPress={() => openRecentDesktop(recent)}
                        />
                      ))
                    : null}
                  <TouchableOpacity
                    activeOpacity={0.76}
                    style={styles.manualPairRow}
                    onPress={() => {
                      setManualHost('');
                      setManualError(null);
                      setConnectionModalStep('manualPair');
                    }}
                  >
                    <View style={styles.rowIcon}>
                      <Icon name="link-outline" size={22} color="#1677D2" />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>手动配对</Text>
                      <Text style={styles.rowSubtitle}>
                        未显示设备时，输入电脑 IP 和连接码连接
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color="#A1B6CF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!scanning ? (
              <TouchableOpacity
                activeOpacity={0.76}
                style={styles.rescanButton}
                onPress={handleRescan}
              >
                <View style={styles.rescanButtonContent}>
                  <Icon name="refresh" size={16} color="#5A9ABF" />
                  <Text style={styles.rescanText}>重新扫描</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.helpPanel}>
              <Text style={styles.helpTitle}>电脑端还没有准备好？</Text>
              <Text style={styles.helpBody}>
                请先在官网 Vividrop.cn 下载并打开客户端，然后返回此页面扫码或输入连接码进行连接。
              </Text>
            </View>
          </ScrollView>

          {showGuide ? (
            <ConnectionGuideOverlay
              targetLayout={spotlightLayout}
              bottomInset={insets.bottom}
              onSkip={() => void dismissGuide()}
              onNext={() => void continuePreview()}
            />
          ) : null}

          <ConnectionFlowModal
            step={activeConnectionModalStep}
            deviceName={selectedDevice?.name ?? ''}
            manualHost={manualHost}
            manualError={manualError}
            connectionCode={connectionCode}
            verifying={verifying}
            codeError={codeError}
            onClose={closeConnectionModal}
            onScan={() => {
              setConnectionModalStep('cameraPermission');
            }}
            onCode={() => {
              setConnectionModalStep('code');
            }}
            onManualHostChange={value => {
              setManualHost(value);
              if (manualError) setManualError(null);
            }}
            onManualSubmit={handleManualPair}
            onDeny={() => {
              setConnectionModalStep(null);
              setConnectionStatus('cameraDenied');
            }}
            onAllow={() => {
              setConnectionModalStep(null);
              navigation.navigate('QRScanner');
            }}
            onChange={value => setConnectionCode(value.toUpperCase())}
            onSubmit={handleVerifyCode}
          />
        </View>
      </SafeAreaView>
    </GlobalGradientBackground>
  );
}

function DeviceRow({
  title,
  subtitle,
  status,
  iconName,
  availability,
  onPress,
}: {
  title: string;
  subtitle: string;
  status: string;
  iconName: string;
  availability: DeviceAvailability;
  onPress: () => void;
}) {
  const isBusy = availability === 'busy';
  return (
    <TouchableOpacity activeOpacity={0.76} style={styles.deviceRow} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Icon name={iconName} size={22} color="#1677D2" />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.deviceStatus, isBusy && styles.deviceStatusBusy]}>
        <Text
          style={[
            styles.deviceStatusText,
            isBusy && styles.deviceStatusTextBusy,
          ]}
        >
          {status}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color="#9AA3AE" />
    </TouchableOpacity>
  );
}

function FlowStateCard({ state }: { state: FlowStateContent }) {
  const toneStyle =
    state.tone === 'danger'
      ? {
          icon: styles.flowIconDanger,
          iconColor: '#D94F4F',
          action: styles.flowActionDanger,
          actionText: styles.flowActionTextDanger,
        }
      : state.tone === 'warning'
        ? {
            icon: styles.flowIconWarning,
            iconColor: '#AD761D',
            action: styles.flowActionWarning,
            actionText: styles.flowActionTextWarning,
          }
        : {
            icon: styles.flowIconNeutral,
            iconColor: '#7B8490',
            action: styles.flowActionNeutral,
            actionText: styles.flowActionTextNeutral,
          };

  return (
    <View style={styles.flowStateCard}>
      <View style={[styles.flowStateIcon, toneStyle.icon]}>
        <Icon name={state.icon} size={20} color={toneStyle.iconColor} />
      </View>
      <View style={styles.flowStateCopy}>
        <View style={styles.flowStateTopRow}>
          <Text style={styles.flowStateTitle}>{state.title}</Text>
          <TouchableOpacity
            activeOpacity={0.76}
            style={[styles.flowAction, toneStyle.action]}
            onPress={state.onAction}
          >
            <Text style={[styles.flowActionText, toneStyle.actionText]}>
              {state.actionLabel}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.flowStateDescription}>{state.description}</Text>
      </View>
    </View>
  );
}

function ConnectionGuideOverlay({
  targetLayout,
  bottomInset,
  onSkip,
  onNext,
}: {
  targetLayout: SpotlightLayout | null;
  bottomInset: number;
  onSkip: () => void;
  onNext: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const spotlightPadding = 10;
  const hole = targetLayout
    ? {
        x: Math.max(8, targetLayout.x - spotlightPadding),
        y: Math.max(8, targetLayout.y - spotlightPadding),
        width: Math.max(0, targetLayout.width + spotlightPadding * 2),
        height: targetLayout.height + spotlightPadding * 2,
      }
    : null;
  const preferredCardTop = hole ? hole.y + hole.height + 14 : 0;
  const shouldPlaceAbove = hole
    ? preferredCardTop > viewportHeight - 190
    : false;
  const guideCardPosition = hole
    ? {
        position: 'absolute' as const,
        left: 16,
        right: 16,
        top: shouldPlaceAbove
          ? Math.max(20, hole.y - 178)
          : preferredCardTop,
      }
    : {
        position: 'absolute' as const,
        left: 16,
        right: 16,
        bottom: Math.max(bottomInset, 8),
      };

  return (
    <View style={styles.guideOverlay}>
      {hole ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <Mask id="global-connection-guide-spotlight">
              <Rect width="100%" height="100%" fill="white" />
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={18}
                ry={18}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            fill="rgba(14,31,52,0.36)"
            mask="url(#global-connection-guide-spotlight)"
          />
          <Rect
            x={hole.x - 2}
            y={hole.y - 2}
            width={hole.width + 4}
            height={hole.height + 4}
            rx={20}
            ry={20}
            fill="none"
            stroke="rgba(255,255,255,0.48)"
            strokeWidth={1.5}
          />
        </Svg>
      ) : (
        <View pointerEvents="none" style={styles.guideDimFill} />
      )}
      <View style={[styles.guideCard, guideCardPosition]}>
        <View pointerEvents="none" style={styles.guideCardSurface}>
          <NativeModalBlurView
            blurStyle="systemThinMaterialLight"
            fallbackColor="rgba(255,255,255,0.78)"
            intensity={0.42}
            style={StyleSheet.absoluteFillObject}
          />
          <View pointerEvents="none" style={styles.guideCardTint} />
        </View>
        <View style={styles.guideCardContent}>
          <View style={styles.guideProgressRow}>
            <View style={styles.guideDots}>
              {Array.from({ length: 8 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.guideDot,
                    index === 0 && styles.guideDotActive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.guideStep}>1/8</Text>
          </View>
          <Text style={styles.guideTitle}>先连接电脑</Text>
          <Text style={styles.guideBody}>
            这里用于选择局域网内的电脑。引导会继续预览连接后的同步入口，不会创建真实连接。
          </Text>
          <View style={styles.guideActions}>
            <TouchableOpacity
              activeOpacity={0.76}
              style={styles.guideSkipButton}
              onPress={onSkip}
            >
              <Text style={styles.guideSkip}>跳过引导</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              style={styles.guideNext}
              onPress={onNext}
            >
              <Text style={styles.guideNextText}>继续预览</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function ConnectionFlowModal({
  step,
  deviceName,
  manualHost,
  manualError,
  connectionCode,
  verifying,
  codeError,
  onClose,
  onScan,
  onCode,
  onManualHostChange,
  onManualSubmit,
  onDeny,
  onAllow,
  onChange,
  onSubmit,
}: {
  step: ConnectionModalStep | null;
  deviceName: string;
  manualHost: string;
  manualError: string | null;
  connectionCode: string;
  verifying: boolean;
  codeError: string | null;
  onClose: () => void;
  onScan: () => void;
  onCode: () => void;
  onManualHostChange: (value: string) => void;
  onManualSubmit: () => void;
  onDeny: () => void;
  onAllow: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!step) return null;

  const keyboardEnabled = step === 'manualPair' || step === 'code';
  let content: React.ReactNode;

  if (step === 'method') {
    content = (
      <>
        <View style={styles.modalHeader}>
          <View style={styles.modalIconBlue}>
            <Icon name="desktop-outline" size={22} color="#1677D2" />
          </View>
          <View style={styles.modalTitleStack}>
            <Text style={styles.modalTitle}>选择连接方式</Text>
            <Text style={styles.modalSubtitle}>已选择 {deviceName}</Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.78}
          style={styles.optionRow}
          onPress={onScan}
        >
          <View style={styles.optionIconBlue}>
            <Icon name="scan-outline" size={20} color="#1677D2" />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>扫码连接</Text>
            <Text style={styles.optionBody}>扫描电脑端显示的二维码</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9AA3AE" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.78}
          style={styles.optionRow}
          onPress={onCode}
        >
          <View style={styles.optionIconPurple}>
            <Icon name="link-outline" size={20} color="#746AA8" />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>输入连接码</Text>
            <Text style={styles.optionBody}>手动输入电脑端的 6 位连接码</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="#9AA3AE" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.76}
          style={styles.modalCancel}
          onPress={onClose}
        >
          <Text style={styles.modalCancelText}>取消</Text>
        </TouchableOpacity>
      </>
    );
  } else if (step === 'manualPair') {
    content = (
      <>
        <View style={styles.modalHeader}>
          <View style={styles.modalIconPurple}>
            <Icon name="link-outline" size={22} color="#746AA8" />
          </View>
          <View style={styles.modalTitleStack}>
            <Text style={styles.modalTitle}>手动配对</Text>
            <Text style={styles.modalSubtitle}>
              输入电脑端显示的 IP 地址，下一步继续输入连接码。
            </Text>
          </View>
        </View>
        <TextInput
          value={manualHost}
          onChangeText={onManualHostChange}
          placeholder="192.168.31.21"
          placeholderTextColor="#A8B6C6"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="decimal-pad"
          style={[styles.textInput, manualError && styles.textInputError]}
          onSubmitEditing={onManualSubmit}
        />
        <Text style={manualError ? styles.errorText : styles.inputHint}>
          {manualError || '可在电脑端 ViviDrop 的全局设置中查看 IP 和 6 位连接码。'}
        </Text>
        <View style={styles.modalActions}>
          <TouchableOpacity
            activeOpacity={0.76}
            style={styles.secondaryAction}
            onPress={onClose}
          >
            <Text style={styles.secondaryActionText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.primaryAction}
            onPress={onManualSubmit}
          >
            <Text style={styles.primaryActionText}>下一步</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  } else if (step === 'cameraPermission') {
    content = (
      <>
        <View style={styles.modalHeader}>
          <View style={styles.modalIconBlue}>
            <Icon name="scan-outline" size={22} color="#1677D2" />
          </View>
          <View style={styles.modalTitleStack}>
            <Text style={styles.modalTitle}>允许相机访问</Text>
            <Text style={styles.modalSubtitle}>
              扫码连接需要临时打开相机，用于识别电脑端二维码。
            </Text>
          </View>
        </View>
        <View style={styles.modalActions}>
          <TouchableOpacity
            activeOpacity={0.76}
            style={styles.secondaryAction}
            onPress={onDeny}
          >
            <Text style={styles.secondaryActionText}>不允许</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.primaryAction}
            onPress={onAllow}
          >
            <Text style={styles.primaryActionText}>允许</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  } else {
    content = (
      <>
        <View style={styles.modalHeader}>
          <View style={styles.modalIconPurple}>
            <Icon name="link-outline" size={22} color="#746AA8" />
          </View>
          <View style={styles.modalTitleStack}>
            <Text style={styles.modalTitle}>输入连接码</Text>
            <Text style={styles.modalSubtitle}>
              输入 {deviceName || '电脑端'} 显示的连接码以完成连接。
            </Text>
          </View>
        </View>
        <TextInput
          value={connectionCode}
          onChangeText={onChange}
          placeholder="例如 A8X2K9"
          placeholderTextColor="#A8B6C6"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          editable={!verifying}
          style={styles.codeInput}
          onSubmitEditing={onSubmit}
        />
        {verifying ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color="#1677D2" />
            <Text style={styles.verifyingText}>正在验证连接码...</Text>
          </View>
        ) : null}
        {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
        <View style={styles.modalActions}>
          <TouchableOpacity
            activeOpacity={0.76}
            style={styles.secondaryAction}
            onPress={onClose}
          >
            <Text style={styles.secondaryActionText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            disabled={verifying || !connectionCode.trim()}
            style={[
              styles.primaryAction,
              (verifying || !connectionCode.trim()) && styles.disabledAction,
            ]}
            onPress={onSubmit}
          >
            <Text style={styles.primaryActionText}>连接</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <ModalBlurBackdrop />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          enabled={keyboardEnabled}
          style={styles.keyboardModal}
        >
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {content}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 42,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  header: {
    marginTop: 24,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#17191C',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 24,
    color: '#59616D',
  },
  devicesCard: {
    marginTop: 24,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 42,
    elevation: 5,
  },
  devicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  devicesTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#17191C',
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    color: '#59616D',
  },
  scanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1677D2',
  },
  skeletonStack: {
    marginTop: 16,
    gap: 12,
  },
  skeletonRow: {
    height: 66,
    borderRadius: 18,
    backgroundColor: '#EDF4FB',
  },
  deviceStack: {
    marginTop: 16,
    gap: 12,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  manualPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B8DFFF',
    backgroundColor: 'rgba(247,251,255,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#E4F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#17191C',
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 18,
    color: '#59616D',
  },
  deviceStatus: {
    borderRadius: 999,
    backgroundColor: '#E8F7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deviceStatusBusy: {
    backgroundColor: '#FFF3E8',
  },
  deviceStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#21A453',
  },
  deviceStatusTextBusy: {
    color: '#D7832F',
  },
  rescanButton: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  rescanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rescanText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: '#1677D2',
  },
  helpPanel: {
    marginTop: 20,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
  },
  helpTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: '#17191C',
  },
  helpBody: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 20,
    color: '#59616D',
  },
  flowStateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 2,
  },
  flowStateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowIconNeutral: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  flowIconDanger: {
    backgroundColor: '#FFF0F0',
  },
  flowIconWarning: {
    backgroundColor: '#FFF6D8',
  },
  flowStateCopy: {
    flex: 1,
    minWidth: 0,
  },
  flowStateTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  flowStateTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#17191C',
  },
  flowStateDescription: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 20,
    color: '#59616D',
  },
  flowAction: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flowActionNeutral: {
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  flowActionDanger: {
    backgroundColor: '#FFF0F0',
  },
  flowActionWarning: {
    backgroundColor: '#FFF5E0',
  },
  flowActionText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
  flowActionTextNeutral: {
    color: '#7B8490',
  },
  flowActionTextDanger: {
    color: '#D94F4F',
  },
  flowActionTextWarning: {
    color: '#B7791F',
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    overflow: 'hidden',
  },
  guideDimFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,31,52,0.36)',
  },
  guideCard: {
    borderRadius: 18,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 50,
    elevation: 8,
  },
  guideCardSurface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  guideCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  guideCardContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  guideProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guideDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9DAEE',
  },
  guideDotActive: {
    width: 20,
    backgroundColor: '#357CFF',
  },
  guideStep: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    color: '#7D97B5',
  },
  guideTitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: '#1C365A',
  },
  guideBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 24,
    color: '#6E8CAD',
  },
  guideActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  guideSkipButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  guideSkip: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8DA5BF',
  },
  guideNext: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1677D2',
    shadowColor: '#1677D2',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 6,
  },
  guideNextText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  keyboardModal: {
    width: '100%',
  },
  modalCard: {
    width: '100%',
    maxWidth: 336,
    alignSelf: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    shadowColor: '#173D58',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  modalIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4F5FF',
  },
  modalIconPurple: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEAFB',
  },
  modalTitleStack: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#17191C',
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: '#59616D',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.56)',
    padding: 14,
    marginBottom: 12,
  },
  optionIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4F5FF',
  },
  optionIconPurple: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEAFB',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17191C',
  },
  optionBody: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 18,
    color: '#59616D',
  },
  modalCancel: {
    marginTop: 2,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FC',
    borderWidth: 1,
    borderColor: '#DDE8F4',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1677D2',
  },
  textInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDE8F4',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 16,
    color: '#17191C',
    fontSize: 16,
  },
  codeInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDE8F4',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 16,
    color: '#17191C',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  textInputError: {
    borderColor: '#DB6B6B',
  },
  inputHint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 18,
    color: '#59616D',
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#D14C4C',
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 0.78,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FC',
    borderWidth: 1,
    borderColor: '#DDE8F4',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1677D2',
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1677D2',
  },
  disabledAction: {
    backgroundColor: '#A8B6CC',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifyingRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  verifyingText: {
    fontSize: 12,
    color: '#59616D',
  },
});
