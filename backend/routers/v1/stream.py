from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
import collections
import time
from services.data_generator import generate_event

logger = logging.getLogger(__name__)

router = APIRouter()

# Thread-safe/Async-safe connection tracking
active_connections_by_ip = collections.defaultdict(int)
ip_lock = asyncio.Lock()

MAX_CONNECTIONS_PER_IP = 5
SESSION_TIMEOUT_SECONDS = 300.0

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    client_ip = websocket.client.host if websocket.client else "unknown"
    
    # 1. Connection Token Check
    token = websocket.query_params.get("token")
    if not token:
        logger.warning(f"🔌 WebSocket connection rejected from {client_ip} - missing token")
        # According to RFC6455, we close with a custom policy status code
        await websocket.close(code=4001)
        return
        
    # 2. Limit to 5 concurrent connections per IP
    async with ip_lock:
        if active_connections_by_ip[client_ip] >= MAX_CONNECTIONS_PER_IP:
            logger.warning(f"🔌 WebSocket connection rate limit exceeded for IP {client_ip}")
            await websocket.close(code=4002)
            return
        active_connections_by_ip[client_ip] += 1

    logger.info(f"🔌 WebSocket client connected from {client_ip} (Active for IP: {active_connections_by_ip[client_ip]})")
    
    start_time = time.time()
    backoff_delay = 1.5
    
    try:
        await websocket.accept()
        
        while True:
            # 3. Session Timeout of 300s
            elapsed = time.time() - start_time
            if elapsed >= SESSION_TIMEOUT_SECONDS:
                logger.info(f"🔌 WebSocket session timed out after {elapsed:.1f}s for {client_ip}")
                await websocket.close(code=4000)
                break
                
            try:
                event = generate_event()
                await websocket.send_json(event)
                # Reset backoff on successful send
                backoff_delay = 1.5
            except Exception as send_err:
                logger.warning(f"🔌 WebSocket send error to {client_ip}: {send_err}. Applying exponential backoff.")
                # 4. Exponential backoff
                backoff_delay = min(backoff_delay * 2.0, 30.0)
                await asyncio.sleep(backoff_delay)
                continue
                
            await asyncio.sleep(1.5)
            
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket client disconnected from {client_ip}")
    except Exception as e:
        logger.error(f"🔌 WebSocket error for client {client_ip}: {e}")
    finally:
        # 5. Clean state shutdown
        async with ip_lock:
            if active_connections_by_ip[client_ip] > 0:
                active_connections_by_ip[client_ip] -= 1
            if active_connections_by_ip[client_ip] == 0:
                active_connections_by_ip.pop(client_ip, None)
        logger.info(f"🔌 WebSocket connection cleaned up for {client_ip}")
