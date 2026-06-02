import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/concepts',
      ],
    },
    {
      type: 'category',
      label: '指南',
      collapsed: false,
      items: [
        'guides/taking-photos',
        'guides/recording-video',
        'guides/watermark',
      ],
    },
  ],
};

export default sidebars;
