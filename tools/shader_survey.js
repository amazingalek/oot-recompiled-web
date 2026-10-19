// Evaluated in the page by N64Recomp-browser's tools/record_shaders.mjs and tools/play_page.mjs (tools/shader_plan.json,
// tools/play_plan.json), to reach any place in the game by code, without anyone playing: the web page's
// Module._oot_web_warp (web/survey.cpp) asks for a warp as the debug menu's Warp rows and --warp do, and
// patches/harness_warp.c takes it at the game's next frame in play. The entrances are those of
// src/game/warp_table.ntsc-1.0.h.
//
// - play(intro) resolves once the game is in play with File 1 loaded, from the title screen: Start until the file
//   select, then A on File 1. A profile with no file goes through name entry (one letter, Start for END, A) and then
//   loads the new file the same way. A new file opens with its opening cutscene (the Deku Tree, Navi, Link waking),
//   minutes long, and a warp while it plays lands in a cutscene layer or not at all; so unless intro is true, the
//   cutscene the save has armed is cleared as the file select hands over to play (game mode 0), before the play
//   state reads it, and Link starts in his house. False after 120 s.
// - warp(entrance, age) goes there as a child (age 1, the new file's) or an adult (0), and resolves once the save's
//   entrance is the one asked for and the scene has drawn for 3 s; false after 60 s. The age is the play state's
//   linkAgeOnLoad, which the game's own age change sets (z_demo.c) and Player_Destroy copies into the save as the
//   scene ends, so the next scene loads with it. The save's cutscene index is cleared first (and no next cutscene
//   left armed): while one is set, as through the new file's opening cutscene, the game loads the entrance's
//   cutscene layer, another place (z_play.c). A warp the game doesn't take is asked again every 3 s.
// - walk(ms) runs Link about with the stick, turning both ways, and rolls, so the camera sees the place from more
//   than one side; look(ms) holds C-up (first person) and pans; pause() opens the pause menu, turns its four pages
//   with R and closes it.
// - state() gives the game mode (0 play, 1 title, 2 file select), the save's entrance and Link's age.
// - Outside play (a game mode other than 0) warp() and the steps that press keys (walk, look, pause, skip, fight) do
//   nothing and give false at once. After a play() that never loaded a file, a warp asked at the file select was
//   taken the moment a file loaded, and walk()'s presses drove the file select's menus, for minutes: the path of a
//   laptop's run that crashed, which no player takes.
// - For what only playing draws (night, items in use, a boss's fight): gear(adult) gives the save every item, its
//   ammo, magic, 20 hearts, the Master Sword and Hylian Shield for an adult (the Kokiri Sword and Deku Shield for a
//   child) and C buttons for the age (an adult's bow, hookshot and bombs, a child's slingshot, boomerang and nuts);
//   equip(l, d, r) puts other items (item ids) on the C buttons; night(on) sets the clock to 01:30 or 10:00 for the
//   next scene loaded; skip(n) presses A n times, 700 ms apart (text, a boss's intro); fight(ms, kind) sways forward
//   and back about where Link is, targeting and swinging B, his health and magic filled each turn, and uses the C
//   buttons: 'aim' holds each and lets go (bow, slingshot, hookshot), 'tap' presses each twice (bombs, nuts, the
//   hammer, Din's Fire), 'none' never.
// The save context is the decompilation's gSaveContext (0x8011A5D0 in NTSC-U 1.0): entranceIndex at +0, linkAge at
// +4, cutsceneIndex at +8, dayTime (u16) at +0xC, nightFlag at +0x10, health capacity and health at +0x2E and +0x30,
// magic level and magic at +0x32 and +0x33, rupees at +0x34, magic acquired at +0x3A, double defense at +0x3D, the
// buttons' items at +0x68 (B and the three C) and their slots at +0x6C, the equipment at +0x70, the items at +0x74,
// their ammo at +0x8C, the owned equipment at +0x9C, the upgrades at +0xA0, gameMode at +0x135C, nextCutsceneIndex
// (u16) at +0x1412, magic's target at +0x13F4, as the decompilation's save.h has them. The play state is found
// through D_8012D1F8 (named for its address in the debug ROM; 0x800FE4D0 here, OoTRecompSyms), which the game points
// at its first controller, the play state's state.input[0] at +0x14 (patches/harness_warp.c keeps it so);
// linkAgeOnLoad is its byte at +0x11DE8 (the decompilation's play_state.h). RDRAM is found as the recorder's n64r finds
// it; a byte sits at the address XOR 3 in its little-endian words.
(() => {
  if (!window.__rdram) {
    const h = HEAPU32;
    for (let i = 2; i < h.length - 8; i++) {
      if (h[i] === 0xB0000000 && h[i - 2] <= 2 && (h[i + 4] === 0x400000 || h[i + 4] === 0x800000)) {
        window.__rdram = i * 4 - 0x308;
        break;
      }
    }
  }
  const base = window.__rdram;
  const off = (a) => base + (a - 0x80000000);
  const r32 = (a) => HEAPU32[off(a) >>> 2];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const w8 = (a, v) => { HEAPU8[off(a) ^ 3] = v; };
  const w16 = (a, v) => { HEAPU16[(off(a) ^ 2) >>> 1] = v; };
  const w32 = (a, v) => { HEAPU32[off(a) >>> 2] = v >>> 0; };
  const SAVE = 0x8011A5D0, ENTRANCE = SAVE, AGE = SAVE + 4, CUTSCENE = SAVE + 8, GAME_MODE = SAVE + 0x135C;
  const NEXT_CUTSCENE = SAVE + 0x1412, NO_CUTSCENE = 0xFFEF;
  const FIRST_INPUT = 0x800FE4D0, AGE_ON_LOAD = 0x11DE8 - 0x14;
  // The game's own keyboard (src/main/input_bindings.cpp): Space is A, Left Shift B, Q Z, Enter Start, WASD the stick,
  // IJKL the C buttons, R is R.
  const keys = {
    A: ['Space', ' ', 32], B: ['ShiftLeft', 'Shift', 16], Z: ['KeyQ', 'q', 81], START: ['Enter', 'Enter', 13],
    R: ['KeyR', 'r', 82], CUP: ['KeyI', 'i', 73], CLEFT: ['KeyJ', 'j', 74], CDOWN: ['KeyK', 'k', 75],
    CRIGHT: ['KeyL', 'l', 76],
    UP: ['KeyW', 'w', 87], DOWN: ['KeyS', 's', 83], LEFT: ['KeyA', 'a', 65], RIGHT: ['KeyD', 'd', 68],
  };
  const send = (type, [code, key, keyCode]) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key, keyCode, which: keyCode, bubbles: true }));
  // Held for 300 ms: the game reads the keyboard's state once a frame, 20 a second at most, and misses a shorter press
  // (150 ms was missed at times while the ubershader drew a recording's attract demo slowly).
  const press = async (name, ms = 300) => { send('keydown', keys[name]); await sleep(ms); send('keyup', keys[name]); };
  window.state = () => ({ mode: r32(GAME_MODE), entrance: r32(ENTRANCE), age: r32(AGE) });
  const inPlay = () => r32(GAME_MODE) === 0;

  window.play = async (intro = false) => {
    const end = Date.now() + 120000;
    let watching = !intro;
    const watch = (async () => {
      while (watching && r32(GAME_MODE) !== 2) await sleep(50);
      // A timer, 4 ms at the shortest, against the game's 50 ms frames: a message to itself each turn, a few us, posted
      // ~10,000 tasks a second to the page's thread, and in Chrome they starved the tasks that carry the device thread's
      // WebGPU work to it, so the picture held 3-8 s as the file loaded.
      while (watching && r32(GAME_MODE) !== 0) await sleep(0);
      if (watching) {
        w32(CUTSCENE, 0);
        w16(NEXT_CUTSCENE, NO_CUTSCENE);
      }
    })();
    // The title (or the logo before it) until the file select. Said every 10 s, so a run that never gets there says
    // where it was.
    let said = Date.now();
    while (r32(GAME_MODE) !== 2) {
      if (Date.now() > end) { watching = false; return false; }
      if (Date.now() - said > 10000) {
        console.log(`shader_survey: game mode ${r32(GAME_MODE)}, RDRAM at heap offset 0x${base.toString(16)}`);
        said = Date.now();
      }
      await press('START');
      await sleep(1500);
    }
    await sleep(2000);
    // A on File 1; on a new profile, the letter A, END and A make the file, and A on it then Yes load it. Each press
    // waits out the menu's animation; a file that exists loads at the second press and the rest are never sent.
    for (const name of ['A', 'A', 'START', 'A', 'A', 'A']) {
      if (r32(GAME_MODE) !== 2) break;
      await press(name);
      await sleep(2500);
    }
    while (r32(GAME_MODE) !== 0) {
      if (Date.now() > end) { watching = false; return false; }
      await sleep(250);
    }
    await watch;
    await sleep(3000);
    return window.state();
  };

  window.warp = async (entrance, age = 1) => {
    const end = Date.now() + 60000;
    let asked = 0;
    while (r32(ENTRANCE) !== entrance) {
      if (Date.now() > end || !inPlay()) return false;
      if (Date.now() - asked > 3000) {
        w32(CUTSCENE, 0);
        w16(NEXT_CUTSCENE, NO_CUTSCENE);
        w8(r32(FIRST_INPUT) + AGE_ON_LOAD, age);
        Module._oot_web_warp(entrance);
        asked = Date.now();
      }
      await sleep(100);
    }
    await sleep(3000);
    return window.state();
  };

  window.walk = async (ms) => {
    if (!inPlay()) return false;
    const end = Date.now() + ms;
    let turn = 'LEFT';
    while (Date.now() < end) {
      send('keydown', keys.UP);
      send('keydown', keys[turn]);
      await sleep(700);
      send('keyup', keys[turn]);
      await sleep(500);
      send('keyup', keys.UP);
      await press('A');
      await sleep(300);
      turn = (turn === 'LEFT') ? 'RIGHT' : 'LEFT';
    }
  };

  window.look = async (ms) => {
    if (!inPlay()) return false;
    await press('CUP');
    await sleep(800);
    send('keydown', keys.LEFT);
    await sleep(ms);
    send('keyup', keys.LEFT);
    await press('CUP');
    await sleep(800);
  };

  window.pause = async () => {
    if (!inPlay()) return false;
    await press('START');
    await sleep(2500);
    for (let page = 0; page < 4; page++) {
      await press('R');
      await sleep(1500);
    }
    await press('START');
    await sleep(2500);
  };

  // The items' slots in order: sticks, nuts, bombs, bow, fire arrows, Din's Fire, slingshot, the Ocarina of Time,
  // bombchus, hookshot, ice arrows, Farore's Wind, boomerang, lens, beans, hammer, light arrows, Nayru's Love, four
  // empty bottles, two empty slots.
  const items = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x08, 0x09, 0x0A, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11,
    0x12, 0x13, 0x14, 0x14, 0x14, 0x14, 0xFF, 0xFF];
  const ammo = [20, 30, 20, 30, 0, 0, 30, 0, 20, 0, 0, 0, 0, 0, 5, 0];
  const heal = () => {
    w16(SAVE + 0x2E, 0x140); w16(SAVE + 0x30, 0x140);
    w8(SAVE + 0x32, 1); w8(SAVE + 0x33, 0x30); w8(SAVE + 0x3A, 1); w16(SAVE + 0x13F4, 0x30);
  };
  window.equip = (l, d, r) => {
    [l, d, r].forEach((id, i) => {
      w8(SAVE + 0x69 + i, id);
      w8(SAVE + 0x6C + i, Math.max(0, items.indexOf(id)));
    });
    return 'C ' + [l, d, r].map((id) => id.toString(16)).join(' ');
  };
  window.gear = (adult) => {
    items.forEach((id, i) => w8(SAVE + 0x74 + i, id));
    ammo.forEach((n, i) => w8(SAVE + 0x8C + i, n));
    w16(SAVE + 0x9C, 0x7777);
    // The first quiver, bomb bag, bullet bag, sticks and nuts.
    w32(SAVE + 0xA0, 1 | (1 << 3) | (1 << 14) | (1 << 17) | (1 << 20));
    w16(SAVE + 0x34, 500);
    w8(SAVE + 0x3D, 1);
    heal();
    if (adult) { w8(SAVE + 0x68, 0x3C); w16(SAVE + 0x70, 0x1122); window.equip(0x03, 0x0A, 0x02); }
    else { w8(SAVE + 0x68, 0x3B); w16(SAVE + 0x70, 0x1111); window.equip(0x06, 0x0E, 0x01); }
    return 'gear ' + (adult ? 'adult' : 'child');
  };
  window.night = (on) => {
    w16(SAVE + 0x0C, on ? 0x1000 : 0x6AAA);
    w32(SAVE + 0x10, on ? 1 : 0);
    return on ? 'night' : 'day';
  };
  window.skip = async (n) => {
    if (!inPlay()) return false;
    for (let i = 0; i < n; i++) {
      await press('A');
      await sleep(700);
    }
  };
  window.fight = async (ms, kind = 'aim') => {
    if (!inPlay()) return false;
    const end = Date.now() + ms;
    const cs = ['CLEFT', 'CDOWN', 'CRIGHT'];
    for (let i = 0; Date.now() < end; i++) {
      heal();
      await press('Z');
      await press('UP', 900);
      await press('B');
      await sleep(250);
      await press('B');
      await sleep(250);
      await press(i % 2 ? 'LEFT' : 'RIGHT', 450);
      await press('DOWN', 900);
      if (kind === 'aim') {
        await press(cs[i % 3], 1500);
        await sleep(800);
      } else if (kind === 'tap') {
        await press(cs[i % 3]);
        await sleep(1200);
        await press(cs[i % 3]);
        await sleep(900);
      }
      await press('A');
      await sleep(300);
    }
  };
})();
