# Sine marketplace submission

The package supports repository installation. Listing it in Sine's marketplace
requires a separate review by the store maintainers.

## Publish and verify

1. Run the checks in README.md and perform live Zen validation.
2. Commit and push the package to the public repository's `main` branch.
3. Confirm the published [theme.json](https://github.com/Efeblk/floating-domain-bar/blob/main/theme.json)
   contains the intended version, `homepage`, `readme`, stylesheet and script.
4. Install from `https://github.com/Efeblk/floating-domain-bar` in a test Zen
   profile with Sine, allowing off-store JavaScript mods. Restart and verify
   the address bar, URL editing, Split View and uninstall behavior.
5. Check the [store issues](https://github.com/sineorg/store/issues?q=floating-domain-bar)
   and [pull requests](https://github.com/sineorg/store/pulls?q=floating-domain-bar)
   for an existing submission before opening another.

## Submit

Open the [prefilled Add Theme form](https://github.com/sineorg/store/issues/new?template=add-theme.yml&title=%5Badd-theme%5D%3A%20Floating%20Domain%20Bar&homepage=https%3A%2F%2Fgithub.com%2FEfeblk%2Ffloating-domain-bar).
Check the repository URL and submit it. The form uses:

- Title: `[add-theme]: Floating Domain Bar`
- Theme Homepage: `https://github.com/Efeblk/floating-domain-bar`

The store's automation creates a pull request for review. An automatically
closed submission issue does not itself mean the mod is listed; check the
linked pull request and marketplace entry. Do not advertise marketplace
installation until the entry is available.

## Package contract

- Keep `id` stable so existing installations retain their identity.
- Keep `homepage` pointing to the public source repository: the store's
  updater uses it to fetch metadata and package content.
- Ship the CSS and JavaScript paths registered in `theme.json` at the
  repository root. There is no build step.
- Restrict the mod to Zen with `fork: ["zen"]`; the script uses Zen internals.
- Bump `version`, `updatedAt`, and CHANGELOG.md together when publishing updates.
- Include only actual screenshots if adding a store preview; automated tests
  do not establish visual compatibility on untested platforms.

Requirements checked against the official
[submission form](https://github.com/sineorg/store/blob/main/.github/ISSUE_TEMPLATE/add-theme.yml),
[submission workflow](https://github.com/sineorg/store/blob/main/.github/workflows/add-theme.yml),
and [update workflow](https://github.com/sineorg/store/blob/main/.github/workflows/update-marketplace.yml)
on 2026-09-07.
