# Floating Domain Bar

[English](README.md) · [Türkçe](README.tr.md)

A minimal address bar mod for **Zen Browser**, installed with **Sine**.
It reserves a real 52-pixel browser row above the page and shows the site's
base domain while idle. Click it, or press Ctrl+L (Cmd+L on macOS), to open
Zen's native URL editor with the full address selected.

```text
https://www.youtube.com/watch?v=abc  →  youtube.com
https://mail.google.com/            →  google.com
```

## Install with Sine

1. Install [Zen Browser](https://zen-browser.app/) and
   [Sine](https://github.com/CosmoCreeper/Sine#installation).
2. Open **Settings → Sine Mods**.
3. For repository installation, enable Sine's option allowing JavaScript mods
   from outside the marketplace. This mod requires both CSS and JavaScript.
4. Paste this into the custom repository installation field:

   ```text
   https://github.com/Efeblk/floating-domain-bar
   ```

5. Install the mod and restart Zen completely.

The repository is the installation source. A public Sine marketplace listing
is a separate submission and review step; see [the submission guide](docs/SINE_SUBMISSION.md).
This is a Sine package for Zen, not a Firefox extension or a CSS-only Zen theme.

## Features

- Base-domain labels without changing the actual URL.
- Native URL editing and browser navigation controls.
- Independent address bars and loading indicators in Split View.
- Page-edge color sampling with adaptive light/dark contrast.
- Responsive sizing for Zen's three layouts and Compact Mode.
- Reduced-motion support for loading animations.
- English interface labels, with Turkish labels for Turkish browser locales.

The mod reads page background colors and changes browser chrome only. It does
not change website layout, send network requests, or save browsing history.
Sine handles downloading and updating the mod separately.

## Compatibility

Supports Zen's **Only Sidebar**, **Sidebar and Top Toolbar**, and
**Collapsed Sidebar** layouts. It depends on Zen's internal browser UI.

Smoke-tested on Windows with Zen **1.22b / Gecko 155.0** in an isolated
headless profile, including light/dark colors and both Split View directions.
macOS, Linux, and native window dragging have not been validated in this pass.

Other mods that reposition the address bar or navigation controls may conflict.
If the UI does not update, reinstall the mod through Sine and restart Zen.
To remove it, disable or uninstall it in Sine Mods and restart Zen.

## Development

No build step or npm dependencies are required. Run with Node.js 22 or newer:

```sh
node --check floating-domain-bar.uc.js
node --test tests/*.test.cjs
```

The tests execute the real script and its page-color sampler using mock browser
objects. Package checks verify the manifest and files needed by Sine. GitHub
Actions runs these checks on pushes and pull requests.

For visual validation, test single tabs and Split View, light and dark pages,
all three Zen layouts, narrow windows, Compact Mode, native URL editing,
and disabling/re-enabling the mod after a restart.

An optional live browser smoke test requires Python and Mozilla's
`marionette_driver` package:

```sh
python -m pip install marionette_driver
python tests/zen-smoke.py --binary "C:\Program Files\Zen Browser\zen.exe"
```

It launches a separate headless Zen profile, exercises the actual CSS and
JavaScript, and saves screenshots and results in a temporary directory.
It does not use your normal Zen profile. The Node tests remain dependency-free.

## Files

- `theme.json`: Sine metadata, stylesheet, and script registration.
- `userChrome.css`: browser row and controls.
- `floating-domain-bar.uc.js`: domain labels, colors, loading, and Split View.
- `tests/`: dependency-free package and regression checks.

See [CHANGELOG.md](CHANGELOG.md) for release notes. Licensed under [MIT](LICENSE).
