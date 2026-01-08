import React from 'react';

// The specific list from your configuration
const DEFAULT_CIPHERS = [

  "AES_128_GCM",
  "AES_256_GCM",
  "CHACHA20_POLY1305",
  "ECDHE_ECDSA_AES_128_CBC",
  "ECDHE_ECDSA_AES_256_CBC",
  "ECDHE_RSA_AES_128_CBC",
  "ECDHE_RSA_AES_256_CBC",
  "ECDHE_ECDSA_AES_128_GCM",
  "ECDHE_ECDSA_AES_256_GCM",
  "ECDHE_RSA_AES_128_GCM",
  "ECDHE_RSA_AES_256_GCM",
  "ECDHE_ECDSA_CHACHA20_POLY1305",
  "ECDHE_RSA_CHACHA20_POLY1305"
];

// Combine with other potential modern suites if needed, or keep strictly to defaults
const CIPHER_SUITES_LIST = [...DEFAULT_CIPHERS, "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"];

const TlsSettings = ({ formData, setFormData }) => {
  
  const toggleBool = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCipherChange = (cipher) => {
    const currentString = formData.tlsCipherSuites || '';
    let currentList = currentString ? currentString.split(':') : [];

    if (currentList.includes(cipher)) {
      currentList = currentList.filter(c => c !== cipher);
    } else {
      currentList.push(cipher);
    }
    setFormData({ ...formData, tlsCipherSuites: currentList.join(':') });
  };

  // NEW: Helper to select the default list
  const applyDefaultCiphers = () => {
    setFormData({ ...formData, tlsCipherSuites: DEFAULT_CIPHERS.join(':') });
  };

  const selectedCiphers = formData.tlsCipherSuites ? formData.tlsCipherSuites.split(':') : [];

  return (
    <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', marginTop: '10px' }}>
      <h4 style={{ marginBottom: '16px', color: '#10b981', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
        TLS Configuration
      </h4>

      {/* Basic TLS Settings */}
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Server Name (SNI)</label>
          <input 
            type="text" 
            value={formData.tlsServerName} 
            onChange={e => setFormData({...formData, tlsServerName: e.target.value})} 
            className="form-input" 
            placeholder="example.com"
          />
        </div>
        <div className="form-group">
          <label className="form-label">ALPN (comma separated)</label>
          <input 
            type="text" 
            value={formData.tlsAlpn} 
            onChange={e => setFormData({...formData, tlsAlpn: e.target.value})} 
            className="form-input" 
            placeholder="h2,http/1.1"
          />
        </div>
      </div>

      {/* Versions */}
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Min Version</label>
          <select value={formData.tlsMinVersion} onChange={e => setFormData({...formData, tlsMinVersion: e.target.value})} className="form-input">
            <option value="1.0">1.0</option>
            <option value="1.1">1.1</option>
            <option value="1.2">1.2</option>
            <option value="1.3">1.3</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Max Version</label>
          <select value={formData.tlsMaxVersion} onChange={e => setFormData({...formData, tlsMaxVersion: e.target.value})} className="form-input">
            <option value="1.0">1.0</option>
            <option value="1.1">1.1</option>
            <option value="1.2">1.2</option>
            <option value="1.3">1.3</option>
          </select>
        </div>
      </div>

      {/* Certificates Section */}
      <div className="card card-body" style={{ background: 'rgba(255,255,255,0.03)', marginTop: '12px', marginBottom: '12px' }}>
        <h5 style={{ marginBottom: '10px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Certificate #1</h5>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Certificate File (.crt)</label>
            <input 
              type="text" 
              value={formData.tlsCertFile} 
              onChange={e => setFormData({...formData, tlsCertFile: e.target.value})} 
              className="form-input" 
              placeholder="/var/lib/marzban/certs/fullchain.pem"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Key File (.key)</label>
            <input 
              type="text" 
              value={formData.tlsKeyFile} 
              onChange={e => setFormData({...formData, tlsKeyFile: e.target.value})} 
              className="form-input" 
              placeholder="/var/lib/marzban/certs/privkey.pem"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Usage</label>
            <select value={formData.tlsUsage} onChange={e => setFormData({...formData, tlsUsage: e.target.value})} className="form-input">
              <option value="encipherment">encipherment</option>
              <option value="verify">verify</option>
              <option value="issue">issue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">OCSP Stapling (seconds)</label>
            <input 
              type="number" 
              value={formData.tlsOcsp} 
              onChange={e => setFormData({...formData, tlsOcsp: e.target.value})} 
              className="form-input" 
            />
          </div>
        </div>
      </div>

      {/* Advanced Toggles */}
      <div className="grid-2" style={{ marginTop: '8px' }}>
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={formData.tlsRejectUnknownSni} onChange={() => toggleBool('tlsRejectUnknownSni')} />
          Reject Unknown SNI
        </label>
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={formData.tlsDisableSystemRoot} onChange={() => toggleBool('tlsDisableSystemRoot')} />
          Disable System Root
        </label>
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={formData.tlsSessionResumption} onChange={() => toggleBool('tlsSessionResumption')} />
          Enable Session Resumption
        </label>
      </div>

      {/* Cipher Suites Checklist */}
      <div className="form-group" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="form-label" style={{ margin: 0 }}>Cipher Suites</label>
          
        </div>
        
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '8px', 
            background: 'rgba(0,0,0,0.1)', 
            padding: '12px', 
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {CIPHER_SUITES_LIST.map((cipher) => (
            <label 
              key={cipher} 
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors"
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            >
              <input 
                type="checkbox" 
                checked={selectedCiphers.includes(cipher)} 
                onChange={() => handleCipherChange(cipher)} 
                style={{ accentColor: 'var(--accent-color)' }}
              />
              <span style={{ wordBreak: 'break-all' }}>{cipher}</span>
            </label>
          ))}
        </div>
        <p style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Selected: {selectedCiphers.length} cipher(s)
        </p>
      </div>
    </div>
  );
};

export default TlsSettings;