import os
import re
import uuid
import asyncio
from typing import Dict, Any, Optional
import yt_dlp

DOWNLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "downloads"))
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# In-memory download task tracker
# { job_id: { "status": "starting|downloading|processing|finished|error", "percent": 0, "speed": "", "eta": "", "filename": "", "filepath": "", "error": "" } }
jobs: Dict[str, Dict[str, Any]] = {}

def format_bytes(size: Optional[int]) -> str:
    if not size or size <= 0:
        return ""
    power = 2**10
    n = 0
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    while size > power and n < len(units) - 1:
        size /= power
        n += 1
    return f"{size:.1f} {units[n]}"

def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def extract_video_info(url: str) -> Dict[str, Any]:
    """
    Extracts metadata, formats and thumbnails using yt-dlp.
    Does not download the video.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
        # Handle playlists or single videos
        if '_type' in info and info['_type'] == 'playlist':
            # It's a playlist
            entries = info.get('entries', [])
            playlist_items = []
            for entry in entries[:30]: # limit to first 30 for snappy response
                if not entry:
                    continue
                playlist_items.append({
                    "id": entry.get("id"),
                    "title": entry.get("title", "Unknown Title"),
                    "duration": entry.get("duration", 0),
                    "duration_string": entry.get("duration_string", ""),
                    "thumbnail": entry.get("thumbnail") or (entry.get("thumbnails", [{}])[-1].get("url") if entry.get("thumbnails") else ""),
                    "url": entry.get("webpage_url") or entry.get("url") or f"https://www.youtube.com/watch?v={entry.get('id')}"
                })
            
            return {
                "is_playlist": True,
                "title": info.get("title", "Playlist"),
                "playlist_count": len(entries),
                "items": playlist_items
            }

        duration = info.get("duration") or 0
        formats = info.get("formats", [])

        # Process and bucket video qualities
        # Targets: 2160p (4K), 1440p (2K), 1080p, 720p, 480p, 360p
        target_heights = [2160, 1440, 1080, 720, 480, 360]
        video_options = []
        seen_heights = set()

        for h in target_heights:
            # Find best video format with height >= h or exact
            matching_vf = [f for f in formats if (f.get("vcodec") != "none" and (f.get("height") == h or (h == 2160 and (f.get("height") or 0) >= 2160)))]
            if matching_vf and h not in seen_heights:
                seen_heights.add(h)
                best_vf = max(matching_vf, key=lambda x: (x.get("tbr") or 0, x.get("filesize") or 0))
                
                # Approximate size calculation
                v_size = best_vf.get("filesize") or best_vf.get("filesize_approx")
                # Add audio size approx (around 128kbps * duration)
                approx_audio = int((128 * 1024 / 8) * duration) if duration else 0
                total_size = (v_size + approx_audio) if v_size else (int((best_vf.get("tbr", 1500) * 1024 / 8) * duration) if duration else 0)

                label_quality = f"{h}p"
                if h == 2160:
                    label_quality = "4K 2160p"
                elif h == 1440:
                    label_quality = "2K 1440p"
                elif h == 1080:
                    label_quality = "1080p Full HD"
                elif h == 720:
                    label_quality = "720p HD"
                elif h == 480:
                    label_quality = "480p SD"
                elif h == 360:
                    label_quality = "360p"

                video_options.append({
                    "height": h,
                    "label": label_quality,
                    "format_id": best_vf.get("format_id"),
                    "ext": "mp4",
                    "filesize_approx_str": format_bytes(total_size) if total_size else "",
                    "fps": best_vf.get("fps"),
                })

        # If no specific heights found (e.g. direct mp4 or platforms like Twitter/TikTok with non-standard resolutions)
        if not video_options:
            video_options.append({
                "height": 1080,
                "label": "Mejor calidad (MP4)",
                "format_id": "bestvideo+bestaudio/best",
                "ext": "mp4",
                "filesize_approx_str": format_bytes(info.get("filesize") or info.get("filesize_approx"))
            })

        # Audio options
        audio_options = [
            {"label": "MP3 320 kbps (Alta fidelidad)", "format": "mp3", "quality": "320", "filesize_approx_str": format_bytes(int(320 * 1024 / 8 * duration)) if duration else ""},
            {"label": "MP3 192 kbps (Estándar)", "format": "mp3", "quality": "192", "filesize_approx_str": format_bytes(int(192 * 1024 / 8 * duration)) if duration else ""},
            {"label": "MP3 128 kbps (Ligero)", "format": "mp3", "quality": "128", "filesize_approx_str": format_bytes(int(128 * 1024 / 8 * duration)) if duration else ""},
            {"label": "M4A / AAC (Original)", "format": "m4a", "quality": "best", "filesize_approx_str": format_bytes(int(160 * 1024 / 8 * duration)) if duration else ""},
            {"label": "FLAC (Sin pérdida)", "format": "flac", "quality": "0", "filesize_approx_str": ""},
        ]

        # Extract thumbnails
        thumbnails = info.get("thumbnails", [])
        thumbnail_url = info.get("thumbnail")
        if not thumbnail_url and thumbnails:
            thumbnail_url = thumbnails[-1].get("url")

        return {
            "is_playlist": False,
            "id": info.get("id"),
            "title": info.get("title", "Unknown Title"),
            "uploader": info.get("uploader") or info.get("channel") or "Desconocido",
            "uploader_url": info.get("uploader_url"),
            "duration": duration,
            "duration_string": info.get("duration_string") or f"{duration // 60}:{duration % 60:02d}",
            "view_count": info.get("view_count"),
            "thumbnail": thumbnail_url,
            "webpage_url": info.get("webpage_url") or url,
            "video_options": video_options,
            "audio_options": audio_options,
            "description": (info.get("description") or "")[:200]
        }

def start_download_task(url: str, format_type: str, quality: str, audio_ext: str = "mp3", trim_start: Optional[str] = None, trim_end: Optional[str] = None) -> str:
    """
    Launches download asynchronously in a background thread and returns a unique job_id.
    """
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "starting",
        "percent": 0,
        "speed": "0 KB/s",
        "eta": "--:--",
        "filename": "",
        "filepath": "",
        "error": ""
    }

    asyncio.create_task(_run_download(job_id, url, format_type, quality, audio_ext, trim_start, trim_end))
    return job_id

async def _run_download(job_id: str, url: str, format_type: str, quality: str, audio_ext: str, trim_start: Optional[str], trim_end: Optional[str]):
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _execute_yt_dlp, job_id, url, format_type, quality, audio_ext, trim_start, trim_end)
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)

def _progress_hook(d: dict, job_id: str):
    job = jobs.get(job_id)
    if not job:
        return
    
    if d.get('status') == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
        downloaded = d.get('downloaded_bytes') or 0
        percent = (downloaded / total * 100) if total > 0 else 0
        
        speed = d.get('speed') or 0
        eta = d.get('eta') or 0

        job["status"] = "downloading"
        job["percent"] = round(percent, 1)
        job["speed"] = f"{speed / 1024 / 1024:.1f} MB/s" if speed else "Calculando..."
        job["eta"] = f"{int(eta)}s" if eta else "--"
    elif d.get('status') == 'finished':
        job["status"] = "processing"
        job["percent"] = 100

def _execute_yt_dlp(job_id: str, url: str, format_type: str, quality: str, audio_ext: str, trim_start: Optional[str], trim_end: Optional[str]):
    output_template = os.path.join(DOWNLOADS_DIR, f"{job_id}_%(title).100s.%(ext)s")

    ydl_opts = {
        'outtmpl': output_template,
        'progress_hooks': [lambda d: _progress_hook(d, job_id)],
        'quiet': True,
        'no_warnings': True,
        'windowsfilenames': True,
    }

    if format_type == "audio":
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': audio_ext if audio_ext in ['mp3', 'm4a', 'flac', 'opus', 'wav'] else 'mp3',
            'preferredquality': quality if quality in ['320', '256', '192', '128'] else '192',
        }]
    else:
        # Video format
        if quality and quality.isdigit():
            h = int(quality)
            ydl_opts['format'] = f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
        else:
            ydl_opts['format'] = 'bestvideo+bestaudio/best'
        ydl_opts['merge_output_format'] = 'mp4'

    # Download trimming support if specified
    if trim_start or trim_end:
        downloader_args = []
        if trim_start:
            downloader_args.extend(['-ss', trim_start])
        if trim_end:
            downloader_args.extend(['-to', trim_end])
        if downloader_args:
            ydl_opts['external_downloader'] = 'ffmpeg'
            ydl_opts['external_downloader_args'] = {'ffmpeg_i': downloader_args}

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        # Find the produced file
        final_filename = ""
        final_filepath = ""

        # Check in downloads directory for files starting with job_id
        for fname in os.listdir(DOWNLOADS_DIR):
            if fname.startswith(job_id):
                final_filename = fname[len(job_id) + 1:] # strip job_id_
                final_filepath = os.path.join(DOWNLOADS_DIR, fname)
                break

        if not final_filepath:
            # Fallback to info['_filename']
            fallback = ydl.prepare_filename(info)
            if os.path.exists(fallback):
                final_filepath = fallback
                final_filename = os.path.basename(fallback)

        jobs[job_id]["status"] = "finished"
        jobs[job_id]["percent"] = 100
        jobs[job_id]["filename"] = final_filename or (info.get("title", "download") + (".mp3" if format_type == "audio" else ".mp4"))
        jobs[job_id]["filepath"] = final_filepath
