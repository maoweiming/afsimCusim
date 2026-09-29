package collab

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// CollabEvent 协同事件
type CollabEvent struct {
	Type      string `json:"type"`
	UserID    string `json:"user_id"`
	Timestamp int64  `json:"timestamp"`
	Payload   string `json:"payload"`
}

// User 协同用户
type User struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	JoinedAt time.Time `json:"joined_at"`
}

// Lock 对象锁
type Lock struct {
	ObjectID   string    `json:"object_id"`
	ObjectType string    `json:"object_type"`
	UserID     string    `json:"user_id"`
	LockType   string    `json:"lock_type"` // edit, move, delete
	AcquiredAt time.Time `json:"acquired_at"`
}

// Room 协同房间
type Room struct {
	ScenarioID string          `json:"scenario_id"`
	Branch     string          `json:"branch"`
	Users      map[string]*User `json:"users"`
	Locks      map[string]*Lock `json:"locks"` // key: objectID
	mu         sync.RWMutex
	eventChans map[string]chan *CollabEvent // userID -> event channel
}

// CollabManager 协同管理器
type CollabManager struct {
	rooms sync.Map // map[string]*Room, key: scenarioID
	redis *redis.Client
}

// NewCollabManager 创建协同管理器
func NewCollabManager(redisClient *redis.Client) *CollabManager {
	return &CollabManager{
		redis: redisClient,
	}
}

// getRoomKey 生成房间 key
func getRoomKey(scenarioID, branch string) string {
	return fmt.Sprintf("%s:%s", scenarioID, branch)
}

// JoinRoom 加入协同房间
func (m *CollabManager) JoinRoom(scenarioID, branch, userID, userName string) (*Room, <-chan *CollabEvent, error) {
	key := getRoomKey(scenarioID, branch)

	// 获取或创建房间
	val, _ := m.rooms.LoadOrStore(key, &Room{
		ScenarioID: scenarioID,
		Branch:     branch,
		Users:      make(map[string]*User),
		Locks:      make(map[string]*Lock),
		eventChans: make(map[string]chan *CollabEvent),
	})
	room := val.(*Room)

	room.mu.Lock()
	defer room.mu.Unlock()

	// 检查用户是否已在房间
	if _, exists := room.Users[userID]; exists {
		return room, room.eventChans[userID], nil
	}

	// 创建事件通道
	eventChan := make(chan *CollabEvent, 100)
	room.eventChans[userID] = eventChan

	// 添加用户
	room.Users[userID] = &User{
		ID:       userID,
		Name:     userName,
		JoinedAt: time.Now(),
	}

	// 广播用户加入事件
	m.broadcastToRoom(room, &CollabEvent{
		Type:      "user_joined",
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
	})

	// 在 Redis 中记录用户在线状态
	if m.redis != nil {
		ctx := context.Background()
		m.redis.SAdd(ctx, fmt.Sprintf("collab:room:%s:users", key), userID)
		m.redis.Set(ctx, fmt.Sprintf("collab:user:%s:heartbeat", userID), time.Now().UnixMilli(), 30*time.Second)
	}

	log.Printf("User %s joined room %s", userID, key)
	return room, eventChan, nil
}

// LeaveRoom 离开协同房间
func (m *CollabManager) LeaveRoom(scenarioID, branch, userID string) error {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return fmt.Errorf("room not found: %s", key)
	}
	room := val.(*Room)

	room.mu.Lock()
	defer room.mu.Unlock()

	// 释放该用户的所有锁
	for objectID, lock := range room.Locks {
		if lock.UserID == userID {
			delete(room.Locks, objectID)
		}
	}

	// 关闭事件通道
	if ch, exists := room.eventChans[userID]; exists {
		close(ch)
		delete(room.eventChans, userID)
	}

	// 移除用户
	delete(room.Users, userID)

	// 广播用户离开事件
	m.broadcastToRoom(room, &CollabEvent{
		Type:      "user_left",
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
	})

	// 从 Redis 中移除用户
	if m.redis != nil {
		ctx := context.Background()
		m.redis.SRem(ctx, fmt.Sprintf("collab:room:%s:users", key), userID)
		m.redis.Del(ctx, fmt.Sprintf("collab:user:%s:heartbeat", userID))
	}

	// 如果房间为空，删除房间
	if len(room.Users) == 0 {
		m.rooms.Delete(key)
	}

	log.Printf("User %s left room %s", userID, key)
	return nil
}

// Broadcast 广播事件到房间
func (m *CollabManager) Broadcast(scenarioID, branch string, event *CollabEvent) error {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return fmt.Errorf("room not found: %s", key)
	}
	room := val.(*Room)

	m.broadcastToRoom(room, event)

	// 通过 Redis Pub/Sub 广播到其他实例
	if m.redis != nil {
		ctx := context.Background()
		data, _ := json.Marshal(event)
		m.redis.Publish(ctx, fmt.Sprintf("collab:room:%s:events", key), data)
	}

	return nil
}

// broadcastToRoom 内部广播到房间所有用户
func (m *CollabManager) broadcastToRoom(room *Room, event *CollabEvent) {
	room.mu.RLock()
	defer room.mu.RUnlock()

	for userID, ch := range room.eventChans {
		select {
		case ch <- event:
		default:
			log.Printf("Warning: event channel full for user %s, dropping event", userID)
		}
	}
}

// AcquireLock 获取对象锁
func (m *CollabManager) AcquireLock(scenarioID, branch, objectID, objectType, userID, lockType string) (bool, string, error) {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return false, "", fmt.Errorf("room not found: %s", key)
	}
	room := val.(*Room)

	room.mu.Lock()
	defer room.mu.Unlock()

	// 检查锁是否已被其他用户持有
	if lock, exists := room.Locks[objectID]; exists {
		if lock.UserID != userID {
			return false, lock.UserID, nil
		}
		// 同一用户已持有锁
		return true, userID, nil
	}

	// 获取锁
	room.Locks[objectID] = &Lock{
		ObjectID:   objectID,
		ObjectType: objectType,
		UserID:     userID,
		LockType:   lockType,
		AcquiredAt: time.Now(),
	}

	// 广播锁获取事件
	m.broadcastToRoom(room, &CollabEvent{
		Type:      "lock_acquired",
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
		Payload:   fmt.Sprintf(`{"object_id":"%s","object_type":"%s","lock_type":"%s"}`, objectID, objectType, lockType),
	})

	// 在 Redis 中记录锁
	if m.redis != nil {
		ctx := context.Background()
		lockData, _ := json.Marshal(room.Locks[objectID])
		m.redis.Set(ctx, fmt.Sprintf("collab:lock:%s:%s", key, objectID), lockData, 5*time.Minute)
	}

	return true, userID, nil
}

// ReleaseLock 释放对象锁
func (m *CollabManager) ReleaseLock(scenarioID, branch, objectID, userID string) error {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return fmt.Errorf("room not found: %s", key)
	}
	room := val.(*Room)

	room.mu.Lock()
	defer room.mu.Unlock()

	lock, exists := room.Locks[objectID]
	if !exists {
		return nil // 锁已释放
	}

	if lock.UserID != userID {
		return fmt.Errorf("lock owned by another user: %s", lock.UserID)
	}

	delete(room.Locks, objectID)

	// 广播锁释放事件
	m.broadcastToRoom(room, &CollabEvent{
		Type:      "lock_released",
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
		Payload:   fmt.Sprintf(`{"object_id":"%s"}`, objectID),
	})

	// 从 Redis 中移除锁
	if m.redis != nil {
		ctx := context.Background()
		m.redis.Del(ctx, fmt.Sprintf("collab:lock:%s:%s", key, objectID))
	}

	return nil
}

// SendOperation 发送操作（OT 协同）
func (m *CollabManager) SendOperation(scenarioID, branch string, operation *Operation) (*OperationAck, error) {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return nil, fmt.Errorf("room not found: %s", key)
	}
	room := val.(*Room)

	// 广播操作到房间其他用户
	m.broadcastToRoom(room, &CollabEvent{
		Type:      "operation",
		UserID:    operation.UserID,
		Timestamp: time.Now().UnixMilli(),
		Payload:   mustMarshal(operation),
	})

	return &OperationAck{
		OperationID: operation.ID,
		Success:     true,
	}, nil
}

// Operation 操作
type Operation struct {
	ID          string           `json:"id"`
	UserID      string           `json:"user_id"`
	Timestamp   int64            `json:"timestamp"`
	Type        string           `json:"type"`
	Path        string           `json:"path"`
	OldValue    string           `json:"old_value"`
	NewValue    string           `json:"new_value"`
	VectorClock map[string]int64 `json:"vector_clock"`
}

// OperationAck 操作确认
type OperationAck struct {
	OperationID    string       `json:"operation_id"`
	Success        bool         `json:"success"`
	TransformedOps []*Operation `json:"transformed_ops,omitempty"`
	Error          string       `json:"error,omitempty"`
}

// GetRoomUsers 获取房间用户列表
func (m *CollabManager) GetRoomUsers(scenarioID, branch string) ([]*User, error) {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return nil, nil
	}
	room := val.(*Room)

	room.mu.RLock()
	defer room.mu.RUnlock()

	users := make([]*User, 0, len(room.Users))
	for _, user := range room.Users {
		users = append(users, user)
	}
	return users, nil
}

// GetRoomLocks 获取房间锁列表
func (m *CollabManager) GetRoomLocks(scenarioID, branch string) ([]*Lock, error) {
	key := getRoomKey(scenarioID, branch)

	val, ok := m.rooms.Load(key)
	if !ok {
		return nil, nil
	}
	room := val.(*Room)

	room.mu.RLock()
	defer room.mu.RUnlock()

	locks := make([]*Lock, 0, len(room.Locks))
	for _, lock := range room.Locks {
		locks = append(locks, lock)
	}
	return locks, nil
}

// mustMarshal JSON 序列化
func mustMarshal(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(data)
}
