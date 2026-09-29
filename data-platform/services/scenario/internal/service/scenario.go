package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "truesim/gen/pb/scenario"
	"truesim/scenario/internal/collab"
	"truesim/scenario/internal/model"
	"truesim/scenario/internal/store"
)

// ScenarioService 想定服务实现
type ScenarioService struct {
	pb.UnimplementedScenarioServiceServer
	store *store.MongoStore
	collab *collab.CollabManager
}

// NewScenarioService 创建想定服务
func NewScenarioService(store *store.MongoStore, collabMgr *collab.CollabManager) *ScenarioService {
	return &ScenarioService{
		store:  store,
		collab: collabMgr,
	}
}

// ============ CRUD ============

// CreateScenario 创建想定
func (s *ScenarioService) CreateScenario(ctx context.Context, req *pb.CreateScenarioRequest) (*pb.Scenario, error) {
	if req.Scenario == nil {
		return nil, status.Error(codes.InvalidArgument, "scenario is required")
	}

	scenario := pbToModelScenario(req.Scenario)
	if scenario.ID == "" {
		scenario.ID = uuid.New().String()
	}

	if err := s.store.CreateScenario(ctx, scenario); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create scenario: %v", err)
	}

	// 创建默认 main 分支
	branch := &model.Branch{
		ID:         uuid.New().String(),
		ScenarioID: scenario.ID,
		Name:       "main",
		CreatedBy:  scenario.CreatedBy,
		Status:     "active",
	}
	if err := s.store.CreateBranch(ctx, branch); err != nil {
		log.Printf("Warning: failed to create default branch: %v", err)
	}

	return modelToPBScenario(scenario), nil
}

// GetScenario 获取想定
func (s *ScenarioService) GetScenario(ctx context.Context, req *pb.GetScenarioRequest) (*pb.Scenario, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	scenario, err := s.store.GetScenario(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "scenario not found: %v", err)
	}

	return modelToPBScenario(scenario), nil
}

// UpdateScenario 更新想定
func (s *ScenarioService) UpdateScenario(ctx context.Context, req *pb.UpdateScenarioRequest) (*pb.Scenario, error) {
	if req.Scenario == nil || req.Scenario.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario with id is required")
	}

	scenario := pbToModelScenario(req.Scenario)
	if err := s.store.UpdateScenario(ctx, scenario); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update scenario: %v", err)
	}

	return modelToPBScenario(scenario), nil
}

// DeleteScenario 删除想定
func (s *ScenarioService) DeleteScenario(ctx context.Context, req *pb.DeleteScenarioRequest) (*pb.Empty, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.store.DeleteScenario(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete scenario: %v", err)
	}

	return &pb.Empty{}, nil
}

// ListScenario 列出想定
func (s *ScenarioService) ListScenario(ctx context.Context, req *pb.ListScenarioRequest) (*pb.ListScenarioResponse, error) {
	scenarios, total, err := s.store.ListScenario(ctx, req.Status, req.Tags, req.Search, req.Page, req.PageSize)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list scenarios: %v", err)
	}

	pbScenarios := make([]*pb.Scenario, len(scenarios))
	for i, scenario := range scenarios {
		pbScenarios[i] = modelToPBScenario(scenario)
	}

	return &pb.ListScenarioResponse{
		Scenarios: pbScenarios,
		Total:     total,
	}, nil
}

// ============ Branch Management ============

// CreateBranch 创建分支
func (s *ScenarioService) CreateBranch(ctx context.Context, req *pb.CreateBranchRequest) (*pb.Branch, error) {
	if req.ScenarioId == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and name are required")
	}

	// 检查想定是否存在
	_, err := s.store.GetScenario(ctx, req.ScenarioId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "scenario not found: %v", err)
	}

	// 如果指定了父分支，检查其是否存在
	if req.ParentBranchId != "" {
		_, err := s.store.GetBranch(ctx, req.ScenarioId, req.ParentBranchId)
		if err != nil {
			return nil, status.Errorf(codes.NotFound, "parent branch not found: %v", err)
		}
	}

	branch := &model.Branch{
		ID:             uuid.New().String(),
		ScenarioID:     req.ScenarioId,
		Name:           req.Name,
		ParentBranchID: req.ParentBranchId,
		Status:         "active",
	}

	if err := s.store.CreateBranch(ctx, branch); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create branch: %v", err)
	}

	return modelToPBBranch(branch), nil
}

// ListBranches 列出分支
func (s *ScenarioService) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResponse, error) {
	if req.ScenarioId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id is required")
	}

	branches, err := s.store.ListBranches(ctx, req.ScenarioId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list branches: %v", err)
	}

	pbBranches := make([]*pb.Branch, len(branches))
	for i, branch := range branches {
		pbBranches[i] = modelToPBBranch(branch)
	}

	return &pb.ListBranchesResponse{
		Branches: pbBranches,
	}, nil
}

// MergeBranch 合并分支
func (s *ScenarioService) MergeBranch(ctx context.Context, req *pb.MergeBranchRequest) (*pb.MergeResult, error) {
	if req.ScenarioId == "" || req.SourceBranch == "" || req.TargetBranch == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id, source_branch, and target_branch are required")
	}

	// 检查源分支
	source, err := s.store.GetBranch(ctx, req.ScenarioId, req.SourceBranch)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "source branch not found: %v", err)
	}

	// 检查目标分支
	target, err := s.store.GetBranch(ctx, req.ScenarioId, req.TargetBranch)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "target branch not found: %v", err)
	}

	// TODO: 实现实际的合并逻辑（对比提交历史，检测冲突）
	// 目前简单实现：将源分支标记为已合并
	source.Status = "merged"
	if err := s.store.UpdateBranch(ctx, source); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update source branch: %v", err)
	}

	// 更新目标分支的 head commit
	target.HeadCommitID = source.HeadCommitID
	if err := s.store.UpdateBranch(ctx, target); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update target branch: %v", err)
	}

	return &pb.MergeResult{
		Success: true,
	}, nil
}

// ResolveConflict 解决冲突
func (s *ScenarioService) ResolveConflict(ctx context.Context, req *pb.ResolveConflictRequest) (*pb.MergeResult, error) {
	// TODO: 实现冲突解决逻辑
	return nil, status.Error(codes.Unimplemented, "ResolveConflict not yet implemented")
}

// ============ Commit Management ============

// CommitChanges 提交变更
func (s *ScenarioService) CommitChanges(ctx context.Context, req *pb.CommitRequest) (*pb.Commit, error) {
	if req.ScenarioId == "" || req.Branch == "" || req.Message == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id, branch, and message are required")
	}

	// 获取分支
	branch, err := s.store.GetBranch(ctx, req.ScenarioId, req.Branch)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "branch not found: %v", err)
	}

	// 创建提交
	changes := make([]model.Change, len(req.Changes))
	for i, c := range req.Changes {
		changes[i] = model.Change{
			Type:       c.Type,
			EntityType: c.EntityType,
			EntityID:   c.EntityId,
			EntityName: c.EntityName,
			Before:     c.Before,
			After:      c.After,
		}
	}

	commit := &model.Commit{
		ID:             uuid.New().String(),
		BranchID:       branch.ID,
		Message:        req.Message,
		Author:         "system", // TODO: 从上下文获取用户信息
		AuthorName:     "System",
		Changes:        changes,
		ParentCommitID: branch.HeadCommitID,
	}

	if err := s.store.CreateCommit(ctx, commit); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create commit: %v", err)
	}

	// 更新分支的 head commit
	branch.HeadCommitID = commit.ID
	if err := s.store.UpdateBranch(ctx, branch); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update branch: %v", err)
	}

	return modelToPBCommit(commit), nil
}

// GetCommitHistory 获取提交历史
func (s *ScenarioService) GetCommitHistory(ctx context.Context, req *pb.GetCommitHistoryRequest) (*pb.CommitHistory, error) {
	if req.ScenarioId == "" || req.Branch == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and branch are required")
	}

	branch, err := s.store.GetBranch(ctx, req.ScenarioId, req.Branch)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "branch not found: %v", err)
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}

	commits, err := s.store.GetCommitHistory(ctx, branch.ID, limit)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get commit history: %v", err)
	}

	pbCommits := make([]*pb.Commit, len(commits))
	for i, commit := range commits {
		pbCommits[i] = modelToPBCommit(commit)
	}

	return &pb.CommitHistory{
		Commits: pbCommits,
	}, nil
}

// RevertCommit 回滚提交
func (s *ScenarioService) RevertCommit(ctx context.Context, req *pb.RevertCommitRequest) (*pb.Commit, error) {
	if req.ScenarioId == "" || req.CommitId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and commit_id are required")
	}

	// 获取原提交
	original, err := s.store.GetCommit(ctx, req.CommitId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "commit not found: %v", err)
	}

	// 创建反向变更
	reverseChanges := make([]model.Change, len(original.Changes))
	for i, c := range original.Changes {
		reverseChanges[i] = model.Change{
			Type:       reverseChangeType(c.Type),
			EntityType: c.EntityType,
			EntityID:   c.EntityID,
			EntityName: c.EntityName,
			Before:     c.After,
			After:      c.Before,
		}
	}

	// 获取分支
	branch, err := s.store.GetBranch(ctx, req.ScenarioId, original.BranchID)
	if err != nil {
		// 如果 BranchID 就是分支名
		branch, err = s.store.GetBranch(ctx, req.ScenarioId, "main")
		if err != nil {
			return nil, status.Errorf(codes.NotFound, "branch not found: %v", err)
		}
	}

	commit := &model.Commit{
		ID:             uuid.New().String(),
		BranchID:       branch.ID,
		Message:        fmt.Sprintf("Revert: %s", original.Message),
		Author:         "system",
		AuthorName:     "System",
		Changes:        reverseChanges,
		ParentCommitID: branch.HeadCommitID,
	}

	if err := s.store.CreateCommit(ctx, commit); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create revert commit: %v", err)
	}

	branch.HeadCommitID = commit.ID
	if err := s.store.UpdateBranch(ctx, branch); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update branch: %v", err)
	}

	return modelToPBCommit(commit), nil
}

// ============ Merge Request Management ============

// CreateMergeRequest 创建合并请求
func (s *ScenarioService) CreateMergeRequest(ctx context.Context, req *pb.CreateMRRequest) (*pb.MergeRequest, error) {
	if req.ScenarioId == "" || req.SourceBranch == "" || req.TargetBranch == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id, source_branch, and target_branch are required")
	}

	mr := &model.MergeRequest{
		ID:           uuid.New().String(),
		ScenarioID:   req.ScenarioId,
		SourceBranch: req.SourceBranch,
		TargetBranch: req.TargetBranch,
		Title:        req.Title,
		Description:  req.Description,
		Author:       "system", // TODO: 从上下文获取
		AuthorName:   "System",
		Status:       "open",
	}

	if err := s.store.CreateMergeRequest(ctx, mr); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create merge request: %v", err)
	}

	return modelToPBMergeRequest(mr), nil
}

// ReviewMergeRequest 审查合并请求
func (s *ScenarioService) ReviewMergeRequest(ctx context.Context, req *pb.ReviewMRRequest) (*pb.MergeRequest, error) {
	mr, err := s.store.GetMergeRequest(ctx, req.MrId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "merge request not found: %v", err)
	}

	reviewer := model.Reviewer{
		UserID:     req.UserId,
		Status:     req.Status,
		Comment:    req.Comment,
		ReviewedAt: time.Now(),
	}

	// 更新或添加审查者
	found := false
	for i, r := range mr.Reviewers {
		if r.UserID == req.UserId {
			mr.Reviewers[i] = reviewer
			found = true
			break
		}
	}
	if !found {
		mr.Reviewers = append(mr.Reviewers, reviewer)
	}

	if err := s.store.UpdateMergeRequest(ctx, mr); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update merge request: %v", err)
	}

	return modelToPBMergeRequest(mr), nil
}

// ApproveMergeRequest 批准合并请求
func (s *ScenarioService) ApproveMergeRequest(ctx context.Context, req *pb.ApproveMRRequest) (*pb.MergeRequest, error) {
	mr, err := s.store.GetMergeRequest(ctx, req.MrId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "merge request not found: %v", err)
	}

	// 添加批准
	mr.Approvals = append(mr.Approvals, req.UserId)

	// 检查是否已批准（简单实现：需要至少 1 个批准）
	if len(mr.Approvals) >= 1 {
		mr.Status = "approved"
	}

	if err := s.store.UpdateMergeRequest(ctx, mr); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update merge request: %v", err)
	}

	return modelToPBMergeRequest(mr), nil
}

// ============ Collaboration ============

// JoinCollabRoom 加入协同房间
func (s *ScenarioService) JoinCollabRoom(req *pb.JoinRoomRequest, stream pb.ScenarioService_JoinCollabRoomServer) error {
	if req.ScenarioId == "" || req.UserId == "" {
		return status.Error(codes.InvalidArgument, "scenario_id and user_id are required")
	}

	branch := req.Branch
	if branch == "" {
		branch = "main"
	}

	_, eventChan, err := s.collab.JoinRoom(req.ScenarioId, branch, req.UserId, req.UserId)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to join room: %v", err)
	}

	// 保持连接，发送事件
	for event := range eventChan {
		pbEvent := &pb.CollabEvent{
			Type:      event.Type,
			UserId:    event.UserID,
			Timestamp: event.Timestamp,
			Payload:   event.Payload,
		}
		if err := stream.Send(pbEvent); err != nil {
			// 客户端断开连接
			s.collab.LeaveRoom(req.ScenarioId, branch, req.UserId)
			return err
		}
	}

	return nil
}

// SendOperation 发送操作
func (s *ScenarioService) SendOperation(ctx context.Context, req *pb.SendOpRequest) (*pb.OperationAck, error) {
	if req.ScenarioId == "" || req.Operation == nil {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and operation are required")
	}

	op := &collab.Operation{
		ID:          req.Operation.Id,
		UserID:      req.Operation.UserId,
		Timestamp:   req.Operation.Timestamp,
		Type:        req.Operation.Type,
		Path:        req.Operation.Path,
		OldValue:    req.Operation.OldValue,
		NewValue:    req.Operation.NewValue,
		VectorClock: req.Operation.VectorClock,
	}

	ack, err := s.collab.SendOperation(req.ScenarioId, "main", op)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to send operation: %v", err)
	}

	return &pb.OperationAck{
		OperationId: ack.OperationID,
		Success:     ack.Success,
		Error:       ack.Error,
	}, nil
}

// AcquireLock 获取锁
func (s *ScenarioService) AcquireLock(ctx context.Context, req *pb.AcquireLockRequest) (*pb.LockResponse, error) {
	if req.ScenarioId == "" || req.ObjectId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id, object_id, and user_id are required")
	}

	success, lockedBy, err := s.collab.AcquireLock(
		req.ScenarioId, "main",
		req.ObjectId, req.ObjectType,
		req.UserId, req.LockType,
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to acquire lock: %v", err)
	}

	return &pb.LockResponse{
		Success:  success,
		LockedBy: lockedBy,
	}, nil
}

// ReleaseLock 释放锁
func (s *ScenarioService) ReleaseLock(ctx context.Context, req *pb.ReleaseLockRequest) (*pb.Empty, error) {
	if req.ScenarioId == "" || req.ObjectId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and object_id are required")
	}

	if err := s.collab.ReleaseLock(req.ScenarioId, "main", req.ObjectId, ""); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to release lock: %v", err)
	}

	return &pb.Empty{}, nil
}

// ============ Comments ============

// AddComment 添加评论
func (s *ScenarioService) AddComment(ctx context.Context, req *pb.AddCommentRequest) (*pb.Comment, error) {
	if req.ScenarioId == "" || req.Comment == nil {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and comment are required")
	}

	comment := &model.Comment{
		ID:         uuid.New().String(),
		ScenarioID: req.ScenarioId,
		UserID:     req.Comment.UserId,
		UserName:   req.Comment.UserName,
		Content:    req.Comment.Content,
		ParentID:   req.Comment.ParentId,
		EntityType: req.Comment.EntityType,
		EntityID:   req.Comment.EntityId,
	}

	if req.Comment.Position != nil {
		comment.Position = &model.Position{
			Lng: req.Comment.Position.Lng,
			Lat: req.Comment.Position.Lat,
		}
	}

	if err := s.store.AddComment(ctx, comment); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add comment: %v", err)
	}

	return modelToPBComment(comment), nil
}

// GetComments 获取评论
func (s *ScenarioService) GetComments(ctx context.Context, req *pb.GetCommentsRequest) (*pb.GetCommentsResponse, error) {
	if req.ScenarioId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id is required")
	}

	comments, err := s.store.GetComments(ctx, req.ScenarioId, req.EntityType, req.EntityId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get comments: %v", err)
	}

	pbComments := make([]*pb.Comment, len(comments))
	for i, comment := range comments {
		pbComments[i] = modelToPBComment(comment)
	}

	return &pb.GetCommentsResponse{
		Comments: pbComments,
	}, nil
}

// ResolveComment 解决评论
func (s *ScenarioService) ResolveComment(ctx context.Context, req *pb.ResolveCommentRequest) (*pb.Comment, error) {
	if req.ScenarioId == "" || req.CommentId == "" {
		return nil, status.Error(codes.InvalidArgument, "scenario_id and comment_id are required")
	}

	comment, err := s.store.GetComment(ctx, req.CommentId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "comment not found: %v", err)
	}

	comment.Resolved = true
	if err := s.store.UpdateComment(ctx, comment); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update comment: %v", err)
	}

	return modelToPBComment(comment), nil
}

// ============ Conversion Helpers ============

func pbToModelScenario(pb *pb.Scenario) *model.Scenario {
	s := &model.Scenario{
		ID:             pb.Id,
		Name:           pb.Name,
		Description:    pb.Description,
		Version:        pb.Version,
		Status:         pb.Status,
		Tags:           pb.Tags,
		Category:       pb.Category,
		Classification: pb.Classification,
		CreatedBy:      pb.CreatedBy,
	}

	if pb.Terrain != nil {
		s.Terrain = model.TerrainConfig{
			DataSource: pb.Terrain.DataSource,
		}
		if pb.Terrain.Bounds != nil {
			s.Terrain.Bounds = model.BoundingBox{
				South: pb.Terrain.Bounds.South,
				West:  pb.Terrain.Bounds.West,
				North: pb.Terrain.Bounds.North,
				East:  pb.Terrain.Bounds.East,
			}
		}
	}

	s.Platforms = make([]model.PlatformInstance, len(pb.Platforms))
	for i, p := range pb.Platforms {
		plat := model.PlatformInstance{
			ID:              p.Id,
			Name:            p.Name,
			Side:            p.Side,
			InitialAltitude: p.InitialAltitude,
			InitialHeading:  p.InitialHeading,
			InitialSpeed:    p.InitialSpeed,
			RouteID:         p.RouteId,
		}
		// 优先使用 EquipmentRef，fallback 到旧的 EquipmentID
		if p.EquipmentRef != nil {
			plat.EquipmentRef = model.EquipmentRef{
				EquipmentID: p.EquipmentRef.EquipmentId,
				Version:     p.EquipmentRef.Version,
				Name:        p.EquipmentRef.Name,
				Category:    p.EquipmentRef.Category,
			}
			plat.EquipmentID = p.EquipmentRef.EquipmentId // 向后兼容
		} else {
			plat.EquipmentID = p.EquipmentId
			plat.EquipmentRef = model.EquipmentRef{EquipmentID: p.EquipmentId}
		}
		if p.InitialPosition != nil {
			plat.InitialPosition = model.Position{
				Lng: p.InitialPosition.Lng,
				Lat: p.InitialPosition.Lat,
			}
		}
		s.Platforms[i] = plat
	}

	s.Routes = make([]model.RouteDefinition, len(pb.Routes))
	for i, r := range pb.Routes {
		s.Routes[i] = model.RouteDefinition{
			ID:   r.Id,
			Name: r.Name,
		}
		s.Routes[i].Waypoints = make([]model.RouteWaypoint, len(r.Waypoints))
		for j, w := range r.Waypoints {
			s.Routes[i].Waypoints[j] = model.RouteWaypoint{
				Altitude: w.Altitude,
				Speed:    w.Speed,
			}
			if w.Position != nil {
				s.Routes[i].Waypoints[j].Position = model.Position{
					Lng: w.Position.Lng,
					Lat: w.Position.Lat,
				}
			}
		}
	}

	s.Zones = make([]model.ZoneDefinition, len(pb.Zones))
	for i, z := range pb.Zones {
		s.Zones[i] = model.ZoneDefinition{
			ID:   z.Id,
			Name: z.Name,
			Type: z.Type,
		}
		if z.GetCircle() != nil {
			s.Zones[i].Circle = &model.CircleZone{
				Radius: z.GetCircle().Radius,
			}
			if z.GetCircle().Center != nil {
				s.Zones[i].Circle.Center = model.Position{
					Lng: z.GetCircle().Center.Lng,
					Lat: z.GetCircle().Center.Lat,
				}
			}
		}
		if z.GetPolygon() != nil {
			vertices := make([]model.Position, len(z.GetPolygon().Vertices))
			for j, v := range z.GetPolygon().Vertices {
				vertices[j] = model.Position{Lng: v.Lng, Lat: v.Lat}
			}
			s.Zones[i].Polygon = &model.PolygonZone{Vertices: vertices}
		}
	}

	s.Triggers = make([]model.TriggerDefinition, len(pb.Triggers))
	for i, t := range pb.Triggers {
		s.Triggers[i] = model.TriggerDefinition{
			ID:        t.Id,
			Name:      t.Name,
			Condition: t.Condition,
			Action:    t.Action,
		}
	}

	return s
}

func modelToPBScenario(s *model.Scenario) *pb.Scenario {
	scenario := &pb.Scenario{
		Id:             s.ID,
		Name:           s.Name,
		Description:    s.Description,
		Version:        s.Version,
		Status:         s.Status,
		Tags:           s.Tags,
		Category:       s.Category,
		Classification: s.Classification,
		CreatedBy:      s.CreatedBy,
		CreatedAt:      s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      s.UpdatedAt.Format(time.RFC3339),
	}

	scenario.Terrain = &pb.TerrainConfig{
		DataSource: s.Terrain.DataSource,
		Bounds: &pb.BoundingBox{
			South: s.Terrain.Bounds.South,
			West:  s.Terrain.Bounds.West,
			North: s.Terrain.Bounds.North,
			East:  s.Terrain.Bounds.East,
		},
	}

	scenario.Platforms = make([]*pb.PlatformInstance, len(s.Platforms))
	for i, p := range s.Platforms {
		eqID := p.GetEffectiveEquipmentID()
		scenario.Platforms[i] = &pb.PlatformInstance{
			Id:          p.ID,
			EquipmentId: eqID, // deprecated field，保持向后兼容
			Name:        p.Name,
			Side:        p.Side,
			InitialPosition: &pb.Position{
				Lng: p.InitialPosition.Lng,
				Lat: p.InitialPosition.Lat,
			},
			InitialAltitude: p.InitialAltitude,
			InitialHeading:  p.InitialHeading,
			InitialSpeed:    p.InitialSpeed,
			RouteId:         p.RouteID,
			EquipmentRef: &pb.EquipmentRef{
				EquipmentId: p.EquipmentRef.EquipmentID,
				Version:     p.EquipmentRef.Version,
				Name:        p.EquipmentRef.Name,
				Category:    p.EquipmentRef.Category,
			},
		}
	}

	scenario.Routes = make([]*pb.RouteDefinition, len(s.Routes))
	for i, r := range s.Routes {
		scenario.Routes[i] = &pb.RouteDefinition{
			Id:   r.ID,
			Name: r.Name,
		}
		scenario.Routes[i].Waypoints = make([]*pb.RouteWaypoint, len(r.Waypoints))
		for j, w := range r.Waypoints {
			scenario.Routes[i].Waypoints[j] = &pb.RouteWaypoint{
				Position: &pb.Position{Lng: w.Position.Lng, Lat: w.Position.Lat},
				Altitude: w.Altitude,
				Speed:    w.Speed,
			}
		}
	}

	scenario.Zones = make([]*pb.ZoneDefinition, len(s.Zones))
	for i, z := range s.Zones {
		pbZone := &pb.ZoneDefinition{
			Id:   z.ID,
			Name: z.Name,
			Type: z.Type,
		}
		if z.Circle != nil {
			pbZone.Geometry = &pb.ZoneDefinition_Circle{
				Circle: &pb.CircleZone{
					Center: &pb.Position{Lng: z.Circle.Center.Lng, Lat: z.Circle.Center.Lat},
					Radius: z.Circle.Radius,
				},
			}
		}
		if z.Polygon != nil {
			vertices := make([]*pb.Position, len(z.Polygon.Vertices))
			for j, v := range z.Polygon.Vertices {
				vertices[j] = &pb.Position{Lng: v.Lng, Lat: v.Lat}
			}
			pbZone.Geometry = &pb.ZoneDefinition_Polygon{
				Polygon: &pb.PolygonZone{Vertices: vertices},
			}
		}
		scenario.Zones[i] = pbZone
	}

	scenario.Triggers = make([]*pb.TriggerDefinition, len(s.Triggers))
	for i, t := range s.Triggers {
		scenario.Triggers[i] = &pb.TriggerDefinition{
			Id:        t.ID,
			Name:      t.Name,
			Condition: t.Condition,
			Action:    t.Action,
		}
	}

	return scenario
}

func modelToPBBranch(b *model.Branch) *pb.Branch {
	return &pb.Branch{
		Id:             b.ID,
		ScenarioId:     b.ScenarioID,
		Name:           b.Name,
		ParentBranchId: b.ParentBranchID,
		CreatedBy:      b.CreatedBy,
		CreatedAt:      b.CreatedAt.Format(time.RFC3339),
		Status:         b.Status,
		HeadCommitId:   b.HeadCommitID,
	}
}

func modelToPBCommit(c *model.Commit) *pb.Commit {
	changes := make([]*pb.Change, len(c.Changes))
	for i, ch := range c.Changes {
		changes[i] = &pb.Change{
			Type:       ch.Type,
			EntityType: ch.EntityType,
			EntityId:   ch.EntityID,
			EntityName: ch.EntityName,
			Before:     ch.Before,
			After:      ch.After,
		}
	}

	return &pb.Commit{
		Id:             c.ID,
		BranchId:       c.BranchID,
		Message:        c.Message,
		Author:         c.Author,
		AuthorName:     c.AuthorName,
		Timestamp:      c.Timestamp.Format(time.RFC3339),
		Changes:        changes,
		ParentCommitId: c.ParentCommitID,
	}
}

func modelToPBMergeRequest(m *model.MergeRequest) *pb.MergeRequest {
	conflicts := make([]*pb.Conflict, len(m.Conflicts))
	for i, c := range m.Conflicts {
		conflicts[i] = &pb.Conflict{
			EntityType:   c.EntityType,
			EntityId:     c.EntityID,
			EntityName:   c.EntityName,
			Field:        c.Field,
			SourceValue:  c.SourceValue,
			TargetValue:  c.TargetValue,
			Resolution:   c.Resolution,
			ResolvedBy:   c.ResolvedBy,
			ResolvedValue: c.ResolvedValue,
		}
	}

	reviewers := make([]*pb.Reviewer, len(m.Reviewers))
	for i, r := range m.Reviewers {
		reviewers[i] = &pb.Reviewer{
			UserId:     r.UserID,
			UserName:   r.UserName,
			Status:     r.Status,
			Comment:    r.Comment,
			ReviewedAt: r.ReviewedAt.Format(time.RFC3339),
		}
	}

	comments := make([]*pb.MRComment, len(m.Comments))
	for i, c := range m.Comments {
		comments[i] = &pb.MRComment{
			Id:        c.ID,
			UserId:    c.UserID,
			UserName:  c.UserName,
			Content:   c.Content,
			Timestamp: c.Timestamp.Format(time.RFC3339),
			ParentId:  c.ParentID,
			Resolved:  c.Resolved,
		}
	}

	return &pb.MergeRequest{
		Id:           m.ID,
		ScenarioId:   m.ScenarioID,
		SourceBranch: m.SourceBranch,
		TargetBranch: m.TargetBranch,
		Title:        m.Title,
		Description:  m.Description,
		Author:       m.Author,
		AuthorName:   m.AuthorName,
		Status:       m.Status,
		Conflicts:    conflicts,
		Reviewers:    reviewers,
		Approvals:    m.Approvals,
		Rejections:   m.Rejections,
		Comments:     comments,
		CreatedAt:    m.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    m.UpdatedAt.Format(time.RFC3339),
	}
}

func modelToPBComment(c *model.Comment) *pb.Comment {
	comment := &pb.Comment{
		Id:         c.ID,
		UserId:     c.UserID,
		UserName:   c.UserName,
		Content:    c.Content,
		Timestamp:  c.Timestamp.Format(time.RFC3339),
		ParentId:   c.ParentID,
		EntityType: c.EntityType,
		EntityId:   c.EntityID,
		Resolved:   c.Resolved,
	}
	if c.Position != nil {
		comment.Position = &pb.Position{
			Lng: c.Position.Lng,
			Lat: c.Position.Lat,
		}
	}
	return comment
}

func reverseChangeType(t string) string {
	switch t {
	case "add":
		return "delete"
	case "delete":
		return "add"
	default:
		return t
	}
}

func mustMarshalJSON(v interface{}) string {
	data, _ := json.Marshal(v)
	return string(data)
}
