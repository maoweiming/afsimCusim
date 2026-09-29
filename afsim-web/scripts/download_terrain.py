"""
Cesium 地形切片下载（quantized-mesh 格式）
使用 Cesium World Terrain 的公开镜像源

用法:
  python scripts/download_terrain.py --zoom-max 8    # 东海战区地形，约 50MB
  python scripts/download_terrain.py --zoom-max 10   # 更高精度，约 200MB
"""

import os
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# 东海战区范围（与地图瓦片一致）
LAT_MIN, LAT_MAX = 24.0, 36.0
LON_MIN, LON_MAX = 118.0, 130.0

TERRAIN_URL = "https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles/{z}/{x}/{y}.terrain?v=1.31376.0"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "terrain")
USER_AGENT = "TrueSim/1.0"

def tile_coords(zoom, lat_min, lat_max, lon_min, lon_max):
    """计算 TMS 瓦片范围（y=0 在南，与 OSM 相反）"""
    import math
    n = 2 ** zoom
    x0 = int((lon_min + 180) / 360 * n)
    x1 = int((lon_max + 180) / 360 * n)

    def lat_to_y_tms(lat):
        lat_r = math.radians(lat)
        return int(n * (1 - (math.log(math.tan(lat_r) + 1/math.cos(lat_r)) / math.pi)) / 2)

    y0 = lat_to_y_tms(lat_max)  # north → smaller y
    y1 = lat_to_y_tms(lat_min)  # south → larger y

    return [(zoom, x, y) for x in range(x0, x1+1) for y in range(y0, y1+1)]

def download_tile(args):
    z, x, y = args
    path = os.path.join(OUT_DIR, str(z), str(x), f"{y}.terrain")
    if os.path.exists(path):
        return True, "skip"

    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = TERRAIN_URL.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        if len(data) < 50:
            return False, f"empty ({len(data)}B)"
        with open(path, "wb") as f:
            f.write(data)
        return True, "ok"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            open(path, "wb").close()  # 占位
            return True, "404"
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)[:60]

def create_layer_json():
    """创建 layer.json 元数据（Cesium 地形必需）"""
    layer = {
        "tilejson": "2.1.0",
        "version": "1.0.0",
        "format": "quantized-mesh-1.0",
        "tiles": ["{z}/{x}/{y}.terrain"],
        "minzoom": 0,
        "maxzoom": 13,
        "attribution": "STK World Terrain",
        "scheme": "tms",
        "extensions": ["octvertexnormals", "watermask"]
    }
    with open(os.path.join(OUT_DIR, "layer.json"), "w") as f:
        json.dump(layer, f, indent=2)
    print(f"已创建 {OUT_DIR}/layer.json")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--zoom-max", type=int, default=8, help="最大缩放级别（默认8）")
    parser.add_argument("--workers", type=int, default=6, help="并发线程数")
    parser.add_argument("--yes", "-y", action="store_true", help="跳过确认")
    args = parser.parse_args()

    print(f"\n地形下载: 东海战区 (z=0-{args.zoom_max})")
    print(f"输出: {os.path.abspath(OUT_DIR)}\n")

    # 统计
    all_tiles = []
    for z in range(0, args.zoom_max + 1):
        tiles = tile_coords(z, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX)
        all_tiles.extend(tiles)
        print(f"  z={z:2d}: {len(tiles):5d} 张")

    total = len(all_tiles)
    existing = sum(1 for (z,x,y) in all_tiles if os.path.exists(os.path.join(OUT_DIR, str(z), str(x), f"{y}.terrain")))
    to_download = total - existing
    est_mb = to_download * 8 / 1024  # terrain ~8 KB/tile

    print(f"\n总计 {total} 张，已缓存 {existing} 张，待下载 {to_download} 张")
    print(f"预估 ~{est_mb:.0f} MB")

    if to_download == 0:
        print("\n全部已下载。")
        create_layer_json()
        return

    if not args.yes:
        if input("\n确认？[y/N] ").strip().lower() != "y":
            print("已取消。")
            return

    # 下载
    ok = existing
    fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_tile, t): t for t in all_tiles}
        for i, fut in enumerate(as_completed(futures), 1):
            success, status = fut.result()
            ok += success
            fail += not success
            print(f"\r  进度: {i}/{total} ({i*100/total:.1f}%)  失败: {fail}", end="", flush=True)

    print(f"\n\n完成。成功 {ok-existing}，失败 {fail}")
    create_layer_json()
    print("\n前端已配置，启动 npm run dev 查看 3D 地形")

if __name__ == "__main__":
    main()
