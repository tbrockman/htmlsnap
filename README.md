# snaphtml

A browser DevTools extension for snapshotting inspected HTML elements (and their CSS) as pastable snippets.

> [!NOTE]
> This is alpha, (somewhat) vibe-coded software. Use at your own risk.
>

## Getting started

Install dependencies and build the extension:
```sh
pnpm i && pnpm build
```

Then, in your browser of choice, load the unpacked extension in `dist/`.

## Limitations

- JavaScript associated with elements are not captured (and likely will never be).
- `<canvas>` content is not (currently) captured.
- CSS animations are not captured.
- CSS pseudo-classes (e.g. `:hover`) are not captured.
- Images aren't inlined as data URIs (without an option to do so).
- Default browser styles are not filtered from output (more portable, but likely redundant).