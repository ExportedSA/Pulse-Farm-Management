import threading
import time
from datetime import datetime
from typing import Optional, Callable, List

import serial

from .models import HardwareStatus, BailStatus, EidEvent


class SerialManager:
    """
    Handles:
      - Opening serial port to NORVI ESP32
      - Sending ASCII commands (FEED, STOP, DRAFT, PING, etc.)
      - Reading lines and updating in-memory status + EID events
      - Broadcasting updates via callbacks
    """

    def __init__(
        self,
        port: str,
        baudrate: int = 115200,
        on_status: Optional[Callable[[HardwareStatus], None]] = None,
        on_eid: Optional[Callable[[EidEvent], None]] = None,
        on_draft_event: Optional[Callable[[dict], None]] = None,
    ):
        self.port_name = port
        self.baudrate = baudrate
        self._ser: Optional[serial.Serial] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

        self._status = HardwareStatus()
        self._eid_events: List[EidEvent] = []

        self.on_status = on_status
        self.on_eid = on_eid
        self.on_draft_event = on_draft_event

    # ---------- Lifecycle ----------

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._ser and self._ser.is_open:
            self._ser.close()

    def _ensure_open(self):
        if self._ser is None or not self._ser.is_open:
            self._ser = serial.Serial(self.port_name, self.baudrate, timeout=0.1)

    # ---------- Public state accessors ----------

    def get_status(self) -> HardwareStatus:
        return self._status

    def get_recent_eids(self, limit: int = 200) -> List[EidEvent]:
        return list(self._eid_events[:limit])

    # ---------- Command senders ----------

    def send_feed(self, bail: int, grams: int):
        cmd = f"FEED B{bail} {grams}\n"
        self._write(cmd)

    def send_stop(self, bail: int):
        cmd = f"STOP B{bail}\n"
        self._write(cmd)

    def send_draft(self, direction: str):
        cmd = f"DRAFT {direction.upper()}\n"
        self._write(cmd)
        if self.on_draft_event:
            self.on_draft_event(
                {"direction": direction, "timestamp": datetime.utcnow().isoformat()}
            )

    def ping(self):
        self._write("PING\n")

    def _write(self, data: str):
        try:
            self._ensure_open()
            self._ser.write(data.encode("utf-8"))
        except Exception as e:
            print(f"[SerialManager] Write error: {e}")

    # ---------- Main read loop ----------

    def _loop(self):
        print(f"[SerialManager] Starting on {self.port_name} @ {self.baudrate}")
        buf = ""
        while self._running:
            try:
                self._ensure_open()
                if self._ser.in_waiting:
                    chunk = self._ser.read(self._ser.in_waiting).decode(
                        "utf-8", errors="ignore"
                    )
                    buf += chunk
                    while "\n" in buf:
                        line, buf = buf.split("\n", 1)
                        line = line.strip()
                        if line:
                            self._handle_line(line)
            except Exception as e:
                print(f"[SerialManager] Loop error: {e}")
                time.sleep(1)

            time.sleep(0.01)

        print("[SerialManager] Stopped")

    # ---------- Line parser ----------

    def _handle_line(self, line: str):
        try:
            if line.startswith("STAT"):
                self._parse_stat(line)
            elif line.startswith("EID"):
                self._parse_eid(line)
            elif line.startswith("ACK") or line.startswith("ERR") or line == "PONG":
                print(f"[SerialManager] {line}")
            else:
                print(f"[SerialManager] Unhandled line: {line}")
        except Exception as e:
            print(f"[SerialManager] Parse error on line '{line}': {e}")

    def _parse_stat(self, line: str):
        # STAT B1 120/250 1
        parts = line.split()
        if len(parts) != 4:
            raise ValueError("bad STAT format")
        _, bail_name, gram_part, state_str = parts
        actual_str, target_str = gram_part.split("/", 1)
        actual = int(actual_str)
        target = int(target_str)
        state = int(state_str)

        bail = BailStatus(actual=actual, target=target, state=state)
        if bail_name == "B1":
            self._status.b1 = bail
        elif bail_name == "B2":
            self._status.b2 = bail

        if self.on_status:
            self.on_status(self._status)

    def _parse_eid(self, line: str):
        # EID 982123456789012
        _, eid = line.split(maxsplit=1)
        evt = EidEvent(eid=eid.strip(), timestamp=datetime.utcnow().isoformat())
        self._eid_events.insert(0, evt)
        self._eid_events = self._eid_events[:200]
        if self.on_eid:
            self.on_eid(evt)
