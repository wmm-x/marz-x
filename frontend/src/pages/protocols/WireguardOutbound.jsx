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
  // Add a blank peer
  const addPeer = () => {
    onChange([
      ...peers, 
      { 
        publicKey: '', 
        endpoint: '', 
        preSharedKey: '', 
        allowedIPs: ['0.0.0.0/0', '::/0'], 
        keepAlive: 25 
      }
    ]);
  };

  // Add a peer with auto-generated keys
  const generatePeer = () => {
    onChange([
      ...peers, 
      { 
        publicKey: generateWgKey(), 
        endpoint: '127.0.0.1:51820', // Placeholder endpoint
        preSharedKey: generateWgKey(), 
        allowedIPs: ['0.0.0.0/0', '::/0'], 
        keepAlive: 25 
      }
    ]);
  };

  const removePeer = (index) => {
    onChange(peers.filter((_, i) => i !== index));
  };

  const updatePeer = (index, field, val) => {
    const newPeers = [...peers];
    if (field === 'allowedIPs') {
      newPeers[index][field] = val.split(',').map(s => s.trim()).filter(s => s);
    } else {
      newPeers[index][field] = val;
    }
    onChange(newPeers);
  };

  // Helper to generate keys for an EXISTING peer row
  const regeneratePeerKeys = (index) => {
    const newPeers = [...peers];
    newPeers[index].publicKey = generateWgKey();
    newPeers[index].preSharedKey = generateWgKey();
    onChange(newPeers);
  };

  return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <label className="form-label" style={{ margin: 0 }}>Peers</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            onClick={generatePeer}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: '#8b5cf6', borderColor: '#7c3aed' }}
          >
            + Generate
          </button>
          <button 
            type="button" 
            onClick={addPeer}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}
          >
            + Add
          </button>
        </div>
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
                <button type="button" onClick={() => regeneratePeerKeys(index)} className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Gen Keys</button>
                <button type="button" onClick={() => removePeer(index)} className="btn btn-sm btn-danger" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Remove</button>
              </div>
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Peer Public Key</label>
                <input 
                  type="text" 
                  value={peer.publicKey} 
                  onChange={(e) => updatePeer(index, 'publicKey', e.target.value)} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Endpoint (Host:Port)</label>
                <input 
                  type="text" 
                  value={peer.endpoint} 
                  onChange={(e) => updatePeer(index, 'endpoint', e.target.value)} 
                  className="form-input" 
                  placeholder="example.com:51820"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Pre-Shared Key (Optional)</label>
                <input 
                  type="text" 
                  value={peer.preSharedKey} 
                  onChange={(e) => updatePeer(index, 'preSharedKey', e.target.value)} 
                  className="form-input" 
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Allowed IPs</label>
                <input 
                  type="text" 
                  value={Array.isArray(peer.allowedIPs) ? peer.allowedIPs.join(', ') : peer.allowedIPs} 
                  onChange={(e) => updatePeer(index, 'allowedIPs', e.target.value)} 
                  className="form-input" 
                  placeholder="0.0.0.0/0"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Keep Alive (s)</label>
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

export default function WireguardOutbound({ initialData, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({
    tag: initialData?.tag || 'wireguard_out',
    // Outbound specific settings
    mtu: initialData?.settings?.mtu || 1420,
    secretKey: initialData?.settings?.secretKey || generateWgKey(),
    address: initialData?.settings?.address ? initialData.settings.address.join(', ') : '172.16.0.2/32',
    peers: initialData?.settings?.peers || [],
    noKernelTun: initialData?.settings?.noKernelTun || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const outbound = {
      tag: formData.tag,
      protocol: 'wireguard',
      settings: {
        mtu: parseInt(formData.mtu),
        secretKey: formData.secretKey,
        address: formData.address.split(',').map(s => s.trim()).filter(s => s),
        peers: formData.peers,
        noKernelTun: formData.noKernelTun
      },
    };

    onSave(outbound);
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
          Outbound Config
        </button>
      </div>
      
      {/* Content */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="grid-2">
          
          {/* Tag */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tag</label>
            <input type="text" value={formData.tag} onChange={e=>setFormData({...formData, tag:e.target.value})} className="form-input" />
          </div>

          {/* WireGuard Settings */}
          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#10b981' }}>WireGuard Interface</h4>
            
            <div className="form-group">
              <label className="form-label">Client Private Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={formData.secretKey} 
                  onChange={e => setFormData({...formData, secretKey: e.target.value})} 
                  className="form-input" 
                  style={{ flex: 1, fontFamily: 'monospace' }}
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
                <label className="form-label">Local Address</label>
                <input 
                  type="text" 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  className="form-input" 
                  placeholder="172.16.0.2/32"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  The IP address of this interface.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">MTU</label>
                <input 
                  type="number" 
                  value={formData.mtu} 
                  onChange={e => setFormData({...formData, mtu: e.target.value})} 
                  className="form-input" 
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '10px' }}>
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

            <div className="form-group" style={{ marginTop: '16px' }}>
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