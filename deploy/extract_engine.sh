#!/bin/bash
# extract_engine.sh - Extract minimal headless AFSIM engine from full installation
# Usage: bash extract_engine.sh <source_dir> <dest_dir>
# Example: bash extract_engine.sh ../AFSim/afsim-2.9.0-win64 ./afsim-engine

set -e

SRC="${1:-../AFSim/afsim-2.9.0-win64}"
DST="${2:-./afsim-engine}"

if [ ! -d "$SRC/bin" ]; then
    echo "Error: Source directory does not contain bin/ - is this an AFSIM installation?"
    exit 1
fi

echo "Extracting minimal AFSIM engine from: $SRC"
echo "Destination: $DST"
echo ""

# === Core executables ===
echo "[1/6] Copying mission.exe..."
mkdir -p "$DST/bin"
cp "$SRC/bin/mission.exe" "$DST/bin/"

# === Core simulation DLLs (no OSG, no Qt) ===
echo "[2/6] Copying core DLLs..."
CORE_DLLS=(
    # WSF core
    wsf.dll wsf_mil.dll wsf_mil_parser.dll wsf_parser.dll
    wsf_cyber.dll wsf_space.dll wsf_spaceg.dll wsf_nx.dll
    wsf_mtt.dll wsf_ripr.dll wsf_weapon_server.dll
    wsf_util.dll wsf_grammar_check.dll wsf_l16.dll wsf_simdis.dll wsf_sosm.dll

    # Simulation support
    dis.dll packetio.dll p6dof.dll tracking_filters.dll
    brawler.dll usmtf.dll vespatk.dll vespatk_qt.dll
    mystic_lib.dll sosm.dll artificer.dll

    # Utility
    util.dll util_script.dll genio.dll geodata.dll
    tinyxml2.dll gdal303.dll geos.dll geos_c.dll
    proj_8_1.dll tiff.dll tiffxx.dll
    afperf.dll profiling.dll

    # Windows runtime (MSVC)
    msvcp140.dll msvcp140_1.dll msvcp140_2.dll
    vcruntime140.dll concrt140.dll ucrtbase.dll
)

# Copy api-ms-win-* DLLs
for dll in "$SRC"/bin/api-ms-win-*.dll; do
    cp "$dll" "$DST/bin/"
done

for dll in "${CORE_DLLS[@]}"; do
    if [ -f "$SRC/bin/$dll" ]; then
        cp "$SRC/bin/$dll" "$DST/bin/"
    else
        echo "  WARNING: $dll not found, skipping"
    fi
done

# === Grammar files ===
echo "[3/6] Copying grammar files..."
cp -r "$SRC/bin/mission_grammar" "$DST/bin/"
cp -r "$SRC/bin/grammar" "$DST/bin/" 2>/dev/null || true

# === WSF plugins ===
echo "[4/6] Copying simulation plugins..."
mkdir -p "$DST/bin/mission_plugins"
cp -r "$SRC/bin/mission_plugins/"*.dll "$DST/bin/mission_plugins/" 2>/dev/null || true
cp -r "$SRC/bin/wsf_plugins" "$DST/bin/" 2>/dev/null || true

# === Resources (minimal - data only, no models/shaders) ===
echo "[5/6] Copying minimal resources..."
mkdir -p "$DST/resources"
cp -r "$SRC/resources/data" "$DST/resources/"

# Maps are large and optional - copy only if requested
if [ "${3:-}" = "--with-maps" ]; then
    echo "  Including map data (this may take a while)..."
    cp -r "$SRC/resources/maps" "$DST/resources/"
else
    echo "  Skipping maps (use --with-maps as 3rd arg to include)"
    mkdir -p "$DST/resources/maps"
fi

# === Demos (minimal - base_types + simple_scenario only) ===
echo "[6/6] Copying minimal demos..."
mkdir -p "$DST/demos"
cp -r "$SRC/demos/base_types" "$DST/demos/"
cp -r "$SRC/demos/simple_scenario" "$DST/demos/"

# === Summary ===
echo ""
echo "=== Extraction Complete ==="
echo "Destination: $DST"
echo "Size:"
du -sh "$DST" 2>/dev/null || echo "  (size check unavailable)"
echo ""
echo "Contents:"
find "$DST" -maxdepth 2 -type d | sort
echo ""
echo "Excluded (not needed for headless simulation):"
echo "  - Qt5*.dll, utilqt.dll (GUI framework)"
echo "  - osg*.dll, osgEarth*.dll, osgPlugins (3D visualization)"
echo "  - SDL2.dll (input)"
echo "  - warlock.exe, wizard.exe, mystic.exe, engage.exe (GUI apps)"
echo "  - resources/models/ (3D models - visualization only)"
echo "  - resources/shaders/ (visualization only)"
echo "  - swdev/ (source code & build files)"
echo "  - documentation/, training/ (non-runtime)"
