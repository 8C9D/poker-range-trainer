# Manual Testing Checklist

## Baseline

- [ ] App starts with npm run dev.
- [ ] App builds with npm run build.
- [ ] Lint passes with npm run lint.
- [ ] Tests pass with npm run test:run.

## v1 range editor

- [ ] Standard 13x13 grid is visible.
- [ ] Clicking a hand toggles it selected/unselected.
- [ ] User can enter a range name.
- [ ] Range summary updates live (hands selected, combos, % of all hands).
- [ ] Save button is disabled until a name and at least one hand are present, with a hint explaining why.
- [ ] User can save a range.
- [ ] Saved range appears in the range library.
- [ ] Range library shows per-range stats (hands, combos, percentage).
- [ ] New Range button clears the editor to compose a fresh range.
- [ ] User can reopen/edit a saved range (Load).
- [ ] Loaded range is highlighted as active in the library.
- [ ] While editing, an indicator names the range and the button reads "Save Changes".
- [ ] Saving an edited range updates it in place (no duplicate is created).
- [ ] User can delete a saved range.

## v1.1 faster hand selection

- [ ] Clicking a single hand still toggles it selected/unselected.
- [ ] Pressing on an unselected hand and dragging across others selects every hand crossed.
- [ ] Pressing on a selected hand and dragging across others deselects every hand crossed.
- [ ] Re-entering a hand during one drag does not flip it back and forth.
- [ ] Releasing the mouse button (even off the grid) ends the drag; moving over hands afterward does not change the selection.
- [ ] Dragging does not select the hand labels as text.
- [ ] Keyboard: focus a hand with Tab and press Enter or Space to toggle it.
- [ ] Clear Selection empties the grid.
- [ ] Clear Selection keeps the range name.
- [ ] Clear Selection is disabled when no hands are selected.
- [ ] While editing a saved range, Clear Selection keeps the editing indicator and "Save Changes" label, and saving an empty selection stays blocked.

## v1.1 range shortcuts

- [ ] A "Range shortcuts" section appears near the editor controls with buttons: Add all pairs, Add 77+, Add suited broadways, Add offsuit broadways, Add all broadways.
- [ ] Add all pairs selects all 13 pocket pairs and the summary updates immediately.
- [ ] Add 77+ selects 77 through AA and leaves 66 unselected.
- [ ] Add suited broadways selects the suited Broadway hands (AKs … JTs).
- [ ] Add offsuit broadways selects the offsuit Broadway hands (AKo … JTo).
- [ ] Add all broadways selects TT+ pairs plus the suited and offsuit Broadway non-pairs.
- [ ] Shortcuts add to the current selection; hands selected by click or drag stay selected.
- [ ] Applying the same shortcut twice does not change the hand or combo counts.
- [ ] Applying a shortcut while editing a saved range keeps the editing indicator and the "Save Changes" label.
- [ ] After applying a shortcut to a saved range, "Save Changes" updates it in place (no duplicate appears).
- [ ] Clear Selection empties hands added by a shortcut.

## v1.2 range notation import/export

- [ ] A "Range notation" section appears near the editor controls with an input, an Apply Notation button, and a read-only "Current range" field.
- [ ] The section shows example notation (e.g. `77+, AJs+, KQo`, `22+, A2s+, ATo+, KQs`, and `A5s-A2s`).
- [ ] The "Current range" field is empty when no hands are selected.
- [ ] Clicking hands updates the "Current range" notation immediately.
- [ ] Drag-selecting hands updates the "Current range" notation immediately.
- [ ] Applying a range shortcut updates the "Current range" notation immediately.
- [ ] Loading a saved range updates the "Current range" notation immediately.
- [ ] Clear Selection empties the "Current range" notation.
- [ ] Applying an exact list (e.g. `AA, KK, AKs`) selects exactly those hands.
- [ ] Applying pair-plus notation (e.g. `77+`) selects 77 through AA and leaves 66 unselected.
- [ ] Applying suited-plus notation (e.g. `A2s+`) selects the expected suited hands.
- [ ] Applying offsuit-plus notation (e.g. `ATo+`) selects the expected offsuit hands.
- [ ] Applying a comma-separated list (e.g. `77+, AJs+, KQo`) selects the combined hands.
- [ ] Applying a suited dash range (e.g. `A5s-A2s`) selects A5s, A4s, A3s, A2s.
- [ ] Applying an offsuit dash range (e.g. `AJo-ATo`) selects AJo and ATo.
- [ ] Applying a pair dash range (e.g. `77-TT`) selects 77, 88, 99, TT.
- [ ] Dash endpoints work in either order (`A2s-A5s` matches `A5s-A2s`; `TT-77` matches `77-TT`).
- [ ] Dash notation works inside a comma-separated list (e.g. `77+, A5s-A2s, KQo`).
- [ ] Whitespace around the dash is ignored (e.g. `A5s - A2s`).
- [ ] Applying notation replaces the current selection rather than adding to it.
- [ ] Applying empty notation clears the current selection.
- [ ] Applying invalid notation (e.g. `AK`, mismatched-type `A5s-A5o`, or different-high-card `A5s-K5s`) shows a clear error message.
- [ ] Applying invalid notation does not change the current selection.
- [ ] A successful apply clears a previously shown error message.
- [ ] Applying notation while editing a saved range keeps the editing indicator and "Save Changes" label.
- [ ] After applying notation to a saved range, "Save Changes" updates it in place (no duplicate appears).
- [ ] Saving is still blocked when notation clears the selection to no hands.

## v1.3 scenario metadata

- [ ] A "Scenario details" section appears near the editor controls with a Position dropdown, an Action type dropdown, and a Notes textarea.
- [ ] Both dropdowns default to a blank option so metadata is optional.
- [ ] The Position dropdown lists UTG, HJ, CO, BTN, SB, BB.
- [ ] The Action type dropdown lists Open, Call, 3-bet, 4-bet, Defend, Jam, Call jam.
- [ ] Changing Position, Action type, or Notes does not change the selected hands.
- [ ] Changing Position, Action type, or Notes does not change the "Current range" notation.
- [ ] Saving a range with metadata persists the position, action type, and notes.
- [ ] Saving a range with no metadata still works.
- [ ] A saved range card shows its position and action type (e.g. `BTN · Open`) when present.
- [ ] A saved range card shows its notes when present, truncated to a short preview when long.
- [ ] A saved range card with no metadata shows no empty metadata labels.
- [ ] Loading a saved range restores its position, action type, and notes into the editor.
- [ ] Editing only the metadata of a saved range and choosing "Save Changes" updates it in place (no duplicate appears).
- [ ] New Range clears the position, action type, and notes along with the name and selection.
- [ ] Clear Selection empties the grid but keeps the position, action type, and notes.
- [ ] Applying range notation replaces the selection but keeps the position, action type, and notes.
- [ ] Applying a range shortcut adds hands but keeps the position, action type, and notes.

## v1 practice mode

- [ ] Each saved range shows a Practice button.
- [ ] Clicking Practice opens the practice view for that range and shows its name.
- [ ] App shows a random starting hand to identify.
- [ ] User can answer "in range."
- [ ] User can answer "out of range."
- [ ] App gives immediate correct/incorrect feedback and shows the expected answer.
- [ ] The same hand cannot be answered twice (answer buttons are replaced by feedback).
- [ ] Next hand advances to another random hand and re-enables answering.
- [ ] Total questions updates.
- [ ] Correct answers update.
- [ ] Accuracy percentage updates.
- [ ] End Practice returns to the editor/library view.
