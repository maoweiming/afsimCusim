package model

import (
	"time"

	pb "truesim/equipment/pb"
)

// EquipmentToProto converts a model.Equipment to a pb.Equipment.
func EquipmentToProto(eq *Equipment) *pb.Equipment {
	if eq == nil {
		return nil
	}

	p := &pb.Equipment{
		Id:           eq.ID,
		Code:         eq.Code,
		Name:         eq.Name,
		NameEn:       eq.NameEN,
		Category:     eq.Category,
		PlatformType: eq.PlatformType,
		Description:  eq.Description,
		Version:      eq.Version,
		Status:       eq.Status,
		Country:      eq.Country,
		Manufacturer: eq.Manufacturer,
		Domain:       eq.Domain,
		VersionTag:   eq.VersionTag,
		Tags:         eq.Tags,
		CreatedBy:    eq.CreatedBy,
		UpdatedBy:    eq.UpdatedBy,
		CreatedAt:    eq.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    eq.UpdatedAt.Format(time.RFC3339),
		RawConfig:    eq.RawConfig,
	}

	// Platform params
	p.PlatformParams = PlatformParamsToProto(&eq.PlatformParams)

	// Inline sensors
	if len(eq.Sensors) > 0 {
		sensors := make([]*pb.SensorConfig, len(eq.Sensors))
		for i := range eq.Sensors {
			sensors[i] = SensorConfigToProto(&eq.Sensors[i])
		}
		p.Sensors = sensors
	}

	// Inline weapons
	if len(eq.Weapons) > 0 {
		weapons := make([]*pb.WeaponConfig, len(eq.Weapons))
		for i := range eq.Weapons {
			weapons[i] = WeaponConfigToProto(&eq.Weapons[i])
		}
		p.Weapons = weapons
	}

	// Inline communications
	if len(eq.Communications) > 0 {
		comms := make([]*pb.CommConfig, len(eq.Communications))
		for i := range eq.Communications {
			comms[i] = CommConfigToProto(&eq.Communications[i])
		}
		p.Communications = comms
	}

	// Signature params
	p.SignatureParams = SignatureParamsToProto(&eq.SignatureParams)

	// Mover
	if eq.Mover != nil {
		p.Mover = MoverConfigToProto(eq.Mover)
	}

	// Processors
	if len(eq.Processors) > 0 {
		processors := make([]*pb.ProcessorConfig, len(eq.Processors))
		for i := range eq.Processors {
			processors[i] = ProcessorConfigToProto(&eq.Processors[i])
		}
		p.Processors = processors
	}

	// Fuel
	if eq.Fuel != nil {
		p.Fuel = FuelConfigToProto(eq.Fuel)
	}

	// Deprecated ID-only references for backward compatibility
	sensorIDs := make([]string, len(eq.Sensors))
	for i, s := range eq.Sensors {
		sensorIDs[i] = s.ID
	}
	p.SensorIds = sensorIDs

	weaponIDs := make([]string, len(eq.Weapons))
	for i, w := range eq.Weapons {
		weaponIDs[i] = w.ID
	}
	p.WeaponIds = weaponIDs

	commIDs := make([]string, len(eq.Communications))
	for i, c := range eq.Communications {
		commIDs[i] = c.ID
	}
	p.CommIds = commIDs

	return p
}

// EquipmentFromProto converts a pb.Equipment to a model.Equipment.
func EquipmentFromProto(p *pb.Equipment) *Equipment {
	if p == nil {
		return nil
	}

	eq := &Equipment{
		ID:           p.GetId(),
		Code:         p.GetCode(),
		Name:         p.GetName(),
		NameEN:       p.GetNameEn(),
		Category:     p.GetCategory(),
		PlatformType: p.GetPlatformType(),
		Description:  p.GetDescription(),
		Version:      p.GetVersion(),
		Status:       p.GetStatus(),
		Country:      p.GetCountry(),
		Manufacturer: p.GetManufacturer(),
		Domain:       p.GetDomain(),
		VersionTag:   p.GetVersionTag(),
		Tags:         p.GetTags(),
		CreatedBy:    p.GetCreatedBy(),
		UpdatedBy:    p.GetUpdatedBy(),
		RawConfig:    p.GetRawConfig(),
	}

	// Parse timestamps
	if p.GetCreatedAt() != "" {
		if t, err := time.Parse(time.RFC3339, p.GetCreatedAt()); err == nil {
			eq.CreatedAt = t
		}
	}
	if p.GetUpdatedAt() != "" {
		if t, err := time.Parse(time.RFC3339, p.GetUpdatedAt()); err == nil {
			eq.UpdatedAt = t
		}
	}

	// Platform params
	if pp := p.GetPlatformParams(); pp != nil {
		eq.PlatformParams = PlatformParamsFromProto(pp)
	}

	// Inline sensors
	if protoSensors := p.GetSensors(); len(protoSensors) > 0 {
		eq.Sensors = make([]SensorConfig, len(protoSensors))
		for i, s := range protoSensors {
			eq.Sensors[i] = SensorConfigFromProto(s)
		}
	}

	// Inline weapons
	if protoWeapons := p.GetWeapons(); len(protoWeapons) > 0 {
		eq.Weapons = make([]WeaponConfig, len(protoWeapons))
		for i, w := range protoWeapons {
			eq.Weapons[i] = WeaponConfigFromProto(w)
		}
	}

	// Inline communications
	if protoComms := p.GetCommunications(); len(protoComms) > 0 {
		eq.Communications = make([]CommConfig, len(protoComms))
		for i, c := range protoComms {
			eq.Communications[i] = CommConfigFromProto(c)
		}
	}

	// Signature params
	if sp := p.GetSignatureParams(); sp != nil {
		eq.SignatureParams = SignatureParamsFromProto(sp)
	}

	// Mover
	if m := p.GetMover(); m != nil {
		mover := MoverConfigFromProto(m)
		eq.Mover = &mover
	}

	// Processors
	if protoProcs := p.GetProcessors(); len(protoProcs) > 0 {
		eq.Processors = make([]ProcessorConfig, len(protoProcs))
		for i, proc := range protoProcs {
			eq.Processors[i] = ProcessorConfigFromProto(proc)
		}
	}

	// Fuel
	if f := p.GetFuel(); f != nil {
		fuel := FuelConfigFromProto(f)
		eq.Fuel = &fuel
	}

	return eq
}

// PlatformParamsToProto converts model to proto.
func PlatformParamsToProto(pp *PlatformParams) *pb.PlatformParams {
	if pp == nil {
		return nil
	}
	return &pb.PlatformParams{
		MaxSpeed:         pp.MaxSpeed,
		CruiseSpeed:      pp.CruiseSpeed,
		MinSpeed:         pp.MinSpeed,
		MaxAltitude:      pp.MaxAltitude,
		MinAltitude:      pp.MinAltitude,
		Ceiling:          pp.Ceiling,
		Range:            pp.Range,
		Endurance:        pp.Endurance,
		MaxG:             pp.MaxG,
		Length:           pp.Length,
		Width:            pp.Width,
		Height:           pp.Height,
		Weight:           pp.Weight,
		MaxTakeoffWeight: pp.MaxTakeoffWeight,
		FuelCapacity:     pp.FuelCapacity,
		MotionModel:      pp.MotionModel,
	}
}

// PlatformParamsFromProto converts proto to model.
func PlatformParamsFromProto(p *pb.PlatformParams) PlatformParams {
	return PlatformParams{
		MaxSpeed:         p.GetMaxSpeed(),
		CruiseSpeed:      p.GetCruiseSpeed(),
		MinSpeed:         p.GetMinSpeed(),
		MaxAltitude:      p.GetMaxAltitude(),
		MinAltitude:      p.GetMinAltitude(),
		Ceiling:          p.GetCeiling(),
		Range:            p.GetRange(),
		Endurance:        p.GetEndurance(),
		MaxG:             p.GetMaxG(),
		Length:           p.GetLength(),
		Width:            p.GetWidth(),
		Height:           p.GetHeight(),
		Weight:           p.GetWeight(),
		MaxTakeoffWeight: p.GetMaxTakeoffWeight(),
		FuelCapacity:     p.GetFuelCapacity(),
		MotionModel:      p.GetMotionModel(),
	}
}

// SensorConfigToProto converts model to proto.
func SensorConfigToProto(s *SensorConfig) *pb.SensorConfig {
	if s == nil {
		return nil
	}
	return &pb.SensorConfig{
		Id:           s.ID,
		Name:         s.Name,
		Type:         s.Type,
		Enabled:      s.Enabled,
		MaxRange:     s.MaxRange,
		MinRange:     s.MinRange,
		FovAzimuth:   s.FovAzimuth,
		FovElevation: s.FovElevation,
		ScanRate:     s.ScanRate,
		Accuracy:     s.Accuracy,
		Frequency:    s.Frequency,
		Power:        s.Power,
		AntennaGain:  s.AntennaGain,
		PulseWidth:   s.PulseWidth,
		Prf:          s.Prf,
		Sensitivity:  s.Sensitivity,
		RawConfig:    s.RawConfig,
		Description:  s.Description,
	}
}

// SensorConfigFromProto converts proto to model.
func SensorConfigFromProto(p *pb.SensorConfig) SensorConfig {
	return SensorConfig{
		ID:           p.GetId(),
		Name:         p.GetName(),
		Type:         p.GetType(),
		Enabled:      p.GetEnabled(),
		MaxRange:     p.GetMaxRange(),
		MinRange:     p.GetMinRange(),
		FovAzimuth:   p.GetFovAzimuth(),
		FovElevation: p.GetFovElevation(),
		ScanRate:     p.GetScanRate(),
		Accuracy:     p.GetAccuracy(),
		Frequency:    p.GetFrequency(),
		Power:        p.GetPower(),
		AntennaGain:  p.GetAntennaGain(),
		PulseWidth:   p.GetPulseWidth(),
		Prf:          p.GetPrf(),
		Sensitivity:  p.GetSensitivity(),
		RawConfig:    p.GetRawConfig(),
		Description:  p.GetDescription(),
	}
}

// WeaponConfigToProto converts model to proto.
func WeaponConfigToProto(w *WeaponConfig) *pb.WeaponConfig {
	if w == nil {
		return nil
	}
	return &pb.WeaponConfig{
		Id:              w.ID,
		Name:            w.Name,
		Type:            w.Type,
		Quantity:        w.Quantity,
		MaxRange:        w.MaxRange,
		MinRange:        w.MinRange,
		NoEscapeRange:   w.NoEscapeRange,
		NoManeuverRange: w.NoManeuverRange,
		MaxSpeed:        w.MaxSpeed,
		MaxAltitude:     w.MaxAltitude,
		MaxG:            w.MaxG,
		FlightTime:      w.FlightTime,
		WarheadType:     w.WarheadType,
		WarheadWeight:   w.WarheadWeight,
		BlastRadius:     w.BlastRadius,
		Penetration:     w.Penetration,
		GuidanceType:    w.GuidanceType,
		SeekerRange:     w.SeekerRange,
		Weight:          w.Weight,
		RawConfig:       w.RawConfig,
		Description:     w.Description,
	}
}

// WeaponConfigFromProto converts proto to model.
func WeaponConfigFromProto(p *pb.WeaponConfig) WeaponConfig {
	return WeaponConfig{
		ID:              p.GetId(),
		Name:            p.GetName(),
		Type:            p.GetType(),
		Quantity:        p.GetQuantity(),
		MaxRange:        p.GetMaxRange(),
		MinRange:        p.GetMinRange(),
		NoEscapeRange:   p.GetNoEscapeRange(),
		NoManeuverRange: p.GetNoManeuverRange(),
		MaxSpeed:        p.GetMaxSpeed(),
		MaxAltitude:     p.GetMaxAltitude(),
		MaxG:            p.GetMaxG(),
		FlightTime:      p.GetFlightTime(),
		WarheadType:     p.GetWarheadType(),
		WarheadWeight:   p.GetWarheadWeight(),
		BlastRadius:     p.GetBlastRadius(),
		Penetration:     p.GetPenetration(),
		GuidanceType:    p.GetGuidanceType(),
		SeekerRange:     p.GetSeekerRange(),
		Weight:          p.GetWeight(),
		RawConfig:       p.GetRawConfig(),
		Description:     p.GetDescription(),
	}
}

// CommConfigToProto converts model to proto.
func CommConfigToProto(c *CommConfig) *pb.CommConfig {
	if c == nil {
		return nil
	}
	return &pb.CommConfig{
		Id:          c.ID,
		Name:        c.Name,
		Type:        c.Type,
		Enabled:     c.Enabled,
		Frequency:   c.Frequency,
		Bandwidth:   c.Bandwidth,
		MaxRange:    c.MaxRange,
		DataRate:    c.DataRate,
		Latency:     c.Latency,
		HopRate:     c.HopRate,
		Encryption:  c.Encryption,
		RawConfig:   c.RawConfig,
		Description: c.Description,
	}
}

// CommConfigFromProto converts proto to model.
func CommConfigFromProto(p *pb.CommConfig) CommConfig {
	return CommConfig{
		ID:          p.GetId(),
		Name:        p.GetName(),
		Type:        p.GetType(),
		Enabled:     p.GetEnabled(),
		Frequency:   p.GetFrequency(),
		Bandwidth:   p.GetBandwidth(),
		MaxRange:    p.GetMaxRange(),
		DataRate:    p.GetDataRate(),
		Latency:     p.GetLatency(),
		HopRate:     p.GetHopRate(),
		Encryption:  p.GetEncryption(),
		RawConfig:   p.GetRawConfig(),
		Description: p.GetDescription(),
	}
}

// SignatureParamsToProto converts model to proto.
func SignatureParamsToProto(sp *SignatureParams) *pb.SignatureParams {
	if sp == nil {
		return nil
	}
	return &pb.SignatureParams{
		Rcs: &pb.RCSParams{
			Frontal: sp.RCS.Frontal,
			Side:    sp.RCS.Side,
			Rear:    sp.RCS.Rear,
			Average: sp.RCS.Average,
		},
		Ir: &pb.IRParams{
			Frontal: sp.IR.Frontal,
			Side:    sp.IR.Side,
			Rear:    sp.IR.Rear,
		},
		Acoustic: &pb.AcousticParams{
			NoiseLevel: sp.Acoustic.NoiseLevel,
			Frequency:  sp.Acoustic.Frequency,
		},
		Visual: &pb.VisualParams{
			Visibility: sp.Visual.Visibility,
		},
		RawConfig: sp.RawConfig,
	}
}

// SignatureParamsFromProto converts proto to model.
func SignatureParamsFromProto(p *pb.SignatureParams) SignatureParams {
	sp := SignatureParams{}
	if rcs := p.GetRcs(); rcs != nil {
		sp.RCS = RCSParams{
			Frontal: rcs.GetFrontal(),
			Side:    rcs.GetSide(),
			Rear:    rcs.GetRear(),
			Average: rcs.GetAverage(),
		}
	}
	if ir := p.GetIr(); ir != nil {
		sp.IR = IRParams{
			Frontal: ir.GetFrontal(),
			Side:    ir.GetSide(),
			Rear:    ir.GetRear(),
		}
	}
	if acc := p.GetAcoustic(); acc != nil {
		sp.Acoustic = AcousticParams{
			NoiseLevel: acc.GetNoiseLevel(),
			Frequency:  acc.GetFrequency(),
		}
	}
	if vis := p.GetVisual(); vis != nil {
		sp.Visual = VisualParams{
			Visibility: vis.GetVisibility(),
		}
	}
	sp.RawConfig = p.GetRawConfig()
	return sp
}

// MoverConfigToProto converts model to proto.
func MoverConfigToProto(m *MoverConfig) *pb.MoverConfig {
	if m == nil {
		return nil
	}
	return &pb.MoverConfig{
		Id:              m.ID,
		Name:            m.Name,
		Type:            m.Type,
		MaxSpeed:        m.MaxSpeed,
		MaxAcceleration: m.MaxAcceleration,
		MaxDeceleration: m.MaxDeceleration,
		MaxClimbRate:    m.MaxClimbRate,
		MaxTurnRate:     m.MaxTurnRate,
		MaxRollRate:     m.MaxRollRate,
		StallSpeed:      m.StallSpeed,
		CruiseSpeed:     m.CruiseSpeed,
		RawConfig:       m.RawConfig,
		Description:     m.Description,
	}
}

// MoverConfigFromProto converts proto to model.
func MoverConfigFromProto(p *pb.MoverConfig) MoverConfig {
	return MoverConfig{
		ID:              p.GetId(),
		Name:            p.GetName(),
		Type:            p.GetType(),
		MaxSpeed:        p.GetMaxSpeed(),
		MaxAcceleration: p.GetMaxAcceleration(),
		MaxDeceleration: p.GetMaxDeceleration(),
		MaxClimbRate:    p.GetMaxClimbRate(),
		MaxTurnRate:     p.GetMaxTurnRate(),
		MaxRollRate:     p.GetMaxRollRate(),
		StallSpeed:      p.GetStallSpeed(),
		CruiseSpeed:     p.GetCruiseSpeed(),
		RawConfig:       p.GetRawConfig(),
		Description:     p.GetDescription(),
	}
}

// ProcessorConfigToProto converts model to proto.
func ProcessorConfigToProto(pr *ProcessorConfig) *pb.ProcessorConfig {
	if pr == nil {
		return nil
	}
	return &pb.ProcessorConfig{
		Id:          pr.ID,
		Name:        pr.Name,
		Type:        pr.Type,
		Enabled:     pr.Enabled,
		UpdateRate:  pr.UpdateRate,
		MaxTracks:   pr.MaxTracks,
		RawConfig:   pr.RawConfig,
		Description: pr.Description,
	}
}

// ProcessorConfigFromProto converts proto to model.
func ProcessorConfigFromProto(p *pb.ProcessorConfig) ProcessorConfig {
	return ProcessorConfig{
		ID:          p.GetId(),
		Name:        p.GetName(),
		Type:        p.GetType(),
		Enabled:     p.GetEnabled(),
		UpdateRate:  p.GetUpdateRate(),
		MaxTracks:   p.GetMaxTracks(),
		RawConfig:   p.GetRawConfig(),
		Description: p.GetDescription(),
	}
}

// FuelConfigToProto converts model to proto.
func FuelConfigToProto(f *FuelConfig) *pb.FuelConfig {
	if f == nil {
		return nil
	}
	return &pb.FuelConfig{
		Id:                      f.ID,
		Name:                    f.Name,
		Type:                    f.Type,
		MaxFuel:                 f.MaxFuel,
		CurrentFuel:             f.CurrentFuel,
		ConsumptionRate:         f.ConsumptionRate,
		SpecificFuelConsumption: f.SpecificFuelConsumption,
		RawConfig:               f.RawConfig,
		Description:             f.Description,
	}
}

// FuelConfigFromProto converts proto to model.
func FuelConfigFromProto(p *pb.FuelConfig) FuelConfig {
	return FuelConfig{
		ID:                      p.GetId(),
		Name:                    p.GetName(),
		Type:                    p.GetType(),
		MaxFuel:                 p.GetMaxFuel(),
		CurrentFuel:             p.GetCurrentFuel(),
		ConsumptionRate:         p.GetConsumptionRate(),
		SpecificFuelConsumption: p.GetSpecificFuelConsumption(),
		RawConfig:               p.GetRawConfig(),
		Description:             p.GetDescription(),
	}
}
