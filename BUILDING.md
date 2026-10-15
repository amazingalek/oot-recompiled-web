# Building the web page

This fork's `main` is OoT: Recompiled built with [Emscripten](https://emscripten.org) into a page,
`OoTRecompiled.html`, that draws through WebGPU. The desktop build is upstream's, unchanged (the README says how);
everything for the page is behind `__EMSCRIPTEN__` or in `web/` and `tools/`. `lib/rt64`, `lib/N64ModernRuntime` and
`lib/RmlUi` are upstream's own submodules, at its commits, and
[N64Recomp-browser](https://github.com/amazingalek/N64Recomp-browser) (`lib/N64Recomp-browser`) patches the checkouts
of rt64 and the runtime with the web support. `web/page.cmake`'s header says what else differs on a page.

## What it needs

Linux (or WSL) with:

- the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html), installed and activated;
- [naga](https://github.com/gfx-rs/wgpu/tree/trunk/naga) on `PATH` (`cargo install naga-cli`), which turns the
  shaders into WGSL;
- clang with a MIPS target and `ld.lld` (Ubuntu's `clang` and `lld`), for `patches/`, and a host clang for the
  recompiler;
- CMake 3.20 or later, Ninja, git, Python 3 with `venv`;
- ccache on `PATH`, optional, which makes a second build far shorter (N64Recomp-browser's `frontend/build_speed.cmake`);
- your own Ocarina of Time ROM, NTSC-U 1.0 (sha1 `ad69c91157f6705e8ab06c79fe08aad47bb57ba7`).

The symbol tables (`OoTRecompSyms/`) are committed, so the decompilation in `lib/oot` is only read: its headers for the
patches and its `decompress_baserom.py` for the ROM.

## Building

```bash
git clone --recurse-submodules https://github.com/amazingalek/oot-recompiled-web
cd oot-recompiled-web
tools/build_web.sh path/to/your/rom.z64
```

`tools/build_web.sh` (its header says each step) patches the submodules, decompresses the ROM into `build/` (once; it
is never committed), builds N64Recomp from the patched checkout, the patches, recompiles the game and the two RSP
microcodes, and builds the page in `build-web`. Run it again after a pull: each step redoes only what changed. A first
build compiles about 830 files; `WEB_CMAKE_ARGS=-DN64RECOMP_BROWSER_FAST_LINK=ON` links at -O1 for a quick try (a page
people play links at -O3).

Serve `build-web` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (the
page's threads need SharedArrayBuffer), and open `OoTRecompiled.html` in Chrome or Edge, or in Firefox 141 or later on
Windows. Load ROM opens the browser's file picker, and the ROM is then kept in the browser's storage, with the saves
and settings. N64Recomp-browser's `tools/publish_page.sh` publishes the build dir on GitHub Pages, where
`coi_serviceworker.js` sets those headers.

## On a page

- The launcher asks nothing about updates or a copy of the ROM, and has no Quit or window buttons; the ROM row and
  Load ROM open the browser's file picker (N64Recomp-browser's `frontend/file_picker.h`).
- Sound plays on the browser's audio thread (N64Recomp-browser's `frontend/audio_output.h`).
- The page's window is the canvas, the page's size: the launcher and the game don't shape it. The launcher scales with
  the canvas's height (RmlUi's dp ratio, the height over 720, not below 0.75), so it fills a 4K canvas as it fills a
  laptop's window.
- RT64's render to RAM stays on, as on the desktop, with the exact copy: the pause menu's background is the frame the
  game copies out of the framebuffer, and `z_play.c` flushes the task queue and filters that copy on the CPU at once
  (`PreRender_ApplyFilters`), as Majora's Mask does; a copy that lands a display list late (RT64's `renderToRAMLate`)
  would not be there yet.
- A first visit starts with Resolution at Match the window (the canvas's size) and Frame rate at Match the display: the
  game's 20 frames a second, RT64 interpolating between them up to the display's rate. The desktop build starts with
  the console's picture, 320x240 at 20 (`machine_defaults` in `src/ui/ui_settings.cpp`).

## The shader list

The page builds the shaders the game uses before it draws with them, so it never draws with RT64's slow ubershader in
the middle of play: `src/rt64_shaders.txt` lists them in sections (its header says what each one holds), and the build
specializes each one (`RT64_PREBUILT_SHADER_LIST`, `web/page.cmake`). In Chrome the whole list is built behind the game
from its first frame, and the game waits only when a frame wants 4 or more of a section's shaders that aren't built
yet, under a small "Preparing graphics" indicator in a corner. Firefox builds a pipeline in line with the rest of its
GPU work, so there those above the first section are built before the game starts, and a region's section when the
game first draws there, the game waiting.

`bash tools/record_shaders.sh <build dir> <ROM>` records the list (its header says how): N64Recomp-browser's recorder
drives the page in headless Chrome through `tools/shader_plan.json`, a page load a section, and `tools/shader_survey.js`
loads File 1 (making it on a new profile), skips the new file's opening cutscene, and warps to each place of a region
through `Module._oot_web_warp` (`web/survey.cpp`, which asks for the warp the debug menu's Warp rows ask for).
`tools/play_plan.json` is what N64Recomp-browser's `tools/play_page.mjs` plays to measure the page.

## Played

On 2026-10-15, a local build of main e51ed04 (N64Recomp-browser 1d0d24a), Chrome 155 headless and Firefox 158, an RTX
2070, a busy host (34-45%), a cold profile each, by `tools/play_plan.json` (N64Recomp-browser's `tools/play_page.mjs`):
the title, File 1, Link's house, Kokiri Forest, the pause menu, Hyrule Field, the market and the Forest Temple as an
adult, about 155 s of play each:

```
                  presents/s   frame gaps        sound frames   waits for the shader list (s, shaders)
                  median  p10  p99 ms  longest   short of ~6M
Chrome 1256x645    59.2   48.5   21    8.0 s        536          none
Firefox 1256x645   55.0   35.2   33    4.0 s      2,824          4.9 (58), 1.3 (26), 3.0 (65), 3.8 (57), 0.7 (12)
Chrome 3840x2000   59.1   51.4   22    8.0 s      4,784          none
Firefox 3840x2000  54.2   38.4   36    4.0 s        168          5.6 (58), 1.4 (26), 2.9 (65), 3.8 (57), 0.7 (12)
```

No WebGPU errors and no exceptions in any run, the GPU 33-40% busy. Firefox's waits are the boot's section before the
first frame, then the menus' after Start, Kokiri Forest's, the market's and the Forest Temple's as the game first draws
there; between them it draws 55-60, and its median holds the waits. Chrome builds the list behind the game, all 455
pipelines 45-60 s in, and waits for none. In Chrome the first load of a scene (the file into Link's house, the first
warp into the house) can hold the picture 3-8 s: one present's GPU work comes back seconds late (`?present-stats`: 3.3
s), the page's own thread is free (one long task of 0.4 s in the run) and the sound plays on, but keys sent meanwhile
can be lost. A later load of the same scene doesn't, and 100 s with no input (the title and the attract demo, the whole
list building behind them) had no frame gap over 50 ms: it is Chrome's GPU process doing something in line the first
time, not the list.

From Pages (main 16285f5), cold, 3840x2000 (a stand-in for a laptop's integrated graphics), 25 s of the game running
by itself after Start: Chrome 59.6 presents a second, Firefox 59.2 after its 4.9 s wait for the boot's 58; no WebGPU
errors.

Sound is short in the first seconds after the launcher and in Firefox's waits, nowhere else. Chrome with a window
(`--headed`) on an earlier build of the same list: 59.2 presents a second.
