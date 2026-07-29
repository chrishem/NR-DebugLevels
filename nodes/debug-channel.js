module.exports = function (RED) {
    function DebugChannelNode(config) {
        RED.nodes.createNode(this, config);

        this.configNode = RED.nodes.getNode(config.debugConfig);
        this.channel = parseInt(config.channel, 10);
        this.active = (config.active !== false);
        this.console = !!config.console;
        this.tosidebar = (config.tosidebar !== false);
        this.targetType = config.targetType || 'full';
        this.complete = (config.complete !== undefined) ? config.complete : 'payload';

        var node = this;

        if (!node.configNode) {
            node.status({ fill: 'red', shape: 'ring', text: 'no config' });
            node.warn('debug: No debug-level-config selected.');
            return;
        }
        if (isNaN(node.channel) || node.channel < 0 || node.channel > 15) {
            node.status({ fill: 'red', shape: 'ring', text: 'no channel' });
            node.warn('debug: No channel selected.');
            return;
        }

        // Reflects the channel's current state immediately on deploy, not
        // just after the first message passes through. Won't live-update if
        // the channel is toggled elsewhere (Setup, a wired message) while no
        // message flows through this node — there's no context-change event
        // to react to — but it'll be correct as of deploy and as of every
        // message this node sees.
        function updateStatus() {
            if (!node.active) {
                node.status({ fill: 'grey', shape: 'ring', text: 'disabled' });
                return;
            }
            var level = node.configNode.getLevel(node);
            var on = (level & (1 << node.channel)) !== 0;
            var label = node.configNode.getLabel(node.channel);
            if (on) {
                node.status({ fill: 'green', shape: 'dot', text: label + ': on' });
            } else {
                node.status({ fill: 'grey', shape: 'ring', text: label + ': off' });
            }
        }

        updateStatus();
        node.configNode.on('level-changed', updateStatus);

        function deliver(msg, output) {
            if (node.console) {
                node.warn(output);
            }
            if (node.tosidebar) {
                var debugMsg = {
                    id: node.id,
                    z: node.z,
                    name: node.name
                };
                if (msg._path) { debugMsg.path = msg._path; }
                if (Object.prototype.hasOwnProperty.call(msg, '_msgid')) {
                    debugMsg._msgid = msg._msgid;
                }
                if (Object.prototype.hasOwnProperty.call(msg, 'topic')) {
                    debugMsg.topic = msg.topic;
                }
                debugMsg.msg = output;
                RED.comms.publish('debug', debugMsg, false);
            }
        }

        node.on('input', function (msg, send, done) {
            updateStatus();

            if (!node.active) {
                if (done) { done(); }
                return;
            }

            var level = node.configNode.getLevel(node);
            var on = (level & (1 << node.channel)) !== 0;

            if (!on) {
                if (done) { done(); }
                return;
            }

            if (node.targetType === 'full') {
                deliver(msg, msg);
                if (done) { done(); }
                return;
            }

            if (node.targetType === 'jsonata') {
                var expr;
                try {
                    expr = RED.util.prepareJSONataExpression(node.complete, node);
                } catch (err) {
                    node.error('debug: invalid JSONata expression: ' + err.message, msg);
                    if (done) { done(); }
                    return;
                }
                RED.util.evaluateJSONataExpression(expr, msg, function (err, value) {
                    if (err) {
                        node.error('debug: JSONata error: ' + err.message, msg);
                    } else {
                        deliver(msg, value);
                    }
                    if (done) { done(); }
                });
                return;
            }

            // targetType === 'msg' — a specific msg property path
            deliver(msg, RED.util.getMessageProperty(msg, node.complete));
            if (done) { done(); }
        });

        node.on('close', function () {
            node.configNode.removeListener('level-changed', updateStatus);
            node.status({});
        });
    }

    RED.nodes.registerType('debug-channel', DebugChannelNode);
};
