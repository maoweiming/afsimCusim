// Package main provides a mock data initializer for the equipment service.
//
// Usage:
//
//	cd services/equipment
//	go run scripts/init_mock_data.go
//
// Environment variables:
//
//	MONGODB_URI (default: mongodb://localhost:27017)
//	DB_NAME     (default: truesim_equipment)
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Equipment is a simplified struct for mock data generation.
type Equipment struct {
	ID              string         `bson:"_id"`
	Code            string         `bson:"code"`
	Name            string         `bson:"name"`
	Category        string         `bson:"category"`
	PlatformType    string         `bson:"platform_type"`
	Description     string         `bson:"description"`
	Version         int32          `bson:"version"`
	Status          string         `bson:"status"`
	PlatformParams  map[string]any `bson:"platform_params"`
	Sensors         []map[string]any `bson:"sensors"`
	Weapons         []map[string]any `bson:"weapons"`
	Communications  []map[string]any `bson:"communications"`
	SignatureParams map[string]any `bson:"signature_params"`
	Tags            []string       `bson:"tags"`
	CreatedBy       string         `bson:"created_by"`
	UpdatedBy       string         `bson:"updated_by"`
	CreatedAt       time.Time      `bson:"created_at"`
	UpdatedAt       time.Time      `bson:"updated_at"`
	VersionHistory  []any          `bson:"version_history"`
}

func main() {
	mongoURI := getEnv("MONGODB_URI", "mongodb://localhost:27017")
	dbName := getEnv("DB_NAME", "truesim_equipment")

	log.Printf("Connecting to %s/%s", mongoURI, dbName)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Connect: %v", err)
	}
	defer client.Disconnect(ctx)

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("Ping: %v", err)
	}

	db := client.Database(dbName)
	coll := db.Collection("equipment")

	// Drop existing data
	if err := coll.Drop(ctx); err != nil {
		log.Fatalf("Drop: %v", err)
	}
	log.Println("Cleared existing equipment data")

	now := time.Now()
	equipment := []Equipment{
		{
			ID:           "eq_f16",
			Code:         "F16-C",
			Name:         "F-16C Fighting Falcon",
			Category:     "fighter",
			PlatformType: "aircraft",
			Description:  "多用途战斗机，具备空对空和空对地作战能力",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         2120.0,
				"cruise_speed":      850.0,
				"min_speed":         250.0,
				"max_altitude":      15240.0,
				"min_altitude":      300.0,
				"ceiling":           15240.0,
				"range":             3200.0,
				"endurance":         3.5,
				"max_g":             9.0,
				"length":            15.06,
				"width":             9.96,
				"height":            5.09,
				"weight":            8573.0,
				"max_takeoff_weight": 21772.0,
				"fuel_capacity":     3104.0,
				"motion_model":      "6dof",
			},
			Sensors: []map[string]any{
				{
					"id":            "an_apg_68",
					"name":          "AN/APG-68 V9 Radar",
					"type":          "radar",
					"enabled":       true,
					"max_range":     296.0,
					"min_range":     1.0,
					"fov_azimuth":   120.0,
					"fov_elevation": 60.0,
					"scan_rate":     40.0,
					"accuracy":      0.85,
					"frequency":     10.0,
					"power":         6.0,
					"antenna_gain":  38.0,
				},
				{
					"id":          "aaq_33_sniper",
					"name":        "AAQ-33 Sniper Targeting Pod",
					"type":        "electro_optical",
					"enabled":     true,
					"max_range":   80.0,
					"min_range":   0.5,
					"fov_azimuth": 360.0,
					"sensitivity": 0.9,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "aim120_amraam",
					"name":             "AIM-120 AMRAAM",
					"type":             "missile",
					"quantity":         4,
					"max_range":        180.0,
					"min_range":        2.0,
					"no_escape_range":  75.0,
					"max_speed":        4000.0,
					"max_altitude":     25000.0,
					"max_g":            40.0,
					"flight_time":      120.0,
					"warhead_type":     "blast_fragmentation",
					"warhead_weight":   22.7,
					"blast_radius":     15.0,
					"guidance_type":    "active_radar",
					"seeker_range":     18.0,
				},
				{
					"id":               "aim9x_sidewinder",
					"name":             "AIM-9X Sidewinder",
					"type":             "missile",
					"quantity":         2,
					"max_range":        35.0,
					"min_range":        1.0,
					"no_escape_range":  15.0,
					"max_speed":        2500.0,
					"max_g":            50.0,
					"warhead_type":     "blast_fragmentation",
					"warhead_weight":   9.4,
					"guidance_type":    "infrared",
					"seeker_range":     12.0,
				},
				{
					"id":               "m61a1_vulcan",
					"name":             "M61A1 Vulcan 20mm Cannon",
					"type":             "gun",
					"quantity":         511,
					"max_range":        2.0,
					"min_range":        0.3,
					"max_speed":        1030.0,
					"warhead_type":     "kinetic",
					"warhead_weight":   0.1,
					"penetration":      25.0,
				},
			},
			Communications: []map[string]any{
				{
					"id":         "link16",
					"name":       "Link-16 MIDS",
					"type":       "datalink",
					"enabled":    true,
					"frequency":  1200.0,
					"bandwidth":  3.0,
					"max_range":  555.0,
					"data_rate":  238.0,
					"latency":    2.0,
					"encryption": "AES-256",
				},
				{
					"id":         "uhf_radio",
					"name":       "AN/ARC-164 UHF Radio",
					"type":       "voice",
					"enabled":    true,
					"frequency":  300.0,
					"bandwidth":  0.025,
					"max_range":  370.0,
					"encryption": "HAVE_QUICK_II",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 1.0,
					"side":    3.0,
					"rear":    2.0,
					"average": 2.0,
				},
				"ir": map[string]any{
					"frontal": 5.0,
					"side":    8.0,
					"rear":    15.0,
				},
				"acoustic": map[string]any{
					"noise_level": 130.0,
					"frequency":   1000.0,
				},
				"visual": map[string]any{
					"visibility": 0.5,
				},
			},
			Tags:       []string{"air_force", "multirole", "4th_gen", "nato"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
		{
			ID:           "eq_su35",
			Code:         "SU-35S",
			Name:         "Su-35S Flanker-E",
			Category:     "fighter",
			PlatformType: "aircraft",
			Description:  "俄罗斯第四代重型多用途战斗机，具备超机动性能",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         2500.0,
				"cruise_speed":      960.0,
				"min_speed":         220.0,
				"max_altitude":      18000.0,
				"min_altitude":      300.0,
				"ceiling":           18000.0,
				"range":             3600.0,
				"endurance":         4.0,
				"max_g":             9.0,
				"length":            21.9,
				"width":             15.3,
				"height":            5.9,
				"weight":            18400.0,
				"max_takeoff_weight": 34500.0,
				"fuel_capacity":     11500.0,
				"motion_model":      "6dof",
			},
			Sensors: []map[string]any{
				{
					"id":            "irbis_e",
					"name":          "Irbis-E PESA Radar",
					"type":          "radar",
					"enabled":       true,
					"max_range":     400.0,
					"min_range":     1.0,
					"fov_azimuth":   120.0,
					"fov_elevation": 60.0,
					"scan_rate":     30.0,
					"accuracy":      0.8,
					"frequency":     10.0,
					"power":         20.0,
					"antenna_gain":  42.0,
				},
				{
					"id":          "ols_35",
					"name":        "OLS-35 IRST",
					"type":        "infrared_search_track",
					"enabled":     true,
					"max_range":   90.0,
					"min_range":   1.0,
					"fov_azimuth": 120.0,
					"sensitivity": 0.85,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "r77_1",
					"name":             "R-77-1 (AA-12 Adder)",
					"type":             "missile",
					"quantity":         6,
					"max_range":        175.0,
					"min_range":        2.0,
					"no_escape_range":  80.0,
					"max_speed":        4250.0,
					"max_g":            40.0,
					"warhead_type":     "blast_fragmentation",
					"warhead_weight":   22.5,
					"guidance_type":    "active_radar",
					"seeker_range":     16.0,
				},
				{
					"id":               "r73m",
					"name":             "R-73M2 (AA-11 Archer)",
					"type":             "missile",
					"quantity":         2,
					"max_range":        40.0,
					"no_escape_range":  20.0,
					"max_speed":        2500.0,
					"max_g":            60.0,
					"warhead_type":     "blast_fragmentation",
					"guidance_type":    "infrared",
				},
			},
			Communications: []map[string]any{
				{
					"id":         "datalink_russia",
					"name":       "S-111 Datalink",
					"type":       "datalink",
					"enabled":    true,
					"frequency":  1200.0,
					"bandwidth":  3.0,
					"max_range":  500.0,
					"data_rate":  200.0,
					"encryption": "GOST",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 3.0,
					"side":    8.0,
					"rear":    5.0,
					"average": 5.0,
				},
				"ir": map[string]any{
					"frontal": 8.0,
					"side":    12.0,
					"rear":    20.0,
				},
				"acoustic": map[string]any{
					"noise_level": 135.0,
					"frequency":   800.0,
				},
				"visual": map[string]any{
					"visibility": 0.7,
				},
			},
			Tags:       []string{"air_force", "multirole", "4th_plus_gen", "russia"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
		{
			ID:           "eq_m1a2",
			Code:         "M1A2-SEPv3",
			Name:         "M1A2 SEPv3 Abrams",
			Category:     "tank",
			PlatformType: "ground",
			Description:  "美国陆军主战坦克，第三代改进型",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         67.0,
				"cruise_speed":      40.0,
				"min_speed":         0.0,
				"max_altitude":      0.0,
				"min_altitude":      0.0,
				"range":             426.0,
				"endurance":         12.0,
				"max_g":             0.0,
				"length":            9.77,
				"width":             3.66,
				"height":            2.44,
				"weight":            73000.0,
				"max_takeoff_weight": 73000.0,
				"fuel_capacity":     1900.0,
				"motion_model":      "ground_track",
			},
			Sensors: []map[string]any{
				{
					"id":            "flir_2g",
					"name":          "2nd Gen FLIR",
					"type":          "infrared",
					"enabled":       true,
					"max_range":     10.0,
					"min_range":     0.1,
					"fov_azimuth":   360.0,
					"fov_elevation": 20.0,
					"sensitivity":   0.95,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "m256_120mm",
					"name":             "M256A1 120mm Smoothbore Gun",
					"type":             "gun",
					"quantity":         42,
					"max_range":        4.0,
					"min_range":        0.2,
					"max_speed":        1670.0,
					"warhead_type":     "kinetic_penetrator",
					"warhead_weight":   10.0,
					"penetration":      800.0,
				},
				{
					"id":               "m240_coax",
					"name":             "M240C 7.62mm Coax MG",
					"type":             "gun",
					"quantity":         10000,
					"max_range":        1.8,
					"max_speed":        853.0,
					"warhead_type":     "kinetic",
				},
			},
			Communications: []map[string]any{
				{
					"id":         "falcon_iii",
					"name":       "AN/VRC-104 Falcon III",
					"type":       "voice",
					"enabled":    true,
					"frequency":  512.0,
					"bandwidth":  0.05,
					"max_range":  50.0,
					"encryption": "AES-256",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 10.0,
					"side":    30.0,
					"rear":    25.0,
					"average": 22.0,
				},
				"ir": map[string]any{
					"frontal": 50.0,
					"side":    80.0,
					"rear":    100.0,
				},
				"acoustic": map[string]any{
					"noise_level": 100.0,
					"frequency":   200.0,
				},
				"visual": map[string]any{
					"visibility": 0.6,
				},
			},
			Tags:       []string{"army", "armored", "nato"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
		{
			ID:           "eq_patriot",
			Code:         "PATRIOT-PAC3",
			Name:         "Patriot PAC-3 MSE",
			Category:     "air_defense",
			PlatformType: "ground",
			Description:  "美国陆军中远程防空导弹系统",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         0.0,
				"cruise_speed":      0.0,
				"range":             0.0,
				"endurance":         0.0,
				"length":            0.0,
				"width":             0.0,
				"height":            0.0,
				"weight":            0.0,
				"motion_model":      "static",
			},
			Sensors: []map[string]any{
				{
					"id":            "an_mpq_65a",
					"name":          "AN/MPQ-65A Radar",
					"type":          "radar",
					"enabled":       true,
					"max_range":     300.0,
					"min_range":     3.0,
					"fov_azimuth":   120.0,
					"fov_elevation": 60.0,
					"scan_rate":     30.0,
					"accuracy":      0.95,
					"frequency":     10.0,
					"power":         60.0,
					"antenna_gain":  45.0,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "pac3_mse",
					"name":             "PAC-3 MSE Interceptor",
					"type":             "missile",
					"quantity":         16,
					"max_range":        200.0,
					"min_range":         5.0,
					"no_escape_range":  100.0,
					"max_speed":        4800.0,
					"max_g":            40.0,
					"flight_time":      180.0,
					"warhead_type":     "hit_to_kill",
					"warhead_weight":   75.0,
					"blast_radius":     0.0,
					"guidance_type":    "active_radar",
					"seeker_range":     25.0,
				},
			},
			Communications: []map[string]any{
				{
					"id":         "dl_link16",
					"name":       "Link-16 Terminal",
					"type":       "datalink",
					"enabled":    true,
					"frequency":  1200.0,
					"bandwidth":  3.0,
					"max_range":  555.0,
					"data_rate":  238.0,
					"encryption": "AES-256",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 20.0,
					"side":    40.0,
					"rear":    30.0,
					"average": 30.0,
				},
				"ir": map[string]any{
					"frontal": 10.0,
					"side":    15.0,
					"rear":    12.0,
				},
				"acoustic": map[string]any{
					"noise_level": 60.0,
					"frequency":   100.0,
				},
				"visual": map[string]any{
					"visibility": 0.8,
				},
			},
			Tags:       []string{"army", "air_defense", "nato", "ground_based"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
		{
			ID:           "eq_arleigh_burke",
			Code:         "DDG-51-III",
			Name:         "Arleigh Burke-class DDG (Flight III)",
			Category:     "destroyer",
			PlatformType: "naval",
			Description:  "美国海军宙斯盾驱逐舰，具备区域防空能力",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         56.0,
				"cruise_speed":      30.0,
				"min_speed":         0.0,
				"max_altitude":      0.0,
				"min_altitude":      0.0,
				"range":             8300.0,
				"endurance":         60.0,
				"length":            155.3,
				"width":             20.0,
				"height":            45.7,
				"weight":            9700000.0,
				"max_takeoff_weight": 9700000.0,
				"fuel_capacity":     1000000.0,
				"motion_model":      "naval",
			},
			Sensors: []map[string]any{
				{
					"id":            "an_spy_6",
					"name":          "AN/SPY-6(V)1 AMDR",
					"type":          "radar",
					"enabled":       true,
					"max_range":     500.0,
					"min_range":     1.0,
					"fov_azimuth":   360.0,
					"fov_elevation": 90.0,
					"scan_rate":     60.0,
					"accuracy":      0.98,
					"frequency":     10.0,
					"power":         100.0,
					"antenna_gain":  50.0,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "sm6",
					"name":             "RIM-174 SM-6 ERAM",
					"type":             "missile",
					"quantity":         96,
					"max_range":        370.0,
					"no_escape_range":  200.0,
					"max_speed":        3675.0,
					"max_altitude":     33000.0,
					"warhead_type":     "blast_fragmentation",
					"warhead_weight":   64.0,
					"blast_radius":     20.0,
					"guidance_type":    "active_semi_active_radar",
					"seeker_range":     40.0,
				},
				{
					"id":               "mk41_vls",
					"name":             "Mk 41 VLS",
					"type":             "launcher",
					"quantity":         96,
					"max_range":        0.0,
					"warhead_type":     "multi",
				},
			},
			Communications: []map[string]any{
				{
					"id":         "ntds",
					"name":       "Naval Tactical Data System",
					"type":       "datalink",
					"enabled":    true,
					"frequency":  1200.0,
					"bandwidth":  10.0,
					"max_range":  555.0,
					"data_rate":  500.0,
					"encryption": "AES-256",
				},
				{
					"id":         "uhf_satcom",
					"name":       "UHF SATCOM",
					"type":       "satellite",
					"enabled":    true,
					"frequency":  300.0,
					"bandwidth":  0.025,
					"max_range":  20000.0,
					"data_rate":  19.2,
					"encryption": "AES-256",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 500.0,
					"side":    2000.0,
					"rear":    1500.0,
					"average": 1300.0,
				},
				"ir": map[string]any{
					"frontal": 200.0,
					"side":    400.0,
					"rear":    500.0,
				},
				"acoustic": map[string]any{
					"noise_level": 120.0,
					"frequency":   50.0,
				},
				"visual": map[string]any{
					"visibility": 0.9,
				},
			},
			Tags:       []string{"navy", "destroyer", "aegis", "nato"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
		{
			ID:           "eq_mq9",
			Code:         "MQ-9A",
			Name:         "MQ-9A Reaper",
			Category:     "uav",
			PlatformType: "aircraft",
			Description:  "美国空军中空长航时察打一体无人机",
			Version:      1,
			Status:       "active",
			PlatformParams: map[string]any{
				"max_speed":         482.0,
				"cruise_speed":      313.0,
				"min_speed":         150.0,
				"max_altitude":      15240.0,
				"min_altitude":      300.0,
				"ceiling":           15240.0,
				"range":             5926.0,
				"endurance":         27.0,
				"max_g":             3.0,
				"length":            11.0,
				"width":             20.1,
				"height":            3.8,
				"weight":            2223.0,
				"max_takeoff_weight": 4760.0,
				"fuel_capacity":     1800.0,
				"motion_model":      "6dof",
			},
			Sensors: []map[string]any{
				{
					"id":          "mts_b",
					"name":        "MTS-B Multi-Spectral Targeting System",
					"type":        "electro_optical",
					"enabled":     true,
					"max_range":   60.0,
					"min_range":   0.5,
					"fov_azimuth": 360.0,
					"sensitivity": 0.95,
				},
				{
					"id":            "an_zpy_1",
					"name":          "AN/ZPY-1 STARLite Radar",
					"type":          "synthetic_aperture_radar",
					"enabled":       true,
					"max_range":     100.0,
					"min_range":     1.0,
					"fov_azimuth":   120.0,
					"accuracy":      0.9,
				},
			},
			Weapons: []map[string]any{
				{
					"id":               "agm114_hellfire",
					"name":             "AGM-114 Hellfire",
					"type":             "missile",
					"quantity":         4,
					"max_range":        11.0,
					"min_range":        0.5,
					"max_speed":        1305.0,
					"warhead_type":     "tandem_HEAT",
					"warhead_weight":   8.0,
					"blast_radius":     15.0,
					"penetration":      1200.0,
					"guidance_type":    "semi_active_laser",
				},
			},
			Communications: []map[string]any{
				{
					"id":         "beyond_line_of_sight",
					"name":       "SATCOM BLOS",
					"type":       "satellite",
					"enabled":    true,
					"frequency":  1500.0,
					"bandwidth":  10.0,
					"max_range":  36000.0,
					"data_rate":  50.0,
					"encryption": "AES-256",
				},
			},
			SignatureParams: map[string]any{
				"rcs": map[string]any{
					"frontal": 0.5,
					"side":    1.5,
					"rear":    1.0,
					"average": 1.0,
				},
				"ir": map[string]any{
					"frontal": 3.0,
					"side":    5.0,
					"rear":    8.0,
				},
				"acoustic": map[string]any{
					"noise_level": 80.0,
					"frequency":   500.0,
				},
				"visual": map[string]any{
					"visibility": 0.3,
				},
			},
			Tags:       []string{"air_force", "uav", "reconnaissance", "strike", "nato"},
			CreatedBy:  "admin",
			UpdatedBy:  "admin",
			CreatedAt:  now,
			UpdatedAt:  now,
			VersionHistory: []any{},
		},
	}

	docs := make([]any, len(equipment))
	for i, eq := range equipment {
		docs[i] = eq
	}

	result, err := coll.InsertMany(ctx, docs)
	if err != nil {
		log.Fatalf("InsertMany: %v", err)
	}

	log.Printf("Inserted %d equipment records", len(result.InsertedIDs))

	// Print summary
	for _, eq := range equipment {
		data, _ := json.MarshalIndent(eq, "", "  ")
		log.Printf("--- %s (%s) ---\n%s\n", eq.Name, eq.Code, string(data))
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
