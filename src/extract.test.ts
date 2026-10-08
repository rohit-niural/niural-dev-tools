import { describe, expect, it } from "vitest";
import { extract } from "./extract";

const EMPLOYER = "a1b2c3d4-0001-4000-8000-000000000001";
const EMPLOYEE = "a1b2c3d4-0002-4000-8000-000000000002";
const PATH = `/${EMPLOYER}/people/employees/${EMPLOYEE}`;
const EXPECTED_PK = `emp#${EMPLOYEE}#org#${EMPLOYER}`;

function fieldValue(url: string, label: string): string | undefined {
  return extract(url)?.fields.find((f) => f.label === label)?.value;
}

describe("extract - employee detail", () => {
  it("builds the customers-table key from the real URL", () => {
    const match = extract(`https://demo.niural.com${PATH}`);
    expect(match).not.toBeNull();
    expect(match!.name).toBe("Employee detail");
    expect(match!.env).toBeNull(); // demo env name unconfirmed
    expect(match!.fields).toEqual([
      { label: "PK", value: EXPECTED_PK },
      { label: "SK", value: "profile" },
      { label: "Employee ID", value: EMPLOYEE },
      { label: "Employer ID", value: EMPLOYER },
      { label: "Employer PK", value: `org#${EMPLOYER}` },
    ]);
  });

  it("does not transpose the two UUIDs", () => {
    // The payrolls table uses the reverse order; emitting it would be silently
    // wrong, so assert the halves explicitly rather than only the whole string.
    const pk = fieldValue(`https://qa.niural.com${PATH}`, "PK")!;
    expect(pk.startsWith(`emp#${EMPLOYEE}`)).toBe(true);
    expect(pk.endsWith(`#org#${EMPLOYER}`)).toBe(true);
    expect(pk).not.toContain(`org#${EMPLOYER}#emp#`);
  });

  it("resolves env from the host", () => {
    expect(extract(`https://qa.niural.com${PATH}`)?.env).toBe("qa");
    expect(extract(`https://niural.com${PATH}`)?.env).toBe("prod");
    expect(extract(`https://dev.niural.com${PATH}`)?.env).toBe("dev");
    expect(extract(`http://localhost:3000${PATH}`)?.env).toBe("dev");
  });

  it("ignores a trailing slash and a query string", () => {
    expect(fieldValue(`https://qa.niural.com${PATH}/`, "PK")).toBe(EXPECTED_PK);
    expect(fieldValue(`https://qa.niural.com${PATH}?tab=personal`, "PK")).toBe(EXPECTED_PK);
    expect(fieldValue(`https://qa.niural.com${PATH}#anchor`, "PK")).toBe(EXPECTED_PK);
  });

  it("normalizes an uppercase UUID segment to lowercase", () => {
    // DynamoDB key comparison is byte-exact; every id niural-payroll puts in
    // a path is a lowercase uuid4, so an uppercase URL segment must be
    // normalized rather than mirrored, in both the row and the PK it feeds.
    const url = `https://qa.niural.com/${EMPLOYER.toUpperCase()}/people/employees/${EMPLOYEE}`;
    expect(fieldValue(url, "Employer ID")).toBe(EMPLOYER);
    expect(fieldValue(url, "PK")).toBe(EXPECTED_PK);
  });

  it("builds the key from an Amplify preview deployment url", () => {
    const employer = "a1b2c3d4-0003-4000-8000-000000000003";
    const employee = "a1b2c3d4-0004-4000-8000-000000000004";
    const url = `https://branch-preview.d1example.amplifyapp.com/${employer}/people/employees/${employee}`;

    const match = extract(url);
    expect(match).not.toBeNull();
    expect(match!.env).toBeNull();
    expect(fieldValue(url, "PK")).toBe(`emp#${employee}#org#${employer}`);
    expect(fieldValue(url, "SK")).toBe("profile");
  });
});

describe("extract - non-matches", () => {
  const cases: Array<[string, string]> = [
    ["no leading employer segment", `https://qa.niural.com/people/employees/${EMPLOYEE}`],
    ["non-UUID leading segment", `https://qa.niural.com/dashboard/people/employees/${EMPLOYEE}`],
    ["unknown host", `https://example.com${PATH}`],
    ["lookalike host", `https://niural.com.evil.example${PATH}`],
    ["wrong localhost port", `http://localhost:8080${PATH}`],
    ["chrome internal page", "chrome://extensions"],
    ["malformed url", "not a url at all"],
    ["empty string", ""],
  ];

  it.each(cases)("returns null for %s", (_label, url) => {
    expect(extract(url)).toBeNull();
  });
});

describe("extract - employer fallback", () => {
  // These four were null before the employer fallback existed. They are not
  // registered routes, but each carries an employer id in its leading
  // segment, so each now yields that employer's key rather than nothing.
  it.each([
    ["employee list page", `/${EMPLOYER}/people/employees`],
    ["extra trailing segment", `${PATH}/documents`],
    ["contractor detail, not in the registry", `/${EMPLOYER}/people/contractors/${EMPLOYEE}`],
    ["non-UUID trailing segment", `/${EMPLOYER}/people/employees/new`],
  ])("yields the employer key for %s", (_label, path) => {
    const match = extract(`https://qa.niural.com${path}`);
    expect(match!.kind).toBe("employer");
    expect(match!.fields[0]).toEqual({ label: "PK", value: `org#${EMPLOYER}` });
  });

  it("falls back to the employer key on a non-employee page under an employer id", () => {
    const url = `https://qa.niural.com/${EMPLOYER}/people/pto-policies`;
    const match = extract(url);

    expect(match).not.toBeNull();
    expect(match!.name).toBe("Employer");
    expect(match!.kind).toBe("employer");
    expect(match!.fields).toEqual([
      { label: "PK", value: `org#${EMPLOYER}` },
      { label: "SK", value: "profile" },
      { label: "Employer ID", value: EMPLOYER },
    ]);
  });

  it("falls back on the bare employer root too", () => {
    expect(fieldValue(`https://qa.niural.com/${EMPLOYER}`, "PK")).toBe(`org#${EMPLOYER}`);
  });

  it("does not emit the employee form as the employer key", () => {
    const pk = fieldValue(`https://qa.niural.com/${EMPLOYER}/people/pto-policies`, "PK")!;
    expect(pk).toBe(`org#${EMPLOYER}`);
    expect(pk).not.toContain("emp#");
  });

  it("still returns null when the leading segment is not a uuid", () => {
    expect(extract("https://qa.niural.com/dashboard/people/pto-policies")).toBeNull();
  });

  it("still returns null on an unknown host", () => {
    expect(extract(`https://example.com/${EMPLOYER}/people/pto-policies`)).toBeNull();
  });

  it("resolves env on the fallback the same way", () => {
    expect(extract(`https://qa.niural.com/${EMPLOYER}/people/pto-policies`)?.env).toBe("qa");
  });
});

describe("extract - employer pk on a route match", () => {
  it("appends the employer pk row to the employee detail rows", () => {
    const match = extract(`https://qa.niural.com${PATH}`);

    expect(match!.kind).toBe("route");
    expect(match!.fields).toEqual([
      { label: "PK", value: EXPECTED_PK },
      { label: "SK", value: "profile" },
      { label: "Employee ID", value: EMPLOYEE },
      { label: "Employer ID", value: EMPLOYER },
      { label: "Employer PK", value: `org#${EMPLOYER}` },
    ]);
  });

  it("leaves the employee pk first, since that is the row being copied", () => {
    expect(extract(`https://qa.niural.com${PATH}`)!.fields[0]).toEqual({
      label: "PK",
      value: EXPECTED_PK,
    });
  });
});
