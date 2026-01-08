import { useState, useEffect } from 'react';

// Helper to parse network from string or array
const getNetworks = (net) => {
  if (Array.isArray(net)) return net;
  if (typeof net === 'string') return net.split(',').map(s => s.trim());
  return ['tcp', 'udp']; // Default if missing
};

export default function DokodemoInbound({ initialData, onClose, onSave, saving }) {
  const initialNetworks = getNetworks(initialData?.settings?.network);

  const [formData, setFormData] = useState({
    tag: initialData?.tag || '',
    listen: initialData?.listen || '0.0.0.0',
    port: initialData?.port || 1080,
    address: initialData?.settings?.address || '127.0.0.1',
    targetPort: initialData?.settings?.port || 80,
    networkTcp: initialNetworks.includes('tcp'),
    networkUdp: initialNetworks.includes('udp'),
    followRedirect: initialData?.settings?.followRedirect || false
  });

  // Auto-tag generator
  useEffect(() => {
    if (!initialData) {
      const tag = `DOKO_${formData.port}`;
      setFormData(prev => ({ ...prev, tag }));
    }
  }, [formData.port]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Construct network array
    const networks = [];
    if (formData.networkTcp) networks.push('tcp');
    if (formData.networkUdp) networks.push('udp');

    onSave({
      tag: formData.tag,
      protocol: 'dokodemo-door',
      port: parseInt(formData.port),
      listen: formData.listen,
      settings: {
        address: formData.address,
        port: parseInt(formData.targetPort),
        network: networks.length > 0 ? networks : ['tcp', 'udp'],
        followRedirect: formData.followRedirect
      },
      streamSettings: null, // Dokodemo usually doesn't use stream settings
      sniffing: null
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header / Tabs Placeholder (Visual consistency) */}
      <div className="nav-tabs" style={{ borderRadius: '0', borderBottom: '1px solid var(--border-color)', margin: 0, padding: '8px 16px 0' }}>
        <button type="button" className="nav-link active" style={{ textTransform: 'capitalize', borderRadius: '8px 8px 0 0', borderBottom: 'none', padding: '10px 16px' }}>
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
            <label className="form-label">Inbound Port</label>
            <input type="number" value={formData.port} onChange={e=>setFormData({...formData, port:e.target.value})} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Listen IP</label>
            <input type="text" value={formData.listen} onChange={e=>setFormData({...formData, listen:e.target.value})} className="form-input" placeholder="0.0.0.0" />
          </div>

          {/* Dokodemo Specifics */}
          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#10b981' }}>Forward Settings</h4>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Target Address</label>
                <input type="text" value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} className="form-input" placeholder="127.0.0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Target Port</label>
                <input type="number" value={formData.targetPort} onChange={e=>setFormData({...formData, targetPort:e.target.value})} className="form-input" />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
               <div className="form-group">
                 <label className="form-label">Networks</label>
                 <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                   <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                     <input type="checkbox" checked={formData.networkTcp} onChange={e => setFormData({...formData, networkTcp: e.target.checked})} />
                     TCP
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                     <input type="checkbox" checked={formData.networkUdp} onChange={e => setFormData({...formData, networkUdp: e.target.checked})} />
                     UDP
                   </label>
                 </div>
               </div>

               <div className="form-group">
                 <label className="form-label">Options</label>
                 <div style={{ marginTop: '8px' }}>
                   <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                     <input type="checkbox" checked={formData.followRedirect} onChange={e => setFormData({...formData, followRedirect: e.target.checked})} />
                     Follow Redirect
                   </label>
                 </div>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save Dokodemo</button>
      </div>
    </form>
  );
}