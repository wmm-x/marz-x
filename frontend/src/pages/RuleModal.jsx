import { useState, useEffect } from 'react';

export default function RuleModal({ rule, outbounds, inbounds, onClose, onSave, saving }) {
  // Parse initial inboundTags (can be string or array in rule)
  const initialInboundTags = rule?.inboundTag 
    ? (Array.isArray(rule.inboundTag) ? rule.inboundTag : [rule.inboundTag]) 
    : [];

  const [formData, setFormData] = useState({
    type: rule?.type || 'field',
    outboundTag: rule?.outboundTag || 'DIRECT',
    ips: rule?.ip ? rule.ip.join('\n') : '',
    domains: rule?.domain ? rule.domain.join('\n') : '',
    port: rule?.port || '',
    inboundTags: initialInboundTags, // Array of selected tags
    protocols: rule?.protocol ? rule.protocol.join(',') : ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRule = { type: formData.type, outboundTag: formData.outboundTag };
    
    if (formData.ips.trim()) newRule.ip = formData.ips.split('\n').map(s => s.trim()).filter(s => s);
    if (formData.domains.trim()) newRule.domain = formData.domains.split('\n').map(s => s.trim()).filter(s => s);
    if (formData.port.trim()) newRule.port = formData.port.trim();
    
    // Save selected inbound tags
    if (formData.inboundTags.length > 0) {
      newRule.inboundTag = formData.inboundTags;
    }

    if (formData.protocols.trim()) newRule.protocol = formData.protocols.split(',').map(s => s.trim()).filter(s => s);
    
    onSave(newRule);
  };

  const toggleInboundTag = (tag) => {
    setFormData(prev => {
      const exists = prev.inboundTags.includes(tag);
      const newTags = exists 
        ? prev.inboundTags.filter(t => t !== tag)
        : [...prev.inboundTags, tag];
      return { ...prev, inboundTags: newTags };
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '700px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{rule ? 'Edit Routing Rule' : 'Add Routing Rule'}</h3>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body" style={{ overflowY: 'auto' }}>
          
          {/* Section 1: Routing Action */}
          <div className="card card-body" style={{ background: 'rgba(59, 130, 246, 0.1)', marginBottom: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#60a5fa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target (Destination)</h4>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Route traffic to:</label>
              <select value={formData.outboundTag} onChange={e => setFormData({...formData, outboundTag: e.target.value})} className="form-input" style={{ fontWeight: 'bold' }}>
                {outbounds.map((ob, idx) => <option key={idx} value={ob.tag}>{ob.tag} ({ob.protocol})</option>)}
                {!outbounds.find(o => o.tag === 'DIRECT') && <option value="DIRECT">DIRECT</option>}
                {!outbounds.find(o => o.tag === 'BLOCK') && <option value="BLOCK">BLOCK</option>}
              </select>
            </div>
          </div>

          {/* Section 2: Source Selection */}
          <div className="grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Source Inbounds</label>
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '0.375rem', 
                padding: '12px',
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {inbounds && inbounds.length > 0 ? inbounds.map((inb, i) => (
                  <label key={i} className="badge badge-gray cursor-pointer" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    background: formData.inboundTags.includes(inb.tag) ? 'var(--accent-blue)' : undefined,
                    color: formData.inboundTags.includes(inb.tag) ? '#fff' : undefined,
                    border: formData.inboundTags.includes(inb.tag) ? '1px solid var(--accent-blue)' : undefined
                  }}>
                    <input 
                      type="checkbox" 
                      checked={formData.inboundTags.includes(inb.tag)} 
                      onChange={() => toggleInboundTag(inb.tag)} 
                      style={{ display: 'none' }}
                    />
                    {inb.tag || 'Unnamed'}
                  </label>
                )) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No inbounds available.</p>
                )}
                
                {/* Always add 'api' option as it's common */}
                <label className="badge badge-gray cursor-pointer" style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: formData.inboundTags.includes('api') ? 'var(--accent-blue)' : undefined,
                    color: formData.inboundTags.includes('api') ? '#fff' : undefined
                  }}>
                  <input type="checkbox" checked={formData.inboundTags.includes('api')} onChange={() => toggleInboundTag('api')} style={{ display: 'none' }} />
                  api
                </label>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Select which inbounds this rule applies to. Leave empty to apply to all (unless other conditions match).
              </p>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />

          {/* Section 3: Traffic Conditions */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Target IP Rules (One per line)</label>
              <textarea 
                value={formData.ips} 
                onChange={e => setFormData({...formData, ips: e.target.value})} 
                className="form-input" 
                rows={5} 
                placeholder="geoip:private&#10;8.8.8.8" 
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Domain Rules (One per line)</label>
              <textarea 
                value={formData.domains} 
                onChange={e => setFormData({...formData, domains: e.target.value})} 
                className="form-input" 
                rows={5} 
                placeholder="geosite:google&#10;domain:example.com" 
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Target Port</label>
              <input type="text" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} className="form-input" placeholder="80,443 or 1000-2000" />
            </div>
            <div className="form-group">
              <label className="form-label">Target Protocol</label>
              <input type="text" value={formData.protocols} onChange={e => setFormData({...formData, protocols: e.target.value})} className="form-input" placeholder="http,tls,bittorrent" />
            </div>
          </div>
        </form>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Rule'}</button>
        </div>
      </div>
    </div>
  );
}