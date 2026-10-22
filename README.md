# Flattersatz for InDesign

Flattersatz gives justified text an uneven right edge. It places small, invisible shapes beside the text. These shapes make alternate lines shorter. It does not change the words or paragraph styles.

This project is an InDesign script. You run it from the Scripts panel. It is not a panel plug-in.

![The original Flattersatz example](indesign/flattersatz/screenshot.png)

## InDesign version

The current target is **InDesign 2026, version 21.6**. This is the latest stable version listed in the [Adobe release notes](https://helpx.adobe.com/indesign/desktop/whats-new/release-notes.html) on 22 October 2026. The script uses ExtendScript, which InDesign still supports.

The local code tests pass. **The new script has not yet been tested inside InDesign 21.6.** InDesign is not installed in the development workspace. Use a copy of your document for the first test. See the [InDesign test guide](docs/TESTING.md).

## Install

1. Download or copy [dist/flattersatz.jsx](dist/flattersatz.jsx).
2. In InDesign, open **Window > Utilities > Scripts**.
3. Right-click **User** and choose **Reveal in Finder** on macOS or **Reveal in Explorer** on Windows.
4. Put `flattersatz.jsx` in the **Scripts Panel** folder.
5. Find the script in the Scripts panel. Double-click it to run it.

Only this one file is needed. You do not need Node.js, Underscore or a plug-in manager to use it.

## Use

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

## Work on the code

Use Node.js 22 or later. There are no package dependencies to install.

```sh
npm test # Run the local tests.
npm run build # Make the single script file.
npm run check # Run tests and check that the built file is current.
```

- `indesign/flattersatz/core.js` calculates shape positions.
- `indesign/flattersatz/host.js` reads and changes InDesign objects.
- `indesign/flattersatz/ui.js` shows the settings window.
- `indesign/flattersatz/flattersatz.js` starts the script.
- `tests/` holds local tests and a separate InDesign test script.
- `dist/flattersatz.jsx` is the built file to install. Do not edit it by hand.

Each changed code line has a short English comment. Keep these comments simple and do not put semicolons in them. JSON files cannot contain comments.

Run [tests/indesign-smoke.jsx](tests/indesign-smoke.jsx) from InDesign to check the real text layout and undo behavior. Keep it in the repository folder so its includes work. It creates and closes its own test document without saving. The Node tests use a small fake InDesign model and cannot replace this test.

See [AGENTS.md](AGENTS.md) for contributor rules. The detailed [audit](docs/AUDIT.md) and [test guide](docs/TESTING.md) are in Italian.
