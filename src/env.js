/** @typedef {"prod" | "qa" | "dev"} Env */

/**
 * Keys are `URL.host` values, so they carry the port when there is a
 * non-default one. Matching is exact, so a lookalike domain like
 * `niural.com.evil.example` cannot match. The one family matched by suffix
 * instead is listed in KNOWN_HOST_SUFFIXES.
 *
 * @type {Readonly<Record<string, Env>>}
 */
const HOST_ENV = {
  "niural.com": "prod",
  "qa.niural.com": "qa",
  "dev.niural.com": "dev",
  "localhost:3000": "dev",
};

/**
 * Hosts the extension runs on whose `customers-<env>` table name is not yet
 * confirmed. Keys still resolve on these; only the table-name row is omitted.
 *
 * @type {ReadonlySet<string>}
 */
const HOSTS_WITHOUT_ENV = new Set(["demo.niural.com"]);

/**
 * Host families matched by suffix rather than by name, because their
 * subdomain is generated per branch and cannot be enumerated. Each entry
 * starts with a dot so the match lands on a subdomain boundary: `.foo.com`
 * accepts `branch.foo.com` but not `notfoo.com` or `foo.com.evil.example`.
 *
 * Amplify branch deployments have no confirmed env for the same reason
 * `demo.niural.com` does not — a preview builds against whatever backend its
 * branch config names, which the hostname never reveals.
 *
 * @type {readonly string[]}
 */
const KNOWN_HOST_SUFFIXES = [".amplifyapp.com"];

/**
 * @param {string} host
 * @returns {boolean}
 */
export function isKnownHost(host) {
  return (
    Object.hasOwn(HOST_ENV, host) ||
    HOSTS_WITHOUT_ENV.has(host) ||
    KNOWN_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

/**
 * @param {string} host
 * @returns {Env | null}
 */
export function envForHost(host) {
  return Object.hasOwn(HOST_ENV, host) ? HOST_ENV[host] : null;
}
