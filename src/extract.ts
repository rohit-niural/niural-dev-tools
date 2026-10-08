import { envForHost, isKnownHost, type Env } from "./env";
import {
  EMPLOYER_FIELDS,
  EMPLOYER_MATCH_NAME,
  EMPLOYER_PK_FIELD,
  PATTERNS,
  type FieldSpec,
  type Params,
  type Pattern,
} from "./patterns";

export type Field = { label: string; value: string };

export type Match = {
  name: string;
  /**
   * `route` when a registered pattern matched the whole path, `employer` when
   * only the leading employer id was recognised. Callers that treat the two
   * differently — the badge lights for `route` alone — read this rather than
   * comparing `name`.
   */
  kind: "route" | "employer";
  env: Env | null;
  fields: Field[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function segments(pathname: string): string[] {
  return pathname.split("/").filter((s) => s.length > 0);
}

function matchPattern(pattern: Pattern, pathSegments: string[]): Params | null {
  const template = segments(pattern.path);
  if (template.length !== pathSegments.length) return null;

  const params: Params = {};
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

function render(fields: readonly FieldSpec[], params: Params): Field[] {
  return fields.map((f) => ({ label: f.label, value: f.value(params) }));
}

/**
 * Returns the key material for the entity the URL points at, or null when the
 * URL is not a recognised niural-payroll page. Never throws — a malformed URL,
 * an unknown host and an unrecognised path are the same case to every caller.
 *
 * A path whose leading segment is an employer id always yields at least that
 * employer's key, even when no registered route matches the rest of it.
 */
export function extract(url: string): Match | null {
  let parsed: URL;
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
    const params: Params = { employerId: leading.toLowerCase() };
    return {
      name: EMPLOYER_MATCH_NAME,
      kind: "employer",
      env,
      fields: render(EMPLOYER_FIELDS, params),
    };
  }

  return null;
}
