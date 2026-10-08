# niural-dev-tools

Chrome extension for niural-payroll development. When a recognised payroll page
is open, it surfaces the DynamoDB key for the entity on that page.

## What it does today

On an employee detail page —
`https://<host>/<employerId>/people/employees/<employeeId>` — the toolbar badge
lights up, and the popup shows the `customers-<env>` key ready to copy:

```
PK  emp#{employeeId}#org#{employerId}
SK  profile
```

The payrolls table uses the reverse order (`org#…#emp#…`). This extension only
ever emits the customers-table form.

On any other page whose leading segment is an employer id — `/<employerId>/people/pto-policies`,
say — the popup falls back to that employer's own key:

```
PK  org#{employerId}
SK  profile
```

and on pages that do match a route, the employer key is appended as an
`Employer PK` row. The badge lights only for a route match, not for the
employer fallback, since the employer key is available on nearly every page.

Not emitted: the multi-entity form `org#{orgId}` with `SK entity#profile#{entityId}`,
where one org holds several entities. A payroll URL carries the entity id, never
an orgId, so that key cannot be built from one.

## Hosts

| host | env |
|---|---|
| `niural.com` | prod |
| `qa.niural.com` | qa |
| `dev.niural.com` | dev |
| `localhost:3000` | dev |
| `demo.niural.com` | recognised; env name unconfirmed, so no table row |
| `*.amplifyapp.com` | any Amplify branch deployment; a preview builds against whatever backend its branch config names, so no table row |

## Install

```bash
npm install
npm run build
```

Then `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.

## Develop

```bash
npm run watch      # rebuild dist/ on change
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run compile    # typecheck + test + production build
```

After a rebuild, press the reload icon on the extension card in
`chrome://extensions` to pick up the new bundle.

## Adding a route

Add an entry to `PATTERNS` in `src/patterns.ts` and a case to
`src/extract.test.ts`. No other file changes. A `:param` segment captures one
path segment and requires it to be a UUID.

## Design

The key shapes this emits are derived from niural-payroll's `customers-<env>`
single-table layout. Design notes are kept internally.
