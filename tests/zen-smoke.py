"""Optional live smoke test. Requires marionette_driver and a Zen executable.

Runs in a fresh, headless profile; never connects to the user's browser session.
Profile and screenshots are retained in the printed temporary output directory.
"""
import argparse
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.parse import quote

from marionette_driver.keys import Keys
from marionette_driver.marionette import Marionette


def wait_for(check, description, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.1)
    raise AssertionError(f"Timed out: {description}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=Path)
    args = parser.parse_args()
    binary = args.binary.resolve(strict=True)
    root = Path(__file__).resolve().parent.parent
    output = Path(tempfile.mkdtemp(prefix="floating-domain-bar-smoke-"))
    profile = output / "profile"
    profile.mkdir()
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1", 0))
        port = reserved.getsockname()[1]
    prefs = {
        "marionette.port": port,
        "browser.shell.checkDefaultBrowser": False,
        "browser.startup.page": 0,
        "browser.startup.homepage": "about:blank",
        "browser.aboutwelcome.enabled": False,
        "zen.welcome-screen.seen": True,
        "toolkit.legacyUserProfileCustomizations.stylesheets": True,
    }
    (profile / "user.js").write_text("\n".join(
        f"user_pref({json.dumps(k)}, {json.dumps(v)});" for k, v in prefs.items()
    ), encoding="utf-8")
    print(f"Artifacts: {output}", flush=True)
    log = (output / "zen.log").open("w", encoding="utf-8")
    process = subprocess.Popen([
        str(binary), "-no-remote", "-profile", str(profile), "-headless",
        "-marionette", "--remote-allow-system-access", "about:blank",
    ], stdout=log, stderr=log,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    client = Marionette("localhost", port=port)
    results = []

    def chrome(script, *values):
        client.set_context("chrome")
        return client.execute_script(script, script_args=list(values))

    def passed(name):
        results.append(name)
        print(f"PASS {name}", flush=True)

    def page(color, title="Smoke"):
        return "data:text/html," + quote(
            f'<html style="background:{color}"><title>{title}</title>'
            '<body style="margin:0;font:24px sans-serif;color:#888">'
            '<h1>Floating Domain Bar</h1><p>Browser smoke test</p>'
            '<div style="height:1800px"></div></body></html>'
        )

    try:
        client.raise_for_port(timeout=30)
        client.start_session()
        assert Path(client.session_capabilities["moz:profile"]).resolve() == profile.resolve()
        print(f"Zen {client.session_capabilities['browserVersion']}", flush=True)
        wait_for(lambda: chrome("return !!window.gBrowser && !!window.gZenViewSplitter;"), "browser startup")
        client.set_window_rect(width=1200, height=850)
        source = (root / "floating-domain-bar.uc.js").read_text(encoding="utf-8")
        chrome("""
          window.smokeOriginalControls = ['back-button','forward-button','stop-reload-button','PanelUI-button']
            .map(id => { const node=document.getElementById(id); return {node,parent:node.parentNode,next:node.nextSibling}; });
          window.windowUtils.loadSheet(Services.io.newURI(arguments[0]), window.windowUtils.USER_SHEET);
          // Explicit author visibility must not revive the dormant no-drag box.
          const visibilityStyle=document.createElementNS('http://www.w3.org/1999/xhtml','style');
          visibilityStyle.textContent='#urlbar-container { visibility: visible; }';
          document.documentElement.appendChild(visibilityStyle);
        """, (root / "userChrome.css").as_uri())
        chrome(source)
        wait_for(lambda: chrome("return !!window.__floatingDomainBarState;"), "mod initialization")
        passed("initialization")

        for color, tone in [
            ("rgb(255, 255, 255)", "light"), ("rgb(0, 0, 0)", "dark"),
            ("oklch(0.98 0 0)", "light"), ("oklch(0.15 0 0)", "dark"),
            ("color(display-p3 1 1 1)", "light"), ("color(display-p3 0 0 0)", "dark"),
            ("lab(98 0 0)", "light"), ("lab(5 0 0)", "dark"),
        ]:
            client.set_context("content")
            client.navigate(page(color))
            computed = client.execute_script("return getComputedStyle(document.documentElement).backgroundColor;")
            wait_for(lambda: chrome("""return document.documentElement.getAttribute('floating-domain-page-tone')===arguments[0]
              && gBrowser.selectedBrowser.closest('.browserSidebarContainer').style.getPropertyValue('--floating-domain-page-color')===arguments[1];""", tone, computed), color)
            passed(f"color contrast: {color}")

        chrome("document.getElementById('floating-domain-bar-domain').click();")
        wait_for(lambda: chrome("return document.activeElement===gURLBar.inputField;"), "editor focus")
        assert chrome("return gURLBar.inputField.selectionStart===0 && gURLBar.inputField.selectionEnd===gURLBar.inputField.value.length;")
        client.find_element("css selector", "#urlbar-input").send_keys(Keys.ESCAPE)
        passed("domain click focuses and selects native address editor")

        chrome("""window.smokeTabs=[gBrowser.selectedTab,gBrowser.addTab(arguments[0],
          {triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()})];""", page("oklch(0.98 0 0)", "Light"))
        for direction in ["vsep", "hsep"]:
            chrome("gZenViewSplitter.splitTabs(window.smokeTabs,arguments[0]);", direction)
            wait_for(lambda: chrome("return document.querySelectorAll('.floating-domain-split-bar').length===2;"), direction)
            wait_for(lambda: chrome("return [...document.querySelectorAll('.floating-domain-split-bar')].map(e=>e.dataset.pageTone).sort().join() === 'dark,light';"), "independent panel tones")
            time.sleep(0.6)  # Allow split layout transitions to settle before measuring.
            assert chrome("""return [...document.querySelectorAll('.floating-domain-split-input')].every(e=>{
              const s=getComputedStyle(e); return s.backgroundColor==='rgba(0, 0, 0, 0)' && s.borderTopWidth==='0px' && s.paddingLeft==='38px';
            });""")
            assert chrome("""return [...document.querySelectorAll('.floating-domain-split-bar')].every(e=>{
              const canvas=new OffscreenCanvas(1,1), ctx=canvas.getContext('2d');
              ctx.fillStyle=getComputedStyle(e.querySelector('input')).color; ctx.fillRect(0,0,1,1);
              const value=ctx.getImageData(0,0,1,1).data[0]; return e.dataset.pageTone==='light' ? value<64 : value>200;
            });""")
            for index in [0, 1]:
                chrome("document.querySelectorAll('.floating-domain-split-input')[arguments[0]].click();", index)
                wait_for(lambda: chrome("return document.activeElement===gURLBar.inputField;"), "split editor focus")
                assert chrome("return gBrowser.selectedTab===window.smokeTabs[arguments[0]];", index)
                rect = chrome("return document.getElementById('urlbar').getBoundingClientRect().toJSON();")
                bar = chrome("return document.querySelectorAll('.floating-domain-split-bar')[arguments[0]].getBoundingClientRect().toJSON();", index)
                if direction == "vsep":
                    assert abs((rect["left"] + rect["right"] - bar["left"] - bar["right"]) / 2) < 3
                elif index == 0:
                    lower = chrome("return document.querySelectorAll('.floating-domain-split-bar')[1].getBoundingClientRect().top;")
                    assert rect["bottom"] < lower
                else:
                    assert rect["top"] > bar["top"]
                client.find_element("css selector", "#urlbar-input").send_keys(Keys.ESCAPE)
            (output / f"split-{direction}.png").write_bytes(client.screenshot(format="binary"))
            passed(f"Split View {direction}: contrast, input theme, panel editor geometry")
        chrome("gZenViewSplitter.unsplitCurrentView();")
        wait_for(lambda: chrome("return !document.querySelector('.floating-domain-split-bar');"), "unsplit cleanup")
        passed("unsplit removes panel bars")

        for expanded, single, mode in [
            (True, True, "only-sidebar"), (True, False, "sidebar-and-top-toolbar"),
            (False, False, "collapsed-sidebar"),
        ]:
            chrome("""Services.prefs.setBoolPref('zen.view.sidebar-expanded',arguments[0]);
              Services.prefs.setBoolPref('zen.view.use-single-toolbar',arguments[1]);""", expanded, single)
            wait_for(lambda: chrome("return document.documentElement.getAttribute('floating-domain-bar-browser-layout')===arguments[0];", mode), mode)
            time.sleep(0.5)
            assert chrome("""const e=document.getElementById('floating-domain-bar-domain'), r=e.getBoundingClientRect();
              return r.width>0 && r.left>=0 && r.right<=window.innerWidth && getComputedStyle(e).visibility==='visible';""")
            assert chrome("""const drag=document.getElementById('floating-domain-bar-drag-region');
              const r=drag.getBoundingClientRect(), y=r.top+r.height/2;
              let hasBlankHeader=false;
              for(let x=Math.max(0,r.left)+2;x<Math.min(innerWidth,r.right);x+=4) {
                if(document.elementFromPoint(x,y)===drag) { hasBlankHeader=true; break; }
              }
              return hasBlankHeader && ['floating-domain-bar-domain','back-button','PanelUI-button'].every(id=>{
                const e=document.getElementById(id), b=e.getBoundingClientRect();
                // Zen hides its menu button in some toolbar layouts.
                if(id==='PanelUI-button' && !b.width && !b.height) return true;
                const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
                return e===hit || e.contains(hit);
              });"""), f"Header drag region must leave controls clickable: {mode}"
            assert chrome("return getComputedStyle(document.getElementById('urlbar-container')).visibility==='hidden';"), f"Dormant no-drag container must stay hidden: {mode}"
            chrome("document.getElementById('floating-domain-bar-domain').click();")
            wait_for(lambda: chrome("return document.activeElement===gURLBar.inputField && getComputedStyle(gURLBar.inputField).visibility==='visible';"), f"visible editor: {mode}")
            client.find_element("css selector", "#urlbar-input").send_keys(Keys.ESCAPE)
            assert chrome("""return [...document.querySelectorAll('.titlebar-button')].every(e=>{
              const r=e.getBoundingClientRect(); return !r.width || getComputedStyle(e).visibility==='visible';
            });"""), f"Window controls must remain visible: {mode}"
            passed(f"browser layout: {mode}, header hit targets, editor and window controls")
        chrome("gZenCompactModeManager.toggle();")
        wait_for(lambda: chrome("return document.documentElement.getAttribute('zen-compact-mode')==='true';"), "compact mode")
        time.sleep(0.6)
        assert chrome("""const r=document.getElementById('floating-domain-bar-domain').getBoundingClientRect();
          return r.width>0 && r.left>=0 && r.right<=window.innerWidth;""")
        chrome("gZenCompactModeManager.toggle();")
        passed("Compact Mode keeps domain capsule in viewport")
        client.set_window_rect(width=640, height=600)
        time.sleep(0.6)
        rect = chrome("return document.getElementById('floating-domain-bar-domain').getBoundingClientRect().toJSON();")
        assert rect["left"] >= 0 and rect["right"] <= chrome("return window.innerWidth;")
        passed("narrow window keeps domain capsule in viewport")
        # Restore the starting layout: Zen itself relocates the neighbouring
        # extension button when layouts change, so its original order is only
        # comparable in the same layout.
        chrome("""Services.prefs.setBoolPref('zen.view.sidebar-expanded',true);
          Services.prefs.setBoolPref('zen.view.use-single-toolbar',true);""")
        wait_for(lambda: chrome("return document.documentElement.getAttribute('floating-domain-bar-browser-layout')==='only-sidebar';"), "restore starting layout")
        time.sleep(0.5)
        client.set_context("content")
        before = client.execute_script("return document.documentElement.outerHTML;")
        chrome("window.smokeCleanup=window.__floatingDomainBarState.cleanup; window.smokeCleanup(); window.smokeCleanup();")
        assert chrome("""return !window.__floatingDomainBarState && !document.getElementById('floating-domain-bar-layout')
          && window.smokeOriginalControls.every(({node,parent,next})=>node.parentNode===parent && node.nextSibling===next);""")
        chrome(source)
        wait_for(lambda: chrome("return !!window.__floatingDomainBarState;"), "reinitialize")
        assert chrome("return document.querySelectorAll('#floating-domain-bar-layout').length===1;")
        client.set_context("content")
        assert before == client.execute_script("return document.documentElement.outerHTML;")
        passed("repeat cleanup and reinitialize preserve controls and website DOM")
    finally:
        (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
        try:
            # This instance was launched with Popen, not Marionette's runner.
            # Request a normal browser shutdown before waiting for our process.
            chrome("window.setTimeout(() => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit), 100);")
            client.delete_session(send_request=False)
        except Exception:
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        log.close()
    print(f"{len(results)} browser checks passed. Artifacts: {output}")


if __name__ == "__main__":
    main()
