(() => {
  "use strict";

  const STATE_KEY = "__floatingDomainBarState";
  const LABEL_ID = "floating-domain-bar-label";
  const LAYOUT_ID = "floating-domain-bar-layout";
  const SPLIT_LAYER_ID = "floating-domain-split-layer";
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

  function editableValueForURI(uri) {
    const spec = uri?.displaySpec ?? uri?.spec ?? "";
    return /^about:(?:blank|home|newtab)(?:[?#].*)?$/i.test(spec) ? "" : spec;
  }

  function init() {
    const urlbar = document.getElementById("urlbar");
    const urlbarContainer = document.getElementById("urlbar-container");
    const inputBox = urlbar?.querySelector(".urlbar-input-box");
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
      !inputBox ||
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

    let label = document.getElementById(LABEL_ID);

    if (!label) {
      label = document.createElementNS(HTML_NS, "span");
      label.id = LABEL_ID;
      label.setAttribute("aria-hidden", "true");
      inputBox.appendChild(label);
    }

    const movedNodes = [
      backButton,
      forwardButton,
      stopReloadButton,
      urlbarContainer,
      panelButton,
    ];
    const originalPositions = movedNodes.map(node => ({
      node,
      parent: node.parentNode,
      nextSibling: node.nextSibling,
    }));

    const layout = document.createXULElement("hbox");
    layout.id = LAYOUT_ID;

    const leftControls = document.createXULElement("hbox");
    leftControls.id = "floating-domain-bar-left-controls";

    const rightControls = document.createXULElement("hbox");
    rightControls.id = "floating-domain-bar-right-controls";

    leftControls.append(backButton, forwardButton, stopReloadButton);
    rightControls.append(panelButton);
    layout.append(leftControls, urlbarContainer, rightControls);
    contentHost.appendChild(layout);

    const splitLayer = document.createElementNS(HTML_NS, "div");
    splitLayer.id = SPLIT_LAYER_ID;
    splitLayer.setAttribute("aria-label", "Split sekme adres çubukları");
    contentHost.appendChild(splitLayer);

    document.documentElement.setAttribute(
      "floating-domain-bar-layout-ready",
      "true"
    );

    const update = uri => {
      const currentURI = uri || gBrowser.selectedBrowser?.currentURI;
      label.textContent = labelForURI(currentURI);
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

    const sidebarStateObserver = new MutationObserver(scheduleSidebarUpdate);
    sidebarStateObserver.observe(sidebar, { attributes: true });
    sidebarStateObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "zen-compact-mode",
        "zen-compact-animating",
        "zen-sidebar-expanded",
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

    const activateTab = tab => {
      if (tab && !tab.closing && gBrowser.selectedTab !== tab) {
        gBrowser.selectedTab = tab;
      }
    };

    const makeSplitButton = (symbol, title, action) => {
      const button = document.createElementNS(HTML_NS, "button");
      button.type = "button";
      button.className = "floating-domain-split-button";
      button.textContent = symbol;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", event => {
        event.stopPropagation();
        action();
      });
      return button;
    };

    const navigateSplitTab = (tab, rawValue) => {
      const value = rawValue.trim();
      if (!value || !tab?.linkedBrowser) {
        return;
      }

      activateTab(tab);

      try {
        const flags =
          Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS |
          Ci.nsIURIFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP;
        const info = Services.uriFixup.getFixupURIInfo(value, flags);
        const options = {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        };

        if (info.postData) {
          options.postData = info.postData;
        }

        gURLBar._loadURL(
          info.preferredURI.spec,
          null,
          "current",
          {
            allowInheritPrincipal: false,
            postData: options.postData ?? null,
          },
          null,
          tab.linkedBrowser
        );
      } catch (error) {
        console.error("Floating Domain Bar: adres açılamadı", error);
      }
    };

    const updateSplitBar = tab => {
      const entry = splitBars.get(tab);
      if (!entry) {
        return;
      }

      const browser = tab.linkedBrowser;
      const editing = entry.input.getAttribute("data-editing") === "true";

      if (!editing) {
        entry.input.value = labelForURI(browser.currentURI);
      }

      entry.back.disabled = !browser.canGoBack;
      entry.forward.disabled = !browser.canGoForward;
      entry.bar.toggleAttribute("data-selected", gBrowser.selectedTab === tab);
    };

    const createSplitBar = tab => {
      const bar = document.createElementNS(HTML_NS, "div");
      bar.className = "floating-domain-split-bar";

      const controls = document.createElementNS(HTML_NS, "div");
      controls.className = "floating-domain-split-controls";

      const back = makeSplitButton("‹", "Geri", () => {
        activateTab(tab);
        if (tab.linkedBrowser.canGoBack) {
          tab.linkedBrowser.goBack();
        }
      });
      const forward = makeSplitButton("›", "İleri", () => {
        activateTab(tab);
        if (tab.linkedBrowser.canGoForward) {
          tab.linkedBrowser.goForward();
        }
      });
      const reload = makeSplitButton("↻", "Yenile", () => {
        activateTab(tab);
        tab.linkedBrowser.reload();
      });
      controls.append(back, forward, reload);

      const shell = document.createElementNS(HTML_NS, "div");
      shell.className = "floating-domain-split-input-shell";

      const input = document.createElementNS(HTML_NS, "input");
      input.className = "floating-domain-split-input";
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", "Bu panelde ara veya adres gir");

      input.addEventListener("focus", () => {
        activateTab(tab);
        input.setAttribute("data-editing", "true");
        input.value = editableValueForURI(tab.linkedBrowser.currentURI);
        window.requestAnimationFrame(() => input.select());
      });
      input.addEventListener("blur", () => {
        input.removeAttribute("data-editing");
        updateSplitBar(tab);
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          navigateSplitTab(tab, input.value);
          input.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          input.blur();
        }
      });

      shell.appendChild(input);
      bar.append(controls, shell);
      splitLayer.appendChild(bar);

      const entry = { bar, controls, input, back, forward, reload };
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
        const panelRect = container.getBoundingClientRect();
        let visibleLeft = panelRect.left;
        let visibleRight = panelRect.right;

        if (
          document.documentElement.getAttribute("zen-compact-mode") === "true"
        ) {
          const sidebarRect = sidebar.getBoundingClientRect();

          if (document.documentElement.getAttribute("zen-right-side") === "true") {
            if (
              sidebarRect.left < visibleRight &&
              sidebarRect.right >= panelRect.right
            ) {
              visibleRight = Math.max(
                visibleLeft,
                Math.min(visibleRight, sidebarRect.left)
              );
            }
          } else if (
            sidebarRect.right > visibleLeft &&
            sidebarRect.left <= panelRect.left
          ) {
            visibleLeft = Math.min(
              visibleRight,
              Math.max(visibleLeft, sidebarRect.right)
            );
          }
        }

        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        const entry = splitBars.get(tab) || createSplitBar(tab);
        const sidePadding = visibleWidth < 360 ? 8 : 12;
        const rowWidth = Math.max(
          120,
          Math.min(680, visibleWidth - sidePadding * 2)
        );
        const left =
          visibleLeft - hostRect.left + (visibleWidth - rowWidth) / 2;
        const top = panelRect.top - hostRect.top + 10;

        entry.bar.style.left = `${Math.round(left)}px`;
        entry.bar.style.top = `${Math.round(top)}px`;
        entry.bar.style.width = `${Math.round(rowWidth)}px`;
        entry.bar.hidden = visibleWidth < 128 || panelRect.height < 64;
        entry.bar.toggleAttribute("data-narrow", visibleWidth < 420);
        updateSplitBar(tab);
      }

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

    const progressListener = {
      onLocationChange(browser, _webProgress, _request, locationURI) {
        if (browser === gBrowser.selectedBrowser) {
          update(locationURI);
        }

        const tab = gBrowser.getTabForBrowser(browser);
        if (tab && splitBars.has(tab)) {
          updateSplitBar(tab);
        }
      },

      onStateChange(browser) {
        const tab = gBrowser.getTabForBrowser(browser);
        if (tab && splitBars.has(tab)) {
          updateSplitBar(tab);
        }
      },
    };

    const onTabSelect = () => {
      update();
      scheduleSplitSync();
    };
    const onTabChange = () => scheduleSplitSync(true);
    const onPageShow = () => update();
    const onWindowResize = () => {
      scheduleSidebarUpdate();
      scheduleSplitSync(true);
    };
    const onWindowKeyDown = event => {
      if (
        !document.documentElement.hasAttribute(
          "floating-domain-bar-split-active"
        ) ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLowerCase() !== "l"
      ) {
        return;
      }

      const entry = splitBars.get(gBrowser.selectedTab);
      if (entry) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        entry.input.focus();
      }
    };
    const nativeUrlInput = document.getElementById("urlbar-input");
    const redirectNativeUrlbarFocus = () => {
      if (
        !document.documentElement.hasAttribute(
          "floating-domain-bar-split-active"
        )
      ) {
        return;
      }

      const entry = splitBars.get(gBrowser.selectedTab);
      if (entry) {
        window.requestAnimationFrame(() => entry.input.focus());
      }
    };

    gBrowser.addTabsProgressListener(progressListener);
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    gBrowser.tabContainer.addEventListener("TabOpen", onTabChange);
    gBrowser.tabContainer.addEventListener("TabClose", onTabChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("keydown", onWindowKeyDown, true);
    window.addEventListener("keypress", onWindowKeyDown, true);
    nativeUrlInput?.addEventListener("focus", redirectNativeUrlbarFocus);

    const cleanup = () => {
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
      window.removeEventListener("keypress", onWindowKeyDown, true);
      nativeUrlInput?.removeEventListener("focus", redirectNativeUrlbarFocus);
      sidebarObserver.disconnect();
      sidebarStateObserver.disconnect();
      splitResizeObserver.disconnect();
      splitMutationObserver.disconnect();
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

      document.documentElement.style.removeProperty(
        "--floating-domain-bar-sidebar-width"
      );
      document.documentElement.removeAttribute(
        "floating-domain-bar-layout-ready"
      );
      document.documentElement.removeAttribute(
        "floating-domain-bar-split-active"
      );

      for (const { node, parent, nextSibling } of originalPositions.reverse()) {
        if (nextSibling?.parentNode === parent) {
          parent.insertBefore(node, nextSibling);
        } else {
          parent.appendChild(node);
        }
      }

      splitLayer.remove();
      layout.remove();
      label.remove();
      delete window[STATE_KEY];
    };

    window[STATE_KEY] = { cleanup, update, scheduleSplitSync };
    window.addEventListener("unload", cleanup, { once: true });
    updateSidebarWidth();
    update();
    scheduleSplitSync(true);
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
