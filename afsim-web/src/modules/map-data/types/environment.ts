/**
 * 民用标准环境数据类型
 * 对标 WMO (世界气象组织)、IHO (国际海道测量组织)、NOAA 标准
 */

import type { LngLat } from '../../../core/types/common';

// ============ 天气数据 (WMO 标准) ============

/** 风速单位 */
export type WindUnit = 'knots' | 'm/s' | 'km/h';

/** 降水类型 */
export type PrecipitationType = 'none' | 'rain' | 'snow' | 'sleet' | 'hail' | 'drizzle';

/** 云层信息 */
export interface CloudLayer {
  altitude: number;        // 米 (AGL)
  type: 'cirrus' | 'stratus' | 'cumulus' | 'cumulonimbus' | 'nimbostratus' | 'altostratus' | 'altocumulus';
  coverage: number;        // 0-1 (覆盖率)
}

/** 天气数据 — 对标 WMO SYNOP/METAR */
export interface WeatherData {
  stationId: string;
  stationName?: string;
  position: LngLat;
  timestamp: number;       // unix timestamp (秒)

  // 风场
  wind: {
    speed: number;         // 风速
    direction: number;     // 风向 (0-360°, 正北为0)
    gust?: number;         // 阵风
    unit: WindUnit;
  };

  // 温度
  temperature: {
    air: number;           // 气温 (°C)
    dewPoint?: number;     // 露点 (°C)
    feelsLike?: number;    // 体感温度 (°C)
    unit: 'C' | 'K';
  };

  // 气压
  pressure: {
    seaLevel: number;      // 海平面气压 (hPa)
    station?: number;      // 站点气压 (hPa)
    unit: 'hPa' | 'inHg';
  };

  // 能见度
  visibility: number;      // 米

  // 降水
  precipitation: {
    type: PrecipitationType;
    intensity?: number;    // mm/h
    rateMmH?: number;      // 降水速率
  };

  // 云量
  cloudCover: {
    total: number;         // 0-1 (总云量)
    layers: CloudLayer[];
  };

  // 湿度
  humidity: number;        // 0-100%

  // 天气代码 (METAR/SYNOP)
  weatherCode?: string;    // e.g. 'RA', 'SN', 'FG', 'BR'

  // 数据源
  source?: string;         // 'openweathermap' | 'noaa' | 'manual'
}

// ============ 海情数据 (WMO 45/海况等级) ============

/** 海况等级 (Douglas scale) */
export type SeaStateGrade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 冰况 */
export type IceCondition = 'none' | 'brash' | 'pancake' | 'nilas' | 'fast_ice' | 'growler' | 'berg';

/** 海情数据 — 对标 WMO 45 格式 */
export interface SeaStateData {
  position: LngLat;
  timestamp: number;

  // 浪涌
  wave: {
    significantHeight: number;   // 有效浪高 (米)
    maxHeight?: number;          // 最大浪高 (米)
    direction: number;           // 浪向 (0-360°)
    period: number;              // 周期 (秒)
    unit: 'm';
  };

  // 涌浪
  swell: {
    height: number;              // 涌浪高 (米)
    direction: number;           // 涌浪向 (0-360°)
    period: number;              // 涌浪周期 (秒)
  };

  // 海流
  current: {
    speed: number;               // 流速
    direction: number;           // 流向 (0-360°)
    unit: 'knots' | 'm/s';
  };

  // 海温
  seaSurfaceTemperature: number; // 海表温度 (°C)

  // 海况等级 (Douglas scale 0-9)
  seaState: SeaStateGrade;

  // 冰况
  iceCondition?: IceCondition;

  // 数据源
  source?: string;
}

// ============ 潮汐数据 (IHO/NOAA 标准) ============

/** 潮汐趋势 */
export type TideTrend = 'rising' | 'falling' | 'high' | 'low' | 'slack';

/** 基准面类型 */
export type TideDatum = 'MLLW' | 'MSL' | 'LAT' | 'MLW' | 'MHW' | 'HHW' | 'ISLW';

/** 潮汐预测点 */
export interface TidePrediction {
  time: number;           // unix timestamp
  level: number;          // 米
  type: 'high' | 'low';
}

/** 潮汐数据 — 对标 IHO/NOAA 标准 */
export interface TideData {
  stationId: string;
  stationName: string;
  position: LngLat;
  timestamp: number;

  // 当前潮位
  level: number;               // 米 (above chart datum)
  trend: TideTrend;

  // 预测
  predictions: TidePrediction[];

  // 潮流
  current?: {
    speed: number;             // 节
    direction: number;         // 0-360°
    type: 'flood' | 'ebb' | 'slack';
  };

  // 基准面
  datum: TideDatum;

  // 数据源
  source?: string;
}

// ============ 大气数据 ============

/** 湍流等级 */
export type TurbulenceLevel = 'none' | 'light' | 'moderate' | 'severe';

/** 结冰条件 */
export type IcingCondition = 'none' | 'light' | 'moderate' | 'severe';

/** 大气数据 */
export interface AtmosphericData {
  position: LngLat;
  timestamp: number;

  // 云底高
  ceiling?: number;            // 米 (AGL)

  // 湍流
  turbulence: TurbulenceLevel;

  // 结冰
  icingConditions: IcingCondition;

  // 风切变
  windShear?: {
    altitude: number;          // 米
    speedChange: number;       // m/s
    directionChange: number;   // 度
  };

  // 对流层顶
  tropopause?: {
    altitude: number;          // 米
    temperature: number;       // °C
  };

  source?: string;
}

// ============ 环境数据源 ============

/** 数据源类型 */
export type EnvironmentDataType = 'weather' | 'sea' | 'tide' | 'atmospheric';

/** 环境数据源配置 */
export interface EnvironmentDataSource {
  id: string;
  name: string;
  type: EnvironmentDataType;
  url?: string;
  apiKey?: string;
  enabled: boolean;
  refreshInterval: number;     // 秒
  lastFetch?: number;          // unix timestamp
}

// ============ 查询参数 ============

/** 环境数据查询 */
export interface EnvironmentQuery {
  bounds?: { south: number; west: number; north: number; east: number };
  position?: LngLat;
  radius?: number;             // 米
  timeRange?: [number, number];
  types?: EnvironmentDataType[];
}
