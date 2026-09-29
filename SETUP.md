# TrueSim 开发环境搭建指南

本文件供新机器上克隆仓库后，由 AI agent 或开发者直接按步骤执行。

## 前置条件

| 工具 | 最低版本 | 验证命令 |
|------|----------|----------|
| Go | 1.23+ | `go version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| CMake | 3.16+ | `cmake --version` |
| Visual Studio | 2019+ (含 C++ 桌面开发) | — |
| Git | 2.x | `git --version` |

> **注意**: AFSIM 引擎二进制包 (`AFSim/`) 未纳入版本控制。如需运行仿真，需单独部署。

## 步骤 1: 克隆仓库

```bash
git clone <repo-url> TrueSim
cd TrueSim
```

## 步骤 2: 构建 Go 网关

```bash
cd afsim-gateway
go build -o bin/gateway.exe ./cmd/gateway
```

验证：
```bash
./bin/gateway.exe --help 2>&1 || echo "binary built successfully"
```

> 如果 `go build` 失败，检查 `go.mod` 中的依赖是否完整：`go mod download`

## 步骤 3: 安装前端依赖

```bash
cd afsim-web
npm install
```

验证：
```bash
npx vite --version
```

## 步骤 4: 构建 C++ WSF 插件（需要 AFSIM SDK）

```bash
cd afsim-plugin
mkdir -p build && cd build
cmake .. -DAFSIM_ROOT=../AFSim/afsim-2.9.0-win64 -DAFSIM_BUILD_DIR=../AFSim/afsim-build
cmake --build . --config Release
```

产出 DLL: `afsim-plugin/build/Release/wsf_event_gateway.dll`

> 如果没有 AFSIM 引擎包，此步骤可跳过——网关和前端仍可启动，只是无法运行仿真。

## 步骤 5: 准备场景文件

场景文件存放在 `afsim-gateway/scenarios/`。已有 `test_gateway.scenario` 作为测试场景。

如果需要更多场景，将 `.scenario` 文件放入此目录。

## 步骤 6: 手动启动（日常开发）

需要 **两个终端窗口**，分别启动网关和前端。顺序：先网关，后前端。

### 6a. 终端 1 — 启动仿真网关

**PowerShell（Windows 推荐）：**

```powershell
# 若 go 不在 PATH 中，先加入（安装 Go 后新开终端通常已自动配置）
$env:Path = "C:\Program Files\Go\bin;" + $env:Path

cd e:\AFsim\afsimweb-master\afsim-gateway

# 环境变量
$env:SCENARIO_DIR = ".\scenarios"
$env:OUTPUT_DIR   = ".\output"
$env:PORT         = "8080"

# 有 AFSIM 引擎时取消下一行注释并改为实际路径
# $env:AFSIM_MISSION_PATH = "..\AFSim\afsim-2.9.0-win64\bin\mission.exe"

# 首次运行需先编译（见步骤 2）
.\bin\gateway.exe
```

**Git Bash / Linux / macOS：**

```bash
cd afsim-gateway
export SCENARIO_DIR="./scenarios"
export OUTPUT_DIR="./output"
export PORT=8080
# export AFSIM_MISSION_PATH="../AFSim/afsim-2.9.0-win64/bin/mission.exe"
./bin/gateway.exe
```

验证网关已启动：

```powershell
Invoke-WebRequest http://localhost:8080/health
# 应返回 status: ok
```

### 6b. 终端 2 — 启动前端

```powershell
cd e:\AFsim\afsimweb-master\afsim-web
npm run dev
```

浏览器打开 **http://localhost:3000**。

前端已配置代理：`/api` → `http://localhost:8080`，`/ws` → `ws://localhost:8080`。

### 6c. 登录与进入模块

当前开发模式默认 **Mock 数据**（`afsim-web/.env.development` 中 `VITE_USE_MOCK=true`）：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员（全部模块） |
| operator1 | operator1 | 操作员 |
| analyst1 | analyst1 | 分析师 |
| viewer1 | viewer1 | 观察员 |

登录后进入门户首页，点击卡片进入各功能模块。

### 6d. 可选 — 启动数据平台（需 Docker）

数据平台 REST 网关同样占用 **8080**，与仿真网关 **不能同时** 使用默认端口。

```powershell
cd e:\AFsim\afsimweb-master\data-platform\deploy
docker compose up -d
```

使用数据平台时，将仿真网关改为其他端口，例如：

```powershell
$env:PORT = "8081"
.\bin\gateway.exe
```

并在 `afsim-web/.env.development` 中调整 `VITE_DATA_API_URL` 指向数据平台地址。

## 步骤 7: 验证

### 最小验证（无 AFSIM 引擎）

1. 打开 http://localhost:3000 ，使用 `admin` / `admin123` 登录
2. 门户首页应显示 5 个模块卡片
3. 进入「装备数据管理」— 应看到 Mock 装备列表
4. 进入「仿真运行」— CesiumJS 三维地球应加载（无实时数据属正常）

### 完整验证（连接真实 AFSIM）

#### 前置：部署引擎 + 插件

```powershell
# 1. 确认 AFSIM 引擎在仓库内（或修改场景中的 file_path）
Test-Path e:\AFsim\afsimweb-master\AFSim\afsim-2.9.0-win64\bin\mission.exe

# 2. 编译 WSF 插件（需 VS2022 + CMake，仅首次）
cd e:\AFsim\afsimweb-master\afsim-plugin\build
cmake .. -DAFSIM_ROOT=..\..\AFSim\afsim-2.9.0-win64
cmake --build . --config Release

# 3. 安装插件 DLL 到 AFSIM 插件目录
Copy-Item ..\build\Release\wsf_event_gateway.dll `
  ..\..\AFSim\afsim-2.9.0-win64\bin\wsf_plugins\ -Force
```

#### 启动网关（必须设置 AFSIM_MISSION_PATH）

```powershell
$env:Path = "C:\Program Files\Go\bin;" + $env:Path
cd e:\AFsim\afsimweb-master\afsim-gateway

$env:AFSIM_MISSION_PATH = "e:\AFsim\afsimweb-master\AFSim\afsim-2.9.0-win64\bin\mission.exe"
$env:SCENARIO_DIR = ".\scenarios"
$env:OUTPUT_DIR   = ".\output"
$env:PORT         = "8080"

.\bin\gateway.exe
```

网关日志中应出现：
- `Plugins Loaded: ... wsf_event_gateway.dll ...`
- `connected to both AFSIM pipes, starting event loop`

#### 前端操作

1. 登录后进入 **仿真运行**（`/module/simulation`）
2. 左侧面板「想定列表」中点击 `test_gateway` 旁的 **启动**
3. 前端自动调用 `POST /api/simulations` 并建立 WebSocket
4. CesiumJS 地球上出现蓝方/红方平台，右侧事件日志滚动更新

#### 数据流

```
mission.exe + wsf_event_gateway.dll
  → 命名管道 \\.\pipe\afsim_events / afsim_control
  → Go 网关 (connector)
  → WebSocket /api/simulations/{id}/ws
  → 前端 Zustand stores → CesiumJS 渲染
```

#### 测试场景说明

内置场景 `afsim-gateway/scenarios/test_gateway.scenario` 引用 AFSIM demos：

```
file_path ../../AFSim/afsim-2.9.0-win64/demos/simple_scenario
file_path ../../AFSim/afsim-2.9.0-win64/demos/base_types
```

场景内 `event_gateway` 块启用命名管道，与网关默认管道名一致。

#### 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 网关显示 running 但无平台 | 未设置 `AFSIM_MISSION_PATH` | 指向真实 `mission.exe` 并重启网关 |
| `pipe not available` 持续重试 | 插件未加载或场景无 `event_gateway` 块 | 确认 DLL 在 `wsf_plugins/`，检查场景文件 |
| `Cannot open file: scenarios\xxx` | 场景路径重复（已修复） | 重新编译网关：`go build -o bin\gateway.exe ./cmd/gateway` |
| WebSocket 无数据但 mission 在跑 | 前端未连 WS 或仿真 ID 不对 | 刷新页面后重新点「启动」 |

## 端口与代理

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite dev server | 3000 | 前端，代理 /api 和 /ws |
| Go gateway | 8080 | REST API + WebSocket |
| 命名管道 | — | `\\.\pipe\afsim_events` / `\\.\pipe\afsim_control` |

## 常见问题

**Q: `go build` 找不到 protoc**
A: 网关代码中已包含预生成的 protobuf Go 文件，不需要 protoc。仅当你修改 `proto/` 定义时才需要。

**Q: 前端 npm install 失败**
A: 删除 `node_modules` 和 `package-lock.json` 后重试：`rm -rf node_modules package-lock.json && npm install`

**Q: 没有场景可选**
A: 确认 `afsim-gateway/scenarios/` 下有 `.scenario` 文件，且网关启动时 `SCENARIO_DIR` 指向正确。

**Q: WebSocket 连接失败**
A: 检查网关是否在运行，前端 WebSocket URL 使用 `VITE_GATEWAY_PORT` 环境变量（默认 8080）。
