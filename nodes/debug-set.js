module.exports = function (RED) {
    function DebugSetNode(config) {
        RED.nodes.createNode(this, config);

        this.configNode = RED.nodes.getNode(config.debugConfig);
        this.bits = Array.isArray(config.bits) ? config.bits : [];

        var node = this;

        if (!node.configNode) {
            node.status({ fill: 'red', shape: 'ring', text: 'no config' });
            node.warn('debug-set: No debug-level-config selected.');
            return;
        }

        // Refreshed on every deploy, every message this node handles, AND
        // whenever ANY node writes a new level via the shared config (Setup
        // elsewhere, a Debug node's config emits 'level-changed' on write) —
        // so this status stays live even when the change came from somewhere
        // else entirely, not just from this node's own input.
        function updateStatus(level) {
            if (level === undefined) { level = node.configNode.getLevel(node); }
            node.status({ fill: 'blue', shape: 'dot', text: node.configNode.formatLevel(level) });
        }

        // Push the checkbox-defined state live as soon as this node starts
        // (every deploy that (re)creates it) — this is the "direct checkbox"
        // control path. Wired input below is the "programmatic" path.
        (function applyConfiguredState() {
            var level = 0;
            for (var i = 0; i < node.bits.length; i++) {
                if (node.bits[i]) { level |= (1 << i); }
            }
            node.configNode.setLevel(level, node);
            updateStatus(level);
        })();

        node.configNode.on('level-changed', updateStatus);

        // Resolve msg.debugChannel (a bit index, a channel label, or an array
        // of either) into a bitmask, so callers don't have to compute masks
        // by hand. Falls back to msg.debugMask when debugChannel is absent.
        function resolveMask(msg) {
            if (msg.debugChannel === undefined) {
                return (msg.debugMask !== undefined) ? (parseInt(msg.debugMask, 10) & 0xFFFF) : 0;
            }
            var specs = Array.isArray(msg.debugChannel) ? msg.debugChannel : [msg.debugChannel];
            var mask = 0;
            specs.forEach(function (spec) {
                var bit;
                if (typeof spec === 'number') {
                    bit = spec;
                } else {
                    // Prefer an exact label match — a channel literally named
                    // "4" should win over the numeric interpretation. Only
                    // fall back to treating it as a bit index (e.g. "4" from
                    // an Inject node's "string" type, which can't send a real
                    // number) when no channel is named that.
                    bit = node.configNode.channels.findIndex(function (label) {
                        return label && label.toLowerCase() === String(spec).toLowerCase();
                    });
                    if (bit < 0 && typeof spec === 'string' && /^-?\d+$/.test(spec.trim())) {
                        bit = parseInt(spec, 10);
                    }
                }
                if (bit >= 0 && bit < 16) {
                    mask |= (1 << bit);
                } else {
                    node.warn('debug-set: unknown channel "' + spec + '"');
                }
            });
            return mask;
        }

        var ACTION_ALIASES = {
            'true': 'set', 'on': 'set', 'enable': 'set',
            'false': 'clear', 'off': 'clear', 'disable': 'clear', 'reset': 'clear',
            'toggle': 'toggle', 'flip': 'toggle',
            'set-all': 'set-all', 'all-on': 'set-all', 'enable-all': 'set-all',
            'clear-all': 'clear-all', 'all-off': 'clear-all', 'disable-all': 'clear-all', 'reset-all': 'clear-all',
            'toggle-all': 'toggle-all', 'flip-all': 'toggle-all', 'invert-all': 'toggle-all',
            'set': 'set', 'clear': 'clear', 'write': 'write'
        };

        // Accepts a real boolean or any case of the string/alias forms
        // documented in the help text, and normalizes to the five internal
        // action names used by the switch below.
        function normalizeAction(raw) {
            if (typeof raw === 'boolean') { return raw ? 'set' : 'clear'; }
            return ACTION_ALIASES[String(raw).toLowerCase()];
        }

        node.on('input', function (msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            var level = node.configNode.getLevel(node);

            if (msg.debugAction !== undefined) {
                var action = normalizeAction(msg.debugAction);

                // Only resolve a mask for actions that actually use one —
                // the "-all" actions apply to the whole 16-bit value and
                // would otherwise trigger a spurious "unknown channel"
                // warning if msg.debugChannel/debugMask happened to be set
                // (e.g. left over from a previous message) but unusable.
                switch (action) {
                    case 'set':
                        level |= resolveMask(msg);
                        break;
                    case 'clear':
                        level &= ~resolveMask(msg);
                        break;
                    case 'toggle':
                        level ^= resolveMask(msg);
                        break;
                    case 'set-all':
                        level = 0xFFFF;
                        break;
                    case 'clear-all':
                        level = 0x00;
                        break;
                    case 'toggle-all':
                        level ^= 0xFFFF;
                        break;
                    case 'write':
                        level = (msg.payload !== undefined) ? (parseInt(msg.payload, 10) & 0xFFFF) : resolveMask(msg);
                        break;
                    default:
                        node.warn('debug-set: Unknown action "' + msg.debugAction + '"');
                }

                node.configNode.setLevel(level, node);
                level = node.configNode.getLevel(node);
            }

            var bits = node.configNode.formatLevel(level);
            updateStatus(level);

            msg.debugLevel = level;
            msg.debugBits = bits;
            msg.debugLabels = node.configNode.channels.slice();
            msg.debugActive = [];
            for (var i = 0; i < 16; i++) {
                if (level & (1 << i)) {
                    msg.debugActive.push(node.configNode.getLabel(i));
                }
            }
            send(msg);

            if (done) { done(); }
        });

        node.on('close', function () {
            node.configNode.removeListener('level-changed', updateStatus);
            node.status({});
        });
    }

    RED.nodes.registerType('debug-set', DebugSetNode);
};
