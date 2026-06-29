---
name: JSX text unicode escapes
description: \uXXXX escapes only work in JS string literals, NOT in JSX text content
---

`\u201C`-style escape sequences are processed only inside **JS string literals**
(e.g. `text: "Choose \u201CAdd\u201D"`). In **JSX text content** (characters
between tags, like `<p>ALLUR (\u201CALLUR\u201D)</p>`) they are NOT decoded — they
render literally as the 6 characters `\u201C`.

**Why:** JSX text is not a JS string; escape processing never runs on it. This
shipped a bug in the ALLUR legal pages where curly quotes/em-dashes showed as raw
`\u201C` / `\u2014`.

**How to apply:** In JSX text, use the actual unicode character (“ ” — ’ →) or an
HTML entity (`&ldquo;` etc.), never `\uXXXX`. Reserve `\uXXXX` for JS string
literals (object fields, props passed as strings, ternary string values).
