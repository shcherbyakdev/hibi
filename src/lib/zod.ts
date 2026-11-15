import { z } from "zod";

// jitless: zod otherwise probes `new Function` on first use, and the
// site's CSP (src/lib/csp.ts) blocks eval and reports every probe as a
// violation. Our schemas are tiny, so the JIT buys nothing. Import z from here.
z.config({ jitless: true });

export { z };
