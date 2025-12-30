# comfyui-mute-bypass-by-ID
12/29/2025
Major Version Update V2.0.0
This will now reliably mute or bypass any node in any Subgraph using Subgraph and Node ID together. Comfyui can sometimes assign a duplicate ID for nodes in diffrent subgraphs, this latest update fixes this issue.

There are 4 nodes total:

Node 1: Remote Mute Bypass single

Use the Mode Select Button to change from Mute to Bypass
Use the Node Status button to switch between Active and Mute/Bypass state

<img width="315" height="226" alt="image" src="https://github.com/user-attachments/assets/98360aee-2595-445b-90b2-63d696bda232" />

Use the dropdown to either search for a node by ID, or use the menu to click on the Subgraph it is located, and select the node.

If you search by ID and you see 2 nodes with the same ID check the path for the Subgraph node you are looking for.

<img width="792" height="282" alt="image" src="https://github.com/user-attachments/assets/b7bd8877-c02a-4ddc-a546-9e287d331cbc" />







Like this node? Feel free to buy me a coffee <a href="https://buymeacoffee.com/pixelpainter">buymeacoffee/pixelpainter</a> ...or not



Workaround: I am working on an update to fix this (The only issue I have run into is when Comfyui changes the node ID or duplicates a node ID. To fix a node ID which has been changed, just update the mute-bypass node with the new ID. To fix a **duplicate ID** issue, **duplicate the node** you wish to mute or bypass, the newly duplicated node will be assigned a different ID, swap out the original node with the duplicate node and update the mute-bypass node with the new ID.)


