import { useState, useEffect } from 'react';

// Helper: Standard Base64 Generator for WireGuard (32 bytes)
const generateWgKey = () => {
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
};

// Helper: Peer List Component
const PeerList = ({ peers = [], onChange }) => {
  const addPeer = () => {
    onChange([
      ...peers, 
      { 
        publicKey: '', 
        privateKey: '', // Optional, usually for client config generation
        preSharedKey: '', 
        allowedIPs: ['10.0.0.2/32'], 
        keepAlive: 0 
      }
    ]);
  };

  const removePeer = (index) => {
    onChange(peers.filter((_, i) => i !== index));
  };

  const updatePeer = (index, field, val) => {
    const newPeers = [...peers];
    // Special handling for AllowedIPs (convert comma string to array)
    if (field === 'allowedIPs') {
      newPeers[index][field] = val.split(',').map(s => s.trim()).filter(s => s);
    } else {
      newPeers[index][field] = val;
    }
    onChange(newPeers);
  };

  const generatePeerKeys = (index) => {
    const newPeers = [...peers];
    newPeers[index].privateKey = generateWgKey();
    // In a real app, publicKey should be derived from privateKey using curve25519
    // Since we don't have the library here, we generate a random placeholder for UI demo
    newPeers[index].publicKey = generateWgKey(); 
    newPeers[index].preSharedKey = generateWgKey();
    onChange(newPeers);
  };

  return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <label className="form-label" style={{ margin: 0 }}>Peers</label>
        <button 
          type="button" 
          onClick={addPeer}
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}
        >
          + Add Peer
        </button>
      </div>
      
      {peers.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
          No peers configured.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {peers.map((peer, index) => (
          <div key={index} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>Peer #{index + 1}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => generatePeerKeys(index)} className="btn btn-sm btn-primary" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Gen Keys</button>
                <button type="button" onClick={() => removePeer(index)} className="btn btn-sm btn-danger" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Remove</button>
              </div>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Private Key</label>
                <input 
                  type="text" 
                  value={peer.privateKey} 
                  onChange={(e) => updatePeer(index, 'privateKey', e.target.value)} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Public Key</label>
                <input 
                  type="text" 
                  value={peer.publicKey} 
                  onChange={(e) => updatePeer(index, 'publicKey', e.target.value)} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Pre-Shared Key</label>
                <input 
                  type="text" 
                  value={peer.preSharedKey} 
                  onChange={(e) => updatePeer(index, 'preSharedKey', e.target.value)} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Allowed IPs (comma separated)</label>
                <input 
                  type="text" 
                  value={Array.isArray(peer.allowedIPs) ? peer.allowedIPs.join(', ') : peer.allowedIPs} 
                  onChange={(e) => updatePeer(index, 'allowedIPs', e.target.value)} 
                  className="form-input" 
                  placeholder="10.0.0.2/32"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Keep Alive</label>
                <input 
                  type="number" 
                  value={peer.keepAlive} 
                  onChange={(e) => updatePeer(index, 'keepAlive', parseInt(e.target.value))} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function WireguardInbound({ initialData, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({
    tag: initialData?.tag || '',
    port: initialData?.port || 51820,
    listen: initialData?.listen || '0.0.0.0',
    
    // WireGuard Settings
    mtu: initialData?.settings?.mtu || 1420,
    secretKey: initialData?.settings?.secretKey || generateWgKey(),
    peers: initialData?.settings?.peers || [],
    noKernelTun: initialData?.settings?.noKernelTun || false
  });

  // Auto-tag generator
  useEffect(() => {
    if (!initialData) {
      const tag = `WG_${formData.port}`;
      setFormData(prev => ({ ...prev, tag }));
    }
  }, [formData.port]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const inbound = {
      tag: formData.tag,
      port: parseInt(formData.port),
      listen: formData.listen,
      protocol: 'wireguard',
      settings: {
        mtu: parseInt(formData.mtu),
        secretKey: formData.secretKey,
        peers: formData.peers,
        noKernelTun: formData.noKernelTun
      },
      // WireGuard usually does not use standard stream settings (it's UDP only)
      // but sniffing can be enabled
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic", "fakedns"]
      }
    };

    onSave(inbound);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="nav-tabs" style={{ borderRadius: '0', borderBottom: '1px solid var(--border-color)', margin: 0, padding: '8px 16px 0' }}>
        <button 
          type="button" 
          className="nav-link active"
          style={{ textTransform: 'capitalize', borderRadius: '8px 8px 0 0', borderBottom: 'none', padding: '10px 16px' }}
        >
          General
        </button>
      </div>
      
      {/* Content */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="grid-2">
          
          {/* Standard Fields */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tag</label>
            <input type="text" value={formData.tag} onChange={e=>setFormData({...formData, tag:e.target.value})} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Port (UDP)</label>
            <input type="number" value={formData.port} onChange={e=>setFormData({...formData, port:e.target.value})} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Listen IP</label>
            <input type="text" value={formData.listen} onChange={e=>setFormData({...formData, listen:e.target.value})} className="form-input" placeholder="0.0.0.0" />
          </div>

          {/* WireGuard Settings */}
          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#10b981' }}>WireGuard Settings</h4>
            
            <div className="form-group">
              <label className="form-label">Server Private Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={formData.secretKey} 
                  onChange={e => setFormData({...formData, secretKey: e.target.value})} 
                  className="form-input" 
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, secretKey: generateWgKey()})} 
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#059669', whiteSpace: 'nowrap' }}
                >
                  Generate
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">MTU</label>
                <input 
                  type="number" 
                  value={formData.mtu} 
                  onChange={e => setFormData({...formData, mtu: e.target.value})} 
                  className="form-input" 
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
                <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.noKernelTun} 
                    onChange={e => setFormData({...formData, noKernelTun: e.target.checked})} 
                  />
                  No Kernel Tun
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '8px' }}>
               <PeerList 
                 peers={formData.peers} 
                 onChange={(newPeers) => setFormData({...formData, peers: newPeers})} 
               />
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save WireGuard</button>
      </div>
    </form>
  );
}