# TrueSim 后续任务清单

---

## ⚠️ 每次会话开始前必读

1. **先读完本文件**，尤其是「✅ 已完成并验证」表格——已验证的功能不要重新分析/重写，除非发现回归。
2. 按下方「快速回归验证」对已完成项做一次轻量复测（通常 1-2 个命令 + 1 次浏览器 e2e），确认环境（gateway/前端 dev server）仍正常、场景文件未被回滚/覆盖。
3. 复测通过后，再开始「下一步任务清单」中状态为 `pending` 的新任务。
4. 每完成/修复一项，**立即**在「✅ 已完成并验证」表格中加一行（或更新状态列），并把对应任务从「下一步任务清单」移除或标记完成——保持本文件是唯一可信的状态来源。

### 快速回归验证（约 2 分钟）

```bash
# 1. gateway + 前端是否在跑
curl -s --noproxy "*" -I http://localhost:3000 | head -1
curl -s --noproxy "*" http://localhost:8080/api/scenarios | head -c 200

# 2. 关键场景文件是否完好（应为 east_sea_campaign，不应是 ________）
grep "define_path_variable CASE" "afsim-gateway/scenarios/东海沿海战役想定.scenario"
```

若 gateway 未启动：`AFSIM_MISSION_PATH=<...>/AFSim/afsim-2.9.0-win64/bin/mission.exe ./bin/gateway.exe`（需先确认 8080 端口无残留进程）。

---

## ✅ 已完成并验证（无需重做，仅做快速回归）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P0-A | `东海沿海战役想定.scenario` 重写为合法 laydown 格式 | `output/east_sea_campaign.log` 含 `start 1`/`T=10`/`T=20` | `afsim-gateway/scenarios/东海沿海战役想定.scenario` |
| P0-B | gateway 重启 + 浏览器端到端验证（地图飞入东海，7 实体，WS `platform_added×7` + 持续 `mover_update`） | Playwright e2e（已通过，532 条 WS 消息，`platform_added×7`/`platform_initialized×7`/`mover_update×399`/`frame_complete×113`） | gateway + `websocket.ts` |
| — | 修复 `applyMoverUpdated` 空 `Sensors` map panic | gateway 不再 panic，运行 30min 无崩溃 | `afsim-gateway/internal/simstate/state.go` |
| — | 修复 `full_snapshot` 中 `tracks` 扁平结构 → `TrackData` 转换崩溃 | 浏览器控制台无 `Cannot read properties of undefined (reading 'originator_index')` | `afsim-web/src/api/websocket.ts` |
| P1-C | `scenarioExporter.ts` 输出 laydown 格式位置/速度 + 类型映射 | 见下方"P1-D 期间发现并修复的问题" | `afsim-web/src/modules/scenario/utils/scenarioExporter.ts` |
| P1-D | 想定编辑器 →"运行仿真" 闭环验证（`scn-coastal-campaign`，9 平台，含中文装备名） | Playwright e2e（已通过，318 条 WS 消息，`platform_added×9`，`start 1`） | `ScenarioEditor.tsx`, `ScenarioList.tsx`, `scenarioExporter.ts` |
| P1-E | 清理调试期临时场景文件 | `afsim-gateway/scenarios/` 仅保留 `coastal_campaign.scenario` 与 `东海沿海战役想定.scenario` | `afsim-gateway/scenarios/` |
| P1-F | Command 装备实体库融合（前端部分）：新增"指挥所"装备类型 + 蓝/红 C2 指挥车种子数据 + 地图图标推断 | Playwright 验证：装备数据管理页"平台类型"分类树新增"指挥所"（计数1），列表含 `Blue_C2_Command_Post`/`Red_C2_Command_Post`，总数 25→27 | `afsim/enums.ts`, `data/seedAfsimConfigs.ts`, `PlatformLayer.tsx` |
| P1-G | Command 装备实体库融合（AFSIM 导出部分）：`mapToBaseType` 新增 指挥/command/c2/GCI 关键字 → `GCI`（注意大写，修复了与 `gci_noripr.txt` 中 `platform_type GCI` 的大小写不匹配问题）；`platformInstanceToConf` 为 `GCI` 类型平台追加 `add comm sub_net WSF_COMM_TRANSCEIVER ... internal_link track_manager ... end_comm` | mission.exe 直接验证（手写场景 + 导出器生成场景均 `Simulation complete` 无错误）；Playwright e2e（`scn-gci-test`，`platform_added×1`/`platform_initialized×1`/`sim_starting×1`/`frame_complete×68`，无报错，`output/scn-gci-test.log` 含 `start 1`） | `scenarioExporter.ts` |
| P2-F | 仿真网关 ↔ 数据平台 集成：`TimeseriesSink` 实时写入 InfluxDB + 仿真完成自动注册回放记录（MongoDB）。前置修复：data-platform 五个微服务从未编译通过，全部修复并通过 `go build ./... ` + `go vet ./...` + `go test ./...`（详见下方"data-platform 编译修复"记录） | gateway 重新编译后启动真实仿真（`coastal_campaign`，AFSIM_MISSION_PATH 指向含 `wsf_event_gateway.dll` 的 mission.exe）+ data-gateway（:9090，连接 timeseries:50053）：`/health` 显示三个 gRPC 服务均 `connected`；`POST /api/v1/timeseries/data` 返回 200（`simulation_id` 正确透传，无 `failed to post timeseries batch` 错误）；回放注册因本地无 InfluxDB/MongoDB 返回 502（优雅降级，未崩溃）。**真实数据写入需 Docker+InfluxDB+MongoDB，本环境不可用，留待后续验证** | `afsim-gateway/internal/engine/connector.go`, `afsim-gateway/internal/api/handler.go`, `data-platform/services/*` |
| P2-G | 排查 Windows 中文场景文件名问题：编写独立测试程序验证 `os.Stat()`/`exec.CommandContext()` 对含中文的路径与文件名（`东海沿海战役想定.scenario`）。**结论：Go 在 Windows 上的 syscall 层会自动将 UTF-8 路径转换为 UTF-16（`CreateFileW`/`CreateProcessW`），`os.Stat`/`exec.Command` 对中文路径均正常工作，无需改用 `syscall.UTF16PtrFromString`/`GetFileAttributesW`**；且 P0-B 已用该中文文件名通过 `ProcessManager.Start` 端到端验证过。判定为非问题，无需代码改动 | `/tmp/statcheck` 独立测试程序：`os.Stat` 返回 `OK: 东海沿海战役想定.scenario 3443`；`exec.CommandContext` 以中文文件名为参数、中文目录为 cwd 正常执行 | `afsim-gateway/internal/engine/process.go`（无需修改） |
| P3-4c | confWriter.ts 169 个预存类型错误全部清零：`afsim/types.ts` 中 6 个占位符类型（`RadarSensorMode`/`EoirSensorMode`/`RfJammerMode`/`TransmitterConfig`/`ReceiverConfig`/`AntennaConfig`）及关联类型重新设计为具体接口——新增 `SensorModeBase`（公共 cue/时序/上报字段）+ `SensorBeamConfig`（波束级 tx/rx/检测参数）+ 各传感器模式（Passive/Sar/Acoustic/Ladar/Geometric）+ `SensorConfigBase<TMode>` 泛型；`AfsimWeaponConfig`/`AfsimCommConfig`/`AfsimProcessorConfig`/`AfsimLaunchComputerConfig`/`TrackManagerConfig`/`AfsimZoneConfig` 声明具体字段（保留 `[key: string]: unknown` 索引签名向后兼容）；`zones`/`commandChains` 类型收紧。confWriter.ts 侧仅小修：`position`/`categories`/`location` 可选字段加守卫，3 处 `Object.entries(mode.beams ?? {})` 空回退（**顺带修复**了解析器对无 `mode_template` 的雷达/被动传感器产出 `template: {}` 时 writer 运行时 `Object.entries(undefined)` 崩溃的潜在 bug） | `npx tsc --noEmit` **0 错误**（169→0）+ `npx vitest run` 32/32 通过 + `npx vite build` 成功；类型名经 grep 确认仅 confWriter.ts/types.ts 使用，无外溢 | `afsim-web/src/modules/equipment/afsim/types.ts`, `afsim-web/src/modules/equipment/io/confWriter.ts` |
| P4-5b | 任务分配数据管线全链路（Track A+B+C）：① proto 两份同步新增 `TaskData`/`TaskAssigned`/`TaskCompleted`/`TaskCanceled`（oneof 90-92），protoc-gen-go 重新生成 Go pb；② 插件侧 `WsfEventGatewaySimExt` 接入 `WsfObserver::TaskAssigned/TaskCompleted/TaskCanceled`（WsfTaskObserver.hpp，core wsf），`FillTaskData` 填充 task_id/type/assigner/assignee/target/track_number/assign_time，CMake 重编 `wsf_event_gateway.dll` 并部署至 `bin/wsf_plugins`；③ gateway 新增 `task_assigned`/`task_completed`/`task_canceled` WS 消息 + `simstate.Platform.Mission`（assignee 维度，stale task 防护），`full_snapshot` 随平台携带 `mission`；④ 前端 `websocket.ts` 消费三类事件 → `PlatformInfo.mission`（task_type→MissionStatus.type 映射，fallback patrol；assigned→en_route/completed→completed/canceled→aborted），`weapon_fired` 时持任务平台→`engaging`，快照恢复 mission，`TaskAssignmentOverview` 不再恒空；⑤ `scn-coastal-campaign.scenario` 4 架战机加 `task_mgr WSF_TASK_PROCESSOR` + engage_mgr 开局 `AssignTask(PLATFORM.MakeTrack(), "cap"/"strike")` 自分配、打满 2 目标后 `TaskComplete` | mission.exe 直跑：4×`task assigned`（蓝 cap×2/红 strike×2）+ 4×engaging + 2×`task complete: strike`，无解析/脚本错误；WS e2e（rate=100 全程 30min 想定）：`task_assigned×4`/`task_completed×2`（status `SUCCESSFUL`）/`weapon_fired×4`/`sim_complete×1`，task payload 字段完整；中途重连 e2e：`full_snapshot` 4 平台均携带 `mission`（status assigned）；gateway `go build/vet/test` 通过；前端 `tsc --noEmit` 0 错误 + vitest 32/32 + vite build 通过 | `proto/afsim_events.proto`, `afsim-plugin/proto/afsim_events.proto`, `afsim-plugin/source/WsfEventGatewaySimExt.{hpp,cpp}`, `afsim-gateway/internal/{proto,ws/messages.go,engine/connector.go,simstate/{platform,state}.go}`, `afsim-web/src/api/websocket.ts`, `afsim-gateway/scenarios/scn-coastal-campaign.scenario` |
| P5-2 | 想定编辑器「任务管理」新增"武器交战"（`engage`）任务类型 + `EngagementConfig`（武器/目标平台/ROE/交战距离/齐射数量），并接入 `scenarioExporter.ts`：为分配了 `engage` 任务的平台生成 `geo_sensor`（WSF_GEOMETRIC_SENSOR）+ `engage_mgr`（WSF_SCRIPT_PROCESSOR，按 ROE/交战距离/武器名/可选目标平台 FireSalvo）；`scn-coastal-campaign` 新增示例任务「蓝鹰编队拦截交战」（蓝鹰01/02 用 `int_missile`，ROE=free，60km） | `npx tsc --noEmit` 0 错误 + `npx vitest run` 32/32 + `npx vite build` 成功；**mission.exe 直接验证导出脚本语法**：①导出 `scn-coastal-campaign`（含新交战任务）跑 5min，`start 1`/`complete 300.001` 正常，无解析错误（该想定双方初始相距过远，5min 内未进入 60km 交战距离，故无开火，符合预期）；②最小验证场景（蓝/红各1机，初始相距 ~20km）跑 1min：stdout 输出 `"蓝方01" [蓝方01拦截交战] engaging "红方01" at range 20209`，`.evt` 含 `WEAPON_FIRE_REQUESTED`/`WEAPON_FIRED ... Weapon: int_missile`，确认 `engage_mgr` 生成的脚本逻辑正确触发 FireSalvo | `afsim-web/src/modules/scenario/types.ts`, `afsim-web/src/modules/scenario/components/ScenarioEditor.tsx`, `afsim-web/src/modules/scenario/utils/scenarioExporter.ts`, `afsim-web/src/modules/scenario/api/scenarioApi.ts` |
| P2-H | 补全 `timeseries` 服务两个 TODO：① `StreamFrames`（实时帧流）改为轮询 InfluxDB，每 1s 查询晚于游标时间戳的新帧并通过 gRPC server-stream 推送，直至 ctx 取消；② `GetEngagementEvents`（交战事件查询）逐平台扫描帧序列，通过 `weapon_N_remaining` 减少重建 `weapon_launch` 事件、`status` 变为 `destroyed`/`damaged` 重建 `impact` 事件，按时间排序后返回 | `go build ./...` + `go vet ./...` + `go test ./...` 全部通过（5 个微服务）。**真实 InfluxDB 端到端回归 ✅ 已通过**（2026-06-14，WSL2 原生 dockerd）：`verify_p2h` gRPC 客户端写合成帧 → `GetEngagementEvents` 重建 64 `weapon_launch`+32 `impact`（≥2/≥1 断言满足）、`StreamFrames` 跨轮询收齐 5 帧 → **`P2-H 两个接口在真实 InfluxDB 下验证通过`**（exit 0）。一键 harness：`data-platform/scripts/verify-p2h.{ps1,sh}` + `services/timeseries/scripts/verify_p2h/main.go` + `setup-wsl-docker.sh`（WSL2 一键装 docker/go/镜像源/netfilter 模块）+ `README-p2h-verify.md` | `data-platform/services/timeseries/internal/store/influx.go`（新增 `StreamFrames`/`GetEngagementEvents`/`getPlatformEngagementEvents`/`getPlatformIDs`），`internal/service/timeseries.go`，`internal/model/replay.go`（新增 `EngagementEvent`）；验证 harness：`data-platform/scripts/verify-p2h.{ps1,sh}`、`services/timeseries/scripts/verify_p2h/main.go` |
| P5-4 | 修复"运行仿真"整页崩溃（`PageErrorBoundary:仿真运行` 捕获 `Cannot read properties of undefined (reading 'toFixed')`）：根因为网关 WS 用 pb.go `omitempty` 序列化，海面舰艇 `alt=0` 字段在 `mover_update` 中被省略，前端 `updatePlatform` 浅合并用 `undefined` 覆盖了有效 `alt`，实体创建分支 `createDescription` 对其调 `.toFixed` 崩溃。修复：`mover_update` 的 `lat/lon/alt` 改 `?? 0`（根因），`createDescription` 的 `lat/lon/alt/damageFactor` 加 `?? 0` 守卫（兜底） | `npx tsc --noEmit` 0 错误 + `npx vitest run` 32/32 + `npx vite build` 成功；**Playwright 浏览器复现+回归**：用相同 4 想定全量 sweep（启动→拉满时钟→展开全部面板→持续遍历选择平台/切页签），修复前 `scn-coastal-campaign` 必崩（堆栈定位 `PlatformLayer.createDescription`），修复后 `ERRORS (0)`，整页稳定 | `afsim-web/src/api/websocket.ts`（`mover_update`），`afsim-web/src/components/Globe/PlatformLayer.tsx`（`createDescription`） |

### P2-F 期间发现并修复的问题（data-platform 编译修复 + 集成 bug，新增）

**data-platform 编译修复**（5 个 Go 微服务此前从未编译通过）：

| 问题 | 修复 |
|------|------|
| `services/equipment`、`services/scenario` go.mod 中 `github.com/youmark/pkcs8` 伪版本号不存在 | 改为 mongo-driver v1.17.1 实际依赖的 `v0.0.0-20240726163527-a2c0da244d78` |
| `services/timeseries` go.mod 中 `github.com/influxdata/line-protocol` 伪版本号不存在 | 改为 influxdb-client-go v2.14.0 实际依赖的 `v0.0.0-20200327222509-2487e7298839` |
| `timeseries.pb.go`/`scenario.pb.go`/`geospatial.pb.go` 系手写伪造，约 373 处语法错误；`equipment.pb.go` 未实现 `protoreflect.ProtoMessage` | 用 protoc + protoc-gen-go v1.35.2 + protoc-gen-go-grpc v1.5.1 全部重新生成 |
| `scenario.proto` 中 RPC `Commit` 与消息类型 `Commit` 同名导致 protoc 报 "Commit is not a message type" | RPC 重命名为 `CommitChanges`，同步修改 `services/scenario/internal/service/scenario.go`、`services/data-gateway/internal/handler/scenario.go` |
| `scenario.proto` 内未使用且路径错误的 `import "equipment.proto"` | 移除 |
| `services/scenario/internal/store/mongo.go` 末尾多余 `}`、`internal/collab/manager.go` 未使用变量 `loaded`、`scripts/init_mock_data.go` `coll.Drop` 返回值数量不匹配 | 逐一修复 |
| `services/equipment/internal/version/manager.go` 用 `errors.As(err, &fmt.Errorf(...))` 判断乐观锁错误（无意义代码）+ 未使用的 `uuid` import | 新增 `store.ErrOptimisticLock` sentinel，改用 `errors.Is` |
| `services/equipment/internal/service/equipment.go` 局部变量 `lock` 与 `internal/lock` 包名遮蔽 | 局部变量重命名为 `acquired` |
| `services/equipment/internal/lock/manager_test.go` 的 `TestAcquireSameUserRefresh` 比较了同一 `*Lock` 指针的 `ExpiresAt`（恒等），测试逻辑错误 | 改为先保存旧值快照 + `time.Sleep(1ms)` + `.After()` 断言 |

**TimeseriesSink 集成 bug**（验证过程中发现的真实 bug，已修复）：

| 问题 | 现象 | 修复 |
|------|------|------|
| `connector.go` 收到 `SimStarting`/`SimComplete` 事件时调用 `sink.OnSimulationStart("", "")`/`OnSimulationComplete("")`，空字符串覆盖了构造时设置的 `cfg.SimID` | data-gateway 持续报 `gRPC error: ... InvalidArgument: simulation_id is required`，所有 `WriteFrames` 调用失败 | `ConnectorConfig` 新增 `SimID`/`ScenarioID` 字段，由 `handler.go` 传入 `simIDStr`/`scenarioID`；`connector.go` 用 `c.simID`/`c.scenarioID` 替代空字符串 |

### P1-D 期间发现并修复的问题（踩坑记录，新增）

| 问题 | 现象 | 修复 |
|------|------|------|
| `wrapAsGatewayScenario` 对纯中文 scenario 名 sanitize 后全为下划线 | `define_path_variable CASE ________`（与 P0-A 同款 bug，由导出器重新引入） | sanitize 结果若不含字母数字则回退为 `'custom'` |
| 编辑器导出文件名沿用中文 `scenario.name` | 上传时文件名与网关生产场景 `东海沿海战役想定.scenario` 同名，**直接覆盖**了 P0-A 修复好的文件 | 改用 `scenario.id`（ASCII 唯一）作为 CASE 名/文件名（`ScenarioEditor.tsx`、`ScenarioList.tsx`） |
| `blue_multirole_fighter_1_noripr.txt` 间接 `include_once` 不存在的 `signatures/blue_multirole_fighter_3_radar_signature.txt` | AFSIM 静默崩溃（`mission.log` 中途截断，无报错） | `mapToBaseType` 不再映射到 `blue_multirole_fighter_1`，蓝方多用途机型回退到 `blue_adv_fighter_1` |
| `platformInstanceToConf` 输出平台体级别的 `speed N kts` | `***** ERROR: Unknown command: speed`（`speed` 仅在 `route`/waypoint 内合法） | 移除平台体级别的 `speed` 输出 |

---

## 2026-06-09 下午 完成清单（Path A 端到端验证）

### 已完成

| # | 任务 | 关键文件 |
|---|------|---------|
| 1 | 添加"东海沿海战役想定"Mock 数据 | `scenarioApi.ts` MOCK_SCENARIOS |
| 2 | 想定编辑器"▶ 运行仿真"按钮 | `ScenarioEditor.tsx` |
| 3 | 修复仿真运行面板 ID 两界问题 | `ScenarioList.tsx` |
| 4 | 修复 simulations.go HTTP 状态码 bug | `simulations.go:50` |
| 5 | 修复 coastal_campaign.scenario 所有语法错误 | `scenarios/coastal_campaign.scenario` |
| 6 | 创建 `coastal_laydown.txt` 平台实例文件 | `demos/simple_scenario/scenarios/coastal_laydown.txt` |
| 7 | **端到端验证通过**：`start 1` + 实时运行 30 mins | Gateway + AFSIM 全链路 |

### 排查出的 AFSIM 场景 5 条规则（踩坑记录）

| 规则 | 原因 |
|------|------|
| `log_file` 必须在 `include_once` 之前 | 否则 include 失败时无日志，调试无从下手 |
| 平台类型名大小写严格匹配 | `red_adv_fighter_1` → 应为 `RED_ADV_FIGHTER_1` |
| 位置格式 `25n 122e`（需要方向后缀）| 纯数字 `25 122` 会导致静默失败 |
| `blue_multirole_fighter_1` 有缺失依赖 | `blue_multirole_fighter_3_radar_signature.txt` 不存在 |
| `GCI` 类型需要 `sub_net` 通信网络 | 平台初始化失败 → AFSIM 退出 → 无 `start 1` |
| 平台实例必须放在独立 laydown 文件中 | 内联定义导致管道竞争，AFSIM 不等待管道连接 |
| 多仿真并发时旧进程占用命名管道 | 启动新仿真前必须 terminate 旧仿真 |

---

## 2026-06-10 完成清单（东海想定修复 + 深度分析）

### 已完成

| # | 任务 | 状态 | 关键文件 |
|---|------|------|---------|
| 1 | 全链路深度分析（两轮）：定位"启动后地图空白"根本原因 | ✅ | — |
| 2 | 验证 JSON 序列化无问题：pb.go tags 与前端字段名完全匹配 | ✅ | `afsim_events.pb.go` |
| 3 | 验证 WebSocket → Zustand → Cesium 渲染链路正常 | ✅ | `websocket.ts`, `PlatformLayer.tsx` |
| 4 | **修复 scenarios.go**：ScenarioInfo 新增 `filename`/`size_bytes`/`created_at`，`name` 去掉 `.scenario` 扩展名 | ✅ | `internal/api/scenarios.go` |
| 5 | 重新编译 gateway.exe | ✅ | `bin/gateway.exe`（2026-06-10 更新） |
| 6 | 写入修复后的 `东海沿海战役想定.scenario` | ⚠️ 已被回滚 | 见下方 P0-A |

### 根本原因分析结论

**地图空白的核心原因**：`东海沿海战役想定.scenario` 内有三处致命错误，AFSIM 在解析阶段立即崩溃（`mission.log` 仅 3 行），从未初始化任何平台。

| 错误类型 | 原内容 | AFSIM 要求 |
|---------|--------|-----------|
| 平台类型不存在 | `J-16 多用途战斗机`、`052D型驱逐舰` 等 | 仅 `blue_adv_fighter_1`、`RED_ADV_FIGHTER_1`、`RED_MULTIROLE_FIGHTER_2`、`AWACS` 可用 |
| 坐标格式错误 | `position 25 122 altitude 9000 m speed 550 knots`（同一行） | `position 25n 122e altitude 9000 m` + 换行缩进 `speed 550 kts` |
| CASE 占位符未填 | `define_path_variable CASE ________` | `define_path_variable CASE east_sea_campaign` |

**其他层均正常**：pb.go JSON tags、hub 广播、state 快照、WebSocket 处理、Cesium 实体创建——全部通过代码审核，coastal_campaign 已验证 7 平台正常渲染。

---

## 下一步任务清单（优先级排序）

> P0（A/B）、P1（C/D/E/F/G）、P2（F/G/H）均已完成并验证（详见上方「✅ 已完成并验证」表格）。以下为待办事项，按优先级排序。

### P2 — 下周（基础设施）

> **✅ 全部完成。** P2-H 真实 InfluxDB 回归已于 2026-06-14 在 **WSL2 原生 dockerd** 环境下通过验证（详见下方「✅ 已完成并验证」P2-H 行 + 「2026-06-14」段）。暂无新增 P2 任务。

---

### P5 — 新增问题（待分析，2026-06-14）

| # | 问题 | 状态 |
|---|------|------|
| P5-1 | 装备数据管理页面「装备模型」中，AFSIM 自带的「机动模型创建工具 - Mover Creator」是否可以迁移到 Web 平台？ | pending（已初步勘察，见下方分析） |
| P5-2 | 想定编辑器「任务管理」缺少"武器交战"/交战策略任务类型 | ✅ 已实现，见上方「已完成并验证」表格 P5-2 行 |
| P5-3 | "运行仿真"后仿真页面报错（仿真实际已正常完成，却被标记为 error） | ✅ 已修复，见下方说明 |
| P5-4 | "运行仿真"页面整页崩溃（`PageErrorBoundary:仿真运行` 捕获 `Cannot read properties of undefined (reading 'toFixed')`） | ✅ 已修复（已浏览器复现+修复+回归验证），见下方说明 |
| P5-5 | 仿真运行模块选择 `iamd_layered_defense`（三层 IAMD 想定）端到端分析 | 🔍 已分析（链路通过 + 发现 4 项问题，待决策），见下方说明 |

#### P5-2 实现说明

- `types.ts`：`MissionType` 新增 `'engage'`；新增 `EngagementROE`（`auto`/`hold`/`tight`/`free`）与 `EngagementConfig`（`weaponName`/`targetPlatformId`/`roe`/`maxRange`/`salvoSize`）；`MissionDefinition` 新增可选字段 `engagement?: EngagementConfig`。
- `ScenarioEditor.tsx` 任务管理面板：任务类型下拉新增"武器交战"；选中 `engage` 类型任务时展示武器交战配置区（武器选项取自该任务已分配平台的 `PlatformInstance.weapons`、目标平台、ROE、交战距离、齐射数量）。
- `scenarioExporter.ts`：新增 `engagementProcessorLines()`，在 `platformInstanceToConf` 末尾为每个分配了 `type==='engage'` 任务的平台追加：
  - 一个 `geo_sensor`（`WSF_GEOMETRIC_SENSOR`，全向/`ignore_same_side`/`internal_link track_manager`，与 P4-5b 手写场景的传感器配置一致）用于建立 `MasterTrackList`；
  - 每个交战任务一个 `engage_mgr`（`WSF_SCRIPT_PROCESSOR`）：`roe==='hold'` 时仅注释不开火；否则 `on_update` 中 `foreach MasterTrackList`，过滤己方/已交战目标/（可选）`targetPlatformId` 对应的平台名，`SlantRangeTo < maxRange` 时用 `PLATFORM.Weapon(weaponName).FireSalvo(track, salvoSize)`。
- `scn-coastal-campaign`（MOCK_SCENARIOS）新增示例任务 `mission-engage-cap`「蓝鹰编队拦截交战」：`assignedPlatforms: [蓝鹰01, 蓝鹰02]`，`engagement: {weaponName:'int_missile', roe:'free', maxRange:60000, salvoSize:1}`。
- **验证**（临时脚本 + `mission.exe` 直跑，已清理）：
  1. 导出含新任务的 `scn-coastal-campaign` → `mission.exe` 跑 5min，`start 1`/`complete 300.001`，无解析错误；因双方初始相距 >400km，5min 内未进入 60km 交战距离，未开火——符合预期（脚本逻辑正确但本想定时间窗口内地理上不会触发，是否需要调整初始几何/任务时长留待后续优化）。
  2. 最小验证场景（蓝/红各1机，初始相距 ~20km，1min）：stdout 输出 `"蓝方01" [蓝方01拦截交战] engaging "红方01" at range 20209`，`.evt` 含 `WEAPON_FIRE_REQUESTED`/`WEAPON_FIRED ... Weapon: int_missile`，确认导出脚本语法与触发逻辑正确。
- **后续可选优化**：若想让 `scn-coastal-campaign` 在 30min 默认仿真时长内真正打出这枚交战导弹，可考虑放宽 `maxRange`（如 150km）或调整蓝鹰巡逻航线使其更早接近红方突防编队。

#### P5-3 修复说明

- **现象**：用户反馈"仿真运行页面出错了"。检查 `GET /api/simulations/{id}` 发现部分仿真状态为 `error`，错误信息为 `event pipe read error: reading length prefix: No process is on the other end of the pipe.`，但对应的 `output/<id>.log` 显示 `complete 1800.500 ...`——仿真其实已正常跑完。
- **根因**（`afsim-gateway/internal/api/handler.go` `SimulationManager.Create`）：mission.exe 正常退出时会关闭其持有的 event pipe 句柄，gateway 侧 `connector.Run()` 的 `ReadMessage` 随即返回"管道另一端已无进程"错误；这与"进程退出 → 标记 complete"的监控 goroutine之间存在竞态——若 pipe 读错误先被处理，状态被错误地置为 `error`，覆盖了本应是 `complete` 的结果。
- **修复**：
  - `internal/engine/process.go`：`ProcessManager` 新增 `exitErr` 字段 + `ExitErr()`，记录 `cmd.Wait()` 的真实退出错误（仅在非主动 `Terminate` 场景下记录，`Terminate` 触发的 context 取消不算错误）。
  - `internal/api/handler.go`：connector 的错误处理 goroutine 改为：`connector.Run` 返回错误后，先等待（最多 2s）进程退出信号——若进程已正常退出（`ExitErr()==nil`），不再标记 `error`（交由退出监控 goroutine 标记 `complete`）；若进程异常退出或 2s 内仍未退出（仍在运行但管道异常），才标记 `error`。
- **验证**：`go build ./...` 通过；重新构建并重启 gateway（`AFSIM_MISSION_PATH=../AFSim/afsim-2.9.0-win64/bin/mission.exe`），实跑 `scn-1781433311711`（`-rt` 模式）并主动 `/terminate`，确认 `mission.exe exited (exit status 1)` 不再被误判为 `error`。
- **附带发现（未修复，记录待跟进）**：gateway 的 event/control 命名管道路径是全局固定的（`\\.\pipe\afsim_events`/`afsim_control`），`SimulationManager` 未限制并发——若已有一个仿真在运行时再次"运行仿真"，新进程会因 `CreateFile pipe: All pipe instances are busy` 持续重试连接，永远卡在 `running`/连不上事件流。本次排查中还清理了 2 个因重复点击"运行仿真"而残留的 `scn-coastal-campaign` 孤儿 `mission.exe` 进程。建议后续：①前端"运行仿真"按钮在请求进行中禁用避免重复点击；②gateway 按 simulation id 生成独立管道名，或在已有仿真运行时拒绝/排队新的 `Create`。

#### P5-4 修复说明

- **现象**：用户报告"运行仿真"页面出错，整页被 `PageErrorBoundary:仿真运行` 接管（白屏），错误为 `TypeError: Cannot read properties of undefined (reading 'toFixed')`。后端仿真本身正常运行/完成（与 P5-3 不同，这是纯前端渲染崩溃）。
- **浏览器复现（Playwright + 系统 Chrome channel，登录 admin/admin123 → 仿真运行 → 启动想定 → 展开全部面板 + 遍历指挥链树选择平台 + 切换详情页签）**：在 `scn-coastal-campaign`（含海面舰艇 `172昆明舰`/`570黄山舰`，`alt=0`）复现，堆栈精确定位到 `PlatformLayer.tsx` `createDescription` 的 `platform.alt.toFixed(0)`（实体创建分支 `billboard`/`description` 处）。
- **根因**：网关 WS 负载用 protobuf 生成的 pb.go 结构体序列化（`json:"lat,omitempty"`/`alt,omitempty` …），**零值字段会被整条 JSON 省略**。海面舰艇 `alt=0`，其 `mover_update` 不含 `alt`；前端 `websocket.ts` 的 `mover_update` 处理用 `alt: p.alt`（=`undefined`），`platformStore.updatePlatform` 的浅合并 `{...existing, ...updates}` 用 `undefined` **覆盖**了 `platform_added` 时写入的有效 `alt:0`。随后 PlatformLayer 的 effect 因平台对象变化重跑、对尚无实体的平台（中途加入的导弹平台、或 Viewer 重建后被视为缺失的平台）走"创建实体"分支调用 `createDescription` → 对 `undefined` 调 `.toFixed` 崩溃。`full_snapshot` 用的是 `simstate` 手写结构体（`json:"lat"` 无 omitempty，零值仍序列化），所以快照路径不触发——这也是为何只在持续 `mover_update` 后偶发。
- **修复（双重防御）**：
  - `afsim-web/src/api/websocket.ts`（`mover_update`）：`lat`/`lon`/`alt` 改为 `?? 0`（与 `platform_added` 一致，omitempty 省略即代表 0），确保平台位置/高度字段永不被 `undefined` 覆盖——根因修复。
  - `afsim-web/src/components/Globe/PlatformLayer.tsx`（`createDescription`）：`lat`/`lon`/`alt`/`damageFactor` 全部 `?? 0` 守卫——崩溃点兜底，防止任何部分态再次触发。
- **验证**：`npx tsc --noEmit` 0 错误 + `npx vitest run` 32/32 通过 + `npx vite build` 成功；**Playwright 回归**：用与复现完全相同的 4 想定全量 sweep（启动→拉满时钟速率→展开全部面板→持续遍历选择平台/切页签，含此前崩溃的 `scn-coastal-campaign`）→ `ERRORS (0)`，整页不再崩溃。
- **附带说明**：`track_updated` 处理（`websocket.ts:468-474`）有同类 `lat: trackUpdate.lat`（omitempty 省略→undefined）隐患，但因其 id 解析用 `track_number` 而 `trackStore.trackKey` 用 `target_index`，键不匹配恒为 no-op（`updateTrack` 找不到 existing 直接返回），加之 `track_initiated` 已用 `?? 0` 守卫，故当前不触发崩溃；本轮未改动，记录待后续若修正 track id 方案时一并加固。

#### P5-1 初步勘察

`Mover Creator`（`AFSim/afsim-2.9.0-win64/swdev/src/mover_creator/`）是 AFSIM 自带的**独立 Qt 桌面 GUI 程序**（`MoverCreatorApplication` + `MoverCreatorMainWindow`，766 个文件，含 `source/`/`ui/`/`data/{Airfoils,Engines,Atmosphere,Vehicles}/`/`wsftheme/`），用于通过表单/向导配置飞行器气动外形、发动机、起落架、控制面等参数，计算/调优六自由度（P6DOF）气动与推力数据，最终导出 AFSIM `mover` 配置块（`.txt`/`platform_type` 片段）供想定引用。

**迁移到 Web 平台的可行性**：技术上可行但**工作量大**，属于全新功能模块（非小补丁），主要难点：
1. **UI 重写**：766 个 Qt `.ui`/`.cpp`/`.hpp` 文件（多标签向导式表单）需要用 React + Ant Design 重新设计交互流程，不能直接复用。
2. **计算逻辑迁移**：气动系数估算、推力曲线插值、配平/性能计算等核心算法是 C++ 实现，需要重写为 TypeScript（前端）或 Go（后端服务），且需要原始算法文档/论文支撑以保证结果一致性。
3. **数据资源**：`data/Airfoils`、`data/Engines`、`data/Atmosphere`、`data/Vehicles` 等参考数据集需迁移并建立对应的数据管理/选择 UI。
4. **输出对接**：生成的 mover 配置块需要与现有 `afsim-web/src/modules/equipment/afsim/types.ts` + `io/confWriter.ts`（P3-4c 已重构的传感器/武器/通信等配置类型体系）打通，作为「装备模型」的机动模型（mover）部分写入装备配置。

**建议**：先做一次范围界定 —— 是否只需覆盖 Mover Creator 支持的某几类常用 mover（如 `WSF_P6DOF_MOVER`/`WSF_AIR_MOVER`），还是要对齐其全部向导能力；再据此评估是分阶段（先支持参数表单 + 直接编辑现有 mover 字段，气动计算暂用预设模板/简化公式）还是完整迁移。本轮仅记录问题与初步勘察，未实施代码改动。

#### P5-5 分析结论（仿真运行模块选择 `iamd_layered_defense` 端到端分析，2026-06-16，本轮仅分析未改代码）

**背景**：`afsim-gateway/scenarios/` 自 2026-06-15 起新增 4 个想定（`air_to_air_bvr`/`air_to_ground_strike`/`iamd_layered_defense`/`isr_surveillance`，P1-E 记录的"仅保留 2 文件"已过时，属预期内的演示内容扩充）。本轮针对 `iamd_layered_defense`（22450 字节，一体化防空反导三层防御剧本）做端到端分析。

**链路（选择 → 启动）**：仿真运行模块的想定列表为 `components/ScenarioPanel/ScenarioList.tsx`（网关侧，区别于编辑器的 `modules/scenario/components/ScenarioList.tsx`）。`api.listScenarios()`→`GET /api/scenarios` 列出网关磁盘 `.scenario` 文件；点「启动」→ `handleStart('iamd_layered_defense')`→`startSimulation(id,'realtime')` 拉起 `mission.exe`→`connectWebSocket(sim_id)`；数据流 `mission.exe`→event_gateway 插件→命名管道→网关→WS→CesiumJS。

**想定内容**：三层 IAMD（`random_seed 12345`，`end_time 900s`）——外层 ddg-guardian（LONG 200nm 雷达，STANDARD_SAM×20，8–95km，跳过 UAV）/ 中层 patriot-bastion（MEDIUM 80nm，STANDARD_SAM×16，3–75km，跳过 UAV）/ 内层 shorad-sentry（SHORT 20nm，SHORT_SAM×14，0.5–12km，专打 UAV）/ 预警 e2d-hawkeye（仅监视）；红方 2×SU-30 高空、1×巡航导弹低空、2×攻击 UAV 低慢小，自东向西突入。

**运行结果验证**（`output/iamd_layered_defense.{log,evt,aer}`，实时运行至 ~00:05:43）：`log` 含 `start 1`；交战战果——外层 DDG 发射 **20**（=满弹量，打光）命中 4（su30-strike-2×2/su30-strike-1×1/cruise-msl-1×1）；中层 Patriot **0 发未参战**；内层 SHORAD 发射 6 命中 2（uav-swarm-1/2 各 1）。合计 26 发 / 6 命中 / 6 脱靶 / `PLATFORM_DELETED=0`。**链路本身通过**（选择→启动→AFSIM 三层探测+开火→事件流均真实产生）。

**发现的 4 个问题（待决策，按重要度）**：
- **(a) ⚠️ 运行态异常，阻断"再次启动"**：分析时有一个 `mission.exe`(PID 30764) 在实时跑，但 `GET /api/simulations` 返回空——网关无该仿真记录（疑似网关重启丢内存态，或该进程命令行直起未经 SimulationManager）。此时前端再点「启动」，新进程会因全局命名管道 `\\.\pipe\afsim_events` 被占用而 `All pipe instances are busy` 卡死连不上事件流（即 P5-3 附带记录的并发隐患）。**要在前端干净验证需先终止该孤儿进程。**
- **(b) 中层 Patriot 形同虚设**：外层 DDG 包线(95km)完全覆盖中层(75km)且更早交战，高空目标进入 Patriot 包线前已被外层消耗，分层"接力"未体现。
- **(c) 外层弹药浪费**：`FIRE_COOLDOWN 4s + REENGAGE_DELAY 10s` 节奏过快，对同一波 3 个目标 90 秒内打光全部 20 发（命中评估前持续补射），20 发仅 4 命中；打光后外层失去拦截能力。
- **(d) 有命中无毁伤**：6 次 `WEAPON_HIT` 但 `PLATFORM_DELETED=0`，命中后目标未被移除（lethality 未达移除阈值 / AFSIM 未发删除事件），前端"击毁数"会显示 0。

**候选后续（未实施）**：① 终止孤儿 `mission.exe`(PID 30764) 恢复前端可启动；② 想定调优——收紧外层近界让目标给中层、给外层加弹药纪律（命中评估后再补射）、调 lethality 让命中能毁伤；③ 浏览器 e2e 复测前端渲染（需先做 ①）。

---

### P3 — 已知遗留（技术债，不急）

| # | 问题 | 位置 |
|---|------|------|
| 1 | Cesium 3D 拖拽布置 — 已分析，详见下方说明，暂不实现 | `ScenarioMapContainer.tsx:71` / `ScenarioEditor.tsx:774-803` |

> P3-4 的 169 个 confWriter.ts 类型错误已于 2026-06-12 全部清零（见上方 P3-4c），该项技术债已关闭。

---

## ✅ 本轮新增完成（P3-2，行为树嵌套子树）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P3-2 | 行为树嵌套子树（`advanced_behavior_tree ... end_advanced_behavior_tree` 作为任意节点的子节点）结构化解析/序列化/编辑：新增 `BehaviorSubtreeKind`，`BehaviorTreeNode` 增加 `description`/`btt`/`rootNodeType`/`successPolicy` 字段；`parseBehaviorTreeNode` 递归识别嵌套 `advanced_behavior_tree` 块（不完整时仍回退为 `null` → 原始文本兜底）；`behaviorNodeToConf` 对应输出 `advanced_behavior_tree...end_advanced_behavior_tree` 及其属性；`BehaviorTreeEditor` 新增"子树"节点类型选项，支持编辑 name/desc/root_node_type/success_policy/btt 与添加子节点 | `npx tsc --noEmit`（未引入新错误，确认现有 1082-1086 行错误为 P3-4 预存问题）+ `npx vite build` 全量构建成功 | `afsim-web/src/modules/equipment/afsim/types.ts`, `io/confParser.ts`, `io/confWriter.ts`, `components/BehaviorTreeEditor.tsx` |

> 注：vitest 未安装于本环境（无 `test` script、`node_modules` 缺少 vitest），`confParser.test.ts` 等既有测试当前不可运行——这本身也是 P3-4 类技术债的一部分，未在本轮修复范围内。

---

## 🔍 P3-1 分析结论（Cesium 3D 拖拽布置，本轮仅分析未改代码）

**结论：底层拖拽放置机制已完整实现，缺口在于想定编辑器从未启用 Cesium 3D 模式。**

已确认完整可用：
- `CesiumEngine.screenToLngLat`（`CesiumEngine.ts:780-794`）：地形拾取（`getPickRay`+`globe.pick`）+ 椭球面回退，已实现。
- `LeafletEngine.screenToLngLat`（`LeafletEngine.ts:878-882`）：已实现。
- `ScenarioMapContainer.tsx` 的 `dragover`/`drop` 监听：引擎无关，统一调用 `engine.screenToLngLat()`，已实现。
- `PlatformPlacer.tsx:186-204`：拖拽源已正确设置 `application/x-truesim-equipment-id` MIME。
- `ScenarioEditor.tsx:445-470` 的 `handleDropEquipment`：完整实现，创建 `PlatformInstance` 并 `addPlatform`。

**真正的缺口**：`ScenarioEditor.tsx:774-803` 调用 `<ScenarioMapContainer>` 时未传 `engineType`，默认走 `engineType = 'leaflet'`（2D），想定编辑器地图永远是 2D，Cesium 3D 拖拽路径目前不可达/不可测。

**若未来要修复**，需要：
1. 在 `ScenarioEditor.tsx` 工具栏接入现成的 `MapEngineSelector`（`MapEngineContext.tsx`/`MapEngineSelector.tsx`，已用于 `DualMapView.tsx`/`MapView.tsx`）。
2. `ScenarioMapContainer` 当前初始化 `useEffect` 依赖为 `[]`（仅挂载时跑一次），需改为响应 `engineType` 变化（destroy 旧引擎 + 重新 `initialize`，或用 `key={engineType}` 强制重挂载）。
3. 切换到 Cesium 后验证 3D 场景下拖拽放置的坐标拾取效果。

经与用户确认，本轮**不实现**该切换 UI，仅记录现状供下一阶段参考。

---

## ✅ P3-3 复核：`GetScenarioComparison` 已是 gRPC 实现（无需迁移）

`data-platform/services/data-gateway/internal/handler/timeseries.go:189-226` 的 `GetScenarioComparison` 已完全基于 `pb.TimeseriesServiceClient`（`ListReplays` + `GetSimulationStats`）聚合实现，不存在绕过 gRPC 的直接 DB/REST 访问。`go build ./...` 与 `go vet ./...`（data-gateway）均通过。判定该项此前已完成，next-steps.md 中的遗留条目已移除。

---

## ✅ 本轮新增完成（P4-1/P4-2：仿真运行四问题排查）

用户报告执行 `scn-coastal-campaign.scenario` 后出现 4 个问题，逐一排查并按优先级处理：

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P4-1 | 修复 `POST /api/simulations/:id/clock-rate` 400 错误：前端发送 `{clock_rate: rate}`，但 Go 后端 `clockRateRequest` 期望 JSON key 为 `rate`，键名不匹配导致 `req.Rate` 恒为 0 → `400 {"error":"rate must be positive"}`（恰好 33 字节，与日志吻合）。修复为发送 `{rate}` | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/api/client.ts:184-189`（`setClockRate`） |
| P4-2 | 修复地图图标/字体模糊（HiDPI 渲染）：① `CesiumEngine` 初始化后设置 `viewer.resolutionScale = window.devicePixelRatio \|\| 1`；② 平台图标画布从 32x32 提升到 64x64（`RENDER_SIZE = 64`），billboard 显式指定 `width:32/height:32` 保持显示尺寸不变 | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/core/map-engine/CesiumEngine.ts`（构造函数）, `afsim-web/src/components/Globe/PlatformLayer.tsx`（`createPlatformIcon`） |
| P4-2b | 平台标签字体颜色按阵营区分：蓝方蓝色、红方红色（原全部为白色）。新建实体的 `label.fillColor` 与既有实体更新逻辑均改为 `getSideColor(platform.side)`（`sideColors.ts` 中 blue=`#0078D7`/red=`#D72828`），保留黑色描边以保证可读性 | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/components/Globe/PlatformLayer.tsx`（label 创建块 + 更新块） |
| P4-2c | 调整标签配色 + 图标/字号统一放大一号：① 新增 `getLabelColor()`（`sideColors.ts`），蓝方标签改为蔚蓝 `#70f3ff`（红方仍用 `getSideColor` 的 `#D72828`），label 创建块与更新块均改用 `getLabelColor`；② billboard 显示尺寸 32x32 → 40x40，图标渲染画布同步从 64x64 → 80x80（保持 2x 分辨率比例），破损红叉线宽/坐标按比例放大；③ label 字号 `11px` → `13px`，`pixelOffset` 从 `(0,-16)` → `(0,-20)` 适配更大图标 | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/utils/sideColors.ts`（新增 `getLabelColor`）, `afsim-web/src/components/Globe/PlatformLayer.tsx` |
| P4-2d | 平台标签显示英文占位名问题：`东海沿海战役想定.scenario`（即前端运行的"东海"想定）的 7 个平台名为占位英文 `BlueCAP01/BlueCAP02/BlueAWACS/RedStrike01/RedStrike02/RedEW/RedAEW`，前端 label 显示的是 `platform.name`（来自网关 `pd.name`，即 AFSIM `platform` 名），所以显示为英文而非中文。改为与 `scn-coastal-campaign.scenario` 一致的中文命名：`"蓝鹰01"`/`"蓝鹰02"`/`"蓝鹰AEW"`/`"红剑01"`/`"红剑02"`/`"红鹰EW"`/`"红眼AEW"`（沿用双引号包裹的 AFSIM 平台名语法，与 P1-D 已验证的中文平台名写法一致） | `mission.exe` 直接运行该场景（8s timeout）：`Initializing simulation complete` + `start 1` + `complete 1800.000`，警告中平台名正确显示为 `"蓝鹰01"`/`"蓝鹰02"`，无解析错误 | `afsim-gateway/scenarios/东海沿海战役想定.scenario` |
| P4-6 | 时钟速率（clock-rate）功能全链路测试：编写临时 WS 测试脚本（`clockrate_test.mjs`，测试后已删除），启动 `coastal_campaign` 仿真（realtime 模式），先在 rate=1 下采样 5s，再调用 `POST /api/simulations/1/clock-rate {rate:5}`，继续采样 5s，对比 `sim_time` 推进速率与墙钟时间的比值 | rate=1 阶段：墙钟 5.05s / 仿真时间 5.25s，比值 1.04（≈1x，符合预期）；rate=5 阶段：墙钟 5.10s / 仿真时间 23.25s，比值 4.56（≈5x，符合预期，存在命令传递+事件队列的小幅延迟属正常）。**结论：时钟速率功能完全正常**，P4-1 修复后 REST→控制管道→`WsfSimulation::SetClockRate`→`mClockSourcePtr` 全链路生效；前端 `SimControls.tsx` 的滑块/预设按钮逻辑（`setClockRateLocal` 乐观更新 + `setClockRate` API 调用）也已验证无误，无需改动 | 验证用临时脚本（已清理），无源码改动 |

---

## ✅ 本轮新增完成（P4-3：航线图层）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P4-3 | 实现"预设航线"叠加显示：新增 `RouteLayer.tsx`（与 `PlatformLayer.tsx` 并列、独立于 LayerManager/`ZoneRenderer`），通过既有 `GET /api/scenarios/{id}`（text/plain）获取当前场景原文，用新增的 `parseScenarioRoutes()`（`scenarioRouteParser.ts`）解析顶层独立 `route <name> ... end_route` 块（区分于 `platform...end_platform` 内的内联运动航线），将每条航线渲染为黄色虚线 `PolylineGraphics` + 名称标签；新增 `getScenarioText()`（`client.ts`，对 `request()` 返回的 Blob 调用 `.text()`）；`useTrackSettingsStore` 新增 `showRoutes`（默认开），并在 `TrackHistory.tsx`「轨迹显示」卡片新增"预设航线"开关 | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/components/Globe/RouteLayer.tsx`（新建）, `afsim-web/src/utils/scenarioRouteParser.ts`（新建）, `afsim-web/src/api/client.ts`（`getScenarioText`）, `afsim-web/src/store/trackSettingsStore.ts`（`showRoutes`）, `afsim-web/src/modules/simulation/components/TrackHistory.tsx`（开关）, `afsim-web/src/components/Globe/GlobeView.tsx`（挂载 `RouteLayer`） |

> 说明：当前运行的 `东海沿海战役想定.scenario` 仅含平台内联航线（无独立 `route <name>`），因此该想定下不会显示额外的预设航线线条（符合预期）；`scn-coastal-campaign.scenario` 含 3 条独立命名航线（"蓝方CAP巡逻路线"/"蓝方舰队机动路线"/"红方突防路线"），运行该想定时会叠加显示。

---

## ✅ 本轮新增完成（P4-4：场景行为树调整，使红蓝双方实际触发交战）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P4-4 | `scn-coastal-campaign.scenario` 中红方 2 架战机（"红剑01"/"红剑02"）原本只沿航线飞行，无传感器/无开火逻辑，导致 30 分钟仿真内 `WEAPON_*` 事件数为 0、交战时序面板始终为空。为 4 架战机（"蓝鹰01"/"蓝鹰02"/"红剑01"/"红剑02"）各新增 `add sensor geo_sensor WSF_GEOMETRIC_SENSOR`（全向、200km、`ignore_same_side`，上报至既有 `track_manager`）+ `add processor engage_mgr WSF_SCRIPT_PROCESSOR`（每 2 秒遍历 `PLATFORM.MasterTrackList()`，对 60km 内的异方有效航迹用机上已有的 `int_missile`（`SIMPLE_A2A_MISSILE_WEAPON`）`FireSalvo` 一次，每个目标只打一次） | `mission.exe "scn-coastal-campaign.scenario"`（30s timeout）：`Initializing simulation complete` → `Starting simulation` → `complete 1800.000`（完整 30 分钟，无解析/脚本错误）；输出 `output/scn-coastal-campaign.evt` 中出现 4 条 `WEAPON_FIRED`（"红剑01"/"红剑02" 各打 2 发，目标为 "172昆明舰"/"570黄山舰"）+ 对应 `WEAPON_MISSED`/`WEAPON_TERMINATED`，交战时序不再为空 | `afsim-gateway/scenarios/scn-coastal-campaign.scenario`（"蓝鹰01"/"蓝鹰02"/"红剑01"/"红剑02" 4 个 platform 块） |

> 说明：本轮命中结果为全 MISS——红方使用的 `int_missile`（`BLUE_SR_A2A_IR_MISSILE_BASE`，最大射程约 17.4km）针对的是海面舰艇目标（非其设计的空中目标），在 ~60km 距离上发射后未能命中是预期内的物理结果；若需要 `WEAPON_HIT`，可后续再调整目标选择逻辑（如仅锁定空中目标）或更换更适合反舰的武器定义，属于进一步的场景内容调优，非本次范围。

---

## ✅ 本轮新增完成（P4-5a：仿真统计面板"数据平台未连接"提示）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P4-5a | `SimulationStats.tsx` 在数据平台不可达时此前会静默显示全零的 `EMPTY_STATS`（用户无法分辨"仿真无数据"和"数据平台未运行"）。`replayApi.getSimulationStats()` 在 catch 分支为 `EMPTY_STATS` 新增 `_unavailable: true` 标记；`SimulationStats.tsx` 检测到该标记时改为渲染 `Alert type="warning"`「数据平台未连接」+ 重试按钮，不再显示全零统计表格 | `npx tsc --noEmit`（169 个预存错误不变）+ `npx vite build` 成功 | `afsim-web/src/api/replayApi.ts`（`SimulationStats._unavailable`），`afsim-web/src/modules/simulation/components/SimulationStats.tsx`（不可达提示 Alert） |

---

## 🔍 P4-5b 分析结论（已于 2026-06-12 实施完成，见「✅ 已完成并验证」表格 P4-5b 行；以下为当时的分析记录）

### P4-5b：任务分配总览（`TaskAssignmentOverview.tsx`）未显示

完全依赖 `PlatformInfo.mission?: MissionStatus` 字段，但**该字段从未被 gateway/插件填充**——`websocket.ts` 中唯一相关代码 `if (p.mission !== undefined) moverUpdates.mission = p.mission` 永远不会触发，因为 gateway 的 `mover_update` payload 里根本没有 `mission`。这是**全新的数据管线**：需要 AFSIM 插件侧获取平台任务/行为树状态 → protobuf 新增字段 → gateway 转发 → 前端消费，工作量较大（涉及 Track A + B + C）。

**已评估的替代方案（前端启发式推导，未采用）**：分析现有事件流（`weaponStore` 开火记录、P4-3 解析的平台内联航线 + 当前位置）可粗略推导 `mission.type`/`progress`/`waypointsRemaining`/部分 `status`（`engaging`/`en_route`/`on_station`/`aborted`），但 `rtb`/`completed` 语义无法还原，且 `mission.type` 依赖航线命名关键词匹配（换想定可能失效）。用户决定不采用启发式近似值，保持现状（"当前平台均未分配任务"），等待真实的 AFSIM 任务分配/行为树状态管线（需 WsfTaskObserver `TaskAssigned`/`TaskCompleted` + 新 protobuf 消息 + gateway 转发，且当前 `scn-coastal-campaign.scenario` 未使用 `WsfTaskManager` 任务分配机制，需先调整场景脚本才能产生数据）。

**2026-06-12 更新：用户确认实施全链路真实管线方案，已完成并通过 e2e 验证（mission.exe 直跑 + WS e2e + 快照恢复），详见上方 P4-5b 行。**

---

## ✅ 本轮新增完成（P3-4 第一步：vitest 安装 + 1 个 trivial 类型错误）

| # | 任务 | 验证方式 | 关键文件 |
|---|------|---------|---------|
| P3-4a | `afsim-web/src/api/websocket.ts:429` `trackList.map((t) => ...)` 参数 `t` 隐式 any → 显式标注 `t: unknown` | `npx tsc --noEmit` 该错误消失 | `afsim-web/src/api/websocket.ts` |
| P3-4b | 安装 `vitest@^2.1.9` 为 devDependency，`package.json` 新增 `"test": "vitest run"` script，修复 3 个测试文件的 `Cannot find module 'vitest'` 错误 | `npx vitest run` → 3 个测试文件 32 个用例全部通过 | `afsim-web/package.json` |

**剩余 169 个错误**全部集中在 `afsim-web/src/modules/equipment/io/confWriter.ts`，根因：`RadarSensorMode`/`EoirSensorMode`/`RfJammerMode`/`TransmitterConfig`/`ReceiverConfig`/`AntennaConfig` 等类型在 `afsim/types.ts` 中被定义为占位符 `Record<string, unknown>`，但 `confWriter.ts` 中访问了大量具体字段（`detectionThreshold`/`beams`/`transmitter`/`receiver`/`errorModelParameters` 等），TS 将 `unknown` 经真值收窄后视为 `{}`，导致属性访问报错。修复需要为这 6 个类型重新设计具体字段接口（较大的类型系统重构，经用户确认本轮不做，留待下一阶段独立任务）。

> **2026-06-12 更新**：该重构已完成（见「✅ 已完成并验证」表格 P3-4c），`npx tsc --noEmit` 现为 **0 错误**。后续若 tsc 出现新错误即为新引入的回归。

---

*更新于 2026-06-14：完成 **P2-H 真实 InfluxDB 端到端回归**（此前唯一的 Docker 阻塞项）。本机 Docker Desktop 后端损坏（引擎 init 永久卡 "Starting the Docker Engine..."，`docker-desktop` WSL 发行版能 boot 但 guest-services/dockerd 起不来），改走 **WSL2 Ubuntu-22.04 原生 dockerd**。新增 `data-platform/scripts/setup-wsl-docker.sh`（一键：apt 装 docker.io + 下 Go 1.23 + daocloud 镜像源[Docker Hub 本网络被墙] + 切 iptables-legacy + modprobe WSL2 内核缺省未加载的全套 netfilter 模块[nat/bridge/MASQUERADE/raw/mangle] + 起 dockerd）。`verify-p2h.sh` 在 Ubuntu 内跑通：`GetEngagementEvents` 重建 64 launch+32 impact、`StreamFrames` 跨轮询收齐 5 帧，**exit 0 验证通过**。至此 next-steps.md 全部待办（含历史阻塞项）清零。详见 `data-platform/scripts/README-p2h-verify.md` 的「✅ 已验证（WSL2 原生 dockerd）」段（含 WSL2 跑原生 docker 的 netfilter 模块踩坑记录）。*

*更新于 2026-06-12（第二轮会话）：快速回归验证通过——gateway/前端均需冷启动（两服务此前未运行，按指引以 `AFSIM_MISSION_PATH` 启动 gateway + `npm run dev`），场景文件完好（`CASE east_sea_campaign`），东海想定 WS e2e：342 条消息（`full_snapshot×1`/`platform_added×7`/`platform_initialized×7`/`sensor_turned_on×3`/`mover_update×252`/`frame_complete×71`），terminate 正常。随后经用户确认实施 P4-5b 全链路（任务分配数据管线，Track A+B+C）：proto 新增 Task 事件 → 插件接 WsfTaskObserver 重编 DLL → gateway 转发 + 快照 mission → 前端消费 → 场景加 WSF_TASK_PROCESSOR 自分配任务，mission.exe 直跑（4 assigned + 2 complete）与 WS e2e（`task_assigned×4`/`task_completed×2`/快照 4 平台带 mission）全部通过，详见「✅ 已完成并验证」P4-5b 行。剩余待办仅 P2-H 真实 InfluxDB 回归（本机确认无 Docker，仍阻塞）。*

*更新于 2026-06-12：本轮先通过快速回归验证（gateway/前端重启 + 东海想定 WS e2e：289 条消息，`platform_added×7`/`mover_update×210`/`frame_complete×60`，terminate 正常），随后完成 P3-4c（confWriter.ts 169 个类型错误清零，tsc 0 错误 + vitest 32/32 + vite build 通过），P3 技术债仅剩 Cesium 3D 拖拽（已决定暂不实现）。下一阶段候选：P4-5b 任务分配数据管线（待用户确认优先级，跨 Track A/B/C）、P2-H StreamFrames/GetEngagementEvents 真实 InfluxDB 回归（需 Docker 环境）。*

*更新于 2026-06-11，P0/P1（含 G）全部完成并通过 e2e 验证；P2-F/G/H 已全部完成（P2-G 判定为非问题；P2-H 补全 timeseries 两个 TODO，含 build/vet/test 验证）；P3-2（行为树嵌套子树）已完成（含 tsc/vite build 验证）；P3-1 已分析完成（机制完整，缺口为编辑器未启用3D，暂不实现切换UI）；P3-3 复核为已完成（无需迁移）；P3-4 已完成 vitest 安装+1个trivial错误修复（173→169），剩余 169 个 confWriter.ts 类型错误为下一阶段独立重构任务。P4-1（clock-rate 400 修复）/P4-2（图标字体模糊修复，含 P4-2b 阵营标签配色、P4-2c 图标字号放大、P4-2d 东海想定平台名改为中文）已完成并通过 build/mission.exe 验证；P4-6（时钟速率全链路测试）已完成，确认 1x/5x 均按预期生效，无需改动；P4-3（预设航线图层）已完成：新增 `RouteLayer.tsx` + `scenarioRouteParser.ts` 解析独立命名航线并渲染为虚线+标签，新增 `showRoutes` 开关，通过 build 验证；P4-4（场景行为树调整）已完成：为 `scn-coastal-campaign.scenario` 中 4 架战机新增 `geo_sensor`+`engage_mgr` 脚本处理器，验证产生 4 条 `WEAPON_FIRED`+`WEAPON_MISSED`/`WEAPON_TERMINATED`，交战时序不再为空；P4-5a（仿真统计面板"数据平台未连接"提示）已完成：`SimulationStats.tsx` 在 `getSimulationStats()` 失败时显示 Alert 提示而非全零数据，通过 build 验证；P4-5b（任务分配总览缺 mission 数据管线）已分析完成，为范围较大的新功能，待用户确认优先级。*
