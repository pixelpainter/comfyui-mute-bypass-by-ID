import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Comfy.RemoteControl",
    async nodeCreated(node) {
        const allowedClasses = ["RemoteControl", "RemoteControlMulti"];
        if (!allowedClasses.includes(node.comfyClass)) return;

        // -- Configuration --
        const DEBUG = false; // set true to see logs
        const SCAN_INTERVAL_MS = 2000;

        // Internal Cache
        node._nodeMap = new Map(); // idString -> { node, graph }
        node._lastScan = 0;

        function dlog(...args) { if (DEBUG) console.debug("[RemoteControl]", ...args); }
        function dwarn(...args) { if (DEBUG) console.warn("[RemoteControl]", ...args); }

        // -------------------------
        // Hydration helpers
        // -------------------------
        function tryHydrateSubgraphNode(n) {
            // Try many fallback hydration methods used across ComfyUI versions/extensions
            try {
                if (!n) return false;
                if (n.subgraph || (n.properties && n.properties.graph)) return true;
            } catch (e) {}

            try { if (n._buildSubgraph && typeof n._buildSubgraph === "function") { n._buildSubgraph(); if (n.subgraph || (n.properties && n.properties.graph)) return true; } } catch(e){}
            try { if (n.buildSubgraph && typeof n.buildSubgraph === "function") { n.buildSubgraph(); if (n.subgraph || (n.properties && n.properties.graph)) return true; } } catch(e){}
            try {
                // graph-level helper (some builds expose this)
                if (app.graph && typeof app.graph._subgraph_node_build_graph === "function") {
                    app.graph._subgraph_node_build_graph(n);
                    if (n.subgraph || (n.properties && n.properties.graph)) return true;
                }
            } catch(e){}
            try {
                const host = (n && n.graph) || app.graph;
                if (host && typeof host._subgraph_node_build_graph === "function") {
                    host._subgraph_node_build_graph(n);
                    if (n.subgraph || (n.properties && n.properties.graph)) return true;
                }
            } catch(e){}

            return false;
        }

        // -------------------------
        // Collect all graphs in the application
        // -------------------------
        function collectAllGraphs() {
            const graphs = new Set();
            try {
                if (app.graph) graphs.add(app.graph);
                if (app.canvas && app.canvas.graph) graphs.add(app.canvas.graph);
                if (app.canvas && Array.isArray(app.canvas._graph_stack)) {
                    for (const g of app.canvas._graph_stack) if (g) graphs.add(g);
                }
            } catch (e) { dwarn("base graph gather failed", e); }

            // BFS: expand by nodes that reference subgraphs
            const queue = [...graphs];
            const seen = new Set(graphs);
            while (queue.length) {
                const g = queue.shift();
                if (!g) continue;
                const nodes = g._nodes ?? g.nodes ?? [];
                for (const n of nodes) {
                    try {
                        // Common properties that contain inner graphs
                        const innerCandidates = [
                            n.subgraph,
                            n.subGraph,
                            n._subgraph,
                            n.properties && n.properties.graph,
                            n.properties && n.properties.serialized_graph,
                            (typeof n.getInnerGraph === "function" ? n.getInnerGraph() : null),
                            (typeof n.getSubgraph === "function" ? n.getSubgraph() : null),
                            n.innerGraph
                        ];
                        for (const inner of innerCandidates) {
                            if (inner && !seen.has(inner)) {
                                // try to hydrate if it's not ready
                                tryHydrateSubgraphNode(n);
                                seen.add(inner);
                                graphs.add(inner);
                                queue.push(inner);
                            }
                        }
                    } catch (e) {
                        dwarn("graph expansion inspect error for node", n, e);
                    }
                }
            }

            return [...graphs];
        }

        // -------------------------
        // Build the node map (id -> node + graph)
        // -------------------------
        function rebuildNodeMap() {
            node._nodeMap.clear();
            const graphs = collectAllGraphs();
            for (const g of graphs) {
                try {
                    // If the graph has a getNodeById helper, use it
                    if (typeof g.getNodeById === "function") {
                        // NOTICE: getNodeById requires a numeric ID when used, but we don't know IDs
                        // so we still enumerate nodes for robust discovery.
                    }
                    const list = g._nodes ?? g.nodes ?? [];
                    for (const n of list) {
                        try {
                            if (n && typeof n.id !== "undefined") {
                                node._nodeMap.set(String(n.id), { node: n, graph: g });
                            }
                        } catch (e) {
                            // ignore nodes that misbehave
                        }
                    }
                } catch (e) {
                    dwarn("error enumerating graph nodes", g, e);
                }
            }
            node._lastScan = Date.now();
            dlog("rebuildNodeMap: discovered nodes =", node._nodeMap.size);
        }

        // -------------------------
        // Determine the target mode (polarity)
        // -------------------------
        function getTargetMode(modeSelect, actionActive) {
            if (actionActive.value) return 0; // active
            return modeSelect.value ? 2 : 4; // mute(2) or bypass(4)
        }

        // -------------------------
        // Apply mode to a target (safely)
        // -------------------------
        function applyModeToTarget(targetObj, mode) {
            if (!targetObj || !targetObj.node) return false;
            const tnode = targetObj.node;
            try {
                if (tnode.mode !== mode) {
                    tnode.mode = mode;
                    if (typeof tnode.setDirtyCanvas === "function") tnode.setDirtyCanvas(true, true);
                    // If this node is inside a subgraph, mark its parent subgraph-node dirty as well:
                    try {
                        if (tnode.graph && tnode.graph._subgraph_node) {
                            tnode.graph._subgraph_node.setDirtyCanvas(true, true);
                        }
                    } catch (e) {}
                    return true;
                }
            } catch (e) {
                dwarn("applyModeToTarget error", e, targetObj);
            }
            return false;
        }

        // -------------------------
        // Enforce the current state for all widgets
        // -------------------------
        function enforceState() {
            if (!node.widgets) return;

            const actionW = node.widgets.find(w => w.name === "node_status");
            const modeW = node.widgets.find(w => w.name === "mode_select");
            if (!actionW || !modeW) return;

            const targetMode = getTargetMode(modeW, actionW);
            const possibleWidgets = ["node_id", "node_id_1", "node_id_2", "node_id_3"];

            let graphChanged = false;

            for (const name of possibleWidgets) {
                const w = node.widgets.find(x => x.name === name);
                if (!w || !w.value || w.value <= 0) continue;
                const tid = String(w.value);

                // If node not found in map, try an on-demand rebuild (quick)
                let targetObj = node._nodeMap.get(tid);
                if (!targetObj) {
                    // quick rebuild
                    rebuildNodeMap();
                    targetObj = node._nodeMap.get(tid);
                }

                if (targetObj && targetObj.node) {
                    const applied = applyModeToTarget(targetObj, targetMode);
                    if (applied) graphChanged = true;
                } else {
                    dlog("Target not found for id:", tid);
                }
            }

            if (graphChanged) {
                // Force a global canvas redraw and graph change so UI updates across levels
                try { if (app.canvas && typeof app.canvas.setDirty === "function") app.canvas.setDirty(true, true); } catch (e) {}
                try { if (app.graph && typeof app.graph.change === "function") app.graph.change(); } catch (e) {}
            }
        }

        // -------------------------
        // onDrawForeground hook: lazy rebuild + enforcement
        // -------------------------
        const onDrawForeground = node.onDrawForeground;
        node.onDrawForeground = function(ctx) {
            if (onDrawForeground) onDrawForeground.apply(this, arguments);

            const now = Date.now();
            if (now - node._lastScan > SCAN_INTERVAL_MS) {
                try {
                    rebuildNodeMap();
                } catch (e) { dwarn("rebuildNodeMap failed", e); }
            }

            enforceState();
        };

        // Hook widget clicks for instant response
        setTimeout(() => {
            const hook = (n) => {
                const w = node.widgets?.find(x => x.name === n);
                if (w) {
                    const o = w.callback;
                    w.callback = function() { if (o) o.apply(this, arguments); enforceState(); }
                }
            }
            hook("mode_select");
            hook("node_status");
            hook("node_id");
            hook("node_id_1");
            hook("node_id_2");
            hook("node_id_3");

            // initial map build + state
            try { rebuildNodeMap(); } catch (e) {}
            enforceState();
        }, 80);
    }
});
