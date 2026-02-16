import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/style.module.css';

export default function GetEmbedCode() {
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('600');
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://your-domain.vercel.app';

  const embedCode = `<iframe
  src="${baseUrl}/embed"
  width="${width}"
  height="${height}px"
  frameborder="0"
  style="border:0; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
  allowfullscreen
  loading="lazy"
></iframe>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Head>
        <title>Get Embed Code - Gracie Barra Map</title>
      </Head>

      <div style={{
        maxWidth: '800px',
        margin: '50px auto',
        padding: '30px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h1 style={{ marginBottom: '10px' }}>Embed Gracie Barra Map</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Add the interactive Gracie Barra locations map to your website
        </p>

        <div style={{
          background: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginTop: 0 }}>Customize Your Embed</h3>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Width
            </label>
            <input
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="e.g., 100% or 800"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            />
            <small style={{ color: '#666' }}>
              Use % for responsive or px for fixed width
            </small>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Height (pixels)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g., 600"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            />
            <small style={{ color: '#666' }}>
              Recommended: 500-800px
            </small>
          </div>
        </div>

        <div style={{
          background: '#fff',
          border: '2px solid #e0e0e0',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Embed Code</span>
            <button
              onClick={copyToClipboard}
              style={{
                padding: '8px 16px',
                background: copied ? '#10b981' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </h3>
          <pre style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            {embedCode}
          </pre>
        </div>

        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '30px'
        }}>
          <h4 style={{ marginTop: 0, color: '#856404' }}>💡 Usage Tips</h4>
          <ul style={{ marginBottom: 0, color: '#856404' }}>
            <li>Copy the code above and paste it into your website's HTML</li>
            <li>The map will automatically adjust to the container size</li>
            <li>Users can interact with the map: search, filter, click locations</li>
            <li>The embed is mobile-responsive and touch-friendly</li>
          </ul>
        </div>

        <h3>Preview</h3>
        <div style={{
          border: '2px solid #e0e0e0',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '30px'
        }}>
          <iframe
            src={`${baseUrl}/embed`}
            width={width}
            height={`${height}px`}
            frameBorder="0"
            style={{ border: 0, display: 'block' }}
            allowFullScreen
            loading="lazy"
          />
        </div>

        <div style={{
          background: '#f0f9ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '15px'
        }}>
          <h4 style={{ marginTop: 0, color: '#1e40af' }}>📋 Common Embed Sizes</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <button
              onClick={() => { setWidth('100%'); setHeight('600'); }}
              style={{
                padding: '10px',
                background: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Full Width (600px height)
            </button>
            <button
              onClick={() => { setWidth('800'); setHeight('600'); }}
              style={{
                padding: '10px',
                background: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Desktop (800x600)
            </button>
            <button
              onClick={() => { setWidth('100%'); setHeight('500'); }}
              style={{
                padding: '10px',
                background: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Compact (500px height)
            </button>
            <button
              onClick={() => { setWidth('100%'); setHeight('800'); }}
              style={{
                padding: '10px',
                background: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Tall (800px height)
            </button>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#6b7280',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            ← Back to Map
          </a>
        </div>
      </div>
    </>
  );
}
