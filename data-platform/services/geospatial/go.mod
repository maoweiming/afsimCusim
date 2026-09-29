module truesim/geospatial

go 1.23

require (
	truesim/gen v0.0.0
	google.golang.org/grpc v1.68.0
	google.golang.org/protobuf v1.35.2
)

replace truesim/gen => ../../shared/gen
