import os
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import (
    HardwareStatus,
    HealthResponse,
    FeedCommand,
    DraftCommand,
    EidEvent,
    GatewayFrame,
)
from .serial_manager import SerialManager


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, frame: GatewayFrame):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(frame.dict())
            except WebSocketDisconnect:
                dead.append(ws)
            except Exception as e:
                print(f"[WS] send error: {e}")
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

SERIAL_PORT = os.getenv("PULSE_NORVI_PORT", "/dev/ttyUSB0")
SERIAL_BAUD = int(os.getenv("PULSE_NORVI_BAUD", "115200"))

gateway_status = HardwareStatus()
eid_buffer: List[EidEvent] = []


def on_status_update(status: HardwareStatus):
    global gateway_status
    gateway_status = status
    import asyncio

    asyncio.create_task(
        manager.broadcast(GatewayFrame(type="status", data=status.model_dump()))
    )


def on_eid_event(evt: EidEvent):
    global eid_buffer
    eid_buffer.insert(0, evt)
    eid_buffer = eid_buffer[:200]
    import asyncio

    asyncio.create_task(
        manager.broadcast(GatewayFrame(type="eid", data=evt.model_dump()))
    )


def on_draft_event(evt: dict):
    import asyncio

    asyncio.create_task(
        manager.broadcast(GatewayFrame(type="draft-events", data=evt))
    )


serial_mgr = SerialManager(
    port=SERIAL_PORT,
    baudrate=SERIAL_BAUD,
    on_status=on_status_update,
    on_eid=on_eid_event,
    on_draft_event=on_draft_event,
)

app = FastAPI(title="Pulse Hardware Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    print("[Gateway] Starting serial manager...")
    serial_mgr.start()


@app.on_event("shutdown")
def on_shutdown():
    print("[Gateway] Stopping serial manager...")
    serial_mgr.stop()


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(ok=True)


@app.get("/status", response_model=HardwareStatus)
def status():
    return serial_mgr.get_status()


@app.post("/feed/start")
def feed_start(cmd: FeedCommand):
    try:
        serial_mgr.send_feed(cmd.bail, cmd.grams)
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


@app.post("/feed/stop")
def feed_stop(cmd: FeedCommand):
    try:
        serial_mgr.send_stop(cmd.bail)
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


@app.post("/draft")
def send_draft(cmd: DraftCommand):
    try:
        serial_mgr.send_draft(cmd.direction)
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


@app.get("/eid/recent", response_model=list[EidEvent])
def recent_eid():
    return serial_mgr.get_recent_eids()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] error: {e}")
        manager.disconnect(websocket)
