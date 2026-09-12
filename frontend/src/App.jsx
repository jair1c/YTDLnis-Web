import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Search, 
  Music, 
  Video, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  Clock, 
  Eye, 
  User, 
  Clipboard, 
  X,
  ListVideo,
  Sparkles,
  Settings
} from 'lucide-react';

const PLATFORMS = [
  { name: 'YouTube', color: 'from-red-500 to-red-700', icon: '▶' },
  { name: 'TikTok', color: 'from-cyan-400 to-pink-500', icon: '🎵' },
  { name: 'Instagram', color: 'from-purple-500 to-orange-500', icon: '📷' },
  { name: 'Twitter / X', color: 'from-sky-400 to-blue-600', icon: '𝕏' },
  { name: 'SoundCloud', color: 'from-orange-500 to-amber-600', icon: '☁' },
];

export default function App() {
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    try {
      return localStorage.getItem('ytdlnis_api_url') || '';
    } catch {
      return '';
    }
  });
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [hasCookies, setHasCookies] = useState(false);
  const [cookiesText, setCookiesText] = useState('');

  const API_BASE = (import.meta.env.VITE_API_URL || customApiUrl || '').replace(/\/$/, '');

  useEffect(() => {
    fetch(`${API_BASE}/api/cookies/status`)
      .then(r => r.json())
      .then(d => { if (d.has_cookies) setHasCookies(true); })
      .catch(() => {});
  }, [API_BASE]);

  const [url, setUrl] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState('');
  
  // Format selection
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'audio' | 'extra'
  const [selectedVideoOption, setSelectedVideoOption] = useState(null);
  const [selectedAudioOption, setSelectedAudioOption] = useState(null);
  
  // Extra options
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [selectedAudioExt, setSelectedAudioExt] = useState('mp3');

  // Download state
  const [downloadJobId, setDownloadJobId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'starting' | 'downloading' | 'processing' | 'finished' | 'error'

  // Auto-paste handler
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        fetchVideoInfo(text);
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const fetchVideoInfo = async (targetUrl = url) => {
    if (!targetUrl.trim()) {
      setError('Por favor ingresa un enlace válido.');
      return;
    }

    setError('');
    setLoadingInfo(true);
    setVideoData(null);
    setDownloadStatus('idle');
    setDownloadProgress(null);

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'No se pudo obtener información del enlace.');
      }

      const data = await res.json();
      setVideoData(data);

      if (!data.is_playlist) {
        // Pre-select 1080p or best available video option
        if (data.video_options && data.video_options.length > 0) {
          const defaultOpt = data.video_options.find(v => v.height === 1080) || data.video_options[0];
          setSelectedVideoOption(defaultOpt);
        }
        // Pre-select 320kbps or 192kbps audio option
        if (data.audio_options && data.audio_options.length > 0) {
          const defaultAud = data.audio_options.find(a => a.quality === '320') || data.audio_options[0];
          setSelectedAudioOption(defaultAud);
        }
      }
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoadingInfo(false);
    }
  };

  // Poll download progress
  useEffect(() => {
    if (!downloadJobId || downloadStatus === 'finished' || downloadStatus === 'error') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/download/progress/${downloadJobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setDownloadProgress(data);
        setDownloadStatus(data.status);

        if (data.status === 'finished') {
          clearInterval(interval);
          // Trigger file download automatically
          window.location.href = `${API_BASE}/api/download/file/${downloadJobId}`;
        } else if (data.status === 'error') {
          clearInterval(interval);
          setError(data.error || 'Ocurrió un error durante la descarga.');
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [downloadJobId, downloadStatus]);

  const handleStartDownload = async (targetVideoUrl = null) => {
    const downloadUrl = targetVideoUrl || (videoData ? videoData.webpage_url : url);
    if (!downloadUrl) return;

    setError('');
    setDownloadStatus('starting');
    setDownloadProgress({ percent: 0, speed: 'Iniciando...', eta: '--' });

    try {
      const payload = {
        url: downloadUrl,
        format_type: activeTab === 'audio' ? 'audio' : 'video',
        quality: activeTab === 'audio' 
          ? (selectedAudioOption?.quality || '320') 
          : (selectedVideoOption?.height ? String(selectedVideoOption.height) : 'best'),
        audio_ext: activeTab === 'audio' ? (selectedAudioOption?.format || selectedAudioExt) : 'mp3',
        trim_start: trimStart.trim() || null,
        trim_end: trimEnd.trim() || null
      };

      const res = await fetch(`${API_BASE}/api/download/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Error al iniciar la descarga.');
      }

      const data = await res.json();
      setDownloadJobId(data.job_id);
    } catch (err) {
      setDownloadStatus('error');
      setError(err.message || 'Error al iniciar la descarga.');
    }
  };

  const formatViews = (views) => {
    if (!views) return '';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M vistas`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K vistas`;
    return `${views} vistas`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', background: 'rgba(9, 13, 22, 0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
            }}>
              <Download size={22} color="#ffffff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  YTDLnis <span style={{ color: '#8b5cf6', WebkitTextFillColor: '#8b5cf6' }}>Web</span>
                </h1>
                <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  v1.0 Oficial
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                Universal Video & Audio Downloader impulsado por yt-dlp & FFmpeg
              </p>
            </div>
          </div>

          {/* Platform Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {PLATFORMS.map((p) => (
              <div 
                key={p.name}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  padding: '6px 12px', 
                  borderRadius: '999px', 
                  background: 'rgba(30, 41, 59, 0.5)', 
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1'
                }}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
            ))}

            <button
              onClick={() => { setShowSettings(!showSettings); setTempApiUrl(customApiUrl); }}
              title="Configurar servidor backend"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: customApiUrl ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: customApiUrl ? '#818cf8' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '840px', width: '100%', margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Backend Configuration Banner for Vercel / Remote Hosting */}
        {(showSettings || (!API_BASE && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) && (
          <div className="glass-panel" style={{ borderRadius: '20px', padding: '20px', border: '1px solid rgba(139, 92, 246, 0.4)', background: 'rgba(30, 27, 75, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={20} color="#a78bfa" />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                  Conectar con Servidor Backend (yt-dlp & FFmpeg)
                </h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '14px', lineHeight: 1.5 }}>
              Para procesar descargas en la nube (ej. Vercel), ingresa la dirección pública de tu backend desplegado en Render, Railway o tu VPS:
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="https://tu-backend.onrender.com"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => {
                  const cleaned = tempApiUrl.trim().replace(/\/$/, '');
                  setCustomApiUrl(cleaned);
                  try {
                    localStorage.setItem('ytdlnis_api_url', cleaned);
                  } catch {}
                  setShowSettings(false);
                }}
                className="btn-glow"
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
            </div>

            {/* Cookies section */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>
                  🍪 Cookies de YouTube (Anti-Bot y videos +18)
                </h4>
                {hasCookies && (
                  <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: '600', background: 'rgba(74, 222, 128, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                    ✓ Cookies activas
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                Si YouTube solicita verificación anti-bot en algún video, pega aquí tus cookies en formato Netscape / cookies.txt:
              </p>
              <textarea
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com TRUE / FALSE ..."
                value={cookiesText}
                onChange={(e) => setCookiesText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                  marginBottom: '8px'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {hasCookies && (
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`${API_BASE}/api/cookies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: '' }) });
                      setHasCookies(false);
                      setCookiesText('');
                    }}
                    style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: 'none', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Borrar cookies
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!cookiesText.trim()) return;
                    const res = await fetch(`${API_BASE}/api/cookies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: cookiesText }) });
                    if (res.ok) {
                      setHasCookies(true);
                      alert('¡Cookies guardadas con éxito!');
                    }
                  }}
                  className="btn-glow"
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Guardar Cookies
                </button>
              </div>
            </div>

          </div>
        )}
        
        {/* Search / Input Card */}
        <div className="glass-panel" style={{ borderRadius: '24px', padding: '24px' }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); fetchVideoInfo(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div 
              className="glass-input"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '6px 8px 6px 18px', 
                borderRadius: '16px' 
              }}
            >
              <Search size={20} color="#818cf8" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Pega aquí el enlace de YouTube, TikTok, Instagram, Twitter, etc..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ 
                  flex: 1, 
                  background: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  color: '#f8fafc', 
                  fontSize: '15px' 
                }}
              />
              
              {url && (
                <button
                  type="button"
                  onClick={() => { setUrl(''); setVideoData(null); setError(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Limpiar enlace"
                >
                  <X size={18} />
                </button>
              )}

              <button
                type="button"
                onClick={handlePaste}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  padding: '8px 12px', 
                  borderRadius: '10px', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid rgba(255, 255, 255, 0.08)', 
                  color: '#cbd5e1', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <Clipboard size={14} />
                <span>Pegar</span>
              </button>

              <button
                type="submit"
                disabled={loadingInfo}
                className="btn-glow"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '10px 22px', 
                  borderRadius: '12px', 
                  border: 'none', 
                  fontWeight: '600', 
                  fontSize: '14px', 
                  cursor: loadingInfo ? 'not-allowed' : 'pointer',
                  opacity: loadingInfo ? 0.7 : 1,
                  flexShrink: 0
                }}
              >
                {loadingInfo ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick suggestions */}
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8' }}>
            <span>Ejemplos rápidos:</span>
            <button
              onClick={() => {
                const sample = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
                setUrl(sample);
                fetchVideoInfo(sample);
              }}
              style={{ background: 'transparent', border: 'none', color: '#a5b4fc', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Rick Astley (YouTube)
            </button>
            <span>•</span>
            <button
              onClick={() => {
                const sample = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
                setUrl(sample);
                fetchVideoInfo(sample);
              }}
              style={{ background: 'transparent', border: 'none', color: '#a5b4fc', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Me at the zoo (Primer video)
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '16px 20px', 
            borderRadius: '16px', 
            background: 'rgba(239, 68, 68, 0.12)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            color: '#fca5a5', 
            fontSize: '14px' 
          }}>
            <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Video Card Loaded */}
        {videoData && !videoData.is_playlist && (
          <div className="glass-panel" style={{ borderRadius: '24px', overflow: 'hidden', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Video Preview Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) 1fr', gap: '20px', alignItems: 'start' }}>
              
              {/* Thumbnail Container */}
              <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9', background: '#020617', border: '1px solid rgba(255,255,255,0.06)' }}>
                {videoData.thumbnail ? (
                  <img 
                    src={videoData.thumbnail} 
                    alt={videoData.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <Video size={36} />
                  </div>
                )}
                
                {/* Duration Badge */}
                {videoData.duration_string && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '8px', 
                    right: '8px', 
                    padding: '3px 8px', 
                    borderRadius: '6px', 
                    background: 'rgba(0,0,0,0.85)', 
                    color: '#f8fafc', 
                    fontSize: '11px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Clock size={12} />
                    {videoData.duration_string}
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', lineHeight: 1.35, color: '#f8fafc' }}>
                  {videoData.title}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontWeight: '500' }}>
                    <User size={14} color="#818cf8" />
                    <span>{videoData.uploader}</span>
                  </div>

                  {videoData.view_count && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Eye size={14} />
                      <span>{formatViews(videoData.view_count)}</span>
                    </div>
                  )}

                  <a 
                    href={videoData.webpage_url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#818cf8', textDecoration: 'none' }}
                  >
                    <span>Abrir origen</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {videoData.description && (
                  <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, marginTop: '4px' }}>
                    {videoData.description}
                  </p>
                )}
              </div>
            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Format Selector Tabs (Inspired directly by YTDLnis) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Tab navigation */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <button
                  onClick={() => setActiveTab('video')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '8px 18px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: activeTab === 'video' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    color: activeTab === 'video' ? '#a5b4fc' : '#94a3b8',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Video size={16} />
                  <span>Video (MP4)</span>
                </button>

                <button
                  onClick={() => setActiveTab('audio')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '8px 18px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: activeTab === 'audio' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    color: activeTab === 'audio' ? '#a5b4fc' : '#94a3b8',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Music size={16} />
                  <span>Audio (MP3)</span>
                </button>

                <button
                  onClick={() => setActiveTab('extra')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '8px 18px', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: activeTab === 'extra' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    color: activeTab === 'extra' ? '#a5b4fc' : '#94a3b8',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sliders size={16} />
                  <span>Opciones Extra</span>
                </button>
              </div>

              {/* Video Tab Content */}
              {activeTab === 'video' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
                  {videoData.video_options?.map((opt, i) => {
                    const isSelected = selectedVideoOption?.height === opt.height;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedVideoOption(opt)}
                        className={`quality-chip ${isSelected ? 'active' : ''}`}
                        style={{ 
                          padding: '12px 14px', 
                          borderRadius: '14px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                            {opt.label}
                          </span>
                          {isSelected && <CheckCircle2 size={16} color="#8b5cf6" />}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {opt.filesize_approx_str ? `~${opt.filesize_approx_str}` : 'MP4 Original'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Audio Tab Content */}
              {activeTab === 'audio' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
                  {videoData.audio_options?.map((opt, i) => {
                    const isSelected = selectedAudioOption?.quality === opt.quality && selectedAudioOption?.format === opt.format;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedAudioOption(opt)}
                        className={`quality-chip ${isSelected ? 'active' : ''}`}
                        style={{ 
                          padding: '12px 14px', 
                          borderRadius: '14px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                            {opt.label}
                          </span>
                          {isSelected && <CheckCircle2 size={16} color="#8b5cf6" />}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {opt.filesize_approx_str ? `~${opt.filesize_approx_str}` : 'Audio procesado con FFmpeg'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extra Tab Content (Trimming, audio format override) */}
              {activeTab === 'extra' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                      Cortar fragmento de video (Opcional):
                    </h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Inicio (HH:MM:SS o segundos)</label>
                        <input
                          type="text"
                          placeholder="00:00:10"
                          value={trimStart}
                          onChange={(e) => setTrimStart(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Fin (HH:MM:SS o segundos)</label>
                        <input
                          type="text"
                          placeholder="00:01:30"
                          value={trimEnd}
                          onChange={(e) => setTrimEnd(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                      Formato de audio predilecto:
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['mp3', 'm4a', 'flac', 'opus', 'wav'].map((ext) => (
                        <button
                          key={ext}
                          type="button"
                          onClick={() => setSelectedAudioExt(ext)}
                          style={{ 
                            padding: '6px 14px', 
                            borderRadius: '8px', 
                            border: '1px solid',
                            borderColor: selectedAudioExt === ext ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                            background: selectedAudioExt === ext ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                            color: '#e2e8f0',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          {ext}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Action Download / Progress Section */}
            {downloadStatus === 'idle' && (
              <button
                onClick={() => handleStartDownload()}
                className="btn-glow"
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px', 
                  fontWeight: '700', 
                  fontSize: '16px', 
                  cursor: 'pointer' 
                }}
              >
                <Download size={20} />
                <span>
                  {activeTab === 'audio' 
                    ? `Descargar Audio ${selectedAudioOption?.label || 'MP3'}`
                    : `Descargar Video ${selectedVideoOption?.label || 'MP4'} ${selectedVideoOption?.filesize_approx_str ? `(${selectedVideoOption.filesize_approx_str})` : ''}`
                  }
                </span>
              </button>
            )}

            {/* Progress Bar View */}
            {downloadStatus !== 'idle' && (
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.8)', 
                border: '1px solid rgba(139, 92, 246, 0.3)', 
                borderRadius: '16px', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '14px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {downloadStatus === 'finished' ? (
                      <CheckCircle2 size={20} color="#22c55e" />
                    ) : (
                      <Loader2 size={20} color="#8b5cf6" className="animate-spin" />
                    )}
                    <span style={{ fontWeight: '600', fontSize: '15px', color: '#f8fafc' }}>
                      {downloadStatus === 'starting' && 'Iniciando conexión con yt-dlp...'}
                      {downloadStatus === 'downloading' && 'Descargando flujo multimedia...'}
                      {downloadStatus === 'processing' && 'Uniendo y convirtiendo con FFmpeg...'}
                      {downloadStatus === 'finished' && '¡Descarga lista! Enviando al navegador...'}
                    </span>
                  </div>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#8b5cf6' }}>
                    {downloadProgress?.percent || 0}%
                  </span>
                </div>

                {/* Progress bar line */}
                <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${downloadProgress?.percent || 0}%`, 
                      height: '100%', 
                      transition: 'width 0.3s ease' 
                    }}
                  />
                </div>

                {/* Stats Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                  <span>Velocidad: {downloadProgress?.speed || 'Calculando...'}</span>
                  <span>Tiempo restante: {downloadProgress?.eta || '--'}</span>
                </div>

                {downloadStatus === 'finished' && (
                  <button
                    onClick={() => setDownloadStatus('idle')}
                    style={{ 
                      alignSelf: 'flex-end', 
                      marginTop: '8px', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      background: 'rgba(255,255,255,0.08)', 
                      border: 'none', 
                      color: '#cbd5e1', 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      cursor: 'pointer' 
                    }}
                  >
                    Descargar otro formato
                  </button>
                )}
              </div>
            )}

          </div>
        )}

        {/* Playlist Loaded */}
        {videoData && videoData.is_playlist && (
          <div className="glass-panel" style={{ borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#8b5cf6' }}>
                  <ListVideo size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                    {videoData.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Lista de reproducción detectada ({videoData.playlist_count} videos)
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {videoData.items?.map((item, index) => (
                <div 
                  key={index}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px', 
                    borderRadius: '12px', 
                    background: 'rgba(30, 41, 59, 0.4)', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', width: '20px' }}>
                      {index + 1}
                    </span>
                    {item.thumbnail && (
                      <img 
                        src={item.thumbnail} 
                        alt={item.title} 
                        style={{ width: '60px', height: '36px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </p>
                      {item.duration_string && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Duración: {item.duration_string}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUrl(item.url);
                      fetchVideoInfo(item.url);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '8px 14px', 
                      borderRadius: '8px', 
                      background: 'rgba(99, 102, 241, 0.2)', 
                      border: '1px solid #8b5cf6', 
                      color: '#ffffff', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Download size={14} />
                    <span>Elegir formato</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
        <p>
          Inspirado en el proyecto de código abierto <strong style={{ color: '#cbd5e1' }}>YTDLnis</strong> de Denis Çerri. Desarrollado con FastAPI, yt-dlp y React.
        </p>
      </footer>
    </div>
  );
}
