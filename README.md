# comfyui-mute-bypass-by-ID
This pack includes 4 custom nodes:
If you like and use these nodes, please give me a star!

Mute/Bypass (2 nodes): Can be used standalone or promoted/linked to subgraph widgets. They support targeting nested nodes by ID, even handling duplicate IDs in different Subgraphs correctly.

A/B Switch (2 nodes): Toggles between two target IDs (activating A mutes/bypasses B, and activating B mutes/bypasses A). Includes a standard and a multi-switch variant.

**12/29/2025**
**Major Version Update V2.0.0**   
This will now reliably mute or bypass any node in any Subgraph using the Subgraph ID and Node ID together. Comfyui can sometimes assign a duplicate ID for nodes in different subgraphs, this latest update fixes this issue.

There are 4 nodes total:

**Node 1: Remote Mute Bypass Single**   

Use the Mode Select Button to change from Mute to Bypass\
Use the Active to Mute/Bypass switch to turn mute/bypass on and off

<img width="315" height="226" alt="image" src="https://github.com/user-attachments/assets/98360aee-2595-445b-90b2-63d696bda232" />

Top add a node ID click the dropdown and search by node ID or name, or select a subgraph and node to mute in the menu.

If you search by ID and you see 2 nodes with the same ID check the path for the Subgraph node you are looking for.

<img width="792" height="282" alt="image" src="https://github.com/user-attachments/assets/b7bd8877-c02a-4ddc-a546-9e287d331cbc" />

https://github.com/user-attachments/assets/7a7a38e4-573d-4ee0-aa29-c5f04d130e3c

**Node 2: Remote Mute Bypass Triple**  
This switch works the same as Node 1 but it will mute/bypass any combination of 1-3 nodes at the same time

<img width="1512" height="423" alt="image" src="https://github.com/user-attachments/assets/0c0c694d-46f1-4ab4-8324-fafd627ce5a0" />

**Node 3: Remote A/B mute/bypass switch**  
TThe remaining two nodes toggle between two target IDs (activating A mutes B, and activating B mutes A). Includes a standard and a multi-switch variant.

https://github.com/user-attachments/assets/bb9f56bf-f0e2-4828-8c6f-d82e291ac565

Node 4: Double Remote A/B mute/bypass switch
This is the same as Node 3, but it will take 2 A/B input ID's and will switch mute/bypass state between 2 pairs of nodes

https://github.com/user-attachments/assets/dd206b9d-5a56-4291-beda-97a83b5e031e

These nodes were made with love for personal use, but if you like this node set, feel free to buy me a coffee to help me stay me up late lol 😂 <a href="https://buymeacoffee.com/pixelpainter">buymeacoffee/pixelpainter</a>



