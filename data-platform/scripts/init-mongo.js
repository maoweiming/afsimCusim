// MongoDB 初始化脚本
// 用于创建 TrueSim 数据平台所需的数据库和集合

// 切换到 scenario 数据库
db = db.getSiblingDB('scenario');

// 创建 scenarios 集合并设置索引
db.createCollection('scenarios');
db.scenarios.createIndex({ "name": 1 });
db.scenarios.createIndex({ "status": 1 });
db.scenarios.createIndex({ "tags": 1 });
db.scenarios.createIndex({ "created_at": -1 });
db.scenarios.createIndex({ "created_by": 1 });

// 创建 branches 集合并设置索引
db.createCollection('branches');
db.branches.createIndex({ "scenario_id": 1, "name": 1 }, { unique: true });
db.branches.createIndex({ "scenario_id": 1 });
db.branches.createIndex({ "status": 1 });

// 创建 commits 集合并设置索引
db.createCollection('commits');
db.commits.createIndex({ "branch_id": 1, "timestamp": -1 });
db.commits.createIndex({ "author": 1 });

// 创建 merge_requests 集合并设置索引
db.createCollection('merge_requests');
db.merge_requests.createIndex({ "scenario_id": 1, "status": 1 });
db.merge_requests.createIndex({ "source_branch": 1 });
db.merge_requests.createIndex({ "target_branch": 1 });
db.merge_requests.createIndex({ "author": 1 });

// 创建 comments 集合并设置索引
db.createCollection('comments');
db.comments.createIndex({ "scenario_id": 1, "entity_type": 1, "entity_id": 1 });
db.comments.createIndex({ "user_id": 1 });
db.comments.createIndex({ "timestamp": -1 });

// 插入示例想定数据
db.scenarios.insertOne({
    _id: "demo-scenario-001",
    name: "红蓝对抗演示想定",
    description: "一个用于演示的红蓝对抗想定，包含空中和地面平台",
    version: "1.0.0",
    status: "draft",
    terrain: {
        data_source: "srtm30",
        bounds: {
            south: 30.0,
            west: 120.0,
            north: 32.0,
            east: 122.0
        }
    },
    platforms: [
        {
            id: "red-fighter-01",
            equipment_id: "su-35",
            name: "红方战斗机-01",
            side: "red",
            initial_position: { lng: 120.5, lat: 30.5 },
            initial_altitude: 8000,
            initial_heading: 90,
            initial_speed: 250,
            route_id: "route-01"
        },
        {
            id: "blue-fighter-01",
            equipment_id: "f-22",
            name: "蓝方战斗机-01",
            side: "blue",
            initial_position: { lng: 121.5, lat: 31.5 },
            initial_altitude: 10000,
            initial_heading: 270,
            initial_speed: 280,
            route_id: "route-02"
        }
    ],
    routes: [
        {
            id: "route-01",
            name: "红方攻击航线",
            waypoints: [
                { position: { lng: 120.5, lat: 30.5 }, altitude: 8000, speed: 250 },
                { position: { lng: 121.0, lat: 31.0 }, altitude: 9000, speed: 300 },
                { position: { lng: 121.5, lat: 31.5 }, altitude: 10000, speed: 350 }
            ]
        },
        {
            id: "route-02",
            name: "蓝方巡逻航线",
            waypoints: [
                { position: { lng: 121.5, lat: 31.5 }, altitude: 10000, speed: 280 },
                { position: { lng: 121.0, lat: 31.0 }, altitude: 10000, speed: 280 },
                { position: { lng: 120.5, lat: 30.5 }, altitude: 10000, speed: 280 }
            ]
        }
    ],
    zones: [
        {
            id: "exclusion-zone-01",
            name: "禁飞区",
            type: "exclusion",
            circle: {
                center: { lng: 121.0, lat: 31.0 },
                radius: 50000
            }
        }
    ],
    triggers: [],
    tags: ["demo", "红蓝对抗", "空战"],
    category: "训练",
    classification: "公开",
    created_by: "admin",
    created_at: new Date(),
    updated_at: new Date()
});

// 创建默认 main 分支
db.branches.insertOne({
    _id: "branch-main-demo-001",
    scenario_id: "demo-scenario-001",
    name: "main",
    parent_branch_id: "",
    created_by: "admin",
    created_at: new Date(),
    status: "active",
    head_commit_id: ""
});

print("MongoDB 初始化完成！");
print("- 创建了 scenario 数据库");
print("- 创建了所有必要的集合和索引");
print("- 插入了示例想定数据");
