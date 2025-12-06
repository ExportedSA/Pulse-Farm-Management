# Hardware Module Integration Guide

This document describes the integrated hardware module for Pulse Farm Management, including drafting gates, feed heads, and EID bail readers.

## Architecture Overview

The hardware integration consists of three main components:

1. **Node.js Backend** (`server/`) - Express routes and services that communicate with the gateway or simulator
2. **React Frontend** (`client/src/`) - UI components for hardware control and monitoring (Shed page)
3. **Python Gateway** (`pulse-gateway/`) - FastAPI service that communicates with NORVI ESP32 via serial
4. **ESP32 Firmware** (`firmware-norvi-gate-feed/`) - Embedded code for NORVI hardware controller

## Environment Variables

### Node.js Backend

Add these to your `.env` file or environment:

```bash
# Hardware Module Configuration
PULSE_SIM_MODE=1                              # Set to "1" for demo/training mode (simulator), "0" for real hardware
PULSE_GATEWAY_URL=http://localhost:8000       # URL of the Python gateway (if not using simulator)
PULSE_DEMO_ADMIN_TOKEN=your-secret-token      # Optional: require this token to toggle demo mode via API
```

### Python Gateway

Add these when running the gateway (if using real hardware):

```bash
PULSE_NORVI_PORT=/dev/ttyUSB0    # Serial port where NORVI ESP32 is connected (Windows: COM3, COM4, etc.)
PULSE_NORVI_BAUD=115200          # Serial baud rate (default: 115200)
```

### React Frontend (Vite)

If you want to enable demo mode toggling from the frontend, add this to your `.env` file:

```bash
VITE_DEMO_ADMIN_TOKEN=your-secret-token   # Must match PULSE_DEMO_ADMIN_TOKEN on backend
```

## Features

### Simulator Mode (Training/Demo)
When `PULSE_SIM_MODE=1`, the system runs in training mode with simulated hardware:
- Feed heads simulate dispensing with progress updates
- Drafting gates respond to commands
- EID reader generates simulated tag scans
- No physical hardware or gateway is required

### Real Hardware Mode
When `PULSE_SIM_MODE=0`, the system connects to the Python gateway which controls real hardware:
- Requires Python gateway running and connected to NORVI ESP32
- Full WebSocket support for real-time updates
- Commands sent to physical gates and feed motors

## API Endpoints

All hardware endpoints are mounted at `/api/hardware`:

- `GET /api/hardware/health` - Check gateway/hardware connectivity
- `GET /api/hardware/status` - Get current feed head status (bail 1 & 2)
- `POST /api/hardware/feed/start?bail=1&grams=250` - Start feeding
- `POST /api/hardware/feed/stop?bail=1` - Stop feeding
- `POST /api/hardware/draft` - Send draft command (`{ direction: "left" | "right" | "straight" }`)
- `GET /api/hardware/eid/recent` - Get recent EID scan events
- `GET /api/hardware/draft/rules/preview?eid=982...` - Preview draft rule logic for an EID
- `GET /api/hardware/demo-mode` - Check current demo mode status
- `POST /api/hardware/demo-mode` - Toggle demo mode (`{ demo: true | false }`)

## Frontend Routes

- `/app/shed` - Main hardware control interface with tabs for:
  - Feed Heads - Control bail feeders
  - Drafting Gates - Manual gate control
  - EID Activity - Recent tag scans
  - Draft Rules - Rule inspection tool

## Setup Instructions

### 1. Start Node Server with Simulator

```bash
# Set simulator mode
$env:PULSE_SIM_MODE="1"

# Start server
npm run dev
```

Navigate to `/app/shed` to see the hardware interface with simulated data.

### 2. Setup Python Gateway (Real Hardware)

```bash
# Navigate to gateway folder
cd pulse-gateway

# Install dependencies
pip install -r requirements.txt

# Set serial port (adjust for your system)
$env:PULSE_NORVI_PORT="COM3"  # Windows
# export PULSE_NORVI_PORT="/dev/ttyUSB0"  # Linux

# Run gateway
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Flash ESP32 Firmware (Real Hardware)

```bash
# Navigate to firmware folder
cd firmware-norvi-gate-feed

# Build and upload with PlatformIO
pio run --target upload

# Monitor serial output
pio device monitor
```

### 4. Connect Node Server to Gateway

```bash
# Disable simulator and point to gateway
$env:PULSE_SIM_MODE="0"
$env:PULSE_GATEWAY_URL="http://localhost:8000"

# Start server
npm run dev
```

## File Structure

```
server/
  ├── config/
  │   └── demoMode.ts              # Demo mode state management
  ├── hardware/
  │   ├── coreGatewayBridge.ts     # HTTP/WS client for Python gateway
  │   ├── draftGateBridge.ts       # Draft gate commands
  │   └── eidReaderBridge.ts       # EID event subscriptions
  ├── services/
  │   ├── feedService.ts           # Feed head control logic
  │   ├── draftGateService.ts      # Draft gate service
  │   ├── eidReaderService.ts      # EID event buffering
  │   └── draftRuleInspector.ts    # Draft rule preview logic
  ├── sim/
  │   └── hardwareSimulator.ts     # Simulator for training mode
  ├── types/
  │   └── hardware.ts              # TypeScript types
  └── routes/
      └── hardware.ts              # Express routes

client/src/
  ├── api/
  │   ├── hardwareClient.ts        # Fetch wrappers for hardware API
  │   └── draftRuleClient.ts       # Draft rule API client
  ├── hooks/
  │   ├── usePolling.ts            # Generic polling hook
  │   ├── useHardwareStatus.ts     # Feed status polling
  │   ├── useHardwareHealth.ts     # Health check polling
  │   └── useEidRecent.ts          # EID events polling
  ├── components/dashboard/
  │   ├── SystemHealthBadge.tsx    # Hardware status indicator
  │   ├── FeedHeadPanel.tsx        # Feed control UI
  │   ├── DraftGatePanel.tsx       # Gate control UI
  │   ├── EidPanel.tsx             # EID activity log
  │   └── DraftRuleInspectorPanel.tsx  # Rule debugging UI
  └── pages/
      └── ShedPage.tsx             # Main hardware page

pulse-gateway/
  ├── app/
  │   ├── __init__.py
  │   ├── models.py                # Pydantic models
  │   ├── serial_manager.py        # Serial communication with ESP32
  │   └── main.py                  # FastAPI app
  └── requirements.txt

firmware-norvi-gate-feed/
  ├── platformio.ini               # PlatformIO config
  ├── include/
  │   └── config.h                 # Pin definitions
  └── src/
      └── main.cpp                 # ESP32 firmware (TODO: complete implementation)
```

## Development Notes

- The hardware simulator is automatically started when the Node server boots in simulator mode
- Demo mode can be toggled at runtime via the Shed page UI or the API
- All hardware operations are non-blocking and return immediately
- Status updates are polled at regular intervals (1s for feed status, 5s for health)
- EID events and status updates can be streamed via WebSocket from the Python gateway

## Security

- Use `PULSE_DEMO_ADMIN_TOKEN` to restrict who can toggle demo mode in production
- The Python gateway allows CORS from all origins by default - tighten this for production
- Serial communication with ESP32 is unauthenticated - ensure physical security

## Troubleshooting

**Problem**: Hardware shows offline
- Check that `PULSE_SIM_MODE=0` and `PULSE_GATEWAY_URL` points to running gateway
- Verify Python gateway is running: `curl http://localhost:8000/health`

**Problem**: Simulator not starting
- Check console for "[SIM] Hardware simulator started" message
- Ensure `PULSE_SIM_MODE=1` is set before starting Node server

**Problem**: Cannot toggle demo mode
- Verify `PULSE_DEMO_ADMIN_TOKEN` matches between Node backend and frontend
- Check that you're an admin user with permission to modify settings

**Problem**: Serial port errors in Python gateway
- Verify correct port with `ls /dev/tty*` (Linux) or Device Manager (Windows)
- Check ESP32 is connected and drivers are installed
- Ensure no other program is using the serial port
