// ============================================================
// AFSIM Seed Equipment — Curated Military Platforms
// US Navy CSG + OPFOR (Red Force)
// Each entry has proper side, spatialDomain, and categories
// ============================================================

export const SEED_AFSIM_CONFIGS: Record<string, any> = {
  // ==================== BLUE — US Navy ====================

  "cvn-78": {
    name: "CVN-78_Gerald_R_Ford",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue",
      icon: "CVN",
      marking: "CVN-78",
      destructible: true,
      spatialDomain: "surface",
      position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m",
      altitudeReference: "default",
      heading: "90 deg",
      pitch: "0 deg",
      roll: "0 deg",
      categories: ["carrier"],
      sensors: {
        "AN_SPY-3_MFR": {
          type: "WSF_RADAR_SENSOR", name: "AN_SPY-3_MFR", on: true, operational: true,
          frequency: "10 GHz", power: "100 kW", bandwidth: "1 GHz",
          maximumRange: "200 nm", sensitivity: "-110 dBm",
        },
        "AN_SPY-4_VSR": {
          type: "WSF_RADAR_SENSOR", name: "AN_SPY-4_VSR", on: true, operational: true,
          frequency: "3 GHz", power: "200 kW", bandwidth: "500 MHz",
          maximumRange: "400 nm", sensitivity: "-115 dBm",
        },
      },
      weapons: {
        "ESSM": {
          type: "WSF_WEAPON", name: "ESSM", on: true, operational: true,
          quantity: 120, maximumQuantity: 120, firingInterval: "2 sec",
          maximumSlantRange: "30 nm",
        },
        "RAM": {
          type: "WSF_WEAPON", name: "RAM", on: true, operational: true,
          quantity: 42, maximumQuantity: 42, firingInterval: "1 sec",
          maximumSlantRange: "10 nm",
        },
        "Phalanx_CIWS": {
          type: "WSF_WEAPON", name: "Phalanx_CIWS", on: true, operational: true,
          quantity: 9999, maximumQuantity: 9999, firingInterval: "0.1 sec",
          maximumSlantRange: "2 nm",
        },
      },
      comms: {
        "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, address: "CVN78", networkName: "LINK16_BLUE" },
        "SATCOM": { type: "WSF_COMM", name: "SATCOM", on: true, address: "CVN78-SAT", networkName: "SAT_BLUE" },
      },
      processors: { "NTDS": { type: "WSF_PROCESSOR", name: "NTDS", on: true } },
      movers: {
        "Nuclear_Reactor": {
          type: "WSF_SURFACE_MOVER", name: "Nuclear_Reactor", on: true,
          maximumSpeed: "30 kn", minimumSpeed: "0 kn", cruiseSpeed: "20 kn",
        },
      },
      fuels: {},
      zones: {},
      routers: {},
      commandChains: {},
      emptyMass: 100000, fuelMass: 0, payloadMass: 0,
      length: "337 m", width: "78 m",
    },
  },

  "cvn-76": {
    name: "CVN-76_Ronald_Reagan",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "CVN", marking: "CVN-76", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 24.5, longitude: 121.5 },
      altitude: "0 m", altitudeReference: "default", heading: "90 deg",
      pitch: "0 deg", roll: "0 deg",
      categories: ["carrier"],
      sensors: {
        "AN_SPY-1B": { type: "WSF_RADAR_SENSOR", name: "AN_SPY-1B", on: true, operational: true, frequency: "3 GHz", power: "150 kW", maximumRange: "350 nm" },
      },
      weapons: {
        "ESSM": { type: "WSF_WEAPON", name: "ESSM", on: true, quantity: 100, firingInterval: "2 sec", maximumSlantRange: "30 nm" },
        "RAM": { type: "WSF_WEAPON", name: "RAM", on: true, quantity: 42, firingInterval: "1 sec", maximumSlantRange: "10 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "NTDS": { type: "WSF_PROCESSOR", name: "NTDS", on: true } },
      movers: { "Nuclear_Reactor": { type: "WSF_SURFACE_MOVER", name: "Nuclear_Reactor", on: true, maximumSpeed: "30 kn", cruiseSpeed: "20 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "ddg-51": {
    name: "DDG-51_Arleigh_Burke",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "DDG", marking: "DDG-51", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 25.1, longitude: 122.1 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["destroyer"],
      sensors: {
        "AN_SPY-1D": { type: "WSF_RADAR_SENSOR", name: "AN_SPY-1D", on: true, operational: true, frequency: "3 GHz", power: "100 kW", maximumRange: "300 nm" },
        "AN_SPS-73": { type: "WSF_RADAR_SENSOR", name: "AN_SPS-73", on: true, operational: true, frequency: "9 GHz", maximumRange: "50 nm" },
      },
      weapons: {
        "SM-2": { type: "WSF_WEAPON", name: "SM-2", on: true, quantity: 90, firingInterval: "3 sec", maximumSlantRange: "100 nm" },
        "ESSM": { type: "WSF_WEAPON", name: "ESSM", on: true, quantity: 32, firingInterval: "2 sec", maximumSlantRange: "30 nm" },
        "Harpoon": { type: "WSF_WEAPON", name: "Harpoon", on: true, quantity: 8, firingInterval: "10 sec", maximumSlantRange: "70 nm" },
        "Phalanx_CIWS": { type: "WSF_WEAPON", name: "Phalanx_CIWS", on: true, quantity: 9999, firingInterval: "0.1 sec", maximumSlantRange: "2 nm" },
        "Tomahawk": { type: "WSF_WEAPON", name: "Tomahawk", on: true, quantity: 56, firingInterval: "10 sec", maximumSlantRange: "1000 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "NTDS": { type: "WSF_PROCESSOR", name: "NTDS", on: true } },
      movers: { "Gas_Turbine": { type: "WSF_SURFACE_MOVER", name: "Gas_Turbine", on: true, maximumSpeed: "31 kn", cruiseSpeed: "20 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "ddg-52": {
    name: "DDG-52_Barry",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "DDG", marking: "DDG-52", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 24.9, longitude: 121.9 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["destroyer"],
      sensors: { "AN_SPY-1D": { type: "WSF_RADAR_SENSOR", name: "AN_SPY-1D", on: true, operational: true, frequency: "3 GHz", maximumRange: "300 nm" } },
      weapons: {
        "SM-2": { type: "WSF_WEAPON", name: "SM-2", on: true, quantity: 90, maximumSlantRange: "100 nm" },
        "Harpoon": { type: "WSF_WEAPON", name: "Harpoon", on: true, quantity: 8, maximumSlantRange: "70 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "NTDS": { type: "WSF_PROCESSOR", name: "NTDS", on: true } },
      movers: { "Gas_Turbine": { type: "WSF_SURFACE_MOVER", name: "Gas_Turbine", on: true, maximumSpeed: "31 kn", cruiseSpeed: "20 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "cg-47": {
    name: "CG-47_Ticonderoga",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "CG", marking: "CG-47", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 25.2, longitude: 122.2 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["cruiser"],
      sensors: { "AN_SPY-1A": { type: "WSF_RADAR_SENSOR", name: "AN_SPY-1A", on: true, operational: true, frequency: "3 GHz", maximumRange: "350 nm" } },
      weapons: {
        "SM-2": { type: "WSF_WEAPON", name: "SM-2", on: true, quantity: 122, maximumSlantRange: "100 nm" },
        "Tomahawk": { type: "WSF_WEAPON", name: "Tomahawk", on: true, quantity: 26, maximumSlantRange: "1000 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "NTDS": { type: "WSF_PROCESSOR", name: "NTDS", on: true } },
      movers: { "Gas_Turbine": { type: "WSF_SURFACE_MOVER", name: "Gas_Turbine", on: true, maximumSpeed: "32 kn", cruiseSpeed: "20 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "ssn-774": {
    name: "SSN-774_Virginia",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "SSN", marking: "SSN-774", destructible: true,
      spatialDomain: "subsurface", position: { type: "latlon", latitude: 24.8, longitude: 122.3 },
      altitude: "-100 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["submarine"],
      sensors: {
        "BQQ-10": { type: "WSF_ACOUSTIC_SENSOR", name: "BQQ-10", on: true, operational: true, maximumRange: "50 nm" },
        "WLY-1": { type: "WSF_ACOUSTIC_SENSOR", name: "WLY-1", on: true, operational: true, maximumRange: "30 nm" },
      },
      weapons: {
        "Mk48_ADCAP": { type: "WSF_WEAPON", name: "Mk48_ADCAP", on: true, quantity: 38, maximumSlantRange: "20 nm" },
        "Tomahawk": { type: "WSF_WEAPON", name: "Tomahawk", on: true, quantity: 12, maximumSlantRange: "1000 nm" },
      },
      comms: { "VLF": { type: "WSF_COMM", name: "VLF", on: true, networkName: "SUB_BLUE" } },
      processors: { "BYG-1": { type: "WSF_PROCESSOR", name: "BYG-1", on: true } },
      movers: { "Nuclear_Propulsion": { type: "WSF_SUBSURFACE_MOVER", name: "Nuclear_Propulsion", on: true, maximumSpeed: "25 kn", cruiseSpeed: "15 kn", maximumAltitude: "0 m", minimumAltitude: "-400 m" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "fa18e": {
    name: "FA-18E_Super_Hornet",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "F18", marking: "VFA-14", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "AN_APG-79": { type: "WSF_RADAR_SENSOR", name: "AN_APG-79", on: true, operational: true, frequency: "10 GHz", power: "10 kW", maximumRange: "80 nm" },
        "AN_AAS-38": { type: "WSF_OPTICAL_SENSOR", name: "AN_AAS-38", on: true, operational: true, maximumRange: "40 nm" },
      },
      weapons: {
        "AIM-120C": { type: "WSF_WEAPON", name: "AIM-120C", on: true, quantity: 6, maximumSlantRange: "50 nm" },
        "AIM-9X": { type: "WSF_WEAPON", name: "AIM-9X", on: true, quantity: 2, maximumSlantRange: "10 nm" },
        "AGM-84_Harpoon": { type: "WSF_WEAPON", name: "AGM-84_Harpoon", on: true, quantity: 2, maximumSlantRange: "70 nm" },
        "AGM-88_HARM": { type: "WSF_WEAPON", name: "AGM-88_HARM", on: true, quantity: 2, maximumSlantRange: "50 nm" },
        "GBU-31_JDAM": { type: "WSF_WEAPON", name: "GBU-31_JDAM", on: true, quantity: 4, maximumSlantRange: "15 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "F414_Engine": {
          type: "WSF_AIR_MOVER", name: "F414_Engine", on: true,
          maximumSpeed: "1000 kn", minimumSpeed: "120 kn", cruiseSpeed: "480 kn",
          maximumAltitude: "50000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "15 deg/s", maximumG: 7.5,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "14400 lb", consumptionRate: "6000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "f35c": {
    name: "F-35C_Lightning_II",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "F35", marking: "VFA-101", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "AN_APG-81": { type: "WSF_RADAR_SENSOR", name: "AN_APG-81", on: true, operational: true, frequency: "10 GHz", power: "12 kW", maximumRange: "100 nm" },
        "AN_AAQ-37": { type: "WSF_OPTICAL_SENSOR", name: "AN_AAQ-37", on: true, operational: true, maximumRange: "60 nm" },
        "AN_ASQ-239": { type: "WSF_EW_SENSOR", name: "AN_ASQ-239", on: true, operational: true, maximumRange: "100 nm" },
      },
      weapons: {
        "AIM-120D": { type: "WSF_WEAPON", name: "AIM-120D", on: true, quantity: 4, maximumSlantRange: "70 nm" },
        "AIM-9X": { type: "WSF_WEAPON", name: "AIM-9X", on: true, quantity: 2, maximumSlantRange: "10 nm" },
        "AGM-154_JSOW": { type: "WSF_WEAPON", name: "AGM-154_JSOW", on: true, quantity: 4, maximumSlantRange: "70 nm" },
        "GBU-31_JDAM": { type: "WSF_WEAPON", name: "GBU-31_JDAM", on: true, quantity: 4, maximumSlantRange: "15 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" }, "MADL": { type: "WSF_COMM", name: "MADL", on: true, networkName: "F35_MESH" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "F135_Engine": {
          type: "WSF_AIR_MOVER", name: "F135_Engine", on: true,
          maximumSpeed: "1060 kn", minimumSpeed: "130 kn", cruiseSpeed: "500 kn",
          maximumAltitude: "50000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "14 deg/s", maximumG: 7.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "19750 lb", consumptionRate: "5500 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "e2d": {
    name: "E-2D_Advanced_Hawkeye",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "E2D", marking: "VAW-125", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["awacs"],
      sensors: {
        "AN_APY-9": { type: "WSF_RADAR_SENSOR", name: "AN_APY-9", on: true, operational: true, frequency: "3 GHz", power: "50 kW", maximumRange: "350 nm" },
        "AN_ALQ-217": { type: "WSF_EW_SENSOR", name: "AN_ALQ-217", on: true, operational: true, maximumRange: "200 nm" },
      },
      weapons: {},
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" }, "CEC": { type: "WSF_COMM", name: "CEC", on: true, networkName: "CEC_BLUE" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "T56_Engine": {
          type: "WSF_AIR_MOVER", name: "T56_Engine", on: true,
          maximumSpeed: "350 kn", minimumSpeed: "120 kn", cruiseSpeed: "260 kn",
          maximumAltitude: "35000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "5 deg/s", maximumG: 3.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "12400 lb", consumptionRate: "2000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "ea18g": {
    name: "EA-18G_Growler",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "EA18", marking: "VAQ-141", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "AN_APG-79": { type: "WSF_RADAR_SENSOR", name: "AN_APG-79", on: true, operational: true, frequency: "10 GHz", maximumRange: "80 nm" },
        "AN_ALQ-249": { type: "WSF_EW_SENSOR", name: "AN_ALQ-249", on: true, operational: true, maximumRange: "150 nm" },
      },
      weapons: {
        "AIM-120C": { type: "WSF_WEAPON", name: "AIM-120C", on: true, quantity: 2, maximumSlantRange: "50 nm" },
        "AGM-88E_AARGM": { type: "WSF_WEAPON", name: "AGM-88E_AARGM", on: true, quantity: 4, maximumSlantRange: "60 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "ICAP3": { type: "WSF_PROCESSOR", name: "ICAP3", on: true } },
      movers: {
        "F414_EW": {
          type: "WSF_AIR_MOVER", name: "F414_EW", on: true,
          maximumSpeed: "960 kn", minimumSpeed: "120 kn", cruiseSpeed: "460 kn",
          maximumAltitude: "50000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "14 deg/s", maximumG: 7.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "14400 lb", consumptionRate: "6000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "p8a": {
    name: "P-8A_Poseidon",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "P8A", marking: "VP-16", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["patrol"],
      sensors: {
        "AN_APY-10": { type: "WSF_RADAR_SENSOR", name: "AN_APY-10", on: true, operational: true, frequency: "10 GHz", maximumRange: "200 nm" },
        "ALQ-240": { type: "WSF_ACOUSTIC_SENSOR", name: "ALQ-240", on: true, operational: true, maximumRange: "100 nm" },
      },
      weapons: {
        "AGM-84_Harpoon": { type: "WSF_WEAPON", name: "AGM-84_Harpoon", on: true, quantity: 4, maximumSlantRange: "70 nm" },
        "Mk54_Torpedo": { type: "WSF_WEAPON", name: "Mk54_Torpedo", on: true, quantity: 5, maximumSlantRange: "10 nm" },
        "sonobuoy": { type: "WSF_WEAPON", name: "sonobuoy", on: true, quantity: 126, maximumSlantRange: "1 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "Mission_System": { type: "WSF_PROCESSOR", name: "Mission_System", on: true } },
      movers: {
        "CFM56": {
          type: "WSF_AIR_MOVER", name: "CFM56", on: true,
          maximumSpeed: "490 kn", minimumSpeed: "150 kn", cruiseSpeed: "410 kn",
          maximumAltitude: "41000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "3 deg/s", maximumG: 2.5,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "70000 lb", consumptionRate: "5000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "mh60r": {
    name: "MH-60R_Seahawk",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "H60", marking: "HSM-70", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 25.0, longitude: 122.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["helicopter"],
      sensors: {
        "AN_AQS-22": { type: "WSF_ACOUSTIC_SENSOR", name: "AN_AQS-22", on: true, operational: true, maximumRange: "30 nm" },
        "AN_APS-153": { type: "WSF_RADAR_SENSOR", name: "AN_APS-153", on: true, operational: true, frequency: "10 GHz", maximumRange: "100 nm" },
      },
      weapons: {
        "AGM-114_Hellfire": { type: "WSF_WEAPON", name: "AGM-114_Hellfire", on: true, quantity: 8, maximumSlantRange: "5 nm" },
        "Mk54_Torpedo": { type: "WSF_WEAPON", name: "Mk54_Torpedo", on: true, quantity: 3, maximumSlantRange: "10 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" } },
      processors: { "Common_Cockpit": { type: "WSF_PROCESSOR", name: "Common_Cockpit", on: true } },
      movers: {
        "T700_Engine": {
          type: "WSF_AIR_MOVER", name: "T700_Engine", on: true,
          maximumSpeed: "150 kn", minimumSpeed: "0 kn", cruiseSpeed: "120 kn",
          maximumAltitude: "12000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "30 deg/s", maximumG: 2.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "3600 lb", consumptionRate: "800 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "rc135": {
    name: "RC-135_Rivet_Joint",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "R135", marking: "55th Wing", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 26.0, longitude: 123.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["recon"],
      sensors: {
        "ELINT_System": { type: "WSF_EW_SENSOR", name: "ELINT_System", on: true, operational: true, maximumRange: "300 nm" },
        "COMINT_System": { type: "WSF_EW_SENSOR", name: "COMINT_System", on: true, operational: true, maximumRange: "400 nm" },
      },
      weapons: {},
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" }, "SATCOM": { type: "WSF_COMM", name: "SATCOM", on: true, networkName: "SAT_BLUE" } },
      processors: { "Rivet_Joint_System": { type: "WSF_PROCESSOR", name: "Rivet_Joint_System", on: true } },
      movers: {
        "CFM56_RC": {
          type: "WSF_AIR_MOVER", name: "CFM56_RC", on: true,
          maximumSpeed: "500 kn", minimumSpeed: "180 kn", cruiseSpeed: "420 kn",
          maximumAltitude: "45000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "2 deg/s", maximumG: 2.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "100000 lb", consumptionRate: "6000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "b2": {
    name: "B-2A_Spirit",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "B2", marking: "509th BW", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 27.0, longitude: 124.0 },
      altitude: "0 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["bomber"],
      sensors: {
        "AN_APQ-181": { type: "WSF_RADAR_SENSOR", name: "AN_APQ-181", on: true, operational: true, frequency: "15 GHz", maximumRange: "100 nm" },
        "ZSR-63": { type: "WSF_EW_SENSOR", name: "ZSR-63", on: true, operational: true, maximumRange: "200 nm" },
      },
      weapons: {
        "GBU-57_MOP": { type: "WSF_WEAPON", name: "GBU-57_MOP", on: true, quantity: 2, maximumSlantRange: "10 nm" },
        "GBU-38_JDAM": { type: "WSF_WEAPON", name: "GBU-38_JDAM", on: true, quantity: 80, maximumSlantRange: "15 nm" },
        "AGM-158_JASSM": { type: "WSF_WEAPON", name: "AGM-158_JASSM", on: true, quantity: 16, maximumSlantRange: "200 nm" },
      },
      comms: { "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" }, "SATCOM": { type: "WSF_COMM", name: "SATCOM", on: true, networkName: "SAT_BLUE" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "F118_Engine": {
          type: "WSF_AIR_MOVER", name: "F118_Engine", on: true,
          maximumSpeed: "550 kn", minimumSpeed: "150 kn", cruiseSpeed: "460 kn",
          maximumAltitude: "50000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "3 deg/s", maximumG: 3.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "167000 lb", consumptionRate: "8000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  // ==================== RED — OPFOR ====================

  "su30": {
    name: "Su-30_Flanker-C",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "SU30", marking: "Red-1", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 23.0, longitude: 120.0 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "Bars_Radar": { type: "WSF_RADAR_SENSOR", name: "Bars_Radar", on: true, operational: true, frequency: "10 GHz", power: "8 kW", maximumRange: "80 nm" },
        "OLS-30": { type: "WSF_OPTICAL_SENSOR", name: "OLS-30", on: true, operational: true, maximumRange: "50 nm" },
      },
      weapons: {
        "R-77": { type: "WSF_WEAPON", name: "R-77", on: true, quantity: 6, maximumSlantRange: "50 nm" },
        "R-73": { type: "WSF_WEAPON", name: "R-73", on: true, quantity: 2, maximumSlantRange: "10 nm" },
        "Kh-31": { type: "WSF_WEAPON", name: "Kh-31", on: true, quantity: 2, maximumSlantRange: "40 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "AL-31F": {
          type: "WSF_AIR_MOVER", name: "AL-31F", on: true,
          maximumSpeed: "1200 kn", minimumSpeed: "120 kn", cruiseSpeed: "450 kn",
          maximumAltitude: "55000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "18 deg/s", maximumG: 9.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "20700 lb", consumptionRate: "7000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "su35": {
    name: "Su-35_Flanker-E",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "SU35", marking: "Red-2", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 23.0, longitude: 120.0 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "Irbis_Radar": { type: "WSF_RADAR_SENSOR", name: "Irbis_Radar", on: true, operational: true, frequency: "10 GHz", power: "20 kW", maximumRange: "120 nm" },
        "OLS-35": { type: "WSF_OPTICAL_SENSOR", name: "OLS-35", on: true, operational: true, maximumRange: "60 nm" },
      },
      weapons: {
        "R-77-1": { type: "WSF_WEAPON", name: "R-77-1", on: true, quantity: 8, maximumSlantRange: "60 nm" },
        "R-74M": { type: "WSF_WEAPON", name: "R-74M", on: true, quantity: 2, maximumSlantRange: "12 nm" },
        "Kh-35": { type: "WSF_WEAPON", name: "Kh-35", on: true, quantity: 4, maximumSlantRange: "70 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "AL-41F1S": {
          type: "WSF_AIR_MOVER", name: "AL-41F1S", on: true,
          maximumSpeed: "1350 kn", minimumSpeed: "120 kn", cruiseSpeed: "480 kn",
          maximumAltitude: "59000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "20 deg/s", maximumG: 9.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "25400 lb", consumptionRate: "7500 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "j10c": {
    name: "J-10C_Vigorous_Dragon",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "J10", marking: "Red-3", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 23.0, longitude: 120.0 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["fighter"],
      sensors: {
        "KLJ-7A_Radar": { type: "WSF_RADAR_SENSOR", name: "KLJ-7A_Radar", on: true, operational: true, frequency: "10 GHz", power: "6 kW", maximumRange: "70 nm" },
      },
      weapons: {
        "PL-15": { type: "WSF_WEAPON", name: "PL-15", on: true, quantity: 4, maximumSlantRange: "80 nm" },
        "PL-10": { type: "WSF_WEAPON", name: "PL-10", on: true, quantity: 2, maximumSlantRange: "10 nm" },
        "YJ-83K": { type: "WSF_WEAPON", name: "YJ-83K", on: true, quantity: 2, maximumSlantRange: "50 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "WS-10B": {
          type: "WSF_AIR_MOVER", name: "WS-10B", on: true,
          maximumSpeed: "1200 kn", minimumSpeed: "120 kn", cruiseSpeed: "440 kn",
          maximumAltitude: "55000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "16 deg/s", maximumG: 8.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "13200 lb", consumptionRate: "5500 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "kuznetsov": {
    name: "Admiral_Kuznetsov",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "CV", marking: "CV-1", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 22.5, longitude: 119.5 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["carrier"],
      sensors: {
        "Sky_Watch": { type: "WSF_RADAR_SENSOR", name: "Sky_Watch", on: true, operational: true, frequency: "3 GHz", maximumRange: "300 nm" },
        "Top_Plate": { type: "WSF_RADAR_SENSOR", name: "Top_Plate", on: true, operational: true, frequency: "5 GHz", maximumRange: "100 nm" },
      },
      weapons: {
        "P-700_Granit": { type: "WSF_WEAPON", name: "P-700_Granit", on: true, quantity: 12, maximumSlantRange: "300 nm" },
        "Kinzhal_SAM": { type: "WSF_WEAPON", name: "Kinzhal_SAM", on: true, quantity: 192, maximumSlantRange: "20 nm" },
        "CADS-N1": { type: "WSF_WEAPON", name: "CADS-N1", on: true, quantity: 8, maximumSlantRange: "5 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Combat_Direction_Center": { type: "WSF_PROCESSOR", name: "Combat_Direction_Center", on: true } },
      movers: { "Steam_Turbine": { type: "WSF_SURFACE_MOVER", name: "Steam_Turbine", on: true, maximumSpeed: "29 kn", cruiseSpeed: "18 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "sovremenny": {
    name: "Sovremenny_Class_Destroyer",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "DD", marking: "DD-1", destructible: true,
      spatialDomain: "surface", position: { type: "latlon", latitude: 22.6, longitude: 119.6 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["destroyer"],
      sensors: {
        "Top_Dome": { type: "WSF_RADAR_SENSOR", name: "Top_Dome", on: true, operational: true, frequency: "5 GHz", maximumRange: "100 nm" },
        "Band_Spot": { type: "WSF_RADAR_SENSOR", name: "Band_Spot", on: true, operational: true, frequency: "10 GHz", maximumRange: "30 nm" },
      },
      weapons: {
        "P-270_Moskit": { type: "WSF_WEAPON", name: "P-270_Moskit", on: true, quantity: 8, maximumSlantRange: "70 nm" },
        "Shtil_SAM": { type: "WSF_WEAPON", name: "Shtil_SAM", on: true, quantity: 48, maximumSlantRange: "25 nm" },
        "AK-130": { type: "WSF_WEAPON", name: "AK-130", on: true, quantity: 9999, maximumSlantRange: "15 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Combat_Info_Center": { type: "WSF_PROCESSOR", name: "Combat_Info_Center", on: true } },
      movers: { "Steam_Turbine": { type: "WSF_SURFACE_MOVER", name: "Steam_Turbine", on: true, maximumSpeed: "32 kn", cruiseSpeed: "18 kn" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "kiilo": {
    name: "Kilo_Class_Submarine",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "SSK", marking: "SSK-1", destructible: true,
      spatialDomain: "subsurface", position: { type: "latlon", latitude: 22.0, longitude: 119.0 },
      altitude: "-150 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["submarine"],
      sensors: {
        "MGK-400": { type: "WSF_ACOUSTIC_SENSOR", name: "MGK-400", on: true, operational: true, maximumRange: "30 nm" },
      },
      weapons: {
        "53-65K_Torpedo": { type: "WSF_WEAPON", name: "53-65K_Torpedo", on: true, quantity: 18, maximumSlantRange: "15 nm" },
        "Kalibr_SLCM": { type: "WSF_WEAPON", name: "Kalibr_SLCM", on: true, quantity: 4, maximumSlantRange: "1000 nm" },
      },
      comms: { "VLF": { type: "WSF_COMM", name: "VLF", on: true, networkName: "SUB_RED" } },
      processors: { "Combat_System": { type: "WSF_PROCESSOR", name: "Combat_System", on: true } },
      movers: { "Diesel_Electric": { type: "WSF_SUBSURFACE_MOVER", name: "Diesel_Electric", on: true, maximumSpeed: "17 kn", cruiseSpeed: "7 kn", maximumAltitude: "0 m", minimumAltitude: "-300 m" } },
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "s300": {
    name: "S-300PMU2_Favorite",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "SAM", marking: "SAM-1", destructible: true,
      spatialDomain: "land", position: { type: "latlon", latitude: 22.0, longitude: 118.0 },
      altitude: "0 m", heading: "0 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["sam"],
      sensors: {
        "30N6E1_Radar": { type: "WSF_RADAR_SENSOR", name: "30N6E1_Radar", on: true, operational: true, frequency: "5 GHz", power: "150 kW", maximumRange: "200 nm" },
        "76N6_Radar": { type: "WSF_RADAR_SENSOR", name: "76N6_Radar", on: true, operational: true, frequency: "3 GHz", maximumRange: "150 nm" },
      },
      weapons: {
        "48N6E2_SAM": { type: "WSF_WEAPON", name: "48N6E2_SAM", on: true, quantity: 48, maximumSlantRange: "100 nm" },
        "9M96E2_SAM": { type: "WSF_WEAPON", name: "9M96E2_SAM", on: true, quantity: 32, maximumSlantRange: "70 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Fire_Control": { type: "WSF_PROCESSOR", name: "Fire_Control", on: true } },
      movers: {},
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "hq9": {
    name: "HQ-9_Long_Bow",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "SAM", marking: "SAM-2", destructible: true,
      spatialDomain: "land", position: { type: "latlon", latitude: 22.5, longitude: 118.5 },
      altitude: "0 m", heading: "0 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["sam"],
      sensors: {
        "HT-233_Radar": { type: "WSF_RADAR_SENSOR", name: "HT-233_Radar", on: true, operational: true, frequency: "5 GHz", power: "120 kW", maximumRange: "200 nm" },
      },
      weapons: {
        "HQ-9_SAM": { type: "WSF_WEAPON", name: "HQ-9_SAM", on: true, quantity: 48, maximumSlantRange: "80 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Fire_Control": { type: "WSF_PROCESSOR", name: "Fire_Control", on: true } },
      movers: {},
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "tu22m": {
    name: "Tu-22M3_Backfire",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "T22M", marking: "Red-Bomber", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 21.0, longitude: 117.0 },
      altitude: "0 m", heading: "270 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["bomber"],
      sensors: {
        "PNK_Radar": { type: "WSF_RADAR_SENSOR", name: "PNK_Radar", on: true, operational: true, frequency: "10 GHz", maximumRange: "120 nm" },
      },
      weapons: {
        "Kh-22_Missile": { type: "WSF_WEAPON", name: "Kh-22_Missile", on: true, quantity: 3, maximumSlantRange: "300 nm" },
        "Kh-32_Missile": { type: "WSF_WEAPON", name: "Kh-32_Missile", on: true, quantity: 3, maximumSlantRange: "400 nm" },
      },
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "Mission_Computer": { type: "WSF_PROCESSOR", name: "Mission_Computer", on: true } },
      movers: {
        "NK-25": {
          type: "WSF_AIR_MOVER", name: "NK-25", on: true,
          maximumSpeed: "1050 kn", minimumSpeed: "160 kn", cruiseSpeed: "500 kn",
          maximumAltitude: "45000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "5 deg/s", maximumG: 3.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "110000 lb", consumptionRate: "12000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  "an12": {
    name: "YJ-12_Anti_Ship_Missile",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "YJ12", marking: "Missile-1", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 22.0, longitude: 119.0 },
      altitude: "10000 m", heading: "90 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["missile"],
      sensors: {
        "Active_Radar": { type: "WSF_RADAR_SENSOR", name: "Active_Radar", on: true, operational: true, frequency: "15 GHz", maximumRange: "30 nm" },
      },
      weapons: {
        "Warhead": { type: "WSF_WEAPON", name: "Warhead", on: true, quantity: 1, maximumSlantRange: "0.1 nm" },
      },
      comms: {},
      processors: { "Guidance": { type: "WSF_PROCESSOR", name: "Guidance", on: true } },
      movers: {
        "Ramjet": {
          type: "WSF_GUIDED_MOVER", name: "Ramjet", on: true,
          maximumSpeed: "2100 kn", cruiseSpeed: "2000 kn",
          maximumAltitude: "40000 ft", thrustDuration: "300 sec",
        },
      },
      fuels: { "Rocket_Fuel": { type: "WSF_FUEL", name: "Rocket_Fuel", initialQuantity: "500 kg" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },

  // ==================== COMMAND POSTS ====================

  "blue_c2": {
    name: "Blue_C2_Command_Post",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "blue", icon: "C2", marking: "C2-1", destructible: true,
      spatialDomain: "land", position: { type: "latlon", latitude: 25.3, longitude: 121.8 },
      altitude: "0 m", heading: "0 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["command"],
      sensors: {},
      weapons: {},
      comms: {
        "Link-16": { type: "WSF_COMM", name: "Link-16", on: true, networkName: "LINK16_BLUE" },
        "SATCOM": { type: "WSF_COMM", name: "SATCOM", on: true, networkName: "SAT_BLUE" },
      },
      processors: { "C2_System": { type: "WSF_PROCESSOR", name: "C2_System", on: true } },
      movers: {},
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  "red_c2": {
    name: "Red_C2_Command_Post",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "red", icon: "C2", marking: "C2-1", destructible: true,
      spatialDomain: "land", position: { type: "latlon", latitude: 22.2, longitude: 118.2 },
      altitude: "0 m", heading: "0 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["command"],
      sensors: {},
      weapons: {},
      comms: { "DataLink": { type: "WSF_COMM", name: "DataLink", on: true, networkName: "LINK_RED" } },
      processors: { "C2_System": { type: "WSF_PROCESSOR", name: "C2_System", on: true } },
      movers: {},
      fuels: {}, zones: {}, routers: {}, commandChains: {},
    },
  },

  // ==================== NEUTRAL ====================

  "p3c": {
    name: "P-3C_Orion",
    parentType: "WSF_PLATFORM",
    platform: {
      side: "neutral", icon: "P3C", marking: "Neutral-1", destructible: true,
      spatialDomain: "air", position: { type: "latlon", latitude: 26.0, longitude: 124.0 },
      altitude: "0 m", heading: "180 deg", pitch: "0 deg", roll: "0 deg",
      categories: ["patrol"],
      sensors: {
        "AN_APS-137": { type: "WSF_RADAR_SENSOR", name: "AN_APS-137", on: true, operational: true, frequency: "10 GHz", maximumRange: "200 nm" },
      },
      weapons: {
        "Mk46_Torpedo": { type: "WSF_WEAPON", name: "Mk46_Torpedo", on: true, quantity: 4, maximumSlantRange: "8 nm" },
      },
      comms: { "HF": { type: "WSF_COMM", name: "HF", on: true, networkName: "NEUTRAL_HF" } },
      processors: { "Mission_System": { type: "WSF_PROCESSOR", name: "Mission_System", on: true } },
      movers: {
        "T56_P3": {
          type: "WSF_AIR_MOVER", name: "T56_P3", on: true,
          maximumSpeed: "410 kn", minimumSpeed: "130 kn", cruiseSpeed: "330 kn",
          maximumAltitude: "28000 ft", minimumAltitude: "0 ft",
          maximumTurnRate: "3 deg/s", maximumG: 2.0,
        },
      },
      fuels: { "Internal_Fuel": { type: "WSF_FUEL", name: "Internal_Fuel", initialQuantity: "60000 lb", consumptionRate: "4000 lb/hr" } },
      zones: {}, routers: {}, commandChains: {},
    },
  },
};
