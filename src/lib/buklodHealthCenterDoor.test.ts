import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEALTH_CENTER_EMERGENCY_URL,
  HEALTH_CENTER_OFFLINE_NOTICE,
  HEALTH_CENTER_ROOT_URL,
  HEALTH_CENTER_STATUS_URL,
  HEALTH_CENTER_UNAVAILABLE_NOTICE,
  healthCenterEntitlementLabel,
  initialHealthCenterDoorState,
  openHealthCenterDoor,
  resetHealthCenterDoorCacheForTests,
  resolveHealthCenterDoor,
} from "./buklodHealthCenterDoor";

function okResponse(): Response {
  return new Response(JSON.stringify({ appId: "health_center", status: "healthy", durableCloudSync: false }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("BUKLOD Main health center door", () => {
  it("starts in CHECKING without blocking", () => {
    const state = initialHealthCenterDoorState();
    assert.equal(state.indicator, "CHECKING");
    assert.equal(state.url, HEALTH_CENTER_ROOT_URL);
    assert.notEqual(state.url, HEALTH_CENTER_EMERGENCY_URL);
    assert.equal(healthCenterEntitlementLabel(), null);
  });

  it("shows the offline notice and does not call the status endpoint", async () => {
    resetHealthCenterDoorCacheForTests();
    let called = false;
    const state = await resolveHealthCenterDoor({
      deviceOnline: false,
      fetchImpl: async () => {
        called = true;
        return okResponse();
      },
    });
    assert.equal(called, false);
    assert.equal(state.indicator, "OFFLINE");
    assert.equal(state.notice, HEALTH_CENTER_OFFLINE_NOTICE);
    assert.match(state.notice ?? "", /locally stored health information may still be available/i);
    assert.doesNotMatch(state.notice ?? "", /synchroniz|backed up|backup exists|cloud backup/i);
    const opened = openHealthCenterDoor(state);
    assert.equal(opened.url, HEALTH_CENTER_ROOT_URL);
    assert.equal(opened.notice, HEALTH_CENTER_OFFLINE_NOTICE);
  });

  it("opens the health center root when the status endpoint responds", async () => {
    resetHealthCenterDoorCacheForTests();
    const state = await resolveHealthCenterDoor({
      deviceOnline: true,
      now: 1_000,
      fetchImpl: async (input) => {
        assert.equal(String(input), HEALTH_CENTER_STATUS_URL);
        return okResponse();
      },
    });
    assert.equal(state.indicator, "ONLINE");
    assert.equal(openHealthCenterDoor(state).url, HEALTH_CENTER_ROOT_URL);
    assert.equal(openHealthCenterDoor(state).notice, null);
  });

  it("reports service unavailable while the device is online", async () => {
    resetHealthCenterDoorCacheForTests();
    const state = await resolveHealthCenterDoor({
      deviceOnline: true,
      now: 5_000,
      fetchImpl: async () => new Response("no", { status: 503 }),
    });
    assert.equal(state.indicator, "SERVICE_UNAVAILABLE");
    assert.equal(state.notice, HEALTH_CENTER_UNAVAILABLE_NOTICE);
    assert.match(state.notice ?? "", /not automatically deleted/i);
    assert.doesNotMatch(state.notice ?? "", /synchroniz|backed up|backup exists|server copy/i);
    assert.equal(openHealthCenterDoor(state).url, HEALTH_CENTER_ROOT_URL);
  });

  it("times out without hanging and then reuses the cached result", async () => {
    resetHealthCenterDoorCacheForTests();
    let calls = 0;
    const hung = await resolveHealthCenterDoor({
      deviceOnline: true,
      now: 10_000,
      timeoutMs: 30,
      fetchImpl: () => new Promise(() => {}),
    });
    assert.equal(hung.indicator, "SERVICE_UNAVAILABLE");
    const cached = await resolveHealthCenterDoor({
      deviceOnline: true,
      now: 10_100,
      cacheMs: 60_000,
      fetchImpl: async () => {
        calls += 1;
        return okResponse();
      },
    });
    assert.equal(calls, 0);
    assert.equal(cached.cached, true);
    assert.equal(cached.indicator, "SERVICE_UNAVAILABLE");
  });

  it("lets a later offline device override a cached online result", async () => {
    resetHealthCenterDoorCacheForTests();
    await resolveHealthCenterDoor({
      deviceOnline: true,
      now: 20_000,
      fetchImpl: async () => okResponse(),
    });
    const offline = await resolveHealthCenterDoor({
      deviceOnline: false,
      now: 20_100,
    });
    assert.equal(offline.indicator, "OFFLINE");
  });
});