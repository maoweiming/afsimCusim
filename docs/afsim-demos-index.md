# AFSIM Demo 示例分类索引

> 范围：`AFSim/afsim-2.9.0-win64/demos/`（共 65 个示例文件夹）。
> 用途：按 AFSIM 能力/子系统分类，便于后续任务（场景模板、Mover/武器/传感器/行为树配置参考）快速定位示例。
> 生成于：2026-06-14。

## 传感器与探测（7）
- `acoustic` — 声学传感器与声学特征
- `bearing_only` — 纯方位定位/三角定位
- `coverage_demos` — 传感器覆盖区域分析/热力图
- `sensor_demos` — 各类传感器综合演示
- `sensor_plot` — 传感器探测/覆盖效能绘图工具
- `noise_cloud` — 噪声云对探测的影响建模
- `oth_radar` — 超视距雷达

## 武器与交战（12）
- `air_to_air` — 空战 1v1/2v2/护航
- `ballistic` — 弹道弹发射脚本
- `ballistic_missile_shootdown` — 反弹道导弹拦截
- `ciws` — 近防系统/舰载小口径火炮
- `gun_engagement` — 机炮交战高保真模型
- `hellfire` — 地狱火导弹发射与制导
- `launcher` — SAM 发射器+发射计算机
- `new_guidance` — 新制导/末端制导逻辑
- `ship_ad` — 舰艇防空/对面交战
- `shooter` — 射手平台-目标交战
- `swarm` — 蜂群导弹编队跟随引导
- `suppressor` — 压制/轰炸任务

## 运动模型 / Mover（8）
- `brawler` — Brawler 格斗机高保真运动
- `kinematic_mover` — 运动学（kinematic）平台
- `p6dof` — 弹丸级 6DOF 模型
- `parachute` — 降落伞运动模型
- `six_dof` — 通用刚体 6DOF 模型
- `six_dof_with_brawler` — 6DOF + Brawler 集成
- `terrain_following` — 地形跟随高度控制
- `alternate_locations` — 初始位置概率分布

## 通信与网络（3）
- `comm` — 通信系统基础演示
- `l16_j11` — Link-16 实时数据链
- `distributed_operations` — 分布式协同作战

## 行为树 / 脚本与处理器（5）
- `behavior_tree` — 高级行为树可视化
- `heatmap` — 热力图驱动决策
- `example_scripts` — 脚本处理器示例集
- `script_demos` — 脚本控制/处理演示
- `exchange_proc` — 加油机交换处理器

## 电子战与特征（5）
- `electronic_warfare` — 电子战/干扰效能
- `aea_iads` — IADS 电子对抗
- `chaff` — 箔条防护/干扰
- `signature_demos` — RCS/IR 特征库
- `alv_routing` — 诱饵巡航导弹路由

## 防空 / IADS / C2（3，另 `aea_iads`/`ciws` 跨列）
- `iads` — 集成防空系统基础
- `iads_c2_demos` — IADS 指挥控制
- `orwaca_iads` — 大范围多层防空网络

## 空间作战（3）
- `satellite_demos` — 卫星轨道/对地观测
- `cislunar` — 月球轨道机动
- `space_operations` — 空间发射与机动

## 后勤与火力支援（2，另 `exchange_proc` 跨列）
- `logistics` — 后勤补给系统
- `fires` — 间接火力/齐射控制

## 路径规划（1，另 `alv_routing`/`terrain_following` 跨列）
- `route_finder_demos` — 路线规划/寻径

## 可视化与场景工具（4，另 `heatmap`/`sensor_plot` 跨列）
- `draw` — 2D/3D 绘图标注（DRAW）
- `visual_part` — DIS 铰接部件可视化
- `traffic_demos` — 背景交通流
- `simple_scenario` — 基础场景模板

## 综合/其他演示（13，另 `l16_j11`/`distributed_operations` 跨列）
- `base_types` — 平台/武器/传感器基础类型库
- `base_types_nx` — 下一代平台类型库
- `wargame` — 多方实时对抗演示
- `outer_air_battle` — 战域级空战
- `laser_designator` — 激光指示/引导
- `multiresolution_demos` — 多分辨率建模
- `sosm` — 特征模型库/转换（SOSM）
- `timeline` — 时间轴/事件序列
- `timeline_lead` — 提前量/预测时序
- `tbm_demos` — 战术弹道导弹
- `cyber` — 网络战/系统对抗
- `hel` — 高能激光（HEL）武器
- `engage` — 交战处理器/决策逻辑

---

## 与本项目的潜在关联

- **P5-1（Mover Creator 迁移分析）** → 重点参考 `six_dof`/`p6dof`/`kinematic_mover`/`brawler` 的 mover 配置写法。
- **P4-5b（任务分配数据管线）后续扩展** → 可参考 `behavior_tree`/`engage`/`script_demos` 的处理器写法。
- **「兵力列表」武器标签可行性分析** → `base_types`/`launcher`/`new_guidance` 中的 `add weapon ... end_weapon` 写法可作为参考样本。
