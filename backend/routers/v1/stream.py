from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
from services.data_generator import generate_event

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("🔌 WebSocket client connected")
    try:
        while True:
            event = generate_event()
            await websocket.send_json(event)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
