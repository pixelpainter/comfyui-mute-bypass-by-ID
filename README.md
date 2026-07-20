# comfyui-mute-bypass-by-ID

Remotely **mute or bypass any node in your workflow by its node ID** — even nodes buried inside nested Subgraphs — from a single compact control node. All controls are standard ComfyUI widgets, so they can be **linked or promoted to Subgraph nodes** and used as top-level switches.

This pack includes **5 custom nodes**:

* **Mute Bypass by ID — Single**: mute/bypass 1 target, growable up to **20 targets** with the **+ Node** button.
* **Mute Bypass by ID — A/B**: toggle between two targets (A active mutes/bypasses B and vice-versa), growable up to **10 A/B pairs** with the **+ Pair** button. Includes a *node status* control to run both sides at once.
* **Mute Bypass by ID — Stacker**: a master control panel that lists your Remote Control nodes in one place, with per-row controls and a **global Mute / Bypass / User override**.
* **Mute Bypass by ID — Triple** *(legacy)*: mute/bypass any combination of 1–3 nodes. Kept for compatibility — use the growable Single node instead.
* **Mute Bypass by ID — AA/BB** *(legacy)*: switches two A/B pairs at once. Kept for compatibility — use the growable A/B node instead.

If you like these nodes, please think about giving me a star!

---

## Changelog

**07/15/2026 — Version 2.5.1**

* **A/B switch: new *node status* toggle** — the same control as on the Single node. In its default state (*Muted / Bypassed*) the A/B switch works exactly like before: the inactive side is muted/bypassed. Flip it to **Active** and *both* sides run at the same time. Existing A/B workflows load and behave identically.
* **Simplified controls** — the experimental per-row state and per-node master controls were rolled back to standard ComfyUI toggles, which promote and link to Subgraph nodes reliably across frontend versions.
* **Stacker: promotable global override** — the User/Mute/Bypass header buttons were replaced by two native toggles (*user/global* and *mute/bypass*). Promote them to a Subgraph node for a one-click master switch; promoted toggles stay in sync even when flipped through a link.
* **Stacker: full A/B control from the row** — flip the **A/B side** and toggle *node status* directly on the Stacker row. Switching back to *user* restores each node's exact previous state, including which side was active.
* **Stacker rows now show the full ID path** (e.g. `[209:25:103]`) next to the title, instead of a target count.
* **Auto Add now defaults OFF** — the Stacker only claims Remote nodes when you turn it on.
* **Cleanup of deleted and moved targets** — Remote nodes deleted from the graph are pruned from the Stacker after a short grace period instead of lingering as "(missing)" rows; nodes moved between Subgraphs keep working, their reference is fixed automatically.
* **Clearer status pills** — toggles now read out their real effect (*Active / Muted / Bypassed*) with mode colors (grey mute, purple bypass), and the A/B switch reads out both sides, e.g. `A Active · B Bypassed`.
* **Picker and pill display** — picker entries and target pills show the full ID path plus node type, and long values truncate from the left so the ID always stays visible.
* **Save/load hardening** — widget values are always serialized in the original declaration order and re-applied by name on load, so workflows from any version load correctly and undo/redo is safe.
* **Fixes** — stale Stacker saved-states from earlier builds are discarded so returning to *user* can't restore wrong values; the Stacker's background timer is stopped when the node is deleted (memory leak); ghost duplicate nodes in Subgraph scans are filtered out.
* **Security fix** — node/subgraph titles are HTML-escaped in the picker, preventing script injection from shared workflows.
* **UI tweaks** — "+ Target" renamed to **+ Node**; the separate "−" button was replaced by the per-row **✕**. Triple and AA/BB now show a legacy note and will be removed in a future update.

**01/16/2026 — Version 2.1.0**

* Custom UI was causing instability, reverted to standard ComfyUI widgets.
* After a widget has been selected, re-clicking the picker retains the path of the target.
* Since the node target path is retained in the picker, the path underneath the widget was removed to save space and remove clutter.
* Added target node ID path inside the picker, i.e. `[209:25:103]` → [subgraph : subgraph : node target].
* The picker is now linkable and promotable.
* The A/B switch does not visually turn off and on, but remains the same color to indicate that the node is still active.
* Multiple nodes with the same widget name no longer cause a conflict error when promoting or linking.

**12/29/2025 — Major Version Update V2.0.0**

* Reliably mutes or bypasses any node in any Subgraph using the Subgraph ID and Node ID together.
* ComfyUI can sometimes assign a duplicate ID to nodes in different Subgraphs — this update handles duplicate IDs correctly.

---

## The Nodes

### Node 1: Mute Bypass by ID — Single

* Use the **mode select** toggle to change between **Mute** and **Bypass**.
* Use the **node status** toggle to turn the mute/bypass on and off — the pill shows the live result (*Active / Muted / Bypassed*).
* Click a **target** pill to open the picker. Search by node ID or name, or browse by Subgraph group. The picker shows each node's full ID path, so duplicate IDs in different Subgraphs are easy to tell apart.
* Click **+ Node** to add more target rows (up to 20) — all targets follow the same mute/bypass state. Click a row's **✕** to remove just that target.

<img width="315" height="226" alt="image" src="https://github.com/user-attachments/assets/98360aee-2595-445b-90b2-63d696bda232" />

If you search by ID and see 2 nodes with the same ID, check the path for the Subgraph node you are looking for.

<img width="792" height="282" alt="image" src="https://github.com/user-attachments/assets/b7bd8877-c02a-4ddc-a546-9e287d331cbc" />

https://github.com/user-attachments/assets/7a7a38e4-573d-4ee0-aa29-c5f04d130e3c

### Node 2: Mute Bypass by ID — A/B

Toggles between two targets: activating side A mutes/bypasses side B, and activating side B mutes/bypasses side A.

* **switch status** picks the active side — the pill reads out both sides, e.g. `A Active · B Bypassed`.
* **node status** — in its default state (*Muted / Bypassed*) the switch behaves normally: the inactive side is muted/bypassed. Set it to **Active** and *both* sides run, letting you temporarily run both branches without touching your wiring.
* Click **+ Pair** to add more A/B pairs (up to 10) that all flip together with the same switch. Each pair has a **✕** to remove it.

https://github.com/user-attachments/assets/bb9f56bf-f0e2-4828-8c6f-d82e291ac565

### Node 3: Mute Bypass by ID — Stacker

One node to rule them all. Drop a Stacker anywhere in your workflow and it becomes a control panel for your Remote Control nodes:

* **Rows** — each owned Remote node shows its title, ID path, mode, and state. Click the **dot** to toggle it, **M/B** to change its mode, and (for A/B nodes) the **A/B** button to flip sides — all without hunting the node down in the graph.
* **Global override** — flip *user → global* to mute or bypass **all** owned nodes at once (pick which with the *mute/bypass* toggle). Flip back to *user* and every node returns to exactly the state it was in before, including A/B sides. Both toggles are native widgets, so you can promote them to a Subgraph for a one-click master switch.
* **+ Add / Auto Add** — add Remote nodes via a searchable picker, or turn **Auto Add ON** to automatically claim any new Remote node you create.
* **Multiple Stackers** — use several Stackers to organize groups (e.g. one for upscale branches, one for debug nodes) and use **→** to move rows between them.

### Node 4: Mute Bypass by ID — Triple *(legacy)*

Works the same as the Single node, but with 3 fixed target slots. Kept only for old workflows — the Single node with **+ Node** covers this and more. It will be removed in a future update.

<img width="1512" height="423" alt="image" src="https://github.com/user-attachments/assets/0c0c694d-46f1-4ab4-8324-fafd627ce5a0" />

### Node 5: Mute Bypass by ID — AA/BB *(legacy)*

Same as the A/B node, but switches 2 fixed pairs at once. Kept only for old workflows — the A/B node with **+ Pair** covers this and more. It will be removed in a future update.

https://github.com/user-attachments/assets/dd206b9d-5a56-4291-beda-97a83b5e031e

---

## Use Case Scenarios

* **Hi-res fix / upscale on demand** — point a Single node at your upscale chain and flip one switch to run quick drafts or full-quality renders, without rewiring anything.
* **A/B model or sampler comparisons** — put two checkpoints, samplers, or LoRA stacks on the A and B sides and flip between setups with one toggle. Set *node status* to **Active** to render both at once for a side-by-side.
* **Toggle save/preview branches** — mute your SaveImage / preview nodes while iterating, re-enable them for final output.
* **Control Subgraph internals from the top level** — target nodes nested deep inside Subgraphs by their ID chain, and promote the picker and toggles onto the Subgraph node itself so the whole thing behaves like a packaged switch.
* **One master panel** — with a Stacker (and promoted global toggles) you can bypass every optional branch in a big workflow for a fast test render, then restore everything to its exact previous state with one click.
* **Group toggling** — a single growable node with up to 20 targets can mute an entire "debug" set (notes, previews, comparisons) in one shot; multiple Stackers keep different groups organized.

---

These nodes were made with love for personal use, but if you like this node set, feel free to buy me a coffee to help me stay up late lol 😂 <a href="https://buymeacoffee.com/pixelpainter">buymeacoffee/pixelpainter</a>
