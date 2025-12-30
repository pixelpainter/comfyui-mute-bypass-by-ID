from .remote_control import RemoteControl, RemoteControlMulti, RemoteSwitch, RemoteSwitchMulti

NODE_CLASS_MAPPINGS = {
    "RemoteControl": RemoteControl,
    "RemoteControlMulti": RemoteControlMulti,
    "RemoteSwitch": RemoteSwitch,
    "RemoteSwitchMulti": RemoteSwitchMulti
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RemoteControl": "remote mb single",
    "RemoteControlMulti": "remote mb triple",
    "RemoteSwitch": "remote switch",
    "RemoteSwitchMulti": "remote switch double"
}

WEB_DIRECTORY = "./js"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']