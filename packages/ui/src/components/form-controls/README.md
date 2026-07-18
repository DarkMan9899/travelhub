# form-controls

**Sprint 2 status:** `Label`, `Input`, `Textarea`, `Checkbox`, `Radio`,
`Switch`, `Select` implemented. `DatePicker`, `TimePicker`, `SearchBar`
(COMPONENT_LIBRARY.md Part II Section 2) remain scaffolded, not
implemented — out of this sprint's scope.

`Label` is not a separate COMPONENT_LIBRARY.md catalog entry — it is the
one shared implementation of the "label always visible, associated via
htmlFor/id" requirement every other control in this group specifies. See
`Label/Label.jsx`'s file header for the full rationale.

Each component, when implemented, follows the full specification in
`COMPONENT_LIBRARY.md` (Purpose, Props, States, Variants, Accessibility,
Animation, Responsive Behaviour, Dependencies, Where it is used) exactly
— one file per component, colocated with its `.module.scss`
(`FRONTEND_ARCHITECTURE.md` Section 9.1) and its own tests
(`FRONTEND_ARCHITECTURE.md` Section 35). Every control here is
controlled by default (`value`/`checked` + `onChange` required —
FRONTEND_ARCHITECTURE.md §8.2).

## Usage

```jsx
import { Input, Textarea, Checkbox, Radio, Switch, Select } from '@travelhub/ui/components/form-controls';

<Input
  label="Email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
/>

<Textarea
  label="Message"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  autoResize
/>

<Checkbox
  label="I agree to the terms"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>

<Radio name="room" value="deluxe" label="Deluxe room" checked={room === 'deluxe'} onChange={() => setRoom('deluxe')} />

<Switch label="Email notifications" checked={emailsOn} onChange={(e) => setEmailsOn(e.target.checked)} />

<Select
  label="Country"
  options={[{ value: 'am', label: 'Armenia' }, { value: 'ge', label: 'Georgia' }]}
  value={country}
  onChange={setCountry}
/>
```

`Select`'s `searchable` filter auto-enables once `options.length` exceeds
8, per `COMPONENT_LIBRARY.md`'s Select entry. `multiple` renders selected
values as removable chips inside the trigger and keeps the panel open
across selections.
