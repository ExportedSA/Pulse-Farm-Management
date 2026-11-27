# Shed link: Stride ⇄ Pulse (version 1)

Stride runs on the shed PC and drives the drafting gate and the NORVI feed board over serial. Pulse runs in the
cloud and holds the farm's records. Pulse can't reach into a shed, so **Stride connects out** to Pulse over one
WebSocket and keeps it open. Pulse decides who drafts where and how much each cow is fed; Stride carries it out,
keeps working from its last copy when the internet drops, and sends every read, draft and feed back as a record.

## Connecting

- Address: `wss://<pulse host>/ws/shed` (`ws://localhost:<port>/ws/shed` when developing).
- Header: `Authorization: Bearer <link token>`. The token is issued once per farm gateway by whoever runs the service
  (`npx tsx scripts/hardware-gateway.ts add <farm id> --stride`) and pasted into Stride's Settings. Pulse stores only
  its SHA-256. Never put the token in the address.
- One Stride per gateway: a new connection with the same token replaces the old one.
- Close codes from Pulse: `4401` token not recognised, `4403` gateway stopped or not a Stride gateway, `4409` replaced
  by a newer connection. Stride retries on any other close, waiting 2 s, then doubling to at most 60 s.
- Both sides send JSON text frames, one message per frame, each with a `type`. Unknown types are ignored, so either
  side can add messages without breaking the other. Pulse pings every 30 s (WebSocket ping frames).

Times are ISO 8601 strings with a time zone (`2026-11-26T05:42:10.512Z`). Lanes are `LEFT`, `RIGHT` or `STRAIGHT`.
Bails are numbered from 1 (the NORVI board has `B1` and `B2`). Reader locations are `gate`, `bail1`, `bail2`, ...

## Pulse → Stride

### `welcome` (first message after connecting)
```json
{ "type": "welcome", "protocol": 1, "farmName": "Dilloway", "gatewayId": "3f6c…", "serverTime": "2026-11-26T05:42:10.512Z" }
```

### `snapshot` (after `welcome`, after any change to the records it's built from, and on `snapshot_request`)
```json
{
  "type": "snapshot",
  "version": "2026-11-26T05:42:10.512Z#17",
  "generatedAt": "2026-11-26T05:42:10.512Z",
  "herd": [
    { "eid": "982000123456789", "cowNumber": "432", "animalId": "b1c2…", "groups": ["Colostrum", "Mob 3"] }
  ],
  "draft": [
    { "eid": "982000123456789", "lane": "LEFT", "reason": "Milk withholding until 28 Nov 06:00", "ruleId": "9a1e…" }
  ],
  "feed": [
    { "eid": "982000123456789", "gramsPerVisit": 1500, "reason": "Mob 3 level" }
  ]
}
```
- `herd`: every current animal with an EID, so Stride can show cow numbers and groups.
- `draft`: only cows a Pulse rule sends somewhere. The first matching rule by priority wins. Cows not listed are left
  to Stride's own rules (weight) and its default lane.
- `feed`: grams to feed per bail visit. An animal's own level beats a group's; among group levels, the highest
  priority wins. Cows not listed get no in-shed feed from Pulse.
- Stride keeps the last snapshot on disk and drafts and feeds from it while offline. A snapshot replaces the previous
  one whole.

### `command` (sent only when an owner or manager uses the Shed page)
```json
{ "type": "command", "id": "c7d2…", "action": "draft", "lane": "LEFT" }
{ "type": "command", "id": "c7d3…", "action": "feed_start", "bail": 1, "grams": 1500 }
{ "type": "command", "id": "c7d4…", "action": "feed_stop", "bail": 1 }
```
Stride carries out a command only when its "Allow Pulse to control the shed" setting is on, and never moves the gate
while a cow is in the race. It always answers with `command_result`.

### `events_ack`
```json
{ "type": "events_ack", "ids": ["s-01HF…", "s-01HG…"] }
```
The events Pulse has stored (or already had). Stride drops them from its outbox.

## Stride → Pulse

### `hello` (first message after `welcome`)
```json
{ "type": "hello", "app": "stride-gate", "version": "1.1.0", "snapshotVersion": "2026-11-26T05:42:10.512Z#16",
  "remoteControl": true, "hardware": { "gate": "IDLE", "feed": "CONNECTED" } }
```
If `snapshotVersion` isn't Pulse's current one, Pulse sends a fresh `snapshot`.

### `events` (batched; resent until acknowledged)
```json
{ "type": "events", "events": [
  { "id": "s-01HF…", "kind": "eid",   "at": "…", "eid": "982000123456789", "reader": "gate" },
  { "id": "s-01HG…", "kind": "draft", "at": "…", "eid": "982000123456789", "lane": "LEFT",
    "source": "pulse", "reason": "Milk withholding until 28 Nov 06:00" },
  { "id": "s-01HH…", "kind": "feed",  "at": "…", "eid": "982000123456789", "bail": 1,
    "targetGrams": 1500, "actualGrams": 1495 },
  { "id": "s-01HJ…", "kind": "draft", "at": "…", "eid": null, "lane": "RIGHT", "source": "manual" }
] }
```
- `id` is Stride's own, unique and never reused (a ULID or UUID). Pulse stores each id once per gateway, so resending
  is always safe.
- `source` on a draft: `pulse` (from the snapshot), `local` (a Stride rule), `default` (no rule matched), `manual`
  (a button in the shed), `remote` (a Pulse `command`).
- A feed event is sent when the bail finishes or is stopped, with the grams the board reported.
- At most 200 events per message.

### `status` (when something changes, at most every 2 s; not stored)
```json
{ "type": "status", "gate": "LEFT", "bails": [ { "bail": 1, "actualGrams": 600, "targetGrams": 1500, "feeding": true } ] }
```

### `command_result`
```json
{ "type": "command_result", "id": "c7d2…", "ok": false, "error": "Remote control is off in Stride" }
```

### `snapshot_request`
```json
{ "type": "snapshot_request" }
```

## Draft rules and feed levels (set in Pulse)

A draft rule has a name, a lane, a priority (higher first), on/off, and one condition:

| Condition | Matches a cow when |
|---|---|
| `milk_withholding` | her milk isn't clear for the vat yet (any current treatment) |
| `dose_due` | a treatment dose is due within `withinHours` |
| `in_group` | she's in the group or mob `groupId` |
| `heat` | a heat was recorded for her within the last `withinHours` |
| `cow_numbers` | her cow number is in `cowNumbers` |

A feed level gives grams per bail visit to one animal or one group, with a priority and optional from and to dates.
Pulse supplies no feed amounts of its own: every gram comes from a level the farm entered.
