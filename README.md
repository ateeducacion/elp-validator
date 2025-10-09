# eXeLearning Package Validator

A client-side web application that inspects `.elp` (ZIP) packages exported from [eXeLearning](https://exelearning.net) and highlights common structural issues before publishing.

## Features

- Drag-and-drop interface for `.elp` or `.zip` archives.
- In-browser decompression using [JSZip](https://stuk.github.io/jszip/).
- Sequential checklist that validates:
  - Archive integrity and presence of `content.xml`.
  - Recommended resource directories (`content/`, `custom/`).
- XML well-formedness and root `<ode>` element.
- Navigation structure, page presence, and mandatory node fields.
- Referenced resources inside `htmlView` and `jsonProperties` blocks.
- A package details panel that surfaces title, author, language, license, and other metadata extracted from `content.xml`.
- No server required — all processing happens locally in the browser.

## Getting Started

1. Open `index.html` in a modern browser. No build step is required.
2. Drop an `.elp` file onto the drop zone or click it to choose a file.
3. Review the validation checklist to understand any warnings or errors.

## Development

Install dependencies and run the Jest test suite:

```bash
npm install
npm test
```

Tests focus on the reusable validation helpers that power the UI.

## Project Structure

```
index.html        # Application shell
styles.css        # Styling for the UI
js/validator.js   # Shared validation helpers (browser + Jest)
js/app.js         # UI glue code
tests/            # Jest unit tests
```

## License

MIT
