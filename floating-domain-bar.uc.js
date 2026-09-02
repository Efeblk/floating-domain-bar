(() => {
  "use strict";

  const STATE_KEY = "__floatingDomainBarState";
  const LABEL_ID = "floating-domain-bar-label";
  const LAYOUT_ID = "floating-domain-bar-layout";
  const DRAG_REGION_ID = "floating-domain-bar-drag-region";
  const SPLIT_LAYER_ID = "floating-domain-split-layer";
  const PAGE_COLOR_MESSAGE = "FloatingDomainBar:PageColor";
  const PAGE_COLOR_REQUEST_MESSAGE = "FloatingDomainBar:RequestPageColor";
  const PAGE_COLOR_DESTROY_MESSAGE = "FloatingDomainBar:DestroyPageColorSampler";
  const HTML_NS = "http://www.w3.org/1999/xhtml";

  if (window[STATE_KEY]) {
    return;
  }

  function labelForURI(uri) {
    if (!uri) {
      return "";
    }

    const scheme = uri.scheme?.toLowerCase?.() ?? "";

    if (scheme === "http" || scheme === "https" || scheme === "ftp") {
      let host = uri.displayHost || uri.host || "";

      try {
        host = Services.eTLD.getBaseDomain(uri);
      } catch {
        // Localhost, IP addresses and single-label hosts have no base domain.
      }

      return host.replace(/^www\./i, "");
    }

    const spec = uri.spec ?? "";

    if (/^about:(?:blank|home|newtab)(?:[?#].*)?$/i.test(spec)) {
      return "Yeni Sekme";
    }

    if (/^about:preferences/i.test(spec)) {
      return "Ayarlar";
    }

    if (scheme === "file") {
      return "Yerel Dosya";
    }

    if (scheme === "moz-extension") {
      return "Eklenti";
    }

    return spec || scheme;
  }

  // Page-load progress, not background fetch/media activity. Unknown byte totals
  // use a bounded estimate; only a successful network STOP can fill the line.
  function createLoadingTracker({
    onChange,
    timers = window,
    flags = Ci.nsIWebProgressListener,
    isSuccess = status => Components.isSuccessCode(status),
  }) {
    const states = new Map();
    let nextId = 0;
    let destroyed = false;

    const cancelTimer = state => {
      if (state?.timer) {
        timers.clearTimeout(state.timer);
        state.timer = 0;
      }
    };
    const forget = browser => {
      cancelTimer(states.get(browser));
      if (states.delete(browser)) {
        onChange(browser);
      }
    };
    const schedule = (browser, state, callback, delay) => {
      cancelTimer(state);
      state.timer = timers.setTimeout(() => {
        state.timer = 0;
        if (!destroyed && states.get(browser) === state) {
          callback();
        }
      }, delay);
    };
    const advance = (browser, state) => {
      if (browser.isConnected === false) {
        forget(browser);
        return;
      }
      if (state.progress < 0.88) {
        state.progress = Math.min(
          0.88,
          state.progress + Math.max(0.002, (0.88 - state.progress) * 0.08)
        );
        onChange(browser);
        schedule(browser, state, () => advance(browser, state), 350);
      }
    };
    const start = (browser, request = null) => {
      if (destroyed || !browser) {
        return;
      }
      const previous = states.get(browser);
      if (previous?.phase === "loading" && previous.request === request) {
        return;
      }
      cancelTimer(previous);
      const state = {
        id: ++nextId,
        phase: "loading",
        progress: 0.06,
        request,
        timer: 0,
      };
      states.set(browser, state);
      onChange(browser);
      schedule(browser, state, () => advance(browser, state), 350);
    };
    const finish = (browser, successful) => {
      const state = states.get(browser);
      if (!state || state.phase !== "loading") {
        return;
      }
      cancelTimer(state);
      const fade = () => {
        state.phase = "fading";
        onChange(browser);
        schedule(browser, state, () => forget(browser), 180);
      };
      if (!successful) {
        fade();
        return;
      }
      state.progress = 1;
      state.phase = "complete";
      onChange(browser);
      schedule(browser, state, fade, 280);
    };

    return {
      get: browser => states.get(browser),
      forget,
      seed(browser) {
        if (browser?.webProgress?.isLoadingDocument && !states.has(browser)) {
          start(browser);
        }
      },
      onStateChange(browser, webProgress, request, stateFlags, status) {
        if (!webProgress?.isTopLevel || !(stateFlags & flags.STATE_IS_NETWORK)) {
          return;
        }
        if (stateFlags & flags.STATE_START) {
          start(browser, request);
        } else if (
          stateFlags & flags.STATE_STOP &&
          !webProgress.isLoadingDocument
        ) {
          // An obsolete STOP during a replacement navigation must not finish
          // the new document's indicator.
          finish(browser, isSuccess(status));
        }
      },
      onProgressChange(browser, webProgress, current, maximum) {
        const state = states.get(browser);
        if (
          !webProgress?.isTopLevel ||
          state?.phase !== "loading" ||
          !Number.isFinite(current) ||
          !Number.isFinite(maximum) ||
          current < 0 || maximum <= 0
        ) {
          return;
        }
        const progress = Math.min(0.94, Math.max(0.06, current / maximum));
        if (progress > state.progress) {
          state.progress = progress;
          onChange(browser);
        }
      },
      destroy() {
        destroyed = true;
        for (const state of states.values()) {
          cancelTimer(state);
        }
        states.clear();
      },
    };
  }

  function createLoadingIndicator() {
    const track = document.createElementNS(HTML_NS, "span");
    track.className = "floating-domain-load-track";
    track.setAttribute("aria-hidden", "true");
    return { track, loadId: null };
  }

  function renderLoadingIndicator(indicator, state) {
    // A new fill avoids animating backwards when switching tabs or rapidly
    // reloading. The indicator never takes pointer or keyboard focus.
    if (state && indicator.loadId !== state.id) {
      const fill = document.createElementNS(HTML_NS, "span");
      fill.className = "floating-domain-load-fill";
      indicator.track.replaceChildren(fill);
      indicator.loadId = state.id;
    }
    indicator.track.dataset.loadState = state?.phase || "idle";
    indicator.track.style.setProperty(
      "--floating-domain-load-progress",
      String(state?.progress || 0)
    );
  }

  function init() {
    const urlbar = document.getElementById("urlbar");
    const urlbarContainer = document.getElementById("urlbar-container");
    const contentHost = document.getElementById("tabbrowser-tabbox");
    const tabPanels = document.getElementById("tabbrowser-tabpanels");
    const sidebar = document.getElementById("navigator-toolbox");
    const backButton = document.getElementById("back-button");
    const forwardButton = document.getElementById("forward-button");
    const stopReloadButton = document.getElementById("stop-reload-button");
    const panelButton = document.getElementById("PanelUI-button");

    if (
      !urlbar ||
      !urlbarContainer ||
      !contentHost ||
      !tabPanels ||
      !sidebar ||
      !backButton ||
      !forwardButton ||
      !stopReloadButton ||
      !panelButton ||
      !window.gBrowser
    ) {
      return false;
    }

    const movedNodes = [
      backButton,
      forwardButton,
      stopReloadButton,
      panelButton,
    ];
    const originalPositions = movedNodes.map(node => ({
      node,
      parent: node.parentNode,
      nextSibling: node.nextSibling,
    }));

    const dragRegion = document.createXULElement("hbox");
    dragRegion.id = DRAG_REGION_ID;
    dragRegion.setAttribute("aria-hidden", "true");

    let windowDragState = null;
    let windowRestoreFrame = 0;

    const stopWindowDrag = event => {
      const state = windowDragState;

      if (!state) {
        return;
      }

      windowDragState = null;

      if (windowRestoreFrame) {
        window.cancelAnimationFrame(windowRestoreFrame);
        windowRestoreFrame = 0;
      }

      try {
        if (dragRegion.hasPointerCapture?.(state.pointerId)) {
          dragRegion.releasePointerCapture(state.pointerId);
        }
      } catch {
        // Pointer capture may already be released by the platform.
      }

      window.removeEventListener("pointermove", onWindowDragMove, true);
      window.removeEventListener("pointerup", stopWindowDrag, true);
      window.removeEventListener("pointercancel", stopWindowDrag, true);
      document.documentElement.removeAttribute(
        "floating-domain-bar-window-dragging"
      );

      if (state.started) {
        event?.preventDefault?.();
      }
    };

    const moveWindowToPointer = state => {
      if (windowDragState !== state) {
        return;
      }

      window.moveTo(
        Math.round(state.lastScreenX - state.anchorX),
        Math.round(state.lastScreenY - state.anchorY)
      );
    };

    const finishWindowRestore = state => {
      if (windowDragState !== state) {
        return;
      }

      if (
        window.windowState !== window.STATE_NORMAL &&
        state.restoreAttempts < 4
      ) {
        state.restoreAttempts += 1;
        windowRestoreFrame = window.requestAnimationFrame(() =>
          finishWindowRestore(state)
        );
        return;
      }

      windowRestoreFrame = 0;
      state.pendingRestore = false;
      state.anchorX = Math.round(
        window.outerWidth * state.horizontalPointerRatio
      );
      state.anchorY = Math.min(24, Math.max(8, state.initialClientY));
      moveWindowToPointer(state);
    };

    function onWindowDragMove(event) {
      const state = windowDragState;

      if (!state || event.pointerId !== state.pointerId) {
        return;
      }

      if (!(event.buttons & 1)) {
        stopWindowDrag(event);
        return;
      }

      state.lastScreenX = event.screenX;
      state.lastScreenY = event.screenY;

      if (!state.started) {
        const distance = Math.hypot(
          event.screenX - state.startScreenX,
          event.screenY - state.startScreenY
        );

        if (distance < 4) {
          return;
        }

        state.started = true;
        document.documentElement.setAttribute(
          "floating-domain-bar-window-dragging",
          "true"
        );

        if (state.wasMaximized) {
          state.pendingRestore = true;
          window.restore();
          windowRestoreFrame = window.requestAnimationFrame(() =>
            finishWindowRestore(state)
          );
          event.preventDefault();
          return;
        }
      }

      if (!state.pendingRestore) {
        moveWindowToPointer(state);
      }

      event.preventDefault();
    }

    const onWindowDragStart = event => {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        window.fullScreen ||
        window.windowState === window.STATE_FULLSCREEN
      ) {
        return;
      }

      stopWindowDrag();

      const wasMaximized = window.windowState === window.STATE_MAXIMIZED;
      windowDragState = {
        pointerId: event.pointerId,
        startScreenX: event.screenX,
        startScreenY: event.screenY,
        lastScreenX: event.screenX,
        lastScreenY: event.screenY,
        initialClientY: event.clientY,
        horizontalPointerRatio: Math.max(
          0,
          Math.min(1, event.clientX / Math.max(1, window.innerWidth))
        ),
        anchorX: event.screenX - window.screenX,
        anchorY: event.screenY - window.screenY,
        wasMaximized,
        pendingRestore: false,
        restoreAttempts: 0,
        started: false,
      };

      try {
        dragRegion.setPointerCapture?.(event.pointerId);
      } catch {
        // Window-level listeners still provide a safe fallback.
      }

      window.addEventListener("pointermove", onWindowDragMove, true);
      window.addEventListener("pointerup", stopWindowDrag, true);
      window.addEventListener("pointercancel", stopWindowDrag, true);
    };

    const onWindowDragDoubleClick = event => {
      if (event.button !== 0 || window.fullScreen) {
        return;
      }

      if (window.windowState === window.STATE_MAXIMIZED) {
        window.restore();
      } else {
        window.maximize();
      }

      event.preventDefault();
    };

    dragRegion.addEventListener("pointerdown", onWindowDragStart);
    dragRegion.addEventListener("dblclick", onWindowDragDoubleClick);

    const layout = document.createXULElement("hbox");
    layout.id = LAYOUT_ID;

    const leftControls = document.createXULElement("hbox");
    leftControls.id = "floating-domain-bar-left-controls";

    const rightControls = document.createXULElement("hbox");
    rightControls.id = "floating-domain-bar-right-controls";

    const domainButton = document.createElementNS(HTML_NS, "button");
    domainButton.id = "floating-domain-bar-domain";
    domainButton.type = "button";
    domainButton.setAttribute("aria-label", "Ara veya adres gir");

    const label = document.createElementNS(HTML_NS, "span");
    label.id = LABEL_ID;
    label.setAttribute("aria-hidden", "true");
    domainButton.appendChild(label);
    const domainLoading = createLoadingIndicator();
    domainButton.appendChild(domainLoading.track);

    leftControls.append(backButton, forwardButton, stopReloadButton);
    rightControls.append(panelButton);
    layout.append(leftControls, domainButton, rightControls);
    contentHost.append(dragRegion, layout);

    const splitLayer = document.createElementNS(HTML_NS, "div");
    splitLayer.id = SPLIT_LAYER_ID;
    splitLayer.setAttribute("aria-label", "Split sekme adres çubukları");
    contentHost.appendChild(splitLayer);

    document.documentElement.setAttribute(
      "floating-domain-bar-layout-ready",
      "true"
    );

    /* Read the page canvas color without changing the page DOM. The sampled
     * color is painted only on Zen's reserved browser-chrome header. */
    const frameManager = window.messageManager;
    const pageAppearanceByBrowser = new WeakMap();
    let refreshAppearance = () => {};
    let pageColorFrameScriptURL = null;
    const onPageColor = message => {
      const browser = message.target;
      const container = browser?.closest?.(".browserSidebarContainer");
      const color = message.data?.color;
      const tone = message.data?.tone === "light" ? "light" : "dark";

      if (!container) {
        return;
      }

      // Virtualized feeds can briefly expose no paintable background while
      // scrolling. Keep the last valid sample instead of flashing to Zen's
      // fallback color; a real top-level navigation clears it separately.
      if (
        typeof color !== "string" ||
        !color ||
        !window.CSS?.supports?.("color", color)
      ) {
        return;
      }

      container.style.setProperty("--floating-domain-page-color", color);
      container.setAttribute("floating-domain-page-tone", tone);
      pageAppearanceByBrowser.set(browser, { color, tone });
      refreshAppearance();
    };

    if (frameManager?.loadFrameScript) {
      frameManager.addMessageListener(PAGE_COLOR_MESSAGE, onPageColor);
      const pageColorFrameScript = `(() => {
        const COLOR_MESSAGE = ${JSON.stringify(PAGE_COLOR_MESSAGE)};
        const REQUEST_MESSAGE = ${JSON.stringify(PAGE_COLOR_REQUEST_MESSAGE)};
        const DESTROY_MESSAGE = ${JSON.stringify(PAGE_COLOR_DESTROY_MESSAGE)};
        let observer = null;
        let timer = 0;
        let settleTimers = [];
        let lastResult = "";

        const alphaForColor = value => {
          if (!value || value === "transparent") {
            return 0;
          }

          const modernAlpha = value.match(
            /\\/\\s*([\\d.]+)\\s*(%)?\\s*\\)$/i
          );
          if (modernAlpha) {
            const alpha = Number(modernAlpha[1]);
            return modernAlpha[2] ? alpha / 100 : alpha;
          }

          const legacyAlpha = value.match(
            /^rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)$/i
          );
          return legacyAlpha ? Number(legacyAlpha[1]) : 1;
        };

        const isOpaque = value => alphaForColor(value) >= 0.999;

        const colorAtPoint = (doc, x, y) => {
          const width = Math.max(1, content.innerWidth);
          const height = Math.max(1, content.innerHeight);
          const safeX = Math.max(0, Math.min(width - 1, x));
          const safeY = Math.max(0, Math.min(height - 1, y));
          const elements = doc.elementsFromPoint?.(safeX, safeY) ?? [];

          for (const element of elements) {
            const color = content.getComputedStyle(element).backgroundColor;
            // Sticky headers often use translucent black. Painting that same
            // RGBA value in browser chrome exposes Zen's theme underneath,
            // so walk through it and sample the first opaque page layer.
            if (isOpaque(color)) {
              return color;
            }
          }

          return "";
        };

        const chooseVisibleColor = doc => {
          const width = Math.max(1, content.innerWidth);
          const height = Math.max(1, content.innerHeight);
          const xs = [6, width * 0.2, width * 0.5, width * 0.8, width - 7];
          const ys = [6, 20, 44].map(y => Math.min(y, height - 1));
          const points = ys.flatMap(y => xs.map(x => [x, y]));
          const colors = points
            .map(([x, y]) => colorAtPoint(doc, x, y))
            .filter(Boolean);

          if (!colors.length) {
            return "";
          }

          const counts = new Map();
          for (const color of colors) {
            counts.set(color, (counts.get(color) ?? 0) + 1);
          }

          return colors.reduce((best, color) =>
            (counts.get(color) ?? 0) > (counts.get(best) ?? 0) ? color : best
          );
        };

        const toneForColor = color => {
          const match = color.match(
            /^rgba?\\(\\s*([\\d.]+)[, ]+\\s*([\\d.]+)[, ]+\\s*([\\d.]+)/i
          );
          if (!match) {
            return "dark";
          }

          const channels = match.slice(1, 4).map(value => {
            const channel = Math.max(0, Math.min(255, Number(value))) / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
          const luminance =
            channels[0] * 0.2126 +
            channels[1] * 0.7152 +
            channels[2] * 0.0722;

          return luminance > 0.179 ? "light" : "dark";
        };

        const readPageColor = () => {
          const doc = content.document;
          const root = doc?.documentElement;
          const body = doc?.body;

          if (!root || root.localName !== "html") {
            return;
          }

          const rootColor = content.getComputedStyle(root).backgroundColor;
          const bodyColor = body
            ? content.getComputedStyle(body).backgroundColor
            : "";
          const visibleColor = chooseVisibleColor(doc);
          const color = visibleColor ||
            (isOpaque(rootColor)
              ? rootColor
              : isOpaque(bodyColor)
                ? bodyColor
                : "");

          if (!color) {
            return;
          }

          const tone = toneForColor(color);
          const result = color + "|" + tone;

          if (result !== lastResult) {
            lastResult = result;
            sendAsyncMessage(COLOR_MESSAGE, { color, tone });
          }
        };

        const scheduleRead = (delay = 60) => {
          if (timer) {
            return;
          }

          timer = content.setTimeout(() => {
            timer = 0;
            readPageColor();
          }, delay);
        };

        const scheduleSettledReads = () => {
          for (const pending of settleTimers) {
            content.clearTimeout(pending);
          }

          settleTimers = [0, 80, 220, 500, 1000, 1800].map(delay =>
            content.setTimeout(readPageColor, delay)
          );
        };
        const scheduleReadFromEvent = () => scheduleRead();

        const observeDocument = () => {
          observer?.disconnect();
          observer = null;

          const doc = content.document;
          const root = doc?.documentElement;
          if (!root || root.localName !== "html") {
            scheduleRead();
            return;
          }

          observer = new content.MutationObserver(scheduleReadFromEvent);
          observer.observe(root, {
            attributes: true,
            attributeFilter: ["class", "style"],
          });
          if (doc.body) {
            observer.observe(doc.body, {
              attributes: true,
              attributeFilter: ["class", "style"],
            });
          }
          scheduleSettledReads();
        };

        const destroy = () => {
          removeEventListener("DOMContentLoaded", observeDocument, true);
          removeEventListener("pageshow", observeDocument, true);
          removeEventListener("load", scheduleSettledReads, true);
          removeEventListener("resize", scheduleReadFromEvent, true);
          removeEventListener("hashchange", scheduleSettledReads, true);
          removeEventListener("popstate", scheduleSettledReads, true);
          observer?.disconnect();
          if (timer) {
            content.clearTimeout(timer);
          }
          for (const pending of settleTimers) {
            content.clearTimeout(pending);
          }
          removeMessageListener(REQUEST_MESSAGE, scheduleSettledReads);
          removeMessageListener(DESTROY_MESSAGE, destroy);
        };

        addEventListener("DOMContentLoaded", observeDocument, true);
        addEventListener("pageshow", observeDocument, true);
        addEventListener("load", scheduleSettledReads, true);
        addEventListener("resize", scheduleReadFromEvent, true);
        addEventListener("hashchange", scheduleSettledReads, true);
        addEventListener("popstate", scheduleSettledReads, true);
        addMessageListener(REQUEST_MESSAGE, scheduleSettledReads);
        addMessageListener(DESTROY_MESSAGE, destroy);
        observeDocument();
      })();`;

      pageColorFrameScriptURL =
        "data:application/javascript;charset=utf-8," +
        encodeURIComponent(pageColorFrameScript);
      frameManager.loadFrameScript(pageColorFrameScriptURL, true);
    }

    const requestPageColor = browser => {
      try {
        browser?.messageManager?.sendAsyncMessage(PAGE_COLOR_REQUEST_MESSAGE);
      } catch {
        // The content process may be swapping during navigation.
      }
    };

    const updateBrowserLayoutMode = () => {
      const root = document.documentElement;
      const sidebarExpanded =
        root.getAttribute("zen-sidebar-expanded") === "true";
      const singleToolbar =
        root.getAttribute("zen-single-toolbar") === "true";
      const mode = !sidebarExpanded
        ? "collapsed-sidebar"
        : singleToolbar
          ? "only-sidebar"
          : "sidebar-and-top-toolbar";

      root.setAttribute("floating-domain-bar-browser-layout", mode);
    };
    updateBrowserLayoutMode();

    const update = uri => {
      const currentURI = uri || gBrowser.selectedBrowser?.currentURI;
      label.textContent = labelForURI(currentURI);
      renderLoadingIndicator(
        domainLoading,
        loadingTracker.get(gBrowser.selectedBrowser)
      );
    };

    let scheduleSplitSync = () => {};
    let sidebarFrame = 0;
    let sidebarSampleUntil = 0;
    const updateSidebarWidth = () => {
      const rect = sidebar.getBoundingClientRect();
      const viewportWidth =
        document.documentElement.clientWidth || window.innerWidth;
      const visibleLeft = Math.max(0, rect.left);
      const visibleRight = Math.min(viewportWidth, rect.right);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);

      document.documentElement.style.setProperty(
        "--floating-domain-bar-sidebar-width",
        `${visibleWidth}px`
      );
    };

    const sampleSidebar = timestamp => {
      sidebarFrame = 0;
      updateSidebarWidth();

      if (timestamp < sidebarSampleUntil) {
        sidebarFrame = window.requestAnimationFrame(sampleSidebar);
      }
    };

    const scheduleSidebarUpdate = () => {
      sidebarSampleUntil = performance.now() + 450;
      scheduleSplitSync(true);

      if (!sidebarFrame) {
        sidebarFrame = window.requestAnimationFrame(sampleSidebar);
      }
    };

    const sidebarObserver = new ResizeObserver(scheduleSidebarUpdate);
    sidebarObserver.observe(sidebar);

    const sidebarStateObserver = new MutationObserver(() => {
      updateBrowserLayoutMode();
      scheduleSidebarUpdate();
    });
    sidebarStateObserver.observe(sidebar, { attributes: true });
    sidebarStateObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "zen-compact-mode",
        "zen-compact-animating",
        "zen-sidebar-expanded",
        "zen-single-toolbar",
        "zen-right-side",
      ],
    });

    sidebar.addEventListener("transitionrun", scheduleSidebarUpdate);
    sidebar.addEventListener("transitionend", scheduleSidebarUpdate);

    const splitBars = new Map();
    const observedSplitContainers = new Set();
    let splitFrame = 0;
    let splitSampleUntil = 0;

    const getSplitContainer = tab =>
      tab?.linkedBrowser?.closest?.(".browserSidebarContainer") ?? null;

    const getVisiblePanelBounds = container => {
      const bounds = container.getBoundingClientRect();
      const ancestors = [];
      let left = bounds.left;
      let right = bounds.right;
      let top = bounds.top;
      let bottom = bounds.bottom;

      // Zen can clip a full-height browser container inside a smaller split
      // cell. Intersect every rendered ancestor so centering uses the panel
      // the user actually sees, not the oversized internal browser box.
      for (
        let ancestor = container.parentElement;
        ancestor && ancestor !== contentHost;
        ancestor = ancestor.parentElement
      ) {
        const rect = ancestor.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        ancestors.push(ancestor);
        left = Math.max(left, rect.left);
        right = Math.min(right, rect.right);
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }

      return { left, right, top, bottom, ancestors };
    };

    const getUsableSplitBounds = container => {
      const panelBounds = getVisiblePanelBounds(container);
      const hostRect = contentHost.getBoundingClientRect();
      let left = Math.max(panelBounds.left, hostRect.left);
      let right = Math.min(panelBounds.right, hostRect.right);
      const top = Math.max(panelBounds.top, hostRect.top);
      const bottom = Math.min(panelBounds.bottom, hostRect.bottom);
      const sidebarRect = sidebar.getBoundingClientRect();

      if (document.documentElement.getAttribute("zen-right-side") === "true") {
        if (
          sidebarRect.left < right &&
          sidebarRect.right >= panelBounds.right
        ) {
          right = Math.max(left, Math.min(right, sidebarRect.left));
        }
      } else if (
        sidebarRect.right > left &&
        sidebarRect.left <= panelBounds.left
      ) {
        left = Math.min(right, Math.max(left, sidebarRect.right));
      }

      return {
        ...panelBounds,
        left,
        right,
        top,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    };

    const getActiveSplitTabs = () => {
      const splitter = window.gZenViewSplitter;
      const group = splitter?._data?.[splitter.currentView];
      let tabs = Array.isArray(group?.tabs) ? group.tabs : [];

      if (tabs.length < 2) {
        tabs = Array.from(gBrowser.tabs).filter(tab => {
          const container = getSplitContainer(tab);
          return (
            !tab.closing &&
            (tab.splitView || tab.hasAttribute("split-view")) &&
            container?.getAttribute("zen-split") === "true"
          );
        });
      }

      return tabs.filter(tab => {
        const container = getSplitContainer(tab);
        return (
          !tab.closing &&
          container &&
          container.getAttribute("zen-split") === "true" &&
          container.getBoundingClientRect().width > 0
        );
      });
    };

    const getPanelBoundsForTab = tab => {
      const container = getSplitContainer(tab);
      if (!container) {
        return null;
      }

      const bounds = getUsableSplitBounds(container);
      const tabs = getActiveSplitTabs();
      if (tabs.length < 2) {
        return bounds;
      }

      const hostRect = contentHost.getBoundingClientRect();
      const rect = container.getBoundingClientRect();
      const peerRects = tabs
        .filter(peer => peer !== tab)
        .map(peer => getSplitContainer(peer)?.getBoundingClientRect())
        .filter(Boolean);
      const nextLeft = peerRects
        .map(peer => peer.left)
        .filter(left => left > rect.left + 2)
        .sort((a, b) => a - b)[0];
      const nextTop = peerRects
        .map(peer => peer.top)
        .filter(top => top > rect.top + 2)
        .sort((a, b) => a - b)[0];
      const right = Math.min(
        bounds.right,
        nextLeft ?? hostRect.right
      );
      const bottom = Math.min(
        bounds.bottom,
        nextTop ?? hostRect.bottom
      );

      return {
        ...bounds,
        right,
        bottom,
        width: Math.max(0, right - bounds.left),
        height: Math.max(0, bottom - bounds.top),
      };
    };

    const applyTone = (element, appearance) => {
      element?.setAttribute(
        "data-page-tone",
        appearance?.tone === "light" ? "light" : "dark"
      );
    };

    const updateMaterialAppearance = () => {
      const tabs = getActiveSplitTabs();

      for (const [tab, entry] of splitBars) {
        applyTone(
          entry.bar,
          pageAppearanceByBrowser.get(tab.linkedBrowser)
        );
      }

      let edgeBrowser = gBrowser.selectedBrowser;
      if (tabs.length >= 2) {
        const rightmostTab = tabs.reduce((best, tab) => {
          if (!best) {
            return tab;
          }
          const right = getSplitContainer(tab)?.getBoundingClientRect().right ?? 0;
          const bestRight =
            getSplitContainer(best)?.getBoundingClientRect().right ?? 0;
          return right > bestRight ? tab : best;
        }, null);
        edgeBrowser = rightmostTab?.linkedBrowser ?? edgeBrowser;
      }

      const edgeAppearance = pageAppearanceByBrowser.get(edgeBrowser);
      if (edgeAppearance) {
        document.documentElement.setAttribute(
          "floating-domain-page-tone",
          edgeAppearance.tone === "light" ? "light" : "dark"
        );
      } else {
        document.documentElement.removeAttribute("floating-domain-page-tone");
      }
    };

    refreshAppearance = updateMaterialAppearance;
    refreshAppearance();

    const activateTab = tab => {
      if (tab && !tab.closing && gBrowser.selectedTab !== tab) {
        gBrowser.selectedTab = tab;
      }
    };

    let nativeFloatingTab = null;
    let nativeFocusFrame = 0;

    const focusNativeUrlbar = () => {
      if (nativeFocusFrame) {
        window.cancelAnimationFrame(nativeFocusFrame);
      }

      nativeFocusFrame = window.requestAnimationFrame(() => {
        nativeFocusFrame = 0;

        if (
          !urlbar.hasAttribute("zen-floating-urlbar") ||
          !urlbar.hasAttribute("open")
        ) {
          return;
        }

        try {
          gURLBar.focus();

          const input = gURLBar.inputField;
          if (input && document.activeElement !== input) {
            input.focus();
          }

          if (typeof gURLBar.select === "function") {
            gURLBar.select();
          } else {
            input?.select();
          }
        } catch {
          // Zen may close or replace the URL bar while the frame is pending.
        }
      });
    };

    const clearNativeFloatingState = () => {
      nativeFloatingTab = null;
      document.documentElement.removeAttribute(
        "floating-domain-bar-native-open"
      );
      document.documentElement.style.removeProperty(
        "--floating-domain-native-left"
      );
      document.documentElement.style.removeProperty(
        "--floating-domain-native-top"
      );
      document.documentElement.style.removeProperty(
        "--floating-domain-native-width"
      );
    };

    const updateNativeFloatingGeometry = tab => {
      const container = getSplitContainer(tab);
      if (!container || tab?.closing) {
        clearNativeFloatingState();
        return false;
      }

      const bounds = getPanelBoundsForTab(tab);
      if (bounds.width < 128 || bounds.height < 64) {
        clearNativeFloatingState();
        return false;
      }

      const sidePadding = bounds.width < 360 ? 8 : 12;
      const width = Math.max(
        120,
        Math.min(750, bounds.width / 1.5, bounds.width - sidePadding * 2)
      );
      const popupHeight = Math.min(333, Math.max(62, bounds.height - 24));
      const top = bounds.top + Math.max(12, (bounds.height - popupHeight) / 2);

      nativeFloatingTab = tab;
      document.documentElement.setAttribute(
        "floating-domain-bar-native-open",
        "true"
      );
      document.documentElement.style.setProperty(
        "--floating-domain-native-left",
        `${Math.round(bounds.left + bounds.width / 2)}px`
      );
      document.documentElement.style.setProperty(
        "--floating-domain-native-top",
        `${Math.round(top)}px`
      );
      document.documentElement.style.setProperty(
        "--floating-domain-native-width",
        `${Math.round(width)}px`
      );
      return true;
    };

    const openZenFloatingUrlbar = tab => {
      if (!tab || tab.closing) {
        return;
      }

      activateTab(tab);
      if (!updateNativeFloatingGeometry(tab)) {
        clearNativeFloatingState();
        return;
      }

      // Zen only floats the native editor when focus did not originate from
      // its own mousedown handler. Our idle domain bar acts exactly like Ctrl+L.
      gURLBar.focusedViaMousedown = false;
      document.getElementById("Browser:OpenLocation")?.doCommand();
      focusNativeUrlbar();
    };

    const makeSplitButton = (actionName, title, action) => {
      const button = document.createElementNS(HTML_NS, "button");
      button.type = "button";
      button.className = "floating-domain-split-button";
      button.dataset.action = actionName;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        action();
      });
      return button;
    };

    const updateSplitBar = tab => {
      const entry = splitBars.get(tab);
      if (!entry) {
        return;
      }

      const browser = tab.linkedBrowser;
      entry.input.value = labelForURI(browser.currentURI);
      entry.back.disabled = !browser.canGoBack;
      entry.forward.disabled = !browser.canGoForward;
      entry.bar.toggleAttribute("data-selected", gBrowser.selectedTab === tab);
      applyTone(entry.bar, pageAppearanceByBrowser.get(browser));
      renderLoadingIndicator(entry.loading, loadingTracker.get(browser));
    };

    const createSplitBar = tab => {
      const bar = document.createElementNS(HTML_NS, "div");
      bar.className = "floating-domain-split-bar";

      const controls = document.createElementNS(HTML_NS, "div");
      controls.className = "floating-domain-split-controls";

      const back = makeSplitButton("back", "Geri", () => {
        activateTab(tab);
        if (tab.linkedBrowser.canGoBack) {
          tab.linkedBrowser.goBack();
        }
      });
      const forward = makeSplitButton("forward", "İleri", () => {
        activateTab(tab);
        if (tab.linkedBrowser.canGoForward) {
          tab.linkedBrowser.goForward();
        }
      });
      const reload = makeSplitButton("reload", "Yenile", () => {
        activateTab(tab);
        gBrowser.reloadTab(tab);
      });
      controls.append(back, forward, reload);

      const shell = document.createElementNS(HTML_NS, "div");
      shell.className = "floating-domain-split-input-shell";

      const input = document.createElementNS(HTML_NS, "input");
      input.className = "floating-domain-split-input";
      input.type = "text";
      input.readOnly = true;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", "Bu panelde ara veya adres gir");
      input.addEventListener("pointerdown", event => {
        if (event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      input.addEventListener("mousedown", event => {
        if (event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      input.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openZenFloatingUrlbar(tab);
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          openZenFloatingUrlbar(tab);
        }
      });

      const loading = createLoadingIndicator();
      shell.append(input, loading.track);
      bar.append(controls, shell);
      splitLayer.appendChild(bar);

      const entry = { bar, controls, input, back, forward, reload, loading };
      splitBars.set(tab, entry);
      updateSplitBar(tab);
      return entry;
    };

    const syncSplitBars = () => {
      splitFrame = 0;
      const tabs = getActiveSplitTabs();
      const activeTabs = new Set(tabs);
      const isActive = tabs.length >= 2;

      document.documentElement.toggleAttribute(
        "floating-domain-bar-split-active",
        isActive
      );
      splitLayer.toggleAttribute("data-active", isActive);

      for (const [tab, entry] of splitBars) {
        if (!activeTabs.has(tab)) {
          entry.bar.remove();
          splitBars.delete(tab);
        }
      }

      const hostRect = contentHost.getBoundingClientRect();
      const nextObserved = new Set([contentHost]);

      for (const tab of tabs) {
        const container = getSplitContainer(tab);
        if (!container) {
          continue;
        }

        nextObserved.add(container);
        const panelBounds = getPanelBoundsForTab(tab);
        if (!panelBounds) {
          continue;
        }
        for (const ancestor of panelBounds.ancestors) {
          nextObserved.add(ancestor);
        }
        const visibleLeft = panelBounds.left;
        const visibleTop = panelBounds.top;
        const visibleWidth = panelBounds.width;
        const visibleHeight = panelBounds.height;
        const entry = splitBars.get(tab) || createSplitBar(tab);
        const sidePadding = visibleWidth < 360 ? 8 : 12;
        const rowWidth = Math.max(
          120,
          Math.min(872, visibleWidth - sidePadding * 2)
        );
        const left =
          visibleLeft - hostRect.left + (visibleWidth - rowWidth) / 2;
        const top = visibleTop - hostRect.top + 10;

        entry.bar.style.left = `${Math.round(left)}px`;
        entry.bar.style.top = `${Math.round(top)}px`;
        entry.bar.style.width = `${Math.round(rowWidth)}px`;
        entry.bar.hidden = visibleWidth < 128 || visibleHeight < 64;
        entry.bar.toggleAttribute("data-narrow", visibleWidth < 420);
        updateSplitBar(tab);
      }

      if (nativeFloatingTab) {
        updateNativeFloatingGeometry(nativeFloatingTab);
      }

      refreshAppearance();

      for (const observed of observedSplitContainers) {
        if (!nextObserved.has(observed)) {
          splitResizeObserver.unobserve(observed);
          observedSplitContainers.delete(observed);
        }
      }

      for (const observed of nextObserved) {
        if (!observedSplitContainers.has(observed)) {
          splitResizeObserver.observe(observed);
          observedSplitContainers.add(observed);
        }
      }

      if (performance.now() < splitSampleUntil) {
        splitFrame = window.requestAnimationFrame(syncSplitBars);
      }
    };

    scheduleSplitSync = (sampleForTransition = false) => {
      if (sampleForTransition) {
        splitSampleUntil = performance.now() + 500;
      }

      if (!splitFrame) {
        splitFrame = window.requestAnimationFrame(syncSplitBars);
      }
    };

    const splitResizeObserver = new ResizeObserver(() => scheduleSplitSync());
    splitResizeObserver.observe(contentHost);
    observedSplitContainers.add(contentHost);

    const splitMutationObserver = new MutationObserver(() =>
      scheduleSplitSync(true)
    );
    splitMutationObserver.observe(tabPanels, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["zen-split-view", "zen-split", "is-zen-split"],
    });
    splitMutationObserver.observe(contentHost, {
      attributes: true,
      attributeFilter: ["zen-split-view"],
    });

    const splitEvents = [
      "ZenViewSplitter:SplitViewActivated",
      "ZenViewSplitter:SplitViewDeactivated",
      "ZenSplitViewTabsSplit",
      "ZenTabRemovedFromSplit",
      "TabSplitViewActivate",
      "TabSplitViewDeactivate",
    ];
    const onSplitEvent = () => scheduleSplitSync(true);
    for (const eventName of splitEvents) {
      window.addEventListener(eventName, onSplitEvent);
    }

    const loadingTracker = createLoadingTracker({
      onChange(browser) {
        if (browser === gBrowser.selectedBrowser) {
          renderLoadingIndicator(domainLoading, loadingTracker.get(browser));
        }
        const tab = gBrowser.getTabForBrowser(browser);
        const entry = tab && splitBars.get(tab);
        if (entry) {
          renderLoadingIndicator(entry.loading, loadingTracker.get(browser));
        }
      },
    });

    const progressListener = {
      onLocationChange(browser, _webProgress, _request, locationURI) {
        if (!_webProgress?.isTopLevel) {
          return;
        }

        if (_webProgress.isLoadingDocument) {
          const container = browser?.closest?.(".browserSidebarContainer");
          container?.style.removeProperty("--floating-domain-page-color");
          container?.removeAttribute("floating-domain-page-tone");
          pageAppearanceByBrowser.delete(browser);
          refreshAppearance();
        }

        if (browser === gBrowser.selectedBrowser) {
          update(locationURI);
        }

        requestPageColor(browser);

        const tab = gBrowser.getTabForBrowser(browser);
        if (tab && splitBars.has(tab)) {
          updateSplitBar(tab);
        }
      },

      onStateChange(browser, webProgress, request, stateFlags, status) {
        loadingTracker.onStateChange(
          browser, webProgress, request, stateFlags, status
        );
        const tab = gBrowser.getTabForBrowser(browser);
        if (tab && splitBars.has(tab)) {
          updateSplitBar(tab);
        }
      },

      onProgressChange(
        browser, webProgress, _request, _currentSelf,
        _maximumSelf, currentTotal, maximumTotal
      ) {
        loadingTracker.onProgressChange(
          browser, webProgress, currentTotal, maximumTotal
        );
      },
    };

    const onTabSelect = () => {
      loadingTracker.seed(gBrowser.selectedBrowser);
      update();
      refreshAppearance();
      requestPageColor(gBrowser.selectedBrowser);
      scheduleSplitSync();

      if (
        urlbar.hasAttribute("zen-floating-urlbar") &&
        urlbar.hasAttribute("open")
      ) {
        updateNativeFloatingGeometry(gBrowser.selectedTab);
        focusNativeUrlbar();
      }
    };
    const onTabChange = event => {
      if (event.type === "TabClose") {
        loadingTracker.forget(event.target.linkedBrowser);
      }
      scheduleSplitSync(true);
    };
    const onPageShow = () => update();
    const onWindowResize = () => {
      scheduleSidebarUpdate();
      scheduleSplitSync(true);
    };
    const onWindowKeyDown = event => {
      if (
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLowerCase() !== "l"
      ) {
        return;
      }

      if (!updateNativeFloatingGeometry(gBrowser.selectedTab)) {
        clearNativeFloatingState();
      }
    };
    const onDomainButtonClick = event => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openZenFloatingUrlbar(gBrowser.selectedTab);
    };
    const nativeUrlbarStateObserver = new MutationObserver(() => {
      if (urlbar.hasAttribute("zen-floating-urlbar")) {
        updateNativeFloatingGeometry(gBrowser.selectedTab);
        if (urlbar.hasAttribute("open")) {
          focusNativeUrlbar();
        }
      } else if (
        !urlbar.hasAttribute("breakout-extend")
      ) {
        clearNativeFloatingState();
      }
    });
    nativeUrlbarStateObserver.observe(urlbar, {
      attributes: true,
      attributeFilter: ["zen-floating-urlbar", "breakout-extend", "open"],
    });

    gBrowser.addTabsProgressListener(progressListener);
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    gBrowser.tabContainer.addEventListener("TabOpen", onTabChange);
    gBrowser.tabContainer.addEventListener("TabClose", onTabChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("keydown", onWindowKeyDown, true);
    domainButton.addEventListener("click", onDomainButtonClick);
    for (const tab of gBrowser.tabs) {
      loadingTracker.seed(tab.linkedBrowser);
    }

    const cleanup = () => {
      loadingTracker.destroy();
      try {
        gBrowser.removeTabsProgressListener(progressListener);
      } catch {
        // The browser window may already be tearing down.
      }

      gBrowser.tabContainer?.removeEventListener("TabSelect", onTabSelect);
      gBrowser.tabContainer?.removeEventListener("TabOpen", onTabChange);
      gBrowser.tabContainer?.removeEventListener("TabClose", onTabChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("keydown", onWindowKeyDown, true);
      domainButton.removeEventListener("click", onDomainButtonClick);
      nativeUrlbarStateObserver.disconnect();
      clearNativeFloatingState();
      sidebarObserver.disconnect();
      sidebarStateObserver.disconnect();
      splitResizeObserver.disconnect();
      splitMutationObserver.disconnect();

      if (pageColorFrameScriptURL) {
        try {
          frameManager.removeMessageListener(PAGE_COLOR_MESSAGE, onPageColor);
          frameManager.broadcastAsyncMessage(PAGE_COLOR_DESTROY_MESSAGE);
          frameManager.removeDelayedFrameScript(pageColorFrameScriptURL);
        } catch {
          // The message manager may already be gone during shutdown.
        }
      }

      for (const container of document.querySelectorAll(
        ".browserSidebarContainer"
      )) {
        container.style.removeProperty("--floating-domain-page-color");
        container.removeAttribute("floating-domain-page-tone");
      }

      sidebar.removeEventListener("transitionrun", scheduleSidebarUpdate);
      sidebar.removeEventListener("transitionend", scheduleSidebarUpdate);

      for (const eventName of splitEvents) {
        window.removeEventListener(eventName, onSplitEvent);
      }

      if (sidebarFrame) {
        window.cancelAnimationFrame(sidebarFrame);
      }

      if (splitFrame) {
        window.cancelAnimationFrame(splitFrame);
      }

      if (nativeFocusFrame) {
        window.cancelAnimationFrame(nativeFocusFrame);
      }

      document.documentElement.style.removeProperty(
        "--floating-domain-bar-sidebar-width"
      );
      document.documentElement.removeAttribute(
        "floating-domain-bar-layout-ready"
      );
      document.documentElement.removeAttribute(
        "floating-domain-bar-split-active"
      );
      document.documentElement.removeAttribute(
        "floating-domain-bar-browser-layout"
      );
      document.documentElement.removeAttribute(
        "floating-domain-page-tone"
      );

      for (const { node, parent, nextSibling } of originalPositions.reverse()) {
        if (nextSibling?.parentNode === parent) {
          parent.insertBefore(node, nextSibling);
        } else {
          parent.appendChild(node);
        }
      }

      stopWindowDrag();
      dragRegion.removeEventListener("pointerdown", onWindowDragStart);
      dragRegion.removeEventListener("dblclick", onWindowDragDoubleClick);
      splitLayer.remove();
      layout.remove();
      dragRegion.remove();
      label.remove();
      delete window[STATE_KEY];
    };

    window[STATE_KEY] = { cleanup, update, scheduleSplitSync };
    window.addEventListener("unload", cleanup, { once: true });
    updateSidebarWidth();
    update();
    scheduleSplitSync(true);
    if (urlbar.hasAttribute("zen-floating-urlbar")) {
      updateNativeFloatingGeometry(gBrowser.selectedTab);
      if (urlbar.hasAttribute("open")) {
        focusNativeUrlbar();
      }
    }
    return true;
  }

  let attempts = 0;
  const waitForBrowser = () => {
    if (init()) {
      return;
    }

    attempts += 1;
    if (attempts < 40) {
      window.setTimeout(waitForBrowser, 250);
    }
  };

  waitForBrowser();
})();
