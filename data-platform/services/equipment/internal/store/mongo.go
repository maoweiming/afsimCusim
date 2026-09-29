package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"truesim/equipment/internal/model"
)

var (
	ErrNotFound        = errors.New("equipment not found")
	ErrAlreadyExists   = errors.New("equipment already exists")
	ErrOptimisticLock  = errors.New("optimistic lock failed")
)

const (
	connectTimeout  = 10 * time.Second
	queryTimeout    = 5 * time.Second
	collectionName  = "equipment"
)

// EquipmentStore provides MongoDB persistence for equipment data.
type EquipmentStore struct {
	client     *mongo.Client
	db         *mongo.Database
	collection *mongo.Collection
}

// NewEquipmentStore creates a new MongoDB-backed store.
// It connects to the database and ensures indexes are created.
func NewEquipmentStore(ctx context.Context, uri, dbName string) (*EquipmentStore, error) {
	ctx, cancel := context.WithTimeout(ctx, connectTimeout)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}

	// Verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	db := client.Database(dbName)
	coll := db.Collection(collectionName)

	store := &EquipmentStore{
		client:     client,
		db:         db,
		collection: coll,
	}

	if err := store.ensureIndexes(ctx); err != nil {
		return nil, fmt.Errorf("ensure indexes: %w", err)
	}

	return store, nil
}

// ensureIndexes creates the required MongoDB indexes.
func (s *EquipmentStore) ensureIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "code", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "category", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "tags", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "name", Value: "text"}, {Key: "description", Value: "text"}},
		},
	}

	_, err := s.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Close disconnects from MongoDB.
func (s *EquipmentStore) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}

// Create inserts a new equipment document.
func (s *EquipmentStore) Create(ctx context.Context, eq *model.Equipment) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	// Check for duplicate code
	count, err := s.collection.CountDocuments(ctx, bson.M{"_id": eq.ID})
	if err != nil {
		return fmt.Errorf("check duplicate: %w", err)
	}
	if count > 0 {
		return ErrAlreadyExists
	}

	_, err = s.collection.InsertOne(ctx, eq)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ErrAlreadyExists
		}
		return fmt.Errorf("insert: %w", err)
	}
	return nil
}

// Get retrieves an equipment by ID.
func (s *EquipmentStore) Get(ctx context.Context, id string) (*model.Equipment, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var eq model.Equipment
	err := s.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&eq)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("find: %w", err)
	}
	return &eq, nil
}

// Update replaces an equipment document. Uses optimistic concurrency via version field.
func (s *EquipmentStore) Update(ctx context.Context, eq *model.Equipment) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	oldVersion := eq.Version
	eq.Version++
	eq.UpdatedAt = time.Now()

	result, err := s.collection.ReplaceOne(
		ctx,
		bson.M{"_id": eq.ID, "version": oldVersion},
		eq,
	)
	if err != nil {
		return fmt.Errorf("replace: %w", err)
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("%w: version mismatch for %s (expected %d)", ErrOptimisticLock, eq.ID, oldVersion)
	}
	return nil
}

// Delete removes an equipment by ID.
func (s *EquipmentStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	result, err := s.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("delete: %w", err)
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// List returns a paginated list of equipment matching the given filters.
func (s *EquipmentStore) List(ctx context.Context, filter model.EquipmentFilter, page, pageSize int32) ([]model.Equipment, int32, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	mongoFilter := buildFilter(filter)

	// Count total
	total, err := s.collection.CountDocuments(ctx, mongoFilter)
	if err != nil {
		return nil, 0, fmt.Errorf("count: %w", err)
	}

	// Apply pagination
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	skip := int64((page - 1) * pageSize)
	limit := int64(pageSize)

	opts := options.Find().
		SetSkip(skip).
		SetLimit(limit).
		SetSort(bson.D{{Key: "updated_at", Value: -1}})

	cursor, err := s.collection.Find(ctx, mongoFilter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("find: %w", err)
	}
	defer cursor.Close(ctx)

	var results []model.Equipment
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, fmt.Errorf("decode: %w", err)
	}

	return results, int32(total), nil
}

// UpdateSubsystems updates only the sensor/weapon/comm arrays of an equipment.
func (s *EquipmentStore) UpdateSubsystems(ctx context.Context, id string, update bson.M) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	update["updated_at"] = time.Now()
	result, err := s.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": update, "$inc": bson.M{"version": 1}},
	)
	if err != nil {
		return fmt.Errorf("update subsystems: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// buildFilter constructs a MongoDB filter from the model filter.
func buildFilter(f model.EquipmentFilter) bson.M {
	m := bson.M{}

	if f.Category != "" {
		m["category"] = f.Category
	}
	if f.Status != "" {
		m["status"] = f.Status
	}
	if len(f.Tags) > 0 {
		m["tags"] = bson.M{"$all": f.Tags}
	}
	if f.Search != "" {
		m["$text"] = bson.M{"$search": f.Search}
	}

	return m
}
