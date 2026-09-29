module truesim/timeseries

go 1.23

require (
	github.com/google/uuid v1.6.0
	github.com/influxdata/influxdb-client-go/v2 v2.14.0
	google.golang.org/grpc v1.68.0
	google.golang.org/protobuf v1.35.2
	truesim/gen v0.0.0
)

replace truesim/gen => ../../shared/gen

require (
	github.com/andybalholm/brotli v1.1.1 // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/deepmap/oapi-codegen v1.16.3 // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/influxdata/line-protocol v0.0.0-20200327222509-2487e7298839 // indirect
	github.com/klauspost/compress v1.17.11 // indirect
	github.com/oapi-codegen/runtime v1.1.1 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasthttp v1.58.0 // indirect
	golang.org/x/net v0.33.0 // indirect
	golang.org/x/sys v0.28.0 // indirect
	golang.org/x/text v0.21.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20241219192143-6b3ec007d9bb // indirect
	google.golang.org/protobuf v1.35.2 // indirect
)
