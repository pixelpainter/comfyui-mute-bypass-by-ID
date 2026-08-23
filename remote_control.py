import torch

class RemoteControl:
    """remote mb single"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        required = {
            "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
            "node_status": ("BOOLEAN", {"default": True, "label_on": "active", "label_off": "mute/bypass"}),
            "target_node": ("STRING", {"default": "", "multiline": False}),
        }
        # Additional target rows (bind up to 20). Appended AFTER the original
        # widgets so existing saved workflows deserialize unchanged; extras default
        # to "". The front end reveals these via "+ Node" and hides unused ones.
        for i in range(2, 21):
            required["target_node_%d" % i] = ("STRING", {"default": "", "multiline": False})
        return {
            "required": required,
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "mute bypass by ID"

    def do_nothing(self, **kwargs):
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
    CATEGORY = "mute bypass by ID"

    def do_nothing(self, **kwargs):
        return ()


class RemoteSwitch:
    """Switch between two targets (A vs B)"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        required = {
            "mode_select": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
            "switch_status": ("BOOLEAN", {"default": True, "label_on": "Side A Active", "label_off": "Side B Active"}),
            "target_node_A": ("STRING", {"multiline": False, "default": ""}),
            "target_node_B": ("STRING", {"multiline": False, "default": ""}),
        }
        # New: suppression on/off. When on (default) the inactive side is muted/
        # bypassed as before; when off, neither side is suppressed (both pass
        # through). Appended after the originals and defaulting to True so existing
        # A/B workflows behave exactly as before.
        required["suppress_enable"] = ("BOOLEAN", {"default": True, "label_on": "suppress", "label_off": "pass through"})
        # Additional A/B pairs (bind up to 10). Appended after the originals;
        # revealed via "+ Pair", unused pairs hidden.
        for i in range(2, 11):
            required["target_node_A%d" % i] = ("STRING", {"multiline": False, "default": ""})
            required["target_node_B%d" % i] = ("STRING", {"multiline": False, "default": ""})
        return {
            "required": required,
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "mute bypass by ID"

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
    CATEGORY = "mute bypass by ID"

    def do_nothing(self, **kwargs):
        return ()

class RemoteStacker:
    """Global mute/bypass stacker - auto-discovers Remote Control nodes and
    provides one-click User / Mute / Bypass override for all of them."""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # Global override as two native toggles (mirrors the Single node's
                # node_status + mode_select pattern). off = User (per-node control);
                # on = override every owned node with global_mode (mute/bypass).
                # Native BOOLEANs are known widget types, so subgraph promotion
                # projects them reliably across frontend versions.
                "global_enable": ("BOOLEAN", {"default": False, "label_on": "global", "label_off": "user"}),
                "global_mode": ("BOOLEAN", {"default": False, "label_on": "mute", "label_off": "bypass"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "mute bypass by ID"

    def do_nothing(self, **kwargs):
        return ()
