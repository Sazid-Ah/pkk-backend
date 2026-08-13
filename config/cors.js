// CORS allow-list for api.panditkathakalyan.com.
//
// The front-ends that call this API:
//   https://panditkathakalyan.com          (main site)
//   https://www.panditkathakalyan.com      (www redirect target)
//   https://m.panditkathakalyan.com        (mobile web)
//   https://access.panditkathakalyan.com   (admin / employee console)
//
// Override with ALLOWED_ORIGINS (comma-separated). An entry may be an exact
// origin or a wildcard host such as https://*.panditkathakalyan.com.

const FALLBACK_ORIGINS = [
    'https://panditkathakalyan.com',
    'https://www.panditkathakalyan.com',
    'https://m.panditkathakalyan.com',
    'https://access.panditkathakalyan.com',
];

// Vercel's env UI happily stores a pasted "https://site.com/" — and a trailing
// slash never matches, because browsers send an Origin with no path. Normalising
// here turns a silent site-wide outage into a non-issue.
const normalize = (value) => String(value).trim().toLowerCase().replace(/\/+$/, '');

const toMatcher = (entry) => {
    const origin = normalize(entry);
    if (!origin.includes('*')) return (candidate) => candidate === origin;

    // https://*.example.com — any subdomain depth. The `*` stands for the label(s)
    // only, never the separating dot, which the literal part already carries.
    // Anchored at both ends so https://example.com.attacker.net can never match.
    const pattern = origin
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[a-z0-9-]+(?:\\.[a-z0-9-]+)*');
    const re = new RegExp(`^${pattern}$`);
    return (candidate) => re.test(candidate);
};

const buildAllowList = () => {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(normalize)
        .filter(Boolean);

    if (configured.length > 0) return configured;

    if (process.env.NODE_ENV === 'production') {
        // Previously this fell back to `origin: false`, which blocks every browser
        // request site-wide while the server still boots and reports healthy — the
        // hardest possible way to notice a missing env var.
        console.warn(
            `⚠️  ALLOWED_ORIGINS is not set — falling back to the known production origins:\n   ${FALLBACK_ORIGINS.join('\n   ')}\n   Set ALLOWED_ORIGINS in the Vercel project settings to control this explicitly.`
        );
        return FALLBACK_ORIGINS;
    }

    return null; // development: reflect any origin
};

const allowList = buildAllowList();
const matchers = allowList ? allowList.map(toMatcher) : null;

if (allowList) {
    console.log(`✓ CORS allow-list (${allowList.length}): ${allowList.join(', ')}`);
} else {
    console.warn('⚠️  CORS is reflecting all origins (development mode)');
}

const isAllowed = (origin) => {
    if (!matchers) return true;
    const candidate = normalize(origin);
    return matchers.some((match) => match(candidate));
};

const corsOptions = {
    origin(origin, callback) {
        // No Origin header: curl, health checks, server-to-server, same-origin.
        // These aren't subject to CORS, so allow without reflecting a header.
        if (!origin) return callback(null, false);

        if (isAllowed(origin)) return callback(null, true);

        // A rejection used to be completely silent, leaving the browser console as
        // the only evidence. Log it so the server side is debuggable too.
        console.warn(`[CORS] blocked origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Cache preflights for a day so every mutating request isn't preceded by a
    // second round trip to a cold lambda.
    maxAge: 86400,
    optionsSuccessStatus: 200,
};

module.exports = { corsOptions, isAllowed, allowList, FALLBACK_ORIGINS };
