import { envForHost, isKnownHost } from "./env.js";
import { EMPLOYER_FIELDS, EMPLOYER_MATCH_NAME, EMPLOYER_PK_FIELD, PATTERNS } from "./patterns.js";

/**
 * @import { Env } from "./env.js"
 * @import { FieldSpec, Params, Pattern } from "./patterns.js"
 */

/**
 * @typedef {object} Field
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {object} Match
 * @property {string} name
 * @property {"route" | "employer"} kind `route` when a registered pattern
 *   matched the whole path, `employer` when only the leading employer id was
 *   recognised. Callers that treat the two differently — the badge lights for
 *   `route` alone — read this rather than comparing `name`.
 * @property {Env | null} env
 * @property {Field[]} fields
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} pathname
 * @returns {string[]}
 */
function segments(pathname) {
  return pathname.split("/").filter((s) => s.length > 0);
}

/**
 * @param {Pattern} pattern
 * @param {string[]} pathSegments
 * @returns {Params | null}
 */
function matchPattern(pattern, pathSegments) {
  const template = segments(pattern.path);
  if (template.length !== pathSegments.length) return null;

  /** @type {Params} */
  const params = {};
  for (let i = 0; i < template.length; i++) {
    const expected = template[i];
    const actual = pathSegments[i];
    if (expected.startsWith(":")) {
      if (!UUID.test(actual)) return null;
      // Every id niural-payroll puts in a path is a lowercase uuid4; DynamoDB
      // key comparison is byte-exact, so an uppercase segment must be
      // normalized or the resulting key resolves to nothing.
      params[expected.slice(1)] = actual.toLowerCase();
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

/**
 * @param {readonly FieldSpec[]} fields
 * @param {Params} params
 * @returns {Field[]}
 */
function render(fields, params) {
  return fields.map((f) => ({ label: f.label, value: f.value(params) }));
}

/**
 * Returns the key material for the entity the URL points at, or null when the
 * URL is not a recognised niural-payroll page. Never throws — a malformed URL,
 * an unknown host and an unrecognised path are the same case to every caller.
 *
 * A path whose leading segment is an employer id always yields at least that
 * employer's key, even when no registered route matches the rest of it.
 *
 * @param {string} url
 * @returns {Match | null}
 */
export function extract(url) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!isKnownHost(parsed.host)) return null;

  const env = envForHost(parsed.host);
  const pathSegments = segments(parsed.pathname);

  for (const pattern of PATTERNS) {
    const params = matchPattern(pattern, pathSegments);
    if (params === null) continue;
    const fields = render(pattern.fields, params);
    if (params.employerId !== undefined) {
      fields.push(...render([EMPLOYER_PK_FIELD], params));
    }
    return { name: pattern.name, kind: "route", env, fields };
  }

  const leading = pathSegments[0];
  if (leading !== undefined && UUID.test(leading)) {
    /** @type {Params} */
    const params = { employerId: leading.toLowerCase() };
    return {
      name: EMPLOYER_MATCH_NAME,
      kind: "employer",
      env,
      fields: render(EMPLOYER_FIELDS, params),
    };
  }

  return null;
}
