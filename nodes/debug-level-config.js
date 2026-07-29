module.exports = function (RED) {
    function DebugLevelConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.name = config.name || 'Debug Levels';
        this.contextKey = config.contextKey || 'debugLevel';
        this.contextScope = config.contextScope || 'global';
        this.contextStore = config.contextStore || '';
        this.channels = Array.isArray(config.channels) ? config.channels.slice(0, 16) : [];

        var node = this;

        // Node-RED nodes are already EventEmitters. Debug/Setup nodes can
        // subscribe to this to update their status the instant the level
        // changes, instead of only when a message happens to pass through
        // them. Raise the listener cap — it's normal for many Debug/Setup
        // nodes to share one config, well past EventEmitter's default of 10.
        node.setMaxListeners(0);

        /**
         * Resolve the context object for the configured scope.
         * Flow-scoped context requires a reference node (the calling node).
         */
        node.getContext = function (refNode) {
            if (node.contextScope === 'flow' && refNode) {
                return refNode.context().flow;
            }
            return node.context().global;
        };

        /**
         * Read the current debug level integer.
         * @param {object} [refNode] - The calling node (needed for flow scope).
         * @returns {number} 0-65535
         */
        node.getLevel = function (refNode) {
            var ctx = node.getContext(refNode);
            var args = [node.contextKey];
            if (node.contextStore) { args.push(node.contextStore); }
            return ctx.get.apply(ctx, args) || 0;
        };

        /**
         * Write a new debug level integer.
         * @param {number} level - 0-65535
         * @param {object} [refNode] - The calling node (needed for flow scope).
         */
        node.setLevel = function (level, refNode) {
            level = level & 0xFFFF;
            var ctx = node.getContext(refNode);
            var args = [node.contextKey, level];
            if (node.contextStore) { args.push(node.contextStore); }
            ctx.set.apply(ctx, args);
            node.emit('level-changed', level);
        };

        /**
         * Format level as "0000000001001010" for display.
         */
        node.formatLevel = function (level) {
            return (level & 0xFFFF).toString(2).padStart(16, '0');
        };

        /**
         * Label for a given bit index, falling back to a generic name.
         */
        node.getLabel = function (bit) {
            return node.channels[bit] || ('Channel ' + bit);
        };
    }

    RED.nodes.registerType('debug-level-config', DebugLevelConfigNode);
};
