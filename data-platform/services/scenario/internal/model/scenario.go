package model

import (
	"time"
)

// Scenario 是想定的完整数据模型
type Scenario struct {
	ID             string             `bson:"_id" json:"id"`
	Name           string             `bson:"name" json:"name"`
	Description    string             `bson:"description" json:"description"`
	Version        string             `bson:"version" json:"version"`
	Status         string             `bson:"status" json:"status"` // draft, published, archived
	Terrain        TerrainConfig      `bson:"terrain" json:"terrain"`
	Platforms      []PlatformInstance `bson:"platforms" json:"platforms"`
	Routes         []RouteDefinition  `bson:"routes" json:"routes"`
	Zones          []ZoneDefinition   `bson:"zones" json:"zones"`
	Triggers       []TriggerDefinition `bson:"triggers" json:"triggers"`
	Tags           []string           `bson:"tags" json:"tags"`
	Category       string             `bson:"category" json:"category"`
	Classification string             `bson:"classification" json:"classification"`
	CreatedBy      string             `bson:"created_by" json:"created_by"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

// TerrainConfig 地形配置
type TerrainConfig struct {
	DataSource string      `bson:"data_source" json:"data_source"`
	Bounds     BoundingBox `bson:"bounds" json:"bounds"`
}

// BoundingBox 边界框
type BoundingBox struct {
	South float64 `bson:"south" json:"south"`
	West  float64 `bson:"west" json:"west"`
	North float64 `bson:"north" json:"north"`
	East  float64 `bson:"east" json:"east"`
}

// EquipmentRef 装备版本引用 — 锁定特定版本，不受后续变更影响
type EquipmentRef struct {
	EquipmentID string `bson:"equipment_id" json:"equipment_id"`
	Version     int32  `bson:"version" json:"version"`
	Name        string `bson:"name,omitempty" json:"name,omitempty"`   // 冗余：装备名称快照
	Category    string `bson:"category,omitempty" json:"category,omitempty"` // 冗余：装备分类快照
}

// PlatformInstance 平台实例
type PlatformInstance struct {
	ID              string       `bson:"id" json:"id"`
	EquipmentRef    EquipmentRef `bson:"equipment_ref" json:"equipment_ref"`
	EquipmentID     string       `bson:"equipment_id,omitempty" json:"equipment_id,omitempty"` // deprecated: 向后兼容
	Name            string       `bson:"name" json:"name"`
	Side            string       `bson:"side" json:"side"` // red, blue, neutral
	InitialPosition Position     `bson:"initial_position" json:"initial_position"`
	InitialAltitude float64      `bson:"initial_altitude" json:"initial_altitude"`
	InitialHeading  float64      `bson:"initial_heading" json:"initial_heading"`
	InitialSpeed    float64      `bson:"initial_speed" json:"initial_speed"`
	RouteID         string       `bson:"route_id" json:"route_id"`
}

// GetEffectiveEquipmentID 获取有效的装备 ID（兼容新旧格式）
func (p *PlatformInstance) GetEffectiveEquipmentID() string {
	if p.EquipmentRef.EquipmentID != "" {
		return p.EquipmentRef.EquipmentID
	}
	return p.EquipmentID
}

// GetEffectiveEquipmentVersion 获取有效的装备版本（兼容新旧格式，0 表示未锁定）
func (p *PlatformInstance) GetEffectiveEquipmentVersion() int32 {
	return p.EquipmentRef.Version
}

// Position 位置
type Position struct {
	Lng float64 `bson:"lng" json:"lng"`
	Lat float64 `bson:"lat" json:"lat"`
}

// RouteDefinition 路线定义
type RouteDefinition struct {
	ID        string          `bson:"id" json:"id"`
	Name      string          `bson:"name" json:"name"`
	Waypoints []RouteWaypoint `bson:"waypoints" json:"waypoints"`
}

// RouteWaypoint 路线航路点
type RouteWaypoint struct {
	Position Position `bson:"position" json:"position"`
	Altitude float64  `bson:"altitude" json:"altitude"`
	Speed    float64  `bson:"speed" json:"speed"`
}

// ZoneDefinition 区域定义
type ZoneDefinition struct {
	ID      string      `bson:"id" json:"id"`
	Name    string      `bson:"name" json:"name"`
	Type    string      `bson:"type" json:"type"` // exclusion, inclusion, threat, safe
	Circle  *CircleZone `bson:"circle,omitempty" json:"circle,omitempty"`
	Polygon *PolygonZone `bson:"polygon,omitempty" json:"polygon,omitempty"`
}

// CircleZone 圆形区域
type CircleZone struct {
	Center Position `bson:"center" json:"center"`
	Radius float64  `bson:"radius" json:"radius"`
}

// PolygonZone 多边形区域
type PolygonZone struct {
	Vertices []Position `bson:"vertices" json:"vertices"`
}

// TriggerDefinition 触发器定义
type TriggerDefinition struct {
	ID        string `bson:"id" json:"id"`
	Name      string `bson:"name" json:"name"`
	Condition string `bson:"condition" json:"condition"`
	Action    string `bson:"action" json:"action"`
}

// Branch Git-like 分支
type Branch struct {
	ID             string    `bson:"_id" json:"id"`
	ScenarioID     string    `bson:"scenario_id" json:"scenario_id"`
	Name           string    `bson:"name" json:"name"`
	ParentBranchID string    `bson:"parent_branch_id" json:"parent_branch_id"`
	CreatedBy      string    `bson:"created_by" json:"created_by"`
	CreatedAt      time.Time `bson:"created_at" json:"created_at"`
	Status         string    `bson:"status" json:"status"` // active, merged, abandoned
	HeadCommitID   string    `bson:"head_commit_id" json:"head_commit_id"`
}

// Commit 提交记录
type Commit struct {
	ID             string    `bson:"_id" json:"id"`
	BranchID       string    `bson:"branch_id" json:"branch_id"`
	Message        string    `bson:"message" json:"message"`
	Author         string    `bson:"author" json:"author"`
	AuthorName     string    `bson:"author_name" json:"author_name"`
	Timestamp      time.Time `bson:"timestamp" json:"timestamp"`
	Changes        []Change  `bson:"changes" json:"changes"`
	ParentCommitID string    `bson:"parent_commit_id" json:"parent_commit_id"`
}

// Change 变更记录
type Change struct {
	Type       string `bson:"type" json:"type"` // add, modify, delete
	EntityType string `bson:"entity_type" json:"entity_type"`
	EntityID   string `bson:"entity_id" json:"entity_id"`
	EntityName string `bson:"entity_name" json:"entity_name"`
	Before     string `bson:"before" json:"before"` // JSON
	After      string `bson:"after" json:"after"`   // JSON
}

// MergeRequest 合并请求
type MergeRequest struct {
	ID           string      `bson:"_id" json:"id"`
	ScenarioID   string      `bson:"scenario_id" json:"scenario_id"`
	SourceBranch string      `bson:"source_branch" json:"source_branch"`
	TargetBranch string      `bson:"target_branch" json:"target_branch"`
	Title        string      `bson:"title" json:"title"`
	Description  string      `bson:"description" json:"description"`
	Author       string      `bson:"author" json:"author"`
	AuthorName   string      `bson:"author_name" json:"author_name"`
	Status       string      `bson:"status" json:"status"` // open, approved, rejected, merged
	Conflicts    []Conflict  `bson:"conflicts" json:"conflicts"`
	Reviewers    []Reviewer  `bson:"reviewers" json:"reviewers"`
	Approvals    []string    `bson:"approvals" json:"approvals"`
	Rejections   []string    `bson:"rejections" json:"rejections"`
	Comments     []MRComment `bson:"comments" json:"comments"`
	CreatedAt    time.Time   `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time   `bson:"updated_at" json:"updated_at"`
}

// Conflict 冲突
type Conflict struct {
	EntityType   string `bson:"entity_type" json:"entity_type"`
	EntityID     string `bson:"entity_id" json:"entity_id"`
	EntityName   string `bson:"entity_name" json:"entity_name"`
	Field        string `bson:"field" json:"field"`
	SourceValue  string `bson:"source_value" json:"source_value"`
	TargetValue  string `bson:"target_value" json:"target_value"`
	Resolution   string `bson:"resolution" json:"resolution"`   // source, target, custom
	ResolvedBy   string `bson:"resolved_by" json:"resolved_by"`
	ResolvedValue string `bson:"resolved_value" json:"resolved_value"`
}

// Reviewer 审查者
type Reviewer struct {
	UserID     string    `bson:"user_id" json:"user_id"`
	UserName   string    `bson:"user_name" json:"user_name"`
	Status     string    `bson:"status" json:"status"` // pending, approved, rejected
	Comment    string    `bson:"comment" json:"comment"`
	ReviewedAt time.Time `bson:"reviewed_at" json:"reviewed_at"`
}

// MRComment 合并请求评论
type MRComment struct {
	ID        string    `bson:"id" json:"id"`
	UserID    string    `bson:"user_id" json:"user_id"`
	UserName  string    `bson:"user_name" json:"user_name"`
	Content   string    `bson:"content" json:"content"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
	ParentID  string    `bson:"parent_id" json:"parent_id"`
	Resolved  bool      `bson:"resolved" json:"resolved"`
}

// Comment 评论
type Comment struct {
	ID         string    `bson:"_id" json:"id"`
	ScenarioID string    `bson:"scenario_id" json:"scenario_id"`
	UserID     string    `bson:"user_id" json:"user_id"`
	UserName   string    `bson:"user_name" json:"user_name"`
	Content    string    `bson:"content" json:"content"`
	Timestamp  time.Time `bson:"timestamp" json:"timestamp"`
	ParentID   string    `bson:"parent_id" json:"parent_id"`
	Position   *Position `bson:"position,omitempty" json:"position,omitempty"`
	EntityType string    `bson:"entity_type" json:"entity_type"`
	EntityID   string    `bson:"entity_id" json:"entity_id"`
	Resolved   bool      `bson:"resolved" json:"resolved"`
}
