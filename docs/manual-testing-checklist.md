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
- [ ] User can save a range.
- [ ] Saved range appears in the range library.
- [ ] User can reopen/edit a saved range.
- [ ] User can delete a saved range.

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
