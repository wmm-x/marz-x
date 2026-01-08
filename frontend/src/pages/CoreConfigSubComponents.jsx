import { useState, useEffect } from 'react';

// -------------------------------------------------------------------------
// HELPER: Protocol Colors
// -------------------------------------------------------------------------
const getProtocolStyle = (protocol) => {
  switch (protocol) {
    case 'vless': return { background: 'rgba(15, 91, 32, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(139, 92, 246, 0.3)' };
    case 'vmess': return { background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.3)' };
    case 'trojan': return { background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' };
    case 'shadowsocks': return { background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-orange)', border: '1px solid rgba(249, 115, 22, 0.3)' };
    case 'wireguard': return { background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-green)', border: '1px solid rgba(34, 197, 94, 0.3)' };
    default: return { background: 'rgba(115, 115, 115, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(115, 115, 115, 0.3)' };
  }
};

// -------------------------------------------------------------------------
// COMPONENT: INBOUNDS TAB
// -------------------------------------------------------------------------
export function InboundsTab({ inbounds, onAdd, onEdit, onDelete, isMobile }) {
  return (
    <div>
      <div className="section-header" style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '16px',
        gap: isMobile ? '12px' : '0' 
      }}>
        <h3 style={{ margin: 0 }}>Inbound Connections</h3>
        <button onClick={onAdd} className="btn btn-primary" style={{ width: isMobile ? '100%' : 'auto' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Inbound
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {inbounds.map((inbound, i) => (
          <div key={i} className="card card-body" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ width: '100%' }}>
              <div className="flex gap-2 items-center mb-2" style={{ flexWrap: 'wrap' }}>
                 <span className="badge" style={getProtocolStyle(inbound.protocol)}>{inbound.protocol}</span>
                 <span className="badge badge-gray">{inbound.streamSettings?.network || 'tcp'}</span>
                 {inbound.streamSettings?.security && inbound.streamSettings.security !== 'none' && (
                   <span className="badge badge-success">{inbound.streamSettings.security}</span>
                 )}
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', wordBreak: 'break-all' }}>{inbound.tag || 'Unnamed Inbound'}</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Port: <span style={{ color: 'var(--text-primary)' }}>{inbound.port}</span> | Listen: <span style={{ color: 'var(--text-primary)' }}>{inbound.listen || '0.0.0.0'}</span></p>
            </div>
            <div className="flex gap-2" style={{ width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '8px' : '0' }}>
              <button onClick={() => onEdit(i)} className="btn btn-secondary" style={{ flex: 1 }}>Edit</button>
              <button onClick={() => onDelete(i)} className="btn btn-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        ))}
        {inbounds.length === 0 && (
          <div className="card card-body" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            <p>No inbounds found. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT: OUTBOUNDS TAB
// -------------------------------------------------------------------------
export function OutboundsTab({ outbounds, onAdd, onEdit, onDelete, isMobile }) {
  const getProtocolIcon = (protocol) => {
    switch (protocol) {
      case 'freedom': return '🌐';
      case 'blackhole': return '🕳️';
      case 'shadowsocks': return '🔐';
      case 'vmess': return '📡';
      case 'vless': return '⚡';
      case 'wireguard': return '🛡️';
      default: return '📤';
    }
  };

  return (
    <div>
      <div className="section-header" style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '16px',
        gap: isMobile ? '12px' : '0' 
      }}>
        <h3 style={{ margin: 0 }}>Outbound Connections</h3>
        <button onClick={onAdd} className="btn btn-primary" style={{ width: isMobile ? '100%' : 'auto' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Outbound
        </button>
      </div>
      
      {/* Dynamic Grid: 1 column on mobile, 3 columns on desktop */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '16px' 
      }}>
        {outbounds.map((outbound, i) => (
          <div key={i} className="card card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '1.8rem' }}>{getProtocolIcon(outbound.protocol)}</span>
                <div>
                  <h4 style={{ fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{outbound.tag || 'Unnamed'}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{outbound.protocol}</p>
                </div>
              </div>
            </div>
            {outbound.settings?.domainStrategy && (
              <div className="badge badge-gray" style={{ alignSelf: 'flex-start', marginBottom: '16px' }}>
                Strategy: {outbound.settings.domainStrategy}
              </div>
            )}
            <div className="flex gap-2 mt-auto pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
              <button onClick={() => onEdit(i)} className="btn btn-secondary" style={{ flex: 1, padding: '8px' }}>Edit</button>
              <button onClick={() => onDelete(i)} className="btn btn-danger" style={{ padding: '8px' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT: ROUTING TAB
// -------------------------------------------------------------------------
export function RoutingTab({ rules, outbounds, onAdd, onEdit, onDelete, isMobile }) {
  return (
    <div>
      <div className="section-header" style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '16px',
        gap: isMobile ? '12px' : '0' 
      }}>
        <h3 style={{ margin: 0 }}>Routing Rules</h3>
        <button onClick={onAdd} className="btn btn-primary" style={{ width: isMobile ? '100%' : 'auto' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Rule
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rules.map((rule, i) => (
          <div key={i} className="card card-body" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
              <div className="flex items-center gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
                <span className="badge badge-gray">Rule #{i + 1}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span className={`badge ${rule.outboundTag === 'BLOCK' ? 'badge-danger' : 'badge-success'}`}>
                  {rule.outboundTag}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.ip && rule.ip.slice(0, 3).map((ip, k) => <span key={k} className="badge badge-gray" style={{ fontFamily: 'monospace' }}>IP: {ip}</span>)}
                {rule.domain && rule.domain.slice(0, 3).map((d, k) => <span key={k} className="badge badge-gray" style={{ fontFamily: 'monospace' }}>Dom: {d}</span>)}
                {rule.port && <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>Port: {rule.port}</span>}
                {(rule.ip?.length > 3 || rule.domain?.length > 3) && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>...more</span>}
              </div>
            </div>
            <div className="flex gap-2" style={{ width: isMobile ? '100%' : 'auto' }}>
              <button onClick={() => onEdit(i)} className="btn btn-secondary" style={{ flex: 1 }}>Edit</button>
              <button onClick={() => onDelete(i)} className="btn btn-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT: RAW JSON MODAL
// -------------------------------------------------------------------------
export function RawJsonModal({ config, onClose, onSave, saving, isMobile }) {
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState('');

  useEffect(() => { setJsonText(JSON.stringify(config, null, 2)); }, [config]);

  // 1. Real-time Change Handler
  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setJsonText(newVal);

    try {
      if (newVal.trim() === '') {
        setError(''); 
        return;
      }
      
      // Attempt to parse JSON on every keystroke
      JSON.parse(newVal);
      setError(''); // Clear error if valid
    } catch (err) {
      let msg = err.message;
      
      // Attempt to extract position to calculate line number
      // Standard V8/Chrome error format: "Unexpected token X in JSON at position Y"
      const match = msg.match(/at position (\d+)/);
      
      if (match) {
        const position = parseInt(match[1], 10);
        // Count newlines up to that position to get the line number
        const lineCount = newVal.substring(0, position).split('\n').length;
        // Format message for user
        const cleanMsg = msg.replace(/ in JSON at position \d+/, '');
        msg = `Syntax Error (Line ${lineCount}): ${cleanMsg}`;
      } else {
        // Fallback if regex fails (e.g. different browser)
        msg = `Syntax Error: ${msg}`;
      }
      
      setError(msg);
    }
  };

  const handleSave = () => {
    // Block save if syntax error exists
    if (error) return;

    try {
      const parsed = JSON.parse(jsonText);
      
      // Schema Validation (Performed on Save)
      if (!parsed.inbounds || !Array.isArray(parsed.inbounds)) {
        throw new Error("Invalid Configuration: 'inbounds' array is missing or invalid.");
      }
      if (parsed.inbounds.length === 0) {
        throw new Error("Invalid Configuration: You must have at least one Inbound connection defined.");
      }

      onSave(parsed);
    } catch (e) {
      const msg = e.message.replace(/^JSON.parse: /, '');
      setError('Error: ' + msg); 
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '800px', 
          width: isMobile ? '100%' : '800px', 
          height: isMobile ? '85vh' : '80vh', 
          maxHeight: '90vh',
          display: 'flex', 
          flexDirection: 'column' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Raw JSON Editor</h3>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: isMobile ? '10px' : '20px', overflow: 'hidden' }}>
          {/* Error Banner */}
          {error && (
            <div className="badge badge-danger" style={{ marginBottom: '12px', width: '100%', display: 'flex', alignItems: 'center', padding: '10px', fontSize: '0.9rem', fontWeight: '500', borderRadius: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', marginRight: '8px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}
          
          <textarea 
            value={jsonText} 
            onChange={handleInputChange} 
            className="form-input" 
            style={{ 
              flex: 1, 
              fontFamily: 'monospace', 
              fontSize: isMobile ? '12px' : '13px', 
              lineHeight: '1.5', 
              whiteSpace: 'pre',
              resize: 'none',
              overflow: 'auto',
              width: '100%',
              borderColor: error ? '#ef4444' : 'var(--border-color)' // Visual cue: red border on error
            }}
            autoCorrect="off" 
            autoCapitalize="off" 
            spellCheck="false"
          />
        </div>

        <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? '8px' : '12px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: isMobile ? '100%' : 'auto' }}>Cancel</button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary" 
            // Button is disabled if there is a Syntax Error OR if it is currently Saving
            disabled={saving || !!error} 
            style={{ 
              width: isMobile ? '100%' : 'auto',
              opacity: (saving || !!error) ? 0.6 : 1,
              cursor: (saving || !!error) ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}