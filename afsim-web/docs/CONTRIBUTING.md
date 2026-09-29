
# AFsimCusim 参与开发指南

感谢参与 AFsimCusim 项目。

本项目采用 Git 分支协作模式。所有参与人员应使用独立开发分支完成工作，验证通过后再通过 Pull Request 合并到 `main`。

---

## 一、参与人员配置 Git 身份

每位开发人员都应配置自己的姓名和邮箱：

```bash
git config user.name "你的姓名或昵称"
git config user.email "你的邮箱"
```

查看当前配置：

```bash
git config user.name
git config user.email
```

提交记录必须能够明确对应到实际开发人员。

---

## 二、获取最新代码

首次参与开发：

```bash
git clone https://github.com/maoweiming/afsimCusim.git
cd afsimCusim
git switch main
git pull origin main
```

如果本地已经存在项目：

```bash
git switch main
git pull origin main
```

---

## 三、创建个人开发分支

禁止直接在 `main` 分支开发。

根据任务类型创建分支：

```bash
git switch -c feature/<功能名称>
```

功能开发示例：

```bash
git switch -c feature/scenario-collaboration
```

问题修复示例：

```bash
git switch -c fix/map-layer-rendering
```

文档更新示例：

```bash
git switch -c docs/contributing-guide
```

推荐分支命名：

| 类型 | 用途 | 示例 |
|---|---|---|
| `feature/` | 新功能 | `feature/scenario-editor` |
| `fix/` | 问题修复 | `fix/websocket-reconnect` |
| `refactor/` | 代码重构 | `refactor/store-structure` |
| `docs/` | 文档更新 | `docs/api-guide` |
| `test/` | 测试相关 | `test/equipment-api` |
| `chore/` | 工程配置 | `chore/update-dependencies` |

---

## 四、开发要求

开发过程中请遵守以下要求：

1. 一个分支尽量只处理一个问题或一个功能；
2. 不要修改与当前任务无关的代码；
3. 不要直接提交账号密码、Token、密钥等敏感信息；
4. 不要提交 `node_modules`、构建产物和临时日志；
5. 不要提交 `AFSim/` 大目录；
6. 不要提交地图 terrain、tiles、map fragments 等大文件；
7. 修改功能时同步更新相关文档；
8. 代码应保持现有项目风格；
9. 提交前必须完成必要的构建和测试。

---

## 五、提交说明要求

每次提交必须清楚说明以下内容：

1. 修改了什么问题；
2. 增加或调整了什么功能；
3. 影响了哪些模块或文件；
4. 使用什么方式完成了验证。

推荐提交格式：

```text
<类型>: <简短说明>

问题：说明原有问题或需求背景
功能：说明本次实现的功能
影响：说明受影响的模块或文件
验证：说明测试、构建或手工验证方式
```

示例：

```text
feat: 增加想定协作入口

问题：用户无法查看和参与公共想定更新
功能：增加想定协作入口和参与说明
影响：前端门户、想定模块、项目文档
验证：完成 npm run build，并手工检查页面入口
```

常用提交类型：

| 类型 | 说明 |
|---|---|
| `feat` | 新增功能 |
| `fix` | 修复问题 |
| `docs` | 文档修改 |
| `refactor` | 代码重构 |
| `test` | 增加或修改测试 |
| `style` | 格式调整 |
| `chore` | 工程配置或依赖调整 |
| `perf` | 性能优化 |

---

## 六、提交前检查

查看当前分支：

```bash
git branch --show-current
```

确认不能在 `main` 分支直接提交：

```bash
git status
```

检查修改内容：

```bash
git diff
```

检查待提交文件：

```bash
git status --short
```

确认没有大文件：

```bash
git status --short
git ls-files | Select-String "AFSim|terrain|tiles|map-fragments"
```

检查代码格式和构建：

```bash
cd afsim-web
npm run build
```

如果项目有测试：

```bash
npm test
```

---

## 七、提交代码

确认检查通过后：

```bash
git add <修改的文件>
git commit -m "feat: 说明新增功能和解决的问题"
```

推荐只添加本次任务相关文件：

```bash
git add afsim-web/src/README.md
```

不建议直接使用：

```bash
git add .
```

除非已经确认工作区中没有无关文件和大文件。

---

## 八、推送个人分支

首次推送：

```bash
git push -u origin feature/<功能名称>
```

后续推送：

```bash
git push
```

示例：

```bash
git push -u origin feature/scenario-collaboration
```

---

## 九、创建 Pull Request

在 GitHub 创建 Pull Request：

```text
源分支：feature/<功能名称>
目标分支：main
```

Pull Request 必须包含：

```markdown
## 修改问题

说明原有问题或需求背景。

## 实现功能

说明本次增加或调整的功能。

## 影响范围

列出受影响的模块、页面、接口或文件。

## 验证方式

说明执行过的测试、构建和手工验证。

## 参与人员

- 开发人员：姓名
- 测试人员：姓名
- 文档维护：姓名
```

示例：

```markdown
## 修改问题

用户无法参与项目协作，也没有统一的分支开发规范。

## 实现功能

增加项目参与开发指南，明确个人分支、提交说明和 Pull Request 流程。

## 影响范围

- docs/CONTRIBUTING.md
- 项目协作流程

## 验证方式

已检查 Markdown 内容和 Git 分支流程。

## 参与人员

- 开发人员：maoweiming
```

---

## 十、合并到 main 的条件

满足以下条件后才能合并：

- 功能已经完成；
- 问题描述清楚；
- 代码已经审查；
- 构建或测试通过；
- 没有提交大文件；
- 没有提交敏感信息；
- 文档已经同步更新；
- Pull Request 已获得维护人员确认。

禁止未经验证直接合并到 `main`。

---

## 十一、同步最新 main

开发期间如果 `main` 有新的更新，应先同步：

```bash
git switch main
git pull origin main
git switch feature/<功能名称>
git merge main
```

如果发生冲突：

```bash
git status
```

解决冲突后：

```bash
git add <解决冲突后的文件>
git commit -m "chore: resolve merge conflicts"
git push
```

---

## 十二、合并完成后的清理

Pull Request 合并后，可以删除本地分支：

```bash
git switch main
git pull origin main
git branch -d feature/<功能名称>
```

删除远程分支：

```bash
git push origin --delete feature/<功能名称>
```

如果该分支仍有未合并内容，不要强制删除。

---

## 十三、问题反馈

提交问题时，请尽量包含：

- 问题标题；
- 问题复现步骤；
- 预期结果；
- 实际结果；
- 浏览器和操作系统；
- 相关日志；
- 截图或错误信息；
- 是否可以稳定复现。

问题报告示例：

```markdown
## 问题标题

地图图层切换后实体显示异常

## 复现步骤

1. 打开仿真页面；
2. 切换地图图层；
3. 开启实体显示；
4. 观察地图状态。

## 预期结果

实体正常显示。

## 实际结果

部分实体没有显示。

## 环境

- Windows 11
- Chrome
- 前端版本：当前 main
```

---

## 十四、重要说明

`AFSim/`、地图 terrain、地图 tiles 和其他大文件不提交到 Git。

这些文件应通过后台私信、网盘或其他外部存储方式传递，并在项目文档中说明获取方式。

所有参与人员都应遵守：

```text
个人分支开发
提交前验证
Pull Request 审查
验证通过后合并 main
```
```