import { app } from "../../scripts/app.js";

// =========================================================
// 1. CSS & STYLING
// =========================================================
const REMOTE_CSS = `
.remote-picker-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 9999;
    display: flex; align-items: center; justify-content: center;
}
.remote-picker-modal {
    background: #1e1e1e; border: 1px solid #444; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    width: 500px; max-height: 80vh; display: flex; flex-direction: column;
    border-radius: 6px; font-family: sans-serif; overflow: hidden;
}
.remote-picker-header {
    padding: 12px; border-bottom: 1px solid #333; background: #252525;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.remote-picker-search {
    width: 100%; background: #111; border: 1px solid #444; color: #eee;
    padding: 8px 12px; border-radius: 4px; font-size: 14px; outline: none;
    box-sizing: border-box; 
}
.remote-picker-search:focus { border-color: #66afef; background: #000; }
.remote-picker-list {
    flex: 1; overflow-y: auto; padding: 0; margin: 0; list-style: none;
}
.remote-group-header {
    padding: 10px 15px; background: #2a2a2a; border-bottom: 1px solid #333;
    color: #ddd; font-weight: bold; font-size: 13px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    transition: background 0.1s;
    user-select: none;
}
.remote-group-header:hover { background: #333; color: #fff; }
.remote-group-header .arrow { font-size: 10px; color: #777; transition: transform 0.2s; }
.remote-group-header.active { background: #333; border-left: 3px solid #66afef; }
.remote-group-header.active .arrow { transform: rotate(90deg); color: #66afef; }
.remote-group-content { 
    background: #151515; display: none; padding: 5px 0; 
}
.remote-group-content.open { display: block; }
.remote-picker-item {
    padding: 6px 15px 6px 25px; border-bottom: 1px solid #222; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
}
.remote-picker-item:hover { background: #2a3a4a; }
.remote-picker-item.selected { background: #2a4a6a; }
.remote-item-title { color: #ccc; font-size: 13px; }
.remote-item-meta { font-size: 11px; color: #555; font-family: monospace; }
.remote-picker-list::-webkit-scrollbar { width: 8px; }
.remote-picker-list::-webkit-scrollbar-track { background: #111; }
.remote-picker-list::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
`;

const styleEl = document.createElement("style");
styleEl.innerHTML = REMOTE_CSS;
document.head.appendChild(styleEl);

if (CanvasRenderingContext2D.prototype.roundRect === undefined) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        this.beginPath(); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
        this.closePath(); return this;
    };
}

// =========================================================
// 2. GRAPH DATA HELPERS
// =========================================================

function _rcGetInnerGraph(n) {
    if (!n) return null;
    return n.getInnerGraph ? n.getInnerGraph() : (n.innerGraph || n.subgraph || null);
}

function _rcGetNode(graph, id) {
    if (graph && graph.getNodeById) {
        const n = graph.getNodeById(id);
        if(n) return n;
    }
    const nodes = graph ? (graph._nodes || graph.nodes) : null;
    if (nodes && Array.isArray(nodes)) {
        return nodes.find(n => n.id == id);
    }
    if (app.graph && app.graph.getNodeById) {
        return app.graph.getNodeById(id);
    }
    return null;
}

function _rcNormalizeLink(l) {
    if (!l) return null;
    if (Array.isArray(l)) {
        return {
            id: l[0],
            origin_id: l[1],
            origin_slot: l[2],
            target_id: l[3],
            target_slot: l[4],
            type: l[5]
        };
    }
    return l;
}

function _rcFindLinkInGraph(graph, linkId) {
    if (!graph) return null;
    if (graph.links && !Array.isArray(graph.links) && graph.links[linkId]) {
        return _rcNormalizeLink(graph.links[linkId]);
    }
    if (graph.links && Array.isArray(graph.links)) {
        const l = graph.links.find(x => x[0] == linkId);
        if(l) return _rcNormalizeLink(l);
    }
    if (app.graph && app.graph.links && app.graph.links[linkId]) {
        return _rcNormalizeLink(app.graph.links[linkId]);
    }
    return null;
}

// HELPER: Fuzzy Name Matcher (Ignores Case, Spaces, Underscores)
function _rcNamesMatch(nameA, nameB) {
    if (!nameA || !nameB) return false;
    const cleanA = String(nameA).toLowerCase().replace(/[\s_]/g, "");
    const cleanB = String(nameB).toLowerCase().replace(/[\s_]/g, "");
    return cleanA === cleanB;
}

// =========================================================
// 3. RECURSIVE CONNECTION TRACER
// =========================================================

function _rcLeadsToRemote(graph, node, outputIndex, visited = new Set()) {
    if (!node || !node.outputs || !node.outputs[outputIndex]) return false;
    
    const outSlot = node.outputs[outputIndex];
    if (!outSlot.links || outSlot.links.length === 0) return false;

    for (const linkId of outSlot.links) {
        if (visited.has(linkId)) continue;
        visited.add(linkId);

        const link = _rcFindLinkInGraph(graph, linkId);
        if (!link) continue;

        const targetNode = _rcGetNode(graph, link.target_id);
        if (!targetNode) continue;

        // CHECK 1: Is this a Remote Control Node?
        const cc = (targetNode.comfyClass || "").toLowerCase();
        const tt = (targetNode.title || "").toLowerCase();
        if (cc.startsWith("remote") || tt.startsWith("remote")) {
            if (targetNode.inputs && targetNode.inputs[link.target_slot]) {
                const inpName = (targetNode.inputs[link.target_slot].name || "").toLowerCase();
                if (inpName.includes("target")) return true;
            }
        }

        // CHECK 2: Reroute Node
        if (targetNode.type === "Reroute") {
            if (_rcLeadsToRemote(graph, targetNode, 0, visited)) return true;
        }

        // CHECK 3: Subgraph / Group
        const inner = _rcGetInnerGraph(targetNode);
        if (inner) {
            const inputIdx = link.target_slot;
            const innerNodes = inner._nodes || inner.nodes || [];
            const groupInput = innerNodes.find(n => n.type === "GroupInput" || n.type === "Primitive");
            
            if (groupInput) {
                if (_rcLeadsToRemote(inner, groupInput, inputIdx, new Set())) return true;
            }
        }
    }
    return false;
}

// =========================================================
// 4. UI COMPONENTS
// =========================================================

// Robust node resolution: always anchor at the TRUE root graph (app.graph
// changes as the user navigates into subgraphs, which silently breaks chain-key
// walks). Root → chain walk (tier 1) → deep leaf search (tier 2) → identity
// match (tier 3), with a short grace window.
function _rcRootGraph() {
    try {
        const stack = app.canvas && app.canvas._graph_stack;
        if (stack && stack.length > 0 && stack[0]) return stack[0];
    } catch (e) {}
    return app.graph;
}

function _rcWalkChain(key) {
    if (!key) return null;
    const parts = String(key).split(":");
    let g = _rcRootGraph();
    let node = null;
    for (const pid of parts) {
        if (!g) return null;
        node = _rcGetNode(g, parseInt(pid));
        if (!node) return null;
        g = _rcGetInnerGraph(node);
    }
    return node;
}

function _rcDeepFindLeaf(leafId) {
    if (isNaN(leafId)) return null;
    const root = _rcRootGraph();
    const rootNode = _rcGetNode(root, leafId);
    if (rootNode) return { node: rootNode, key: String(leafId) };
    const search = (graph, chain) => {
        const nodes = graph ? (graph._nodes || graph.nodes || []) : [];
        for (const n of nodes) {
            if (!n || !n.id) continue;
            if (n.graph !== undefined && n.graph !== graph) continue; // ghost filter
            const inner = _rcGetInnerGraph(n);
            if (inner) {
                const found = _rcGetNode(inner, leafId);
                if (found) return { node: found, key: [...chain, n.id, leafId].join(":") };
                const deeper = search(inner, [...chain, n.id]);
                if (deeper) return deeper;
            }
        }
        return null;
    };
    return search(root, []);
}

function _rcMatchByIdentity(wantType, wantTitle, predicate) {
    const root = _rcRootGraph();
    let best = null, bestScore = -1;
    const search = (graph, chain) => {
        const nodes = graph ? (graph._nodes || graph.nodes || []) : [];
        for (const n of nodes) {
            if (!n || !n.id) continue;
            if (n.graph !== undefined && n.graph !== graph) continue; // ghost filter
            if (!predicate || predicate(n)) {
                const nType = n.comfyClass || n.type;
                if (!wantType || nType === wantType || n.type === wantType) {
                    let score = 1;
                    if (wantTitle && (n.title || n.type) === wantTitle) score += 2;
                    if (score > bestScore) { bestScore = score; best = { node: n, key: [...chain, n.id].join(":") }; }
                }
            }
            const inner = _rcGetInnerGraph(n);
            if (inner) search(inner, [...chain, n.id]);
        }
    };
    search(root, []);
    return best;
}

const _RC_GRACE_MS = 3000;

// Self-healing lookup. ref = { key, type?, title?, _miss? }. Mutates ref: rewrites
// key on relocation, backfills type/title, grace window before a genuine miss.
function _rcLookupRef(ref, predicate) {
    if (!ref || !ref.key) return null;
    let node = _rcWalkChain(ref.key);
    if (node) {
        ref._miss = 0;
        if (!ref.type) ref.type = node.comfyClass || node.type;
        if (!ref.title) ref.title = node.title || node.type;
        return node;
    }
    const leafId = parseInt(String(ref.key).split(":").pop());
    const byLeaf = _rcDeepFindLeaf(leafId);
    if (byLeaf && (!predicate || predicate(byLeaf.node))) {
        ref.key = byLeaf.key; ref._miss = 0;
        if (!ref.type) ref.type = byLeaf.node.comfyClass || byLeaf.node.type;
        if (!ref.title) ref.title = byLeaf.node.title || byLeaf.node.type;
        return byLeaf.node;
    }
    if (ref.type) {
        const byId = _rcMatchByIdentity(ref.type, ref.title, predicate);
        if (byId) { ref.key = byId.key; ref._miss = 0; return byId.node; }
    }
    if (!ref._miss) ref._miss = performance.now();
    return null;
}

// Back-compat entry: bare string → node|null, root-anchored with deep-leaf fallback.
function _rcFindNodeGlobal(key) {
    if (!key) return null;
    const node = _rcWalkChain(key);
    if (node) return node;
    const byLeaf = _rcDeepFindLeaf(parseInt(String(key).split(":").pop()));
    return byLeaf ? byLeaf.node : null;
}

// Rich display info for a chain key: leaf node id, resolved title, and the
// breadcrumb of subgraph titles leading to it ("" when at the root).
function _rcKeyInfo(key) {
    if (!key) return null;
    const parts = String(key).split(":");
    const leafId = parts[parts.length - 1];
    let resolvedKey = String(key);
    let g = _rcRootGraph();
    const pathNames = [];
    let node = null, broke = false;
    for (let i = 0; i < parts.length; i++) {
        if (!g) { broke = true; break; }
        node = _rcGetNode(g, parseInt(parts[i]));
        if (!node) { broke = true; break; }
        if (i < parts.length - 1) pathNames.push(node.title || node.type || ("Node " + node.id));
        g = _rcGetInnerGraph(node);
    }
    if (broke || !node) {
        const bl = _rcDeepFindLeaf(parseInt(leafId));
        node = bl ? bl.node : null;
        if (bl) resolvedKey = bl.key;   // relocated → current chain key
    }
    return {
        id: leafId,
        key: resolvedKey,               // e.g. "789" (root) or "89:789" (subgraph)
        title: node ? (node.title || node.type || ("Node " + node.id)) : null,
        path: pathNames.join(" › "),
        found: !!node,
    };
}

// Resolve a target picker's key with self-healing; rewrites the widget value if
// the node relocated. Metadata cached in node.properties._rcTargetMeta.
function _rcResolveTargetWidget(node, w) {
    if (!w || !w.value) return null;
    if (!node.properties) node.properties = {};
    if (!node.properties._rcTargetMeta) node.properties._rcTargetMeta = {};
    const store = node.properties._rcTargetMeta;
    const meta = store[w.value] || {};
    const ref = { key: w.value, type: meta.type, title: meta.title, _miss: meta._miss || 0 };
    const target = _rcLookupRef(ref, null);
    store[w.value] = { type: ref.type, title: ref.title, _miss: ref._miss };
    if (target && ref.key !== w.value) {
        store[ref.key] = store[w.value];
        delete store[w.value];
        w.value = ref.key;
        if (w.callback) { try { w.callback(ref.key); } catch (e) {} }
    }
    return target;
}

function _rcTraverseGlobal(graph, chain, pathLabel, outList) {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (!n.id) continue;
        if (n.graph !== undefined && n.graph !== graph) continue; // ghost filter
        const title = n.title || n.type || ("Node " + n.id);
        const myChain = [...chain, n.id];
        const uniqueKey = myChain.join(":");
        const inner = _rcGetInnerGraph(n);
        
        const t = (n.type || "").toLowerCase();
        const ignore = t === "primitive" || t === "reroute" || t.includes("note") || t.startsWith("set") || t.startsWith("get");
        
        if (!inner && !ignore) {
            outList.push({ node: n, title: title, path: pathLabel, key: uniqueKey });
        }
        if (inner) {
            const nextPath = (pathLabel === "Root") ? title : `${pathLabel} > ${title}`;
            _rcTraverseGlobal(inner, myChain, nextPath, outList);
        }
    }
}

// Escape user-controlled strings (node titles, subgraph names) before they are
// placed into innerHTML — prevents HTML/script injection via shared workflows.
function _rcEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
    ));
}

function _rcShowPickerModal(currentVal, onSelect) {
    try { if (window._rcPickerClosingUntil && performance.now() < window._rcPickerClosingUntil) return; } catch(e) {}

    const entries = [];
    _rcTraverseGlobal(app.graph, [], "Root", entries);
    
    const groups = {};
    for (const e of entries) {
        if (!groups[e.path]) groups[e.path] = [];
        groups[e.path].push(e);
    }
    const paths = Object.keys(groups).sort((a,b) => a==="Root" ? -1 : a.localeCompare(b));

    const overlay = document.createElement("div"); overlay.className = "remote-picker-overlay";
    const modal = document.createElement("div"); modal.className = "remote-picker-modal";
    const header = document.createElement("div"); header.className = "remote-picker-header";
    const search = document.createElement("input"); search.className = "remote-picker-search"; search.placeholder = "Search...";
    const list = document.createElement("div"); list.className = "remote-picker-list";
    
    header.appendChild(search); modal.appendChild(header); modal.appendChild(list); overlay.appendChild(modal);
    
    let activeGroup = null;
    if (currentVal) {
        const found = entries.find(e => e.key === currentVal);
        if (found) activeGroup = found.path;
    }

    const render = () => {
        list.innerHTML = "";
        const term = search.value.toLowerCase().trim();
        if (term) {
            const hits = entries.filter(e => e.title.toLowerCase().includes(term) || String(e.node.id).includes(term));
            if (hits.length === 0) list.innerHTML = `<div style="padding:20px;text-align:center;color:#666">No results</div>`;
            else hits.forEach(e => addItem(e, list));
            return;
        }
        for (const p of paths) {
            const grp = document.createElement("div"); grp.className = "remote-group-header";
            if (p === activeGroup) grp.classList.add("active");
            grp.innerHTML = `<span>${_rcEsc(p)}</span><span class="arrow">${p===activeGroup?'▼':'▶'}</span>`;
            grp.onclick = () => { activeGroup = (activeGroup===p ? null : p); render(); };
            const content = document.createElement("div"); content.className = "remote-group-content";
            if (p === activeGroup) content.classList.add("open");
            groups[p].sort((a,b)=>a.title.localeCompare(b.title));
            groups[p].forEach(e => addItem(e, content));
            list.appendChild(grp); list.appendChild(content);
        }
    };

    const addItem = (entry, parent) => {
        const item = document.createElement("div"); item.className = "remote-picker-item";
        if (entry.key === currentVal) item.classList.add("selected");
        item.innerHTML = `<div class="remote-item-title">${_rcEsc(entry.title)}</div><div class="remote-item-meta">[${_rcEsc(entry.key)}] · ${_rcEsc(entry.node.type||entry.node.comfyClass||"")}</div>`;
        item.onclick = (e) => {
    e.preventDefault();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    e.stopPropagation();
    try { window._rcPickerClosingUntil = performance.now() + 250; } catch(err) {}

    try {
        onSelect(entry.key);
    } catch(err) {
        console.error("Remote picker onSelect error (ignored so menu can close):", err);
    } finally {
        setTimeout(()=>{ try{ document.body.removeChild(overlay);}catch(err2){} }, 0);
    }
};
        parent.appendChild(item);
    };

    search.oninput = render;
    overlay.onclick = (e) => { if(e.target===overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
    render();
    setTimeout(()=>search.focus(), 50);
}

// =========================================================
// 5. WIDGET TRANSFORMERS
// =========================================================

const _rcReplaceWithPicker = (node, widget) => {
    if (widget.type === "REMOTE_PICKER") return;
    if (widget.type === "RC_STACKER_MODE" || widget._rcModeSkin || widget.name === "stacker_mode") return;

    const newW = {
        name: widget.name,
        label: (widget.label ?? (widget.options && widget.options.label)),
        type: "REMOTE_PICKER",
        value: widget.value,
        options: widget.options || { serialize: true },
        y: widget.y,
        callback: widget.callback,
        hidden: widget.hidden || false,
        computeSize: function() { return this.hidden ? [0, -4] : [0, 26]; },
    };

    newW.draw = function(ctx, node, wWidth, y, wHeight) {
        if (this.hidden) { this._hitY = undefined; this._xHit = null; return; }
        // Display label should follow user renames (ComfyUI typically stores that in widget.label)
        // while internal behavior should continue to rely on widget.name.
        let label = (this.label ?? this.name).split(":").pop().trim();
        const lLow = label.toLowerCase();

        // Label Mapping (ONLY when user hasn't renamed the label)
        const map = {
            "target_node_a": "target_a", "target_node_b": "target_b",
            "target_node_a1": "target_a1", "target_node_a2": "target_a2",
            "target_node_b1": "target_b1", "target_node_b2": "target_b2",
            "target_node": "target",
            "target_node_1": "target_1", "target_node_2": "target_2", "target_node_3": "target_3"
        };
        if (!this.label && map[lLow]) label = map[lLow];

        const isPrim = (node.type === "Primitive" || node.comfyClass === "PrimitiveNode");
        const margin = isPrim ? 5 : 14.5;
        const H = 22;
        const boxY = y + (wHeight - H)/2;
        const textY = boxY + H/2 + 1;

        // Right-side ✕. Single: centred on the row. A/B: on the A row, near the
        // gap toward the B pill (kept within the A row's clickable range so the
        // click routes here). The delete handler removes the whole pair for A/B.
        const _kind = _rcRemoteKind(node);
        const singleX = !!node._rcRowX && _kind === "single";
        const pairX = !!node._rcPairX && _kind === "ab";
        const isARow = pairX && !this.name.includes("_B");
        const reserve = singleX || pairX;
        const xArm = 5, gap = 5;                          // +2px padding from edge
        const xCx = wWidth - gap - xArm;                 // ✕ centre
        const pillRight = reserve ? (xCx - xArm - gap) : (wWidth - margin);
        const pillW = pillRight - margin;

        ctx.fillStyle = "#222"; ctx.beginPath();
        ctx.roundRect(margin, boxY, pillW, H, H/2);
        ctx.fill(); ctx.strokeStyle = "#666"; ctx.lineWidth = 1; ctx.stroke();

        ctx.fillStyle = "#888"; ctx.font = "12px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, margin+10, textY);

        let valTxt = "None";
        ctx.fillStyle = "#555";
        if(this.value) {
            const info = _rcKeyInfo(this.value);
            if(info && info.found) {
                valTxt = `${info.title} [${info.key}]`;
                ctx.fillStyle = "#DDD";
            } else {
                valTxt = "Missing";
                ctx.fillStyle = "#c08080";
            }
        }
        ctx.textAlign = "right";
        // Truncate from the left (keep the [id] visible) so it never overruns the label.
        const availW = pillW - ctx.measureText(label).width - 26;
        let disp = valTxt;
        if (ctx.measureText(disp).width > availW && availW > 20) {
            while (disp.length > 4 && ctx.measureText("… " + disp).width > availW) disp = disp.slice(1);
            disp = "… " + disp;
        }
        ctx.fillText(disp, margin + pillW - 12, textY);

        this._lastBoxY = boxY;
        this._xHit = null;
        if (singleX) {
            const cy = boxY + H / 2;
            ctx.strokeStyle = "#a06868"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(xCx - xArm, cy - xArm); ctx.lineTo(xCx + xArm, cy + xArm);
            ctx.moveTo(xCx + xArm, cy - xArm); ctx.lineTo(xCx - xArm, cy + xArm);
            ctx.stroke();
            this._xHit = { x: xCx - xArm - 2, y: boxY, w: xArm * 2 + 4, h: wHeight };
        } else if (pairX) {
            // Both A and B rows carry the delete-pair hit column; only the A row
            // draws the ✕, centred vertically in the gap between the two pills.
            this._xHit = { x: xCx - xArm - 2, y: boxY, w: xArm * 2 + 4, h: wHeight };
            if (isARow) {
                // Centre the ✕ between this A pill and its B pill, using the B
                // row's actually-drawn position (robust to wHeight differences).
                const bName = this.name.replace(/_A(\d*)$/, "_B$1");
                const bW = (node.widgets || []).find(w => w.name === bName && w.type === "REMOTE_PICKER");
                const bBoxY = (bW && typeof bW._lastBoxY === "number") ? bW._lastBoxY : (boxY + H + 8);
                const cy = (boxY + H / 2 + bBoxY + H / 2) / 2;
                ctx.strokeStyle = "#a06868"; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(xCx - xArm, cy - xArm); ctx.lineTo(xCx + xArm, cy + xArm);
                ctx.moveTo(xCx + xArm, cy - xArm); ctx.lineTo(xCx - xArm, cy + xArm);
                ctx.stroke();
            }
        }
        this._hitY = boxY; this._hitH = wHeight;
    };

    newW.mouse = function(e, pos, n) {
        if (this.hidden) return false;
        try { if (window._rcPickerClosingUntil && performance.now() < window._rcPickerClosingUntil) return true; } catch(e) {}

        const t = e && e.type;

        // Allow right-click to reach widget context menu
        if (e && e.button === 2) return false;

        // Open picker on pointerdown/mousedown/click (linked LegacyWidgets often dispatch click)
        if(t === "pointerdown" || t === "mousedown" || t === "click") {
            // Per-row delete (growable nodes)
            if (this._xHit && pos && pos[0] >= this._xHit.x && pos[0] <= this._xHit.x + this._xHit.w) {
                _rcDeleteRow(n, _rcRemoteKind(n), _rcRowIndexOf(n, this));
                if(e.stopImmediatePropagation) e.stopImmediatePropagation();
                if(e.stopPropagation) e.stopPropagation();
                return true;
            }
            _rcShowPickerModal(this.value, (k)=>{
                this.value = k;
                if(this.callback) { try { this.callback(k); } catch(err) { console.error('Remote picker callback error:', err); } }
                n.setDirtyCanvas(true, true);
            });
            if(e.stopImmediatePropagation) e.stopImmediatePropagation();
            if(e.stopPropagation) e.stopPropagation();
            return true;
        }

        // Consume mouseup so the default value editor doesn't open
        if(t === "mouseup") {
            if(e.stopImmediatePropagation) e.stopImmediatePropagation();
            if(e.stopPropagation) e.stopPropagation();
            return true;
        }

        return false;
    };

// Some linked/promoted widgets are wrapped as LegacyWidgets and trigger onClick instead of mouse events.
newW.onClick = function(pos, n) {
        if (this.hidden) return false;
        try { if (window._rcPickerClosingUntil && performance.now() < window._rcPickerClosingUntil) return true; } catch(e) {}

    _rcShowPickerModal(this.value, (k)=>{
        this.value = k;
        if(this.callback) { try { this.callback(k); } catch(err) { console.error('Remote picker callback error:', err); } }
        n.setDirtyCanvas(true, true);
    });
    return true;
};


    newW.getOptions = function(n) { return [{content: "Convert to Input", callback: () => { if(n.convertWidgetToInput) n.convertWidgetToInput(newW); }}]; };

    const idx = node.widgets.indexOf(widget);
    node.widgets[idx] = newW;
    
    if(!node._rcClickFixed) {
        const oldDown = node.onMouseDown;
        node.onMouseDown = function(e, pos, c) {
            if(this.widgets) {
                for(const w of this.widgets) {
                    if((w.type === "REMOTE_PICKER" || w.type === "RC_ADD") && w._hitY !== undefined) {
                        if(pos[1] >= w._hitY && pos[1] <= w._hitY + w._hitH) {
                            if (typeof w.mouse === "function") { const r = w.mouse(e, pos, this); if (r) return true; }
                            else return true;
                        }
                    }
                }
            }
            if(oldDown) return oldDown.apply(this, arguments);
        };
        node._rcClickFixed = true;
    }
};

// Draw a single toggle "pill" row at a given y. kind decides text/colour.
function _rcDrawToggleAt(ctx, node, wWidth, y, wHeight, kind, value, label) {
    const isPrim = (node.type === "Primitive" || node.comfyClass === "PrimitiveNode");
    const margin = isPrim ? 5 : 14.5;
    const H = 22;
    const boxY = y + (wHeight - H) / 2;
    const textY = boxY + H / 2 + 1;

    ctx.fillStyle = "#222"; ctx.beginPath();
    ctx.roundRect(margin, boxY, wWidth - margin * 2, H, H / 2);
    ctx.fill(); ctx.strokeStyle = "#666"; ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = "#888"; ctx.font = "12px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, margin + 10, textY);

    let valStr = String(value), dot = "#777";
    if (kind === "global_enable") {
        const on = !!value;
        if (!on) { valStr = "User"; dot = "#66afef"; }
        else {
            const mW = (node.widgets || []).find(w => (w.name || "") === "global_mode");
            const isMute = mW ? !!mW.value : false;
            valStr = isMute ? "Global Mute" : "Global Bypass";
            dot = isMute ? "#8a8a8a" : "#a080c0";
        }
    } else if (kind === "global_mode") {
        valStr = value ? "Mute" : "Bypass";
        dot = value ? "#8a8a8a" : "#a080c0";
    } else if (kind === "node_status") {
        const active = (String(value) === "true" || String(value).toLowerCase() === "active");
        if (active) { valStr = "Active"; dot = "#66afef"; }
        else {
            const modeW = (node.widgets || []).find(w => (w.name || "") === "mode_select");
            const isMute = modeW ? !!modeW.value : false;
            valStr = isMute ? "Muted" : "Bypassed";
            dot = isMute ? "#8a8a8a" : "#a080c0";   // mute grey / bypass purple
        }
    } else if (kind === "suppress_as_status") {
        const on = (value == null) ? true : !!value;        // suppression on
        if (!on) { valStr = "Active"; dot = "#66afef"; }
        else {
            const modeW = (node.widgets || []).find(w => (w.name || "") === "mode_select");
            const isMute = modeW ? !!modeW.value : false;
            valStr = isMute ? "Muted" : "Bypassed";
            dot = isMute ? "#8a8a8a" : "#a080c0";
        }
    } else if (kind === "switch_status") {
        const suppressW = (node.widgets || []).find(w => (w.name || "").toLowerCase().includes("suppress"));
        const modeW = (node.widgets || []).find(w => (w.name || "") === "mode_select");
        const suppressOn = suppressW ? ((suppressW.value == null) ? true : !!suppressW.value) : true;
        const isMute = modeW ? !!modeW.value : false;
        const supLabel = isMute ? "Muted" : "Bypassed";
        const sideA = !!value;
        if (!suppressOn) { valStr = "A Active · B Active"; }
        else { valStr = sideA ? ("A Active · B " + supLabel) : ("A " + supLabel + " · B Active"); }
        dot = "#66afef";   // side indicator — constant colour
    } else if (kind === "mode_select") {
        valStr = value ? "Mute" : "Bypass";
        dot = value ? "#8a8a8a" : "#a080c0";   // mute grey / bypass purple
    }

    const dotX = wWidth - margin - 10;
    ctx.beginPath(); ctx.arc(dotX - 5, textY, 4, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill();
    ctx.textAlign = "right"; ctx.fillStyle = "#DDD"; ctx.fillText(valStr, dotX - 15, textY);
}

const _rcFixToggleDraw = (w) => {
    if(w._rcFixed) return;
    w.draw = function(ctx, node, wWidth, y, wHeight) {
        let label = (this.label ?? this.name).split(":").pop().trim();
        const _internal = (this.name || "").split(":").pop().trim().toLowerCase();
        const lBase = _internal.replace(/_\d+$/, "");
        let kind = lBase;
        if (lBase === "suppress_enable" || lBase === "suppress") kind = "suppress_as_status";
        _rcDrawToggleAt(ctx, node, wWidth, y, wHeight, kind, this.value, label);
    };
    w._rcFixed = true;
};

// A/B: draw the suppression toggle INSIDE the switch_status widget (double
// height) so no extra widget is inserted into node.widgets. The real
// suppress_enable widget stays hidden in its native array slot, which keeps
// ComfyUI's index-based widgets_values serialization correct (backward compat).
function _rcSetupABControls(node) {
    if (node._rcABControlsSet) return;
    const switchW = node.widgets.find(w => w.name === "switch_status");
    const supW = node.widgets.find(w => (w.name || "").toLowerCase().includes("suppress"));
    if (!switchW || !supW) return;
    if (supW.value == null) supW.value = true;
    // node_status is a NATIVE toggle (ComfyUI handles its clicks) — we only give
    // it the node_status label/verbiage and enforce hook, then move it visually
    // to sit right under switch_status. widgets_values order is preserved on save
    // by node.onSerialize (declaration order), so backward compatibility holds.
    supW.label = "node_status";
    _rcFixToggleDraw(supW);
    if (!supW._hooked) {
        const cb = supW.callback;
        supW.callback = function (v) { if (cb) cb(v); _rcEnforceLogic(node); };
        supW._hooked = true;
    }
    const si = node.widgets.indexOf(switchW);
    const pi = node.widgets.indexOf(supW);
    if (si >= 0 && pi >= 0 && pi !== si + 1) {
        node.widgets.splice(pi, 1);
        node.widgets.splice(node.widgets.indexOf(switchW) + 1, 0, supW);
    }
    node._rcABControlsSet = true;
}

// ---------------------------------------------------------
// Growable rows: reveal/hide + "+ Node"/"+ Pair" + per-row ✕
// ---------------------------------------------------------
const _RC_MAX_TARGETS = 20;
const _RC_MAX_PAIRS = 10;

function _rcRemoteKind(node) {
    const cc = (node.comfyClass || "").toLowerCase();
    if (cc === "remotecontrol") return "single";
    if (cc === "remoteswitch") return "ab";
    if (cc === "remotecontrolmulti") return "triple";
    if (cc === "remoteswitchmulti") return "aabb";
    return null;
}

function _rcTargetPickers(node) {
    return (node.widgets || []).filter(w => w.type === "REMOTE_PICKER");
}

function _rcApplyReveal(node, kind) {
    if (!node.properties) node.properties = {};
    const pickers = _rcTargetPickers(node);
    let revealed = node.properties._rcRevealed;
    if (!Number.isInteger(revealed)) revealed = 0;
    if (kind === "ab") {
        const pairCount = Math.floor(pickers.length / 2);
        let highest = 0;
        for (let p = 0; p < pairCount; p++) {
            const a = pickers[2 * p], b = pickers[2 * p + 1];
            if ((a && a.value) || (b && b.value)) highest = p + 1;
        }
        revealed = Math.min(Math.max(1, revealed, highest), pairCount || 1);
        node.properties._rcRevealed = revealed;
        pickers.forEach((w, i) => { w.hidden = (Math.floor(i / 2) >= revealed); });
        node._rcRevealInfo = { revealed, max: pairCount || _RC_MAX_PAIRS, per: 2 };
    } else {
        let highest = 0;
        pickers.forEach((w, i) => { if (w.value) highest = i + 1; });
        revealed = Math.min(Math.max(1, revealed, highest), pickers.length || 1);
        node.properties._rcRevealed = revealed;
        pickers.forEach((w, i) => { w.hidden = (i >= revealed); });
        node._rcRevealInfo = { revealed, max: pickers.length || _RC_MAX_TARGETS, per: 1 };
    }
    return node._rcRevealInfo;
}

function _rcRowIndexOf(node, w) {
    const pickers = _rcTargetPickers(node);
    const idx = pickers.indexOf(w);
    if (idx < 0) return -1;
    return (_rcRemoteKind(node) === "ab") ? Math.floor(idx / 2) : idx;
}

function _rcRevealAdd(node, kind, delta) {
    if (!node.properties) node.properties = {};
    const info = node._rcRevealInfo || _rcApplyReveal(node, kind);
    const r = Math.max(1, Math.min(info.max, (info.revealed || 1) + delta));
    if (delta < 0) {
        const pickers = _rcTargetPickers(node);
        const clear = (w) => { if (w) { w.value = ""; if (w.callback) { try { w.callback(""); } catch (e) {} } } };
        if (kind === "ab") { clear(pickers[2 * r]); clear(pickers[2 * r + 1]); }
        else { clear(pickers[r]); }
    }
    node.properties._rcRevealed = r;
    _rcApplyReveal(node, kind);
    try { node.setSize([node.size[0], node.computeSize()[1]]); } catch (e) {}
    _rcEnforceLogic(node);
    if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
}

// Delete a row/pair, shifting values up to close the gap (never a blank row).
// The single remaining row is cleared in place.
function _rcDeleteRow(node, kind, rowIndex) {
    if (rowIndex < 0) return;
    const pickers = _rcTargetPickers(node);
    const per = (kind === "ab") ? 2 : 1;
    const info = node._rcRevealInfo || _rcApplyReveal(node, kind);
    const revealed = info.revealed;
    const clear = (w) => { if (w) { w.value = ""; if (w.callback) { try { w.callback(""); } catch (e) {} } } };
    const setVal = (w, v) => { if (w) { w.value = v; if (w.callback) { try { w.callback(v); } catch (e) {} } } };
    if (revealed <= 1) {
        for (let s = 0; s < per; s++) clear(pickers[s]);
    } else {
        for (let r = rowIndex; r < revealed - 1; r++) {
            for (let s = 0; s < per; s++) setVal(pickers[r * per + s], pickers[(r + 1) * per + s] ? pickers[(r + 1) * per + s].value : "");
        }
        for (let s = 0; s < per; s++) clear(pickers[(revealed - 1) * per + s]);
        node.properties._rcRevealed = revealed - 1;
    }
    _rcApplyReveal(node, kind);
    try { node.setSize([node.size[0], node.computeSize()[1]]); } catch (e) {}
    _rcEnforceLogic(node);
    if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
}

// "+ Node/Pair" / "− Node/Pair" control row (non-serialized; count persists in
// properties._rcRevealed).
function _rcEnsureAddControl(node, kind) {
    if (node._rcAddCtrl) return;
    const isAB = (kind === "ab");
    const w = {
        name: "__rc_add", type: "RC_ADD", value: null, options: { serialize: false },
        computeSize: function () { return [0, 24]; },
        draw: function (ctx, node, wWidth, y, H) {
            const info = node._rcRevealInfo || { revealed: 1, max: isAB ? _RC_MAX_PAIRS : _RC_MAX_TARGETS };
            const margin = 14.5, bh = 18, by = y + (H - bh) / 2;
            ctx.font = "11px Arial"; ctx.textBaseline = "middle";
            const canAdd = info.revealed < info.max;
            const addLabel = isAB ? "+ Pair" : "+ Node";
            const addW = ctx.measureText(addLabel).width + 20;
            const bx = margin;
            ctx.globalAlpha = canAdd ? 1 : 0.35;
            ctx.fillStyle = "#242424"; ctx.beginPath(); ctx.roundRect(bx, by, addW, bh, 4); ctx.fill();
            ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = "#ccc"; ctx.textAlign = "center"; ctx.fillText(addLabel, bx + addW / 2, by + bh / 2);
            ctx.globalAlpha = 1;
            this._addHit = canAdd ? { x: bx, y: by, w: addW, h: bh } : null;
            this._remHit = null;
            const noun = isAB ? "pair" : "node";
            const cnt = `${info.revealed} ${noun}${info.revealed === 1 ? "" : "s"}`;
            ctx.fillStyle = "#777"; ctx.textAlign = "right"; ctx.fillText(cnt, wWidth - margin, by + bh / 2);
            this._hitY = y; this._hitH = H;
        },
        mouse: function (e, pos, n) {
            const t = e && e.type;
            if (t !== "pointerdown" && t !== "mousedown" && t !== "click") return false;
            const px = pos[0], py = pos[1];
            const hit = (r) => r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
            if (hit(this._addHit)) { _rcRevealAdd(n, kind, +1); if (e.stopPropagation) e.stopPropagation(); return true; }
            return false;
        },
    };
    node.widgets.push(w);
    node._rcAddCtrl = w;
}

// Dim note under the title on the legacy Triple / AA-BB nodes.
function _rcEnsureLegacyNote(node) {
    if (node._rcLegacyNote) return;
    const NOTE = "Legacy node — kept for compatibility. Will be removed in a future update. Use new multi row nodes";
    const w = {
        name: "__rc_legacy", type: "RC_NOTE", value: null, options: { serialize: false },
        computeSize: function () { return [0, (node._rcLegacyLines || 4) * 11 + 6]; },
        draw: function (ctx, node, wWidth, y, H) {
            const margin = 12, maxW = wWidth - margin * 2;
            ctx.save();
            ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = "#8a7a5a";
            const words = NOTE.split(" ");
            let line = "", ly = y + 2, lines = 0;
            for (const word of words) {
                const test = line ? line + " " + word : word;
                if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, margin, ly); ly += 11; lines++; line = word; }
                else line = test;
            }
            if (line) { ctx.fillText(line, margin, ly); lines++; }
            ctx.restore();
            if (lines !== node._rcLegacyLines) { node._rcLegacyLines = lines; try { node.setSize([node.size[0], node.computeSize()[1]]); } catch (e) {} }
        },
    };
    node.widgets.push(w);
    node._rcLegacyNote = w;
}

const _rcEnforceLogic = (node) => {
    if(!node.widgets) return;
    const switchW = node.widgets.find(w => w.name === "node_status" || w.name === "switch_status");
    const modeW = node.widgets.find(w => w.name === "mode_select");
    if(!switchW || !modeW) return;
    // A/B suppression on/off (default on when the widget is absent, e.g. Single).
    const suppressW = node.widgets.find(w => w.name === "suppress_enable");
    const suppressOn = (suppressW && suppressW.value != null) ? !!suppressW.value : true;

    const targets = node.widgets.filter(w => w.type === "REMOTE_PICKER");
    const isSwitch = node.comfyClass.includes("Switch");
    let changed = false;

    const getMode = (active) => {
        if(active) return 0;
        const m = typeof modeW.value === "boolean" ? (modeW.value ? "Mute" : "Bypass") : modeW.value;
        return (m === "Mute") ? 2 : 4;
    };

    for(const w of targets) {
        if(!w.value) continue;
        const target = _rcResolveTargetWidget(node, w);
        if(!target) continue;
        let active = false;
        if(isSwitch) {
            if(!suppressOn) active = true;               // suppression off → both sides run
            else if(w.name.includes("_A")) active = switchW.value;
            else if(w.name.includes("_B")) active = !switchW.value;
            else active = true;
        } else {
            active = switchW.value;
        }
        const mode = getMode(active);
        if(target.mode !== mode) {
            target.mode = mode;
            if(target.setDirtyCanvas) target.setDirtyCanvas(true, true);
            changed = true;
        }
    }
    if(changed) app.canvas.setDirty(true, true);
};

// =========================================================
// 5b. STACKER — Constants & Helpers
// =========================================================

const _STACKER_COLORS = {
    active:   { dot: "#66afef", dotBorder: "#4a86c0", text: "#cccccc" },
    muted:    { dot: "#8a8a8a", dotBorder: "#666666", text: "#9a9a9a", textOpacity: 0.6 },
    bypassed: { dot: "#a080c0", dotBorder: "#8060a0", text: "#a898c8" },
};

const _STACKER_REMOTE_CLASSES = ["remotecontrol", "remotecontrolmulti", "remoteswitch", "remoteswitchmulti"];

function _rcIsRemoteNode(node) {
    if (!node) return false;
    const cc = (node.comfyClass || "").toLowerCase();
    return _STACKER_REMOTE_CLASSES.includes(cc);
}

/** Recursively traverse all graphs (root + subgraphs) and return Remote Control
 *  nodes as { node, key (chain key), title, path } entries. */
function _rcFindAllRemoteEntries() {
    const entries = [];
    const _traverse = (graph, chain, pathLabel) => {
        if (!graph) return;
        const nodes = graph._nodes || graph.nodes || [];
        for (const n of nodes) {
            if (!n.id) continue;
            if (n.graph !== undefined && n.graph !== graph) continue; // ghost filter
            const myChain = [...chain, n.id];
            const uniqueKey = myChain.join(":");
            const inner = _rcGetInnerGraph(n);

            if (_rcIsRemoteNode(n)) {
                const title = n.title || n.type || ("Node " + n.id);
                entries.push({ node: n, key: uniqueKey, title: title, path: pathLabel });
            }

            if (inner) {
                const nextPath = (pathLabel === "Root") ? (n.title || n.type || "Subgraph") : `${pathLabel} > ${n.title || n.type || "Subgraph"}`;
                _traverse(inner, myChain, nextPath);
            }
        }
    };
    _traverse(app.graph, [], "Root");
    return entries;
}

function _rcGetAllStackerNodes() {
    if (!app.graph || !app.graph._nodes) return [];
    return app.graph._nodes.filter(n => (n.comfyClass || "").toLowerCase() === "remotestacker");
}

/** Resolve a chain key to a node, using _rcFindNodeGlobal (handles subgraphs). */
function _rcResolveKey(key) {
    return _rcFindNodeGlobal(key);
}

function _rcGetRemoteNodeState(remoteNode) {
    if (!remoteNode || !remoteNode.widgets) return { active: true, mode: "bypass" };
    const kind = _rcRemoteKind(remoteNode);
    const modeW = remoteNode.widgets.find(w => w.name === "mode_select");
    const mode = modeW ? (modeW.value ? "mute" : "bypass") : "bypass";
    if (kind === "ab" || kind === "aabb") {
        // A/B: "active" == suppression off; also remember the side so global
        // override can restore it exactly.
        const supW = remoteNode.widgets.find(w => (w.name || "").toLowerCase().includes("suppress"));
        const sideW = remoteNode.widgets.find(w => w.name === "switch_status");
        const suppress = supW ? ((supW.value == null) ? true : !!supW.value) : true;
        return { active: !suppress, mode, side: sideW ? !!sideW.value : true, ab: true };
    }
    const statusW = remoteNode.widgets.find(w => w.name === "node_status");
    return { active: statusW ? !!statusW.value : true, mode, ab: false };
}

function _rcSetRemoteNodeState(remoteNode, active, mode, state) {
    if (!remoteNode || !remoteNode.widgets) return;
    const kind = _rcRemoteKind(remoteNode);
    const modeW = remoteNode.widgets.find(w => w.name === "mode_select");
    const setW = (w, v) => { if (w) { w.value = v; if (w.callback) try { w.callback(v); } catch(e) {} } };
    if (modeW) setW(modeW, (mode === "mute"));
    if (kind === "ab" || kind === "aabb") {
        // active == suppression off. Restore the side too when we have it.
        const supW = remoteNode.widgets.find(w => (w.name || "").toLowerCase().includes("suppress"));
        setW(supW, !active);
        if (state && typeof state.side === "boolean") {
            const sideW = remoteNode.widgets.find(w => w.name === "switch_status");
            setW(sideW, state.side);
        }
    } else {
        const statusW = remoteNode.widgets.find(w => w.name === "node_status");
        setW(statusW, active);
    }
    _rcEnforceLogic(remoteNode);
    if (remoteNode.setDirtyCanvas) remoteNode.setDirtyCanvas(true, true);
}

// =========================================================
// 5c. STACKER — Core Logic
// =========================================================

/** Initial scan: claim all unowned Remote nodes (runs once on first creation). */
function _rcStackerInitialScan(stackerNode) {
    if (stackerNode.properties._rcInitialScanDone) return;
    stackerNode.properties._rcInitialScanDone = true;

    const allEntries = _rcFindAllRemoteEntries();
    const allStackers = _rcGetAllStackerNodes();

    const ownedByOthers = new Set();
    for (const s of allStackers) {
        if (s.id === stackerNode.id) continue;
        const sKeys = (s.properties && s.properties._rcOwnedKeys) || [];
        for (const k of sKeys) ownedByOthers.add(k);
    }

    for (const entry of allEntries) {
        if (ownedByOthers.has(entry.key)) continue;
        if (stackerNode.properties._rcOwnedKeys.includes(entry.key)) continue;
        stackerNode.properties._rcOwnedKeys.push(entry.key);
    }
}

/** Continuously claim any unowned Remote node when Auto-Add is on. */
function _rcStackerAutoClaim(stackerNode) {
    const allEntries = _rcFindAllRemoteEntries();
    const allStackers = _rcGetAllStackerNodes();
    const ownedByOthers = new Set();
    for (const s of allStackers) {
        if (s.id === stackerNode.id) continue;
        const sKeys = (s.properties && s.properties._rcOwnedKeys) || [];
        for (const k of sKeys) ownedByOthers.add(k);
    }
    let added = false;
    for (const entry of allEntries) {
        if (ownedByOthers.has(entry.key)) continue;
        if (stackerNode.properties._rcOwnedKeys.includes(entry.key)) continue;
        stackerNode.properties._rcOwnedKeys.push(entry.key);
        added = true;
    }
    if (added && stackerNode.setDirtyCanvas) stackerNode.setDirtyCanvas(true, true);
}

/** Validate owned keys: fix broken chain keys from node relocation between subgraphs. */
function _rcStackerValidateKeys(stackerNode) {
    const ownedKeys = stackerNode.properties._rcOwnedKeys || [];
    if (ownedKeys.length === 0) return;

    if (!stackerNode._rcMissingSince) stackerNode._rcMissingSince = {};
    const missSince = stackerNode._rcMissingSince;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const PRUNE_MS = 4000;   // grace before treating an unresolvable node as deleted

    const saved = stackerNode.properties._rcSavedStates || {};
    const updatedKeys = [];
    let changed = false;

    for (const key of ownedKeys) {
        const resolved = _rcResolveKey(key);
        if (resolved && _rcIsRemoteNode(resolved)) {
            delete missSince[key];
            // Node may have relocated between subgraphs → adopt its current key.
            const info = _rcKeyInfo(key);
            const curKey = (info && info.key) ? info.key : key;
            if (curKey !== key) {
                if (saved[key]) { saved[curKey] = saved[key]; delete saved[key]; }
                changed = true;
            }
            if (!updatedKeys.includes(curKey)) updatedKeys.push(curKey);
        } else {
            // Unresolvable. Keep during a short grace window (covers subgraph
            // navigation / transient state); prune once it's clearly deleted.
            if (!missSince[key]) missSince[key] = now;
            if (now - missSince[key] >= PRUNE_MS) {
                if (saved[key]) delete saved[key];
                delete missSince[key];
                changed = true;                  // dropped (not pushed)
            } else {
                updatedKeys.push(key);
            }
        }
    }

    if (changed) {
        stackerNode.properties._rcOwnedKeys = updatedKeys;
        if (stackerNode.setDirtyCanvas) stackerNode.setDirtyCanvas(true, true);
    }
}

/** Get all unstacked Remote node entries (not owned by any stacker). */
function _rcGetUnstackedEntries() {
    const allEntries = _rcFindAllRemoteEntries();
    const allStackers = _rcGetAllStackerNodes();
    const ownedByAll = new Set();
    for (const s of allStackers) {
        const sKeys = (s.properties && s.properties._rcOwnedKeys) || [];
        for (const k of sKeys) ownedByAll.add(k);
    }
    return allEntries.filter(e => !ownedByAll.has(e.key));
}

function _rcStackerAddNode(stackerNode, remoteKey) {
    if (!stackerNode.properties._rcOwnedKeys) stackerNode.properties._rcOwnedKeys = [];
    if (!stackerNode.properties._rcOwnedKeys.includes(remoteKey)) {
        stackerNode.properties._rcOwnedKeys.push(remoteKey);
    }
}

function _rcStackerRemoveNode(stackerNode, remoteKey) {
    if (!stackerNode.properties || !stackerNode.properties._rcOwnedKeys) return;
    stackerNode.properties._rcOwnedKeys = stackerNode.properties._rcOwnedKeys.filter(k => k !== remoteKey);
    if (stackerNode.properties._rcSavedStates) {
        delete stackerNode.properties._rcSavedStates[remoteKey];
    }
}

function _rcStackerMoveNode(fromStacker, toStacker, remoteKey) {
    // Migrate saved state if present
    if (fromStacker.properties._rcSavedStates && fromStacker.properties._rcSavedStates[remoteKey]) {
        if (!toStacker.properties._rcSavedStates) toStacker.properties._rcSavedStates = {};
        toStacker.properties._rcSavedStates[remoteKey] = fromStacker.properties._rcSavedStates[remoteKey];
    }
    _rcStackerRemoveNode(fromStacker, remoteKey);
    _rcStackerAddNode(toStacker, remoteKey);
    if (fromStacker.setDirtyCanvas) fromStacker.setDirtyCanvas(true, true);
    if (toStacker.setDirtyCanvas) toStacker.setDirtyCanvas(true, true);
}

function _rcStackerApplyGlobal(stackerNode) {
    if (!stackerNode.properties) return;
    const globalMode = stackerNode.properties._rcStackerMode || "user";
    const ownedKeys = stackerNode.properties._rcOwnedKeys || [];

    if (globalMode === "user") {
        const saved = stackerNode.properties._rcSavedStates || {};
        for (const key of ownedKeys) {
            const rn = _rcResolveKey(key);
            if (!rn || !_rcIsRemoteNode(rn)) continue;
            if (saved[key]) {
                _rcSetRemoteNodeState(rn, saved[key].active, saved[key].mode, saved[key]);
            }
        }
        return;
    }

    if (!stackerNode.properties._rcSavedStates) stackerNode.properties._rcSavedStates = {};
    for (const key of ownedKeys) {
        const rn = _rcResolveKey(key);
        if (!rn || !_rcIsRemoteNode(rn)) continue;
        if (!stackerNode.properties._rcSavedStates[key]) {
            stackerNode.properties._rcSavedStates[key] = _rcGetRemoteNodeState(rn);
        }
        _rcSetRemoteNodeState(rn, false, globalMode);
    }
}

function _rcStackerSetMode(stackerNode, mode) {
    if (!stackerNode.properties) stackerNode.properties = {};
    const prev = stackerNode.properties._rcStackerMode || "user";

    if (mode === "user") {
        stackerNode.properties._rcStackerMode = "user";
        _rcStackerApplyGlobal(stackerNode);
        stackerNode.properties._rcSavedStates = {};
    } else {
        if (prev === "user") {
            stackerNode.properties._rcSavedStates = {};
        }
        stackerNode.properties._rcStackerMode = mode;
        _rcStackerApplyGlobal(stackerNode);
    }

    // Keep the promotable override toggles in sync.
    const _mws = stackerNode._rcModeWidgets;
    if (_mws && _mws[0] && _mws[1]) {
        const cur = stackerNode.properties._rcStackerMode || "user";
        const wantEnable = (cur !== "user");
        if (_mws[0].value !== wantEnable) _mws[0].value = wantEnable;
        if (wantEnable) { const wantMute = (cur === "mute"); if (_mws[1].value !== wantMute) _mws[1].value = wantMute; }
    }

    if (stackerNode.setDirtyCanvas) stackerNode.setDirtyCanvas(true, true);
    app.canvas.setDirty(true, true);
}

// =========================================================
// 5d. STACKER — Add Picker & Move Dropdown
// =========================================================

/** Show picker modal for adding unstacked Remote nodes to a stacker. */
function _rcShowAddPicker(stackerNode) {
    const unstacked = _rcGetUnstackedEntries();

    if (unstacked.length === 0) {
        const overlay = document.createElement("div");
        overlay.className = "remote-picker-overlay";
        overlay.innerHTML = `<div class="remote-picker-modal" style="padding:30px;text-align:center;">
            <div style="color:#999;font-size:14px;">No unstacked Remote nodes found</div>
            <div style="color:#666;font-size:12px;margin-top:8px;">All Remote Control nodes are already in a stacker</div>
        </div>`;
        overlay.onclick = () => document.body.removeChild(overlay);
        document.body.appendChild(overlay);
        return;
    }

    // Build groups by path
    const groups = {};
    for (const e of unstacked) {
        if (!groups[e.path]) groups[e.path] = [];
        groups[e.path].push(e);
    }
    const paths = Object.keys(groups).sort((a, b) => a === "Root" ? -1 : a.localeCompare(b));

    const overlay = document.createElement("div");
    overlay.className = "remote-picker-overlay";
    const modal = document.createElement("div");
    modal.className = "remote-picker-modal";
    const header = document.createElement("div");
    header.className = "remote-picker-header";
    header.innerHTML = `<div style="color:#ccc;font-size:14px;font-weight:bold;">Add to Stacker</div>`;
    const search = document.createElement("input");
    search.className = "remote-picker-search";
    search.placeholder = "Search nodes...";
    const list = document.createElement("div");
    list.className = "remote-picker-list";

    header.appendChild(search);
    modal.appendChild(header);
    modal.appendChild(list);
    overlay.appendChild(modal);

    let activeGroup = paths.length === 1 ? paths[0] : null;

    const addItem = (entry, parent) => {
        const item = document.createElement("div");
        item.className = "remote-picker-item";
        const typeName = entry.node ? (entry.node.comfyClass || entry.node.type || "") : "";
        const leafId = String(entry.key).split(":").pop();
        const pathInfo = entry.path !== "Root" ? ` <span style="color:#555;font-size:10px;">[${_rcEsc(entry.path)}]</span>` : "";
        item.innerHTML = `<div class="remote-item-title">${_rcEsc(entry.title)}</div><div class="remote-item-meta">[${_rcEsc(entry.key)}] · ${_rcEsc(typeName)}</div>`;
        item.onclick = (ev) => {
            ev.stopPropagation();
            _rcStackerAddNode(stackerNode, entry.key);
            // Apply global override if active
            const globalMode = stackerNode.properties._rcStackerMode || "user";
            if (globalMode !== "user") {
                const rn = _rcResolveKey(entry.key);
                if (rn && _rcIsRemoteNode(rn)) {
                    if (!stackerNode.properties._rcSavedStates) stackerNode.properties._rcSavedStates = {};
                    stackerNode.properties._rcSavedStates[entry.key] = _rcGetRemoteNodeState(rn);
                    _rcSetRemoteNodeState(rn, false, globalMode);
                }
            }
            stackerNode.setDirtyCanvas(true, true);
            document.body.removeChild(overlay);
        };
        parent.appendChild(item);
    };

    const render = () => {
        list.innerHTML = "";
        const term = search.value.toLowerCase().trim();
        if (term) {
            const hits = unstacked.filter(e =>
                e.title.toLowerCase().includes(term) ||
                e.key.includes(term) ||
                e.path.toLowerCase().includes(term)
            );
            if (hits.length === 0) {
                list.innerHTML = `<div style="padding:20px;text-align:center;color:#666">No results</div>`;
            } else {
                hits.forEach(e => addItem(e, list));
            }
            return;
        }
        for (const p of paths) {
            const grp = document.createElement("div");
            grp.className = "remote-group-header";
            if (p === activeGroup) grp.classList.add("active");
            grp.innerHTML = `<span>${_rcEsc(p)}</span><span class="arrow">${p === activeGroup ? '▼' : '▶'}</span>`;
            grp.onclick = () => { activeGroup = (activeGroup === p ? null : p); render(); };
            const content = document.createElement("div");
            content.className = "remote-group-content";
            if (p === activeGroup) content.classList.add("open");
            groups[p].sort((a, b) => a.title.localeCompare(b.title));
            groups[p].forEach(e => addItem(e, content));
            list.appendChild(grp);
            list.appendChild(content);
        }
    };

    search.addEventListener("input", render);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    document.body.appendChild(overlay);
    render();
    setTimeout(() => search.focus(), 50);
}

/** Show move dropdown at a specific position on the canvas. */
function _rcShowMoveDropdown(fromStacker, remoteKey, screenX, screenY) {
    const otherStackers = _rcGetAllStackerNodes().filter(s => s.id !== fromStacker.id);

    // Remove any existing dropdown
    const existing = document.querySelector(".rc-move-dropdown");
    if (existing) existing.remove();

    const dropdown = document.createElement("div");
    dropdown.className = "rc-move-dropdown";
    dropdown.style.cssText = `
        position: fixed; z-index: 10000;
        left: ${screenX}px; top: ${screenY}px;
        background: #2a2d35; border: 1px solid #4a4d55;
        border-radius: 6px; padding: 4px 0;
        min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;

    if (otherStackers.length === 0) {
        const item = document.createElement("div");
        item.style.cssText = "padding:10px 16px;color:#999;font-size:12px;text-align:center;";
        item.textContent = "Add a stacker to move nodes";
        dropdown.appendChild(item);
    } else {
        for (const target of otherStackers) {
            const item = document.createElement("div");
            item.style.cssText = `
                padding: 8px 16px; color: #ddd; font-size: 12px;
                cursor: pointer; transition: background 0.15s;
            `;
            item.textContent = "Move to " + (target.title || "Stacker") + " #" + target.id;
            item.onmouseenter = () => { item.style.background = "#3a3d4a"; };
            item.onmouseleave = () => { item.style.background = "transparent"; };
            item.onclick = (ev) => {
                ev.stopPropagation();
                _rcStackerMoveNode(fromStacker, target, remoteKey);
                dropdown.remove();
                overlay.remove();
            };
            dropdown.appendChild(item);
        }
    }

    // Overlay to catch clicks outside dropdown
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;";
    overlay.onclick = () => { dropdown.remove(); overlay.remove(); };

    document.body.appendChild(overlay);
    document.body.appendChild(dropdown);
}

// =========================================================
// 5e. STACKER — Custom Drawing
// =========================================================

function _rcStackerDraw(stackerNode, ctx) {
    if (!stackerNode.properties) stackerNode.properties = {};
    if (!stackerNode.properties._rcOwnedKeys) stackerNode.properties._rcOwnedKeys = [];
    if (!stackerNode.properties._rcStackerMode) stackerNode.properties._rcStackerMode = "user";

    const globalMode = stackerNode.properties._rcStackerMode;
    const ownedKeys = stackerNode.properties._rcOwnedKeys;
    const margin = 14.5;
    const rowH = 28;
    const btnH = 22;
    const headerH = 30;
    const addBtnH = 26;
    const pad = 6;

    // Compute required height (widget area on top, then Auto row + rows + Add)
    const _mws2 = stackerNode._rcModeWidgets || [];
    const _lastW = _mws2[1] || _mws2[0];
    const widgetBottom = (_lastW && typeof _lastW.last_y === "number") ? (_lastW.last_y + 26 + 4) : 60;
    const totalH = widgetBottom + headerH + (ownedKeys.length * rowH) + addBtnH + pad * 2;
    const nodeW = stackerNode.size[0];

    if (Math.abs(stackerNode.size[1] - totalH) > 2) {
        stackerNode.size[1] = totalH;
    }

    if (!stackerNode._rcHitAreas) stackerNode._rcHitAreas = {};
    stackerNode._rcHitAreas = {};

    let y = widgetBottom;

    // --- HEADER: Auto-Add toggle (override controls are the two toggles above) ---
    const btnH2 = btnH;
    const btnY = y + (headerH - btnH2) / 2;
    ctx.font = "bold 10px Arial";

    // --- Auto-Add toggle (left) ---
    const autoOn = stackerNode.properties._rcAutoAdd === true;
    const autoLabel = "Auto Add " + (autoOn ? "ON" : "OFF");
    ctx.font = "10px Arial";
    const autoW = ctx.measureText(autoLabel).width + 24;
    const autoX = margin;
    ctx.fillStyle = autoOn ? "rgba(102,175,239,0.18)" : "#2a2a2a";
    ctx.beginPath(); ctx.roundRect(autoX, btnY, autoW, btnH, 3); ctx.fill();
    ctx.strokeStyle = autoOn ? "#66afef" : "#555555"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(autoX + 11, btnY + btnH / 2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = autoOn ? "#66afef" : "#777777"; ctx.fill();
    ctx.fillStyle = autoOn ? "#a8d0f0" : "#888888"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(autoLabel, autoX + 19, btnY + btnH / 2);
    stackerNode._rcHitAreas["auto"] = { x: autoX, y: btnY, w: autoW, h: btnH };

    y += headerH;

    // --- DIVIDER ---
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(nodeW - margin, y);
    ctx.stroke();

    // --- ROWS ---
    const isGlobalOverride = (globalMode !== "user");

    for (let ri = 0; ri < ownedKeys.length; ri++) {
        const remoteKey = ownedKeys[ri];
        const remoteNode = _rcResolveKey(remoteKey);
        const rowY = y + ri * rowH;
        const rowCenterY = rowY + rowH / 2;

        if (!remoteNode || !_rcIsRemoteNode(remoteNode)) {
            // Dead reference — draw dimmed
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "#888";
            ctx.font = "12px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("(missing node " + remoteKey + ")", margin + 8, rowCenterY);
            ctx.globalAlpha = 1.0;

            // Move + Remove buttons even for missing nodes
            const moveX = nodeW - margin - 36;
            ctx.fillStyle = "#555";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.fillText("→", moveX + 8, rowCenterY);
            stackerNode._rcHitAreas["move_" + ri] = { x: moveX, y: rowY, w: 16, h: rowH, remoteKey: remoteKey };

            const xBtnX = nodeW - margin - 16;
            ctx.fillStyle = "#666";
            ctx.fillText("✕", xBtnX + 8, rowCenterY);
            stackerNode._rcHitAreas["remove_" + ri] = { x: xBtnX, y: rowY, w: 16, h: rowH, remoteKey: remoteKey };
            continue;
        }

        const _rkind = _rcRemoteKind(remoteNode);
        const isAB = (_rkind === "ab" || _rkind === "aabb");
        let state, abSideA = true;
        if (isAB) {
            const sideW = remoteNode.widgets.find(w => w.name === "switch_status");
            const supW = remoteNode.widgets.find(w => (w.name || "").toLowerCase().includes("suppress"));
            const modeW = remoteNode.widgets.find(w => w.name === "mode_select");
            abSideA = sideW ? !!sideW.value : true;
            const suppress = supW ? ((supW.value == null) ? true : !!supW.value) : true;
            state = { active: !suppress, mode: modeW ? (modeW.value ? "mute" : "bypass") : "bypass" };
        } else {
            state = _rcGetRemoteNodeState(remoteNode);
        }
        let rowState;
        if (isGlobalOverride) {
            rowState = (globalMode === "mute") ? "muted" : "bypassed";
        } else {
            rowState = state.active ? "active" : (state.mode === "mute" ? "muted" : "bypassed");
        }

        const colors = _STACKER_COLORS[rowState === "active" ? "active" : rowState];
        const isMuted = (rowState === "muted");

        // --- Row title (Title [key], reflects actual state) ---
        if (isMuted) ctx.globalAlpha = colors.textOpacity;
        const info = _rcKeyInfo(remoteKey);
        const keyStr = (info && info.key) ? info.key : String(remoteKey);
        const baseTitle = (info && info.title) ? info.title : (remoteNode.title || remoteNode.type || ("Node " + keyStr));
        ctx.font = "12px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";

        const maxTitleW = nodeW - margin * 2 - (isAB ? 132 : 104); // room for controls
        const idText = " [" + keyStr + "]";
        const idW = ctx.measureText(idText).width;
        // Left-truncate the title so the [key] always stays visible.
        let main = baseTitle;
        if (ctx.measureText(main).width > maxTitleW - idW) {
            while (main.length > 3 && ctx.measureText("… " + main).width > maxTitleW - idW) main = main.slice(1);
            main = "… " + main;
        }
        ctx.fillStyle = isMuted ? "#ccc" : colors.text;
        ctx.fillText(main, margin + 8, rowCenterY);
        ctx.fillStyle = "#6a7a8a";   // dim key
        ctx.fillText(idText, margin + 8 + ctx.measureText(main).width, rowCenterY);
        if (isMuted) ctx.globalAlpha = 1.0;

        if (isAB) {
            // --- Side A/B button ---
            const sideBW = 22, sideBX = nodeW - margin - 110, sideBY = rowCenterY - 8;
            ctx.fillStyle = "#2a2a2a"; ctx.beginPath(); ctx.roundRect(sideBX, sideBY, sideBW, 16, 3); ctx.fill();
            ctx.strokeStyle = "#66afef"; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = "#a8d0f0"; ctx.font = "bold 9px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(abSideA ? "A" : "B", sideBX + sideBW / 2, rowCenterY);
            if (!isGlobalOverride) stackerNode._rcHitAreas["side_" + ri] = { x: sideBX, y: rowY, w: sideBW, h: rowH, remoteKey: remoteKey };

            // --- M/B mini toggle ---
            const mbW = 18, mbX = nodeW - margin - 82, mbY = rowCenterY - 8;
            const mbLabel = state.mode === "mute" ? "M" : "B";
            ctx.fillStyle = "#2a2a2a"; ctx.beginPath(); ctx.roundRect(mbX, mbY, mbW, 16, 3); ctx.fill();
            ctx.strokeStyle = (rowState === "bypassed") ? colors.dotBorder : "#555"; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = colors.text; ctx.font = "bold 9px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(mbLabel, mbX + mbW / 2, rowCenterY);
            if (!isGlobalOverride) stackerNode._rcHitAreas["mb_" + ri] = { x: mbX, y: rowY, w: mbW, h: rowH, remoteKey: remoteKey };

            // --- Suppress dot (node_status: Active / Mute-Bypass) ---
            const dotR = 6, dotX = nodeW - margin - 52;
            if (rowState === "muted") ctx.globalAlpha = colors.textOpacity;
            ctx.beginPath(); ctx.arc(dotX, rowCenterY, dotR, 0, Math.PI * 2);
            ctx.fillStyle = colors.dot; ctx.fill();
            ctx.strokeStyle = colors.dotBorder; ctx.lineWidth = 1; ctx.stroke();
            if (rowState === "muted") ctx.globalAlpha = 1.0;
            if (!isGlobalOverride) stackerNode._rcHitAreas["sup_" + ri] = { x: dotX - dotR - 2, y: rowY, w: dotR * 2 + 4, h: rowH, remoteKey: remoteKey };
        } else {
        // --- M/B mini toggle ---
        const mbW = 18;
        const mbX = nodeW - margin - 84;
        const mbY = rowCenterY - btnH / 2 + 3;
        const mbLabel = state.mode === "mute" ? "M" : "B";

        if (isMuted) ctx.globalAlpha = colors.textOpacity;
        ctx.fillStyle = "#2a2a2a";
        ctx.beginPath();
        ctx.roundRect(mbX, mbY, mbW, 16, 3);
        ctx.fill();
        ctx.strokeStyle = isMuted ? "#444" : (rowState === "bypassed" ? colors.dotBorder : "#555");
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isMuted ? "#ccc" : colors.text;
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.fillText(mbLabel, mbX + mbW / 2, mbY + 9);
        if (isMuted) ctx.globalAlpha = 1.0;

        if (!isGlobalOverride) {
            stackerNode._rcHitAreas["mb_" + ri] = { x: mbX, y: rowY, w: mbW, h: rowH, remoteKey: remoteKey };
        }

        // --- State dot ---
        const dotR = 6;
        const dotX = nodeW - margin - 54;

        if (isMuted) ctx.globalAlpha = colors.textOpacity;
        ctx.beginPath();
        ctx.arc(dotX, rowCenterY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = colors.dot;
        ctx.fill();
        ctx.strokeStyle = colors.dotBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (isMuted) ctx.globalAlpha = 1.0;

        if (!isGlobalOverride) {
            stackerNode._rcHitAreas["dot_" + ri] = { x: dotX - dotR - 2, y: rowY, w: dotR * 2 + 4, h: rowH, remoteKey: remoteKey };
        }
        }

        // --- Move arrow →  ---
        const moveX = nodeW - margin - 36;
        ctx.fillStyle = "#666";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("→", moveX + 8, rowCenterY);
        stackerNode._rcHitAreas["move_" + ri] = { x: moveX, y: rowY, w: 16, h: rowH, remoteKey: remoteKey };

        // --- Remove ✕ ---
        const xBtnX = nodeW - margin - 16;
        ctx.fillStyle = "#666";
        ctx.fillText("✕", xBtnX + 8, rowCenterY);
        stackerNode._rcHitAreas["remove_" + ri] = { x: xBtnX, y: rowY, w: 16, h: rowH, remoteKey: remoteKey };

        // --- Row separator ---
        if (ri < ownedKeys.length - 1) {
            ctx.strokeStyle = "#2a2a2a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin, rowY + rowH);
            ctx.lineTo(nodeW - margin, rowY + rowH);
            ctx.stroke();
        }
    }

    // --- ADD BUTTON ---
    const addY = y + ownedKeys.length * rowH + pad;
    const addX = margin;
    const addW = nodeW - margin * 2;

    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.roundRect(addX, addY, addW, addBtnH - 4, 4);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#888";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+ Add", nodeW / 2, addY + (addBtnH - 4) / 2);

    stackerNode._rcHitAreas["add"] = { x: addX, y: addY, w: addW, h: addBtnH };
}

// =========================================================
// 5f. STACKER — Click Handling
// =========================================================

function _rcStackerMouseDown(stackerNode, e, pos) {
    if (!stackerNode._rcHitAreas) return false;
    const [px, py] = pos;

    for (const [key, area] of Object.entries(stackerNode._rcHitAreas)) {
        if (px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h) {

            // Auto-Add toggle
            if (key === "auto") {
                stackerNode.properties._rcAutoAdd = !stackerNode.properties._rcAutoAdd;
                if (stackerNode.properties._rcAutoAdd) {
                    try { _rcStackerAutoClaim(stackerNode); } catch (e) {}
                }
                stackerNode.setDirtyCanvas(true, true);
                return true;
            }

            // Add button — opens picker
            if (key === "add") {
                _rcShowAddPicker(stackerNode);
                return true;
            }

            // Remove button
            if (key.startsWith("remove_")) {
                _rcStackerRemoveNode(stackerNode, area.remoteKey);
                stackerNode.setDirtyCanvas(true, true);
                return true;
            }

            // Move button — opens dropdown
            if (key.startsWith("move_")) {
                // Convert canvas pos to screen coordinates for the dropdown
                const canvasRect = app.canvas.canvas.getBoundingClientRect();
                const scale = app.canvas.ds.scale || 1;
                const offset = app.canvas.ds.offset || [0, 0];
                const screenX = canvasRect.left + (stackerNode.pos[0] + area.x + area.w) * scale + offset[0] * scale;
                const screenY = canvasRect.top + (stackerNode.pos[1] + area.y + area.h) * scale + offset[1] * scale;
                _rcShowMoveDropdown(stackerNode, area.remoteKey, screenX, screenY);
                return true;
            }

            // State dot toggle
            if (key.startsWith("dot_")) {
                const globalMode = stackerNode.properties._rcStackerMode || "user";
                if (globalMode !== "user") return true;
                const rn = _rcResolveKey(area.remoteKey);
                if (rn && _rcIsRemoteNode(rn)) {
                    const st = _rcGetRemoteNodeState(rn);
                    _rcSetRemoteNodeState(rn, !st.active, st.mode);
                    stackerNode.setDirtyCanvas(true, true);
                }
                return true;
            }

            // A/B side toggle
            if (key.startsWith("side_")) {
                if ((stackerNode.properties._rcStackerMode || "user") !== "user") return true;
                const rn = _rcResolveKey(area.remoteKey);
                if (rn && rn.widgets) {
                    const w = rn.widgets.find(x => x.name === "switch_status");
                    if (w) { w.value = !w.value; if (w.callback) try { w.callback(w.value); } catch(e){} _rcEnforceLogic(rn); }
                    stackerNode.setDirtyCanvas(true, true);
                }
                return true;
            }

            // A/B suppress (node_status) toggle
            if (key.startsWith("sup_")) {
                if ((stackerNode.properties._rcStackerMode || "user") !== "user") return true;
                const rn = _rcResolveKey(area.remoteKey);
                if (rn && rn.widgets) {
                    const w = rn.widgets.find(x => (x.name || "").toLowerCase().includes("suppress"));
                    if (w) { const cur = (w.value == null) ? true : !!w.value; w.value = !cur; if (w.callback) try { w.callback(w.value); } catch(e){} _rcEnforceLogic(rn); }
                    stackerNode.setDirtyCanvas(true, true);
                }
                return true;
            }

            // M/B toggle (mode_select — works for Single and A/B)
            if (key.startsWith("mb_")) {
                const globalMode = stackerNode.properties._rcStackerMode || "user";
                if (globalMode !== "user") return true;
                const rn = _rcResolveKey(area.remoteKey);
                if (rn && _rcIsRemoteNode(rn) && rn.widgets) {
                    const modeW = rn.widgets.find(w => w.name === "mode_select");
                    if (modeW) { modeW.value = !modeW.value; if (modeW.callback) try { modeW.callback(modeW.value); } catch(e){} _rcEnforceLogic(rn); }
                    stackerNode.setDirtyCanvas(true, true);
                }
                return true;
            }

            return true;
        }
    }
    return false;
}

// =========================================================
// 5g. STACKER — Node Setup
// =========================================================

function _rcInitStacker(node) {
    if (node._rcStackerInit) return;
    node._rcStackerInit = true;

    if (!node.properties) node.properties = {};
    if (!node.properties._rcOwnedKeys) node.properties._rcOwnedKeys = [];
    if (!node.properties._rcStackerMode) node.properties._rcStackerMode = "user";
    if (!node.properties._rcSavedStates) node.properties._rcSavedStates = {};
    // Auto-Add defaults OFF on new/undefined stackers. Existing stackers keep
    // their saved owned nodes; the switch only governs auto-claiming.
    if (node.properties._rcAutoAdd === undefined) node.properties._rcAutoAdd = false;

    // One-time migration (per node load): discard any saved per-node states left
    // over from earlier builds. Older versions could record an incorrect original
    // state, which then restored wrongly when returning to User. Safe because
    // saved states are only meaningful while an override is active — if the
    // stacker is in User, there is nothing legitimately saved to preserve.
    if (!node._rcSavedMigrated) {
        node._rcSavedMigrated = true;
        if ((node.properties._rcStackerMode || "user") === "user") {
            node.properties._rcSavedStates = {};
        }
    }

    // Migrate legacy _rcOwnedIds → _rcOwnedKeys
    if (node.properties._rcOwnedIds) {
        if (!node.properties._rcOwnedKeys.length) {
            node.properties._rcOwnedKeys = node.properties._rcOwnedIds.map(id => String(id));
        }
        delete node.properties._rcOwnedIds;
    }

    // Set minimum size
    node.size[0] = Math.max(node.size[0], 280);

    // Keep ONLY the two declared override toggles; drop anything else.
    if (node.widgets) {
        for (let i = node.widgets.length - 1; i >= 0; i--) {
            const nm = node.widgets[i].name || "";
            if (nm !== "global_enable" && nm !== "global_mode") node.widgets.splice(i, 1);
        }
    }
    const enableW = node.widgets ? node.widgets.find(w => w.name === "global_enable") : null;
    const modeSelW = node.widgets ? node.widgets.find(w => w.name === "global_mode") : null;
    node._rcModeWidgets = [enableW, modeSelW];
    if (enableW && modeSelW) {
        // Sanitize values from intermediate builds that saved a string combo here.
        if (typeof enableW.value !== "boolean") {
            const v = String(enableW.value || "").toLowerCase();
            if (v === "mute" || v === "bypass") { enableW.value = true; modeSelW.value = (v === "mute"); }
            else enableW.value = false;
        }
        if (typeof modeSelW.value !== "boolean") modeSelW.value = (String(modeSelW.value).toLowerCase() === "true");
        // Old saves: properties._rcStackerMode is the source of truth on load.
        const propMode = node.properties._rcStackerMode;
        if (propMode === "mute" || propMode === "bypass") { enableW.value = true; modeSelW.value = (propMode === "mute"); }
        else if (propMode === "user") { enableW.value = false; }
        else { node.properties._rcStackerMode = enableW.value ? (modeSelW.value ? "mute" : "bypass") : "user"; }
        // Pill styling (same custom draw as the other nodes' toggles).
        _rcFixToggleDraw(enableW);
        _rcFixToggleDraw(modeSelW);
        // Any change on either toggle derives and applies the mode.
        const derive = () => enableW.value ? (modeSelW.value ? "mute" : "bypass") : "user";
        for (const w of [enableW, modeSelW]) {
            if (!w._rcStkHooked) {
                const cb = w.callback;
                w.callback = function (v) { if (cb) { try { cb(v); } catch (e) {} } _rcStackerSetMode(node, derive()); };
                w._rcStkHooked = true;
            }
        }
    }

    // Key validation interval: fixes broken chain keys from node relocation (no auto-add)
    node._rcValidateInterval = setInterval(() => {
        try {
            _rcStackerValidateKeys(node);
            if (node.properties._rcAutoAdd) _rcStackerAutoClaim(node);
            // Reconcile: a promoted toggle may have been flipped through ComfyUI's
            // proxy/link without firing callbacks — derive and apply.
            const _mws = node._rcModeWidgets;
            if (_mws && _mws[0] && _mws[1] && typeof _mws[0].value === "boolean") {
                const derived = _mws[0].value ? (_mws[1].value ? "mute" : "bypass") : "user";
                if (derived !== (node.properties._rcStackerMode || "user")) _rcStackerSetMode(node, derived);
            }
        } catch(e) {}
    }, 500);

    // Leak fix: stop the interval when the node is removed from the graph.
    const origRemoved = node.onRemoved;
    node.onRemoved = function () {
        try { if (this._rcValidateInterval) { clearInterval(this._rcValidateInterval); this._rcValidateInterval = null; } } catch (e) {}
        if (origRemoved) return origRemoved.apply(this, arguments);
    };

    // Custom draw
    const origDraw = node.onDrawForeground;
    node.onDrawForeground = function(ctx) {
        try { _rcStackerDraw(node, ctx); } catch(e) { console.error("Stacker draw error:", e); }
        if (origDraw) origDraw.apply(this, arguments);
    };

    // Custom click
    const origDown = node.onMouseDown;
    node.onMouseDown = function(e, pos, canvas) {
        try {
            if (_rcStackerMouseDown(node, e, pos)) return true;
        } catch(err) { console.error("Stacker click error:", err); }
        if (origDown) return origDown.apply(this, arguments);
    };

    // Initial scan claims all unowned Remote nodes — only when Auto-Add is on.
    setTimeout(() => {
        try { if (node.properties._rcAutoAdd) _rcStackerInitialScan(node); } catch(e) {}
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
    }, 300);
    // Second attempt for deeper subgraphs
    setTimeout(() => {
        try {
            if (node.properties._rcAutoAdd) {
                const prev = node.properties._rcInitialScanDone;
                node.properties._rcInitialScanDone = false;
                _rcStackerInitialScan(node);
                node.properties._rcInitialScanDone = prev;
            }
        } catch(e) {}
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
    }, 1500);
}

// =========================================================
// 6. MAIN HOOKS
// =========================================================

const processNode = (node) => {
    if (!node) return;
    
    // 0. Stacker Node
    if ((node.comfyClass || "").toLowerCase() === "remotestacker") {
        _rcInitStacker(node);
        return;
    }

    // 1. Linked Primitive
    if (node.type === "Primitive" || node.comfyClass === "PrimitiveNode") {
        if (node.outputs && node.outputs[0].links && node.outputs[0].links.length > 0) {
            if (_rcLeadsToRemote(app.graph, node, 0, new Set())) {
                if (node.widgets && node.widgets[0]) _rcReplaceWithPicker(node, node.widgets[0]);
            }
        }
    }
    // 2. Remote Node
    const cc = (node.comfyClass || "").toLowerCase();
    const tt = (node.title || "").toLowerCase();
    if (cc.startsWith("remote") || tt.startsWith("remote")) {
        if (node.widgets) {
            // Capture the original (declaration-order) widget names ONCE, before any
            // custom widgets are added or display reordering happens. onSerialize then
            // always writes widgets_values in this order, so backward-compatible
            // deserialization holds regardless of display order or custom widgets.
            if (!node._rcDeclOrder) {
                node._rcDeclOrder = node.widgets
                    .filter(w => !(w.options && w.options.serialize === false) && w.type !== "RC_ADD" && w.type !== "RC_NOTE")
                    .map(w => w.name);
                node.onSerialize = function (o) {
                    if (!this._rcDeclOrder) return;
                    o.widgets_values = this._rcDeclOrder.map(nm => {
                        const w = (this.widgets || []).find(x => x.name === nm);
                        return w ? w.value : undefined;
                    });
                };
                // Companion: configure() assigns widgets_values by INDEX onto the
                // current (possibly display-reordered) widget array — e.g. during
                // undo/redo on a live node. Re-apply by NAME from declaration order
                // so values always land on the right widgets.
                const origConfigure = node.onConfigure;
                node.onConfigure = function (o) {
                    if (origConfigure) { try { origConfigure.apply(this, arguments); } catch (e) {} }
                    try {
                        if (this._rcDeclOrder && o && Array.isArray(o.widgets_values)) {
                            this._rcDeclOrder.forEach((nm, i) => {
                                if (i >= o.widgets_values.length) return;
                                const w = (this.widgets || []).find(x => x.name === nm);
                                if (w) w.value = o.widgets_values[i];
                            });
                        }
                    } catch (e) {}
                };
            }
            for (const w of node.widgets) {
                const n = w.name.toLowerCase();
                if (w.type === "RC_ADD" || w.type === "RC_NOTE") continue;
                if (n.includes("suppress")) {
                    // node_status (real widget suppress_enable): stays a NATIVE toggle;
                    // _rcSetupABControls gives it the label + position.
                    if (w.value == null) w.value = true;
                } else if (n.includes("mode") || n.includes("status")) {
                    _rcFixToggleDraw(w);
                    if (!w._hooked) {
                        const cb = w.callback;
                        w.callback = function(v) { if(cb) cb(v); _rcEnforceLogic(node); };
                        w._hooked = true;
                    }
                }
                if (n.includes("target")) _rcReplaceWithPicker(node, w);
            }
            const _kind = _rcRemoteKind(node);
            if (_kind === "ab") {
                const realSuppress = node.widgets.find(w => (w.name || "").toLowerCase().includes("suppress"));
                if (realSuppress) _rcSetupABControls(node);
            }
            if (_kind === "single" || _kind === "ab") {
                node._rcGrowable = true;
                if (_kind === "single") node._rcRowX = true;
                else node._rcPairX = true;
                _rcEnsureAddControl(node, _kind);
                _rcApplyReveal(node, _kind);
                if (!node._rcSizedOnce) {
                    node._rcSizedOnce = true;
                    try { node.setSize([node.size[0], node.computeSize()[1]]); } catch (e) {}
                }
            } else if (_kind === "triple" || _kind === "aabb") {
                _rcEnsureLegacyNote(node);
                if (!node._rcSizedOnce) {
                    node._rcSizedOnce = true;
                    try { node.setSize([node.size[0], node.computeSize()[1]]); } catch (e) {}
                }
            }
            _rcEnforceLogic(node);
        }
    }
    // 3. Subgraph Outer Node
    const inner = _rcGetInnerGraph(node);
    if (inner && node.widgets) {
        const innerNodes = inner._nodes || inner.nodes || [];
        
        node.widgets.forEach((w) => {

// Ensure outer Subgraph node control toggles keep custom labels
let _rcSkipConvert = false;
try {
    const _lname0 = (w && w.name ? w.name.split(":").pop().trim().toLowerCase().replace(/_\d+$/, "") : "");
    if (_lname0 === "mode_select" || _lname0 === "switch_status" || _lname0 === "node_status") {
        _rcFixToggleDraw(w);
    }
    // Promoted stacker override toggles (and legacy stacker_mode): leave them
    // ALONE — they are PromotedWidgetViews projecting native toggles. They must
    // not fall through to the picker conversion below.
    if (_lname0 === "stacker_mode" || _lname0 === "global_enable" || _lname0 === "global_mode") {
        _rcSkipConvert = true;
    }
} catch(e) {}
            if (_rcSkipConvert) return;

            if (w.type === "REMOTE_PICKER") return;

            let matchFound = false;

            // STRATEGY A: Check for Input Slots (Wires)
            const inputIdx = node.inputs ? node.inputs.findIndex(inp => inp.name === w.name) : -1;
            if (inputIdx !== -1) {
                const gi = innerNodes.find(n => n.type === "GroupInput" || n.type === "Primitive");
                if (gi) {
                    if (_rcLeadsToRemote(inner, gi, inputIdx, new Set())) {
                        matchFound = true;
                    }
                }
            }

            // STRATEGY B: Check for Fuzzy Widget Name Match (FIXED)
            // Loops through inner nodes and fuzzy matches names to the outer widget
            if (!matchFound) {
                for (const inNode of innerNodes) {
                    const inCC = (inNode.comfyClass || "").toLowerCase();
                    const inTT = (inNode.title || "").toLowerCase();
                    const isRemote = (inCC.startsWith("remote") || inTT.startsWith("remote"));

                    if (isRemote && inNode.widgets) {
                        // FUZZY MATCH CHECK
                        const hasMatchingWidget = inNode.widgets.some(inW => _rcNamesMatch(inW.name, w.name));
                        if (hasMatchingWidget) {
                            matchFound = true;
                            break;
                        }
                    }
                    
                    // Also check for Primitives inside that are named similarly to the widget
                    if (inNode.type === "Primitive" && _rcNamesMatch(inNode.title, w.name)) {
                        if (_rcLeadsToRemote(inner, inNode, 0, new Set())) {
                            matchFound = true;
                            break;
                        }
                    }
                }
            }

            if (matchFound) {
                // Only target pickers should become REMOTE_PICKER on the outer Subgraph node.
                // Never convert control toggles (mode_select / switch_status / node_status).
                const _lname = (w.name || "").split(":").pop().trim().toLowerCase().replace(/_\d+$/, "");
                if (_lname === "mode_select" || _lname === "switch_status" || _lname === "node_status") {
                    // Keep toggle visuals consistent (avoid True/False labels when linked)
                    try { _rcFixToggleDraw(w); } catch(e) {}
                } else {
                    _rcReplaceWithPicker(node, w);
                }
            }
        });
    }
};

app.registerExtension({
    name: "Comfy.RemoteControl",
    
    // Runtime Hook
    async nodeCreated(node) {
        const origDraw = node.onDrawForeground;
        node.onDrawForeground = function(ctx) {
            try { processNode(node); } catch(e) {}
            if (origDraw) origDraw.apply(this, arguments);
        };
        setTimeout(() => { try { processNode(node); } catch(e) {} }, 100);
    },

    // Global Load Hook
    async afterConfigureGraph(missingNodeTypes) {
        if(app.graph && app.graph._nodes) {
            for(const node of app.graph._nodes) {
                try { processNode(node); } catch(e) {}
            }
            // Re-apply stacker global overrides after all nodes are processed
            setTimeout(() => {
                for(const node of app.graph._nodes) {
                    if ((node.comfyClass || "").toLowerCase() === "remotestacker") {
                        try {
                            const mode = (node.properties && node.properties._rcStackerMode) || "user";
                            if (mode !== "user") {
                                _rcStackerApplyGlobal(node);
                            }
                        } catch(e) {}
                    }
                }
            }, 300);
        }
    }
});