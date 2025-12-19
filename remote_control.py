import torch

class RemoteControl:
    """remote mb single"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # Switch 1: Mode Selection
                "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
                
                # Switch 2: Master Active/Inactive
                # ON = Target Node is ACTIVE (Normal/Green)
                # OFF = Target Node is INACTIVE (Mute or Bypass)
                "node_status": ("BOOLEAN", {"default": True, "label_on": "active", "label_off": "mute/bypass"}),
                
                "node_id": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, mode_select, node_status, node_id):
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
                
                "node_id_1": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
                "node_id_2": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
                "node_id_3": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1, "display": "number"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "Custom/Remote Mute Bypass"

    def do_nothing(self, mode_select, node_status, node_id_1, node_id_2, node_id_3):
        return ()