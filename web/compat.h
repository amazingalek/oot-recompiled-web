// The page's stand-ins for the few C runtime calls the program makes in MSVC's form, which Emscripten's C library
// spells in POSIX's. Force-included into the program's own sources by web/page.cmake, so the code stays as it is.
#pragma once

#include <stdio.h>
#include <time.h>

// MSVC's localtime_s(out, time), not C11's (time, out): returns 0 when it filled <out>.
static inline int localtime_s(struct tm* out, const time_t* t) {
    return localtime_r(t, out) != NULL ? 0 : 1;
}
