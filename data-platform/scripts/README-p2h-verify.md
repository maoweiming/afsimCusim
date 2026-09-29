# P2-H 验证清单 — StreamFrames / GetEngagementEvents（真实 InfluxDB）

> 背景：P2-H 为 `timeseries` 服务补全了两个此前的 TODO——`StreamFrames`（实时帧流，轮询 InfluxDB
> 每秒推送新帧）与 `GetEngagementEvents`（扫描帧序列重建武器发射/命中事件）。二者均通过了
> `go build / vet / test`，但**逻辑正确性需要一个真实 InfluxDB 实例才能端到端验证**。当时的开发机无
> Docker，故留此清单待后续在有 Docker 的机器/CI 上一键执行。

## 这两个接口的形态（为什么不能用现有 e2e 覆盖）

- 都是 **timeseries 服务的 gRPC 接口**（默认 `:50053`），**不经 data-gateway REST**——
  `data-gateway/internal/handler/timeseries.go` 只暴露 `WriteFrames/QueryFrames/Replays/Stats/Comparison`，
  没有 `StreamFrames`/`GetEngagementEvents` 路由。
- `docker-compose.yml` 里 `timeseries-service` **未发布端口到宿主机**（只有 data-gateway:8080 对外），
  所以无法从宿主机直接打 `:50053`。

因此验证脚本采用**最小隔离**：只用 Docker 跑一个独立 InfluxDB（发布 8086），在宿主机以 `go run`
启动 timeseries-service 指向它，再用一个 gRPC 客户端程序直接打 `:50053`。

## 一键执行

**Linux / macOS / CI：**
```bash
cd data-platform
./scripts/verify-p2h.sh
```

**Windows：**
```powershell
cd data-platform
pwsh ./scripts/verify-p2h.ps1   # 或 powershell -File ./scripts/verify-p2h.ps1
```

脚本会自动：启动 InfluxDB 容器 → 启动 timeseries-service → 运行 gRPC 验证客户端 → 清理。
退出码 `0` 表示两个接口均通过；非 0 表示有失败（输出含具体断言）。

前置：Docker 可用 + Go 1.23+。可选环境变量覆盖：`INFLUX_PORT` / `TS_PORT` /
`INFLUXDB_TOKEN` / `INFLUXDB_ORG` / `INFLUXDB_BUCKET`（默认值与 `deploy/docker-compose.yml` 一致）。

## 验证客户端做了什么（断言内容）

源码：[`services/timeseries/scripts/verify_p2h/main.go`](../services/timeseries/scripts/verify_p2h/main.go)

**① GetEngagementEvents**
写入 4 帧（platform `red-01`）：

| sim_time | weapon_0_remaining | status     | 触发的重建事件 |
|----------|--------------------|------------|----------------|
| 1.0      | 2                  | active     | —（建立基线）  |
| 2.0      | 1                  | active     | `weapon_launch` #1（2→1）|
| 3.0      | 0                  | active     | `weapon_launch` #2（1→0）|
| 4.0      | 0                  | destroyed  | `impact`（active→destroyed）|

断言 `GetEngagementEvents` 返回 **≥2 个 `weapon_launch` + ≥1 个 `impact`**（带 15s 重试，
容忍 InfluxDB 写入到可查询的短延迟）。

**② StreamFrames**
- 先写 Batch A（sim_time 1/2/3，platform `blue-01`）；
- 打开 `StreamFrames` server-stream（首轮轮询从游标 0 拉取 → 应收到 3 帧）；
- 2s 后写 Batch B（sim_time 4/5）；游标式轮询应在下一周期补推 → 再收到 2 帧；
- 断言 **12s 内收齐 5 个不同 sim_time 的帧**，随后取消 ctx 结束流。

## 手动排查（脚本失败时）

```bash
# 1. 确认 timeseries 服务连上了 InfluxDB（无 panic、监听 :50053）
cat $TMPDIR/p2h-timeseries.log        # Windows: $env:TEMP\p2h-timeseries.log(.err)

# 2. 直接看 InfluxDB 里有没有写进帧
docker exec truesim-influx-p2h influx query \
  'from(bucket:"simulation") |> range(start:0) |> filter(fn:(r)=>r._measurement=="simulation_frame") |> limit(n:5)' \
  --org truesim --token truesim-super-secret-token

# 3. 如需手动起服务 + 用 grpcurl（需 -import-path/-proto，服务未注册 reflection）
grpcurl -plaintext -proto shared/proto/timeseries.proto \
  -d '{"simulation_id":"x"}' localhost:50053 timeseries.TimeseriesService/GetEngagementEvents
```

## ✅ 已验证（2026-06-14，WSL2 原生 dockerd）

本机 Docker Desktop 后端损坏（引擎 init 永久卡 "Starting the Docker Engine..."），改用
**WSL2 Ubuntu-22.04 内的原生 dockerd** 完成验证。结果：

```
[verify-p2h] GetEngagementEvents OK — 64 weapon_launch + 32 impact (assert >=2/>=1)
[verify-p2h] StreamFrames OK — delivered all 5 frames across poll cycles [1 2 3 4 5]
[verify-p2h] P2-H 两个接口在真实 InfluxDB 下验证通过 (exit 0)
```

### WSL2 原生 dockerd 一键搭建（替代 Docker Desktop）

`setup-wsl-docker.sh` 把所有 root 操作打包，**在 Ubuntu 里 `sudo bash` 跑一次**即可：

```bash
sudo bash /mnt/<盘符>/.../data-platform/scripts/setup-wsl-docker.sh
```

它做：apt 装 `docker.io` + 下载 Go 1.23 → 配 daocloud 镜像源（Docker Hub 在本网络被墙）
→ 加 docker 组 → **切 iptables-legacy + 加载 WSL2 内核缺省未加载的 netfilter 模块** → 起 dockerd。

**踩坑记录（WSL2 跑原生 dockerd 的关键）**：WSL2 标准内核（`6.6.x-microsoft-standard-WSL2`）
模块文件齐全但默认不自动加载，dockerd 启动/建容器网络会逐个报错，需手动 `modprobe`：
`iptable_nat`（nat 表）→ `bridge`/`br_netfilter`（docker0 网桥）→ `xt_MASQUERADE`（容器出网 NAT）
→ `iptable_raw`/`iptable_mangle`（容器访问过滤）。另：apt 直连通、Docker Hub 被墙但国内镜像
（daocloud/1panel/1ms）通、Go 用 `GOPROXY=goproxy.cn`。

**开机自动可用（dockerd auto-start）—— 几个坑都踩过了**：
- `/etc/modules-load.d/*.conf`：WSL 下 `systemd-modules-load.service` 条件不满足，**不生效**；
- `/etc/wsl.conf` 的 `[boot] command`：当 `systemd=true` 时被 WSL **忽略**，不执行；
- ✅ **可行方案**：docker.service 的 systemd drop-in `ExecStartPre`（启动 dockerd 前 modprobe 全套模块）
  + `StartLimitIntervalSec=0` / `Restart=on-failure`（去掉频率限制 + 持续重试，规避 WSL 早期启动阶段
  modprobe 偶发静默失败）。`setup-wsl-docker.sh` 已自动配好
  （`/etc/systemd/system/docker.service.d/wsl-modules.conf` + `/usr/local/sbin/docker-wsl-modules.sh`）。

实测：`wsl --shutdown` 后重进，**dockerd ~2s 自动起来**，`im003` 自带 docker 组——
即"**wsl 进去 docker 直接可用，无需手动启动**"。

### 在 WSL2 里跑验证（host 侧 agent 驱动方式）

dockerd 起来后（常驻），从 Windows 侧驱动（用 `sg docker` 免重启拿 docker 组 + Go 上 PATH）：

```bash
wsl -d Ubuntu-22.04 -- bash -c '
  export PATH=/usr/local/go/bin:$PATH
  export GOPROXY=https://goproxy.cn,direct GOTOOLCHAIN=local
  sg docker -c "bash /mnt/<盘符>/.../data-platform/scripts/verify-p2h.sh"
'
```

> 注：`verify-p2h.sh` 默认假定 Docker Desktop 语义（Windows `docker.exe` + `localhost` 端口转发）。
> 在 WSL2 原生路径下，**整个验证在 Ubuntu 内运行**（InfluxDB 容器 + timeseries-service `go run` + gRPC 客户端
> 同处一个 Linux 网络命名空间，localhost 直连），无需跨 Windows↔WSL 边界转发。

完成后，[`docs/next-steps.md`](../../docs/next-steps.md) 的 P2-H 行已更新为"✅ 已在真实 InfluxDB 下通过验证"。
