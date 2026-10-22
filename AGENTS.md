# Repository Guidelines

## Project Structure & Module Organization

Flattersatz is an Adobe InDesign ExtendScript. It adds invisible text-wrap shapes to give justified text an uneven right edge.

- `indesign/flattersatz/flattersatz.js` starts the script. `core.js` holds pure geometry, `host.js` handles the InDesign DOM, and `ui.js` shows settings.
- `dist/flattersatz.jsx` is the standalone build. Commit it with source changes, but never edit it by hand.
- `tests/*.test.cjs` and `host-fixture.cjs` provide Node tests and a fake DOM. `tests/indesign-smoke.jsx` runs inside InDesign.
- `flattersatz.idml` and `screenshot.png` in the script folder are historical sample assets.
- `indesign/_common/helpers.js` contains legacy utilities. `_libs/underscore-1.4.4.js` is retained history and is not loaded by Flattersatz.
- `docs/AUDIT.md` records the analysis. `docs/TESTING.md` defines native checks.

## Build, Test, and Development Commands

Use Node.js 22 or later. No package installation is needed.

- `npm test` runs local regression tests.
- `npm run build` creates the standalone JSX file.
- `npm run check` runs tests and checks that the build matches its sources.
- `git diff --check` finds whitespace errors.

Run the built script through InDesign's Scripts panel. Node cannot run the Adobe DOM or ScriptUI. Keep relative includes intact when running source or native test files.

## Coding Style & Naming Conventions

Use tabs, double quotes, semicolons, same-line braces and `snake_case` custom names. Runtime code must use ES3 syntax, `var` and ordinary functions. Modern JavaScript is allowed in Node tools and tests.

Add a short, simple English comment to every new or changed code line. Comments must not contain semicolons. Keep JSON valid without comments. Preserve the script directives and owner labels.

## Testing Guidelines

Use Node's built-in test runner and name files `*.test.cjs`. Test observable behavior, including failed updates and preference restoration. There is no coverage threshold. Fake DOM tests do not prove native compatibility.

Run `tests/indesign-smoke.jsx` and the documented manual matrix in the target InDesign version before claiming native support. Record any untested cases.

## Commit & Pull Request Guidelines

Use short, lowercase commit descriptions, as in the existing history. Keep commits focused. Describe behavior changes, link relevant issues, report automated and native test results separately, and include before/after screenshots for visible changes.
