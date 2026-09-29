/**
 * Theme presets for TrueSim
 * Each preset defines Ant Design tokens + CSS variable overrides
 */
import type { ThemeConfig } from 'antd';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  antdTheme: ThemeConfig;
  cssVars: Record<string, string>;
}

// ============ Shared component overrides ============

function baseComponents(accent: string, bg: string, bgContainer: string, bgElevated: string, bgSpotlight: string, border: string, borderSubtle: string) {
  return {
    Button: { primaryShadow: 'none', defaultShadow: 'none' },
    Card: { colorBgContainer: bgContainer, headerBg: bgElevated },
    Table: { colorBgContainer: bgContainer, headerBg: bgElevated, rowHoverBg: bgSpotlight, borderColor: border },
    Modal: { contentBg: bgContainer, headerBg: bgElevated },
    Drawer: { colorBgElevated: bgContainer },
    Menu: {
      darkItemBg: bgContainer,
      darkSubMenuItemBg: bg,
      darkItemSelectedBg: bgSpotlight,
      darkItemHoverBg: bgElevated,
    },
    Tabs: {
      inkBarColor: accent,
      itemActiveColor: accent,
      itemHoverColor: accent + 'cc',
      itemSelectedColor: accent,
    },
    Input: { colorBgContainer: bg, activeBorderColor: accent, hoverBorderColor: accent + 'cc' },
    Select: { colorBgContainer: bg, optionSelectedBg: bgSpotlight },
    Tag: { defaultBg: bgElevated },
    Tooltip: { colorBgSpotlight: border, colorTextLightSolid: '#e0e0e0' },
    Message: { contentBg: bgElevated },
    Notification: { colorBgElevated: bgElevated },
  };
}

// ============ Military Default (Blue) ============

const militaryDefault: ThemePreset = {
  id: 'military-default',
  name: '军事默认',
  description: '深蓝灰军事风格，通用指挥界面',
  accentColor: '#0078d7',
  antdTheme: {
    token: {
      colorPrimary: '#0078d7',
      colorInfo: '#0078d7',
      colorSuccess: '#28b43c',
      colorWarning: '#c8c83c',
      colorError: '#d72828',
      colorBgBase: '#0a0e14',
      colorBgContainer: '#111820',
      colorBgElevated: '#1a2233',
      colorBgLayout: '#0d1117',
      colorBgSpotlight: '#1e2a3a',
      colorText: '#c8d0dc',
      colorTextSecondary: '#7a8a9a',
      colorTextTertiary: '#506070',
      colorTextQuaternary: '#3a4a5a',
      colorBorder: '#2a3a4a',
      colorBorderSecondary: '#1e2a3a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13,
      fontSizeHeading1: 22,
      fontSizeHeading2: 18,
      fontSizeHeading3: 15,
      borderRadius: 4,
      borderRadiusLG: 6,
      borderRadiusSM: 2,
      controlHeight: 30,
      controlHeightLG: 36,
      controlHeightSM: 24,
      motionDurationFast: '0.1s',
      motionDurationMid: '0.2s',
      motionDurationSlow: '0.3s',
    },
    components: baseComponents('#0078d7', '#0a0e14', '#111820', '#1a2233', '#1e2a3a', '#2a3a4a', '#1e2a3a'),
  },
  cssVars: {
    '--accent-primary': '#0078d7',
    '--bg-primary': '#0d1117',
    '--bg-secondary': '#161b22',
    '--bg-tertiary': '#1c2333',
    '--bg-overlay': 'rgba(13, 17, 23, 0.92)',
    '--border-color': '#30363d',
    '--border-subtle': '#21262d',
    '--text-primary': '#c8d0dc',
    '--text-secondary': '#7a8a9a',
    '--text-muted': '#506070',
  },
};

// ============ Red Side ============

const redSide: ThemePreset = {
  id: 'red-side',
  name: '红方',
  description: '红方指挥视角，暖色调军事风格',
  accentColor: '#d72828',
  antdTheme: {
    token: {
      colorPrimary: '#d72828',
      colorInfo: '#d72828',
      colorSuccess: '#28b43c',
      colorWarning: '#c8c83c',
      colorError: '#ff4d4f',
      colorBgBase: '#0e0808',
      colorBgContainer: '#161010',
      colorBgElevated: '#231a1a',
      colorBgLayout: '#110b0b',
      colorBgSpotlight: '#2a1e1e',
      colorText: '#d0c0c0',
      colorTextSecondary: '#9a7878',
      colorTextTertiary: '#6a4a4a',
      colorTextQuaternary: '#5a3a3a',
      colorBorder: '#4a2a2a',
      colorBorderSecondary: '#3a1e1e',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13,
      fontSizeHeading1: 22,
      fontSizeHeading2: 18,
      fontSizeHeading3: 15,
      borderRadius: 4,
      borderRadiusLG: 6,
      borderRadiusSM: 2,
      controlHeight: 30,
      controlHeightLG: 36,
      controlHeightSM: 24,
      motionDurationFast: '0.1s',
      motionDurationMid: '0.2s',
      motionDurationSlow: '0.3s',
    },
    components: baseComponents('#d72828', '#0e0808', '#161010', '#231a1a', '#2a1e1e', '#4a2a2a', '#3a1e1e'),
  },
  cssVars: {
    '--accent-primary': '#d72828',
    '--bg-primary': '#110b0b',
    '--bg-secondary': '#1a1215',
    '--bg-tertiary': '#221a1c',
    '--bg-overlay': 'rgba(17, 11, 11, 0.92)',
    '--border-color': '#3d2020',
    '--border-subtle': '#2d1616',
    '--text-primary': '#d0c0c0',
    '--text-secondary': '#9a7878',
    '--text-muted': '#6a4a4a',
  },
};

// ============ Blue Side ============

const blueSide: ThemePreset = {
  id: 'blue-side',
  name: '蓝方',
  description: '蓝方指挥视角，冷色调军事风格',
  accentColor: '#1890ff',
  antdTheme: {
    token: {
      colorPrimary: '#1890ff',
      colorInfo: '#1890ff',
      colorSuccess: '#28b43c',
      colorWarning: '#c8c83c',
      colorError: '#d72828',
      colorBgBase: '#080c14',
      colorBgContainer: '#0e1520',
      colorBgElevated: '#162030',
      colorBgLayout: '#0a0f18',
      colorBgSpotlight: '#1a2840',
      colorText: '#c0c8d8',
      colorTextSecondary: '#7088a0',
      colorTextTertiary: '#405070',
      colorTextQuaternary: '#384860',
      colorBorder: '#283848',
      colorBorderSecondary: '#1e2a38',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13,
      fontSizeHeading1: 22,
      fontSizeHeading2: 18,
      fontSizeHeading3: 15,
      borderRadius: 4,
      borderRadiusLG: 6,
      borderRadiusSM: 2,
      controlHeight: 30,
      controlHeightLG: 36,
      controlHeightSM: 24,
      motionDurationFast: '0.1s',
      motionDurationMid: '0.2s',
      motionDurationSlow: '0.3s',
    },
    components: baseComponents('#1890ff', '#080c14', '#0e1520', '#162030', '#1a2840', '#283848', '#1e2a38'),
  },
  cssVars: {
    '--accent-primary': '#1890ff',
    '--bg-primary': '#0a0f18',
    '--bg-secondary': '#111825',
    '--bg-tertiary': '#1a2238',
    '--bg-overlay': 'rgba(10, 15, 24, 0.92)',
    '--border-color': '#283848',
    '--border-subtle': '#1e2a38',
    '--text-primary': '#c0c8d8',
    '--text-secondary': '#7088a0',
    '--text-muted': '#405070',
  },
};

// ============ Registry ============

export const THEME_PRESETS: ThemePreset[] = [
  militaryDefault,
  redSide,
  blueSide,
];

export const DEFAULT_THEME_ID = 'military-default';

export function getThemeById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? militaryDefault;
}
