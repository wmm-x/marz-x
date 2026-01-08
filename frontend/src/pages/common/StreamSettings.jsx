import React, { useEffect } from 'react';
import TlsSettings from './TlsSettings';

// --- HELPER: Key/Value Header List ---
const HeaderList = ({ headers = [], onChange, title = "Headers" }) => {
  const addHeader = () => {
    onChange([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    onChange(newHeaders);
  };

  const updateHeader = (index, field, val) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = val;
    onChange(newHeaders);
  };

  return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>{title}</label>
        <button type="button" onClick={addHeader} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}>
          + Add
        </button>
      </div>
      {headers.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>No headers defined.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {headers.map((header, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Key" value={header.key} onChange={(e) => updateHeader(index, 'key', e.target.value)} className="form-input" style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }} />
            <input type="text" placeholder="Value" value={header.value} onChange={(e) => updateHeader(index, 'value', e.target.value)} className="form-input" style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }} />
            <button type="button" onClick={() => removeHeader(index)} className="btn btn-danger" style={{ padding: '0 10px' }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- HELPER: String List (e.g. for Hosts/ShortIds) ---
const StringList = ({ list = [], onChange, title = "Values", placeholder = "Value", onGenerate }) => {
  const add = () => onChange([...list, '']);
  const remove = (index) => onChange(list.filter((_, i) => i !== index));
  const update = (index, val) => {
    const newList = [...list];
    newList[index] = val;
    onChange(newList);
  };

  return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>{title}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
           {onGenerate && (
             <button type="button" onClick={onGenerate} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: '#8b5cf6', borderColor: '#7c3aed' }}>
               Generate
             </button>
           )}
           <button type="button" onClick={add} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}>+ Add</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {list.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>No items.</div>}
        {list.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder={placeholder} value={item} onChange={(e) => update(index, e.target.value)} className="form-input" style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }} />
            <button type="button" onClick={() => remove(index)} className="btn btn-danger" style={{ padding: '0 10px' }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const StreamSettings = ({ formData, setFormData, tab }) => {
  
  // Networks that support Reality
  const REALITY_NETWORKS = ['tcp', 'grpc', 'splithttp', 'xhttp'];
  const showReality = REALITY_NETWORKS.includes(formData.network);

  // Auto-reset security if switching to a network that doesn't support Reality
  useEffect(() => {
    if (!showReality && formData.security === 'reality') {
      setFormData(prev => ({ ...prev, security: 'none' }));
    }
  }, [formData.network]);

  // --- GENERATORS ---

  // Generate a random 32-byte key encoded as Base64Url (43 chars)
  const generateRandomKey = () => {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    // Convert to binary string
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    // Convert to Base64 and make URL safe (+ -> -, / -> _, remove =)
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const generateKeyPair = () => {
    setFormData(prev => ({ 
      ...prev, 
      realityPrivateKey: generateRandomKey(),
      realityPublicKey: generateRandomKey() 
    }));
  };

  const generateShortId = () => {
    // Generates a random 8-byte hex string (16 chars)
    const randomHex = [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    // Ensure we treat it as an array
    const currentIds = Array.isArray(formData.realityShortIds) ? formData.realityShortIds : [];
    const newIds = [...currentIds, randomHex];
    setFormData(prev => ({ ...prev, realityShortIds: newIds }));
  };

  if (tab === 'transport') return (
    <div className="grid-2">
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label className="form-label">Network</label>
        <select value={formData.network} onChange={e => setFormData({...formData, network: e.target.value})} className="form-input">
          <option value="tcp">TCP</option>
          <option value="ws">WebSocket</option>
          <option value="httpupgrade">HTTPUpgrade</option>
          <option value="splithttp">SplitHTTP</option>
          <option value="xhttp">XHTTP</option>
          <option value="grpc">gRPC</option>
          <option value="http">HTTP/2</option>
          <option value="kcp">mKCP</option>
        </select>
      </div>

      {/* ==================== TCP ==================== */}
      {formData.network === 'tcp' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#3b82f6' }}>TCP Settings</h4>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Header Type</label>
              <select value={formData.tcpHeaderType} onChange={e => setFormData({...formData, tcpHeaderType: e.target.value})} className="form-input">
                <option value="none">None</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.tcpAcceptProxyProtocol} onChange={e => setFormData({...formData, tcpAcceptProxyProtocol: e.target.checked})} />
                Accept Proxy Protocol
              </label>
            </div>
          </div>
          
          {formData.tcpHeaderType === 'http' && (
            <div style={{ marginTop: '12px', display: 'grid', gap: '12px' }}>
              <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h5 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>HTTP Request</h5>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Version</label><input type="text" value={formData.tcpReqVersion} onChange={e => setFormData({...formData, tcpReqVersion: e.target.value})} className="form-input" placeholder="1.1" /></div>
                  <div className="form-group"><label className="form-label">Method</label><input type="text" value={formData.tcpReqMethod} onChange={e => setFormData({...formData, tcpReqMethod: e.target.value})} className="form-input" placeholder="GET" /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Path</label><input type="text" value={formData.tcpReqPath} onChange={e => setFormData({...formData, tcpReqPath: e.target.value})} className="form-input" placeholder="/" /></div>
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}><HeaderList headers={formData.tcpReqHeaders} onChange={(h) => setFormData({...formData, tcpReqHeaders: h})} title="Request Headers" /></div>
              </div>
              <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h5 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>HTTP Response</h5>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Version</label><input type="text" value={formData.tcpResVersion} onChange={e => setFormData({...formData, tcpResVersion: e.target.value})} className="form-input" placeholder="1.1" /></div>
                  <div className="form-group"><label className="form-label">Status</label><input type="text" value={formData.tcpResStatus} onChange={e => setFormData({...formData, tcpResStatus: e.target.value})} className="form-input" placeholder="200" /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Reason</label><input type="text" value={formData.tcpResReason} onChange={e => setFormData({...formData, tcpResReason: e.target.value})} className="form-input" placeholder="OK" /></div>
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}><HeaderList headers={formData.tcpResHeaders} onChange={(h) => setFormData({...formData, tcpResHeaders: h})} title="Response Headers" /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== KCP ==================== */}
      {formData.network === 'kcp' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#eab308' }}>mKCP Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">MTU</label><input type="number" value={formData.kcpMtu} onChange={e => setFormData({...formData, kcpMtu: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">TTI</label><input type="number" value={formData.kcpTti} onChange={e => setFormData({...formData, kcpTti: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Uplink (MB/s)</label><input type="number" value={formData.kcpUplink} onChange={e => setFormData({...formData, kcpUplink: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Downlink (MB/s)</label><input type="number" value={formData.kcpDownlink} onChange={e => setFormData({...formData, kcpDownlink: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Read Buffer</label><input type="number" value={formData.kcpReadBuffer} onChange={e => setFormData({...formData, kcpReadBuffer: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Write Buffer</label><input type="number" value={formData.kcpWriteBuffer} onChange={e => setFormData({...formData, kcpWriteBuffer: e.target.value})} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Seed</label><input type="text" value={formData.kcpSeed} onChange={e => setFormData({...formData, kcpSeed: e.target.value})} className="form-input" placeholder="Password" /></div>
            <div className="form-group"><label className="form-label">Header Type</label>
              <select value={formData.kcpHeaderType} onChange={e => setFormData({...formData, kcpHeaderType: e.target.value})} className="form-input">
                <option value="none">None</option>
                <option value="srtp">SRTP</option>
                <option value="utp">uTP</option>
                <option value="wechat-video">WeChat Video</option>
                <option value="dtls">DTLS</option>
                <option value="wireguard">WireGuard</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Header Domain</label><input type="text" value={formData.kcpDomain} onChange={e => setFormData({...formData, kcpDomain: e.target.value})} className="form-input" placeholder="example.com" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.kcpCongestion} onChange={e => setFormData({...formData, kcpCongestion: e.target.checked})} /> Congestion
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WebSocket ==================== */}
      {formData.network === 'ws' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#3b82f6' }}>WebSocket Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Path</label><input type="text" value={formData.wsPath} onChange={e => setFormData({...formData, wsPath: e.target.value})} className="form-input" placeholder="/" /></div>
            <div className="form-group"><label className="form-label">Host</label><input type="text" value={formData.wsHost} onChange={e => setFormData({...formData, wsHost: e.target.value})} className="form-input" placeholder="example.com" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.wsAcceptProxyProtocol} onChange={e => setFormData({...formData, wsAcceptProxyProtocol: e.target.checked})} /> Accept Proxy Protocol
              </label>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <HeaderList headers={formData.wsHeaders} onChange={(h) => setFormData({...formData, wsHeaders: h})} />
          </div>
        </div>
      )}

      {/* ==================== HTTPUpgrade ==================== */}
      {formData.network === 'httpupgrade' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#ec4899' }}>HTTPUpgrade Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Path</label><input type="text" value={formData.httpUpgradePath} onChange={e => setFormData({...formData, httpUpgradePath: e.target.value})} className="form-input" placeholder="/" /></div>
            <div className="form-group"><label className="form-label">Host</label><input type="text" value={formData.httpUpgradeHost} onChange={e => setFormData({...formData, httpUpgradeHost: e.target.value})} className="form-input" placeholder="example.com" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.httpUpgradeAcceptProxyProtocol} onChange={e => setFormData({...formData, httpUpgradeAcceptProxyProtocol: e.target.checked})} /> Accept Proxy Protocol
              </label>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <HeaderList headers={formData.httpUpgradeHeaders} onChange={(h) => setFormData({...formData, httpUpgradeHeaders: h})} />
          </div>
        </div>
      )}

      {/* ==================== SplitHTTP ==================== */}
      {formData.network === 'splithttp' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#06b6d4' }}>SplitHTTP Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Path</label><input type="text" value={formData.splitHttpPath} onChange={e => setFormData({...formData, splitHttpPath: e.target.value})} className="form-input" placeholder="/" /></div>
            <div className="form-group"><label className="form-label">Host</label><input type="text" value={formData.splitHttpHost} onChange={e => setFormData({...formData, splitHttpHost: e.target.value})} className="form-input" placeholder="example.com" /></div>
            <div className="form-group"><label className="form-label">Mode</label><input type="text" value={formData.splitHttpMode} onChange={e => setFormData({...formData, splitHttpMode: e.target.value})} className="form-input" placeholder="auto" /></div>
            <div className="form-group"><label className="form-label">X Padding Bytes</label><input type="text" value={formData.splitHttpXPaddingBytes} onChange={e => setFormData({...formData, splitHttpXPaddingBytes: e.target.value})} className="form-input" placeholder="100-1000" /></div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}><HeaderList headers={formData.splitHttpHeaders} onChange={(h) => setFormData({...formData, splitHttpHeaders: h})} /></div>
          <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '12px' }}>
            <h5 style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>Upload Config</h5>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Max Concurrent</label><input type="text" value={formData.splitHttpScMaxConcurrentPosts} onChange={e => setFormData({...formData, splitHttpScMaxConcurrentPosts: e.target.value})} className="form-input" placeholder="100-200" /></div>
              <div className="form-group"><label className="form-label">Max Post Bytes</label><input type="text" value={formData.splitHttpScMaxEachPostBytes} onChange={e => setFormData({...formData, splitHttpScMaxEachPostBytes: e.target.value})} className="form-input" placeholder="1000000-2000000" /></div>
              <div className="form-group"><label className="form-label">Min Interval (ms)</label><input type="text" value={formData.splitHttpScMinPostsIntervalMs} onChange={e => setFormData({...formData, splitHttpScMinPostsIntervalMs: e.target.value})} className="form-input" placeholder="10-50" /></div>
            </div>
          </div>
          <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '12px' }}>
            <h5 style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>XMUX</h5>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Max Concurrency</label><input type="text" value={formData.splitHttpXmuxMaxConcurrency} onChange={e => setFormData({...formData, splitHttpXmuxMaxConcurrency: e.target.value})} className="form-input" placeholder="16-32" /></div>
              <div className="form-group"><label className="form-label">Max Connections</label><input type="number" value={formData.splitHttpXmuxMaxConnections} onChange={e => setFormData({...formData, splitHttpXmuxMaxConnections: e.target.value})} className="form-input" /></div>
              <div className="form-group"><label className="form-label">Reuse Times</label><input type="text" value={formData.splitHttpXmuxCMaxReuseTimes} onChange={e => setFormData({...formData, splitHttpXmuxCMaxReuseTimes: e.target.value})} className="form-input" placeholder="64-128" /></div>
              <div className="form-group"><label className="form-label">Lifetime (ms)</label><input type="number" value={formData.splitHttpXmuxCMaxLifetimeMs} onChange={e => setFormData({...formData, splitHttpXmuxCMaxLifetimeMs: e.target.value})} className="form-input" /></div>
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '12px' }}>
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={formData.splitHttpNoSSEHeader} onChange={e => setFormData({...formData, splitHttpNoSSEHeader: e.target.checked})} /> No SSE Header</label>
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={formData.splitHttpNoGRPCHeader} onChange={e => setFormData({...formData, splitHttpNoGRPCHeader: e.target.checked})} /> No GRPC Header</label>
          </div>
        </div>
      )}

      {/* ==================== HTTP/2 ==================== */}
      {formData.network === 'http' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#10b981' }}>HTTP/2 Settings</h4>
          <div className="form-group"><label className="form-label">Path</label><input type="text" value={formData.httpPath} onChange={e => setFormData({...formData, httpPath: e.target.value})} className="form-input" placeholder="/path" /></div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <StringList list={formData.httpHost} onChange={(l) => setFormData({...formData, httpHost: l})} placeholder="example.com" title="Hosts" />
          </div>
        </div>
      )}

      {/* ==================== gRPC ==================== */}
      {formData.network === 'grpc' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#8b5cf6' }}>gRPC Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Service Name</label><input type="text" value={formData.grpcServiceName} onChange={e => setFormData({...formData, grpcServiceName: e.target.value})} className="form-input" placeholder="ServiceName" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={formData.grpcMultiMode} onChange={e => setFormData({...formData, grpcMultiMode: e.target.checked})} /> Multi Mode
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ==================== XHTTP ==================== */}
      {formData.network === 'xhttp' && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
          <h4 style={{ marginBottom: '12px', color: '#14b8a6' }}>XHTTP Settings</h4>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Path</label><input type="text" value={formData.xhttpPath} onChange={e => setFormData({...formData, xhttpPath: e.target.value})} className="form-input" placeholder="/path" /></div>
            <div className="form-group"><label className="form-label">Host</label><input type="text" value={formData.xhttpHost} onChange={e => setFormData({...formData, xhttpHost: e.target.value})} className="form-input" placeholder="hostname" /></div>
            <div className="form-group"><label className="form-label">Mode</label><input type="text" value={formData.xhttpMode} onChange={e => setFormData({...formData, xhttpMode: e.target.value})} className="form-input" placeholder="auto" /></div>
            <div className="form-group"><label className="form-label">X Padding Bytes</label><input type="text" value={formData.xhttpXPaddingBytes} onChange={e => setFormData({...formData, xhttpXPaddingBytes: e.target.value})} className="form-input" placeholder="100-1000" /></div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}><HeaderList headers={formData.xhttpHeaders} onChange={(h) => setFormData({...formData, xhttpHeaders: h})} /></div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={formData.xhttpNoSSEHeader} onChange={e => setFormData({...formData, xhttpNoSSEHeader: e.target.checked})} /> No SSE Header
            </label>
          </div>
        </div>
      )}
    </div>
  );

  // --- SECURITY TAB ---
  if (tab === 'security') return (
    <div className="grid-2">
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label className="form-label">Security</label>
        <select value={formData.security} onChange={e => setFormData({...formData, security: e.target.value})} className="form-input">
          <option value="none">None</option>
          <option value="tls">TLS</option>
          {showReality && <option value="reality">REALITY</option>}
        </select>
      </div>
      
      {formData.security === 'tls' && <TlsSettings formData={formData} setFormData={setFormData} />}
      
      {formData.security === 'reality' && showReality && (
        <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)' }}>
           <h4 style={{ marginBottom: '12px', color: '#8b5cf6' }}>REALITY Settings</h4>
           <div className="grid-2">
             <div className="form-group"><label className="form-label">Dest</label><input placeholder="example.com:443" value={formData.realityDest} onChange={e=>setFormData({...formData, realityDest:e.target.value})} className="form-input" /></div>
             <div className="form-group"><label className="form-label">Fingerprint</label>
               <select value={formData.realityFingerprint} onChange={e=>setFormData({...formData, realityFingerprint:e.target.value})} className="form-input">
                 <option value="chrome">Chrome</option>
                 <option value="firefox">Firefox</option>
                 <option value="safari">Safari</option>
                 <option value="ios">iOS</option>
                 <option value="android">Android</option>
                 <option value="edge">Edge</option>
                 <option value="360">360</option>
                 <option value="qq">QQ</option>
                 <option value="random">Random</option>
                 <option value="randomized">Randomized</option>
               </select>
             </div>
             <div className="form-group"><label className="form-label">SpiderX</label><input placeholder="/" value={formData.realitySpiderX} onChange={e=>setFormData({...formData, realitySpiderX:e.target.value})} className="form-input" /></div>
             <div className="form-group"><label className="form-label">Xver</label><input type="number" placeholder="0" value={formData.realityXver} onChange={e=>setFormData({...formData, realityXver:e.target.value})} className="form-input" /></div>
           </div>

           <div className="form-group" style={{ marginTop: '12px' }}>
              <StringList 
                title="Server Names (SNI)" 
                placeholder="example.com" 
                list={formData.realityServerNames || []} 
                onChange={(l) => setFormData({...formData, realityServerNames: l})} 
              />
           </div>

           <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '12px' }}>
             <h5 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>Key Pair</h5>
             <div className="grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Private Key</label>
                    <button type="button" onClick={generateKeyPair} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: '#8b5cf6', borderColor: '#7c3aed' }}>Generate Key Pair</button>
                  </div>
                  <input value={formData.realityPrivateKey} onChange={e=>setFormData({...formData, realityPrivateKey:e.target.value})} className="form-input" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Public Key</label>
                  <input value={formData.realityPublicKey} onChange={e=>setFormData({...formData, realityPublicKey:e.target.value})} className="form-input" readOnly style={{ opacity: 0.7 }} />
                </div>
             </div>
           </div>

           <div className="form-group" style={{ marginTop: '12px' }}>
              <StringList 
                title="Short IDs" 
                placeholder="16-char hex" 
                list={formData.realityShortIds || []} 
                onChange={(l) => setFormData({...formData, realityShortIds: l})} 
                onGenerate={generateShortId}
              />
           </div>
        </div>
      )}
    </div>
  );

  // --- SOCKET TAB ---
  if (tab === 'socket') return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.2)' }}>
      <div className="form-group">
        <label className="form-label">TProxy</label>
        <select value={formData.sockTproxy} onChange={e=>setFormData({...formData, sockTproxy:e.target.value})} className="form-input">
          <option value="off">Off</option>
          <option value="tproxy">TProxy</option>
          <option value="redirect">Redirect</option>
        </select>
      </div>
    </div>
  );

  return null;
};

export default StreamSettings;