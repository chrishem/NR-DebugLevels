module.exports = function (RED) {
    function DebugGateNode(config) {
        RED.nodes.createNode(this, config);

        this.configNode = RED.nodes.getNode(config.debugConfig);
        this.channel = parseInt(config.channel, 10);

        var node = this;

        if (!node.configNode) {
            node.status({ fill: 'red', shape: 'ring', text: 'no config' });
            node.warn('debug-gate: No debug-level-config selected.');
            return;
        }
        if (isNaN(node.channel) || node.channel < 0 || node.channel > 15) {
            node.status({ fill: 'red', shape: 'ring', text: 'no channel' });
            node.warn('debug-gate: No channel selected.');
            return;
        }

        // Same "reflect current state on deploy, and on every message" status
        // pattern as the Debug node — see debug-channel.js for the rationale.
        function updateStatus() {
            var level = node.configNode.getLevel(node);
            var on = (level & (1 << node.channel)) !== 0;
            var label = node.configNode.getLabel(node.channel);
            if (on) {
                node.status({ fill: 'green', shape: 'dot', text: label + ': open' });
            } else {
                node.status({ fill: 'grey', shape: 'ring', text: label + ': closed' });
            }
        }

        updateStatus();
        node.configNode.on('level-changed', updateStatus);

        node.on('input', function (msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            updateStatus();

            var level = node.configNode.getLevel(node);
            var on = (level & (1 << node.channel)) !== 0;

            if (on) {
                send(msg);
            }
            if (done) { done(); }
        });

        node.on('close', function () {
            node.configNode.removeListener('level-changed', updateStatus);
            node.status({});
        });
    }

    RED.nodes.registerType('debug-gate', DebugGateNode);
};
