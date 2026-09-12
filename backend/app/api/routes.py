import os
import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional

from app.core.ytdlp_runner import (
    extract_video_info,
    start_download_task,
    jobs,
    DOWNLOADS_DIR
)

router = APIRouter()

class InfoRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_type: str = "video"  # "video" or "audio"
    quality: str = "1080"       # e.g., "2160", "1080", "720", "360" or "320", "192", "128"
    audio_ext: str = "mp3"      # "mp3", "m4a", "flac", "opus"
    trim_start: Optional[str] = None
    trim_end: Optional[str] = None

@router.post("/info")
async def get_info(req: InfoRequest):
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="Por favor proporciona una URL válida.")
    
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, extract_video_info, req.url.strip())
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo obtener información del enlace: {str(e)}")

@router.post("/download/start")
async def start_download(req: DownloadRequest):
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="Por favor proporciona una URL válida.")
    
    job_id = start_download_task(
        url=req.url.strip(),
        format_type=req.format_type,
        quality=req.quality,
        audio_ext=req.audio_ext,
        trim_start=req.trim_start,
        trim_end=req.trim_end
    )
    return {"job_id": job_id}

@router.get("/download/progress/{job_id}")
async def get_progress(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Tarea de descarga no encontrada.")
    return job

def remove_temp_file(filepath: str, job_id: str):
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
        if job_id in jobs:
            del jobs[job_id]
    except Exception:
        pass

@router.get("/download/file/{job_id}")
async def get_downloaded_file(job_id: str, background_tasks: BackgroundTasks):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Descarga no encontrada o expirada.")
    
    if job["status"] != "finished":
        raise HTTPException(status_code=400, detail="La descarga aún no ha terminado.")
    
    filepath = job.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="El archivo solicitado ya no está disponible en el servidor.")
    
    filename = job.get("filename") or os.path.basename(filepath)

    # Schedule cleanup after sending file to browser
    background_tasks.add_task(remove_temp_file, filepath, job_id)

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/octet-stream"
    )
