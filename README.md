# niural-dev-tools

Chrome extension for niural-payroll development. Open a payroll page, click the
toolbar icon, and copy the DynamoDB key for whatever entity that page is about —
instead of reading UUIDs out of the address bar and assembling the key by hand.

## First-time setup

Takes about a minute. You need Chrome and nothing else — there is no build
step, and the extension itself has no dependencies. Node is only needed if you
want to run the tests; see [Develop](#develop).

**1. Clone the repo.**

```bash
git clone https://github.com/rohit-niural/niural-dev-tools.git
```

Keep the folder somewhere permanent. Chrome loads the extension from this path
every time it starts, so moving or deleting it later breaks the extension.

**2. Load it into Chrome.**

Open `chrome://extensions`, turn on **Developer mode** with the toggle in the
top-right corner, then click **Load unpacked** and select the **`src/` folder**
inside the repo — not the repo root. The manifest lives in `src/`.

> If Chrome says *"Manifest file is missing or unreadable"*, you selected the
> repo root. Go one level down into `src/`.

**3. Pin it to the toolbar.**

Click the puzzle-piece icon in Chrome's toolbar and hit the pin next to
**Niural Dev Tools**. Without this it stays buried two menus deep, which is most
of the friction this tool exists to remove.

**4. Check it works.**

Open any niural-payroll employee page —
`/<employerId>/people/employees/<employeeId>` — on one of the
[supported hosts](#supported-hosts). The toolbar icon should show a green dot.
Click it and you should see a `PK` row starting with `emp#`.

If nothing happens, confirm the page's host is in the supported list, and that
the URL really has a UUID in both of those positions.

### Updating

```bash
git pull
```

Then press the reload icon on the extension card in `chrome://extensions`.
Chrome does not pick up file changes on its own.

## Using it

Open any niural-payroll page and click the extension icon. The popup lists the
key material for that page, one **Copy** button per row.

On an employee detail page — `/<employerId>/people/employees/<employeeId>`:

```
PK           emp#{employeeId}#org#{employerId}
SK           profile
Employee ID  {employeeId}
Employer ID  {employerId}
Employer PK  org#{employerId}
Table        customers-qa
```

On any other page under an employer id — `/<employerId>/people/pto-policies`, say:

```
PK           org#{employerId}
SK           profile
Employer ID  {employerId}
Table        customers-qa
```

`PK` is always the most specific entity on the page, and it is the first row
because it is the one you copy nearly every time.

**The badge** turns green only on a page that matches a registered route, such
as employee detail. Employer-only pages show no badge — the employer key is
available on nearly every payroll page, so badging them all would say nothing.
The popup still works there.

**The `Table` row** appears only when the host maps to a known environment. On
`demo.niural.com` and Amplify previews it is omitted rather than guessed.

## What it surfaces

- **Employee profile key** on employee detail pages, as the customers-table
  form `emp#{employeeId}#org#{employerId}` / `SK profile`.
- **Employer profile key** — `org#{employerId}` / `SK profile` — on any page
  whose leading path segment is an employer id, either as the page's own key or
  appended to a route match as an `Employer PK` row.
- **The table name**, `customers-<env>`, resolved from the hostname.
- **Uppercase ids normalized to lowercase**, since DynamoDB compares keys byte
  for byte and an uppercase segment would resolve to nothing.

Two key shapes it deliberately never emits:

- The payrolls table's reverse order, `org#…#emp#…`. Confusing it with the
  customers-table form is the mistake this tool exists to prevent.
- The multi-entity form `org#{orgId}` with `SK entity#profile#{entityId}`, where
  one org holds several entities. A payroll URL carries the entity id and never
  an orgId, so that key cannot be built from one.

## Supported hosts

| host | env |
|---|---|
| `niural.com` | prod |
| `qa.niural.com` | qa |
| `dev.niural.com` | dev |
| `localhost:3000` | dev |
| `demo.niural.com` | recognised; env name unconfirmed, so no table row |
| `*.amplifyapp.com` | any Amplify branch deployment; a preview builds against whatever backend its branch config names, so no table row |

Hosts are matched by exact name, except `*.amplifyapp.com`, which is matched by
suffix on a subdomain boundary because its subdomain is generated per branch.

## Develop

The extension is plain ES modules that Chrome loads straight from `src/`.
Types live in JSDoc and are checked by `tsc`; nothing is emitted.

```bash
npm install        # dev tooling only — the extension itself needs none of it
npm run test       # vitest
npm run typecheck  # tsc over the JSDoc types
npm run check      # typecheck + test
```

After editing, press the reload icon on the extension card in
`chrome://extensions` to pick up the change. Relative imports need the `.js`
extension — Chrome does not resolve bare paths.

Run `npm run typecheck` alongside the tests — vitest does not typecheck, so type
drift in a fixture passes the suite and fails only here.

## Adding a route

Add an entry to `PATTERNS` in `src/patterns.js` and a case to
`src/extract.test.ts`. No other file changes. A `:param` segment captures one
path segment and requires it to be a UUID.

## How it fits together

`src/extract.js` is a pure function from a URL string to key material, and it
carries the whole test suite. The service worker and the popup are thin shells
over it: the worker stashes the result per tab and sets the badge, the popup
renders the stashed rows. Nothing is injected into the payroll app, and no
network call is made — every key is derived from the URL alone.

The key shapes are derived from niural-payroll's `customers-<env>` single-table
layout. Design notes are kept internally.
