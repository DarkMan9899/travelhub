# listing-media

**Sprint 1 status:** folder scaffolded, empty. No components implemented.

**Phase 5 status:** `FileDropzone` implemented — built for
`PartnerListingWizard`'s Media/Gallery step. Listing Card (all module
variants), Gallery, Map/MapPreview (COMPONENT_LIBRARY.md Part II Section 6) remain scaffolded, not implemented — out of this phase's scope.

Each component, when implemented, follows the full specification in
`COMPONENT_LIBRARY.md` (Purpose, Props, States, Variants, Accessibility,
Animation, Responsive Behaviour, Dependencies, Where it is used) exactly
— one file per component, colocated with its `.module.scss`
(`FRONTEND_ARCHITECTURE.md` Section 9.1) and its own tests
(`FRONTEND_ARCHITECTURE.md` Section 35).

## FileDropzone

Not a `COMPONENT_LIBRARY.md` catalog entry under this group's three
named components — it's the drag-and-drop file input this folder was
scaffolded for. Scope is deliberately narrow: turn a drag/drop or
click-to-browse gesture into validated `File` objects. Upload transport,
per-file progress, thumbnail preview, reordering, and cover-image
selection are the composing wizard step's job, not this component's —
it only ever sees newly-added files, never an existing media list.

```jsx
import { FileDropzone } from '@travelhub/ui/components/listing-media';

<FileDropzone
  label="Photos"
  accept="image/*"
  maxSizeBytes={5 * 1024 * 1024}
  maxFiles={20}
  currentCount={existingMedia.length}
  onFilesSelected={(files) => uploadEach(files)}
  onRejected={(rejections) => showRejectionToast(rejections)}
/>;
```

Each rejected file arrives as `{ file, reason }` with `reason` one of
`'TYPE' | 'SIZE' | 'MAX_FILES'`, letting the consumer render a specific
message per failure rather than one generic error.
