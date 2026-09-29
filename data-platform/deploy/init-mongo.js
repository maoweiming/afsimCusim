// ──────────────────────────────────────────────────────────────
// TrueSim – MongoDB Initialization Script
// ──────────────────────────────────────────────────────────────
// This script runs automatically when the MongoDB container
// starts for the first time. It creates databases, collections,
// and indexes for each service.
// ──────────────────────────────────────────────────────────────

print("=== TrueSim MongoDB Initialization ===");

// ─── Equipment Service Database ──────────────────────────────

print("Setting up truesim_equipment database...");
const equipDB = db.getSiblingDB("truesim_equipment");

equipDB.createCollection("platforms", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "type"],
      properties: {
        name: { bsonType: "string", description: "Platform name" },
        type: { bsonType: "string", description: "Platform type" },
        status: { bsonType: "string" },
      },
    },
  },
});

equipDB.platforms.createIndex({ name: 1 }, { unique: true });
equipDB.platforms.createIndex({ type: 1 });
equipDB.platforms.createIndex({ status: 1 });
equipDB.platforms.createIndex({ updatedAt: -1 });

equipDB.createCollection("sensors");
equipDB.sensors.createIndex({ platformId: 1 });
equipDB.sensors.createIndex({ name: 1 }, { unique: true });
equipDB.sensors.createIndex({ type: 1 });

equipDB.createCollection("weapons");
equipDB.weapons.createIndex({ platformId: 1 });
equipDB.weapons.createIndex({ name: 1 }, { unique: true });
equipDB.weapons.createIndex({ type: 1 });

print("  truesim_equipment: platforms, sensors, weapons collections created");

// ─── Scenario Service Database ───────────────────────────────

print("Setting up scenario database...");
const scenarioDB = db.getSiblingDB("scenario");

scenarioDB.createCollection("scenarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name"],
      properties: {
        name: { bsonType: "string", description: "Scenario name" },
        description: { bsonType: "string" },
        status: { bsonType: "string" },
      },
    },
  },
});

scenarioDB.scenarios.createIndex({ name: 1 });
scenarioDB.scenarios.createIndex({ status: 1 });
scenarioDB.scenarios.createIndex({ createdAt: -1 });
scenarioDB.scenarios.createIndex({ updatedAt: -1 });
scenarioDB.scenarios.createIndex({ tags: 1 });

scenarioDB.createCollection("scenario_versions");
scenarioDB.scenario_versions.createIndex({ scenarioId: 1, version: 1 }, { unique: true });

scenarioDB.createCollection("scenario_deployments");
scenarioDB.scenario_deployments.createIndex({ scenarioId: 1 });
scenarioDB.scenario_deployments.createIndex({ status: 1 });
scenarioDB.scenario_deployments.createIndex({ startedAt: -1 });

print("  scenario: scenarios, scenario_versions, scenario_deployments collections created");

// ─── Geospatial Service Database ─────────────────────────────

print("Setting up geospatial database...");
const geoDB = db.getSiblingDB("geospatial");

geoDB.createCollection("geofences");
geoDB.geofences.createIndex({ geometry: "2dsphere" });
geoDB.geofences.createIndex({ name: 1 });
geoDB.geofences.createIndex({ type: 1 });

geoDB.createCollection("terrain");
geoDB.terrain.createIndex({ bounds: "2dsphere" });
geoDB.terrain.createIndex({ name: 1 });

geoDB.createCollection("waypoints");
geoDB.waypoints.createIndex({ location: "2dsphere" });
geoDB.waypoints.createIndex({ scenarioId: 1 });
geoDB.waypoints.createIndex({ name: 1 });

geoDB.createCollection("spatial_references");
geoDB.spatial_references.createIndex({ srid: 1 }, { unique: true });

print("  geospatial: geofences, terrain, waypoints, spatial_references collections created");

print("=== MongoDB Initialization Complete ===");
