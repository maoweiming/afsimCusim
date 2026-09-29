package service

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "truesim/gen/pb/geospatial"
)

// GeospatialServer implements the GeospatialService gRPC server.
// This is a stub implementation that returns "not implemented" for all methods.
type GeospatialServer struct {
	pb.UnimplementedGeospatialServiceServer
}

// NewGeospatialServer creates a new GeospatialServer.
func NewGeospatialServer() *GeospatialServer {
	return &GeospatialServer{}
}

// AddDataSource adds a new geospatial data source.
func (s *GeospatialServer) AddDataSource(ctx context.Context, req *pb.AddSourceRequest) (*pb.DataSource, error) {
	return nil, status.Errorf(codes.Unimplemented, "method AddDataSource not implemented")
}

// RemoveDataSource removes a geospatial data source by ID.
func (s *GeospatialServer) RemoveDataSource(ctx context.Context, req *pb.RemoveSourceRequest) (*pb.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "method RemoveDataSource not implemented")
}

// ListDataSources lists all registered geospatial data sources.
func (s *GeospatialServer) ListDataSources(ctx context.Context, req *pb.ListSourcesRequest) (*pb.ListSourcesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListDataSources not implemented")
}

// UploadTerrain uploads terrain data and returns metadata.
func (s *GeospatialServer) UploadTerrain(ctx context.Context, req *pb.UploadTerrainRequest) (*pb.TerrainMetadata, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UploadTerrain not implemented")
}

// GetTerrainHeight returns the terrain height at a given position.
func (s *GeospatialServer) GetTerrainHeight(ctx context.Context, req *pb.GetHeightRequest) (*pb.HeightResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetTerrainHeight not implemented")
}

// ComputeLOS computes line-of-sight between two positions.
func (s *GeospatialServer) ComputeLOS(ctx context.Context, req *pb.ComputeLOSRequest) (*pb.LOSResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ComputeLOS not implemented")
}
