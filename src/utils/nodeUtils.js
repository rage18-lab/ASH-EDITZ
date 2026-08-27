
// Shoukaku v4 State enum: CONNECTING=0, CONNECTED=1, DISCONNECTING=2, DISCONNECTED=3

async function waitForNodeConnection(manager, maxWaitTime = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        const connectedNodes = [...manager.shoukaku.nodes.values()].filter(node => node.state === 1);

        if (connectedNodes.length > 0) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
}


function hasAvailableNodes(manager) {
    const availableNodes = [...manager.shoukaku.nodes.values()].filter(
        node => node.state === 1 // CONNECTED only
    );
    return availableNodes.length > 0;
}


function getAvailableNode(manager) {
    const nodes = [...manager.shoukaku.nodes.values()].filter(
        node => node.state === 1 // CONNECTED only
    );
    return nodes.length > 0 ? nodes[0] : null;
}

module.exports = {
    waitForNodeConnection,
    hasAvailableNodes,
    getAvailableNode
};

