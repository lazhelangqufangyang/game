export const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

export const COLORS = {
  bg: 0x0b0e14,
  grid: 0x141a26,
  border: 0x1f2a3a,
  text: '#e6edf7',
  dim: '#8a97ab',
  accent: '#6ee7ff',
  danger: '#ff5c7a',
  gold: '#ffd166',
  accent_line: 0x6ee7ff,
  danger_line: 0xff5c7a,
} as const;

/**
 * 文字纹理密度：画布最终会被浏览器缩放到非整数倍，
 * 用 2 倍密度渲染文字，缩小时仍然清晰（`pixelArt` 下尤其明显）。
 */
export const TEXT_RESOLUTION = 2;

export const TEXT_STYLE = {
  fontFamily: FONT,
  color: COLORS.text,
  resolution: TEXT_RESOLUTION,
} as const;
