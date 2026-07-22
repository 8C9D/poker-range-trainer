import { useState } from 'react'
import { normalizeTags } from '../domain/rangeLibrary'
import './RangeTagEditor.css'

interface RangeTagEditorProps {
  /** Current tags (controlled; the parent owns the list). */
  tags: string[]
  /** Fired with the next tag list whenever a tag is added or removed. */
  onChange: (next: string[]) => void
}

/**
 * Controlled editor for a range's organization tags: a text input adds a tag
 * (Enter or the Add button) and each current tag renders as a chip with a remove
 * control. Adding runs the new list through {@link normalizeTags} so blanks and
 * case-insensitive duplicates never enter; the tag list is parent-owned.
 */
export function RangeTagEditor({ tags, onChange }: RangeTagEditorProps) {
  const [draft, setDraft] = useState('')

  function addTag() {
    const next = normalizeTags([...tags, draft])
    setDraft('')
    // Only report a change when the draft actually added a new tag.
    if (next.length !== tags.length) onChange(next)
  }

  function removeTag(tag: string) {
    onChange(tags.filter((existing) => existing !== tag))
  }

  return (
    <section className="range-tags" aria-label="Tags">
      <h3 className="range-tags-title">Tags</h3>
      {tags.length > 0 && (
        <ul className="range-tags-list">
          {tags.map((tag) => (
            <li key={tag} className="range-tag-chip">
              <span>{tag}</span>
              <button
                type="button"
                className="range-tag-remove"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="range-tags-add">
        <input
          type="text"
          className="coach-input"
          placeholder="Add a tag"
          aria-label="Add a tag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTag()
            }
          }}
        />
        <button
          type="button"
          className="coach-btn"
          onClick={addTag}
          disabled={draft.trim() === ''}
        >
          Add
        </button>
      </div>
    </section>
  )
}
