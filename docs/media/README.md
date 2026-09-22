# Screenshots and demos

Real captures of Floating Domain Bar v0.20.4 in Zen 1.22.2b on Windows,
using an isolated headless profile and purpose-built local demo pages.
The `.localhost` addresses belong to those fixtures. No personal profile,
browsing history, or third-party website content is included.

| File | Use |
| --- | --- |
| [demo.gif](demo.gif) | Overview: light page, address editing, dark page, Split View |
| [address-editing.gif](address-editing.gif) | Short address editor loop |
| [split-view.gif](split-view.gif) | Independent panel colors and panel-specific editing |
| [light.png](light.png) | Light page screenshot |
| [dark.png](dark.png) | Dark page screenshot |
| [split-view.png](split-view.png) | Side-by-side light and dark panels |
| [address-editing.png](address-editing.png) | Native address editor with full URL selected |

PNGs are full 1440 × 900 browser captures. GIFs are 1080 × 675 sequences of
actual captured states with edited timing; they are not real-time recordings.
They demonstrate browser UI, not native Windows Snap or untested OS support.

To regenerate from the repository root:

```powershell
python -m pip install marionette_driver Pillow
python tools/capture-media.py --binary "C:\Program Files\Zen Browser\zen.exe"
```

The script serves its fixtures on a loopback-only HTTP server, launches a
temporary Zen profile, loads the repository CSS and JavaScript, captures the
media, and shuts down its browser and server. `capture.json` records versions.
