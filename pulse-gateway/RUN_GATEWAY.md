# Quick Start: Python Gateway

## 1. Install Python Dependencies

```bash
cd pulse-gateway
pip install -r requirements.txt
```

## 2. Configure Serial Port

### Windows
```powershell
$env:PULSE_NORVI_PORT="COM3"  # Check Device Manager for correct port
$env:PULSE_NORVI_BAUD="115200"
```

### Linux/Mac
```bash
export PULSE_NORVI_PORT="/dev/ttyUSB0"  # or /dev/ttyACM0
export PULSE_NORVI_BAUD="115200"
```

## 3. Run Gateway

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The gateway will be available at `http://localhost:8000`

## 4. Test Connection

```bash
# Health check
curl http://localhost:8000/health

# Get status
curl http://localhost:8000/status

# Recent EIDs
curl http://localhost:8000/eid/recent
```

## 5. Update Node Backend

In your main project folder, set:

```bash
$env:PULSE_SIM_MODE="0"  # Disable simulator
$env:PULSE_GATEWAY_URL="http://localhost:8000"
```

Then restart your Node server.
