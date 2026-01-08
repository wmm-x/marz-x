import { useState, useEffect } from 'react';

export default function FreedomOutbound({ initialData, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({
    tag: initialData?.tag || 'direct',
    domainStrategy: initialData?.settings?.domainStrategy || 'AsIs',
    redirect: initialData?.settings?.redirect || ''
  });

  // Auto-tag generator
  useEffect(() => {
    if (!initialData) {
      setFormData(prev => ({ ...prev, tag: 'freedom_out' }));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const outbound = {
      tag: formData.tag,
      protocol: 'freedom',
      settings: {
        domainStrategy: formData.domainStrategy,
        redirect: formData.redirect || undefined
      }
    };
    onSave(outbound);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs / Header Placeholder */}
      <div className="nav-tabs" style={{ borderRadius: '0', borderBottom: '1px solid var(--border-color)', margin: 0, padding: '8px 16px 0' }}>
        <button type="button" className="nav-link active" style={{ textTransform: 'capitalize', borderRadius: '8px 8px 0 0', borderBottom: 'none', padding: '10px 16px' }}>General</button>
      </div>

      {/* Content */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tag</label>
            <input type="text" value={formData.tag} onChange={e=>setFormData({...formData, tag:e.target.value})} className="form-input" />
          </div>

          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#3b82f6' }}>Freedom Settings</h4>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Domain Strategy</label>
                <select value={formData.domainStrategy} onChange={e=>setFormData({...formData, domainStrategy:e.target.value})} className="form-input">
                  <option value="AsIs">AsIs</option>
                  <option value="UseIP">UseIP</option>
                  <option value="UseIPv4">UseIPv4</option>
                  <option value="UseIPv6">UseIPv6</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Resolution strategy for domain names.
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label">Redirect (Optional)</label>
                <input type="text" value={formData.redirect} onChange={e=>setFormData({...formData, redirect:e.target.value})} className="form-input" placeholder="127.0.0.1:80" />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Redirect traffic to this address.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save Freedom</button>
      </div>
    </form>
  );
}