import { beforeEach, describe, expect, it, vi } from "vitest";

const EMPLOYER = "a1b2c3d4-0001-4000-8000-000000000001";
const EMPLOYEE = "a1b2c3d4-0002-4000-8000-000000000002";
const MATCHING_URL = `https://qa.niural.com/${EMPLOYER}/people/employees/${EMPLOYEE}`;
const OTHER_EMPLOYEE = "11111111-1111-4111-8111-111111111111";
const OTHER_MATCHING_URL = `https://qa.niural.com/${EMPLOYER}/people/employees/${OTHER_EMPLOYEE}`;

// Argument types are declared so `mock.calls[0][0]` type-checks under strict.
const session = {
  set: vi.fn(async (_items: Record<string, unknown>) => undefined),
  remove: vi.fn(async (_key: string) => undefined),
  get: vi.fn(async (_key: string) => ({}) as Record<string, unknown>),
};
const action = {
  setBadgeText: vi.fn(async (_details: { tabId: number; text: string }) => undefined),
  setBadgeBackgroundColor: vi.fn(async (_details: { tabId: number; color: string }) => undefined),
};

// Shapes mirror what background.ts actually reads off these callback
// arguments (not the full chrome.tabs types), declared so the callback
// recovered from `addListener.mock.calls[0][0]` type-checks when invoked
// directly in a test.
type ChangeInfo = { url?: string; status?: string };
type Tab = { url?: string };
type UpdatedListener = (tabId: number, changeInfo: ChangeInfo, tab: Tab) => void;
type ActivatedListener = (activeInfo: { tabId: number }) => void;
type RemovedListener = (tabId: number) => void;

type StartupListener = () => void;

const tabs = {
  onUpdated: { addListener: vi.fn((_listener: UpdatedListener) => undefined) },
  onActivated: { addListener: vi.fn((_listener: ActivatedListener) => undefined) },
  onRemoved: { addListener: vi.fn((_listener: RemovedListener) => undefined) },
  get: vi.fn(async (_tabId: number) => ({}) as Tab),
  query: vi.fn(async (_info: Record<string, unknown>) => [] as Array<Tab & { id?: number }>),
};

const runtime = {
  onStartup: { addListener: vi.fn((_listener: StartupListener) => undefined) },
  onInstalled: { addListener: vi.fn((_listener: StartupListener) => undefined) },
};

function stubChrome(): void {
  vi.stubGlobal("chrome", {
    storage: { session },
    action,
    tabs,
    runtime,
  });
}

/** Recovers the callback background.ts registered on module load. */
function updatedListener(): UpdatedListener {
  return tabs.onUpdated.addListener.mock.calls[0][0];
}
function activatedListener(): ActivatedListener {
  return tabs.onActivated.addListener.mock.calls[0][0];
}
function removedListener(): RemovedListener {
  return tabs.onRemoved.addListener.mock.calls[0][0];
}
function startupListener(): StartupListener {
  return runtime.onStartup.addListener.mock.calls[0][0];
}
function installedListener(): StartupListener {
  return runtime.onInstalled.addListener.mock.calls[0][0];
}

describe("refreshTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("stashes the match and lights the badge on a matching url", async () => {
    const { refreshTab } = await import("./background");
    const { stashKey } = await import("./stash");
    await refreshTab(7, MATCHING_URL);

    expect(session.set).toHaveBeenCalledTimes(1);
    const stashed = session.set.mock.calls[0][0];
    expect(Object.keys(stashed)).toEqual([stashKey(7)]);
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 7, color: "#16a34a" });
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
    expect(session.remove).not.toHaveBeenCalled();
  });

  it("stashes an employer-only page but leaves the badge dark", async () => {
    const { refreshTab } = await import("./background");
    const { stashKey } = await import("./stash");
    await refreshTab(7, `https://qa.niural.com/${EMPLOYER}/people/pto-policies`);

    expect(session.set).toHaveBeenCalledTimes(1);
    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "" });
    expect(action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    expect(session.remove).not.toHaveBeenCalled();
  });

  it("clears the stash and the badge on a non-matching url", async () => {
    const { refreshTab } = await import("./background");
    const { stashKey } = await import("./stash");
    await refreshTab(7, "https://example.com/whatever");

    expect(session.remove).toHaveBeenCalledWith(stashKey(7));
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "" });
    expect(session.set).not.toHaveBeenCalled();
  });

  it("treats an undefined url as a non-match", async () => {
    const { refreshTab } = await import("./background");
    await refreshTab(7, undefined);

    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "" });
    expect(session.set).not.toHaveBeenCalled();
  });

  it("registers the three tab listeners at module load", async () => {
    await import("./background");
    expect(tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(tabs.onActivated.addListener).toHaveBeenCalledTimes(1);
    expect(tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
  });
});

describe("onUpdated listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("does nothing when changeInfo carries neither url nor status", async () => {
    await import("./background");

    updatedListener()(7, {}, {});

    expect(action.setBadgeText).not.toHaveBeenCalled();
    expect(session.set).not.toHaveBeenCalled();
    expect(session.remove).not.toHaveBeenCalled();
  });

  it("refreshes from changeInfo.url on a matching navigation", async () => {
    await import("./background");
    const { stashKey } = await import("./stash");

    updatedListener()(7, { url: MATCHING_URL }, {});
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(1));

    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
  });

  it("falls back to tab.url when changeInfo only carries status", async () => {
    await import("./background");
    const { stashKey } = await import("./stash");

    // No changeInfo.url — this is the SPA-navigation case the `?? tab.url`
    // fallback exists for. If the fallback were dropped, refreshTab would
    // be called with `undefined` and this would fail.
    updatedListener()(7, { status: "complete" }, { url: MATCHING_URL });
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(1));

    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
  });

  it("prefers changeInfo.url over tab.url when both are defined and different", async () => {
    await import("./background");
    const { stashKey } = await import("./stash");

    // Both carry a defined, different URL. If `changeInfo.url ?? tab.url`
    // were transposed to `tab.url ?? changeInfo.url`, this would refresh
    // from the non-matching tab.url instead and clear the badge.
    updatedListener()(7, { url: MATCHING_URL }, { url: "https://example.com/whatever" });
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(1));

    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
    expect(session.remove).not.toHaveBeenCalled();
  });
});

describe("onActivated listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("refreshes the newly activated tab using chrome.tabs.get", async () => {
    tabs.get.mockResolvedValueOnce({ url: MATCHING_URL });
    await import("./background");
    const { stashKey } = await import("./stash");

    activatedListener()({ tabId: 7 });
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(1));

    expect(tabs.get).toHaveBeenCalledWith(7);
    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
  });
});

describe("onRemoved listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("clears the stash for the removed tab", async () => {
    await import("./background");
    const { stashKey } = await import("./stash");

    removedListener()(7);

    expect(session.remove).toHaveBeenCalledWith(stashKey(7));
  });
});

describe("refreshTab generation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("a superseded call does not re-apply its badge after a newer call has already landed", async () => {
    const { refreshTab } = await import("./background");
    const { stashKey } = await import("./stash");

    // Hold the older call's stash write pending so it resolves after the
    // newer call has fully completed, simulating two in-flight refreshes
    // for the same tab settling out of order.
    let resolveStaleSet!: () => void;
    session.set.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveStaleSet = () => resolve(undefined);
        }),
    );

    const stale = refreshTab(7, MATCHING_URL); // generation 1, write pending
    const fresh = refreshTab(7, OTHER_MATCHING_URL); // generation 2, write resolves immediately

    await fresh;
    expect(session.set).toHaveBeenCalledTimes(2);
    expect(Object.keys(session.set.mock.calls[1][0])).toEqual([stashKey(7)]);
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
    expect(action.setBadgeText).toHaveBeenCalledTimes(1);

    // Now let the stale call's write settle. It must not go on to write the
    // badge again on top of the newer call's already-current state.
    resolveStaleSet();
    await stale;

    expect(action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
    expect(action.setBadgeText).toHaveBeenCalledTimes(1);
  });
});

describe("startup and install scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubChrome();
  });

  it("registers an onStartup and an onInstalled listener at module load", async () => {
    await import("./background");
    expect(runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
  });

  it("onStartup refreshes every open tab, matching and non-matching alike", async () => {
    tabs.query.mockResolvedValueOnce([
      { id: 7, url: MATCHING_URL },
      { id: 8, url: "https://example.com/whatever" },
    ]);
    await import("./background");
    const { stashKey } = await import("./stash");

    startupListener()();
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(2));

    expect(tabs.query).toHaveBeenCalledWith({});
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 8, text: "" });
    expect(Object.keys(session.set.mock.calls[0][0])).toEqual([stashKey(7)]);
  });

  it("onInstalled runs the same scan", async () => {
    tabs.query.mockResolvedValueOnce([{ id: 7, url: MATCHING_URL }]);
    await import("./background");

    installedListener()();
    await vi.waitFor(() => expect(action.setBadgeText).toHaveBeenCalledTimes(1));

    expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "●" });
  });

  it("skips a tab with no id during the scan", async () => {
    tabs.query.mockResolvedValueOnce([{ url: MATCHING_URL }]);
    await import("./background");

    startupListener()();
    await vi.waitFor(() => expect(tabs.query).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(session.set).not.toHaveBeenCalled();
    expect(action.setBadgeText).not.toHaveBeenCalled();
  });
});
