
// lavalink-client v2 uses manager.nodeManager.nodes (not manager.shoukaku.nodes)
// Nodes expose a boolean `.connected` property (not a numeric state enum)

async function waitForNodeConnection(manager, maxWaitTime = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        const nodes = manager?.nodeManager?.nodes;
        if (nodes) {
            const connectedNodes = [...nodes.values()].filter(node => node.connected);
            if (connectedNodes.length > 0) return true;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
}


function hasAvailableNodes(manager) {
    const nodes = manager?.nodeManager?.nodes;
    if (!nodes) return false;
    return [...nodes.values()].some(node => node.connected);
}


function getAvailableNode(manager) {
    const nodes = manager?.nodeManager?.nodes;
    if (!nodes) return null;
    const connected = [...nodes.values()].filter(node => node.connected);
    return connected.length > 0 ? connected[0] : null;
}

module.exports = {
    waitForNodeConnection,
    hasAvailableNodes,
    getAvailableNode
};

