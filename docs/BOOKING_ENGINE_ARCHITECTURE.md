# BOOKING ENGINE ARCHITECTURE

**Travel Hub Armenia — Core Platform Document**
**Status:** Final · **Version:** 1.0 · **Classification:** Confidential
**Owner:** Chief Software Architect
**Depends on (must never be contradicted):** `PROJECT_BIBLE.md` · `UI_UX_GUIDELINES.md` · `DATABASE_ARCHITECTURE.md`

---

> "There is exactly one Booking Engine. A hotel room, a rental car, a restaurant table,
> a spa slot, a tour seat, an event ticket, a campsite, and a swimming-pool session are
> not eight different problems. They are one problem — *reserve a finite, time-bound
> resource, exactly once, under contention* — wearing eight different costumes."

This document is the authoritative architecture for the Travel Hub Armenia Booking
Engine: the subsystem responsible for search-to-availability, holds, payment,
confirmation, check-in/out, cancellation, refunds, and the calendar, pricing, and
notification logic that surround them. It builds directly on the schema defined in
`DATABASE_ARCHITECTURE.md` (`listings`, `bookable_units`, `availability_calendar`,
`reservation_holds`, `bookings`, `booking_items`, `payments`) and does not introduce
any table, column, or naming pattern that conflicts with it. Anywhere this document
adds detail beyond the database document (for example, time-slot granularity, or the
Redis-based locking layer), it does so as an **extension**, never a replacement.

No source code, pseudocode, or SQL appears in this document. Every algorithm is
described in prose precise enough for any engineering team to implement it
identically, regardless of language or framework.

---

## Table of Contents

1. Booking Engine Philosophy
2. Booking Lifecycle
3. Booking Status Flow
4. Availability Engine
5. Reservation Hold
6. Calendar Engine
7. Pricing Engine
8. Payment Flow
9. Cancellation Engine
10. Notification Flow
11. Booking Validation
12. Check-In Engine
13. Check-Out Engine
14. Analytics
15. Security
16. Scalability
Appendix A — Module Mapping Reference
Appendix B — Glossary

---

## 1. Booking Engine Philosophy

### 1.1 One Engine, Not Eight

Every module the platform supports — Hotels, Vacation Houses, Apartments, Restaurant
Reservations, SPA, Tours, Events, Car Rentals, Camping, Swimming Pools, and every
module not yet invented — reduces to the same abstract transaction:

> A **customer** wants to hold exclusive or shared claim on a **bookable unit**, for a
> **time window**, at an agreed **price**, backed by a **payment**, with a documented
> path to **fulfillment** (check-in/use) and **closure** (check-out/completion or
> cancellation).

The Booking Engine is built once against this abstraction and never against a
specific module. A hotel room and a swimming-pool session both flow through the same
availability check, the same hold table, the same status machine, the same payment
flow, and the same cancellation engine. The only things that differ per module are
**parameters**, never **logic**:

| Dimension | Varies by module | Engine logic itself |
|---|---|---|
| Time granularity (night / hour / minute) | Yes | No — one time-window model handles all three |
| Exclusive vs. shared capacity | Yes | No — one capacity model handles both |
| Whether check-in exists | Yes | No — check-in is always an optional stage in one lifecycle |
| Cancellation policy terms | Yes | No — one cancellation engine, pluggable policies |
| Price components (nightly vs. per-head vs. per-hour) | Yes | No — one pricing engine, pluggable rate strategy |

This is why `DATABASE_ARCHITECTURE.md` introduced `bookable_units` as a single table
instead of one table per module: the Booking Engine is the reason that decision
exists. If the Booking Engine ever needs "one more `if` statement per module," the
abstraction has failed and must be fixed at the model level — not patched at the
logic level.

### 1.2 Design Principles

1. **Single source of truth for availability.** At any instant, exactly one system
   (the Availability Engine, Section 4) can answer "is this unit free right now,"
   and every other subsystem — search, cart, partner calendar, iCal export — reads
   from it. No subsystem is allowed to maintain its own shadow copy of truth.
2. **Reserve first, charge second, confirm third.** A booking never skips the hold
   stage. Money never moves before inventory is provisionally locked; inventory is
   never permanently committed before money has cleared. This ordering is what
   prevents both overbooking and unpaid confirmed bookings.
3. **Every state transition is atomic and auditable.** A booking status never
   changes as a side effect of an unrelated write. Every transition is a deliberate,
   named operation that also writes a `booking_status_history` row (per
   `DATABASE_ARCHITECTURE.md` §4.8) and, where privileged, an `audit_logs` row.
4. **Idempotency by default.** Every operation that can be retried (payment capture,
   webhook processing, notification dispatch) is written so that executing it twice
   produces the same end state as executing it once. Section 15 defines the
   idempotency-key contract used throughout.
5. **Optimistic UX, pessimistic data.** The customer-facing experience feels
   instant — availability appears live, holds appear immediate — but underneath,
   every write that touches shared inventory is protected by a distributed lock and
   a database transaction. Section 5 and Section 15 describe how both are true at
   once.
6. **Fail closed on inventory, fail open on convenience.** If the system cannot
   *prove* a unit is available, it treats the unit as unavailable. If the system
   cannot send a notification, the booking still proceeds — notification delivery
   is retried asynchronously and never blocks the booking transaction.
7. **The engine does not know what a "hotel" is.** The Availability, Hold, Pricing,
   Payment, and Cancellation engines operate purely on `bookable_units`,
   `availability_calendar` (extended, see §4), and `booking_items`. Module identity
   (`listing_type`) is only ever read by the presentation layer and by the small
   set of module-specific extension attributes described in Appendix A.

### 1.3 Relationship to Existing Documents

- `PROJECT_BIBLE.md` defines *what* modules exist and the business model; this
  document defines *how* any booking, in any module, is executed safely.
- `UI_UX_GUIDELINES.md` defines the calendar, search, badge, and notification
  **presentation** patterns (dual-month range picker, status-colored badges,
  toast/notification-center behavior). This document defines the **data and
  state machine** those UI components render — the badge color vocabulary in
  Section 3 maps one-to-one onto the Success/Warning/Danger tokens already
  defined in `UI_UX_GUIDELINES.md` §3.1.
- `DATABASE_ARCHITECTURE.md` defines the schema. This document is the behavioral
  specification that runs on top of that schema. Every table named in this
  document already exists in `DATABASE_ARCHITECTURE.md` unless explicitly marked
  as a **new supporting table** introduced by this document (e.g., the Redis lock
  keyspace in Section 5, which is infrastructure, not schema).

---

## 2. Booking Lifecycle

### 2.1 The Eight Stages

Every booking, regardless of module, passes through some or all of eight stages.
Not every module uses every stage (a restaurant reservation has no meaningful
"check-out" charge stage; a digital event ticket has no physical "check-in"
device) — but the *sequence* never changes, and stages are never skipped in the
sense that they are always either **completed** or **explicitly marked not
applicable** for that module, never silently absent.

```
 SEARCH  →  AVAILABILITY  →  RESERVATION HOLD  →  PAYMENT  →  CONFIRMATION
                                                                    │
                                                                    ▼
                                    REVIEW  ←  CHECK OUT  ←  CHECK IN
```

**1. Search.** The customer expresses intent: a destination or listing, a date or
date range (or a specific time slot for hourly modules), and a party size. Search
does not touch the Availability Engine's authoritative tables directly — for
performance and scale, search reads from a denormalized, search-optimized index
(Section 16.3) that is kept eventually consistent with `availability_calendar`
via change-data-capture. This means search results can, in rare high-contention
moments, show a unit as available that is claimed a second later — this is
expected and is exactly why the next stage exists.

**2. Availability.** The moment the customer selects a specific unit and date/time,
the system performs a **real-time, authoritative** availability check directly
against `availability_calendar` (and, where relevant, `reservation_holds`) —
bypassing the search index entirely. This is the first point at which the
answer is guaranteed correct at the instant it is given. Section 4 details the
algorithm.

**3. Reservation Hold.** A confirmed-available unit is not yet paid for, so it
must be protected from being claimed by a second customer while the first
completes checkout. A `reservation_holds` row is created with a 15-minute
expiry (Section 5). This is the stage that makes stages 4 and 5 safe to
separate in time.

**4. Payment.** The customer provides payment. The Payment Flow (Section 8) may
involve authorization only, authorization + capture, or wallet debit, depending
on the cancellation policy and partner settings. Payment always executes while
the hold from stage 3 is still valid; if the hold expires mid-payment, the
transaction is aborted and any authorization is voided.

**5. Confirmation.** On successful payment, the hold is converted — in one
atomic transaction — into a confirmed `booking_items` row, the corresponding
`availability_calendar` rows flip from `held` to `booked`, and the booking's
status moves to `Confirmed`. Confirmation notifications fire (Section 10).

**6. Check-In.** For modules where physical or virtual presence must be verified
(Hotels, Vacation Houses, Apartments, Camping, Tours, Events, SPA), the
Check-In Engine (Section 12) marks the booking as fulfilled-in-progress.
Modules without a meaningful check-in concept (a simple restaurant table
booking with no seating-confirmation workflow) skip directly from Confirmed to
Completed at the scheduled end time, and this is recorded as "check-in not
applicable for this module," not silently omitted.

**7. Check-Out.** Where check-in exists, check-out (Section 13) closes the usage
period, settles any additional charges (minibar, damage, late fees, extra
services), and finalizes the invoice.

**8. Review.** After the stay/experience/rental period ends (whether or not
check-in/out were used), the customer is invited to leave a review, which is
written to the `reviews` table (`DATABASE_ARCHITECTURE.md` §4.9) linked
polymorphically to the listing.

### 2.2 Stage Applicability by Module

| Module | Search unit | Hold granularity | Check-In | Check-Out |
|---|---|---|---|---|
| Hotels | Room type → specific room | Date range (nights) | Yes — front desk / app | Yes — folio settlement |
| Vacation Houses / Apartments | Whole property | Date range (nights) | Yes — self/host check-in | Yes — damage/deposit release |
| Camping | Campsite/pad | Date range (nights) | Yes — gate/reception | Yes — site inspection |
| Swimming Pools | Session capacity | Date + time slot | Yes — entry scan | Yes — exit (usually automatic) |
| Restaurant Reservations | Table | Date + time slot (short) | Optional — seating confirmation | No physical checkout; auto-completes |
| SPA | Service slot | Date + time slot | Yes — arrival confirmation | Yes — extra services settled |
| Tours | Departure seat | Date + time (single occurrence) | Yes — meeting-point roll call | No — completes at tour end |
| Events | Seat / general admission | Date + time (single occurrence) | Yes — ticket scan | No — completes at event end |
| Car Rentals | Vehicle | Date-time range (pickup→drop-off) | Yes — pickup inspection | Yes — drop-off inspection, damage/fuel charges |
| **Future modules** | Defined by module extension | Chosen from the four granularities in §4.2 | Declared applicable/not applicable at module-registration time | Declared applicable/not applicable at module-registration time |

Every future module is *required*, at the time it is added to the platform, to
declare which stages apply using exactly this table's vocabulary. This is a
one-time configuration decision, not new engine code.

---

## 3. Booking Status Flow

### 3.1 Status Vocabulary

A booking (the `bookings` row) and each of its line items (`booking_items`) carry
one status value at a time, drawn from a closed, ordered vocabulary. Per
`DATABASE_ARCHITECTURE.md` §1 ("no native ENUM"), this vocabulary is stored as
rows in a `booking_statuses` lookup table, not as a hardcoded column type — new
statuses can be proposed but never silently invented at the application layer.

| Status | Badge color (per `UI_UX_GUIDELINES.md`) | Meaning |
|---|---|---|
| **Draft** | Gray (neutral) | Cart-like state; customer is configuring a booking, nothing is held yet |
| **Pending** | Orange (Warning) | Hold is active; awaiting payment |
| **Reserved** | Orange (Warning) | Payment authorized but not yet captured (deposit/pay-later flows) |
| **Confirmed** | Green (Success) | Payment settled; inventory permanently committed |
| **Checked In** | Green (Success), filled variant | Customer has arrived / begun use |
| **Checked Out** | Gray (neutral), filled variant | Usage period closed; final charges pending settlement |
| **Completed** | Green (Success), muted | Fully closed; eligible for review |
| **Cancelled** | Red (Danger) | Terminated before or during use, by customer or partner |
| **Expired** | Gray (neutral) | Hold or pending payment lapsed without completion |
| **Refunded** | Blue (informational, not a core status color — rendered with a Royal Blue badge to distinguish a *financial outcome* from a *fulfillment outcome*) | Money returned, in full or part, after cancellation |
| **Chargeback** | Red (Danger), bordered | Customer's bank reversed the charge outside the platform's control |

### 3.2 The State Machine

```
 Draft ──────► Pending ──────► Reserved ──────► Confirmed ──────► Checked In ──────► Checked Out ──────► Completed
   │              │                │                 │                                                        
   │              │                │                 │                                                     Review
   │              ▼                ▼                 ▼                                                    (Section 2.1 stage 8)
   │           Expired          Expired           Cancelled
   │                                                  │
   └───────────────────► Cancelled                    ▼
                                                    Refunded
                                                       │
                                                       ▼
                                                  Chargeback (exceptional, can originate from Confirmed/Completed too)
```

### 3.3 Every Transition, Explained

**Draft → Pending.** Trigger: customer selects dates/units and proceeds to
checkout. Side effect: a `reservation_holds` row is created (Section 5); the
booking's `booking_items` rows are created with status `Pending`. A Draft that
is abandoned (browser closed, no hold created) is never persisted as a row at
all — Draft is a client-side/cart concept until the hold is requested, at which
point it becomes a real `Pending` row. This keeps the `bookings` table free of
noise from casual browsing.

**Pending → Reserved.** Trigger: payment method is authorized (card hold placed,
or a partner accepts a "pay at property" model requiring a valid card only).
This transition is *optional* — modules using immediate capture (most Tours,
Events, SPA) skip straight to Confirmed. It exists for modules where the
policy allows a delay between authorization and capture (e.g., a Flexible-rate
hotel booking authorized at booking time but captured closer to check-in).

**Pending → Expired.** Trigger: the 15-minute hold (Section 5) lapses before
payment authorization completes. Side effect: the `reservation_holds` row is
deleted, the `availability_calendar` rows revert from `held` to `available`,
and the `booking_items`/`bookings` rows move to `Expired` rather than being
deleted — they remain for analytics (abandonment rate, Section 14) and
customer support visibility, but are excluded from all inventory and revenue
counts via their status, not via `deleted_at`.

**Reserved → Confirmed.** Trigger: capture succeeds (Section 8). Side effect:
this is the **commitment transaction** — in one database transaction, the
`booking_items` and `bookings` rows move to Confirmed, the
`availability_calendar` rows move from `held` to `booked`, the
`reservation_holds` row is deleted, an invoice is generated, and confirmation
notifications are enqueued (Section 10). This is the single most
safety-critical transition in the entire engine (Section 15.3 details its
locking).

**Pending → Confirmed** (direct). Trigger: for immediate-capture modules, the
Pending → Reserved step is skipped and this transition happens directly on
successful capture. Functionally identical side effects to Reserved →
Confirmed.

**Reserved → Expired.** Trigger: an authorization is held (e.g., "pay later")
but the partner-defined capture window closes without capture succeeding
(e.g., card declines at the scheduled capture date). Side effect: same as
Pending → Expired, plus the authorization is voided with the payment gateway.

**Confirmed → Cancelled.** Trigger: customer-initiated or partner-initiated
cancellation before check-in. Governed entirely by the Cancellation Engine
(Section 9), which determines refund eligibility from the listing's
cancellation policy. Side effect: `availability_calendar` rows revert to
`available` (unless the policy or a blackout rule keeps them blocked, e.g. a
partner choosing to keep the date closed), and — if a refund is owed — a
transition to Refunded is enqueued.

**Confirmed → Checked In.** Trigger: Check-In Engine (Section 12) validates
presence (QR, PIN, manual front-desk action). Not a financial event; purely a
fulfillment-state change. Modules without check-in never enter this state —
they move directly from Confirmed to Completed at the scheduled end
time via a scheduled job (Section 16.2).

**Checked In → Checked Out.** Trigger: Check-Out Engine (Section 13) closes the
usage period, potentially adding extra-charge invoice items (Section 13.1)
before finalizing.

**Checked Out → Completed.** Trigger: all post-usage charges are settled (or a
grace period for disputing them elapses, e.g., 24–48 hours for damage
claims). Completed is a terminal, successful state and is the trigger for the
Review invitation (Section 2.1 stage 8, Section 10.1).

**Checked In / Confirmed → Cancelled** (late cancellation / no-show). Trigger:
customer cancels after check-in, or never checks in and the module's no-show
rule fires. Handled by the Cancellation Engine's "Late Cancellation" path
(Section 9.7), typically resulting in No Refund or Partial Refund rather than
a standard refund.

**Cancelled → Refunded.** Trigger: the Cancellation Engine determines a refund
amount greater than zero. Side effect: Payment Flow's Refund/Partial Refund
process executes (Section 8.5); once the gateway confirms, status moves to
Refunded. If the determined refund is exactly zero (No Refund or Strict
policy fully outside the refund window), the booking remains Cancelled and
never enters Refunded.

**Confirmed / Completed → Chargeback.** Trigger: an external event — the
customer disputes the charge with their card issuer, days or weeks after the
fact. This is the one transition the platform does not initiate and cannot
prevent; it is detected via a payment-gateway webhook (Section 8.7) and
handled as an exceptional path: inventory is **not** automatically
re-released (the stay/experience already happened or the date has already
passed in most chargeback cases), and the booking is flagged for Admin Panel
review with the disputed amount debited from the partner's next payout
(Section 8.8).

### 3.4 Terminal States

`Completed`, `Cancelled` (with no pending refund), `Refunded`, and `Chargeback`
are terminal — no further status transition is permitted from them by the
engine. Any correction after a terminal state (e.g., a post-completion goodwill
refund) is modeled as a **new**, linked financial transaction (a refund record
referencing the original payment) rather than as a status regression, keeping
the state machine acyclic and the audit trail honest.

---

## 4. Availability Engine

### 4.1 One Model, Two Axes

Every booking request the Availability Engine evaluates varies along exactly two
independent axes. Understanding this is what allows one engine to serve eleven
module types without per-module branching logic.

**Axis 1 — Time Granularity:** how finely the time window is divided.
**Axis 2 — Claim Model:** whether one booking excludes all others for that
window (exclusive), or many bookings share a numeric capacity (shared).

| | Exclusive claim | Shared claim |
|---|---|---|
| **Daily grain** | Hotel room, vacation house, apartment, campsite, car | Nothing typical (whole-unit exclusivity is the norm at daily grain) |
| **Hourly / minute grain** | Restaurant table, SPA treatment room, tour departure seat *(seat-assigned)* | Swimming pool session, general-admission event capacity, tour departure *(capacity-only)* |

Every module in Section 1.3's list maps onto one cell of this matrix
(Appendix A gives the full mapping). The Availability Engine implements four
underlying algorithms — one per axis-combination — and every module simply
selects which one applies to its `bookable_units`.

### 4.2 The Four Underlying Algorithms

**Algorithm 1 — Exclusive, Daily Grain ("Room/Vehicle Booking").**
Used by: Hotels, Vacation Houses, Apartments, Camping, Car Rentals.
For a requested date range `[check_in, check_out)` (checkout date exclusive,
matching standard hospitality convention so a departing guest's last night and
an arriving guest's first night never overlap), the engine reads every
`availability_calendar` row for the candidate `bookable_unit_id` where
`date` falls in that range. The unit is available if and only if **every**
row in that range has `status = available` and no unexpired
`reservation_holds` row exists overlapping the same unit and range. This is a
single indexed range read (`availability_calendar` is indexed on
`(bookable_unit_id, date)`, per `DATABASE_ARCHITECTURE.md` §6.2) — the
check is O(nights requested), not O(all inventory).

**Algorithm 2 — Exclusive, Time-Slot Grain ("Table/Room-Slot Booking").**
Used by: Restaurant Reservations, SPA (per-room services), Tours with
seat-assigned small-group departures.
This algorithm requires a finer grain than a whole calendar day, so the
Booking Engine extends `availability_calendar` with two nullable columns,
`slot_start_time` and `slot_end_time`, populated only for time-slot-grain
units (whole-day units leave them null). A unit is available for a requested
`[slot_start, slot_end)` if no existing `booked` or `held` row for that unit
overlaps the interval — evaluated with standard interval-overlap logic
(`existing.start < requested.end AND existing.end > requested.start`). A
buffer duration (e.g., 15 minutes turnover time for a restaurant table,
configurable per listing) is added to the end of every existing booking
before the overlap check, so back-to-back bookings never remove
housekeeping/turnover time.

**Algorithm 3 — Shared Capacity, Any Grain ("Pool/Event Capacity Booking").**
Used by: Swimming Pools, general-admission Events, capacity-only Tour
departures (no assigned seats).
Here, `bookable_units` represents not one physical thing but one **session**
(a pool's 10:00–12:00 slot, an event's single occurrence) carrying a
`capacity` value. `availability_calendar` for a shared-capacity unit stores
`quantity_available` — the remaining headcount — rather than a binary
`status`. A request for `party_size` people is available if
`quantity_available >= party_size`. Committing the booking **decrements**
`quantity_available` by `party_size` instead of flipping a status flag; a
cancellation **increments** it back. Because this is a numeric decrement
under concurrent access, it is the one algorithm that most depends on the
row-level locking described in Section 5.4 — two customers requesting the
last 3 spots of a 3-remaining pool session must never both succeed.

**Algorithm 4 — Seat-Assigned Capacity ("Reserved Seating Booking").**
Used by: Events with assigned seating, larger seat-mapped Tours.
A hybrid of Algorithms 1 and 3: each individual seat is its own
`bookable_unit` (exclusive, Algorithm-1-style claim), but the *listing*
additionally exposes an aggregate `quantity_available` for "any seat in this
price tier" searches, computed as a live count of unclaimed seat-units rather
than stored redundantly. This avoids a denormalized counter going out of
sync with the authoritative per-seat rows.

### 4.3 Mixed Booking

A "Mixed Booking" is not a fifth algorithm — it is a single `bookings` row
containing multiple `booking_items`, each independently evaluated by
whichever of the four algorithms its own `bookable_unit` uses. A customer
booking a hotel room (Algorithm 1) plus an airport transfer car rental
(Algorithm 1, different unit type) plus a spa treatment (Algorithm 2) in one
checkout is handled by running all three availability checks and all three
holds within **one database transaction** (Section 5.5): either every item
is confirmed together, or none are. This all-or-nothing guarantee is what
makes "Mixed Booking" safe — the customer is never left holding a confirmed
room with no transfer car.

### 4.4 Overbooking Buffer (Deliberate, Partner-Configurable)

Some modules — notably Hotels — legitimately want a small, deliberate
overbooking buffer (a standard revenue-management practice to offset expected
no-shows). This is modeled explicitly, never accidentally: a listing may set
an `overbooking_buffer` value (e.g., 2 additional units bookable beyond
physical inventory) that widens the effective capacity used by Algorithm 1 or
3's threshold check. This is a conscious, auditable partner setting — never a
bug, and never invisible; the Partner Dashboard surfaces the buffer and its
current utilization at all times.

### 4.5 Consistency Guarantee

The Availability Engine's real-time check (Section 2.1 stage 2) always reads
with row-locking semantics inside a transaction that will, if the customer
proceeds, also write the hold — closing the gap between "checked" and
"claimed" to zero. The eventually-consistent search index (Section 2.1 stage
1) is explicitly documented to the frontend team as **advisory only**; it is
what makes search fast, but it is never the system that grants a hold.

---

## 5. Reservation Hold

### 5.1 Why Holds Exist

Payment authorization takes seconds to minutes (3-D Secure challenges, bank
redirects, retries). Without a hold, the availability window between "customer
sees a free unit" and "customer's payment clears" is wide enough for a second
customer to book the same unit. The hold converts a probabilistic race into a
deterministic first-come-first-served queue.

### 5.2 The 15-Minute Hold

Every hold created (Section 2.1 stage 3) carries an `expires_at` timestamp set
to **15 minutes** from creation — a single, platform-wide constant, chosen to
be long enough to complete a card-plus-3DS payment flow comfortably, short
enough that abandoned checkouts don't meaningfully suppress conversion for
other customers. The 15-minute value lives in `system_settings`
(`DATABASE_ARCHITECTURE.md` §4.10) as a single tunable key, not hardcoded
per module, so it can be adjusted platform-wide (or, in a later iteration,
per module) without a deployment.

### 5.3 Automatic Expiration

Expiration is enforced by **two independent, redundant mechanisms**, so that
neither a missed cron tick nor a lost message ever leaves a stale hold
blocking real inventory:

1. **A recurring background job** (Section 16.2) scans `reservation_holds`
   every few seconds for rows where `expires_at < now()`, and for each,
   executes the release transaction described in §5.6.
2. **A lazy check at read time.** The Availability Engine's real-time check
   (Section 4.5) treats any hold whose `expires_at` has already passed as
   *not existing*, regardless of whether the background job has physically
   deleted the row yet. This means an expired-but-not-yet-cleaned-up hold can
   never block a new customer even in the seconds before the job runs.

### 5.4 Redis Lock

The background job and the real-time check both protect against the *data*
being stale, but a **distributed lock** additionally protects against two
requests racing to act on the *same unit at the same instant* — the classic
"two customers click Book within the same 5 milliseconds" scenario that a
database read-then-write, even inside a transaction, can still lose to
without an explicit lock (see Section 15.1 for the full race-condition
analysis).

Every attempt to create a hold, confirm a hold, or release a hold first
acquires a **Redis-based mutual-exclusion lock** keyed by the specific
resource being touched:

- For Algorithm 1 (exclusive/daily): lock key is the pair (`bookable_unit_id`,
  affected date range), realized as one lock per unit covering its full
  requested range.
- For Algorithm 2 (exclusive/time-slot): lock key is (`bookable_unit_id`,
  `slot_start_time`).
- For Algorithm 3 (shared capacity): lock key is simply `bookable_unit_id` —
  every request against that session's capacity serializes through one lock,
  which is correct because capacity decrements must never interleave.

The lock is acquired with a short lease (a few seconds — enough to complete
the check-and-write, not the whole 15-minute hold lifetime) and released
immediately after the transaction commits or aborts. If a lock cannot be
acquired within a brief timeout (contention from a genuine simultaneous
request), the second request fails fast with a "someone is currently booking
this, please retry" response rather than queueing indefinitely — this keeps
checkout latency predictable under load.

### 5.5 Conflict Detection

"Conflict detection" is the check performed *while holding the Redis lock*:
re-run the relevant availability algorithm (Section 4.2) one final time,
inside the database transaction, immediately before writing the hold. This
is deliberately redundant with the check the customer's UI already showed
seconds earlier — the UI's check was for **display**; this check is for
**commitment**, and only this second check is trusted. If conflict detection
finds the unit no longer available, the hold request is rejected with a
clear "no longer available" response and the customer is returned to
Availability (Section 2.1 stage 2) to pick another option.

### 5.6 Release Logic

Releasing a hold (whether via expiration, Section 5.3, or explicit
cancellation before payment) is one atomic transaction:

1. Acquire the Redis lock for the affected unit/range (Section 5.4).
2. Delete the `reservation_holds` row.
3. Revert the corresponding `availability_calendar` rows from `held` back to
   `available` (Algorithm 1/2) or increment `quantity_available` back
   (Algorithm 3).
4. Move the associated `booking_items`/`bookings` rows to `Expired` or
   `Cancelled` (Section 3.3) rather than deleting them.
5. Release the Redis lock.

Steps 2–4 are wrapped in a single database transaction so a crash between
them can never leave the calendar reverted but the booking row still showing
`Pending`, or vice versa.

### 5.7 Race Condition Protection — Worked Example

Two customers, A and B, both view the last available night of a vacation
house and both click "Reserve" within the same second.

1. Both requests reach the Booking Engine near-simultaneously.
2. Both attempt to acquire the Redis lock for (unit, that date). Redis
   guarantees only one succeeds first — say, A.
3. A's request proceeds: conflict detection re-confirms availability, writes
   the `reservation_holds` row, flips the `availability_calendar` row to
   `held`, commits, and releases the lock.
4. B's request, which was waiting on the lock, now acquires it. Its conflict
   detection re-reads the calendar and finds the row now `held` — B's request
   fails with "no longer available," even though B's *original* availability
   check (moments earlier, before A committed) had shown the unit free.
5. B is shown alternative dates/units; no double-booking occurred, and no
   customer was shown a false confirmation.

This is the canonical scenario every part of Sections 4–5 exists to prevent,
and it is revisited with its full technical guarantee in Section 15.1.

---

## 6. Calendar Engine

### 6.1 Three Calendar Views, One Data Source

The platform presents three calendar surfaces — Partner, Admin, and Customer —
and all three are read views over the same `availability_calendar` and
`bookings`/`booking_items` tables. None of the three ever maintains its own
copy of calendar truth; they differ only in scope and permission.

- **Partner Calendar.** Scoped to the partner's own listings. Read-write: a
  partner can manually block dates (writes to `blackout_dates`,
  `DATABASE_ARCHITECTURE.md` §4.6), adjust date-specific pricing (writes to
  `rate_plan_prices`), and see booking details for their own inventory only.
  This is the calendar surfaced in the Partner Dashboard
  (`UI_UX_GUIDELINES.md` §11.2).
- **Admin Calendar.** Read-write across every partner and listing, used for
  support intervention (moving a booking, resolving a double-booking
  incident) and platform-wide occupancy visibility (Section 14.2). Every
  write an admin makes through this view is captured in `audit_logs` with
  the admin's identity, per Section 15.7.
- **Customer Calendar.** Read-only, scoped to a single listing at a time —
  this is the date-range/date-and-time picker component defined visually in
  `UI_UX_GUIDELINES.md` §9.2 ("Calendar / Date Picker"). It renders
  `availability_calendar` status directly; it never shows partner-internal
  data (blackout reasons, other guests' identities).

### 6.2 Calendar Sync (Inbound and Outbound)

To prevent double-booking for partners who also list on other channels
(their own website, Airbnb, Booking.com), the Calendar Engine supports
bidirectional synchronization:

- **iCal Import.** A partner supplies an external calendar's iCal feed URL.
  The engine polls it on a scheduled interval (default: every 15 minutes,
  matching the hold duration so external blocks propagate before a
  same-window internal hold could be granted) and maps each imported busy
  period onto `blackout_dates` for the corresponding listing, tagged with
  its external source so partners can distinguish "blocked because of
  Airbnb" from "blocked because of a Travel Hub booking" in the UI.
- **iCal Export.** Every listing exposes a generated, per-listing iCal feed
  URL reflecting its current `availability_calendar` booked/blocked ranges,
  for partners to import into external tools.
- **Google Calendar Sync.** A partner (or a customer, for their own
  bookings) can connect a Google account; confirmed bookings are pushed as
  calendar events via the Google Calendar API, and — for partners who opt
  in — the partner's Google Calendar busy blocks flow back in as a second
  import source, using the same `blackout_dates` mechanism as iCal import.
- **Airbnb Sync.** Treated as a specific case of iCal import/export (Airbnb
  publishes and accepts standard iCal feeds); no bespoke protocol is
  required, keeping this integration low-maintenance.
- **Booking Sync.** Internally, every confirmed, cancelled, or modified
  Travel Hub booking is what drives the outbound iCal feed's content — this
  is not a separate sync process but a direct read of the same
  `availability_calendar`/`booking_items` tables already described.

Because external calendars are polled rather than pushed in real time, the
engine treats every imported block as advisory-fast-but-not-instant, exactly
like the search index in Section 4.5 — the authoritative, zero-latency check
at hold time (Section 5.5) is what actually prevents a double-booking, with
sync narrowing the window in which one could even be attempted.

### 6.3 Timezone Handling

Every date/time value the Booking Engine stores is persisted in **UTC**, with
one exception: whole-day bookings (Algorithm 1) additionally store a
timezone-agnostic **calendar date** (no time component), because a hotel
night is defined by the property's local calendar, not by a UTC instant — a
guest checking in on "the night of July 20th" means July 20th in Yerevan,
regardless of what UTC offset that corresponds to. Time-slot-grain bookings
(Algorithm 2/3/4) store true UTC timestamps, converted to the listing's
local timezone (stored once per listing, in the `listing_locations`
extension) only at render time, in the UI layer.

### 6.4 Daylight Saving Time (DST)

Because time-slot bookings are stored in UTC and converted for display, a DST
transition never silently shifts a stored booking time — "3:00 PM local"
before a DST change and "3:00 PM local" after it are simply two different
UTC instants, both computed correctly at render time from the current
timezone rules. The one case requiring explicit handling is a booking whose
slot spans the exact moment of a DST transition — the engine always resolves
this using the **first** occurrence of an ambiguous local time and treats a
skipped local time as invalid for new bookings (the UI's time picker simply
never offers a local time that does not exist that day), so no booking is
ever silently created for a time that doesn't occur.

### 6.5 Calendar Consistency with the Hold and Availability Layers

The Calendar Engine never duplicates hold/availability logic — every
calendar view is a rendering of the same `availability_calendar` and
`reservation_holds` state already governed by Sections 4 and 5. This is a
deliberate architectural constraint: if a future engineer is tempted to add
calendar-specific caching that could drift from the authoritative tables,
that caching must be read-through and short-TTL (seconds, not minutes) and
must never be the source consulted at hold-creation time.

---

## 7. Pricing Engine

### 7.1 The Price Resolution Pipeline

Every price shown to a customer — on a search card, on a listing page, at
checkout — is computed by the same deterministic pipeline, executed
server-side, never trusted from client input. Each stage either adjusts the
running total or contributes a labeled invoice line item, so the final price
is always fully explainable, not a single opaque number:

```
Base Price
   → Rate Plan selection (per DATABASE_ARCHITECTURE.md §4.7 rate_plans)
   → Seasonal / Weekend / Holiday / Special overrides (rate_plan_prices)
   → Length-of-stay / time-based price_rules (weekly, monthly, hourly, daily)
   → Dynamic Pricing adjustment (demand-based)
   → Discounts (listing-level promotional)
   → Coupons (customer-entered code)
   → Subtotal
   → Taxes (tax_rules, jurisdiction + module specific)
   → Service Fee (platform-facing, charged to customer)
   → Total Charged to Customer
   → Commission (platform's cut, deducted from partner payout — never added to customer total)
   → Partner Payout Amount
```

Every stage's output is written as an `invoice_items` row
(`DATABASE_ARCHITECTURE.md` §4.8) at confirmation time, so a customer,
partner, or admin can always see exactly how a total was reached — the
engine never recomputes a historical booking's price from current rules;
the invoice is the permanent record.

### 7.2 Base Price and Time-Unit Pricing

The `base_price` on a listing (or `bookable_unit` where individual units are
priced differently, e.g. hotel room categories) is always expressed in one
of four time units, matching the module's natural grain:

- **Hourly Price** — SPA services, short tour add-ons.
- **Daily Price** — Hotels, Vacation Houses, Apartments, Camping, Car
  Rentals (per night or per day).
- **Weekly Price** — a distinct, partner-settable rate for Vacation
  Houses/Apartments/Car Rentals booked 7+ nights, applied instead of (not
  stacked on top of) 7× the daily rate when it produces a lower or
  partner-preferred total.
- **Monthly Price** — long-stay Apartments and extended Car Rentals,
  analogous to the weekly rule at a 28/30-night threshold.

The engine always evaluates whether a longer-duration rate applies **before**
falling back to multiplying the shorter unit price by the number of
units requested — this ordering is what allows a 10-night stay to
automatically receive the weekly rate for its first 7 nights plus the daily
rate for the remaining 3, rather than 10 discrete daily charges.

### 7.3 Season, Weekend, Holiday, and Special Pricing

These four are all instances of the same mechanism —
`rate_plan_prices` date-range overrides (`DATABASE_ARCHITECTURE.md` §4.7) —
distinguished only by how the date range is defined and who sets it:

- **Season Price.** A partner-defined date range (e.g., "Summer High
  Season, June 15–September 10") with its own price, entered once and
  applied to every date it spans.
- **Weekend Price.** A recurring `price_rule` (not a one-off date range)
  matching Friday/Saturday nights (configurable per partner/locale, since
  "weekend" varies), applied as a surcharge percentage or fixed override on
  top of whatever base or seasonal price is otherwise in effect for that
  date.
- **Holiday Price.** A curated calendar of national/regional holidays
  (maintained centrally so every partner benefits without re-entering
  Armenian public holidays individually) that behaves like a high-priority
  `rate_plan_prices` override — holiday pricing takes precedence over
  season pricing when both would otherwise apply to the same date.
- **Special Price.** An ad hoc, partner-triggered override for a specific
  short date range outside the standard season calendar (e.g., a local
  festival week) — mechanically identical to Season Price, differing only
  in that it is typically set closer to the date and reviewed manually
  rather than planned a year in advance.

**Precedence rule:** when multiple date-based overrides could apply to the
same date, the engine always applies the **most specific** one: Holiday >
Special > Season > Weekend > Base. This ordering is fixed platform-wide so
pricing behavior is predictable and explainable to partners and support
staff alike.

### 7.4 Dynamic Pricing

Dynamic Pricing is an optional, opt-in layer (per listing) that adjusts the
otherwise-resolved price up or down within a partner-defined floor and
ceiling, based on real-time demand signals:

- **Occupancy-based signal.** As a listing's near-term
  `availability_calendar` fills up (few remaining nights/units in the next
  N days), price trends toward the ceiling.
- **Lead-time signal.** Bookings made very close to the date (last-minute)
  or very far in advance (early-bird) can be weighted differently per
  partner preference.
- **Search-demand signal.** Elevated search volume for a destination or
  date range (read from the search index, Section 16.3) nudges price
  upward ahead of occupancy actually tightening, capturing demand spikes
  earlier.

Dynamic Pricing never overrides an explicit Special or Holiday price the
partner has manually set — manual overrides always win, since a partner's
deliberate decision is treated as higher-confidence than an algorithmic
signal. The computed dynamic price is written back as a same-mechanism
`rate_plan_prices` row (not a separate code path) so it is visible,
auditable, and reversible through the same partner calendar tools as any
other override.

### 7.5 Coupons and Discounts

- **Discounts** are listing-level and require no customer action — e.g., an
  early-bird discount automatically applied when a booking is made more
  than 60 days ahead. Evaluated and applied automatically during pipeline
  stage "Discounts."
- **Coupons** require the customer to enter a code at checkout. The code is
  validated against `coupons.valid_from/valid_to`, `usage_limit`, and — via
  `coupon_redemptions` — any per-user redemption limit, **before** the
  discount is applied to the running total; an invalid, expired, or
  exhausted coupon simply fails validation and the pipeline proceeds
  without it, never silently applying a partial discount.
- Multiple discounts can stack with each other by default; a coupon and a
  discount can be configured per-coupon as either stacking or exclusive
  (whichever combination yields the customer the better single-discount
  outcome, if configured as exclusive) — this behavior is a coupon-level
  setting, not a global rule, so marketing can run both stacking
  promotions and exclusive "best price guaranteed" style codes.

### 7.6 Taxes, Commission, and Service Fee

- **Taxes** are resolved from `tax_rules` by the listing's jurisdiction
  (country/region) and `listing_type`, since tax treatment legitimately
  differs between, say, hotel occupancy tax and a general service VAT.
  Multiple applicable taxes (e.g., VAT + a municipal tourism tax) are each
  written as their own `invoice_items` line — never merged into one number
  — so customers and partners can see exactly what was charged and why.
- **Service Fee** is the platform's customer-facing fee (distinct from
  commission, which is partner-facing) — shown transparently as its own
  line item before final total, never buried inside the base price.
- **Commission** is the platform's share of the partner's revenue, resolved
  from `commission_plans`/`commission_rules` (`DATABASE_ARCHITECTURE.md`
  §4.7). Critically, commission is **never** added to the customer's total —
  it is calculated against the subtotal the customer paid and deducted at
  the payout stage (Section 8.8), so the customer-facing price and the
  partner-facing payout are two independently computed, independently
  displayed numbers derived from the same subtotal.

### 7.7 Price Locking at Hold Time

The instant a `reservation_holds` row is created (Section 5.2), the fully
resolved price — every pipeline stage's output — is snapshotted onto the
hold and, on confirmation, copied onto the `booking_items`/`invoice_items`
rows. This guarantees that a price change made by the partner (a new
Special Price, a coupon expiring) between the moment a customer starts
checkout and the moment they complete payment **never** affects that
in-flight booking — the customer always pays exactly the price they were
quoted at hold time, and the pipeline is never re-run against a booking
after its hold is created.

---

## 8. Payment Flow

### 8.1 Payment States

Payment status is tracked independently of booking status (Section 3),
because a booking can meaningfully exist in Pending while its payment moves
through several sub-states of its own:

`Pending → Authorized → Captured → (Failed | Refunded | Partial Refund | Chargeback)`

| Payment status | Meaning | Booking status it typically pairs with |
|---|---|---|
| Pending | Payment initiated, awaiting gateway response | Booking: Pending |
| Authorized | Funds reserved on the customer's instrument, not yet moved | Booking: Reserved |
| Captured | Funds moved to the platform's merchant account | Booking: Confirmed |
| Failed | Gateway declined authorization or capture | Booking: reverts to Pending (retry) or Expired (hold lapses) |
| Refund / Partial Refund | Some or all captured funds returned | Booking: Refunded (full) or remains Cancelled/Completed with a partial-refund note (partial) |
| Chargeback | Customer's issuing bank forcibly reversed a captured payment | Booking: flagged Chargeback (Section 3.3) |

### 8.2 Authorization vs. Capture

Two supported flows, selected by the listing's cancellation policy and
partner settings:

- **Immediate capture** (default for most Tours, Events, SPA, Restaurant
  Reservations): authorization and capture happen back-to-back within the
  same checkout request, moving the booking directly from Pending to
  Confirmed on success.
- **Delayed capture** (common for Flexible-rate Hotels/Vacation Houses):
  authorization happens at booking time (moving status to Reserved,
  Section 3.3), and capture is triggered later — either automatically by a
  scheduled job at a policy-defined point before check-in, or immediately
  if the booking passes its free-cancellation window without being
  cancelled. Authorization holds typically expire after 5–7 days per card
  network rules, so any delayed-capture window longer than that triggers a
  re-authorization rather than relying on the original hold indefinitely.

### 8.3 Wallet

Customers may hold a platform Wallet balance (from refunds, promotional
credit, or referral rewards). Wallet balance is checked and, if the customer
elects to use it, debited **before** the external payment gateway is
invoked — a booking can be fully or partially funded by wallet, with any
remaining balance charged to a card/other method in the same transaction.
Wallet debits follow the same Captured/Refund semantics as gateway payments,
just without an external network round-trip, and are recorded as their own
`payment_methods` type so reconciliation treats them identically to any
other tender in reporting (Section 14.1).

### 8.4 Failure Handling

A Failed authorization or capture never silently kills a booking. The
customer is returned to the payment step with the **same active hold still
in place** (provided it has not expired) — Failed is a payment sub-state,
not a booking-terminal state, and the customer may retry with a different
payment method within the remaining hold window described in Section 5.2.
If the hold expires during retries, the booking follows the standard
Pending → Expired path (Section 3.3), and the customer must restart from
Availability.

### 8.5 Refund and Partial Refund

Refunds are always initiated by the Cancellation Engine's determination
(Section 9), never issued as a bare payment operation — every refund
references the cancellation decision that authorized it, and its amount is
computed by that policy, not entered ad hoc except in explicit Admin-Panel
goodwill-refund cases (which still require a reason code and are captured
in `audit_logs`). A refund can be:

- **Full** — 100% of the captured amount, reversing the original charge.
- **Partial** — a policy-computed percentage or fixed deduction (e.g.,
  retaining a service fee, or refunding only nights not yet used for a
  mid-stay cancellation).

Refunds are processed asynchronously via a queued job (Section 16.2) against
the original payment/gateway reference — never as a new, unrelated charge in
reverse — so gateway-side reconciliation always links a refund to its source
payment.

### 8.6 Partner Payout

Payouts are batched, not per-booking, to keep transaction costs low and
reconciliation simple. On a recurring schedule (e.g., weekly), the engine
aggregates all Completed bookings (and any earlier-eligible Confirmed
bookings per partner payout-timing settings) since the last payout,
subtracts platform commission (Section 7.6) and any refunds/chargebacks
attributable to the partner in that period, and writes one `payouts` row
(`DATABASE_ARCHITECTURE.md` §4.8) per partner per period, with the full
underlying booking list available in the Partner Dashboard for
reconciliation.

### 8.7 Gateway Webhooks and Idempotency

All asynchronous payment events (capture confirmation, refund completion,
chargeback notice) arrive as gateway webhooks, not as synchronous responses
the Booking Engine waits on indefinitely. Every webhook carries (or is
wrapped with) an idempotency key derived from the gateway's own event ID;
the engine records processed event IDs and discards exact duplicates before
they can double-apply a capture or a refund (full treatment in Section
15.5).

### 8.8 Chargeback Handling

On a chargeback webhook, the engine: (1) marks the payment and booking per
Section 3.3, (2) creates a negative-amount ledger entry against the
partner's **next** payout batch (Section 8.6) rather than attempting to
reverse a payout that may have already been paid out and settled, and (3)
opens an Admin Panel case for manual dispute-evidence submission to the
gateway where the platform or partner contests the chargeback. Inventory
already consumed (a stay that already happened) is never automatically
re-released; a chargeback is a financial dispute, not an availability
event.

---

## 9. Cancellation Engine

### 9.1 Policy as Data, Not Code

Every listing is assigned a cancellation policy from a fixed vocabulary —
**Flexible, Moderate, Strict, No Refund, Custom** — stored as structured
data (a policy record with its refund-percentage rules keyed by "time before
check-in"), never as branching application code. This is what allows a new
policy variant to be added by a product/ops decision, not an engineering
change.

| Policy | Typical rule shape |
|---|---|
| **Flexible** | 100% refund if cancelled ≥ 24–48 hours before check-in; no refund after |
| **Moderate** | 100% refund ≥ 5 days before; 50% refund 1–5 days before; no refund inside 24 hours |
| **Strict** | 50% refund ≥ 14 days before; no refund after |
| **No Refund** | 0% refund at any point after confirmation |
| **Custom** | Partner-defined tiered schedule, structurally identical to Moderate/Strict but with partner-chosen thresholds and percentages |

### 9.2 Resolution Algorithm

At the moment a cancellation is requested, the engine: (1) reads the
booking's assigned policy, (2) computes the time delta between "now" and the
booking's scheduled start (check-in date, reservation time, departure time —
whichever applies per module), (3) finds the matching tier in the policy's
schedule, and (4) returns a refund **percentage** applied to the original
subtotal (never to taxes/fees already remitted or a coupon-discounted amount
the customer never actually paid). This computed percentage is what Section
8.5 executes as a Refund/Partial Refund/No Refund outcome.

### 9.3 Partial Refund for Multi-Night/Multi-Unit Bookings

For a booking already partially consumed (a 5-night stay cancelled after
night 2), the refund percentage from §9.2 is applied only to the **unused
portion** of the booking's total, computed pro-rata by remaining
nights/sessions — the engine never refunds nights already stayed regardless
of policy tier, since those nights' inventory and service have already been
delivered.

### 9.4 Late Cancellation

A cancellation requested inside the policy's strictest (closest-to-date)
tier — or after the scheduled start has already passed — is a **Late
Cancellation**, always resolved to the policy's 0%-refund tier by
definition, and is logged distinctly from an on-time cancellation in
Analytics (Section 14.5) so partners and platform ops can track no-show and
late-cancellation rates separately from planned, early cancellations.

### 9.5 Partner-Initiated Cancellation

A partner cancelling a confirmed booking (property closure, overbooking
error) always triggers a **100% refund regardless of the listing's stated
policy** — the policy governs the customer's cancellation rights, not the
partner's obligations when the partner is the one breaking the commitment.
Partner-initiated cancellations are additionally flagged for Admin Panel
visibility and factor into the partner's reliability metrics.

### 9.6 Cancellation and Inventory Release

Every cancellation, regardless of refund outcome, immediately releases the
associated `availability_calendar` rows back to available (Section 5.6's
release logic) unless the partner explicitly chooses to keep the date
blocked (e.g., to perform maintenance) — inventory release and refund
determination are independent operations that simply happen to be triggered
by the same event.

### 9.7 Custom Policy Governance

Because Custom policies are partner-authored data rather than
partner-authored code, the Admin Panel validates every custom policy at
creation time against structural constraints (tiers must be
chronologically ordered, percentages must be non-increasing as the
cancellation gets closer to the date, a policy must resolve to a defined
percentage for every possible time delta including exactly zero) — this
keeps the same resolution algorithm (§9.2) safe to run against any
partner's custom schedule without special-casing.

---

## 10. Notification Flow

### 10.1 Trigger Points

Every booking-lifecycle transition in Section 3.3 is a notification trigger
point. The engine does not send notifications directly from business logic —
each transition **enqueues** a notification event (Section 16.2's queue
infrastructure) referencing the `notification_templates` code that applies,
so notification delivery is decoupled from, and can never block or slow
down, the transaction that changed the booking's status.

| Trigger | Customer | Partner | Admin |
|---|---|---|---|
| Hold created | — (silent; UI shows countdown directly) | — | — |
| Payment failed | Email + In-App | — | — |
| Confirmed | Email + SMS + In-App/Push | Email + In-App | — (unless high-value/flagged) |
| Reminder (T-24h) | Push + SMS | — | — |
| Checked In | In-App | In-App | — |
| Cancelled (customer-initiated) | Email + In-App | Email + In-App | — |
| Cancelled (partner-initiated) | Email + SMS + In-App | In-App (confirmation) | Logged, flagged for review |
| Refund issued | Email + In-App | Email (payout impact) | — |
| Completed / Review invite | Email + Push | — | — |
| Chargeback | — | Email + In-App | Email (case opened) |
| Payout processed | — | Email + In-App | — |

### 10.2 Channels

- **Email** — transactional, always sent for financially or legally
  significant events (confirmation, cancellation, refund, invoice);
  templated and translated per `notification_templates` +
  translation table (`DATABASE_ARCHITECTURE.md` §4.9).
- **SMS** — reserved for time-sensitive, high-urgency events (confirmation,
  check-in reminders, partner-initiated cancellations) where email delivery
  latency or inbox neglect is an unacceptable risk.
- **Push** — mobile app notifications for engagement-oriented and
  reminder-type events; respects `notification_preferences` opt-out per
  category.
- **In-App** — the notification center (`UI_UX_GUIDELINES.md` §9.11) is the
  durable, always-populated record of every event regardless of the
  customer's channel preferences elsewhere — a customer who disables push
  and SMS entirely still sees every booking event in-app.
- **Partner** and **Admin** are not separate channels but separate
  **recipients** — the same four channels (email/SMS/push/in-app) apply,
  addressed to the partner's or admin's own notification preferences and
  role-based subscriptions (an admin only receives platform-severity
  events, e.g., chargebacks and disputes, not every routine confirmation).

### 10.3 Delivery Guarantees

Notification dispatch follows the same idempotency and retry principles as
payment webhooks (Section 15.5): each enqueued notification event carries an
idempotency key, is retried with exponential backoff on transient delivery
failure, and is marked delivered/failed permanently after a bounded number
of attempts — a failed non-critical notification (e.g., a push notification
that could not reach an uninstalled app) never blocks or reverses the
underlying booking transition that triggered it.

---

## 11. Booking Validation

### 11.1 Validation Is Layered, Not Single-Point

No single check is trusted to catch every invalid booking attempt. Validation
happens at three layers, each catching what the layer before it cannot:

1. **Client-side (UI)** — immediate feedback (a date picker that will not let
   a customer select a blacked-out date). Purely a UX convenience; never
   trusted as a security or correctness boundary.
2. **API-layer request validation** — structural correctness (valid date
   formats, party size within a listing's min/max occupancy, required
   fields present) rejected before any database or lock interaction is
   attempted.
3. **Transactional, lock-protected validation** — the authoritative layer
   (Sections 4 and 5): re-checks availability, capacity, and blackout rules
   at the instant of commitment, under the Redis lock, regardless of what
   any earlier layer already confirmed.

### 11.2 Double Booking

Prevented structurally, not just procedurally: `availability_calendar`'s
composite unique constraint on `(bookable_unit_id, date)`
(`DATABASE_ARCHITECTURE.md` §6.2) makes a second `booked` status for the same
unit/date a constraint violation at the database level, not merely an
application-logic oversight — even a bug that bypassed the Redis lock
entirely could not physically write a conflicting confirmed row.

### 11.3 Inventory and Capacity

For exclusive-claim modules (Algorithm 1/2), inventory validation is the
availability check itself (Section 4.2). For shared-capacity modules
(Algorithm 3/4), capacity validation additionally checks that the requested
`party_size` never exceeds a unit's configured maximum, independent of how
much capacity currently remains — a request for 50 people against a
30-capacity pool session fails even if the session is otherwise completely
empty.

### 11.4 Overbooking

Distinguished from the deliberate overbooking buffer (Section 4.4):
*unintentional* overbooking is what the entire hold/lock architecture exists
to make structurally impossible under normal operation. The one residual
path — an external-channel booking arriving via delayed iCal sync (Section
6.2) after an internal booking has already claimed the same date — is
handled by treating whichever booking committed first (by timestamp) as
authoritative and immediately flagging the second-arriving booking for
manual Admin Panel resolution (relocate the guest, offer compensation, etc.)
rather than allowing the engine to silently pick a side.

### 11.5 Blackout Dates

Checked as a hard veto **before** the availability algorithms run: if any
requested date (or its overlapping range) falls inside an active
`blackout_dates` entry for the unit or its parent listing, the request is
rejected immediately, without consuming a Redis lock or touching
`availability_calendar` at all — blackout is a cheaper, earlier check than
full availability evaluation.

### 11.6 Time Conflicts

For time-slot-grain modules, "time conflict" validation is the interval
-overlap check defined in Algorithm 2 (Section 4.2), additionally
cross-checked against the customer's **own** other bookings for the same
day where relevant (e.g., preventing a customer from accidentally booking
two overlapping SPA treatments), surfaced as a soft warning rather than a
hard rejection, since a customer may legitimately intend concurrent bookings
for their travel party.

---

## 12. Check-In Engine

### 12.1 Purpose and Applicability

Check-In converts a Confirmed booking into a Checked-In one (Section 3.3),
recording that the customer has actually taken possession of or begun using
the reserved unit. Per Section 2.2's applicability table, this stage is
declared **applicable or not applicable per module** at module-registration
time — it is never silently skipped, only explicitly opted out (e.g., a
simple restaurant reservation may declare check-in not applicable and rely
on the scheduled-completion job in Section 16.2 instead).

### 12.2 Check-In Methods

Four interchangeable methods can satisfy the same Check-In transition — a
listing/module can enable one or several, and the engine treats successful
verification via any of them identically:

- **QR Code.** A unique, single-use QR code is generated at confirmation
  time (encoding the booking reference, never sensitive payment data) and
  delivered via email/in-app (Section 10). Scanning it at the property,
  vehicle counter, or event gate performs the transition automatically. The
  code is invalidated (single-use) immediately upon successful scan to
  prevent replay.
- **PIN.** A short numeric code, generated and delivered the same way as
  the QR, for contexts without scanning hardware (phone-based front desk
  confirmation, verbal confirmation for small tour operators). Same
  single-use invalidation rule applies.
- **Manual.** A partner staff member locates the booking by customer name
  or reference number in the Partner App/Dashboard and performs the
  transition directly — the fallback method that always exists regardless
  of what automated method a module also supports.
- **Reception / Partner App.** Not a distinct verification mechanism but the
  **interface** through which QR, PIN, or Manual check-in is actually
  performed by staff — the Partner App is the primary surface for Hotels,
  Vacation Houses, Camping, and Car Rentals; a lighter kiosk-style flow
  serves Events and Tours.

### 12.3 Validation at Check-In

Regardless of method, the engine validates, before allowing the transition:
(1) the booking is currently in `Confirmed` status (a `Cancelled` or
`Expired` booking cannot be checked in — this closes off a class of fraud
attempting to use a stale QR code), (2) the current date/time falls within
the module's allowed check-in window (e.g., not more than a configurable
number of hours before the scheduled start), and (3) the staff member or
device performing the check-in has permission scoped to that listing's
partner (Section 15.7's RBAC enforcement).

### 12.4 Early and Late Check-In

Requests to check in before the allowed window are rejected with a
clear "too early" response rather than silently succeeding; requests after
the scheduled start are still accepted (this is not a cancellation trigger
by itself) but are flagged and visible to the partner as a late arrival,
feeding into the no-show/late-cancellation distinction used in Analytics
(Section 14.5) and the Cancellation Engine's Late Cancellation path
(Section 9.4) if the customer never arrives at all.

---

## 13. Check-Out Engine

### 13.1 Purpose and Charge Settlement

Check-Out closes the usage period (Checked In → Checked Out, Section 3.3)
and is the point at which any charges beyond the original booking total are
assessed and settled before the booking can reach Completed:

- **Charges.** Any partner-assessed additional consumption (minibar, spa
  add-ons ordered during the stay) entered by partner staff and appended as
  new `invoice_items` against the same booking's invoice.
- **Damage.** Partner-reported damage assessment, requiring a documented
  reason and, where a security deposit was collected at booking time
  (common for Vacation Houses, Apartments, Car Rentals), deducted from that
  deposit rather than charged fresh — the deposit hold and its release/
  deduction is itself modeled as an authorization-then-capture-or-void
  payment operation (Section 8.2), not a separate financial mechanism.
- **Extra Services.** Pre-arranged or in-stay-requested add-ons (late
  checkout itself, an additional tour add-on, extra cleaning) billed the
  same way as Charges.
- **Late Checkout.** A specific, common Extra Service: if a customer
  requests to remain past the scheduled check-out time and the partner
  approves, the engine either applies a pre-configured late-checkout fee
  (`price_rules`-style flat or percentage charge) or extends the booking's
  `booking_items` date/time range and re-runs the standard Availability
  check (Section 4.2) to ensure the extension does not conflict with the
  next confirmed booking on that unit — an unapproved or conflicting
  late-checkout request is rejected, not silently granted.

### 13.2 Dispute Window and Finalization

After Check-Out, most modules hold a short, configurable grace period
(e.g., 24–48 hours) before automatically transitioning to `Completed`,
during which a customer can dispute an added charge through the platform
(rather than only via a card-network chargeback, Section 8.8, which is
costlier for everyone). Disputes raised in this window pause the automatic
transition and route to Admin Panel for resolution; disputes raised after
the window has closed and the booking is already Completed are still
accepted but handled as a standard post-completion support case rather than
blocking the state machine.

---

## 14. Analytics

### 14.1 Revenue

Revenue reporting is always computed from `invoice_items`, never from a
listing's advertised price, since only invoice line items reflect what was
actually charged after discounts, coupons, and taxes. Standard breakdowns
available in the Partner Dashboard and Admin Panel: gross booking value,
net revenue after refunds, revenue by module, revenue by date range, and
revenue by rate plan (to measure the actual uptake of Flexible vs.
Non-refundable pricing).

### 14.2 Occupancy

Defined as booked-unit-nights (or booked-sessions, for capacity modules)
divided by available-unit-nights over a period, computed directly from
`availability_calendar` status counts — this is the metric the Admin
Calendar (Section 6.1) surfaces platform-wide, and the Partner Calendar
surfaces per-listing.

### 14.3 ADR (Average Daily Rate)

Total room/unit revenue for a period divided by the number of booked
unit-nights in that period (explicitly excluding vacant nights from the
denominator, distinguishing ADR from RevPAR). Reported per listing, per
module, and aggregated per partner.

### 14.4 RevPAR (Revenue Per Available Unit)

Total revenue for a period divided by **total available** unit-nights
(occupied and vacant) — equivalently, ADR × Occupancy Rate. This is the
headline metric surfaced on the Partner Dashboard's revenue overview
(`UI_UX_GUIDELINES.md` §11.2 — "lead with the number, then the trend"),
since it captures both pricing and utilization in one figure.

### 14.5 Cancellation Rate

Computed as cancelled bookings divided by total confirmed bookings over a
period, reported separately for: customer-initiated on-time cancellations,
Late Cancellations (Section 9.4), and partner-initiated cancellations
(Section 9.5) — collapsing these three into one number would hide the very
different business implications each carries (the third, especially,
feeding directly into partner reliability scoring).

### 14.6 Conversion

Tracked across the full funnel described in Section 2.1: Search →
Availability View → Hold Created → Payment Attempted → Confirmed. Each
stage's drop-off is independently measurable because every stage, including
abandoned Holds (Expired, Section 3.3), leaves a durable, queryable row
rather than a transient client-side event — conversion analytics reads the
same source-of-truth tables as the booking engine itself, never a separate
event-tracking pipeline that could drift out of sync.

---

## 15. Security

### 15.1 Race Conditions — Formal Guarantee

Section 5.7 walked through the canonical double-booking race informally;
formally, the guarantee the engine provides is: **for any two concurrent
requests contending for overlapping availability on the same
`bookable_unit`, at most one will observe a successful hold/booking
outcome, regardless of network timing, server instance, or request
order of arrival.** This is achieved by the combination of (a) the Redis
lock serializing all writes to a given unit/range (Section 5.4), and (b)
the database transaction's row-level locking as a second, independent
enforcement layer beneath the Redis lock — so even in the vanishingly rare
case of a Redis lock failure (network partition, expired lease under
extreme load), the database's own constraints (Section 11.2's unique
index) still make a physically conflicting write impossible, only ever
producing a rejected transaction, never a corrupted one.

### 15.2 Distributed Locking — Failure Modes

Three failure modes are explicitly designed for: (1) **lock acquisition
timeout** — handled by failing the request fast (Section 5.4) rather than
queuing; (2) **lock holder crash before release** — mitigated by a short
lease/TTL on every lock, so an abandoned lock self-expires within seconds
rather than deadlocking all future requests for that unit; (3) **Redis
unavailability** — the engine degrades to database-transaction-only
locking (row locks via `SELECT ... FOR UPDATE`) as a fallback, trading some
throughput for continued correctness rather than failing every booking
request platform-wide during a Redis outage.

### 15.3 Database Transactions

Every multi-table write described in this document (hold creation, hold
release, confirmation, cancellation, check-in, check-out) is wrapped in a
single database transaction, committed only once every constituent write
succeeds. The confirmation transaction (Section 3.3, "Reserved →
Confirmed") is the most consequential: it touches `booking_items`,
`bookings`, `availability_calendar`, `reservation_holds` (deletion),
`invoices`, and `invoice_items` atomically — a partial failure at any
point rolls back every other write in that same transaction, so the system
is never observed in a state where, for example, inventory is committed but
no invoice exists.

### 15.4 Queueing

Everything that does not need to complete before the customer sees a
response — notifications (Section 10), payout batching (Section 8.6),
iCal sync polling (Section 6.2), analytics aggregation (Section 14) — is
processed via a durable message queue rather than executed synchronously
in the request path. This keeps the customer-facing booking transaction's
latency bounded by only the work that is genuinely required to be
synchronous: availability check, lock, and the database write itself.

### 15.5 Idempotency

Every operation exposed to retry — by a client (a customer double-tapping
"Confirm Booking"), by a gateway webhook (Section 8.7), or by the queue's
own at-least-once delivery guarantee (Section 15.4) — requires an
idempotency key. The engine persists a short-lived record of
(idempotency key → outcome) for every such operation; a repeated request
with the same key returns the original outcome without re-executing the
underlying side effects (charging a card twice, sending a duplicate
confirmation email, decrementing capacity twice for the same logical
request).

### 15.6 Retry Logic

Transient failures (a gateway timeout, a momentary database
unavailability) are retried with **exponential backoff and jitter**, up to
a bounded maximum attempt count, always guarded by the idempotency layer
(Section 15.5) so retries are always safe to issue. Permanent failures
(a declined card, a structurally invalid request) are never retried
automatically — they are surfaced to the customer or partner immediately
for correction.

### 15.7 Audit Logs

Every state transition in Section 3, every admin-initiated calendar or
pricing override (Section 6.1, 7.4), every check-in/check-out action
(Sections 12–13), and every privileged read of customer payment data
writes a row to `audit_logs` (`DATABASE_ARCHITECTURE.md` §4 governance) —
identifying the actor, the action, and a before/after diff where
applicable. Audit logs are insert-only and are the definitive record
consulted for dispute resolution, chargeback evidence (Section 8.8), and
compliance review; no part of the Booking Engine is permitted to update or
delete an audit log row.

---

## 16. Scalability

### 16.1 Millions of Bookings

The schema-level partitioning strategy already defined in
`DATABASE_ARCHITECTURE.md` §15.2 (RANGE partitioning by `created_at` on
`bookings`, `payments`, `availability_calendar`, and `notifications`) is
what keeps the Booking Engine's core tables performant as historical volume
grows into the millions — active-window queries (the only queries the
booking flow itself ever issues; a customer never books a date already in
the past) touch only the most recent partitions, while historical
partitions serve analytics and support lookups without competing for the
same index pages.

### 16.2 Background Jobs and Queues

The Booking Engine relies on a small, well-defined set of recurring
background jobs, all queue-driven (Section 15.4):

- **Hold expiration sweep** — every few seconds (Section 5.3).
- **Scheduled auto-completion** — moves bookings from Checked Out (or
  Confirmed, for modules without check-in) to Completed once their grace
  window (Section 13.2) elapses.
- **Delayed-capture trigger** — initiates payment capture for Reserved
  bookings approaching their capture deadline (Section 8.2).
- **iCal poll** — every 15 minutes per connected external calendar
  (Section 6.2).
- **Payout batch** — weekly (or partner-configured) aggregation (Section
  8.6).
- **Notification dispatch workers** — continuously draining the
  notification queue (Section 10.3).

Each job is horizontally scalable by adding more worker instances, since
every job's unit of work (one hold, one booking, one calendar sync) is
independent and safely parallelizable behind the same idempotency
guarantees (Section 15.5).

### 16.3 Caching

Two distinct caching layers, kept deliberately separate so neither can be
mistaken for the authoritative source:

- **Search index** (Section 4.5) — an eventually-consistent, denormalized
  read model dedicated to fast, faceted, full-text/geo search, updated via
  change-data-capture from `listings` and `availability_calendar`. Never
  consulted at hold or confirmation time.
- **Hot-path read cache** (Redis, short TTL — seconds) — for
  high-frequency, low-mutation reads like a listing's current price display
  or aggregate seat counts (Algorithm 4, Section 4.2), refreshed frequently
  enough that staleness is imperceptible, and never used as the system of
  record for a write decision.

### 16.4 Microservices-Ready Boundaries

Consistent with `DATABASE_ARCHITECTURE.md` §15.4, the Booking Engine's
internal module boundaries are already drawn along service-extraction
lines: **Availability/Hold**, **Pricing**, **Payment**, and
**Notification** are each callable as logically independent units today
(clear input/output contracts, no shared in-process state beyond the
database and Redis) so that, if warranted by scale, any one of them can be
extracted into its own deployable service without redesigning the booking
lifecycle itself. Booking/Payment remains the most likely first extraction
given its compliance surface area, exactly as anticipated in
`DATABASE_ARCHITECTURE.md`.

### 16.5 Horizontal Scaling of the Engine Itself

The Booking Engine's application layer is stateless by design — every
piece of state that must survive a request (holds, locks, booking records)
lives in the database or Redis, never in server process memory. This means
the engine scales horizontally by simply adding more application instances
behind a load balancer, with Redis providing the only cross-instance
coordination point (Section 5.4), and the database remaining the single
source of truth regardless of how many application instances are running
concurrently.

---

## Appendix A — Module Mapping Reference

| Module | Extension table (per `DATABASE_ARCHITECTURE.md` §4.4) | Availability algorithm (§4.2) | Check-In applicable | Check-Out applicable | Typical cancellation policy |
|---|---|---|---|---|---|
| Hotels | `hotels` / `hotel_room_types` / `hotel_rooms` | 1 (Exclusive, Daily) | Yes | Yes | Flexible / Moderate |
| Vacation Houses | `vacation_houses` | 1 | Yes | Yes | Moderate / Strict |
| Apartments | `vacation_houses`-pattern extension | 1 | Yes | Yes | Moderate |
| Camping | New module extension, same 1:1 shared-PK pattern | 1 | Yes | Yes | Strict |
| Restaurant Reservations | `restaurants` / `restaurant_tables` | 2 (Exclusive, Time-Slot) | Optional | No | Flexible (short window) |
| SPA | `spas` / `spa_services` | 2 | Yes | Yes | Moderate |
| Tours | `tours` / `tour_departures` | 2 or 3 (seat-assigned vs. capacity-only) | Yes | No | Strict |
| Events | `events` / `event_sessions` | 3 or 4 (general admission vs. assigned seating) | Yes | No | No Refund / Strict |
| Car Rentals | `car_rentals` | 1 (with pickup/drop-off time components) | Yes | Yes | Moderate |
| Swimming Pools | New module extension, session-based | 3 (Shared Capacity) | Yes | No (auto) |Flexible |
| **Future modules** | Follow the same 1:1 shared-PK extension pattern | Select the applicable one of the four algorithms at registration | Declared at registration | Declared at registration | Any of the five policy types, or Custom |

Adding a future module never requires new Booking Engine logic: it requires
(1) a new module extension table following the established pattern, (2) a
declared choice of availability algorithm and stage-applicability from the
options this document already defines, and (3) a cancellation policy
assignment. This is a data/configuration exercise, not a code change to
Sections 3–15.

---

## Appendix B — Glossary

- **Bookable Unit** — the atomic reservable resource (a room, vehicle,
  table, tour departure, spa slot, event session, pool session, or seat)
  that the Availability Engine and Reservation Hold operate on, regardless
  of module.
- **Hold** — a time-limited, exclusive-or-capacity claim on a bookable unit
  created before payment, expiring automatically after 15 minutes if not
  converted into a confirmed booking.
- **Exclusive claim** — a claim model where one successful hold/booking
  fully excludes all others for the same unit and window.
- **Shared/capacity claim** — a claim model where multiple bookings draw
  down a shared numeric capacity until it reaches zero.
- **Rate Plan** — a named, purchasable pricing/cancellation strategy
  attached to a listing (e.g., Flexible vs. Non-refundable).
- **Idempotency Key** — a client- or system-generated unique identifier
  attached to a retryable operation, guaranteeing repeated execution
  produces the original outcome exactly once.
- **RevPAR** — Revenue per Available Unit; total revenue divided by total
  available unit-time in a period, capturing both pricing and utilization.
- **Chargeback** — an externally initiated payment reversal by a customer's
  card issuer, distinct from a platform-processed refund.

---

*— End of BOOKING_ENGINE_ARCHITECTURE.md —*
