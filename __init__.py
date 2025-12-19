from .remote_control import RemoteControl, RemoteControlMulti

NODE_CLASS_MAPPINGS = {
    "RemoteControl": RemoteControl,
    "RemoteControlMulti": RemoteControlMulti
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RemoteControl": "remote mb single",
    "RemoteControlMulti": "remote mb triple"
}

WEB_DIRECTORY = "./js"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']