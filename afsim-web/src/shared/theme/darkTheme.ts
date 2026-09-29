import type { ThemeConfig } from 'antd';

const darkTheme: ThemeConfig = {
  token: {
    // 主色调 - 军事蓝
    colorPrimary: '#0078d7',
    colorInfo: '#0078d7',
    colorSuccess: '#28b43c',
    colorWarning: '#c8c83c',
    colorError: '#d72828',

    // 背景色 - 暗色系
    colorBgBase: '#0a0e14',
    colorBgContainer: '#111820',
    colorBgElevated: '#1a2233',
    colorBgLayout: '#0d1117',
    colorBgSpotlight: '#1e2a3a',

    // 文字色
    colorText: '#e0e0e0',
    colorTextSecondary: '#8899aa',
    colorTextTertiary: '#5a6a7a',
    colorTextQuaternary: '#3a4a5a',

    // 边框
    colorBorder: '#2a3a4a',
    colorBorderSecondary: '#1e2a3a',

    // 字体
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    fontSizeHeading1: 22,
    fontSizeHeading2: 18,
    fontSizeHeading3: 15,

    // 圆角
    borderRadius: 4,
    borderRadiusLG: 6,
    borderRadiusSM: 2,

    // 控件高度
    controlHeight: 30,
    controlHeightLG: 36,
    controlHeightSM: 24,

    // 动画
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Card: {
      colorBgContainer: '#111820',
      headerBg: '#1a2233',
    },
    Table: {
      colorBgContainer: '#111820',
      headerBg: '#1a2233',
      rowHoverBg: '#1e2a3a',
      borderColor: '#2a3a4a',
    },
    Modal: {
      contentBg: '#111820',
      headerBg: '#1a2233',
    },
    Drawer: {
      colorBgElevated: '#111820',
    },
    Menu: {
      darkItemBg: '#111820',
      darkSubMenuItemBg: '#0d1117',
      darkItemSelectedBg: '#1e2a3a',
      darkItemHoverBg: '#1a2233',
    },
    Tabs: {
      inkBarColor: '#0078d7',
      itemActiveColor: '#0078d7',
      itemHoverColor: '#4da0e8',
      itemSelectedColor: '#0078d7',
    },
    Input: {
      colorBgContainer: '#0d1117',
      activeBorderColor: '#0078d7',
      hoverBorderColor: '#4da0e8',
    },
    Select: {
      colorBgContainer: '#0d1117',
      optionSelectedBg: '#1e2a3a',
    },
    Tag: {
      defaultBg: '#1a2233',
    },
    Tooltip: {
      colorBgSpotlight: '#2a3a4a',
      colorTextLightSolid: '#e0e0e0',
    },
    Message: {
      contentBg: '#1a2233',
    },
    Notification: {
      colorBgElevated: '#1a2233',
    },
  },
  algorithm: undefined, // 使用自定义 token，不依赖内置算法
};

export default darkTheme;
