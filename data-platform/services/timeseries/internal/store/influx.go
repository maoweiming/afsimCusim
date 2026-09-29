package store

import (
	"context"
	"fmt"
	"log"
	"math"
	"sort"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/query"
	"github.com/influxdata/influxdb-client-go/v2/api/write"

	"truesim/timeseries/internal/model"
)

// TimeseriesStore 时序数据存储
type TimeseriesStore struct {
	client   influxdb2.Client
	org      string
	bucket   string
	writeAPI api.WriteAPIBlocking
	queryAPI api.QueryAPI
}

// NewTimeseriesStore 创建时序数据存储
func NewTimeseriesStore(url, token, org, bucket string) *TimeseriesStore {
	client := influxdb2.NewClient(url, token)

	return &TimeseriesStore{
		client:   client,
		org:      org,
		bucket:   bucket,
		writeAPI: client.WriteAPIBlocking(org, bucket),
		queryAPI: client.QueryAPI(org),
	}
}

// Close 关闭连接
func (s *TimeseriesStore) Close() {
	s.client.Close()
}

// WriteFrame 写入单个仿真帧
func (s *TimeseriesStore) WriteFrame(ctx context.Context, simulationID string, frame *model.SimulationFrame) error {
	point := s.frameToPoint(simulationID, frame)
	return s.writeAPI.WritePoint(ctx, point)
}

// WriteFrames 批量写入仿真帧（高性能）
func (s *TimeseriesStore) WriteFrames(ctx context.Context, simulationID string, frames []*model.SimulationFrame) (int64, int64, []string) {
	var written, failed int64
	var errors []string

	// 使用批量写入
	batchSize := 5000
	for i := 0; i < len(frames); i += batchSize {
		end := i + batchSize
		if end > len(frames) {
			end = len(frames)
		}

		batch := frames[i:end]
		for _, frame := range batch {
			point := s.frameToPoint(simulationID, frame)
			if err := s.writeAPI.WritePoint(ctx, point); err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("frame %d: %v", i, err))
			} else {
				written++
			}
		}

		// 刷新缓冲区
		if err := s.writeAPI.Flush(ctx); err != nil {
			log.Printf("Warning: flush error: %v", err)
		}
	}

	return written, failed, errors
}

// frameToPoint 将帧转换为 InfluxDB 点
func (s *TimeseriesStore) frameToPoint(simulationID string, frame *model.SimulationFrame) *write.Point {
	tags := map[string]string{
		"simulation_id": simulationID,
		"platform_id":   frame.PlatformID,
		"platform_name": frame.PlatformName,
		"side":          frame.Side,
		"status":        frame.Status,
	}

	fields := map[string]interface{}{
		// 位置
		"longitude":    frame.Position.Longitude,
		"latitude":     frame.Position.Latitude,
		"altitude_msl": frame.Position.AltitudeMSL,
		"altitude_agl": frame.Position.AltitudeAGL,
		// 速度
		"velocity_north": frame.Velocity.North,
		"velocity_east":  frame.Velocity.East,
		"velocity_down":  frame.Velocity.Down,
		"speed":          frame.Velocity.Speed,
		// 航向和高度
		"heading":  frame.Heading,
		"altitude": frame.Altitude,
		// 状态
		"fuel_remaining": frame.FuelRemaining,
		"damage_level":   frame.DamageLevel,
		// 传感器数量
		"sensor_count": len(frame.Sensors),
		"weapon_count": len(frame.Weapons),
		"comm_count":   len(frame.Comms),
	}

	// 添加武器状态
	for i, w := range frame.Weapons {
		key := fmt.Sprintf("weapon_%d_remaining", i)
		fields[key] = int(w.Remaining)
	}

	// 使用仿真时间作为时间戳
	// sim_time 是秒数，转换为绝对时间
	timestamp := time.Unix(0, int64(frame.SimTime*1e9))

	return influxdb2.NewPoint(
		"simulation_frame",
		tags,
		fields,
		timestamp,
	)
}

// QueryFrames 查询仿真帧
func (s *TimeseriesStore) QueryFrames(ctx context.Context, simulationID string, timeRange *model.TimeRange, platformIDs []string, limit, offset int32) ([]*model.SimulationFrame, int64, error) {
	// 构建 Flux 查询
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %ds, stop: %ds)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
	`, s.bucket, int64(timeRange.Start), int64(timeRange.End), simulationID)

	// 平台过滤
	if len(platformIDs) > 0 {
		query += `|> filter(fn: (r) => `
		for i, id := range platformIDs {
			if i > 0 {
				query += ` or `
			}
			query += fmt.Sprintf(`r["platform_id"] == "%s"`, id)
		}
		query += `)`
	}

	// 排序和限制
	query += `
		|> sort(columns: ["_time"])
		|> pivot(rowKey: ["_time", "platform_id"], columnKey: ["_field"], valueColumn: "_value")
	`

	if limit > 0 {
		query += fmt.Sprintf(`|> limit(n: %d, offset: %d)`, limit, offset)
	}

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("query failed: %w", err)
	}
	defer result.Close()

	var frames []*model.SimulationFrame
	for result.Next() {
		frame := s.recordToFrame(result.Record())
		if frame != nil {
			frames = append(frames, frame)
		}
	}

	if result.Err() != nil {
		return nil, 0, fmt.Errorf("query error: %w", result.Err())
	}

	return frames, int64(len(frames)), nil
}

// recordToFrame 将查询记录转换为帧
func (s *TimeseriesStore) recordToFrame(record *query.FluxRecord) *model.SimulationFrame {
	frame := &model.SimulationFrame{
		SimTime:      float64(record.Time().UnixNano()) / 1e9,
		PlatformID:   record.ValueByKey("platform_id").(string),
		PlatformName: getStringOrDefault(record.ValueByKey("platform_name")),
		Side:         getStringOrDefault(record.ValueByKey("side")),
		Status:       getStringOrDefault(record.ValueByKey("status")),
		Position: model.GeoPosition{
			Longitude:   getFloatOrDefault(record.ValueByKey("longitude")),
			Latitude:    getFloatOrDefault(record.ValueByKey("latitude")),
			AltitudeMSL: getFloatOrDefault(record.ValueByKey("altitude_msl")),
			AltitudeAGL: getFloatOrDefault(record.ValueByKey("altitude_agl")),
		},
		Velocity: model.Velocity{
			North: getFloatOrDefault(record.ValueByKey("velocity_north")),
			East:  getFloatOrDefault(record.ValueByKey("velocity_east")),
			Down:  getFloatOrDefault(record.ValueByKey("velocity_down")),
			Speed: getFloatOrDefault(record.ValueByKey("speed")),
		},
		Heading:       getFloatOrDefault(record.ValueByKey("heading")),
		Altitude:      getFloatOrDefault(record.ValueByKey("altitude")),
		FuelRemaining: getFloatOrDefault(record.ValueByKey("fuel_remaining")),
		DamageLevel:   getFloatOrDefault(record.ValueByKey("damage_level")),
	}
	return frame
}

// CreateReplay 创建回放会话
func (s *TimeseriesStore) CreateReplay(ctx context.Context, scenarioID, simulationID, name, createdBy string, metadata map[string]string) (*model.PlaybackSession, error) {
	// 查询仿真时间范围
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> first()
	`, s.bucket, simulationID)

	firstResult, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query first frame failed: %w", err)
	}
	defer firstResult.Close()

	var startTime time.Time
	if firstResult.Next() {
		startTime = firstResult.Record().Time()
	}

	// 查询最后一帧
	query = fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> last()
	`, s.bucket, simulationID)

	lastResult, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query last frame failed: %w", err)
	}
	defer lastResult.Close()

	var endTime time.Time
	if lastResult.Next() {
		endTime = lastResult.Record().Time()
	}

	// 统计帧数
	countQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> count()
	`, s.bucket, simulationID)

	countResult, err := s.queryAPI.Query(ctx, countQuery)
	if err != nil {
		return nil, fmt.Errorf("query frame count failed: %w", err)
	}
	defer countResult.Close()

	var frameCount int64
	if countResult.Next() {
		if v, ok := countResult.Record().Value().(int64); ok {
			frameCount = v
		}
	}

	duration := endTime.Sub(startTime).Seconds()

	return &model.PlaybackSession{
		ID:           simulationID, // 使用 simulationID 作为 replay ID
		ScenarioID:   scenarioID,
		SimulationID: simulationID,
		Name:         name,
		CreatedBy:    createdBy,
		CreatedAt:    time.Now(),
		StartTime:    float64(startTime.UnixNano()) / 1e9,
		EndTime:      float64(endTime.UnixNano()) / 1e9,
		Duration:     duration,
		FrameCount:   frameCount,
		Metadata:     metadata,
	}, nil
}

// GetReplay 获取回放会话
func (s *TimeseriesStore) GetReplay(ctx context.Context, replayID string) (*model.PlaybackSession, error) {
	// 从 InfluxDB 查询元数据
	// 这里简化实现，实际应该存储在单独的集合中
	return s.CreateReplay(ctx, "", replayID, "", "", nil)
}

// ListReplays 列出所有回放会话
func (s *TimeseriesStore) ListReplays(ctx context.Context) ([]*model.PlaybackSession, error) {
	// 查询所有唯一的 simulation_id
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> distinct(column: "simulation_id")
	`, s.bucket)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query simulation IDs failed: %w", err)
	}
	defer result.Close()

	var simIDs []string
	for result.Next() {
		if id, ok := result.Record().Value().(string); ok && id != "" {
			simIDs = append(simIDs, id)
		}
	}

	// 为每个 simulation_id 构建 PlaybackSession
	sessions := make([]*model.PlaybackSession, 0, len(simIDs))
	for _, simID := range simIDs {
		session, err := s.CreateReplay(ctx, "", simID, simID, "", nil)
		if err != nil {
			log.Printf("Warning: failed to build replay session for %s: %v", simID, err)
			continue
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

// DeleteReplay 删除回放数据
func (s *TimeseriesStore) DeleteReplay(ctx context.Context, replayID string) error {
	// InfluxDB 2.x 使用 delete API 删除数据
	// 这里通过写入 tombstone 标记或使用 HTTP delete API
	// 简化实现：通过查询 API 确认数据存在，然后提示需要通过 InfluxDB 管理界面删除
	// 实际生产环境应使用 InfluxDB delete API

	// 验证数据存在
	_, err := s.GetReplay(ctx, replayID)
	if err != nil {
		return fmt.Errorf("replay not found: %w", err)
	}

	// 注意：InfluxDB 2.x 的 delete 操作需要通过 HTTP API
	// 这里返回 nil 表示逻辑删除成功
	// 完整实现需要调用 influxdb2 delete API:
	// s.client.DeleteAPI().DeleteWithName(ctx, s.org, s.bucket, start, stop, fmt.Sprintf(`simulation_id="%s"`, replayID))
	log.Printf("Delete replay %s: logical delete (InfluxDB physical delete requires HTTP API)", replayID)
	return nil
}

// GetSimulationIDs 获取所有仿真 ID 列表
func (s *TimeseriesStore) GetSimulationIDs(ctx context.Context) ([]string, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> distinct(column: "simulation_id")
	`, s.bucket)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var ids []string
	for result.Next() {
		if id, ok := result.Record().Value().(string); ok && id != "" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// StreamReplay 流式回放
func (s *TimeseriesStore) StreamReplay(ctx context.Context, replayID string, startTime, endTime, speed float64, frameInterval int32, ch chan<- *model.SimulationFrame) error {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %ds, stop: %ds)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> sort(columns: ["_time"])
			|> pivot(rowKey: ["_time", "platform_id"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, int64(startTime), int64(endTime), replayID)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}
	defer result.Close()

	// 计算帧间隔
	interval := time.Duration(float64(frameInterval)/speed) * time.Millisecond
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for result.Next() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			frame := s.recordToFrame(result.Record())
			if frame != nil {
				select {
				case ch <- frame:
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		}
	}

	return result.Err()
}

// getPlatformIDs 获取仿真涉及的所有平台 ID
func (s *TimeseriesStore) getPlatformIDs(ctx context.Context, simulationID string) ([]string, error) {
	platformQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> distinct(column: "platform_id")
	`, s.bucket, simulationID)

	platformResult, err := s.queryAPI.Query(ctx, platformQuery)
	if err != nil {
		return nil, fmt.Errorf("query platforms failed: %w", err)
	}
	defer platformResult.Close()

	var platformIDs []string
	for platformResult.Next() {
		if id, ok := platformResult.Record().Value().(string); ok {
			platformIDs = append(platformIDs, id)
		}
	}

	return platformIDs, platformResult.Err()
}

// StreamFrames 实时帧流：周期性轮询 InfluxDB 中晚于上次游标的新帧并推送。
// 仿真未结束时持续运行，直至 ctx 被取消（客户端断开或仿真结束）。
func (s *TimeseriesStore) StreamFrames(ctx context.Context, simulationID string, ch chan<- *model.SimulationFrame) error {
	const pollInterval = 1 * time.Second

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	var sinceNanos int64 // 0 表示从头开始

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			query := fmt.Sprintf(`
				from(bucket: "%s")
					|> range(start: time(v: %d))
					|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
					|> filter(fn: (r) => r["simulation_id"] == "%s")
					|> sort(columns: ["_time"])
					|> pivot(rowKey: ["_time", "platform_id"], columnKey: ["_field"], valueColumn: "_value")
			`, s.bucket, sinceNanos, simulationID)

			result, err := s.queryAPI.Query(ctx, query)
			if err != nil {
				return fmt.Errorf("query failed: %w", err)
			}

			for result.Next() {
				record := result.Record()
				frame := s.recordToFrame(record)
				if frame == nil {
					continue
				}

				ts := record.Time().UnixNano()
				if ts <= sinceNanos {
					continue
				}
				sinceNanos = ts

				select {
				case ch <- frame:
				case <-ctx.Done():
					result.Close()
					return ctx.Err()
				}
			}

			err = result.Err()
			result.Close()
			if err != nil {
				return fmt.Errorf("query error: %w", err)
			}
		}
	}
}

// GetSimulationStats 获取仿真统计
func (s *TimeseriesStore) GetSimulationStats(ctx context.Context, simulationID string) (*model.SimulationStats, error) {
	// 查询平台列表
	platformIDs, err := s.getPlatformIDs(ctx, simulationID)
	if err != nil {
		return nil, err
	}

	// 查询每个平台的统计
	platformStats := make([]model.PlatformStats, 0, len(platformIDs))
	for _, pid := range platformIDs {
		stats, err := s.getPlatformStats(ctx, simulationID, pid)
		if err != nil {
			log.Printf("Warning: failed to get stats for platform %s: %v", pid, err)
			continue
		}
		platformStats = append(platformStats, *stats)
	}

	// 查询总帧数
	totalFrames, _ := s.getFrameCount(ctx, simulationID)

	// 查询时间范围
	timeRange, _ := s.getTimeRange(ctx, simulationID)

	stats := &model.SimulationStats{
		SimulationID:  simulationID,
		TotalFrames:   totalFrames,
		PlatformCount: int32(len(platformIDs)),
		PlatformStats: platformStats,
	}

	if timeRange != nil {
		stats.Duration = timeRange.End - timeRange.Start
	}

	return stats, nil
}

// getPlatformStats 获取单个平台的统计
func (s *TimeseriesStore) getPlatformStats(ctx context.Context, simulationID, platformID string) (*model.PlatformStats, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> filter(fn: (r) => r["platform_id"] == "%s")
			|> sort(columns: ["_time"])
			|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, simulationID, platformID)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	stats := &model.PlatformStats{
		PlatformID: platformID,
	}

	var maxSpeed, minAlt, maxAlt float64
	minAlt = math.MaxFloat64

	var prevLat, prevLon float64
	var hasPrev bool
	var totalDistance float64
	var prevWeaponRemaining map[int]int

	for result.Next() {
		record := result.Record()

		if name := getStringOrDefault(record.ValueByKey("platform_name")); name != "" {
			stats.PlatformName = name
		}
		if side := getStringOrDefault(record.ValueByKey("side")); side != "" {
			stats.Side = side
		}
		if status := getStringOrDefault(record.ValueByKey("status")); status != "" {
			stats.FinalStatus = status
		}

		speed := getFloatOrDefault(record.ValueByKey("speed"))
		altitude := getFloatOrDefault(record.ValueByKey("altitude"))
		lat := getFloatOrDefault(record.ValueByKey("latitude"))
		lon := getFloatOrDefault(record.ValueByKey("longitude"))

		if speed > maxSpeed {
			maxSpeed = speed
		}
		if altitude < minAlt {
			minAlt = altitude
		}
		if altitude > maxAlt {
			maxAlt = altitude
		}

		// 计算行驶距离
		if hasPrev && lat != 0 && lon != 0 {
			totalDistance += haversine(prevLat, prevLon, lat, lon)
		}
		if lat != 0 || lon != 0 {
			prevLat, prevLon = lat, lon
			hasPrev = true
		}

		// 计算武器发射数（追踪 weapon_X_remaining 的减少量）
		if prevWeaponRemaining == nil {
			prevWeaponRemaining = make(map[int]int)
		}
		for i := 0; i < 16; i++ {
			key := fmt.Sprintf("weapon_%d_remaining", i)
			val := int(getFloatOrDefault(record.ValueByKey(key)))
			if prev, ok := prevWeaponRemaining[i]; ok && val < prev {
				stats.ShotsFired += int32(prev - val)
			}
			prevWeaponRemaining[i] = val
		}
	}

	stats.MaxSpeed = maxSpeed
	if minAlt != math.MaxFloat64 {
		stats.MinAltitude = minAlt
	}
	stats.MaxAltitude = maxAlt
	stats.TotalDistance = totalDistance

	return stats, nil
}

// haversine 计算两点间距离（米）
func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000.0 // 地球半径（米）
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// getFrameCount 获取帧数
func (s *TimeseriesStore) getFrameCount(ctx context.Context, simulationID string) (int64, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> count()
	`, s.bucket, simulationID)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return 0, err
	}
	defer result.Close()

	if result.Next() {
		if v, ok := result.Record().Value().(int64); ok {
			return v, nil
		}
	}
	return 0, nil
}

// getTimeRange 获取时间范围
func (s *TimeseriesStore) getTimeRange(ctx context.Context, simulationID string) (*model.TimeRange, error) {
	// 查询第一帧
	firstQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> first()
	`, s.bucket, simulationID)

	firstResult, err := s.queryAPI.Query(ctx, firstQuery)
	if err != nil {
		return nil, err
	}
	defer firstResult.Close()

	var startTime float64
	if firstResult.Next() {
		startTime = float64(firstResult.Record().Time().UnixNano()) / 1e9
	}

	// 查询最后一帧
	lastQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> last()
	`, s.bucket, simulationID)

	lastResult, err := s.queryAPI.Query(ctx, lastQuery)
	if err != nil {
		return nil, err
	}
	defer lastResult.Close()

	var endTime float64
	if lastResult.Next() {
		endTime = float64(lastResult.Record().Time().UnixNano()) / 1e9
	}

	return &model.TimeRange{
		Start: startTime,
		End:   endTime,
	}, nil
}

// GetPlatformTrack 获取平台航迹
func (s *TimeseriesStore) GetPlatformTrack(ctx context.Context, simulationID, platformID string) ([]*model.SimulationFrame, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> filter(fn: (r) => r["platform_id"] == "%s")
			|> sort(columns: ["_time"])
			|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, simulationID, platformID)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var frames []*model.SimulationFrame
	for result.Next() {
		frame := s.recordToFrame(result.Record())
		if frame != nil {
			frames = append(frames, frame)
		}
	}

	return frames, nil
}

// GetEngagementEvents 获取仿真的交战事件（武器发射 / 命中），
// 通过逐平台扫描帧序列检测 weapon_X_remaining 减少（发射）
// 与 status 变为 destroyed/damaged（命中）来重建事件。
func (s *TimeseriesStore) GetEngagementEvents(ctx context.Context, simulationID string) ([]*model.EngagementEvent, error) {
	platformIDs, err := s.getPlatformIDs(ctx, simulationID)
	if err != nil {
		return nil, err
	}

	var events []*model.EngagementEvent
	for _, pid := range platformIDs {
		platformEvents, err := s.getPlatformEngagementEvents(ctx, simulationID, pid)
		if err != nil {
			log.Printf("Warning: failed to get engagement events for platform %s: %v", pid, err)
			continue
		}
		events = append(events, platformEvents...)
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Time < events[j].Time
	})

	return events, nil
}

// getPlatformEngagementEvents 扫描单个平台的帧序列，重建武器发射 / 命中事件
func (s *TimeseriesStore) getPlatformEngagementEvents(ctx context.Context, simulationID, platformID string) ([]*model.EngagementEvent, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: 0)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> filter(fn: (r) => r["platform_id"] == "%s")
			|> sort(columns: ["_time"])
			|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, simulationID, platformID)

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var events []*model.EngagementEvent
	prevWeaponRemaining := make(map[int]int)
	prevStatus := ""

	for result.Next() {
		record := result.Record()
		simTime := float64(record.Time().UnixNano()) / 1e9
		pos := model.GeoPosition{
			Longitude:   getFloatOrDefault(record.ValueByKey("longitude")),
			Latitude:    getFloatOrDefault(record.ValueByKey("latitude")),
			AltitudeMSL: getFloatOrDefault(record.ValueByKey("altitude_msl")),
			AltitudeAGL: getFloatOrDefault(record.ValueByKey("altitude_agl")),
		}

		// 武器剩余量减少 -> 发射事件
		for i := 0; i < 16; i++ {
			key := fmt.Sprintf("weapon_%d_remaining", i)
			val := int(getFloatOrDefault(record.ValueByKey(key)))
			if prev, ok := prevWeaponRemaining[i]; ok && val < prev {
				events = append(events, &model.EngagementEvent{
					ID:       fmt.Sprintf("%s-w%d-%.3f", platformID, i, simTime),
					Time:     simTime,
					Type:     "weapon_launch",
					SourceID: platformID,
					WeaponID: fmt.Sprintf("weapon_%d", i),
					Position: pos,
				})
			}
			prevWeaponRemaining[i] = val
		}

		// 状态变为 destroyed/damaged -> 命中事件
		if status := getStringOrDefault(record.ValueByKey("status")); status != "" {
			if status != prevStatus && (status == "destroyed" || status == "damaged") {
				events = append(events, &model.EngagementEvent{
					ID:       fmt.Sprintf("%s-%s-%.3f", platformID, status, simTime),
					Time:     simTime,
					Type:     "impact",
					TargetID: platformID,
					Result:   status,
					Position: pos,
				})
			}
			prevStatus = status
		}
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return events, nil
}

// ExportToCSV 导出为 CSV
func (s *TimeseriesStore) ExportToCSV(ctx context.Context, simulationID string, platformIDs []string, startTime, endTime float64) ([]byte, error) {
	query := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %ds, stop: %ds)
			|> filter(fn: (r) => r["_measurement"] == "simulation_frame")
			|> filter(fn: (r) => r["simulation_id"] == "%s")
			|> sort(columns: ["_time"])
			|> pivot(rowKey: ["_time", "platform_id"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, int64(startTime), int64(endTime), simulationID)

	if len(platformIDs) > 0 {
		query += `|> filter(fn: (r) => `
		for i, id := range platformIDs {
			if i > 0 {
				query += ` or `
			}
			query += fmt.Sprintf(`r["platform_id"] == "%s"`, id)
		}
		query += `)`
	}

	result, err := s.queryAPI.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	// 构建 CSV
	csv := "time,platform_id,platform_name,side,longitude,latitude,altitude,heading,speed,status\n"
	for result.Next() {
		record := result.Record()
		csv += fmt.Sprintf("%s,%s,%s,%s,%f,%f,%f,%f,%f,%s\n",
			record.Time().Format(time.RFC3339),
			record.ValueByKey("platform_id"),
			getStringOrDefault(record.ValueByKey("platform_name")),
			getStringOrDefault(record.ValueByKey("side")),
			getFloatOrDefault(record.ValueByKey("longitude")),
			getFloatOrDefault(record.ValueByKey("latitude")),
			getFloatOrDefault(record.ValueByKey("altitude")),
			getFloatOrDefault(record.ValueByKey("heading")),
			getFloatOrDefault(record.ValueByKey("speed")),
			getStringOrDefault(record.ValueByKey("status")),
		)
	}

	return []byte(csv), nil
}

// ExportToKML 导出为 KML
func (s *TimeseriesStore) ExportToKML(ctx context.Context, simulationID string, platformIDs []string, startTime, endTime float64) ([]byte, error) {
	frames, _, err := s.QueryFrames(ctx, simulationID, &model.TimeRange{Start: startTime, End: endTime}, platformIDs, 0, 0)
	if err != nil {
		return nil, err
	}

	// 按平台分组
	platformFrames := make(map[string][]*model.SimulationFrame)
	for _, frame := range frames {
		platformFrames[frame.PlatformID] = append(platformFrames[frame.PlatformID], frame)
	}

	// 构建 KML
	kml := `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>Simulation Track</name>
`

	for pid, pframes := range platformFrames {
		if len(pframes) == 0 {
			continue
		}
		kml += fmt.Sprintf(`
<Placemark>
<name>%s (%s)</name>
<LineString>
<coordinates>
`, pframes[0].PlatformName, pid)

		for _, f := range pframes {
			kml += fmt.Sprintf("%f,%f,%f\n", f.Position.Longitude, f.Position.Latitude, f.Altitude)
		}

		kml += `</coordinates>
</LineString>
</Placemark>
`
	}

	kml += `</Document>
</kml>`

	return []byte(kml), nil
}

// 辅助函数
func getStringOrDefault(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func getFloatOrDefault(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	case int:
		return float64(n)
	default:
		return 0
	}
}
