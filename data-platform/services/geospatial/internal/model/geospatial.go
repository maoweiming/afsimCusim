package model

// DataSource represents a geospatial data source configuration.
type DataSource struct {
	ID         string            `json:"id" bson:"_id"`
	Name       string            `json:"name" bson:"name"`
	Type       string            `json:"type" bson:"type"` // "wmts", "wms", "tms", "geojson", "czml"
	URL        string            `json:"url" bson:"url"`
	Format     string            `json:"format" bson:"format"`
	Properties map[string]string `json:"properties,omitempty" bson:"properties,omitempty"`
	CreatedAt  string            `json:"created_at" bson:"created_at"`
}

// TerrainMetadata holds metadata about an uploaded terrain dataset.
type TerrainMetadata struct {
	ID         string      `json:"id" bson:"_id"`
	Name       string      `json:"name" bson:"name"`
	Bounds     BoundingBox `json:"bounds" bson:"bounds"`
	MinHeight  float64     `json:"min_height" bson:"min_height"`
	MaxHeight  float64     `json:"max_height" bson:"max_height"`
	Resolution float64     `json:"resolution" bson:"resolution"`
	Format     string      `json:"format" bson:"format"` // "quantized-mesh", "terrain", "geotiff"
	TileCount  int64       `json:"tile_count" bson:"tile_count"`
	SizeBytes  int64       `json:"size_bytes" bson:"size_bytes"`
	CreatedAt  string      `json:"created_at" bson:"created_at"`
}

// VectorLayer represents a geospatial vector layer.
type VectorLayer struct {
	ID       string            `json:"id" bson:"_id"`
	Name     string            `json:"name" bson:"name"`
	Type     string            `json:"type" bson:"type"` // "point", "line", "polygon"
	Source   string            `json:"source" bson:"source"`
	Style    string            `json:"style" bson:"style"` // JSON style definition
	Metadata map[string]string `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

// BoundingBox represents a geographic bounding box.
type BoundingBox struct {
	South float64 `json:"south" bson:"south"`
	West  float64 `json:"west" bson:"west"`
	North float64 `json:"north" bson:"north"`
	East  float64 `json:"east" bson:"east"`
}

// GeoPosition represents a geographic position with altitude.
type GeoPosition struct {
	Longitude float64 `json:"longitude" bson:"longitude"`
	Latitude  float64 `json:"latitude" bson:"latitude"`
	Altitude  float64 `json:"altitude" bson:"altitude"`
}
