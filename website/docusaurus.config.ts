import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Unif Camera',
  tagline: '@unif/react-native-camera · 基于 vision-camera 5.x 的相机库',
  favicon: 'img/logo.png',

  // 部署到 GitHub Pages 默认域名:https://unif-design.github.io/react-native-camera/
  // 后续接自定义域名只需把 url 改成新域名 + baseUrl 改为 '/' + 加 static/CNAME 文件。
  url: 'https://unif-design.github.io',
  baseUrl: '/react-native-camera/',

  organizationName: 'unif-design',
  projectName: 'react-native-camera',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // 让文档站直接 import `@unif/react-native-camera` 源码并在浏览器渲染。
    // 通过 webpack alias 把 npm 包名映射到 ../src/index.ts,保持源码 hot reload。
    // 注意:Native 调用(相机/视频录制)在浏览器没有原生侧,
    // 仅用作类型 + 组件 UI 的视觉预览,真实相机功能需要在 RN runtime。
    './src/plugins/docusaurus-rnw',
  ],

  clientModules: [
    // 在 React 树启动前给 window 上注入 `global = window`,
    // 让 @gorhom/bottom-sheet 等 RN 库的 lib/module/*.js 顶层 `global.X` 跑通。
    './src/clientModules/rn-globals.ts',
  ],

  themeConfig: {
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Unif Camera',
      logo: {
        alt: 'Unif',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '文档',
        },
        {
          href: 'https://www.npmjs.com/package/@unif/react-native-camera',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/unif-design/react-native-camera',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: '文档',
          items: [
            { label: '简介', to: '/docs/intro' },
            { label: '快速开始', to: '/docs/getting-started/installation' },
          ],
        },
        {
          title: '资源',
          items: [
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@unif/react-native-camera',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/unif-design/react-native-camera',
            },
          ],
        },
      ],
      copyright: '@unif/react-native-camera · MIT',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'tsx', 'jsx', 'ruby', 'kotlin', 'swift'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
