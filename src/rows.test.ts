import { describe, expect, it } from "vitest";
import type { Match } from "./extract";
import { rowsFor } from "./rows";

function match(env: Match["env"]): Match {
  return {
    name: "Employee detail",
    kind: "route",
    env,
    fields: [
      { label: "PK", value: "emp#a#org#b" },
      { label: "SK", value: "profile" },
    ],
  };
}

describe("rowsFor", () => {
  it("appends the table row when the env is known", () => {
    expect(rowsFor(match("qa"))).toEqual([
      { label: "PK", value: "emp#a#org#b" },
      { label: "SK", value: "profile" },
      { label: "Table", value: "customers-qa" },
    ]);
  });

  it("omits the table row when the env is unknown", () => {
    expect(rowsFor(match(null))).toEqual([
      { label: "PK", value: "emp#a#org#b" },
      { label: "SK", value: "profile" },
    ]);
  });

  it("does not mutate the match", () => {
    const m = match("prod");
    rowsFor(m);
    expect(m.fields).toHaveLength(2);
  });
});
