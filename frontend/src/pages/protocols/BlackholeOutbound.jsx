import { useState, useEffect } from 'react';

export default function BlackholeOutbound({ initialData, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({
    tag: initialData?.tag || 'block',
    type: initialData?.settings?.response?.type || 'none'
  });

  useEffect(() => {
    if (!initialData) {
      setFormData(prev => ({ ...prev, tag: 'blackhole_out' }));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      tag: formData.tag,
      protocol: 'blackhole',
      settings: {
        response: { type: formData.type }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="nav-tabs" style={{ borderRadius: '0', borderBottom: '1px solid var(--border-color)', margin: 0, padding: '8px 16px 0' }}>
        <button type="button" className="nav-link active" style={{ textTransform: 'capitalize', borderRadius: '8px 8px 0 0', borderBottom: 'none', padding: '10px 16px' }}>General</button>
      </div>

      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tag</label>
            <input type="text" value={formData.tag} onChange={e=>setFormData({...formData, tag:e.target.value})} className="form-input" />
          </div>

          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#ef4444' }}>Blackhole Settings</h4>
            <div className="form-group">
              <label className="form-label">Response Type</label>
              <select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value})} className="form-input">
                <option value="none">None (Drop)</option>
                <option value="http">HTTP (403 Forbidden)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save Blackhole</button>
      </div>
    </form>
  );
}