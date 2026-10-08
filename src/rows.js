/** @import { Field, Match } from "./extract.js" */

/**
 * Display rows for a match: its own fields, plus the table name when the host
 * maps to a known env. An unmapped host shows no table row rather than a
 * guessed one.
 *
 * @param {Match} match
 * @returns {Field[]}
 */
export function rowsFor(match) {
  const rows = [...match.fields];
  if (match.env !== null) {
    rows.push({ label: "Table", value: `customers-${match.env}` });
  }
  return rows;
}
