import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

const FEATURES = [
  {
    icon: '📷',
    title: '单拍 / 连拍',
    body: '拍摄单张或多张照片，支持 JPEG 质量控制与前 / 后置切换。',
    href: '/docs/guides/taking-photos',
  },
  {
    icon: '🎬',
    title: '视频录制',
    body: '录制视频并内置预览页，可设录制时长上限，完成后直接拿到本地文件路径。',
    href: '/docs/guides/recording-video',
  },
  {
    icon: '🔖',
    title: '水印烧录',
    body: '基于 Skia 全分辨率离屏合成，把文字水印烧入成片，取景器同步 WYSIWYG 预览。',
    href: '/docs/guides/watermark',
  },
  {
    icon: '⚡',
    title: '开箱即用',
    body: '一行 hook 调用即可唤起完整的模态相机界面，无需手写 Camera 组件和权限逻辑。',
    href: '/docs/api/use-camera',
  },
];

export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Unif Camera"
      description="@unif/react-native-camera — 基于 vision-camera 5.x 的相机库"
    >
      <header className="unif-hero">
        <div className="unif-hero__inner">
          <span className="unif-hero__pill">@UNIF/REACT-NATIVE-CAMERA</span>
          <h1 className="unif-hero__title">Unif Camera</h1>
          <p className="unif-hero__lede">
            基于 react-native-vision-camera 5.x 的相机库,支持单拍 / 连拍 /
            视频录制,内置水印能力。
          </p>
          <div className="unif-hero__ctas">
            <Link
              to="/docs/intro"
              className="unif-hero__cta unif-hero__cta--primary"
            >
              开始使用 →
            </Link>
            <Link
              to="/docs/getting-started/installation"
              className="unif-hero__cta unif-hero__cta--ghost"
            >
              快速开始
            </Link>
          </div>
        </div>
      </header>

      <section className="unif-features">
        {FEATURES.map((f) => (
          <Link key={f.href} to={f.href} className="unif-feature">
            <div className="unif-feature__icon">{f.icon}</div>
            <p className="unif-feature__title">{f.title}</p>
            <p className="unif-feature__body">{f.body}</p>
          </Link>
        ))}
      </section>
    </Layout>
  );
}
