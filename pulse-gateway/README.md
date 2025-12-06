# Pulse Hardware Gateway

Python FastAPI service that bridges the Node.js backend with NORVI ESP32 hardware via serial communication.

## Features

- Serial communication with NORVI ESP32 controller
- Real-time status updates via WebSocket
- REST API for hardware commands
- Feed head control (bail feeders)
- Drafting gate control
- EID reader event streaming

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Configuration

Set environment variables:

```bash
# Serial port configuration
export PULSE_NORVI_PORT="/dev/ttyUSB0"  # Linux: /dev/ttyUSB0, /dev/ttyACM0, etc.
# set PULSE_NORVI_PORT=COM3             # Windows: COM3, COM4, etc.

export PULSE_NORVI_BAUD="115200"        # Baud rate (default: 115200)
```

## Running

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```
GET /health
Response: { "ok": true }
```

### Get Hardware Status
```
GET /status
Response: {
  "b1": { "actual": 120, "target": 250, "state": 1 },
  "b2": { "actual": 0, "target": 0, "state": 0 }
}
```

States: 0=IDLE, 1=FEEDING, 2=DONE, 3=JAM

### Start Feed
```
POST /feed/start
Body: { "bail": 1, "grams": 250 }
Response: { "ok": true }
```

### Stop Feed
```
POST /feed/stop
Body: { "bail": 1 }
Response: { "ok": true }
```

### Send Draft Command
```
POST /draft
Body: { "direction": "left" | "right" | "straight" }
Response: { "ok": true }
```

### Get Recent EID Events
```
GET /eid/recent
Response: [
  { "eid": "982123456789012", "timestamp": "2024-01-15T10:30:00.000Z" },
  ...
]
```

### WebSocket Connection
```
WS /ws
```

Receives real-time frames:
- `{ "type": "status", "data": HardwareStatus }`
- `{ "type": "eid", "data": EidEvent }`
- `{ "type": "draft-events", "data": {...} }`

## Serial Protocol

The gateway expects the ESP32 to send ASCII lines over serial:

### Status Updates
```
STAT B1 120/250 1
STAT B2 0/0 0
```

### EID Events
```
EID 982123456789012
```

### Acknowledgments
```
ACK FEED B1
ERR FEED B2 JAM
PONG
```

## Commands Sent to ESP32

```
FEED B1 250
STOP B1
DRAFT LEFT
DRAFT RIGHT
DRAFT STRAIGHT
PING
```

## Architecture

- `app/models.py` - Pydantic models for request/response validation
- `app/serial_manager.py` - Serial communication and line parsing
- `app/main.py` - FastAPI application and WebSocket manager

## Troubleshooting

### Serial port not found
- Check connected devices: `ls /dev/tty*` (Linux) or Device Manager (Windows)
- Ensure ESP32 is connected via USB
- Install CH340/CP2102 drivers if needed

### Permission denied on serial port (Linux)
```bash
sudo usermod -a -G dialout $USER
# Log out and back in for group changes to take effect
```

### Connection timeout
- Verify baud rate matches ESP32 firmware (default: 115200)
- Check serial cable quality
- Ensure ESP32 is running compatible firmware
