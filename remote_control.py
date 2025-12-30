import torch

class RemoteControl:
    """remote mb single"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
                "node_status": ("BOOLEAN", {"default": True, "label_on": "active", "label_off": "mute/bypass"}),
                "target_node": ("STRING", {"default": "", "multiline": False}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, mode_select, node_status, target_node, unique_id=None):
        return ()


class RemoteControlMulti:
    """remote mb triple"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
                "node_status": ("BOOLEAN", {"default": True, "label_on": "active", "label_off": "mute/bypass"}),
                "target_node_1": ("STRING", {"default": "", "multiline": False}),
                "target_node_2": ("STRING", {"default": "", "multiline": False}),
                "target_node_3": ("STRING", {"default": "", "multiline": False}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, mode_select, node_status, target_node_1, target_node_2, target_node_3, unique_id=None):
        return ()


class RemoteSwitch:
    """Switch between two targets (A vs B)"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # CHANGED: Now a real BOOLEAN to match other nodes
                "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
                "switch_status": ("BOOLEAN", {"default": True, "label_on": "Side A Active", "label_off": "Side B Active"}),
                "target_node_A": ("STRING", {"multiline": False, "default": ""}),
                "target_node_B": ("STRING", {"multiline": False, "default": ""}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, **kwargs):
        return ()


class RemoteSwitchMulti:
    """Switch between two pairs of targets (A1/A2 vs B1/B2)"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # CHANGED: Now a real BOOLEAN to match other nodes
                "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
                "switch_status": ("BOOLEAN", {"default": True, "label_on": "Side A Active", "label_off": "Side B Active"}),
                "target_node_A1": ("STRING", {"multiline": False, "default": ""}),
                "target_node_A2": ("STRING", {"multiline": False, "default": ""}),
                "target_node_B1": ("STRING", {"multiline": False, "default": ""}),
                "target_node_B2": ("STRING", {"multiline": False, "default": ""}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, **kwargs):
        return ()