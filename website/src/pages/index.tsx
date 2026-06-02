import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import '@unif/react-native-design/docs-home.css';

import {
  IconCamera,
  IconVideo,
  IconWatermark,
  IconSpark,
  IconArrowRight,
  IconCopy,
  IconCheck,
} from '../components/home/icons';

/* ─── Code Window ─── */
type CodeLine = React.ReactNode;

interface CodeWindowProps {
  file: string;
  tag: string;
  hl: number;
  lines: CodeLine[];
}

function CodeWindow({
  file,
  tag,
  hl,
  lines,
}: CodeWindowProps): React.JSX.Element {
  return (
    <div className="hp-code compact">
      <div className="hp-code-bar">
        <span className="hp-code-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="hp-code-file">{file}</span>
        <span className="hp-code-tag">{tag}</span>
      </div>
      <div className="hp-code-body">
        <pre>
          {lines.map((node, i) => (
            <div key={i} className={'hp-cl' + (hl === i + 1 ? ' hl' : '')}>
              <span className="ln">{i + 1}</span>
              {node}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/* ─── Phone Mockup ─── */
function Phone({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="hp-phone">
      <div className="hp-screen">
        <div className="hp-notch" />
        {children}
      </div>
    </div>
  );
}

/* ─── Camera Screen (viewfinder demo) ─── */
function CameraScreen(): React.JSX.Element {
  return (
    <>
      <div className="hp-vf-top">
        <span className="hp-vf-flash">闪光 自动</span>
        <span className="hp-vf-time">1080P · 60fps</span>
      </div>
      <div className="hp-vf-frame">
        <span className="hp-corner tl" />
        <span className="hp-corner tr" />
        <span className="hp-corner bl" />
        <span className="hp-corner br" />
        <span className="hp-reticle" />
        <div className="hp-watermark">
          <div className="wm-1">Unif · 统一企业</div>
          <div className="wm-2">2026-06-02 14:30 · 上海市</div>
        </div>
      </div>
      <div className="hp-vf-modes">
        <span className="hp-vf-mode active">单拍</span>
        <span className="hp-vf-mode">连拍</span>
        <span className="hp-vf-mode">视频</span>
      </div>
      <div className="hp-vf-bar">
        <span className="hp-vf-thumb" />
        <span className="hp-shutter">
          <span />
        </span>
        <span className="hp-vf-flip">
          <IconCamera s={20} />
        </span>
      </div>
    </>
  );
}

/* ─── Install command ─── */
const PKG = '@unif/react-native-camera';

function InstallBlock(): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(`npm install ${PKG}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="hp-install">
      <span className="dollar">$</span>
      <span>
        npm install <span className="pkg">{PKG}</span>
      </span>
      <button
        className={'hp-install-copy' + (copied ? ' copied' : '')}
        title="复制"
        onClick={handleCopy}
      >
        {copied ? <IconCheck s={15} /> : <IconCopy s={15} />}
      </button>
    </div>
  );
}

/* ─── Syntax token helpers ─── */
const K = (kw: string) => <span className="tok-kw">{kw}</span>;
const ST = (s: string) => <span className="tok-str">{s}</span>;
const FN = (s: string) => <span className="tok-fn">{s}</span>;
const DIM = (s: string) => <span className="tok-dim">{s}</span>;

const CODE_LINES: CodeLine[] = [
  <>
    {K('import')} <span className="tok-id">{'{ useCamera }'}</span> {K('from')}{' '}
    {ST("'@unif/react-native-camera'")}
  </>,
  <>{' '}</>,
  <>
    {K('export function')} {FN('Capture')}() {'{'}
  </>,
  <>
    {'  '}
    {K('const')} camera = {FN('useCamera')}({'{'}
  </>,
  <>
    {'    '}mode: {ST("'burst'")},
  </>,
  <>
    {'    '}watermark: {ST("'Unif · {date}'")},
  </>,
  <>
    {'    '}maxDuration: <span className="tok-id">15</span>,
  </>,
  <>
    {'  '}
    {'})'})
  </>,
  <>{' '}</>,
  <>
    {'  '}
    {K('return')} {DIM('<')}
    {FN('Pressable')} onPress={'{'}camera.<span className="tok-id">open</span>
    {'}'} {DIM('/>')}
  </>,
  <>{'}'}</>,
];

/* ─── Feature card data ─── */
interface Feature {
  Icon: React.ComponentType<{ s?: number }>;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    Icon: IconCamera,
    title: '单拍 / 连拍',
    desc: '拍摄单张或多张照片，支持 JPEG 质量控制与前 / 后置切换。',
  },
  {
    Icon: IconVideo,
    title: '视频录制',
    desc: '录制视频并内置预览页，可设录制时长上限，完成后直接拿到本地文件路径。',
  },
  {
    Icon: IconWatermark,
    title: '水印烧录',
    desc: '基于 Skia 全分辨率离屏合成，把文字水印烧入成片，取景器同步 WYSIWYG 预览。',
  },
  {
    Icon: IconSpark,
    title: '开箱即用',
    desc: '一行 hook 调用即可唤起完整的模态相机界面，无需手写 Camera 组件和权限逻辑。',
  },
];

/* ─── Page ─── */
export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Unif Camera — 一行 hook，唤起整套相机"
      description="@unif/react-native-camera — 无需手写 Camera 组件和权限逻辑。调用 useCamera 即可弹出完整的模态相机界面，水印 WYSIWYG 预览并烧入成片。"
    >
      <main className="unif-home">
        {/* ── Hero ── */}
        <section className="hp-hero">
          <div className="hp-hero-split hp-hero-final">
            {/* Copy side */}
            <div className="hp-hero-copy">
              <span className="hp-eyebrow">{PKG}</span>
              <h1 className="hp-title">
                一行 hook，
                <br />
                <span className="accent">唤起整套相机</span>
              </h1>
              <p className="hp-tagline">
                无需手写 Camera 组件和权限逻辑。调用 useCamera
                即可弹出完整的模态相机界面，水印 WYSIWYG 预览并烧入成片。
              </p>
              <div className="hp-cta-row">
                <Link to="/docs/intro" className="hp-btn hp-btn-primary">
                  开始使用{' '}
                  <span className="hp-arrow">
                    <IconArrowRight s={18} />
                  </span>
                </Link>
                <Link
                  to="/docs/getting-started/installation"
                  className="hp-btn hp-btn-outline"
                >
                  快速开始
                </Link>
              </div>
              <InstallBlock />
              <div className="hp-meta-row">
                <span className="hp-chip">
                  <span className="dot" />
                  vision-camera 5.x
                </span>
                <span className="hp-chip">Skia 离屏合成</span>
                <span className="hp-chip">iOS · Android</span>
              </div>
            </div>

            {/* Combo side: code window + phone mockup */}
            <div className="hp-combo">
              <div className="hp-combo-code">
                <CodeWindow
                  file="CaptureScreen.tsx"
                  tag="useCamera"
                  hl={6}
                  lines={CODE_LINES}
                />
              </div>
              <div className="hp-combo-phone">
                <Phone>
                  <CameraScreen />
                </Phone>
              </div>
              <span className="hp-combo-badge">
                <span className="dot" />
                取景器实时预览
              </span>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="hp-features">
          <div className="hp-sec-label">核心能力</div>
          <div
            className="hp-feature-grid"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            {FEATURES.map((f, i) => (
              <div className="hp-feature" key={i}>
                <div className="hp-feat-icon">
                  <f.Icon s={24} />
                </div>
                <h3 className="hp-feat-title">{f.title}</h3>
                <p className="hp-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
