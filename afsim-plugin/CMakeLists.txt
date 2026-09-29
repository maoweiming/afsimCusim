cmake_minimum_required(VERSION 3.16)
project(wsf_event_gateway)

# ---------------------------------------------------------------------------
# AFSIM root - point at the AFSIM installation directory
# ---------------------------------------------------------------------------
if(NOT DEFINED AFSIM_ROOT)
   if(DEFINED ENV{AFSIM_ROOT})
      set(AFSIM_ROOT $ENV{AFSIM_ROOT})
   else()
      set(AFSIM_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../AFSim/afsim-2.9.0-win64")
   endif()
endif()

message(STATUS "AFSIM_ROOT: ${AFSIM_ROOT}")

# AFSIM build output directory (contains generated _export.h headers)
if(NOT DEFINED AFSIM_BUILD_DIR)
   if(DEFINED ENV{AFSIM_BUILD_DIR})
      set(AFSIM_BUILD_DIR $ENV{AFSIM_BUILD_DIR})
   else()
      set(AFSIM_BUILD_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../AFSim/afsim-build")
   endif()
endif()
message(STATUS "AFSIM_BUILD_DIR: ${AFSIM_BUILD_DIR}")

# ---------------------------------------------------------------------------
# Protobuf - use AFSIM's bundled protobuf 3.9.1
# ---------------------------------------------------------------------------
set(PROTOBUF_ROOT "${AFSIM_ROOT}/swdev/dependencies/3rd_party/protobuf")

set(Protobuf_INCLUDE_DIR "${PROTOBUF_ROOT}/include")
set(Protobuf_LIBRARY "${PROTOBUF_ROOT}/lib/libprotobuf-lite.lib")
set(Protobuf_LIBRARY_DEBUG "${PROTOBUF_ROOT}/lib/libprotobuf-lited.lib")
set(Protobuf_PROTOC_EXECUTABLE "${PROTOBUF_ROOT}/bin/protoc.exe")

# Verify protoc exists
if(NOT EXISTS "${Protobuf_PROTOC_EXECUTABLE}")
   message(FATAL_ERROR "protoc not found at: ${Protobuf_PROTOC_EXECUTABLE}")
endif()

# ---------------------------------------------------------------------------
# Generate protobuf sources
# ---------------------------------------------------------------------------
set(PROTO_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/proto")
set(GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${GENERATED_DIR}")

set(PROTO_FILES
   "${PROTO_SRC_DIR}/afsim_events.proto"
   "${PROTO_SRC_DIR}/afsim_control.proto"
)

set(PROTO_SRCS
   "${GENERATED_DIR}/afsim_events.pb.cc"
   "${GENERATED_DIR}/afsim_control.pb.cc"
)
set(PROTO_HDRS
   "${GENERATED_DIR}/afsim_events.pb.h"
   "${GENERATED_DIR}/afsim_control.pb.h"
)

add_custom_command(OUTPUT ${PROTO_SRCS} ${PROTO_HDRS}
   COMMAND "${Protobuf_PROTOC_EXECUTABLE}"
     --cpp_out="${GENERATED_DIR}"
     --proto_path="${PROTO_SRC_DIR}"
     "${PROTO_SRC_DIR}/afsim_events.proto"
     "${PROTO_SRC_DIR}/afsim_control.proto"
   DEPENDS ${PROTO_FILES}
   COMMENT "Generating protobuf C++ sources"
)

set_source_files_properties(${PROTO_SRCS} ${PROTO_HDRS} PROPERTIES GENERATED TRUE)

# ---------------------------------------------------------------------------
# Plugin sources
# ---------------------------------------------------------------------------
set(PLUGIN_SRCS
   source/WsfEventGatewayPlugin.cpp
   source/WsfEventGatewayScenarioExt.cpp
   source/WsfEventGatewaySimExt.cpp
   source/WsfEventGatewayPipe.cpp
   source/WsfEventGatewayControl.cpp
)

# ---------------------------------------------------------------------------
# Build shared library (DLL)
# ---------------------------------------------------------------------------
add_library(${PROJECT_NAME} SHARED
   ${PLUGIN_SRCS}
   ${PROTO_SRCS}
   ${PROTO_HDRS}
)

target_include_directories(${PROJECT_NAME} PUBLIC
   "${CMAKE_CURRENT_SOURCE_DIR}/source"
   "${GENERATED_DIR}"
   "${Protobuf_INCLUDE_DIR}"
)

# AFSIM include paths
set(WSF_SRC "${AFSIM_ROOT}/swdev/src/core/wsf/source")
set(WSF_MIL_SRC "${AFSIM_ROOT}/swdev/src/core/wsf_mil/source")
set(UTIL_SRC "${AFSIM_ROOT}/swdev/src/tools/util/source")

# AFSIM source directories
set(WSF_SRC "${AFSIM_ROOT}/swdev/src/core/wsf/source")
set(WSF_MIL_SRC "${AFSIM_ROOT}/swdev/src/core/wsf_mil/source")
set(UTIL_SRC "${AFSIM_ROOT}/swdev/src/tools/util/source")

# Collect ALL AFSIM source subdirectories for includes
file(GLOB AFSIM_CORE_DIRS LIST_DIRECTORIES true
   "${AFSIM_ROOT}/swdev/src/core/*/source"
   "${AFSIM_ROOT}/swdev/src/core/*/source/*"
)
file(GLOB AFSIM_TOOLS_DIRS LIST_DIRECTORIES true
   "${AFSIM_ROOT}/swdev/src/tools/*/source"
   "${AFSIM_ROOT}/swdev/src/tools/*/source/*"
)
file(GLOB AFSIM_BUILD_DIRS LIST_DIRECTORIES true
   "${AFSIM_BUILD_DIR}/*/source"
   "${AFSIM_BUILD_DIR}/build_*/source"
   "${AFSIM_BUILD_DIR}/*"
)

target_include_directories(${PROJECT_NAME} PRIVATE
   "${AFSIM_ROOT}/swdev/src"
   ${AFSIM_CORE_DIRS}
   ${AFSIM_TOOLS_DIRS}
   ${AFSIM_BUILD_DIRS}
   "${AFSIM_BUILD_DIR}/include"
   "${AFSIM_BUILD_DIR}/wsf/source/include"
)

# ---------------------------------------------------------------------------
# Link libraries - use AFSIM's import libs directly
# ---------------------------------------------------------------------------
set(AFSIM_LIB_DIR "${AFSIM_ROOT}/bin/lib")

target_link_libraries(${PROJECT_NAME} PRIVATE
   "${AFSIM_LIB_DIR}/wsf.lib"
   "${AFSIM_LIB_DIR}/wsf_mil.lib"
   "${AFSIM_LIB_DIR}/wsf_parser.lib"
   "${AFSIM_LIB_DIR}/util.lib"
   "${AFSIM_LIB_DIR}/genio.lib"
   "${AFSIM_LIB_DIR}/dis.lib"
   "${AFSIM_LIB_DIR}/packetio.lib"
   "${AFSIM_LIB_DIR}/geodata.lib"
   "${AFSIM_LIB_DIR}/tracking_filters.lib"
   "${AFSIM_LIB_DIR}/util_script.lib"
   "${Protobuf_LIBRARY}"
)

# ---------------------------------------------------------------------------
# Compiler settings
# ---------------------------------------------------------------------------
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_11)

if(MSVC)
   target_compile_options(${PROJECT_NAME} PRIVATE
      /wd4251   # DLL interface warning
      /wd4275   # DLL interface warning
      /W3
   )
   target_compile_definitions(${PROJECT_NAME} PRIVATE
      _WIN32_WINNT=0x0601
      WIN32_LEAN_AND_MEAN
      NOMINMAX
      PROMOTE_HARDWARE_EXCEPTIONS
   )
endif()

# ---------------------------------------------------------------------------
# Install - copy DLL to AFSIM plugin directory
# ---------------------------------------------------------------------------
install(TARGETS ${PROJECT_NAME}
   RUNTIME DESTINATION "${AFSIM_ROOT}/bin/wsf_plugins"
   LIBRARY DESTINATION "${AFSIM_ROOT}/bin/wsf_plugins"
)
