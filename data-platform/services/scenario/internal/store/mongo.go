package store

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"truesim/scenario/internal/model"
)

// MongoStore MongoDB 存储实现
type MongoStore struct {
	client     *mongo.Client
	db         *mongo.Database
	scenarios  *mongo.Collection
	branches   *mongo.Collection
	commits    *mongo.Collection
	merges     *mongo.Collection
	comments   *mongo.Collection
}

// NewMongoStore 创建 MongoDB 存储
func NewMongoStore(ctx context.Context, uri, dbName string) (*MongoStore, error) {
	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// 验证连接
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	db := client.Database(dbName)

	store := &MongoStore{
		client:    client,
		db:        db,
		scenarios: db.Collection("scenarios"),
		branches:  db.Collection("branches"),
		commits:   db.Collection("commits"),
		merges:    db.Collection("merge_requests"),
		comments:  db.Collection("comments"),
	}

	// 创建索引
	if err := store.createIndexes(ctx); err != nil {
		return nil, fmt.Errorf("failed to create indexes: %w", err)
	}

	return store, nil
}

// createIndexes 创建索引
func (s *MongoStore) createIndexes(ctx context.Context) error {
	// scenarios 索引
	_, err := s.scenarios.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "name", Value: 1}}},
		{Keys: bson.D{{Key: "status", Value: 1}}},
		{Keys: bson.D{{Key: "tags", Value: 1}}},
		{Keys: bson.D{{Key: "created_at", Value: -1}}},
	})
	if err != nil {
		return err
	}

	// branches 索引
	_, err = s.branches.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "scenario_id", Value: 1}, {Key: "name", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "scenario_id", Value: 1}}},
	})
	if err != nil {
		return err
	}

	// commits 索引
	_, err = s.commits.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "branch_id", Value: 1}, {Key: "timestamp", Value: -1}}},
	})
	if err != nil {
		return err
	}

	// merge_requests 索引
	_, err = s.merges.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "scenario_id", Value: 1}, {Key: "status", Value: 1}}},
	})
	if err != nil {
		return err
	}

	// comments 索引
	_, err = s.comments.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "scenario_id", Value: 1}, {Key: "entity_type", Value: 1}, {Key: "entity_id", Value: 1}}},
	})
	return err
}

// Close 关闭连接
func (s *MongoStore) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}

// ============ Scenario CRUD ============

// CreateScenario 创建想定
func (s *MongoStore) CreateScenario(ctx context.Context, scenario *model.Scenario) error {
	scenario.CreatedAt = time.Now()
	scenario.UpdatedAt = time.Now()
	if scenario.Status == "" {
		scenario.Status = "draft"
	}
	if scenario.Version == "" {
		scenario.Version = "1.0.0"
	}

	_, err := s.scenarios.InsertOne(ctx, scenario)
	return err
}

// GetScenario 获取想定
func (s *MongoStore) GetScenario(ctx context.Context, id string) (*model.Scenario, error) {
	var scenario model.Scenario
	err := s.scenarios.FindOne(ctx, bson.M{"_id": id}).Decode(&scenario)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("scenario not found: %s", id)
	}
	return &scenario, err
}

// UpdateScenario 更新想定
func (s *MongoStore) UpdateScenario(ctx context.Context, scenario *model.Scenario) error {
	scenario.UpdatedAt = time.Now()

	result, err := s.scenarios.ReplaceOne(ctx, bson.M{"_id": scenario.ID}, scenario)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("scenario not found: %s", scenario.ID)
	}
	return nil
}

// DeleteScenario 删除想定
func (s *MongoStore) DeleteScenario(ctx context.Context, id string) error {
	result, err := s.scenarios.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return fmt.Errorf("scenario not found: %s", id)
	}
	return nil
}

// ListScenario 列出想定
func (s *MongoStore) ListScenario(ctx context.Context, status string, tags []string, search string, page, pageSize int32) ([]*model.Scenario, int32, error) {
	filter := bson.M{}

	if status != "" {
		filter["status"] = status
	}
	if len(tags) > 0 {
		filter["tags"] = bson.M{"$in": tags}
	}
	if search != "" {
		filter["$or"] = []bson.M{
			{"name": bson.M{"$regex": search, "$options": "i"}},
			{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	// 计算总数
	total, err := s.scenarios.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// 分页查询
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	skip := (page - 1) * pageSize

	opts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(pageSize)).
		SetSort(bson.D{{Key: "updated_at", Value: -1}})

	cursor, err := s.scenarios.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var scenarios []*model.Scenario
	if err := cursor.All(ctx, &scenarios); err != nil {
		return nil, 0, err
	}

	return scenarios, int32(total), nil
}

// ============ Branch Management ============

// CreateBranch 创建分支
func (s *MongoStore) CreateBranch(ctx context.Context, branch *model.Branch) error {
	branch.CreatedAt = time.Now()
	if branch.Status == "" {
		branch.Status = "active"
	}

	_, err := s.branches.InsertOne(ctx, branch)
	return err
}

// GetBranch 获取分支
func (s *MongoStore) GetBranch(ctx context.Context, scenarioID, branchName string) (*model.Branch, error) {
	var branch model.Branch
	err := s.branches.FindOne(ctx, bson.M{
		"scenario_id": scenarioID,
		"name":        branchName,
	}).Decode(&branch)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("branch not found: %s/%s", scenarioID, branchName)
	}
	return &branch, err
}

// ListBranches 列出分支
func (s *MongoStore) ListBranches(ctx context.Context, scenarioID string) ([]*model.Branch, error) {
	cursor, err := s.branches.Find(ctx, bson.M{"scenario_id": scenarioID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var branches []*model.Branch
	if err := cursor.All(ctx, &branches); err != nil {
		return nil, err
	}
	return branches, nil
}

// UpdateBranch 更新分支
func (s *MongoStore) UpdateBranch(ctx context.Context, branch *model.Branch) error {
	result, err := s.branches.ReplaceOne(ctx, bson.M{"_id": branch.ID}, branch)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("branch not found: %s", branch.ID)
	}
	return nil
}

// ============ Commit Management ============

// CreateCommit 创建提交
func (s *MongoStore) CreateCommit(ctx context.Context, commit *model.Commit) error {
	commit.Timestamp = time.Now()

	_, err := s.commits.InsertOne(ctx, commit)
	return err
}

// GetCommit 获取提交
func (s *MongoStore) GetCommit(ctx context.Context, commitID string) (*model.Commit, error) {
	var commit model.Commit
	err := s.commits.FindOne(ctx, bson.M{"_id": commitID}).Decode(&commit)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("commit not found: %s", commitID)
	}
	return &commit, err
}

// GetCommitHistory 获取提交历史
func (s *MongoStore) GetCommitHistory(ctx context.Context, branchID string, limit int32) ([]*model.Commit, error) {
	if limit <= 0 {
		limit = 50
	}

	opts := options.Find().
		SetLimit(int64(limit)).
		SetSort(bson.D{{Key: "timestamp", Value: -1}})

	cursor, err := s.commits.Find(ctx, bson.M{"branch_id": branchID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var commits []*model.Commit
	if err := cursor.All(ctx, &commits); err != nil {
		return nil, err
	}
	return commits, nil
}

// ============ Merge Request Management ============

// CreateMergeRequest 创建合并请求
func (s *MongoStore) CreateMergeRequest(ctx context.Context, mr *model.MergeRequest) error {
	now := time.Now()
	mr.CreatedAt = now
	mr.UpdatedAt = now
	if mr.Status == "" {
		mr.Status = "open"
	}

	_, err := s.merges.InsertOne(ctx, mr)
	return err
}

// GetMergeRequest 获取合并请求
func (s *MongoStore) GetMergeRequest(ctx context.Context, mrID string) (*model.MergeRequest, error) {
	var mr model.MergeRequest
	err := s.merges.FindOne(ctx, bson.M{"_id": mrID}).Decode(&mr)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("merge request not found: %s", mrID)
	}
	return &mr, err
}

// UpdateMergeRequest 更新合并请求
func (s *MongoStore) UpdateMergeRequest(ctx context.Context, mr *model.MergeRequest) error {
	mr.UpdatedAt = time.Now()

	result, err := s.merges.ReplaceOne(ctx, bson.M{"_id": mr.ID}, mr)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("merge request not found: %s", mr.ID)
	}
	return nil
}

// ListMergeRequests 列出合并请求
func (s *MongoStore) ListMergeRequests(ctx context.Context, scenarioID, status string) ([]*model.MergeRequest, error) {
	filter := bson.M{"scenario_id": scenarioID}
	if status != "" {
		filter["status"] = status
	}

	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := s.merges.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var mrs []*model.MergeRequest
	if err := cursor.All(ctx, &mrs); err != nil {
		return nil, err
	}
	return mrs, nil
}

// ============ Comment Management ============

// AddComment 添加评论
func (s *MongoStore) AddComment(ctx context.Context, comment *model.Comment) error {
	comment.Timestamp = time.Now()

	_, err := s.comments.InsertOne(ctx, comment)
	return err
}

// GetComments 获取评论
func (s *MongoStore) GetComments(ctx context.Context, scenarioID, entityType, entityID string) ([]*model.Comment, error) {
	filter := bson.M{"scenario_id": scenarioID}
	if entityType != "" {
		filter["entity_type"] = entityType
	}
	if entityID != "" {
		filter["entity_id"] = entityID
	}

	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}})

	cursor, err := s.comments.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var comments []*model.Comment
	if err := cursor.All(ctx, &comments); err != nil {
		return nil, err
	}
	return comments, nil
}

// UpdateComment 更新评论
func (s *MongoStore) UpdateComment(ctx context.Context, comment *model.Comment) error {
	result, err := s.comments.ReplaceOne(ctx, bson.M{"_id": comment.ID}, comment)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("comment not found: %s", comment.ID)
	}
	return nil
}

// GetComment 获取单个评论
func (s *MongoStore) GetComment(ctx context.Context, commentID string) (*model.Comment, error) {
	var comment model.Comment
	err := s.comments.FindOne(ctx, bson.M{"_id": commentID}).Decode(&comment)
	if err == mongo.ErrNoDocuments {
		return nil, fmt.Errorf("comment not found: %s", commentID)
	}
	return &comment, err
}

// FindScenariosByEquipmentID 查找引用了指定装备 ID 的所有想定
func (s *MongoStore) FindScenariosByEquipmentID(ctx context.Context, equipmentID string) ([]*model.Scenario, error) {
	filter := bson.M{
		"$or": []bson.M{
			{"platforms.equipment_ref.equipment_id": equipmentID},
			{"platforms.equipment_id": equipmentID},
		},
	}

	cursor, err := s.scenarios.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("query scenarios by equipment: %w", err)
	}
	defer cursor.Close(ctx)

	var scenarios []*model.Scenario
	if err := cursor.All(ctx, &scenarios); err != nil {
		return nil, err
	}
	return scenarios, nil
}
