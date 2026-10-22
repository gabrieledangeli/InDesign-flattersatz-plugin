# Flattersatz for InDesign

Flattersatz gives justified text an uneven right edge. It places small, invisible shapes beside the text. These shapes make alternate lines shorter. It does not change the words or paragraph styles.

This repository contains two InDesign scripts. You run them from the Scripts panel. They are not panel plug-ins.

An experimental second script, **Flattersatz Preview**, compares that method with a ragged-right version that uses text formatting instead of wrap shapes. It creates a separate comparison document and leaves the source frame unchanged. See [the preview guide](docs/TYPOGRAPHIC-PREVIEW.md).

![The original Flattersatz example](indesign/flattersatz/screenshot.png)

## InDesign version

The current target is **InDesign 2026, version 21.6**. This is the latest stable version listed in the [Adobe release notes](https://helpx.adobe.com/indesign/desktop/whats-new/release-notes.html) on 22 October 2026. The script uses ExtendScript, which InDesign still supports.

The local code tests pass. **Neither script has yet been tested inside InDesign 21.6.** InDesign is not installed in the development workspace. Use a copy of your document for the first test. See the [InDesign test guide](docs/TESTING.md).

## Try the typography preview

Install [dist/flattersatz-preview.jsx](dist/flattersatz-preview.jsx) using the Scripts panel steps below. Select one simple text frame and run it. The new document compares four versions: the source frame, normal left alignment, an optimized version using **No Break**, and the historical wrap method when the source is justified.

The optimized version keeps the words and uses formatting to keep chosen word groups together. It does not add wrap shapes or forced line breaks. This is a bounded experiment, not a new InDesign composer or a live preview. InDesign must accept the computed line endings before the script reports success. It may reject a sample it cannot reproduce safely.

The first version uses whole words and turns off hyphenation in both left-aligned copies. Use at most 80 word groups per paragraph. **Ragged zone** sets a preferred range for line lengths. It is a guide for the planner, not an exact cut at the right edge.

Close the comparison document without saving to discard the preview. There is no command to apply it to the source in this version. Re-run the script from the source after editing its text or layout.

## Install

1. Download [flattersatz.jsx](dist/flattersatz.jsx) for the historical wrap method, or [flattersatz-preview.jsx](dist/flattersatz-preview.jsx) for the typography preview. You can install both.
2. In InDesign, open **Window > Utilities > Scripts**.
3. Right-click **User** and choose **Reveal in Finder** on macOS or **Reveal in Explorer** on Windows.
4. Put the chosen `.jsx` file or files in the **Scripts Panel** folder.
5. Find the script in the Scripts panel. Double-click it to run it.

Each `.jsx` file is complete and runs on its own. You do not need Node.js or a plug-in manager to use the scripts.

## Use the historical wrap script

1. Open a document. Select one or more text frames with the Selection tool.
2. Use justified text with the last line aligned left, or fully justified text.
3. Run the script.
4. Set **Ragged zone** and **Randomness**, then choose **Apply**.

**Ragged zone** sets how much shorter alternate lines should be. The default is 15%. **Randomness** adds variation. The default is 0%. Both values range from 0 to 100. The script keeps some space for text, even at high values. It stops and restores the old effect if the text no longer fits.

The same frames and settings give the same pattern. Running the script again replaces the old effect. It does not add a second set of shapes.

To remove the effect, select the frames and choose **Remove effect**. Applying a zone of 0 also removes it. Use **Edit > Undo** to undo a whole run in one step.

The shapes do not move with the text. Run the script again after you move or resize a frame, or change its text or font. Keep the Flattersatz layer visible. Hiding it does not remove the effect. Use **Remove effect** instead.

## Supported frames

Use plain rectangular frames with one column, top alignment and left-to-right text. Frames must be on a document page, visible and unlocked. Fonts must be available. Text must fit in the frame.

The script stops with a message for cases it cannot handle safely. These include linked frames, rotated or scaled frames, groups, tables, notes, text on a path, vertical text, multiple columns, auto-size and overlapping text frames. Very tight line spacing and some paragraph indents are also not supported.

Old shapes made by the historical script have no owner labels. The new script leaves them alone. Check and remove those old shapes yourself if they exist.

## Example document

Open a copy of [flattersatz.idml](indesign/flattersatz/flattersatz.idml). The text frame is on page 3. This old file uses Helvetica Bold. Resolve any missing-font warning before testing.

The [old video demo](https://vimeo.com/31792674) shows the original idea. It does not show the current scripts or the typography preview.

## Work on the code

Use Node.js 22 or later. There are no package dependencies to install.

```sh
npm test # Run the local tests.
npm run build # Make both standalone script files.
npm run check # Run tests and check that both built files are current.
```

- `indesign/flattersatz/core.js` calculates shape positions.
- `indesign/flattersatz/host.js` reads and changes InDesign objects.
- `indesign/flattersatz/ui.js` shows the settings window.
- `indesign/flattersatz/flattersatz.js` starts the script.
- `tests/` holds local tests, two fake InDesign models and two native InDesign smoke scripts.
- `dist/flattersatz.jsx` is the built file to install. Do not edit it by hand.
- `dist/flattersatz-preview.jsx` is the separate experimental preview. Its source entry is `indesign/flattersatz/flattersatz-preview.js`.
- `rag-core.js` plans word groups, `preview.js` builds the comparison, and `preview-ui.js` shows the preview settings.

Each changed code line has a short English comment. Keep these comments simple and do not put semicolons in them. JSON files cannot contain comments.

Run [tests/indesign-smoke.jsx](tests/indesign-smoke.jsx) from InDesign to check the real text layout and undo behavior. Keep it in the repository folder so its includes work. It creates and closes its own test document without saving. The Node tests use a small fake InDesign model and cannot replace this test.

Run [tests/indesign-preview-smoke.jsx](tests/indesign-preview-smoke.jsx) separately to check the preview inside InDesign. It creates disposable source and comparison documents. It checks that the source stays unchanged and closes its own documents without saving.

See [AGENTS.md](AGENTS.md) for contributor rules. The detailed [audit](docs/AUDIT.md) and [test guide](docs/TESTING.md) are in Italian.
