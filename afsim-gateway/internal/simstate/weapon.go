package simstate

// WeaponEngagement tracks an active weapon in flight.
type WeaponEngagement struct {
	WeaponPlatformIndex uint64  `json:"weapon_platform_index"`
	FiringPlatformIndex uint64  `json:"firing_platform_index"`
	WeaponName          string  `json:"weapon_name"`
	TargetPlatformIndex uint64  `json:"target_platform_index"`
	Lat                 float64 `json:"lat"`
	Lon                 float64 `json:"lon"`
	Alt                 float64 `json:"alt"`
}
