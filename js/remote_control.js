import { app } from "../../scripts/app.js";

// =========================================================
// CSS Styles
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
.remote-picker-instruction {
    background: #111; color: #fff; font-weight: bold; font-size: 11px;
    padding: 4px 12px; border-radius: 12px; border: 1px solid #444;
    text-align: center; width: fit-content;
}
.remote-picker-list {
    flex: 1; overflow-y: auto; padding: 0; margin: 0; list-style: none;
}
.remote-group-header {
    padding: 10px 15px; background: #2a2a2a; border-bottom: 1px solid #333;
    color: #ddd; font-weight: bold; font-size: 13px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    transition: background 0.1s;
}
.remote-group-header:hover { background: #333; color: #fff; }
.remote-group-header .arrow { font-size: 10px; color: #777; transition: transform 0.2s; }
.remote-group-header.active { background: #333; border-left: 3px solid #66afef; }
.remote-group-header.active .arrow { transform: rotate(90deg); color: #66afef; }
.remote-group-content { background: #151515; display: none; padding: 5px 0; }
.remote-group-content.open { display: block; }
.remote-picker-item {
    padding: 6px 15px 6px 25px; border-bottom: 1px solid #222; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
}
.remote-picker-item:hover { background: #2a3a4a; }
.remote-picker-item.selected { background: #2a4a6a; }
.remote-item-title { color: #ccc; font-size: 13px; }
.remote-item-meta { font-size: 11px; color: #555; font-family: monospace; }
.remote-item-subtext { font-size: 10px; color: #666; display: block; margin-left: 25px; margin-bottom: 4px;}
.remote-picker-list::-webkit-scrollbar { width: 8px; }
.remote-picker-list::-webkit-scrollbar-track { background: #111; }
.remote-picker-list::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
`;

const styleEl = document.createElement("style");
styleEl.innerHTML = REMOTE_CSS;
document.head.appendChild(styleEl);

// Polyfill
if (CanvasRenderingContext2D.prototype.roundRect === undefined) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

app.registerExtension({
    name: "Comfy.RemoteControl",
    async nodeCreated(node) {
        const allowedClasses = [
            "RemoteControl", "RemoteControlMulti", "remote mb single", "remote mb triple",
            "RemoteSwitch", "RemoteSwitchMulti"
        ];
        
        const isRemoteNode = allowedClasses.includes(node.comfyClass) || 
                             (node.title && node.title.toLowerCase().startsWith("remote mb")) ||
                             (node.title && node.title.toLowerCase().startsWith("remote switch"));

        if (!isRemoteNode) return;

        const REFRESH_RATE = 2000; 
        node._nodeMap = new Map(); 
        node._lastScan = 0;

        // -----------------------------------------------------
        // 1. FILTER & GRAPH LOGIC (Prevent Recursion Crash)
        // -----------------------------------------------------
        function isIgnoredNode(n) {
            if (!n || !n.type) return true;
            const t = n.type.toLowerCase();
            const title = (n.title || "").toLowerCase();
            if (allowedClasses.includes(n.type)) return true;
            if (t === "primitive" || t === "reroute" || t === "note") return true;
            if (t.includes("everywhere")) return true;
            const uiBlocklist = ["ui note", "ui title", "ui spacer", "ui divider"];
            if (uiBlocklist.some(x => t.includes(x) || title.includes(x))) return true;
            if (t.startsWith("set") || t.startsWith("get")) return true;
            if (title.startsWith("set ") || title.startsWith("get ")) return true;
            return false;
        }

        function getSubgraphFromNode(n) {
            if (n.subgraph) return n.subgraph;
            if (n.innerGraph) return n.innerGraph;
            if (n.properties?.graph) return n.properties.graph;
            try { if (n.getInnerGraph) return n.getInnerGraph(); } catch(e){}
            try { if (n.getSubgraph) return n.getSubgraph(); } catch(e){}
            return null;
        }

        function traverseGraph(graph, pathPrefix = "Root", parentId = null, visited = new Set()) {
            if (!graph || visited.has(graph)) return;
            visited.add(graph);

            const nodes = graph._nodes ?? graph.nodes ?? [];
            for (const n of nodes) {
                if (!n || n.id === undefined) continue;

                const title = n.title || n.type || ("Node " + n.id);
                let idSuffix = parentId !== null ? ` [${parentId}:${n.id}]` : ` [${n.id}]`;
                const displayPath = `${pathPrefix} > ${title}${idSuffix}`;
                const uniqueKey = `${pathPrefix}::${n.id}`;
                
                const entry = { 
                    node: n, graph: graph, title: title, path: pathPrefix, 
                    fullPathLabel: displayPath, id: n.id, parentId: parentId, key: uniqueKey
                };

                if (!isIgnoredNode(n)) {
                    node._nodeMap.set(uniqueKey, entry);
                    if (!node._nodeMap.has(String(n.id))) node._nodeMap.set(String(n.id), entry);
                }

                const inner = getSubgraphFromNode(n);
                if (inner) traverseGraph(inner, `${pathPrefix} > ${title}`, n.id, visited);
            }
        }

        function refreshNodeMap() {
            try {
                node._nodeMap.clear();
                let rootGraph = app.graph;
                if (app.canvas && app.canvas._graph_stack && app.canvas._graph_stack.length > 0) {
                    rootGraph = app.canvas._graph_stack[0];
                }
                traverseGraph(rootGraph, "Root", null);
                node._lastScan = Date.now();
            } catch (e) {
                // Prevent crash
            }
        }

        function parseValue(val) {
            if (!val) return { title: "None", fullPathLabel: "Select a target...", isError: false };
            let entry = node._nodeMap.get(val);
            if (entry) return entry;
            const parts = val.split("::");
            if (parts.length > 1) {
                const rawID = parts.pop();
                entry = node._nodeMap.get(rawID);
                if (entry) return entry;
            }
            return { title: `Missing Node`, fullPathLabel: `ID/Key: ${val}`, isError: true };
        }

        function fitText(ctx, text, maxWidth) {
            if (!text) return "";
            let width = ctx.measureText(text).width;
            if (width <= maxWidth) return text;
            const ellipses = "...";
            const ellipsesWidth = ctx.measureText(ellipses).width;
            if (maxWidth <= ellipsesWidth) return ".";
            let len = text.length;
            while (width >= maxWidth - ellipsesWidth && len > 0) {
                len--;
                text = text.substring(0, len);
                width = ctx.measureText(text).width;
            }
            return text + ellipses;
        }

        // -----------------------------------------------------
        // 2. DRAWING HELPERS
        // -----------------------------------------------------
        function drawPill(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }

        function drawToggleStandard(ctx, x, y, width, height, value, labelText, labelColor) {
            // Label
            ctx.fillStyle = labelColor || "#FFFFFF"; 
            ctx.textAlign = "left";
            ctx.font = "12px Arial";
            ctx.textBaseline = "middle";
            ctx.fillText(labelText, x + 15, y + height / 2);

            // Toggle
            const toggleR = 8;
            const toggleW = 30;
            const toggleX = x + width - toggleW - 15;
            const toggleY = y + (height / 2);

            // Track
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.roundRect(toggleX, toggleY - toggleR, toggleW, toggleR * 2, toggleR);
            ctx.fill();
            ctx.strokeStyle = "#555";
            ctx.stroke();

            // Dot
            const dotX = value ? (toggleX + toggleW - toggleR) : (toggleX + toggleR);
            ctx.fillStyle = value ? "#6688AA" : "#333";
            ctx.beginPath();
            ctx.arc(dotX, toggleY, toggleR - 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // -----------------------------------------------------
        // 3. WIDGET OVERRIDES
        // -----------------------------------------------------

        // --- A. MODE SELECT (UNIFIED TOGGLE) ---
        function overrideModeSelect(node) {
            const modeW = node.widgets.find(w => w.name === "mode_select");
            if (!modeW) return;

            // Enforce custom toggle type for ALL nodes
            modeW.type = "custom_toggle"; 
            if (modeW.options) modeW.options.values = []; // Clear options to prevent dropdown

            modeW.draw = function(ctx, node, widget_width, y, widget_height) {
                // UNIFIED STATE LOGIC
                // We map both Boolean (Single/Triple) and String (Switch) to a simple Boolean concept
                // Is "Bypass" active?
                let isBypass = false;
                let textVal = "Bypass";

                if (typeof this.value === "boolean") {
                    // Boolean type: False=Bypass, True=Mute
                    isBypass = (this.value === false); 
                    textVal = isBypass ? "Bypass" : "Mute";
                } else {
                    // String type: "Bypass" / "Mute"
                    // Default to Bypass if undefined
                    if (!this.value || this.value === "undefined") isBypass = true;
                    else isBypass = (this.value === "Bypass");
                    textVal = isBypass ? "Bypass" : "Mute";
                }

                // Draw Text
                ctx.fillStyle = "#FFFFFF"; 
                ctx.textAlign = "left";
                ctx.font = "12px Arial";
                ctx.textBaseline = "middle";
                ctx.fillText("Mode Select", 15, y + widget_height / 2);

                ctx.textAlign = "right";
                const switchW = 30;
                const textX = widget_width - switchW - 20;
                ctx.fillText(textVal, textX, y + widget_height / 2);

                // Draw Toggle Switch (Same visual for all)
                const toggleR = 8;
                const toggleX = widget_width - switchW - 15;
                const toggleY = y + (widget_height / 2);

                ctx.fillStyle = "#111";
                ctx.beginPath();
                ctx.roundRect(toggleX, toggleY - toggleR, switchW, toggleR * 2, toggleR);
                ctx.fill();
                ctx.strokeStyle = "#555";
                ctx.stroke();

                // Logic: Bypass (Active/Right), Mute (Inactive/Left)
                // This matches the visual of "Active" switches
                const dotX = isBypass ? (toggleX + switchW - toggleR) : (toggleX + toggleR);
                ctx.fillStyle = isBypass ? "#6688AA" : "#333";
                ctx.beginPath();
                ctx.arc(dotX, toggleY, toggleR - 2, 0, Math.PI * 2);
                ctx.fill();
            };

            modeW.mouse = function(event, pos, node) {
                if (event.type === "pointerdown") {
                    if (typeof this.value === "boolean") {
                        this.value = !this.value;
                    } else {
                        // Handle String Toggle
                        const current = this.value || "Bypass";
                        this.value = (current === "Bypass") ? "Mute" : "Bypass";
                    }
                    
                    if (this.callback) this.callback(this.value);
                    if (node && node.comfyClass === "RemoteSwitchMulti" && typeof enforceState === "function") {
                        enforceState();
                    }
                    node.setDirtyCanvas(true);
                    
                    // STOP PROPAGATION -> Kills dropdown menu for Switch nodes
                    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    return true; 
                }
            };
        }

        // --- B. STATUS SWITCH ---
        function overrideStatusSwitch(node) {
            const switchW = node.widgets.find(w => w.name === "switch_status" || w.name === "node_status");
            const modeW = node.widgets.find(w => w.name === "mode_select");
            
            if (!switchW) return;

            switchW.draw = function(ctx, node, widget_width, y, widget_height) {
                let label = "Active";
                let color = "#FFFFFF"; 

                if (this.name === "switch_status") {
                    label = this.value ? "Switch A Active" : "Switch B Active";
                } else {
                    if (this.value) {
                        label = "Active";
                    } else {
                        // Check Mode Select for label
                        let isBypass = false;
                        if (modeW) {
                            if (typeof modeW.value === "boolean") isBypass = !modeW.value;
                            else isBypass = (modeW.value === "Bypass");
                        }
                        label = isBypass ? "Bypass" : "Mute";
                        color = "#777777"; 
                    }
                }
                drawToggleStandard(ctx, 0, y, widget_width, widget_height, this.value, label, color);
            };
        }

        // --- C. TARGET PILL WIDGET ---
        function addRemoteWidget(node, name, headerLabel) {
            const w = {
                name: name,
                type: "REMOTE_TARGET",
                value: "",
                y: 0,
                options: { serialize: true },
                _headerLabel: headerLabel || null,
                
                draw: function (ctx, node, widget_width, y, widget_height) {
                    try {
                        const now = Date.now();
                        if (now - node._lastScan > REFRESH_RATE) refreshNodeMap();

                        // --- LAYOUT ---
                        const margin = 15;
                        const textPadding = 10;
                        const pillHeight = 22;
                        
                        let yOffset = 0;
                        if (this._headerLabel) {
                            ctx.save();
                            ctx.fillStyle = "#AAAAAA"; 
                            ctx.font = "10px Arial";
                            ctx.textAlign = "left";
                            
                            // Draw Label: Just 3 pixels above where the pill starts
                            // Pill starts at y+15 (if header exists). 
                            // So draw text at y+12 (bottom baseline) or y+10 (middle).
                            // Let's use standard fillText.
                            let _labelY = y + 6;
                            if (this._headerLabel === "Switch B") _labelY -= 2;
                            ctx.fillText(this._headerLabel, margin, _labelY);
                            
                            ctx.restore();
                            yOffset = 15; // Push pill down
                        }

                        const pillY = y + yOffset;
                        const entry = parseValue(this.value);
                        const isError = entry.isError;
                        
                        const wWidth = widget_width - (margin * 2);
                        const pillRadius = pillHeight / 2;

                        drawPill(ctx, margin, pillY, wWidth, pillHeight, pillRadius);
                        ctx.fillStyle = "#222"; 
                        ctx.fill();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = isError ? "#aa4444" : "#444";
                        ctx.stroke();

                        const sharedTextX = margin + textPadding; 
                        const arrowSpace = 20;
                        const maxPillTextWidth = wWidth - textPadding - arrowSpace;
                        
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle"; 
                        const pillCenterY = pillY + (pillHeight / 2);

                        ctx.fillStyle = isError ? "#ff6666" : "#FFFFFF";
                        ctx.font = "12px Arial";
                        
                        let displayTitle = entry.title;
                        if (displayTitle === "None") displayTitle = "None";
                        ctx.fillText(fitText(ctx, displayTitle, maxPillTextWidth), sharedTextX, pillCenterY); 

                        ctx.fillStyle = "#777";
                        const arrowX = margin + wWidth - 12;
                        ctx.beginPath();
                        ctx.moveTo(arrowX - 4, pillCenterY - 3);
                        ctx.lineTo(arrowX + 4, pillCenterY - 3);
                        ctx.lineTo(arrowX, pillCenterY + 3);
                        ctx.fill();

                        ctx.font = "10px Arial";
                        ctx.fillStyle = "#E6E6E6";
                        ctx.textAlign = "left";
                        ctx.textBaseline = "top";
                        
                        let subText = "Select a target...";
                        if (entry.title !== "None" && !entry.isError) {
                            subText = (entry.fullPathLabel || "Unknown path").replace(/^Root\s*>\s*/, "");
                        }
                        ctx.fillText(fitText(ctx, subText, wWidth), margin, pillY + pillHeight + 3);
                    } catch (e) {
                        // Safety
                    }
                },
                mouse: function (event, pos, node) {
                    if (event.type === "pointerdown") showPickerModal(name, this.value);
                    return true;
                },
                computeSize: function(width) {
                    // Height Calculation
                    // If Header: 15px (header) + 22px (pill) + 14px (path) + gap
                    const labelH = this._headerLabel ? 15 : 0; 
                    const pillH = 22;
                    const pathH = 14; 
                    const gap = 4;
                    return [width, labelH + pillH + pathH + gap]; 
                }
            };
            node.addCustomWidget(w);
            return w;
        }

        // -----------------------------------------------------
        // 4. LOGIC & STATE
        // -----------------------------------------------------
        function getTargetMode(modeSelect, isActive) {
            if (isActive) return 0; // Active
            
            let modeVal = "Bypass";
            if (typeof modeSelect.value === "boolean") {
                modeVal = modeSelect.value ? "Mute" : "Bypass"; // True=Mute, False=Bypass
            } else {
                modeVal = modeSelect.value || "Bypass";
            }
            return modeVal === "Mute" ? 2 : 4; 
        }

        function enforceState() {
            try {
                if (!node.widgets) return;
                const switchW = node.widgets.find(w => w.name === "node_status" || w.name === "switch_status");
                const modeW = node.widgets.find(w => w.name === "mode_select");
                if (!switchW || !modeW) return;
                
                const customWidgets = node.widgets.filter(w => w.type === "REMOTE_TARGET");
                let graphChanged = false;
                const isSwitchNode = node.comfyClass.includes("Switch");

                for (const w of customWidgets) {
                    const targetKey = w.value;
                    if (!targetKey) continue;
                    let entry = node._nodeMap.get(targetKey);
                    if (!entry && targetKey.includes("::")) {
                        refreshNodeMap(); entry = node._nodeMap.get(targetKey);
                    }
                    if (!entry) entry = node._nodeMap.get(targetKey);

                    if (entry && entry.node) {
                        let shouldBeActive = false;
                        if (isSwitchNode) {
                            const switchState = switchW.value; 
                            if (w.name.includes("_A")) shouldBeActive = switchState;
                            else if (w.name.includes("_B")) shouldBeActive = !switchState;
                            else shouldBeActive = true; 
                        } else {
                            shouldBeActive = switchW.value;
                        }

                        const targetMode = getTargetMode(modeW, shouldBeActive);
                        if (entry.node.mode !== targetMode) {
                            entry.node.mode = targetMode;
                            if (entry.node.setDirtyCanvas) entry.node.setDirtyCanvas(true, true);
                            graphChanged = true;
                        }
                    }
                }
                if (graphChanged && app.canvas) app.canvas.setDirty(true, true);
            } catch (e) { }
        }

        // -----------------------------------------------------
        // 5. INITIALIZATION
        // -----------------------------------------------------
        const processWidgets = () => {
            if (!node.widgets) return;
            const widgets = [...node.widgets]; 
            const isSwitch = node.comfyClass.includes("Switch");

            let labeledA = false;
            let labeledB = false;

            for (const w of widgets) {
                const name = w.name.toLowerCase();
                const isTarget = w.name.startsWith("target_node") || name.startsWith("target");

                if (w.type !== "converted-widget" && w.type !== "REMOTE_TARGET" && isTarget) {
                    
                    let headerLabel = null;
                    if (isSwitch) {
                        if (w.name.includes("_A") && !labeledA) {
                            headerLabel = "Switch A";
                            labeledA = true; 
                        }
                        if (w.name.includes("_B") && !labeledB) {
                            headerLabel = "Switch B";
                            labeledB = true; 
                        }
                    }

                    const visual = addRemoteWidget(node, w.name, headerLabel);
                    visual.value = w.value;
                    visual.callback = (v) => { w.value = v; enforceState(); };

                    w.type = "converted-widget";
                    w.computeSize = () => [0, 0]; 
                    w.draw = () => {}; 
                    w.linkedWidgets = [visual];
                }
            }
        };

        function showPickerModal(targetWidgetName, currentValue) {
            const overlay = document.createElement("div");
            overlay.className = "remote-picker-overlay";
            const modal = document.createElement("div");
            modal.className = "remote-picker-modal";
            
            const header = document.createElement("div");
            header.className = "remote-picker-header";
            const searchInput = document.createElement("input");
            searchInput.className = "remote-picker-search";
            searchInput.placeholder = "Search...";
            const instructionDiv = document.createElement("div");
            instructionDiv.className = "remote-picker-instruction";
            instructionDiv.innerText = "Search by node ID or name, or select a subgraph and node to mute in the menu below";
            header.appendChild(searchInput);
            header.appendChild(instructionDiv);
            
            const listContainer = document.createElement("div");
            listContainer.className = "remote-picker-list";
            let openGroup = null; 

            const render = () => {
                listContainer.innerHTML = "";
                const filter = searchInput.value.toLowerCase().trim();
                const allEntries = [];
                for (const [key, entry] of node._nodeMap.entries()) {
                    if (key.includes("::")) allEntries.push(entry);
                }

                if (filter.length > 0) {
                    const matches = allEntries.filter(e => 
                        e.title.toLowerCase().includes(filter) || 
                        e.path.toLowerCase().includes(filter) ||
                        String(e.id).includes(filter)
                    );
                    matches.sort((a,b) => a.path.localeCompare(b.path));
                    if (matches.length === 0) {
                        const empty = document.createElement("div");
                        empty.style.padding = "20px"; empty.style.color = "#777"; empty.style.textAlign = "center";
                        empty.innerText = "No matching nodes found.";
                        listContainer.appendChild(empty);
                    }
                    matches.forEach(entry => createNodeItem(entry, listContainer, true));
                    return;
                }

                const groups = {};
                allEntries.forEach(e => {
                    if (!groups[e.path]) groups[e.path] = [];
                    groups[e.path].push(e);
                });

                const sortedPaths = Object.keys(groups).sort((a,b) => {
                    if (a === "Root") return -1;
                    if (b === "Root") return 1;
                    return a.localeCompare(b);
                });

                sortedPaths.forEach(path => {
                    const groupDiv = document.createElement("div");
                    groupDiv.className = "remote-group-header";
                    if (path === openGroup) groupDiv.classList.add("active");
                    const titleSpan = document.createElement("span");
                    titleSpan.innerText = path;
                    const countSpan = document.createElement("span");
                    countSpan.className = "arrow";
                    countSpan.innerText = "▶"; 
                    groupDiv.appendChild(titleSpan);
                    groupDiv.appendChild(countSpan);
                    const contentDiv = document.createElement("div");
                    contentDiv.className = "remote-group-content";
                    if (path === openGroup) contentDiv.classList.add("open");
                    groups[path].sort((a,b) => a.title.localeCompare(b.title));
                    groups[path].forEach(entry => createNodeItem(entry, contentDiv, false));
                    groupDiv.onclick = () => { openGroup = (openGroup === path) ? null : path; render(); };
                    listContainer.appendChild(groupDiv);
                    listContainer.appendChild(contentDiv);
                });
            };

            function createNodeItem(entry, parent, showPathSubtext) {
                const el = document.createElement("div");
                el.className = "remote-picker-item";
                if (entry.key === currentValue) el.classList.add("selected");
                const left = document.createElement("div");
                left.innerHTML = `<div class="remote-item-title">${entry.title}</div>`;
                if (showPathSubtext) left.innerHTML += `<div class="remote-item-subtext">${entry.path}</div>`;
                const right = document.createElement("div");
                right.className = "remote-item-meta";
                right.innerText = `ID: ${entry.id}`;
                el.appendChild(left);
                el.appendChild(right);
                el.onclick = (e) => {
                    e.stopPropagation();
                    const w = node.widgets.find(x => x.name === targetWidgetName && x.type === "REMOTE_TARGET");
                    if (w) { w.value = entry.key; if (w.callback) w.callback(entry.key); }
                    document.body.removeChild(overlay);
                    node.setDirtyCanvas(true);
                };
                parent.appendChild(el);
            }
            render();
            searchInput.oninput = () => render();
            overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
            modal.appendChild(header);
            modal.appendChild(listContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            setTimeout(() => searchInput.focus(), 50);
        }

        const origConfigure = node.configure;
        node.configure = function() {
            if (origConfigure) origConfigure.apply(this, arguments);
            processWidgets();
            overrideModeSelect(node);
            overrideStatusSwitch(node);
            node.setSize(node.computeSize()); 
        };
        
        setTimeout(() => {
            refreshNodeMap();
            processWidgets(); 
            overrideModeSelect(node);
            overrideStatusSwitch(node);
            enforceState();
            node.setSize(node.computeSize()); 
        }, 100);

        const onDrawForeground = node.onDrawForeground;
        node.onDrawForeground = function(ctx) {
            if (onDrawForeground) onDrawForeground.apply(this, arguments);
            enforceState();
        };
    }
});