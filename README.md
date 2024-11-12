# eslint-plugin-svelte-translate-check

This eslint plugin will check translations in a Svelte project in the `src/lib/i18n/locales` directory. It will check two things: that each translation string is used in a Svelte file, and that each Svelte file translation usage has a translation string for each language.

To determine translation string usage it looks for `$translate(...)` calls.

It must be run in two passes. The first pass should use the `missing-translation` rule and can be done alongside other eslint rules. The next rule, `unused-translations`, should be run afterward. This second rule assumes the the first rule has already run and populated a `tmp` file with the full list of used translate calls.
