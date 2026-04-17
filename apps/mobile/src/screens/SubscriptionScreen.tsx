import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '../components/Icon';
import { useAuth } from '../stores/auth-store';
import type { AccountStatus } from '../stores/auth-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUE = '#3b9fd8';
const DARK = '#1a3a5c';
const SCREEN_BG = '#d6ecf8';
const CARD_BG = '#ffffff';
const CARD_BORDER = 'rgba(187, 214, 233, 0.72)';
const MUTED_TEXT = '#7893ab';
const SUCCESS_GREEN = '#22c55e';
const DESTRUCTIVE_RED = '#e53935';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAN_CARD_GAP = 12;
const PLAN_CARD_HORIZONTAL_PADDING = 16;
const PLAN_CARD_WIDTH =
  (SCREEN_WIDTH - PLAN_CARD_HORIZONTAL_PADDING * 2 - PLAN_CARD_GAP) / 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavigationProp = StackNavigationProp<RootStackParamList, 'Subscription'>;
type PlanKey = 'monthly' | 'ten_month';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrialRemainingDays(trialEnd: string | null): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd);
  if (Number.isNaN(end.getTime())) return 0;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(days, 0);
}

function formatExpireDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function getPlanDisplayName(plan: string): string {
  switch (plan) {
    case 'monthly':
      return '月度订阅';
    case 'ten_month':
      return '10个月套餐';
    default:
      return plan || '订阅';
  }
}

// ---------------------------------------------------------------------------
// Feature list
// ---------------------------------------------------------------------------

const FEATURES = [
  '自动上传相册新增素材',
  '自定义自动上传起始时间，支持精确到时分秒',
  '访问并下载当前连接电脑的共享目录内容',
  '预览共享目录中的图片与视频',
  '多设备连接与切换使用',
  '无限量上传素材',
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  trialEnd,
}: {
  status: AccountStatus | undefined;
  trialEnd: string | null | undefined;
}) {
  let dotColor: string;
  let label: string;

  switch (status) {
    case 'trialing': {
      const days = getTrialRemainingDays(trialEnd ?? null);
      dotColor = SUCCESS_GREEN;
      label = `试用中，还剩 ${days} 天`;
      break;
    }
    case 'trial_expired':
      dotColor = DESTRUCTIVE_RED;
      label = '试用已结束';
      break;
    case 'subscribed':
      dotColor = SUCCESS_GREEN;
      label = '已订阅';
      break;
    case 'sub_expired':
      dotColor = DESTRUCTIVE_RED;
      label = '订阅已到期';
      break;
    default:
      return null;
  }

  return (
    <View style={badgeStyles.container}>
      <View style={[badgeStyles.dot, { backgroundColor: dotColor }]} />
      <Text style={badgeStyles.text}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
});

// ---------------------------------------------------------------------------

function FeatureList() {
  return (
    <View style={featureStyles.container}>
      {FEATURES.map((text) => (
        <View key={text} style={featureStyles.row}>
          <Icon name="checkmark-circle" size={20} color={SUCCESS_GREEN} />
          <Text style={featureStyles.text}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const featureStyles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: DARK,
  },
});

// ---------------------------------------------------------------------------

function PlanCard({
  title,
  price,
  unit,
  discountBadge,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  unit: string;
  discountBadge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        planStyles.card,
        selected ? planStyles.cardSelected : planStyles.cardUnselected,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {discountBadge ? (
        <View style={planStyles.badgeContainer}>
          <Text style={planStyles.badgeText}>{discountBadge}</Text>
        </View>
      ) : null}
      <Text
        style={[
          planStyles.price,
          selected ? planStyles.textSelected : planStyles.textUnselected,
        ]}
      >
        {price}
      </Text>
      <Text
        style={[
          planStyles.unit,
          selected ? planStyles.unitSelected : planStyles.unitUnselected,
        ]}
      >
        {unit}
      </Text>
      <Text
        style={[
          planStyles.title,
          selected ? planStyles.titleSelected : planStyles.titleUnselected,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const planStyles = StyleSheet.create({
  card: {
    width: PLAN_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  cardSelected: {
    backgroundColor: DARK,
    borderColor: DARK,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  cardUnselected: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
  },
  badgeContainer: {
    position: 'absolute',
    top: -10,
    right: -4,
    backgroundColor: DESTRUCTIVE_RED,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
  },
  textSelected: {
    color: '#ffffff',
  },
  textUnselected: {
    color: DARK,
  },
  unit: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  unitSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  unitUnselected: {
    color: MUTED_TEXT,
  },
  title: {
    fontSize: 12,
    marginTop: 6,
  },
  titleSelected: {
    color: 'rgba(255,255,255,0.6)',
  },
  titleUnselected: {
    color: MUTED_TEXT,
  },
});

// ---------------------------------------------------------------------------

function PaymentSuccessModal({
  visible,
  plan,
  expireAt,
  onDismiss,
}: {
  visible: boolean;
  plan: string;
  expireAt: string | null;
  onDismiss: () => void;
}) {
  const expiry = formatExpireDate(expireAt);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.iconCircle}>
            <Icon name="checkmark-circle" size={48} color={SUCCESS_GREEN} />
          </View>
          <Text style={modalStyles.title}>支付成功</Text>
          <Text style={modalStyles.subtitle}>
            订阅成功，继续使用 Vivi Drop 吧！
          </Text>

          <View style={modalStyles.planRow}>
            <Icon name="calendar-outline" size={18} color={BLUE} />
            <Text style={modalStyles.planText}>
              {getPlanDisplayName(plan)}
            </Text>
            {expiry ? (
              <Text style={modalStyles.expiryText}>
                有效期至 {expiry}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={modalStyles.button}
            activeOpacity={0.7}
            onPress={onDismiss}
          >
            <Text style={modalStyles.buttonText}>开始使用</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconCircle: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: 'center',
    marginBottom: 20,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59,159,216,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  planText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  expiryText: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginLeft: 4,
  },
  button: {
    width: '100%',
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// ---------------------------------------------------------------------------
// SubscriptionScreen
// ---------------------------------------------------------------------------

export function SubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, subscription } = useAuth();
  // loadSubscription() will be called after real IAP verification succeeds

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('ten_month');
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const status: AccountStatus | undefined =
    subscription?.status ?? user?.status;
  const trialEnd = subscription?.trialEnd ?? user?.trialEnd;

  // After successful payment, we show the selected plan in the modal.
  // In production this would come from the server response.
  const [confirmedPlan, setConfirmedPlan] = useState<PlanKey>('ten_month');
  const [confirmedExpireAt, setConfirmedExpireAt] = useState<string | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Subscribe handler
  // ---------------------------------------------------------------------------

  const handleSubscribe = useCallback(async () => {
    setIsLoading(true);

    // -----------------------------------------------------------------
    // TODO: Real IAP flow (enable when server is deployed)
    // -----------------------------------------------------------------
    // 1. Request Apple IAP product info:
    //    const products = await RNIap.getProducts([productIdForPlan(selectedPlan)]);
    // 2. Initiate purchase:
    //    const purchase = await RNIap.requestPurchase(productId);
    // 3. Get receipt from purchase:
    //    const receipt = purchase.transactionReceipt;
    // 4. Verify with backend:
    //    await verifyIapReceipt(receipt, selectedPlan);
    // 5. On success: show payment success modal, reload subscription
    //    setConfirmedPlan(selectedPlan);
    //    setConfirmedExpireAt(serverResponse.expireAt);
    //    setShowPaymentSuccess(true);
    //    await loadSubscription();
    // -----------------------------------------------------------------

    // Mock flow: show alert since server is not deployed. The "preview
    // success" path was removed because it leaves the user in a fake
    // post-payment state with no real subscription record on the server,
    // and the dismiss handler had no way to navigate back to a usable view.
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('提示', '支付功能开发中，敬请期待', [{ text: '知道了' }]);
    }, 600);
  }, []);

  // ---------------------------------------------------------------------------
  // Payment success dismiss
  // ---------------------------------------------------------------------------

  const handlePaymentSuccessDismiss = useCallback(() => {
    setShowPaymentSuccess(false);
    // In production: navigate back or to SyncActivity
    // navigation.navigate('SyncActivity');
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.6}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 30 }}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          accessibilityLabel="返回"
        >
          <Icon name="chevron-back" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>会员订阅</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>解锁完整版</Text>
          <Text style={styles.heroSubtitle}>
            7 天免费体验，到期后订阅继续使用全部功能。
          </Text>
        </View>

        {/* Status badge */}
        {status ? (
          <View style={styles.badgeWrapper}>
            <StatusBadge status={status} trialEnd={trialEnd} />
          </View>
        ) : null}

        {/* Divider with label */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>订阅后可使用</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Feature list */}
        <View style={styles.featureCard}>
          <FeatureList />
        </View>

        {/* Plan selection */}
        <View style={styles.planRow}>
          <PlanCard
            title="按月订阅"
            price="¥9.9"
            unit="/月"
            selected={selectedPlan === 'monthly'}
            onPress={() => setSelectedPlan('monthly')}
          />
          <PlanCard
            title="长期优惠"
            price="¥88"
            unit="/10个月"
            discountBadge="8.8折"
            selected={selectedPlan === 'ten_month'}
            onPress={() => setSelectedPlan('ten_month')}
          />
        </View>

        {/* Subscribe button */}
        <TouchableOpacity
          style={styles.subscribeButton}
          activeOpacity={0.7}
          disabled={isLoading}
          onPress={() => {
            void handleSubscribe();
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.subscribeButtonText}>立即订阅</Text>
          )}
        </TouchableOpacity>

        {/* Footer disclaimer */}
        <Text style={styles.footerText}>
          订阅即表示您同意自动续费条款，可随时取消
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Payment success modal */}
      <PaymentSuccessModal
        visible={showPaymentSuccess}
        plan={confirmedPlan}
        expireAt={confirmedExpireAt}
        onDismiss={handlePaymentSuccessDismiss}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: DARK,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED_TEXT,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  // Badge wrapper
  badgeWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: CARD_BORDER,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
  },

  // Feature card
  featureCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },

  // Plan selection
  planRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: PLAN_CARD_GAP,
    marginBottom: 24,
  },

  // Subscribe button
  subscribeButton: {
    backgroundColor: DARK,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 12,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  subscribeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Footer
  footerText: {
    fontSize: 12,
    color: MUTED_TEXT,
    textAlign: 'center',
    lineHeight: 18,
  },

  bottomSpacer: {
    height: 20,
  },
});
