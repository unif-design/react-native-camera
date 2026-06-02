import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

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
    </Layout>
  );
}
