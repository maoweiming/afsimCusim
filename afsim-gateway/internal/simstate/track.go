package simstate

import (
	"github.com/truesim/afsim-gateway/internal/proto"
)

// Track represents a sensor track in the simulation state.
type Track struct {
	OriginatorIndex uint64  `json:"originator_index"`
	TrackNumber     uint32  `json:"track_number"`
	TargetIndex     uint64  `json:"target_index"`
	Lat             float64 `json:"lat"`
	Lon             float64 `json:"lon"`
	Alt             float64 `json:"alt"`
	VelN            float64 `json:"vel_n"`
	VelE            float64 `json:"vel_e"`
	VelD            float64 `json:"vel_d"`
	Quality         float32 `json:"quality"`
	IsLocal         bool    `json:"is_local"`
}

// trackFromProto creates a Track from a proto.TrackData.
func trackFromProto(td *proto.TrackData, isLocal bool) *Track {
	trackNum := uint32(0)
	if id := td.GetId(); id != nil {
		trackNum = id.GetTrackNumber()
	}
	return &Track{
		OriginatorIndex: td.GetOriginatorIndex(),
		TrackNumber:     trackNum,
		TargetIndex:     td.GetTargetIndex(),
		Lat:             td.GetLat(),
		Lon:             td.GetLon(),
		Alt:             td.GetAlt(),
		VelN:            td.GetVelN(),
		VelE:            td.GetVelE(),
		VelD:            td.GetVelD(),
		Quality:         td.GetQuality(),
		IsLocal:         isLocal,
	}
}
