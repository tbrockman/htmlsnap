# snaphtml

A browser DevTools extension for snapshotting inspected HTML elements (and their CSS) as pastable snippets.

> [!NOTE]
> This is alpha, (largely) vibe-coded software. Use at your own peril.
>

## Getting started

Install dependencies and build the extension:
```sh
pnpm i && pnpm build
```

Then, in your browser of choice, load the unpacked extension in `dist/`.

## Limitations

- Related JavaScript is not captured (and likely will never be).
- `<canvas>` content is not (currently) captured.
- Pseudo-elements (e.g., `::before`, `::after`) are not (currently) captured.
- CSS animations and transitions are not (currently) captured.
- Default browser styles are not filtered out (unnecessarily increasing the size of the output).