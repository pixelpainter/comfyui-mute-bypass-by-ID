# comfyui-mute-bypass-by-ID
2 custom nodes for Comfyui for Muting or Bypassing a node, by node ID. They are widget linkable/promotable as a subgraph switch **or can be used as a stand alone node**. They can also mute/bypass in nested subgraphs by ID.

image 1 - promoted widgets / image 2 - linked widgets. either method will work the same way.

Widget 1 - Choose either mute or bypass mode with first switch
Widget 2 - Control active or mute/bypass with 2nd switch (turn mute/bypass on or off)
Widget 3 - Add Node ID to 3rd switch to control your desired node. This node can also be buried under several nested subgraphs and should still work. 
(The only issue is if Comfyui changes the node ID or duplicates a node ID, but this is rare. To fix this issue, duplicate your node to give it a new ID and use the duplicated node instead.)

In the example below, to optimize the Subgrah, only the switch itself has been promoted/linked to the Subgraph node to minimize the Subgraph real estate. The settings can be adjusted on the Subgraph canvas. If you choose, all of the node widgets can be linked or promoted.

Example of a Subgraph Canvas with 2 single mute/bypass nodes which can switch between a single or dual clip setup. The widgets have been promoted.
<img width="1252" height="436" alt="Subgraph promoted" src="https://github.com/user-attachments/assets/4ab0b889-b27e-4512-ba08-3a2db4734e98" />

Same setup as linked widgets
<img width="1580" height="725" alt="subgraph linked widgets" src="https://github.com/user-attachments/assets/5fbab389-4750-4d64-8ed4-3cf83afec5c8" />

The front facing Subgraph node with widgets, only the mute/bypass switch widhget has been linked/promoted to the Subgraph
<img width="670" height="500" alt="Subgraph Node with widget switches" src="https://github.com/user-attachments/assets/631d777d-f183-4cca-aef7-267f17823840" />

The 2nd node in this set is exactly the same, but can control 1-3 node ID's simultaneously.
