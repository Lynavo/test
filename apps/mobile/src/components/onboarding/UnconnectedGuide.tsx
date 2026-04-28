import React, { useCallback } from 'react';
import {
  Alert,
  Clipboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';

const DOWNLOAD_URL = 'https://www.vividrop.cn';

interface UnconnectedGuideProps {
  onSkip: () => void;
  onStart: () => void;
}

export function UnconnectedGuide({ onSkip, onStart }: UnconnectedGuideProps) {
  const { t } = useTranslation();

  const handleCopyDownloadUrl = useCallback(() => {
    try {
      Clipboard.setString(DOWNLOAD_URL);
      Alert.alert(t('deviceDiscovery.onboarding.unconnected.copyDone'));
    } catch {
      Alert.alert(t('deviceDiscovery.onboarding.unconnected.copyFailed'));
    }
  }, [t]);

  return (
    <View style={styles.overlay} testID="unconnected-guide">
      <TouchableOpacity
        style={styles.skipButton}
        activeOpacity={0.75}
        onPress={onSkip}
      >
        <Text style={styles.skipText}>
          {t('deviceDiscovery.onboarding.unconnected.skip')}
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.heroIcon}>
          <Icon name="desktop-outline" size={30} color="#3478f6" />
          <Icon name="phone-portrait-outline" size={24} color="#3478f6" />
        </View>

        <Text style={styles.title}>
          {t('deviceDiscovery.onboarding.unconnected.title')}
        </Text>
        <Text style={styles.subtitle}>
          {t('deviceDiscovery.onboarding.unconnected.subtitle')}
        </Text>

        <View style={styles.stepsRow}>
          <GuideStep
            icon="desktop-outline"
            title={t(
              'deviceDiscovery.onboarding.unconnected.downloadStep.title',
            )}
            body={t('deviceDiscovery.onboarding.unconnected.downloadStep.body')}
          />
          <GuideStep
            icon="scan-outline"
            title={t('deviceDiscovery.onboarding.unconnected.connectStep.title')}
            body={t('deviceDiscovery.onboarding.unconnected.connectStep.body')}
          />
          <GuideStep
            icon="flash-outline"
            title={t('deviceDiscovery.onboarding.unconnected.syncStep.title')}
            body={t('deviceDiscovery.onboarding.unconnected.syncStep.body')}
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.urlBox}
          activeOpacity={0.75}
          onPress={handleCopyDownloadUrl}
        >
          <Text style={styles.urlText}>{DOWNLOAD_URL.replace('https://', '')}</Text>
          <View style={styles.copyButton}>
            <Icon name="link-outline" size={18} color="#3478f6" />
            <Text style={styles.copyText}>
              {t('deviceDiscovery.onboarding.unconnected.copy')}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.copyHint}>
          {t('deviceDiscovery.onboarding.unconnected.copyHint')}
        </Text>

        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.75}
          onPress={onStart}
        >
          <Text style={styles.startText}>
            {t('deviceDiscovery.onboarding.unconnected.start')}
          </Text>
          <Icon name="chevron-forward" size={18} color="#7893ab" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GuideStep({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>
        <Icon name={icon} size={20} color="#3478f6" />
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: '#d6ecf8',
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: 'center',
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    top: 24,
    zIndex: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(118,147,171,0.16)',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7893ab',
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 34,
    backgroundColor: '#ffffff',
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 6,
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#e8f1fb',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#173a5e',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#7893ab',
    textAlign: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#edf6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#173a5e',
    textAlign: 'center',
  },
  stepBody: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#8eaac0',
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5edf5',
    marginVertical: 28,
  },
  urlBox: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d3deea',
    backgroundColor: '#f3f7fc',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  urlText: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#e6efff',
  },
  copyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3478f6',
  },
  copyHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#8eaac0',
    textAlign: 'center',
  },
  startButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  startText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7893ab',
  },
});
