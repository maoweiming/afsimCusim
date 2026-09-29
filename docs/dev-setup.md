# TrueSim 开发环境配置指南

## 环境要求

- Windows 11 x64
- Visual Studio 2022 Community（已安装）
- VSCode（已安装）

## 第一步：安装 v142 工具集 + CMake

打开 **Visual Studio Installer**：
1. 找到 VS2022 Community → 点击 **"修改"**
2. 切到 **"单个组件"** 标签页
3. 搜索并勾选：
   - ✅ `MSVC v142 - VS 2019 C++ x64/x86 生成工具` (v14.29)
   - ✅ `C++ CMake tools for Windows`
   - ✅ `Windows 10 SDK`（如果还没装的话，选 10.0.19041 或更高）
4. 点击 **"修改"** 安装

> 预计下载 1-2GB，安装约 5 分钟

## 第二步：安装 VSCode 扩展

在 VSCode 中按 `Ctrl+Shift+X` 打开扩展面板，搜索并安装：

1. **CMake Tools** (`ms-vscode.cmake-tools`) — CMake 项目支持
2. **C/C++** (`ms-vscode.cpptools`) — 代码补全、跳转、调试
3. **C/C++ Extension Pack** (`ms-vscode.cpptools-extension-pack`) — 包含上面两个

## 第三步：验证安装

打开终端（PowerShell 或 cmd），运行：

```cmd
"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
cmake --version
cl 2>&1 | findstr "Microsoft"
```

预期输出：
```
cmake version 3.xx.x
Microsoft (R) C/C++ Optimizing Compiler Version 19.29.xxxxxx for x64
```

（cl 版本号 19.29 = v142，19.44 = v143）

## 第四步：配置 VSCode 项目

以下配置文件已创建在项目中，VSCode 打开 TrueSim 目录即可自动识别：

- `.vscode/settings.json` — CMake 配置（kit 选择 v142）
- `.vscode/launch.json` — 调试配置
- `.vscode/extensions.json` — 推荐扩展

## 第五步：编译 WSF 插件

在 VSCode 中：
1. `Ctrl+Shift+P` → `CMake: Select Configure Preset` → 选择 v142 配置
2. `Ctrl+Shift+P` → `CMake: Build` 或 `F7`

或在终端：
```cmd
cd E:\3.Projects\TrueSim\afsim-plugin
mkdir build && cd build
cmake -G "Visual Studio 17 2022" -T v142 -A x64 ..
cmake --build . --config Release
```

## 第六步：编译 Go 网关

```cmd
cd E:\3.Projects\TrueSim\afsim-gateway
go mod tidy
go build -o bin/gateway.exe ./cmd/gateway
```

## 第七步：编译前端

```cmd
cd E:\3.Projects\TrueSim\afsim-web
npm install
npm run build
```
