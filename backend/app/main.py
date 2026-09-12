import os
import mimetypes
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import router as api_router

# Fix Windows Registry returning 'text/plain' for .js files
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')

app = FastAPI(
    title="YTDLnis Web API",
    description="Backend de alta velocidad para YTDLnis Web con yt-dlp y ffmpeg",
    version="1.0.0"
)

# Enable CORS for local dev servers and clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api")

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "YTDLnis Web"}

# Mount frontend static files if dist exists
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
