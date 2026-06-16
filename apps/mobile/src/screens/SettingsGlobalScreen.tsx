import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { GlobalBottomTabBar } from '../components/GlobalBottomTabBar';
import { Icon } from '../components/Icon';
import { ModalBlurBackdrop } from '../components/shared/ModalBlurBackdrop';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../stores/auth-store';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;
type TabKey = 'home' | 'files' | 'settings';

interface SettingsGlobalScreenProps {
  showBottomTabBar?: boolean;
  onTabPress?: (tab: TabKey) => void;
}

type SettingsRowProps = {
  icon: string;
  iconBackground: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'blue' | 'green';
  danger?: boolean;
  showChevron?: boolean;
  rightAccessory?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  last?: boolean;
};

type LanguageMode = 'system' | 'manual';
type LanguageId =
  | 'zh-Hans'
  | 'zh-Hant'
  | 'en'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'es'
  | 'ru';

type ModalTone = 'blue' | 'purple' | 'red';

const MOCK_ACCOUNT = '+1 206 **** 1234';
const MOCK_DEVICE_NAME = 'iPhone 15 Pro';
const APP_VERSION = '2.1.0';

const LANGUAGE_OPTIONS: Array<{ id: LanguageId; label: string }> = [
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'zh-Hant', label: '繁体中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
  { id: 'ru', label: 'Русский' },
];

export function SettingsGlobalScreen({
  showBottomTabBar = true,
  onTabPress,
}: SettingsGlobalScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const auth = useAuth();
  const [activeView, setActiveView] = useState<'settings' | 'language'>(
    'settings',
  );
  const [deviceName, setDeviceName] = useState(MOCK_DEVICE_NAME);
  const [editingName, setEditingName] = useState(MOCK_DEVICE_NAME);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('system');
  const [language, setLanguage] = useState<LanguageId>('zh-Hans');
  const [showEditDevice, setShowEditDevice] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [showRestorePurchaseConfirm, setShowRestorePurchaseConfirm] =
    useState(false);

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    auth.setSignedOutTransition?.('logout');
    auth.clearAuth?.();
  };

  const handleOpenEditDevice = () => {
    setEditingName(deviceName);
    setShowEditDevice(true);
  };

  const handleSaveDeviceName = () => {
    const nextName = editingName.trim();
    if (nextName.length > 0) {
      setDeviceName(nextName);
    }
    setShowEditDevice(false);
  };

  if (activeView === 'language') {
    return (
      <LanguageGlobalView
        mode={languageMode}
        language={language}
        onBack={() => setActiveView('settings')}
        onModeChange={setLanguageMode}
        onLanguageChange={setLanguage}
      />
    );
  }

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          testID="global-settings-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>我的</Text>
            <Text style={styles.subtitle}>账号、设备和应用偏好。</Text>
          </View>

          <SettingsSection title="我的账户">
            <SettingsRow
              icon="person-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title={MOCK_ACCOUNT}
            />
            <SettingsRow
              icon="crown-outline"
              iconBackground="#EEEAFB"
              iconColor="#746AA8"
              title="会员状态"
              subtitle="Pro Annual · 剩余 28 天"
              badge="Pro"
              badgeTone="blue"
              showChevron
              onPress={() => navigation.navigate('Subscription')}
            />
            <SettingsRow
              icon="refresh-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="恢复已购买订阅"
              subtitle="从应用商店检查历史购买记录"
              showChevron
              testID="global-settings-restore-purchase"
              onPress={() => setShowRestorePurchaseConfirm(true)}
            />
            <SettingsRow
              icon="phone-portrait-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="设备名称"
              subtitle={deviceName}
              rightAccessory={
                <TouchableOpacity
                  testID="global-settings-edit-device-name"
                  style={styles.editIconButton}
                  accessibilityRole="button"
                  accessibilityLabel="编辑设备名称"
                  activeOpacity={0.72}
                  onPress={handleOpenEditDevice}
                >
                  <Icon name="pencil-outline" size={16} color="#9AA6B2" />
                </TouchableOpacity>
              }
              last
            />
          </SettingsSection>

          <SettingsSection title="电脑设备">
            <SettingsRow
              icon="laptop-outline"
              iconBackground="#EEEAFB"
              iconColor="#746AA8"
              title="MacBook Pro"
              subtitle="当前设备"
              badge="当前"
              badgeTone="green"
            />
            <SettingsRow
              icon="desktop-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="切换设备"
              subtitle="将断开当前设备并重新连接其他电脑"
              showChevron
              onPress={() =>
                navigation.navigate('DeviceDiscovery', { mode: 'switch' })
              }
              last
            />
          </SettingsSection>

          <SettingsSection title="通用">
            <SettingsRow
              icon="language-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="语言"
              subtitle="简体中文"
              showChevron
              testID="global-settings-language"
              onPress={() => setActiveView('language')}
            />
            <SettingsRow
              icon="help-circle-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="常见问题"
              subtitle="操作说明与常见问题"
              showChevron
              onPress={() => navigation.navigate('Help')}
            />
            <SettingsRow
              icon="message-square-outline"
              iconBackground="#EEEAFB"
              iconColor="#746AA8"
              title="版本"
              subtitle={`版本 ${APP_VERSION}`}
              rightAccessory={
                <View style={styles.updateBadge}>
                  <Text style={styles.updateBadgeText}>更新</Text>
                </View>
              }
            />
            <SettingsRow
              icon="cloud-upload-outline"
              iconBackground="#E4F5FF"
              iconColor="#1677D2"
              title="上传诊断包"
              subtitle="上传日志和设备状态以便排查问题"
              showChevron
            />
            <SettingsRow
              icon="log-out-outline"
              iconBackground="#FFF0F0"
              iconColor="#E24D4D"
              title="退出登录"
              danger
              testID="global-settings-logout"
              onPress={() => setShowLogoutConfirm(true)}
            />
            <SettingsRow
              icon="trash-outline"
              iconBackground="#FFF0F0"
              iconColor="#E24D4D"
              title="注销账号"
              danger
              testID="global-settings-delete-account"
              onPress={() => setShowDeleteAccountConfirm(true)}
              last
            />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>

      {showBottomTabBar ? (
        <GlobalBottomTabBar activeTab="settings" onTabPress={onTabPress} />
      ) : null}

      {showEditDevice ? (
        <GlobalSettingsModalFrame
          title="编辑设备名称"
          description="修改后会用于当前设备在同步记录中的显示名称。"
          iconName="pencil-outline"
          tone="blue"
          onClose={() => setShowEditDevice(false)}
        >
          <TextInput
            style={styles.modalInput}
            value={editingName}
            onChangeText={setEditingName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveDeviceName}
          />
          <View style={styles.modalSplitActions}>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={() => setShowEditDevice(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={handleSaveDeviceName}
            >
              <Text style={styles.modalPrimaryButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </GlobalSettingsModalFrame>
      ) : null}

      {showLogoutConfirm ? (
        <GlobalSettingsModalFrame
          title="退出登录"
          description="确定要退出当前账号吗？"
          iconName="log-out-outline"
          tone="red"
          onClose={() => setShowLogoutConfirm(false)}
        >
          <View style={styles.modalSplitActions}>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={() => setShowLogoutConfirm(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="global-settings-confirm-logout"
              style={styles.modalDangerButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={handleConfirmLogout}
            >
              <Text style={styles.modalDangerButtonText}>退出登录</Text>
            </TouchableOpacity>
          </View>
        </GlobalSettingsModalFrame>
      ) : null}

      {showRestorePurchaseConfirm ? (
        <GlobalSettingsModalFrame
          title="恢复已购买订阅"
          description="正在从应用商店检查当前账号的历史购买记录。"
          iconName="refresh-outline"
          tone="purple"
          onClose={() => setShowRestorePurchaseConfirm(false)}
        >
          <TouchableOpacity
            style={styles.modalFullPrimaryButton}
            accessibilityRole="button"
            activeOpacity={0.72}
            onPress={() => setShowRestorePurchaseConfirm(false)}
          >
            <Text style={styles.modalPrimaryButtonText}>知道了</Text>
          </TouchableOpacity>
        </GlobalSettingsModalFrame>
      ) : null}

      {showDeleteAccountConfirm ? (
        <GlobalSettingsModalFrame
          title="注销账号"
          description="确定要注销当前账号吗？此操作不可撤销。"
          iconName="trash-outline"
          tone="red"
          onClose={() => setShowDeleteAccountConfirm(false)}
        >
          <View style={styles.modalSplitActions}>
            <TouchableOpacity
              testID="global-settings-cancel-delete-account"
              style={styles.modalSecondaryButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={() => setShowDeleteAccountConfirm(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDangerButton}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={() => setShowDeleteAccountConfirm(false)}
            >
              <Text style={styles.modalDangerButtonText}>注销</Text>
            </TouchableOpacity>
          </View>
        </GlobalSettingsModalFrame>
      ) : null}
    </GlobalGradientBackground>
  );
}

function LanguageGlobalView({
  mode,
  language,
  onBack,
  onModeChange,
  onLanguageChange,
}: {
  mode: LanguageMode;
  language: LanguageId;
  onBack: () => void;
  onModeChange: (mode: LanguageMode) => void;
  onLanguageChange: (language: LanguageId) => void;
}) {
  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.childHeader}>
          <TouchableOpacity
            testID="global-language-back"
            style={styles.childBackButton}
            accessibilityRole="button"
            accessibilityLabel="返回"
            activeOpacity={0.72}
            onPress={onBack}
          >
            <Icon name="chevron-back" size={20} color="#17191C" />
          </TouchableOpacity>
          <Text style={styles.childTitle}>语言</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.languageContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <LanguageModeRow
              title="跟随系统语言"
              selected={mode === 'system'}
              onPress={() => onModeChange('system')}
            />
            <LanguageModeRow
              title="手动选择语言"
              selected={mode === 'manual'}
              onPress={() => onModeChange('manual')}
              last
            />
          </View>

          {mode === 'manual' ? (
            <View style={[styles.card, styles.languageOptionsCard]}>
              {LANGUAGE_OPTIONS.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.languageOptionRow,
                    index < LANGUAGE_OPTIONS.length - 1 && styles.rowDivider,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  activeOpacity={0.72}
                  onPress={() => onLanguageChange(item.id)}
                >
                  <Text style={styles.languageOptionText}>{item.label}</Text>
                  {language === item.id ? (
                    <Icon name="checkmark" size={18} color="#1677D2" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GlobalGradientBackground>
  );
}

function LanguageModeRow({
  title,
  selected,
  onPress,
  last = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.languageModeRow, !last && styles.rowDivider]}
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.72}
      onPress={onPress}
    >
      <Text style={styles.languageModeText}>{title}</Text>
      <View
        style={[
          styles.radio,
          selected ? styles.radioSelected : styles.radioUnselected,
        ]}
      >
        {selected ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function GlobalSettingsModalFrame({
  title,
  description,
  iconName,
  tone,
  onClose,
  children,
}: {
  title: string;
  description: string;
  iconName: string;
  tone: ModalTone;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const toneStyle =
    tone === 'red'
      ? styles.modalIconRed
      : tone === 'purple'
        ? styles.modalIconPurple
        : styles.modalIconBlue;
  const iconColor =
    tone === 'red' ? '#E24D4D' : tone === 'purple' ? '#746AA8' : '#1677D2';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <ModalBlurBackdrop />
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, toneStyle]}>
              <Icon name={iconName} size={22} color={iconColor} />
            </View>
            <View style={styles.modalCopy}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalDescription}>{description}</Text>
            </View>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  iconBackground,
  iconColor,
  title,
  subtitle,
  badge,
  badgeTone = 'blue',
  danger = false,
  showChevron = false,
  rightAccessory,
  onPress,
  testID,
  last = false,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: iconBackground }]}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, danger && styles.dangerText]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View
          style={[
            styles.badge,
            badgeTone === 'green' ? styles.badgeGreen : styles.badgeBlue,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              badgeTone === 'green'
                ? styles.badgeTextGreen
                : styles.badgeTextBlue,
            ]}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      {rightAccessory}
      {showChevron ? (
        <Icon name="chevron-forward" size={16} color="#C9D6E4" />
      ) : null}
    </>
  );

  const rowStyle = [styles.row, !last && styles.rowDivider];

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        style={rowStyle}
        accessibilityRole="button"
        accessibilityLabel={title}
        activeOpacity={0.72}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={rowStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '600',
    color: '#17191C',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
    color: '#59616D',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: '#7B8490',
  },
  card: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 52,
    elevation: 3,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.60)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#17191C',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: '#59616D',
  },
  dangerText: {
    color: '#E24D4D',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  badgeTextBlue: {
    color: '#2563EB',
  },
  badgeTextGreen: {
    color: '#16A34A',
  },
  editIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBadge: {
    borderRadius: 999,
    backgroundColor: '#1677D2',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  updateBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childHeader: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 2,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 38,
    elevation: 3,
  },
  childBackButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  childTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: '#17191C',
  },
  languageContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },
  languageModeRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  languageModeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: '#17191C',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  radioSelected: {
    borderColor: '#1677D2',
    backgroundColor: '#1677D2',
  },
  radioUnselected: {
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  languageOptionsCard: {
    marginTop: 20,
  },
  languageOptionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  languageOptionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#17191C',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 336,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconBlue: {
    backgroundColor: '#E4F5FF',
  },
  modalIconPurple: {
    backgroundColor: '#EEEAFB',
  },
  modalIconRed: {
    backgroundColor: '#FFF0F0',
  },
  modalCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: '#17191C',
  },
  modalDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 24,
    color: '#3F4A58',
  },
  modalInput: {
    marginTop: 20,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(23,25,28,0.08)',
    backgroundColor: 'rgba(23,25,28,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
    color: '#17191C',
  },
  modalSplitActions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondaryButton: {
    flex: 0.78,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,25,28,0.06)',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1677D2',
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E24D4D',
  },
  modalFullPrimaryButton: {
    marginTop: 20,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1677D2',
  },
  modalSecondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: '#59616D',
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalDangerButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
