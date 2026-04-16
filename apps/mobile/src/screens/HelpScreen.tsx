import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icon';
import {
  isDiagnosticsExportUnavailable,
  shareDiagnosticsArchive,
} from '../utils/shareDiagnosticsArchive';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DARK = '#1a3a5c';
const BLUE = '#3b9fd8';
const SCREEN_BG = '#d6ecf8';
const CARD_BG = '#ffffff';
const CARD_BORDER = 'rgba(187, 214, 233, 0.72)';
const MUTED_TEXT = '#7893ab';
const SECTION_TEXT = '#6e8aa3';
const ROW_CHEVRON = '#b8d0e4';
const ACCENT_LINE = '#3b9fd8';
const STEP_BG = '#2a6cb5';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

const FEATURE_ITEMS: FeatureItem[] = [
  {
    icon: 'link-outline',
    title: 'Vivi Drop 是什么',
    description:
      'Vivi Drop 是一款局域网素材同步工具，帮助短视频团队将手机素材无缝传输到 PC 端。只要手机和电脑处于同一 Wi-Fi 环境，即可一键连接，自动同步。',
  },
  {
    icon: 'link-outline',
    title: '如何连接电脑',
    description:
      '打开 App 后扫描局域网内的 Vivi Drop PC 端，或使用 PC 端的二维码扫码直连。连接成功后即可开始上传。',
  },
  {
    icon: 'cloud-upload-outline',
    title: '如何上传素材',
    description:
      '支持自动上传和手动上传两种方式。自动上传在后台静默同步新增素材；手动上传可在相册中勾选照片和视频后一次性提交。',
  },
  {
    icon: 'folder-outline',
    title: '如何访问共享目录',
    description:
      '在首页点击「共享目录」可浏览电脑端的共享文件夹，支持预览图片和视频，订阅用户还可下载文件到手机。',
  },
];

interface StepItem {
  step: number;
  title: string;
  description: string;
}

const STEP_ITEMS: StepItem[] = [
  {
    step: 1,
    title: '连接电脑',
    description:
      '确保手机和电脑在同一 Wi-Fi 下，打开 Vivi Drop PC 端，在手机端点击「扫描设备」找到电脑并连接，或使用 PC 端二维码扫码。',
  },
  {
    step: 2,
    title: '开启自动上传',
    description:
      '进入相册页，展开「自动上传」面板，打开开关。此后新增素材将在后台自动传输到电脑，无需手动操作。',
  },
  {
    step: 3,
    title: '手动上传',
    description:
      '在相册页勾选想要上传的照片或视频（已传输的素材会置灰），点击底部「上传」按钮提交到传输队列。',
  },
  {
    step: 4,
    title: '查看共享目录',
    description:
      '在首页点击「共享目录」卡片，浏览电脑端共享文件夹中的内容，可预览图片和视频，订阅用户可下载文件。',
  },
];

interface ExpandableItem {
  icon: string;
  title: string;
  answer: string;
}

const UPLOAD_SHARE_ITEMS: ExpandableItem[] = [
  {
    icon: 'sync-outline',
    title: '自动上传 vs 手动上传',
    answer:
      '自动上传：开启后会自动监控相册，新拍摄的照片和视频会自动传输到电脑端，适合日常使用。\n\n手动上传：在相册中手动勾选需要传输的文件，适合一次性批量传输历史素材。\n\n两种方式可以同时使用，手动上传的文件会优先传输。',
  },
  {
    icon: 'folder-outline',
    title: 'received 目录与 shared 目录',
    answer:
      'received 目录：手机传输到电脑的文件会保存在此目录，按日期自动分类。\n\nshared 目录：电脑端共享给手机浏览的文件夹，可在桌面端设置中指定。手机可预览其中的图片和视频。',
  },
  {
    icon: 'share-outline',
    title: '共享目录是只读访问',
    answer:
      '手机端浏览共享目录时是只读模式，不会修改或删除电脑端的文件。订阅用户可将共享文件下载到手机相册。',
  },
];

const FAQ_ITEMS: ExpandableItem[] = [
  {
    icon: 'help-circle-outline',
    title: '设备离线怎么办?',
    answer:
      '• 确认手机和电脑连接在同一 Wi-Fi 网络\n• 检查电脑端 Vivi Drop 是否正常运行\n• 尝试在同步动态页点击「重新连接」\n• 关闭 VPN 或代理软件后重试',
  },
  {
    icon: 'help-circle-outline',
    title: '上传失败怎么办?',
    answer:
      '• 检查 Wi-Fi 连接是否稳定\n• 确认手机端已授予照片访问权限\n• iCloud 照片可能需要先下载到本地\n• 导出诊断包发送给客服排查',
  },
  {
    icon: 'help-circle-outline',
    title: '共享目录为空怎么办?',
    answer:
      '• 确认电脑端已设置共享目录路径\n• 检查共享目录中是否有文件\n• 确认设备处于在线状态\n• 尝试下拉刷新共享目录页面',
  },
  {
    icon: 'help-circle-outline',
    title: '无法连接电脑怎么办?',
    answer:
      '• 确认手机和电脑在同一局域网 / Wi-Fi 下\n• 检查电脑防火墙是否阻止了 Vivi Drop\n• 重启电脑端 Vivi Drop 后重试\n• 尝试手动输入电脑 IP 和连接码',
  },
  {
    icon: 'help-circle-outline',
    title: '试用期是多久?',
    answer:
      '新用户可免费试用 7 天，试用期间可使用全部功能。试用到期后需订阅才能继续使用上传功能。',
  },
  {
    icon: 'help-circle-outline',
    title: '如何管理订阅?',
    answer:
      '订阅通过 Apple App Store 管理。如需取消或更改订阅，请前往「设置 → Apple ID → 订阅」中操作。',
  },
];

// ---------------------------------------------------------------------------
// HelpScreen
// ---------------------------------------------------------------------------

export function HelpScreen() {
  const navigation = useNavigation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleExportDiagnostics = useCallback(async () => {
    try {
      setIsExporting(true);
      await shareDiagnosticsArchive();
    } catch (error) {
      if (isDiagnosticsExportUnavailable(error)) {
        Alert.alert('无法导出', '当前版本暂不支持导出诊断包');
      } else {
        Alert.alert('导出失败', '诊断包导出失败，请稍后重试');
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderExpandableRow = (
    item: ExpandableItem,
    key: string,
    isLast: boolean,
  ) => {
    const isOpen = expandedKeys.has(key);
    return (
      <View key={key}>
        <TouchableOpacity
          style={styles.expandRow}
          activeOpacity={0.6}
          onPress={() => toggleExpand(key)}
        >
          <View style={styles.expandRowLeft}>
            <Icon name={item.icon} size={18} color={BLUE} />
            <Text style={styles.expandRowTitle}>{item.title}</Text>
          </View>
          <Icon
            name={isOpen ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={MUTED_TEXT}
          />
        </TouchableOpacity>
        {isOpen && (
          <Text style={styles.expandAnswer}>{item.answer}</Text>
        )}
        {!isLast && <View style={styles.listSep} />}
      </View>
    );
  };

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
          onPress={() => navigation.goBack()}
          accessibilityLabel="返回"
        >
          <Icon name="chevron-back" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>帮助</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================= */}
        {/* Section 1: 基础功能介绍                                         */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>基础功能介绍</Text>
        <View style={styles.listCard}>
          {FEATURE_ITEMS.map((item, index) => (
            <View key={index}>
              <View style={styles.featureRow}>
                <View style={styles.featureAccent} />
                <View style={styles.featureIconCircle}>
                  <Icon name={item.icon} size={18} color={BLUE} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.description}</Text>
                </View>
              </View>
              {index < FEATURE_ITEMS.length - 1 && (
                <View style={styles.listSep} />
              )}
            </View>
          ))}
        </View>

        {/* ============================================================= */}
        {/* Section 2: 首次使用引导                                         */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>首次使用引导</Text>
        <View style={styles.listCard}>
          {STEP_ITEMS.map((item, index) => (
            <View key={index}>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{item.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.description}</Text>
                </View>
              </View>
              {index < STEP_ITEMS.length - 1 && (
                <View style={styles.listSep} />
              )}
            </View>
          ))}
        </View>

        {/* ============================================================= */}
        {/* Section 3: 上传与共享说明                                        */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>上传与共享说明</Text>
        <View style={styles.listCard}>
          {UPLOAD_SHARE_ITEMS.map((item, index) =>
            renderExpandableRow(
              item,
              `share-${index}`,
              index === UPLOAD_SHARE_ITEMS.length - 1,
            ),
          )}
        </View>

        {/* ============================================================= */}
        {/* Section 4: 常见问题                                             */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>常见问题</Text>
        <View style={styles.listCard}>
          {FAQ_ITEMS.map((item, index) =>
            renderExpandableRow(
              item,
              `faq-${index}`,
              index === FAQ_ITEMS.length - 1,
            ),
          )}
        </View>

        {/* ============================================================= */}
        {/* Section 5: 联系我们                                             */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>联系我们</Text>
        <View style={styles.listCard}>
          {/* 客服邮箱 */}
          <TouchableOpacity
            style={styles.contactRow}
            activeOpacity={0.6}
            onPress={() => {
              void Linking.openURL('mailto:support@vividrop.cn');
            }}
          >
            <View style={styles.contactRowLeft}>
              <Icon name="mail-outline" size={18} color={BLUE} />
              <View>
                <Text style={styles.contactRowTitle}>客服邮箱</Text>
                <Text style={styles.contactRowSub}>support@vividrop.cn</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.listSep} />
          {/* 导出诊断包 */}
          <TouchableOpacity
            style={styles.contactRow}
            activeOpacity={0.6}
            disabled={isExporting}
            onPress={() => {
              void handleExportDiagnostics();
            }}
          >
            <View style={styles.contactRowLeft}>
              <Icon name="download-outline" size={18} color={BLUE} />
              <View>
                <Text style={styles.contactRowTitle}>
                  {isExporting ? '正在导出…' : '导出诊断包'}
                </Text>
                <Text style={styles.contactRowSub}>
                  将日志发给客服以协助排查问题
                </Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={16} color={ROW_CHEVRON} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SECTION_TEXT,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },

  // Shared list card
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  listSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e4eff7',
    marginHorizontal: 18,
  },

  // ---------------------------------------------------------------------------
  // Feature rows (基础功能介绍)
  // ---------------------------------------------------------------------------
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingRight: 18,
    paddingLeft: 4,
  },
  featureAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: ACCENT_LINE,
    marginRight: 12,
  },
  featureIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59,159,216,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  featureContent: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED_TEXT,
  },

  // ---------------------------------------------------------------------------
  // Step rows (首次使用引导)
  // ---------------------------------------------------------------------------
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: STEP_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED_TEXT,
  },

  // ---------------------------------------------------------------------------
  // Expandable rows (上传与共享说明 / 常见问题)
  // ---------------------------------------------------------------------------
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  expandRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  expandRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    flex: 1,
  },
  expandAnswer: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED_TEXT,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingLeft: 46,
  },

  // ---------------------------------------------------------------------------
  // Contact rows (联系我们)
  // ---------------------------------------------------------------------------
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contactRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  contactRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  contactRowSub: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 1,
  },

  bottomSpacer: {
    height: 20,
  },
});
