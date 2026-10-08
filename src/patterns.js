/** @typedef {Record<string, string>} Params */

/**
 * @typedef {object} FieldSpec
 * @property {string} label
 * @property {(params: Params) => string} value
 */

/**
 * @typedef {object} Pattern
 * @property {string} name
 * @property {string} path Slash-separated template. A `:name` segment captures
 *   one path segment and requires it to be a UUID — every id niural-payroll
 *   puts in a path is one. When a route needs a non-UUID param, add a param
 *   kind here rather than loosening this one.
 * @property {FieldSpec[]} fields
 */

/**
 * Keys for the `customers-<env>` table. The payrolls table stores the reverse
 * order (`org#{employerId}#emp#{employeeId}`) — do not emit that form here.
 *
 * @type {readonly Pattern[]}
 */
export const PATTERNS = [
  {
    name: "Employee detail",
    path: "/:employerId/people/employees/:employeeId",
    fields: [
      { label: "PK", value: (p) => `emp#${p.employeeId}#org#${p.employerId}` },
      { label: "SK", value: () => "profile" },
      { label: "Employee ID", value: (p) => p.employeeId },
      { label: "Employer ID", value: (p) => p.employerId },
    ],
  },
];

/**
 * The employer's own profile row. `EMPLOYER_PREFIX` is `org` in
 * niural-payroll, and the id a payroll URL carries in its leading segment is
 * the entity id, so `org#{entityId}` / `SK profile` is that entity's row.
 *
 * Not emitted: the multi-entity form `org#{orgId}` / `SK entity#profile#{entityId}`,
 * where an org holds several entities and `orgId` differs from `entityId` —
 * the URL never carries an orgId, so it cannot be built from one.
 */
export const EMPLOYER_MATCH_NAME = "Employer";

/** @type {readonly FieldSpec[]} */
export const EMPLOYER_FIELDS = [
  { label: "PK", value: (p) => `org#${p.employerId}` },
  { label: "SK", value: () => "profile" },
  { label: "Employer ID", value: (p) => p.employerId },
];

/**
 * Appended to a route match that captured an employerId, so the employer key
 * is one click away on any page. Labelled distinctly because that match's own
 * `PK` row belongs to the more specific entity on the page.
 *
 * @type {FieldSpec}
 */
export const EMPLOYER_PK_FIELD = {
  label: "Employer PK",
  value: (p) => `org#${p.employerId}`,
};
