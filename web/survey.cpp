// The page's way in for a script that drives the game (tools/shader_survey.js, which records the shader list a place
// at a time): a warp to an entrance, asked for the way the debug menu and --warp ask for one and taken by
// patches/harness_warp.c at the game's next frame in play (game mode 0). JavaScript calls it as
// Module._oot_web_warp(entrance), with the entrance indices of src/game/warp_table.ntsc-1.0.h. Built only by
// web/page.cmake.
#include <cstdint>

#include <emscripten.h>

#include "game/game_state.h"

extern "C" EMSCRIPTEN_KEEPALIVE void oot_web_warp(int32_t entrance) {
    oot::game_state::set_pending_warp(entrance);
}
