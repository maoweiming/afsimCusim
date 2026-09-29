package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "truesim/gen/pb/timeseries"
	"truesim/timeseries/internal/model"
	"truesim/timeseries/internal/store"
)

// TimeseriesService 时序数据服务实现
type TimeseriesService struct {
	pb.UnimplementedTimeseriesServiceServer
	store *store.TimeseriesStore
}

// NewTimeseriesService 创建时序数据服务
func NewTimeseriesService(store *store.TimeseriesStore) *TimeseriesService {
	return &TimeseriesService{
		store: store,
	}
}

// ============ 仿真帧数据 ============

// WriteFrames 写入仿真帧
func (s *TimeseriesService) WriteFrames(ctx context.Context, req *pb.WriteFramesRequest) (*pb.WriteFramesResponse, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}
	if len(req.Frames) == 0 {
		return nil, status.Error(codes.InvalidArgument, "frames cannot be empty")
	}

	// 转换帧
	frames := make([]*model.SimulationFrame, len(req.Frames))
	for i, f := range req.Frames {
		frames[i] = pbToModelFrame(f)
	}

	// 批量写入
	written, failed, errors := s.store.WriteFrames(ctx, req.SimulationId, frames)

	return &pb.WriteFramesResponse{
		Written: written,
		Failed:  failed,
		Errors:  errors,
	}, nil
}

// QueryFrames 查询仿真帧
func (s *TimeseriesService) QueryFrames(ctx context.Context, req *pb.QueryFramesRequest) (*pb.QueryFramesResponse, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	timeRange := &model.TimeRange{
		Start: req.StartTime,
		End:   req.EndTime,
	}

	if timeRange.End == 0 {
		timeRange.End = float64(time.Now().Unix())
	}

	frames, total, err := s.store.QueryFrames(
		ctx,
		req.SimulationId,
		timeRange,
		req.PlatformIds,
		req.Limit,
		req.Offset,
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to query frames: %v", err)
	}

	pbFrames := make([]*pb.SimulationFrame, len(frames))
	for i, f := range frames {
		pbFrames[i] = modelToPBFrame(f)
	}

	return &pb.QueryFramesResponse{
		Frames: pbFrames,
		Total:  total,
	}, nil
}

// StreamFrames 流式仿真帧（轮询 InfluxDB 中的新数据并实时推送）
func (s *TimeseriesService) StreamFrames(req *pb.StreamFramesRequest, stream pb.TimeseriesService_StreamFramesServer) error {
	if req.SimulationId == "" {
		return status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	ctx := stream.Context()
	ch := make(chan *model.SimulationFrame, 100)

	go func() {
		defer close(ch)
		if err := s.store.StreamFrames(ctx, req.SimulationId, ch); err != nil && ctx.Err() == nil {
			log.Printf("Stream frames error: %v", err)
		}
	}()

	for frame := range ch {
		if err := stream.Send(modelToPBFrame(frame)); err != nil {
			return err
		}
	}

	return nil
}

// ============ 回放管理 ============

// CreateReplay 创建回放
func (s *TimeseriesService) CreateReplay(ctx context.Context, req *pb.CreateReplayRequest) (*pb.PlaybackSession, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	session, err := s.store.CreateReplay(
		ctx,
		req.ScenarioId,
		req.SimulationId,
		req.Name,
		req.CreatedBy,
		req.Metadata,
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create replay: %v", err)
	}

	return modelToPBPlaybackSession(session), nil
}

// GetReplay 获取回放
func (s *TimeseriesService) GetReplay(ctx context.Context, req *pb.GetReplayRequest) (*pb.PlaybackSession, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	session, err := s.store.GetReplay(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "replay not found: %v", err)
	}

	return modelToPBPlaybackSession(session), nil
}

// ListReplays 列出回放
func (s *TimeseriesService) ListReplays(ctx context.Context, req *pb.ListReplaysRequest) (*pb.ListReplaysResponse, error) {
	sessions, err := s.store.ListReplays(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list replays: %v", err)
	}

	pbSessions := make([]*pb.PlaybackSession, len(sessions))
	for i, sess := range sessions {
		pbSessions[i] = modelToPBPlaybackSession(sess)
	}

	return &pb.ListReplaysResponse{
		Replays: pbSessions,
		Total:   int32(len(pbSessions)),
	}, nil
}

// DeleteReplay 删除回放
func (s *TimeseriesService) DeleteReplay(ctx context.Context, req *pb.DeleteReplayRequest) (*pb.Empty, error) {
	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.store.DeleteReplay(ctx, req.Id); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete replay: %v", err)
	}

	return &pb.Empty{}, nil
}

// StreamReplay 流式回放
func (s *TimeseriesService) StreamReplay(req *pb.StreamReplayRequest, stream pb.TimeseriesService_StreamReplayServer) error {
	if req.ReplayId == "" {
		return status.Error(codes.InvalidArgument, "replay_id is required")
	}

	ctx := stream.Context()
	ch := make(chan *model.SimulationFrame, 100)

	go func() {
		defer close(ch)
		speed := req.Speed
		if speed <= 0 {
			speed = 1.0
		}
		frameInterval := req.FrameInterval
		if frameInterval <= 0 {
			frameInterval = 100 // 100ms
		}

		if err := s.store.StreamReplay(ctx, req.ReplayId, req.StartTime, req.EndTime, speed, frameInterval, ch); err != nil {
			log.Printf("Stream replay error: %v", err)
		}
	}()

	for frame := range ch {
		pbFrame := modelToPBFrame(frame)
		if err := stream.Send(pbFrame); err != nil {
			return err
		}
	}

	return nil
}

// ============ 统计分析 ============

// GetSimulationStats 获取仿真统计
func (s *TimeseriesService) GetSimulationStats(ctx context.Context, req *pb.GetStatsRequest) (*pb.SimulationStats, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	stats, err := s.store.GetSimulationStats(ctx, req.SimulationId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get stats: %v", err)
	}

	return modelToPBSimulationStats(stats), nil
}

// GetPlatformTrack 获取平台航迹
func (s *TimeseriesService) GetPlatformTrack(ctx context.Context, req *pb.GetTrackRequest) (*pb.PlatformTrack, error) {
	if req.SimulationId == "" || req.PlatformId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id and platform_id are required")
	}

	frames, err := s.store.GetPlatformTrack(ctx, req.SimulationId, req.PlatformId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get platform track: %v", err)
	}

	pbFrames := make([]*pb.SimulationFrame, len(frames))
	for i, f := range frames {
		pbFrames[i] = modelToPBFrame(f)
	}

	platformName := ""
	if len(frames) > 0 {
		platformName = frames[0].PlatformName
	}

	return &pb.PlatformTrack{
		PlatformId:   req.PlatformId,
		PlatformName: platformName,
		Frames:       pbFrames,
	}, nil
}

// GetEngagementEvents 获取交战事件
func (s *TimeseriesService) GetEngagementEvents(ctx context.Context, req *pb.GetEngagementRequest) (*pb.EngagementEvents, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	events, err := s.store.GetEngagementEvents(ctx, req.SimulationId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get engagement events: %v", err)
	}

	pbEvents := make([]*pb.EngagementEvent, len(events))
	for i, e := range events {
		pbEvents[i] = modelToPBEngagementEvent(e)
	}

	return &pb.EngagementEvents{Events: pbEvents}, nil
}

// ============ 数据导出 ============

// ExportToCSV 导出 CSV
func (s *TimeseriesService) ExportToCSV(ctx context.Context, req *pb.ExportRequest) (*pb.ExportResponse, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	data, err := s.store.ExportToCSV(ctx, req.SimulationId, req.PlatformIds, req.StartTime, req.EndTime)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to export CSV: %v", err)
	}

	filename := fmt.Sprintf("simulation_%s.csv", req.SimulationId)

	return &pb.ExportResponse{
		Data:        data,
		Filename:    filename,
		ContentType: "text/csv",
		Size:        int64(len(data)),
	}, nil
}

// ExportToKML 导出 KML
func (s *TimeseriesService) ExportToKML(ctx context.Context, req *pb.ExportRequest) (*pb.ExportResponse, error) {
	if req.SimulationId == "" {
		return nil, status.Error(codes.InvalidArgument, "simulation_id is required")
	}

	data, err := s.store.ExportToKML(ctx, req.SimulationId, req.PlatformIds, req.StartTime, req.EndTime)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to export KML: %v", err)
	}

	filename := fmt.Sprintf("simulation_%s.kml", req.SimulationId)

	return &pb.ExportResponse{
		Data:        data,
		Filename:    filename,
		ContentType: "application/vnd.google-earth.kml+xml",
		Size:        int64(len(data)),
	}, nil
}

// ============ Conversion Helpers ============

func pbToModelFrame(f *pb.SimulationFrame) *model.SimulationFrame {
	frame := &model.SimulationFrame{
		SimTime:      f.SimTime,
		PlatformID:   f.PlatformId,
		PlatformName: f.PlatformName,
		Side:         f.Side,
		Heading:      f.Heading,
		Altitude:     f.Altitude,
		Status:       f.Status,
		FuelRemaining: f.FuelRemaining,
		DamageLevel:  f.DamageLevel,
		Metadata:     f.Metadata,
	}

	if f.Position != nil {
		frame.Position = model.GeoPosition{
			Longitude:   f.Position.Longitude,
			Latitude:    f.Position.Latitude,
			AltitudeMSL: f.Position.AltitudeMsl,
			AltitudeAGL: f.Position.AltitudeAgl,
		}
	}

	if f.Velocity != nil {
		frame.Velocity = model.Velocity{
			North: f.Velocity.North,
			East:  f.Velocity.East,
			Down:  f.Velocity.Down,
			Speed: f.Velocity.Speed,
		}
	}

	frame.Sensors = make([]model.SensorState, len(f.Sensors))
	for i, s := range f.Sensors {
		frame.Sensors[i] = model.SensorState{
			SensorID:   s.SensorId,
			SensorName: s.SensorName,
			Type:       s.Type,
			Active:     s.Active,
			Mode:       s.Mode,
			Azimuth:    s.Azimuth,
			Elevation:  s.Elevation,
		}
		frame.Sensors[i].Detections = make([]model.TrackDetection, len(s.Detections))
		for j, d := range s.Detections {
			frame.Sensors[i].Detections[j] = model.TrackDetection{
				TargetID:       d.TargetId,
				Range:          d.Range,
				Bearing:        d.Bearing,
				Confidence:     d.Confidence,
				Classification: d.Classification,
			}
		}
	}

	frame.Weapons = make([]model.WeaponState, len(f.Weapons))
	for i, w := range f.Weapons {
		frame.Weapons[i] = model.WeaponState{
			WeaponID:   w.WeaponId,
			WeaponName: w.WeaponName,
			Type:       w.Type,
			Remaining:  w.Remaining,
			Total:      w.Total,
			Status:     w.Status,
		}
	}

	frame.Comms = make([]model.CommState, len(f.Comms))
	for i, c := range f.Comms {
		frame.Comms[i] = model.CommState{
			CommID:    c.CommId,
			CommName:  c.CommName,
			Active:    c.Active,
			Frequency: c.Frequency,
			Bandwidth: c.Bandwidth,
		}
	}

	return frame
}

func modelToPBFrame(f *model.SimulationFrame) *pb.SimulationFrame {
	frame := &pb.SimulationFrame{
		SimTime:      f.SimTime,
		PlatformId:   f.PlatformID,
		PlatformName: f.PlatformName,
		Side:         f.Side,
		Heading:      f.Heading,
		Altitude:     f.Altitude,
		Status:       f.Status,
		FuelRemaining: f.FuelRemaining,
		DamageLevel:  f.DamageLevel,
		Metadata:     f.Metadata,
		Position: &pb.GeoPosition{
			Longitude:   f.Position.Longitude,
			Latitude:    f.Position.Latitude,
			AltitudeMsl: f.Position.AltitudeMSL,
			AltitudeAgl: f.Position.AltitudeAGL,
		},
		Velocity: &pb.Velocity{
			North: f.Velocity.North,
			East:  f.Velocity.East,
			Down:  f.Velocity.Down,
			Speed: f.Velocity.Speed,
		},
	}

	frame.Sensors = make([]*pb.SensorState, len(f.Sensors))
	for i, s := range f.Sensors {
		frame.Sensors[i] = &pb.SensorState{
			SensorId:   s.SensorID,
			SensorName: s.SensorName,
			Type:       s.Type,
			Active:     s.Active,
			Mode:       s.Mode,
			Azimuth:    s.Azimuth,
			Elevation:  s.Elevation,
		}
		frame.Sensors[i].Detections = make([]*pb.TrackDetection, len(s.Detections))
		for j, d := range s.Detections {
			frame.Sensors[i].Detections[j] = &pb.TrackDetection{
				TargetId:       d.TargetID,
				Range:          d.Range,
				Bearing:        d.Bearing,
				Confidence:     d.Confidence,
				Classification: d.Classification,
			}
		}
	}

	frame.Weapons = make([]*pb.WeaponState, len(f.Weapons))
	for i, w := range f.Weapons {
		frame.Weapons[i] = &pb.WeaponState{
			WeaponId:   w.WeaponID,
			WeaponName: w.WeaponName,
			Type:       w.Type,
			Remaining:  w.Remaining,
			Total:      w.Total,
			Status:     w.Status,
		}
	}

	frame.Comms = make([]*pb.CommState, len(f.Comms))
	for i, c := range f.Comms {
		frame.Comms[i] = &pb.CommState{
			CommId:    c.CommID,
			CommName:  c.CommName,
			Active:    c.Active,
			Frequency: c.Frequency,
			Bandwidth: c.Bandwidth,
		}
	}

	return frame
}

func modelToPBEngagementEvent(e *model.EngagementEvent) *pb.EngagementEvent {
	return &pb.EngagementEvent{
		Id:       e.ID,
		Time:     e.Time,
		Type:     e.Type,
		SourceId: e.SourceID,
		TargetId: e.TargetID,
		WeaponId: e.WeaponID,
		Result:   e.Result,
		Position: &pb.GeoPosition{
			Longitude:   e.Position.Longitude,
			Latitude:    e.Position.Latitude,
			AltitudeMsl: e.Position.AltitudeMSL,
			AltitudeAgl: e.Position.AltitudeAGL,
		},
	}
}

func modelToPBPlaybackSession(s *model.PlaybackSession) *pb.PlaybackSession {
	return &pb.PlaybackSession{
		Id:           s.ID,
		ScenarioId:   s.ScenarioID,
		SimulationId: s.SimulationID,
		Name:         s.Name,
		CreatedBy:    s.CreatedBy,
		CreatedAt:    s.CreatedAt.Format(time.RFC3339),
		StartTime:    s.StartTime,
		EndTime:      s.EndTime,
		Duration:     s.Duration,
		FrameCount:   s.FrameCount,
		Metadata:     s.Metadata,
	}
}

func modelToPBSimulationStats(s *model.SimulationStats) *pb.SimulationStats {
	stats := &pb.SimulationStats{
		SimulationId:  s.SimulationID,
		Duration:      s.Duration,
		TotalFrames:   s.TotalFrames,
		PlatformCount: s.PlatformCount,
		EventsCount:   s.EventsCount,
	}

	stats.PlatformStats = make([]*pb.PlatformStats, len(s.PlatformStats))
	for i, ps := range s.PlatformStats {
		stats.PlatformStats[i] = &pb.PlatformStats{
			PlatformId:    ps.PlatformID,
			PlatformName:  ps.PlatformName,
			Side:          ps.Side,
			MaxSpeed:      ps.MaxSpeed,
			MinAltitude:   ps.MinAltitude,
			MaxAltitude:   ps.MaxAltitude,
			TotalDistance:  ps.TotalDistance,
			ShotsFired:    ps.ShotsFired,
			Kills:         ps.Kills,
			FinalStatus:   ps.FinalStatus,
		}
	}

	stats.Engagements = make([]*pb.EngagementSummary, len(s.Engagements))
	for i, e := range s.Engagements {
		stats.Engagements[i] = &pb.EngagementSummary{
			Id:         e.ID,
			Time:       e.Time,
			AttackerId: e.AttackerID,
			TargetId:   e.TargetID,
			WeaponType: e.WeaponType,
			Result:     e.Result,
		}
	}

	return stats
}
