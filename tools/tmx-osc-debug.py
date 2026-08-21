#!/usr/bin/env python3
"""
TotalMix Global OSC debug tool for macOS (and any OS with Python 3).
No dependencies — uses only the standard library.

IMPORTANT: quit Stream Deck first, or the plugin will hold the receive port.

Usage:

  Monitor everything TotalMix sends, and type commands to send:
      python3 tmx-osc-debug.py monitor

  Just listen:
      python3 tmx-osc-debug.py listen

  Send one message and exit:
      python3 tmx-osc-debug.py send /sendall 1.0
      python3 tmx-osc-debug.py send /input/0/faderlin 0.75
      python3 tmx-osc-debug.py send /mix/in/0/6/faderlin 0.75

  In monitor mode, type at the prompt:
      /input/0/mute 1
      /sendall 1
      /snapshot/load/2 1
  Values are sent as OSC floats. Prefix with i: for int, s: for string:
      /input/0/name s:Vocals

Ports default to the Global OSC controller-2 defaults; override with flags:
      --host 127.0.0.1   where TotalMix runs
      --send-port 7002   TotalMix "Port incoming"
      --listen-port 9002 TotalMix "Port outgoing"
"""

import argparse
import socket
import struct
import sys
import threading
import time


# --- OSC 1.0 codec (floats, ints, strings; bundles) ---------------------------

def _pad4(n: int) -> int:
    return (n + 3) & ~3


def osc_string(s: str) -> bytes:
    raw = s.encode("utf-8") + b"\0"
    return raw + b"\0" * (_pad4(len(raw)) - len(raw))


def encode(address: str, value) -> bytes:
    if isinstance(value, float):
        return osc_string(address) + osc_string(",f") + struct.pack(">f", value)
    if isinstance(value, int):
        return osc_string(address) + osc_string(",i") + struct.pack(">i", value)
    return osc_string(address) + osc_string(",s") + osc_string(str(value))


def _read_string(buf: bytes, pos: int):
    end = buf.index(b"\0", pos)
    return buf[pos:end].decode("utf-8", "replace"), pos + _pad4(end - pos + 1)


def decode(buf: bytes, depth: int = 0):
    """Yields (address, [values]) for every message, unwrapping bundles."""
    if depth > 8 or len(buf) < 4:
        return
    if buf.startswith(b"#bundle\0"):
        pos = 16  # tag + timetag
        while pos + 4 <= len(buf):
            (size,) = struct.unpack(">i", buf[pos:pos + 4])
            pos += 4
            if size <= 0 or pos + size > len(buf):
                return
            yield from decode(buf[pos:pos + size], depth + 1)
            pos += size
        return
    try:
        address, pos = _read_string(buf, 0)
        if not address.startswith("/"):
            return
        tags, pos = _read_string(buf, pos)
        values = []
        for tag in tags.lstrip(","):
            if tag == "f":
                values.append(struct.unpack(">f", buf[pos:pos + 4])[0]); pos += 4
            elif tag == "i":
                values.append(struct.unpack(">i", buf[pos:pos + 4])[0]); pos += 4
            elif tag in "sS":
                v, pos = _read_string(buf, pos); values.append(v)
            elif tag == "T":
                values.append(True)
            elif tag == "F":
                values.append(False)
            else:
                break  # unknown width — stop rather than misalign
        yield address, values
    except (ValueError, struct.error, IndexError):
        return


# --- modes --------------------------------------------------------------------

def make_send_socket():
    return socket.socket(socket.AF_INET, socket.SOCK_DGRAM)


def parse_value(raw: str):
    if raw.startswith("s:"):
        return raw[2:]
    if raw.startswith("i:"):
        return int(raw[2:])
    try:
        return float(raw)
    except ValueError:
        return raw  # send as string


def run_listen(args, also_send: bool):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", args.listen_port))
    except OSError as e:
        print(f"Cannot bind udp/{args.listen_port}: {e}")
        print("Quit Stream Deck first — the plugin holds this port while running.")
        sys.exit(1)

    print(f"Listening on udp/{args.listen_port}; sending to {args.host}:{args.send_port}")
    print("Every inbound OSC message is printed as: HH:MM:SS.mmm  address = value")
    if also_send:
        print("Type 'address value' to send (float by default, i: int, s: string). Ctrl-C to quit.\n")

    def rx():
        while True:
            data, _ = sock.recvfrom(65536)
            ts = time.strftime("%H:%M:%S") + f".{int(time.time() * 1000) % 1000:03d}"
            for address, values in decode(data):
                vs = ", ".join(f"{v:.4f}" if isinstance(v, float) else repr(v) for v in values)
                print(f"{ts}  {address} = {vs}")

    threading.Thread(target=rx, daemon=True).start()

    if not also_send:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            return

    try:
        for line in sys.stdin:
            parts = line.strip().split(None, 1)
            if not parts:
                continue
            address = parts[0]
            value = parse_value(parts[1]) if len(parts) > 1 else 1.0
            sock.sendto(encode(address, value), (args.host, args.send_port))
            print(f"      -> sent {address} = {value}")
    except KeyboardInterrupt:
        pass


def run_send(args):
    value = parse_value(args.value)
    make_send_socket().sendto(encode(args.address, value), (args.host, args.send_port))
    print(f"sent {args.address} = {value} to {args.host}:{args.send_port}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--send-port", type=int, default=7002)
    p.add_argument("--listen-port", type=int, default=9002)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("listen")
    sub.add_parser("monitor")
    ps = sub.add_parser("send")
    ps.add_argument("address")
    ps.add_argument("value", nargs="?", default="1.0")

    args = p.parse_args()
    if args.cmd == "send":
        run_send(args)
    else:
        run_listen(args, also_send=(args.cmd == "monitor"))


if __name__ == "__main__":
    main()
