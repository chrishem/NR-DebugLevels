# node-red-contrib-debug-levels

Bitmask-based debug channel gating for Node-RED.

Define independent, user-labeled debug channels (up to 16) stored as a single integer in Node-RED context. Log messages only when a given channel is currently active. Channels are orthogonal — enabling "MQTT" doesn't force "Timers" on — unlike hierarchical severity systems (debug/info/warn/error) where each level includes everything above it.

## Install

```bash
cd ~/.node-red
npm install node-red-contrib-debug-levels
```

Or install via the Node-RED Palette Manager.

## Nodes

Three pieces: one hidden config node, and two nodes you actually drag onto the canvas.

### debug-level-config (hidden config node)

Doesn't appear in the palette — create or edit it from the Config picker on a **Debug** or
**Setup** node ("Add new debug-level-config..."). Defines:

- **Context Key** — the variable name storing the 16-bit integer (default: `debugLevel`)
- **Scope** — `global` (one shared value instance-wide) or `flow` (separate value per flow tab)
- **Store** — which configured context store persists the value (e.g. `memory` vs. `file` for persistence across restarts)
- **Channels** — an add/remove/rename list of channel names. A channel's position in the list is its bit (top = bit 0), so removing one shifts every channel below it down a bit.

Multiple **Debug** and **Setup** nodes reference the same config to share one common channel set.

### Debug (`debug-channel` type)

Logs to the Debug sidebar (and/or console), but only when its one selected channel is currently
active. Drop it in wherever you'd otherwise use the built-in debug node.

- **Channel** — pick exactly one channel from the config
- **Enabled** — disable logging without removing the node (mirrors the built-in debug node's on/off state)
- **Output to** — Debug sidebar and/or console (`node.warn`)
- **Output** — the complete `msg` object, or a specific `msg` property / JSONata expression
- No output pin — it's a terminal debug sink, same as the built-in debug node
- **Status** — shows the channel's on/off state immediately on deploy (green dot / grey ring), not just after the first message; also shows "disabled" when unchecked. Doesn't live-update from a toggle elsewhere if no message passes through in between — accurate as of deploy and as of each message received.

### Setup (`debug-set` type)

Enables/disables channels two ways: checkboxes in its own edit dialog, or wired input.

- **Channels active on deploy** — check a channel and Deploy to force it on immediately (and off if unchecked). This is a declarative "this is the state I want" panel — it reapplies every time the node (re)starts, overwriting whatever a wired message set since the last deploy.
- **Wired input** — send it a message with `msg.debugAction` (`set`/`clear`/`toggle`/`set-all`/`clear-all`/`toggle-all`/`write`) and `msg.debugMask` to change channels programmatically at runtime (inject, MQTT, dashboard switches, HTTP, etc.). A message with no `msg.debugAction` just reports the current state without changing anything.
- Outputs `msg.debugLevel`, `msg.debugBits`, `msg.debugLabels`, and `msg.debugActive`

## How it works

The debug level is a single integer (0–65535) stored in Node-RED context:

```
Bit 15 ............................................. Bit 0
Ch15  Ch14  Ch13  Ch12  Ch11  Ch10  Ch9  Ch8  Ch7  Ch6  Ch5  Ch4  Ch3  Ch2  Ch1  Ch0
 0     0     0     0     0     0     0    0    0    0    0    0    1    0    0    1   = 9 (Ch0 + Ch3 active)
```

**Setup** writes this integer (checkbox state on deploy, or bitwise ops from a wired message).
**Debug** reads it and logs only when its selected bit is set.

## Example

1. Create one **Debug Setup** flow: drag a **Setup** node, create a new **debug-level-config**
   (Context Key `debugLevel`, Store `file` for persistence), and add your channel names.
2. Check the channels you want active by default in that **Setup** node and Deploy.
3. Add **Debug** nodes inline wherever you want gated logging — pick the one channel each cares about.
4. Optionally wire an inject/dashboard switch/MQTT node into the same **Setup** node's input to flip channels at runtime.

An importable example flow is included in the `examples/` folder.

## Integration with existing context variables

If you already have a debug level integer stored in context under a different name (e.g. `debugenabled`), just set the config node's Context Key to match. The package reads and writes whatever key you point it at — no migration needed. Note that a **Setup** node forces its checkbox state onto that key at every deploy, so if something else (e.g. a dashboard switch) already owns that variable independently, either skip the checkboxes (leave them all unchecked and only use wired input) or let **Setup** be the single owner going forward.

## Runtime control via messages

The **Setup** node accepts overrides on incoming messages:

| Property | Type | Description |
|---|---|---|
| `msg.debugAction` | boolean \| string | `set`/`true`/`on`/`enable`, `clear`/`false`/`off`/`disable`/`reset`, `toggle`/`flip`, `set-all`/`all-on`, `clear-all`/`all-off`/`reset-all`, `toggle-all`/`flip-all`/`invert-all`, or `write`. Case-insensitive. Omit to just report current state. |
| `msg.debugChannel` | number \| string \| array | Channel(s) the action applies to. Label match (case-insensitive) is tried first; a bit index (or digit-only string, e.g. `"2"`) is only used if no channel is named that. Array of either for multiple channels (`[2, 5]`, `["MQTT", "Errors"]`) — no bitmask math needed. Takes priority over `debugMask`. |
| `msg.debugMask` | number | Raw bitmask the action applies to (0-65535), if you already have the number. Ignored when `debugChannel` is set. |
| `msg.payload` | number | Used as the raw value for the `write` action |

This makes it straightforward to wire MQTT subscriptions, HTTP endpoints, or dashboard controls to dynamically toggle debug channels.

## License

MIT
