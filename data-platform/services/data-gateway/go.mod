module truesim/data-gateway

go 1.23

require (
	github.com/gorilla/mux v1.8.1
	github.com/rs/cors v1.11.0
	google.golang.org/grpc v1.68.0
	google.golang.org/protobuf v1.35.2
	truesim/equipment v0.0.0
	truesim/gen v0.0.0
)

replace (
	truesim/equipment => ../equipment
	truesim/gen => ../../shared/gen
)
