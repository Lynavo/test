import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import type { AlbumAssetDTO } from '@syncflow/contracts';
import { Icon } from './Icon';

export interface AssetPreviewModalProps {
  visible: boolean;
  assets: AlbumAssetDTO[];
  initialIndex: number;
  onClose: () => void;
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
  visible,
  assets,
  initialIndex,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  const current = assets[activeIndex];

  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {`${activeIndex + 1} / ${assets.length}`}
          </Text>
          <Text style={styles.filename} numberOfLines={1}>
            {current?.filename ?? ''}
          </Text>
        </View>
        <FlatList
          data={assets}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          keyExtractor={item => item.assetLocalId}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={event => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / width,
            );
            setActiveIndex(newIndex);
          }}
          renderItem={({ item: _item }) => <View style={{ width }} />}
          extraData={width}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    gap: 12,
  },
  closeBtn: { padding: 4 },
  counter: { color: '#fff', fontSize: 14, minWidth: 60 },
  filename: { color: '#fff', fontSize: 13, flex: 1 },
});
