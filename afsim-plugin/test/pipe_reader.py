"""
Test script to verify wsf_event_gateway plugin outputs events on named pipe.
Connects to \\.\pipe\afsim_events, reads length-prefixed protobuf messages.

Usage: Start this FIRST, then run mission.exe in another terminal.
"""

import struct
import sys
import win32file
import pywintypes

PIPE_NAME = r"\\.\pipe\afsim_events"

def main():
    print(f"Connecting to {PIPE_NAME}...")
    try:
        handle = win32file.CreateFile(
            PIPE_NAME,
            win32file.GENERIC_READ,
            0, None,
            win32file.OPEN_EXISTING,
            0, None
        )
    except pywintypes.error as e:
        print(f"Failed to connect: {e}")
        print("Make sure mission.exe is running with the event_gateway plugin enabled.")
        return

    print("Connected! Reading events...")
    event_count = 0

    try:
        while True:
            hr, length_data = win32file.ReadFile(handle, 4)
            if hr != 0 or len(length_data) < 4:
                print("Pipe closed or error reading length.")
                break

            msg_len = struct.unpack("<I", length_data)[0]
            if msg_len == 0 or msg_len > 64 * 1024 * 1024:
                print(f"Invalid message length: {msg_len}")
                break

            # Read full message body (may need multiple reads for large messages)
            data = b""
            remaining = msg_len
            while remaining > 0:
                hr, chunk = win32file.ReadFile(handle, remaining)
                if hr != 0:
                    print(f"Read error: hr={hr}")
                    break
                data += chunk
                remaining -= len(chunk)

            if len(data) < msg_len:
                print(f"Incomplete read: got {len(data)}, expected {msg_len}")
                break

            event_count += 1
            sim_time = 0.0
            event_type = "unknown"

            # Parse sim_time: field 1 (tag=0x09), double, 8 bytes LE
            if len(data) >= 9 and data[0] == 0x09:
                sim_time = struct.unpack("<d", data[1:9])[0]

            # Identify oneof payload by scanning field tags after sim_time
            pos = 9
            while pos < min(len(data), pos + 30):
                if pos >= len(data):
                    break
                byte = data[pos]
                wire_type = byte & 0x07
                field_num = byte >> 3

                if wire_type == 0:  # varint
                    type_map = {
                        2: "sim_starting", 3: "sim_complete",
                        4: "sim_pausing", 5: "sim_resuming", 6: "frame_complete",
                        10: "platform_added", 11: "platform_initialized",
                        12: "platform_deleted", 13: "platform_broken",
                        14: "platform_damage_changed",
                        20: "mover_updated",
                        30: "sensor_turned_on", 31: "sensor_turned_off",
                        32: "sensor_detection_changed",
                        40: "weapon_fired", 41: "weapon_hit",
                        42: "weapon_missed", 43: "weapon_terminated",
                        50: "track_initiated", 51: "track_updated",
                        52: "track_dropped",
                        60: "zone_entered", 61: "zone_exited",
                        70: "fuel_event", 80: "comment",
                    }
                    if field_num in type_map:
                        event_type = type_map[field_num]
                        break
                    # skip this varint value
                    pos += 1
                    while pos < len(data) and data[pos] & 0x80:
                        pos += 1
                    pos += 1
                elif wire_type == 2:  # length-delimited
                    # skip field tag + length + data
                    pos += 1
                    if pos < len(data):
                        length = data[pos]
                        if length & 0x80:
                            # multi-byte varint length
                            pos += 1
                            break  # too complex, stop scanning
                        pos += 1 + length
                    else:
                        break
                elif wire_type == 1:  # 64-bit
                    pos += 9
                elif wire_type == 5:  # 32-bit
                    pos += 5
                else:
                    break

            print(f"  [{event_count:4d}] t={sim_time:10.2f}s  {event_type}  ({msg_len} bytes)")

            # Stop after enough events
            if event_count >= 200:
                print("Reached 200 events, stopping.")
                break

    except KeyboardInterrupt:
        print("\nInterrupted.")
    except pywintypes.error as e:
        print(f"Pipe error: {e}")
    finally:
        win32file.CloseHandle(handle)

    print(f"\nTotal events received: {event_count}")


if __name__ == "__main__":
    main()
