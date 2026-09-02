"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "..", "floating-domain-bar.uc.js"), "utf8");
const flags = { STATE_START: 1, STATE_STOP: 16, STATE_IS_NETWORK: 0x40000 };
const START = flags.STATE_START | flags.STATE_IS_NETWORK;
const STOP = flags.STATE_STOP | flags.STATE_IS_NETWORK;
const topLoading = { isTopLevel: true, isLoadingDocument: true };
const topStopped = { isTopLevel: true, isLoadingDocument: false };

class FakeTimers {
  now = 0;
  nextId = 0;
  pending = new Map();
  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.pending.set(id, { callback, at: this.now + delay });
    return id;
  };
  clearTimeout = id => this.pending.delete(id);
  advance(ms) {
    const end = this.now + ms;
    let count = 0;
    while (true) {
      const next = [...this.pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      assert.ok(++count < 10000, "timer loop must settle");
      this.now = next[1].at;
      this.pending.delete(next[0]);
      next[1].callback();
    }
    this.now = end;
  }
}

// Minimal chrome DOM: integration tests execute the real init/listener wiring,
// without controlling a user's browser or mocking the loading implementation.
class Element {
  children = [];
  attributes = new Map();
  dataset = {};
  listeners = new Map();
  style = {
    setProperty(name, value) { this[name] = value; },
    removeProperty(name) { delete this[name]; },
  };
  rect = { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 };
  constructor(tagName = "div") { this.tagName = tagName; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, force) {
    if (force) this.setAttribute(name, "");
    else this.removeAttribute(name);
  }
  get parentElement() { return this.parentNode; }
  get nextSibling() {
    return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1];
  }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) {
    node.remove();
    this.children.push(node);
    node.parentNode = this;
    return node;
  }
  insertBefore(node, sibling) {
    node.remove();
    this.children.splice(this.children.indexOf(sibling), 0, node);
    node.parentNode = this;
  }
  replaceChildren(...nodes) {
    for (const node of [...this.children]) node.remove();
    this.append(...nodes);
  }
  remove() {
    if (this.parentNode) {
      const siblings = this.parentNode.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentNode = null;
    }
  }
  getBoundingClientRect() { return this.rect; }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, target = this) {
    for (const callback of this.listeners.get(type) ?? []) callback({ type, target });
  }
}

function descendants(root) {
  return root.children.flatMap(child => [child, ...descendants(child)]);
}

function loadHelpers() {
  // Expose the real helpers instead of starting the browser-dependent IIFE.
  const entrypoint = /  waitForBrowser\(\);\s*\}\)\(\);\s*$/;
  assert.match(source, entrypoint);
  const context = {
    window: {},
    document: { createElementNS: (_ns, tag) => new Element(tag) },
  };
  vm.runInNewContext(source.replace(entrypoint,
    "globalThis.api = { createLoadingTracker, createLoadingIndicator, renderLoadingIndicator }; })();"
  ), context);
  return context.api;
}

const { createLoadingTracker, createLoadingIndicator, renderLoadingIndicator } = loadHelpers();

function fixture() {
  const timers = new FakeTimers();
  const changes = [];
  const tracker = createLoadingTracker({
    timers, flags, isSuccess: status => status === 0,
    onChange: browser => changes.push(browser),
  });
  const browser = { isConnected: true };
  const request = {};
  return {
    timers, changes, tracker, browser, request,
    start: (target = browser, req = request) =>
      tracker.onStateChange(target, topLoading, req, START, 0),
    stop: (target = browser, status = 0) =>
      tracker.onStateChange(target, topStopped, request, STOP, status),
  };
}

test("only top-level document network loads start an indicator", () => {
  const f = fixture();
  f.tracker.onStateChange(f.browser, { ...topLoading, isTopLevel: false }, {}, START, 0);
  f.tracker.onStateChange(f.browser, topLoading, {}, flags.STATE_START, 0);
  f.tracker.onStateChange(f.browser, null, {}, START, 0);
  assert.equal(f.tracker.get(f.browser), undefined);
  f.start();
  assert.equal(f.tracker.get(f.browser).progress, 0.06);
  assert.equal(f.tracker.get(f.browser).phase, "loading");
});

test("known byte progress is monotonic and cannot prematurely reach 100%", () => {
  const f = fixture();
  f.start();
  const progress = (current, maximum) => f.tracker.onProgressChange(f.browser, topLoading, current, maximum);
  progress(60, 100);
  assert.equal(f.tracker.get(f.browser).progress, 0.6);
  for (const [current, max] of [[20, 100], [0, 0], [10, -1], [-1, 100], [NaN, 100], [1, Infinity]]) {
    progress(current, max);
    assert.equal(f.tracker.get(f.browser).progress, 0.6);
  }
  f.tracker.onProgressChange(f.browser, { isTopLevel: false }, 99, 100);
  assert.equal(f.tracker.get(f.browser).progress, 0.6);
  progress(150, 100);
  f.timers.advance(10000);
  assert.equal(f.tracker.get(f.browser).progress, 0.94);
});

test("unknown byte totals advance gently and settle below completion", () => {
  const f = fixture();
  f.start();
  f.timers.advance(350);
  assert.ok(f.tracker.get(f.browser).progress > 0.06);
  f.timers.advance(120000);
  assert.equal(f.tracker.get(f.browser).progress, 0.88);
  assert.equal(f.tracker.get(f.browser).phase, "loading");
  assert.equal(f.timers.pending.size, 0, "no endless timer at the estimate cap");
});

test("success fills, briefly holds, fades, then releases state", () => {
  const f = fixture();
  f.start();
  f.stop();
  assert.equal(f.tracker.get(f.browser).progress, 1);
  assert.equal(f.tracker.get(f.browser).phase, "complete");
  f.timers.advance(279);
  assert.equal(f.tracker.get(f.browser).phase, "complete");
  f.stop(); // duplicate STOP must not extend the completion hold
  f.timers.advance(1);
  assert.equal(f.tracker.get(f.browser).phase, "fading");
  f.timers.advance(180);
  assert.equal(f.tracker.get(f.browser), undefined);
  assert.equal(f.timers.pending.size, 0);
});

for (const status of [0x804b0002, 0x804b001e]) {
  test(`abort/error ${status} disappears without pretending to complete`, () => {
    const f = fixture();
    f.start();
    f.timers.advance(350);
    f.stop(f.browser, status);
    assert.equal(f.tracker.get(f.browser).phase, "fading");
    assert.ok(f.tracker.get(f.browser).progress < 1);
    f.timers.advance(180);
    assert.equal(f.tracker.get(f.browser), undefined);
    assert.equal(f.timers.pending.size, 0);
  });
}

test("duplicate START does not reset progress; replacement navigation does", () => {
  const f = fixture();
  f.start();
  f.timers.advance(700);
  const previous = { ...f.tracker.get(f.browser) };
  f.start();
  assert.equal(f.tracker.get(f.browser).id, previous.id);
  assert.equal(f.tracker.get(f.browser).progress, previous.progress);
  f.start(f.browser, {});
  assert.notEqual(f.tracker.get(f.browser).id, previous.id);
  assert.equal(f.tracker.get(f.browser).progress, 0.06);
  f.tracker.onStateChange(f.browser, topLoading, f.request, STOP, 0);
  assert.equal(f.tracker.get(f.browser).phase, "loading", "obsolete STOP while loading is ignored");
  assert.equal(f.timers.pending.size, 1);
});

for (const delay of [0, 300]) {
  test(`reload during ${delay ? "fade" : "completion"} cancels stale callbacks`, () => {
    const f = fixture();
    f.start();
    f.stop();
    f.timers.advance(delay);
    const oldCallback = [...f.timers.pending.values()][0].callback;
    f.start(f.browser, {});
    const state = f.tracker.get(f.browser);
    oldCallback(); // even an already-queued callback cannot mutate the new state
    f.timers.advance(460);
    assert.equal(f.tracker.get(f.browser), state);
    assert.equal(state.phase, "loading");
    assert.ok(state.progress < 1);
    assert.equal(f.timers.pending.size, 1);
  });
}

test("multiple split panels keep independent load states and completion timers", () => {
  const f = fixture();
  const second = { isConnected: true };
  f.start();
  f.start(second, {});
  f.tracker.onProgressChange(second, topLoading, 70, 100);
  f.stop();
  f.timers.advance(460);
  assert.equal(f.tracker.get(f.browser), undefined);
  assert.equal(f.tracker.get(second).phase, "loading");
  assert.ok(f.tracker.get(second).progress >= 0.7);
});

test("mid-load installation seeds busy tabs once, not idle tabs", () => {
  const f = fixture();
  f.browser.webProgress = { isLoadingDocument: true };
  f.tracker.seed(f.browser);
  const initial = f.tracker.get(f.browser);
  f.tracker.seed(f.browser);
  f.tracker.seed({ webProgress: { isLoadingDocument: false } });
  assert.equal(f.tracker.get(f.browser), initial);
  assert.equal(f.changes.length, 1);
});

test("closed tabs, disconnected browsers and unload release their timers", () => {
  const f = fixture();
  f.start();
  f.tracker.forget(f.browser);
  assert.equal(f.tracker.get(f.browser), undefined);
  assert.equal(f.timers.pending.size, 0);
  f.start(f.browser, {});
  f.browser.isConnected = false;
  f.timers.advance(350);
  assert.equal(f.tracker.get(f.browser), undefined);
  f.browser.isConnected = true;
  f.start(f.browser, {});
  f.tracker.destroy();
  f.start(f.browser, {});
  assert.equal(f.tracker.get(f.browser), undefined);
  assert.equal(f.timers.pending.size, 0);
});

test("decorative render reuses a fill during loading but resets it between tabs", () => {
  const indicator = createLoadingIndicator();
  assert.equal(indicator.track.getAttribute("aria-hidden"), "true");
  assert.equal(indicator.track.tagName, "span");
  renderLoadingIndicator(indicator);
  assert.equal(indicator.track.dataset.loadState, "idle");
  renderLoadingIndicator(indicator, { id: 1, phase: "loading", progress: 0.2 });
  const fill = indicator.track.children[0];
  renderLoadingIndicator(indicator, { id: 1, phase: "complete", progress: 1 });
  assert.equal(indicator.track.children[0], fill);
  assert.equal(indicator.track.style["--floating-domain-load-progress"], "1");
  renderLoadingIndicator(indicator, { id: 2, phase: "loading", progress: 0.06 });
  assert.notEqual(indicator.track.children[0], fill);
  renderLoadingIndicator(indicator);
  assert.equal(indicator.track.dataset.loadState, "idle");
});

function browserFixture() {
  const root = new Element();
  const byId = id => descendants(root).find(node => node.id === id);
  for (const id of ["urlbar", "urlbar-container", "tabbrowser-tabbox", "tabbrowser-tabpanels",
    "navigator-toolbox", "back-button", "forward-button", "stop-reload-button", "PanelUI-button"]) {
    const node = new Element();
    node.id = id;
    root.append(node);
  }
  byId("navigator-toolbox").rect = { left: 0, right: 200, width: 200, top: 0, bottom: 800, height: 800 };
  byId("tabbrowser-tabbox").append(byId("tabbrowser-tabpanels"));
  const tabs = [0, 1].map(index => {
    const container = new Element();
    container.className = "browserSidebarContainer";
    container.rect = { left: 200 + index * 500, right: 700 + index * 500, top: 0, bottom: 800, width: 500, height: 800 };
    byId("tabbrowser-tabpanels").append(container);
    const tab = new Element();
    tab.linkedBrowser = {
      isConnected: true,
      currentURI: { scheme: "https", host: `site${index}.example`, spec: `https://site${index}.example/` },
      webProgress: { isLoadingDocument: false },
      closest: () => container,
    };
    return tab;
  });
  const progressListeners = new Set();
  const gBrowser = {
    tabs, selectedTab: tabs[0], tabContainer: new Element(),
    get selectedBrowser() { return this.selectedTab.linkedBrowser; },
    getTabForBrowser: browser => tabs.find(tab => tab.linkedBrowser === browser),
    addTabsProgressListener: listener => progressListeners.add(listener),
    removeTabsProgressListener: listener => progressListeners.delete(listener),
  };
  const timers = new FakeTimers();
  const window = Object.assign(new Element(), {
    gBrowser, innerWidth: 1200, innerHeight: 800,
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    requestAnimationFrame: callback => timers.setTimeout(() => callback(timers.now), 16),
    cancelAnimationFrame: timers.clearTimeout,
  });
  class Observer { observe() {} unobserve() {} disconnect() {} }
  vm.runInNewContext(source, {
    window, gBrowser,
    document: {
      documentElement: root, getElementById: byId,
      createElementNS: (_ns, tag) => new Element(tag),
      createXULElement: tag => new Element(tag),
      querySelectorAll: () => descendants(root).filter(node => node.className === "browserSidebarContainer"),
    },
    Ci: { nsIWebProgressListener: flags },
    Components: { isSuccessCode: status => status === 0 },
    Services: { eTLD: { getBaseDomain: uri => uri.host } },
    ResizeObserver: Observer, MutationObserver: Observer,
    performance: { now: () => timers.now },
  });
  assert.ok(window.__floatingDomainBarState, "real init must complete");
  const listener = [...progressListeners][0];
  return {
    tabs, timers, window, gBrowser, listener, progressListeners, byId,
    track: parent => descendants(parent).find(node => node.className === "floating-domain-load-track"),
    split() {
      for (const tab of tabs) {
        tab.splitView = true;
        tab.linkedBrowser.closest().setAttribute("zen-split", "true");
      }
      window.__floatingDomainBarState.scheduleSplitSync();
      timers.advance(16);
      return byId("floating-domain-split-layer").children;
    },
  };
}

test("real listener uses total bytes and switches the single bar to the selected tab", () => {
  const f = browserFixture();
  const [first, second] = f.tabs.map(tab => tab.linkedBrowser);
  const track = f.track(f.byId("floating-domain-bar-domain"));
  f.listener.onStateChange(second, topLoading, {}, START, 0);
  assert.equal(track.dataset.loadState, "idle", "background load must not animate the selected tab");
  f.gBrowser.selectedTab = f.tabs[1];
  f.gBrowser.tabContainer.emit("TabSelect");
  assert.equal(track.dataset.loadState, "loading");
  f.listener.onProgressChange(second, topLoading, {}, 1, 2, 70, 100);
  assert.equal(track.style["--floating-domain-load-progress"], "0.7");
  f.gBrowser.selectedTab = f.tabs[0];
  f.gBrowser.tabContainer.emit("TabSelect");
  assert.equal(track.dataset.loadState, "idle");
  f.listener.onStateChange(first, topLoading, {}, START, 0);
  assert.equal(track.dataset.loadState, "loading");
  f.window.__floatingDomainBarState.cleanup();
  assert.equal(f.progressListeners.size, 0);
  assert.equal(f.timers.pending.size, 0);
});

test("real split wiring isolates both bars, survives resizing, and cleans up closed tabs", () => {
  const f = browserFixture();
  const bars = f.split();
  assert.equal(bars.length, 2);
  const tracks = bars.map(f.track);
  const [first, second] = f.tabs.map(tab => tab.linkedBrowser);
  f.listener.onStateChange(first, topLoading, {}, START, 0);
  f.listener.onStateChange(second, topLoading, {}, START, 0);
  f.listener.onProgressChange(first, topLoading, {}, 0, 0, 40, 100);
  f.listener.onProgressChange(second, topLoading, {}, 0, 0, 80, 100);
  assert.equal(tracks[0].style["--floating-domain-load-progress"], "0.4");
  assert.equal(tracks[1].style["--floating-domain-load-progress"], "0.8");
  const container = first.closest();
  container.rect = { ...container.rect, right: 500, width: 300 };
  f.window.emit("resize");
  f.timers.advance(16);
  assert.equal(bars[0].hasAttribute("data-narrow"), true);
  assert.equal(tracks[0].dataset.loadState, "loading");
  f.listener.onStateChange(first, topStopped, {}, STOP, 0);
  f.timers.advance(460);
  assert.equal(tracks[0].dataset.loadState, "idle");
  assert.equal(tracks[1].dataset.loadState, "loading");
  f.tabs[1].closing = true;
  f.gBrowser.tabContainer.emit("TabClose", f.tabs[1]);
  f.timers.advance(16);
  assert.equal(bars.includes(tracks[1].parentNode?.parentNode), false);
  f.window.__floatingDomainBarState.cleanup();
  assert.equal(f.progressListeners.size, 0);
  assert.equal(f.timers.pending.size, 0);
});
