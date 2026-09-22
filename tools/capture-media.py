"""Capture real Zen chrome with local demo pages, using a disposable profile.

Requires marionette_driver and Pillow. No personal browser data is accessed.
"""
import argparse
import io
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image
from marionette_driver.marionette import Marionette
from marionette_driver.keys import Keys


def demo(dark):
    background, foreground, muted, accent = (
        ("#171c24", "#ecf0f5", "#9ba8b9", "#a8cbb5") if dark else
        ("#f4f1e9", "#263d36", "#65766d", "#386c56")
    )
    title = "Night Studio" if dark else "Field Notes"
    headline = "Room to think." if dark else "A slower kind<br>of browsing."
    intro = ("A small space for ideas, experiments, and the work in progress."
             if dark else "Collected thoughts on attention, everyday rituals, and making space for what matters.")
    cards = ([('01 / EXPLORE', 'Ideas in motion', 'A place to begin, without a finished answer.'),
              ('02 / MAKE', 'Keep it simple', 'Less interface. More room for the work.')]
             if dark else [('01 / ATTENTION', 'The quiet morning', 'Start with a little less. Notice a little more.'),
                           ('02 / RITUALS', 'Small daily things', 'Good habits rarely announce themselves.')])
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>{title}</title>
<style>
*{{box-sizing:border-box}}html{{background:{background};color:{foreground};font:16px/1.6 Arial,sans-serif}}
body{{margin:0}}main{{max-width:1050px;padding:44px 54px 60px;margin:auto}}
nav{{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid {muted}44;padding-bottom:22px}}
nav strong{{font-size:20px;letter-spacing:-.5px}}nav span,.eyebrow{{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{muted}}}
.hero{{padding:62px 0 42px}}h1{{font-family:Georgia,serif;font-weight:400;letter-spacing:-3px;font-size:clamp(40px,5vw,76px);line-height:1.08;margin:18px 0 24px}}
.intro{{color:{muted};max-width:490px;font-size:17px}}.rule{{width:64px;height:3px;background:{accent};margin-top:30px}}
.cards{{display:grid;grid-template-columns:1fr 1fr;gap:28px}}article{{border-top:1px solid {muted}55;padding-top:22px}}
article small{{font-size:10px;letter-spacing:1.5px;color:{accent}}}h2{{font:normal 25px Georgia,serif;margin:12px 0}}article p{{color:{muted};font-size:13px}}
footer{{margin-top:44px;font-size:10px;color:{muted};letter-spacing:1px}}
@media(max-width:650px){{main{{padding:30px}}.hero{{padding-top:45px}}.cards{{gap:18px}}nav span{{font-size:9px}}}}
</style><main><nav><strong>{title}</strong><span>Journal &nbsp; / &nbsp; Collection</span></nav>
<section class="hero"><div class="eyebrow">{'An independent workspace' if dark else 'A journal for the everyday'}</div>
<h1>{headline}</h1><p class="intro">{intro}</p><div class="rule"></div></section>
<section class="cards">{''.join(f'<article><small>{tag}</small><h2>{name}</h2><p>{body}</p></article>' for tag,name,body in cards)}</section>
<footer>FLOATING DOMAIN BAR &nbsp; / &nbsp; LOCAL DEMO PAGE</footer></main></html>'''.encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = demo(self.path.startswith('/night-studio'))
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', type=Path, default=Path(r'C:\Program Files\Zen Browser\zen.exe'))
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = root / 'docs' / 'media'
    output.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix='floating-domain-media-'))
    profile = scratch / 'profile'
    profile.mkdir()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    light_url = f'http://notes.localhost:{server.server_port}/field-notes'
    dark_url = f'http://studio.localhost:{server.server_port}/night-studio'
    prefs = {'marionette.port': port, 'browser.shell.checkDefaultBrowser': False,
             'browser.startup.page': 0, 'browser.startup.homepage': 'about:blank',
             'browser.aboutwelcome.enabled': False, 'zen.welcome-screen.seen': True,
             'toolkit.legacyUserProfileCustomizations.stylesheets': True,
             'zen.view.sidebar-expanded': True, 'zen.view.use-single-toolbar': True,
             'network.dns.localDomains': 'notes.localhost,studio.localhost'}
    (profile / 'user.js').write_text('\n'.join(f'user_pref({json.dumps(k)}, {json.dumps(v)});' for k,v in prefs.items()))
    log = (scratch / 'zen.log').open('w')
    process = subprocess.Popen([str(args.binary), '-no-remote', '-profile', str(profile),
        '-headless', '-marionette', '--remote-allow-system-access', 'about:blank'],
        stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    client = Marionette('localhost', port=port)
    frames, durations = [], []

    def chrome(code, *values):
        client.set_context('chrome')
        return client.execute_script(code, script_args=list(values))

    def wait(code):
        until = time.monotonic()+15
        while time.monotonic()<until:
            if chrome(code): return
            time.sleep(.1)
        raise RuntimeError(f'Timed out: {code}')

    def capture(name=None, duration=1800):
        client.set_context('chrome')
        raw = client.screenshot(format='binary')
        if name:
            (output / f'{name}.png').write_bytes(raw)
            print(f'Captured {name}', flush=True)
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        im.thumbnail((1080, 675), Image.Resampling.LANCZOS)
        frames.append(im)
        durations.append(duration)

    try:
        client.raise_for_port(timeout=30)
        client.start_session()
        assert Path(client.session_capabilities['moz:profile']).resolve() == profile.resolve()
        client.set_window_rect(width=1440, height=900)
        wait('return !!window.gBrowser && !!window.gZenViewSplitter;')
        chrome('window.windowUtils.loadSheet(Services.io.newURI(arguments[0]), window.windowUtils.USER_SHEET);', (root/'userChrome.css').as_uri())
        chrome((root/'floating-domain-bar.uc.js').read_text(encoding='utf-8'))
        wait('return !!window.__floatingDomainBarState;')
        client.set_context('content')
        client.navigate(light_url)
        wait("return document.documentElement.getAttribute('floating-domain-page-tone')==='light';")
        time.sleep(1)
        capture('light', 2200)
        chrome("document.getElementById('floating-domain-bar-domain').click();")
        wait('return document.activeElement===gURLBar.inputField;')
        time.sleep(.4)
        capture('address-editing', 1600)
        client.find_element('css selector', '#urlbar-input').send_keys(Keys.ESCAPE)
        time.sleep(.3)
        capture(duration=700)
        chrome("window.mediaTabs=[gBrowser.selectedTab,gBrowser.addTab(arguments[0],{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()})];gBrowser.selectedTab=window.mediaTabs[1];", dark_url)
        wait("return document.documentElement.getAttribute('floating-domain-page-tone')==='dark';")
        time.sleep(1)
        capture('dark', 2200)
        chrome("gZenViewSplitter.splitTabs(window.mediaTabs,'vsep');")
        wait("return document.querySelectorAll('.floating-domain-split-bar').length===2 && [...document.querySelectorAll('.floating-domain-split-bar')].map(e=>e.dataset.pageTone).sort().join()==='dark,light';")
        time.sleep(1)
        capture('split-view', 2800)
        chrome("document.querySelectorAll('.floating-domain-split-input')[0].click();")
        wait('return document.activeElement===gURLBar.inputField;')
        time.sleep(.4)
        capture(duration=1600)
        client.find_element('css selector', '#urlbar-input').send_keys(Keys.ESCAPE)
        time.sleep(.3)
        capture(duration=1000)
        frames[0].save(output/'demo.gif', save_all=True, append_images=frames[1:],
            duration=durations, loop=0, optimize=True, disposal=2)
        for name, start, end in [('address-editing', 0, 3), ('split-view', 4, 7)]:
            frames[start].save(output/f'{name}.gif', save_all=True,
                append_images=frames[start+1:end], duration=durations[start:end],
                loop=0, optimize=True, disposal=2)
        (output/'capture.json').write_text(json.dumps({'zen':client.session_capabilities['browserVersion'],
            'mod':json.loads((root/'theme.json').read_text())['version'],
            'viewport':[1440,900], 'gif':'Actual captured states; edited timing, not real-time recording.',
            'pages':'Local demo fixtures from tools/capture-media.py; browser chrome is unmodified beyond the mod.'},indent=2))
    finally:
        try:
            chrome('window.setTimeout(()=>Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit),100);')
            client.delete_session(send_request=False)
        except Exception:
            process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill()
        log.close()
        server.shutdown()
    print(f'Media: {output}')


if __name__ == '__main__':
    main()
