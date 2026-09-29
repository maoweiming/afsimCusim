"""
OSM 瓦片本地下载脚本 — 东海战区离线地图
用法:
  python scripts/download_tiles.py                  # 全区 z=0-12
  python scripts/download_tiles.py --zoom-max 14    # 全区 z=0-14（约 6GB）
  python scripts/download_tiles.py --focus          # 核心战区 z=0-14（约 800MB）
  python scripts/download_tiles.py --zoom-max 8     # 快速验证（约 50MB）
"""

import os
import math
import time
import argparse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── 区域定义 ─────────────────────────────────────────────────────────────

# 全区：东海 + 南海北部 + 黄海 + 日本列岛
AREA_FULL = dict(lat_min=18.0, lat_max=42.0, lon_min=110.0, lon_max=142.0)

# 核心战区：东海中部，允许下载更高精度
AREA_FOCUS = dict(lat_min=24.0, lat_max=36.0, lon_min=118.0, lon_max=130.0)

ZOOM_MIN = 0
ZOOM_MAX_DEFAULT = 12

# ─── 瓦片源选择 ────────────────────────────────────────────────────────────
# OSM 官方源（需符合 usage policy，可能被限速/封 IP）
TILE_URL_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

# 国内镜像源（推荐，无限速，但可能有延迟或数据过时）
TILE_URL_GEOQ = "http://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}"
TILE_URL_AMAP = "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"

# 当前使用（改这一行即可切换）
TILE_URL = TILE_URL_OSM   # 国内最稳定

OUT_DIR    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tiles")
USER_AGENT = "TrueSim/1.0"
DELAY_SEC  = 0.02   # 国内源可以更快

# ─── 坐标转 XYZ 瓦片号（OSM/Google 标准，y=0 在北） ────────────────────────

def deg2tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return x, max(0, min(n - 1, y))

def tiles_in_bbox(zoom: int, area: dict) -> list[tuple[int, int, int]]:
    # lat_max → smaller y (north); lat_min → larger y (south)
    x0, y0 = deg2tile(area['lat_max'], area['lon_min'], zoom)
    x1, y1 = deg2tile(area['lat_min'], area['lon_max'], zoom)
    return [
        (zoom, x, y)
        for x in range(x0, x1 + 1)
        for y in range(y0, y1 + 1)
    ]

# ─── 下载单张瓦片 ─────────────────────────────────────────────────────────

def download_tile(args: tuple[int, int, int]) -> tuple[bool, str]:
    z, x, y = args
    path = os.path.join(OUT_DIR, str(z), str(x), f"{y}.png")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True, "skip"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = TILE_URL.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        if len(data) < 100:          # OSM 返回错误时有时给空/很小的响应
            return False, f"empty response ({len(data)}B)"
        with open(path, "wb") as f:
            f.write(data)
        time.sleep(DELAY_SEC)
        return True, "ok"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # 瓦片不存在（海洋区域），写入占位避免重复请求
            open(path, "wb").close()
            return True, "404"
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)[:80]

# ─── 主流程 ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="下载 OSM 本地瓦片")
    parser.add_argument("--zoom-max", type=int, default=ZOOM_MAX_DEFAULT,
                        help=f"最大缩放级别（默认 {ZOOM_MAX_DEFAULT}）")
    parser.add_argument("--focus", action="store_true",
                        help="仅下载核心战区（24-36N, 118-130E），支持更高 zoom")
    parser.add_argument("--workers", type=int, default=4,
                        help="并发线程数（默认 4，勿超过 8 以免被 OSM 封）")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="跳过确认直接开始")
    args = parser.parse_args()

    area = AREA_FOCUS if args.focus else AREA_FULL
    area_name = "核心战区 (24-36N, 118-130E)" if args.focus else "全区 (18-42N, 110-142E)"

    # 精度说明
    RES = {8: "600m", 9: "300m", 10: "150m", 11: "75m", 12: "38m", 13: "19m", 14: "9m"}

    print(f"\n区域: {area_name}")
    print(f"Zoom: {ZOOM_MIN}-{args.zoom_max}  (z={args.zoom_max} 分辨率 ≈ {RES.get(args.zoom_max,'<9m')})")
    print(f"输出: {os.path.abspath(OUT_DIR)}\n")

    # 统计瓦片总量
    all_tiles: list[tuple[int, int, int]] = []
    for z in range(ZOOM_MIN, args.zoom_max + 1):
        t = tiles_in_bbox(z, area)
        all_tiles.extend(t)
        print(f"  z={z:2d}: {len(t):7,d} 张  (~{RES.get(z,'?')})")

    total = len(all_tiles)
    existing = sum(
        1 for (z, x, y) in all_tiles
        if os.path.exists(os.path.join(OUT_DIR, str(z), str(x), f"{y}.png"))
    )
    to_download = total - existing
    est_mb = to_download * 13 / 1024       # OSM ~13 KB/tile 平均
    est_min = to_download * DELAY_SEC / args.workers / 60

    print(f"\n总计 {total:,} 张，已缓存 {existing:,} 张，待下载 {to_download:,} 张")
    print(f"预估体积 ~{est_mb:.0f} MB，预计耗时 ~{est_min:.1f} 分钟（{args.workers} 线程）")

    if to_download == 0:
        print("\n全部已下载。")
        return

    if not args.yes:
        confirm = input("\n确认开始下载？[y/N] ").strip().lower()
        if confirm != "y":
            print("已取消。")
            return

    # 下载
    ok_count = existing
    fail_count = 0
    fail_list: list[str] = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        future_map = {pool.submit(download_tile, tile): tile for tile in all_tiles}
        for i, fut in enumerate(as_completed(future_map), 1):
            success, status = fut.result()
            if success:
                ok_count += 1
            else:
                fail_count += 1
                z, x, y = future_map[fut]
                fail_list.append(f"{z}/{x}/{y}: {status}")
                if len(fail_list) <= 5:
                    print(f"\r  FAIL {z}/{x}/{y}: {status}")
            pct = i / total * 100
            print(f"\r  进度: {i:,}/{total:,} ({pct:.1f}%)  失败: {fail_count}", end="", flush=True)

    print(f"\n\n完成。下载 {ok_count - existing:,} 张，已缓存 {existing:,} 张，失败 {fail_count} 张")
    if fail_list:
        print(f"失败样本（最多5条）:")
        for f in fail_list[:5]:
            print(f"  {f}")
    print(f"\n启动前端: cd afsim-web && npm run dev")

if __name__ == "__main__":
    main()
