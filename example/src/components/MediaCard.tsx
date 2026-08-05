import { useState, type ReactElement } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Empty,
  Icon,
  fw,
  r,
  rf,
  useColors,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

import type { MediaPresentation } from '../domain/resultPresentation';

export type MediaCardProps = {
  media: MediaPresentation;
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      gap: r(10),
    },
    image: {
      width: '100%',
      height: r(180),
      borderRadius: r(8),
      backgroundColor: colors.surfaceContainer,
    },
    imageEmpty: {
      minHeight: r(180),
      justifyContent: 'center',
    },
    videoPreview: {
      minHeight: r(112),
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(8),
      borderRadius: r(8),
      backgroundColor: colors.surfaceContainer,
    },
    videoLabel: {
      color: colors.foregroundMuted,
      fontSize: rf(13),
    },
    metadata: {
      gap: r(6),
    },
    value: {
      color: colors.foreground,
      fontSize: rf(13),
      fontWeight: fw.medium,
      lineHeight: rf(19),
    },
    secondary: {
      color: colors.foregroundMuted,
      fontSize: rf(12),
      lineHeight: rf(18),
    },
    pathLabel: {
      color: colors.foreground,
      fontSize: rf(12),
      fontWeight: fw.semi,
      marginTop: r(4),
    },
    path: {
      color: colors.foregroundMuted,
      fontSize: rf(11),
      lineHeight: rf(17),
    },
  });

export function MediaCard({ media }: MediaCardProps): ReactElement {
  const [previewFailed, setPreviewFailed] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const isPhoto = media.mime === 'image/jpeg';

  return (
    <Card variant="plain">
      <View style={styles.content}>
        {isPhoto && previewFailed ? (
          <Empty
            title="临时照片预览已失效"
            desc="文件可能已被系统清理；生产业务应及时复制或上传。"
            icon="image"
            style={styles.imageEmpty}
            testID={`media-empty-${media.id}`}
          />
        ) : isPhoto ? (
          <Image
            testID={`media-image-${media.id}`}
            accessibilityLabel={`照片 ${media.id}`}
            source={{ uri: media.uri }}
            resizeMode="contain"
            style={styles.image}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <View style={styles.videoPreview}>
            <Icon
              name="play"
              size={r(30)}
              color={colors.foregroundMuted}
              testID={`media-video-icon-${media.id}`}
            />
            <Text style={styles.videoLabel}>示例不内置视频播放器</Text>
          </View>
        )}

        <View style={styles.metadata}>
          <Text style={styles.value}>{media.id}</Text>
          <Text style={styles.value}>{media.mime}</Text>
          <Text style={styles.secondary}>
            {media.mode} · {media.cameraType}
          </Text>
          <Text style={styles.secondary}>
            {media.width} × {media.height}
          </Text>
          {media.duration === undefined ? null : (
            <Text style={styles.secondary}>时长 {media.duration} 秒</Text>
          )}
          <Text style={styles.secondary}>
            翻拍标记：{media.isRemake ? '是' : '否'}
          </Text>
          <Text style={styles.pathLabel}>path</Text>
          <Text selectable style={styles.path}>
            {media.path}
          </Text>
          <Text style={styles.pathLabel}>uri</Text>
          <Text selectable style={styles.path}>
            {media.uri}
          </Text>
        </View>
      </View>
    </Card>
  );
}
