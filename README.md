# comfyui-mute-bypass-by-I
2 custom nodes for Comfyui for Muting or Bypassing a node, by node ID. They are widget linkable/promotable as a subgraph switch **or can be used as a stand alone node**. They can also mute/bypass in nested subgraphs by ID.

Custom Node available widgets

Widget 1 - Choose either mute or bypass mode with first switch.

Widget 2 - Control active or mute/bypass with 2nd switch (turn mute/bypass on or off)

Widget 3 - Add Node ID to 3rd widget to control your desired node. The node ID can be buried under several nested subgraphs and should still work
 
(The only issue is if Comfyui changes the node ID or duplicates a node ID, but this is rare. To fix this issue, duplicate your node to give it a new ID and use the duplicated node instead.)

image 1 - promoted widgets / image 2 - linked widgets. Either method will work the same way.

In the example below, to optimize the Subgraph, only the mute/bypass switch has been promoted/linked to the Subgraph node to minimize the Subgraph real estate. The settings can be adjusted on the Subgraph canvas. If you choose, all of the node widgets can be linked or promoted.

Example of a Subgraph Canvas with 2 single mute/bypass nodes which can used to switch between a single or dual clip setup by muting one of the clips nodes. The widgets have been promoted.

<img width="1252" height="436" alt="Subgraph promoted" src="https://github.com/user-attachments/assets/4ab0b889-b27e-4512-ba08-3a2db4734e98" />

The same setup as above with linked widgets

<img width="1580" height="725" alt="subgraph linked widgets" src="https://github.com/user-attachments/assets/5fbab389-4750-4d64-8ed4-3cf83afec5c8" />

The front facing Subgraph node with widgets, only the mute/bypass switch widget has been linked/promoted to the Subgraph

<img width="670" height="500" alt="Subgraph Node with widget switches" src="https://github.com/user-attachments/assets/631d777d-f183-4cca-aef7-267f17823840" />

The 2nd node in this set is exactly the same, but can control 1-3 node ID's simultaneously. 

The example below uses a triple node in bypass mode as a stand alone node on the main canvas. (the single switch can also be used as a stand alone node)

<img width="715" height="670" alt="triple bypass satand alone" src="https://github.com/user-attachments/assets/475fb522-5ebd-4da9-90a8-72135de7cadc" />

I built these nodes for personal use, but if you like what I have done and want to say thank you, feel free to buy me a coffee
<img width="27" height="39" alt="image" src="https://github.com/user-attachments/assets/8b5fde6c-059c-4581-a385-b619b28b5447" /> https://buymeacoffee.com/pixelpainter

