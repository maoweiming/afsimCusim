package model

import (
	"testing"
	"time"
)

func TestEquipmentRoundTrip(t *testing.T) {
	original := &Equipment{
		ID:           "test-001",
		Code:         "TST-001",
		Name:         "Test Equipment",
		Category:     "fighter",
		PlatformType: "aircraft",
		Description:  "A test equipment",
		Version:      5,
		Status:       "active",
		PlatformParams: PlatformParams{
			MaxSpeed:    2000.0,
			CruiseSpeed: 800.0,
			MaxAltitude: 15000.0,
			Range:       3000.0,
			MotionModel: "6dof",
		},
		Sensors: []SensorConfig{
			{
				ID:       "sensor-1",
				Name:     "Test Radar",
				Type:     "radar",
				Enabled:  true,
				MaxRange: 200.0,
			},
		},
		Weapons: []WeaponConfig{
			{
				ID:       "weapon-1",
				Name:     "Test Missile",
				Type:     "missile",
				Quantity: 4,
				MaxRange: 100.0,
			},
		},
		Communications: []CommConfig{
			{
				ID:        "comm-1",
				Name:      "Test Radio",
				Type:      "voice",
				Enabled:   true,
				Frequency: 300.0,
			},
		},
		SignatureParams: SignatureParams{
			RCS: RCSParams{
				Frontal: 1.0,
				Side:    3.0,
				Rear:    2.0,
				Average: 2.0,
			},
			IR: IRParams{
				Frontal: 5.0,
				Side:    8.0,
				Rear:    15.0,
			},
			Acoustic: AcousticParams{
				NoiseLevel: 100.0,
				Frequency:  500.0,
			},
			Visual: VisualParams{
				Visibility: 0.5,
			},
		},
		Tags:      []string{"test", "mock"},
		CreatedBy: "tester",
		UpdatedBy: "tester",
		CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt: time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC),
	}

	// Convert to proto
	proto := EquipmentToProto(original)

	// Verify basic fields
	if proto.GetId() != "test-001" {
		t.Errorf("expected ID test-001, got %s", proto.GetId())
	}
	if proto.GetCode() != "TST-001" {
		t.Errorf("expected Code TST-001, got %s", proto.GetCode())
	}
	if proto.GetName() != "Test Equipment" {
		t.Errorf("expected Name Test Equipment, got %s", proto.GetName())
	}
	if proto.GetVersion() != 5 {
		t.Errorf("expected Version 5, got %d", proto.GetVersion())
	}

	// Verify platform params
	if proto.GetPlatformParams().GetMaxSpeed() != 2000.0 {
		t.Errorf("expected MaxSpeed 2000, got %f", proto.GetPlatformParams().GetMaxSpeed())
	}

	// Verify sensor IDs
	if len(proto.GetSensorIds()) != 1 || proto.GetSensorIds()[0] != "sensor-1" {
		t.Errorf("unexpected sensor IDs: %v", proto.GetSensorIds())
	}

	// Verify weapon IDs
	if len(proto.GetWeaponIds()) != 1 || proto.GetWeaponIds()[0] != "weapon-1" {
		t.Errorf("unexpected weapon IDs: %v", proto.GetWeaponIds())
	}

	// Convert back
	roundTrip := EquipmentFromProto(proto)

	if roundTrip.ID != original.ID {
		t.Errorf("round trip ID mismatch: %s != %s", roundTrip.ID, original.ID)
	}
	if roundTrip.Code != original.Code {
		t.Errorf("round trip Code mismatch: %s != %s", roundTrip.Code, original.Code)
	}
	if roundTrip.PlatformParams.MaxSpeed != original.PlatformParams.MaxSpeed {
		t.Errorf("round trip MaxSpeed mismatch: %f != %f", roundTrip.PlatformParams.MaxSpeed, original.PlatformParams.MaxSpeed)
	}
	if roundTrip.SignatureParams.RCS.Frontal != original.SignatureParams.RCS.Frontal {
		t.Errorf("round trip RCS Frontal mismatch: %f != %f", roundTrip.SignatureParams.RCS.Frontal, original.SignatureParams.RCS.Frontal)
	}
}

func TestEquipmentToProtoNil(t *testing.T) {
	result := EquipmentToProto(nil)
	if result != nil {
		t.Error("expected nil for nil input")
	}
}

func TestEquipmentFromProtoNil(t *testing.T) {
	result := EquipmentFromProto(nil)
	if result != nil {
		t.Error("expected nil for nil input")
	}
}

func TestSensorConfigRoundTrip(t *testing.T) {
	original := SensorConfig{
		ID:           "sensor-1",
		Name:         "Test Radar",
		Type:         "radar",
		Enabled:      true,
		MaxRange:     200.0,
		MinRange:     1.0,
		FovAzimuth:   120.0,
		FovElevation: 60.0,
		ScanRate:     30.0,
		Accuracy:     0.85,
		Frequency:    10.0,
		Power:        6.0,
		AntennaGain:  38.0,
		PulseWidth:   1.0,
		Prf:          1000.0,
		Sensitivity:  0.0,
	}

	proto := SensorConfigToProto(&original)
	roundTrip := SensorConfigFromProto(proto)

	if roundTrip.ID != original.ID {
		t.Errorf("sensor ID mismatch: %s != %s", roundTrip.ID, original.ID)
	}
	if roundTrip.MaxRange != original.MaxRange {
		t.Errorf("sensor MaxRange mismatch: %f != %f", roundTrip.MaxRange, original.MaxRange)
	}
	if roundTrip.Enabled != original.Enabled {
		t.Errorf("sensor Enabled mismatch: %v != %v", roundTrip.Enabled, original.Enabled)
	}
}

func TestWeaponConfigRoundTrip(t *testing.T) {
	original := WeaponConfig{
		ID:              "weapon-1",
		Name:            "Test Missile",
		Type:            "missile",
		Quantity:        4,
		MaxRange:        180.0,
		MinRange:        2.0,
		NoEscapeRange:   75.0,
		NoManeuverRange: 50.0,
		MaxSpeed:        4000.0,
		WarheadType:     "blast_fragmentation",
		GuidanceType:    "active_radar",
	}

	proto := WeaponConfigToProto(&original)
	roundTrip := WeaponConfigFromProto(proto)

	if roundTrip.ID != original.ID {
		t.Errorf("weapon ID mismatch")
	}
	if roundTrip.Quantity != original.Quantity {
		t.Errorf("weapon Quantity mismatch: %d != %d", roundTrip.Quantity, original.Quantity)
	}
	if roundTrip.NoEscapeRange != original.NoEscapeRange {
		t.Errorf("weapon NoEscapeRange mismatch")
	}
}

func TestCommConfigRoundTrip(t *testing.T) {
	original := CommConfig{
		ID:         "comm-1",
		Name:       "Test Radio",
		Type:       "datalink",
		Enabled:    true,
		Frequency:  1200.0,
		Bandwidth:  3.0,
		MaxRange:   555.0,
		DataRate:   238.0,
		Latency:    2.0,
		HopRate:    0,
		Encryption: "AES-256",
	}

	proto := CommConfigToProto(&original)
	roundTrip := CommConfigFromProto(proto)

	if roundTrip.ID != original.ID {
		t.Errorf("comm ID mismatch")
	}
	if roundTrip.Encryption != original.Encryption {
		t.Errorf("comm Encryption mismatch: %s != %s", roundTrip.Encryption, original.Encryption)
	}
}

func TestSignatureParamsRoundTrip(t *testing.T) {
	original := SignatureParams{
		RCS: RCSParams{Frontal: 1.0, Side: 3.0, Rear: 2.0, Average: 2.0},
		IR:  IRParams{Frontal: 5.0, Side: 8.0, Rear: 15.0},
		Acoustic: AcousticParams{NoiseLevel: 100.0, Frequency: 500.0},
		Visual:   VisualParams{Visibility: 0.5},
	}

	proto := SignatureParamsToProto(&original)
	roundTrip := SignatureParamsFromProto(proto)

	if roundTrip.RCS.Frontal != original.RCS.Frontal {
		t.Errorf("RCS Frontal mismatch")
	}
	if roundTrip.IR.Rear != original.IR.Rear {
		t.Errorf("IR Rear mismatch")
	}
	if roundTrip.Acoustic.NoiseLevel != original.Acoustic.NoiseLevel {
		t.Errorf("Acoustic NoiseLevel mismatch")
	}
	if roundTrip.Visual.Visibility != original.Visual.Visibility {
		t.Errorf("Visual Visibility mismatch")
	}
}
