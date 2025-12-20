# comfyui-mute-bypass-by-ID
2 custom nodes for Comfyui for muting or bypassing a node by node ID. They are widget linkable/promotable as a subgraph switch **or can be used as a stand alone node**. They can also mute/bypass in nested subgraphs by ID.

Custom Node available widgets

Widget 1 - Choose either mute or bypass mode with first switch.

Widget 2 - Control active or mute/bypass with 2nd switch (turn mute/bypass on or off)

Widget 3 - Add Node ID to 3rd widget to control your desired node. The node ID can be buried under several nested subgraphs and should still work
 
(The only issue I have run into is when Comfyui changes the node ID or duplicates a node ID, but this is uncommon. To fix a node ID which has been changed, just update with the new ID. To fix a duplicate ID issue, duplicate the node you wish to mute or bypass, the duplicate will be assigned a new ID, swap out the original node with the duplicated node with the new ID.)

In the example below, to optimize the Subgraph, only the mute/bypass switch has been promoted/linked to the Subgraph node to minimize the Subgraph real estate usage. The settings can be adjusted on the Subgraph canvas. If you choose, all of the node widgets can be linked or promoted.

Example of a Subgraph Canvas with 2 single mute/bypass nodes which can be used to switch between a single or dual clip setup by muting one of the clips nodes. The widgets have been promoted.

https://github.com/user-attachments/assets/5d42161f-b760-472c-a6f9-3723366e67b3

The same setup as above with linked widgets

<img width="1580" height="725" alt="subgraph linked widgets" src="https://github.com/user-attachments/assets/5fbab389-4750-4d64-8ed4-3cf83afec5c8" />

The front facing Subgraph node with widgets, only the mute/bypass switch widget has been linked/promoted to the Subgraph. Using the linked or promoted widget switch will mute or bypass a node by the ID added on the mute/bypass node on the Subgraph canvas.

https://github.com/user-attachments/assets/d3ef2dd3-e04e-4317-8ca2-8fa10d04e125


The 2nd node in this set is exactly the same, but can control 1-3 node ID's simultaneously. 

The example below uses a triple node in bypass mode as a stand alone node on the main canvas. (the single switch can also be used as a stand alone node)

<img width="715" height="670" alt="triple bypass satand alone" src="https://github.com/user-attachments/assets/475fb522-5ebd-4da9-90a8-72135de7cadc" />




