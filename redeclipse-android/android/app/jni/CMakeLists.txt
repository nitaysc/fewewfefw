# Native build for the Android port: SDL2 (shared, loaded by the Java side),
# SDL2_image and SDL2_mixer (static, using their built-in decoders) and the
# Red Eclipse client built for OpenGL ES 3 as libmain.so.
# scripts/prepare.sh places the sources in SDL/, SDL_image/, SDL_mixer/ and redeclipse/.
cmake_minimum_required(VERSION 3.18)
project(redeclipse_android C CXX)

set(SDL_SHARED ON CACHE BOOL "" FORCE)
set(SDL_STATIC OFF CACHE BOOL "" FORCE)
set(SDL_TEST OFF CACHE BOOL "" FORCE)
add_subdirectory(SDL)
# SDL_image and SDL_mixer are built static and look for a static SDL2; give them the shared one
if(NOT TARGET SDL2::SDL2-static)
    add_library(SDL2::SDL2-static ALIAS SDL2)
endif()

set(BUILD_SHARED_LIBS OFF)
foreach(opt SDL2IMAGE_VENDORED SDL2IMAGE_SAMPLES SDL2IMAGE_TESTS SDL2IMAGE_INSTALL
            SDL2IMAGE_AVIF SDL2IMAGE_JXL SDL2IMAGE_TIF SDL2IMAGE_WEBP SDL2IMAGE_SVG
            SDL2MIXER_VENDORED SDL2MIXER_SAMPLES SDL2MIXER_INSTALL SDL2MIXER_CMD
            SDL2MIXER_FLAC SDL2MIXER_GME SDL2MIXER_MOD SDL2MIXER_MIDI SDL2MIXER_OPUS SDL2MIXER_WAVPACK SDL2MIXER_MP3)
    set(${opt} OFF CACHE BOOL "" FORCE)
endforeach()
set(SDL2IMAGE_BACKEND_STB ON CACHE BOOL "" FORCE)
set(SDL2MIXER_VORBIS "STB" CACHE STRING "" FORCE)
add_subdirectory(SDL_image)
add_subdirectory(SDL_mixer)

set(RE ${CMAKE_CURRENT_SOURCE_DIR}/redeclipse/src)

add_library(enet STATIC
    ${RE}/enet/callbacks.c ${RE}/enet/compress.c ${RE}/enet/host.c ${RE}/enet/list.c
    ${RE}/enet/packet.c ${RE}/enet/peer.c ${RE}/enet/protocol.c ${RE}/enet/unix.c)
target_include_directories(enet PUBLIC ${RE}/enet/include)
target_compile_definitions(enet PRIVATE HAS_SOCKLEN_T=1)

set(RE_SOURCES
    shared/glescompat.cpp shared/crypto.cpp shared/geom.cpp shared/glemu.cpp shared/stream.cpp shared/tools.cpp shared/zip.cpp
    support/jsmn.c support/sqlite3.c
    engine/aa.cpp engine/bih.cpp engine/blend.cpp engine/cdpi.cpp engine/client.cpp engine/command.cpp engine/console.cpp
    engine/dynlight.cpp engine/grass.cpp engine/http.cpp engine/irc.cpp engine/light.cpp engine/main.cpp engine/master.cpp
    engine/material.cpp engine/menus.cpp engine/movie.cpp engine/normal.cpp engine/octa.cpp engine/octaedit.cpp
    engine/octarender.cpp engine/physics.cpp engine/pvs.cpp engine/rendergl.cpp engine/renderlights.cpp engine/rendermodel.cpp
    engine/renderparticles.cpp engine/rendersky.cpp engine/rendertext.cpp engine/renderva.cpp engine/server.cpp
    engine/serverbrowser.cpp engine/shader.cpp engine/sound.cpp engine/stain.cpp engine/texture.cpp engine/touch.cpp engine/ui.cpp
    engine/water.cpp engine/world.cpp engine/worldio.cpp engine/wind.cpp
    game/ai.cpp game/client.cpp game/capture.cpp game/defend.cpp game/bomber.cpp game/entities.cpp game/game.cpp
    game/hud.cpp game/physics.cpp game/projs.cpp game/scoreboard.cpp game/server.cpp game/waypoint.cpp game/weapons.cpp)
list(TRANSFORM RE_SOURCES PREPEND ${RE}/)

if(ANDROID)
    add_library(main SHARED ${RE_SOURCES})
else()
    # desktop build of the same configuration, used to check the port before an Android build
    add_executable(main ${RE_SOURCES})
endif()
target_include_directories(main PRIVATE ${RE} ${RE}/shared ${RE}/engine ${RE}/game ${RE}/support)
target_compile_definitions(main PRIVATE GLES VERSION_BUILD=0 VERSION_BRANCH="android" VERSION_REVISION="")
target_compile_options(main PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:-fno-exceptions -fno-rtti -Wno-invalid-offsetof -ffast-math>
    -fsigned-char -O3 -w)
target_link_libraries(main PRIVATE SDL2::SDL2 SDL2_image::SDL2_image-static SDL2_mixer::SDL2_mixer-static enet)
if(ANDROID)
    target_link_libraries(main PRIVATE GLESv3 EGL log android z)
else()
    find_package(ZLIB REQUIRED)
    target_link_libraries(main PRIVATE GLESv2 ZLIB::ZLIB X11 pthread dl)
endif()
