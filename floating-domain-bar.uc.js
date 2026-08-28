(() => {
  "use strict";

  const STATE_KEY = "__floatingDomainBarState";
  const LABEL_ID = "floating-domain-bar-label";

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

  function init() {
    const urlbar = document.getElementById("urlbar");
    const inputBox = urlbar?.querySelector(".urlbar-input-box");

    if (!urlbar || !inputBox || !window.gBrowser) {
      return false;
    }

    let label = document.getElementById(LABEL_ID);

    if (!label) {
      label = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "span"
      );
      label.id = LABEL_ID;
      label.setAttribute("aria-hidden", "true");
      inputBox.appendChild(label);
    }

    const update = uri => {
      const currentURI = uri || gBrowser.selectedBrowser?.currentURI;
      label.textContent = labelForURI(currentURI);
    };

    const progressListener = {
      onLocationChange(browser, _webProgress, _request, locationURI) {
        if (browser === gBrowser.selectedBrowser) {
          update(locationURI);
        }
      },
    };

    const onTabSelect = () => update();
    const onPageShow = () => update();

    gBrowser.addTabsProgressListener(progressListener);
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    window.addEventListener("pageshow", onPageShow);

    const cleanup = () => {
      try {
        gBrowser.removeTabsProgressListener(progressListener);
      } catch {
        // The browser window may already be tearing down.
      }

      gBrowser.tabContainer?.removeEventListener("TabSelect", onTabSelect);
      window.removeEventListener("pageshow", onPageShow);
      label.remove();
      delete window[STATE_KEY];
    };

    window[STATE_KEY] = { cleanup, update };
    window.addEventListener("unload", cleanup, { once: true });
    update();
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
