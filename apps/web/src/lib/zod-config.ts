import { z } from 'zod'

/**
 * Keeps Zod from compiling validators with `new Function`. The production CSP has
 * no 'unsafe-eval', so the attempt only ever failed, and Zod's probe for it reports
 * a CSP violation on every page load. Zod reads this while schemas are built, so
 * this module must be imported before anything that defines one.
 */
z.config({ jitless: true })
