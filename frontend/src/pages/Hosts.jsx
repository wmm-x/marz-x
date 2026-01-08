import { useState, useEffect } from 'react';
import { useMarzban } from '../context/MarzbanContext';
import { marzbanApi } from '../services/api';
import toast from 'react-hot-toast';

function Hosts() {
  const { activeConfig } = useMarzban();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostsData, setHostsData] = useState(null);
  
  // Mobile Detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // State for modals
  const [editingHost, setEditingHost] = useState(null);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { tag, index }

  useEffect(() => {
    if (activeConfig) {
      fetchHosts();
    }
  }, [activeConfig]);

  const fetchHosts = async () => {
    try {
      setLoading(true);
      const res = await marzbanApi.getHosts(activeConfig.id);
      setHostsData(res.data);
    } catch (error) {
      console.error('Failed to load hosts:', error);
      toast.error('Failed to load host configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveHosts = async (newData) => {
    try {
      setSaving(true);
      await marzbanApi.updateHosts(activeConfig.id, newData);
      setHostsData(newData);
      toast.success('Configuration saved successfully!');
      return true;
    } catch (error) {
      console.error('Failed to save hosts:', error);
      toast.error('Failed to save changes');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddHost = (tag) => {
    const newData = { ...hostsData };
    if (!newData[tag]) newData[tag] = [];
    
    const newHost = {
      remark: "New Host Rule",
      address: "example.com",
      port: 443,
      sni: "",
      host: "",
      security: "inbound_default",
      alpn: "",
      fingerprint: "",
      allowinsecure: false,
      is_disabled: false,
      mux_enable: false,
      random_user_agent: false
    };
    
    newData[tag].push(newHost);
    setHostsData(newData);
    setEditingHost({ tag, index: newData[tag].length - 1, data: newHost });
  };

  const handleUpdateHost = (hostData) => {
    const newData = { ...hostsData };
    newData[editingHost.tag][editingHost.index] = hostData;
    saveHosts(newData).then((success) => {
      if (success) setEditingHost(null);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const newData = { ...hostsData };
    newData[deleteTarget.tag].splice(deleteTarget.index, 1);
    saveHosts(newData).then(() => {
      setDeleteTarget(null);
    });
  };

  if (!activeConfig) return <EmptyState message="No Server Selected" />;
  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in" style={{ padding: isMobile ? '16px' : '0' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '24px', 
        gap: '16px' 
      }}>
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Host Configuration</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Manage connection rules for {activeConfig.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => setShowRawEditor(true)} className="btn btn-secondary" style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            Raw JSON
          </button>
          <button onClick={fetchHosts} className="btn btn-primary" style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {hostsData && Object.entries(hostsData).map(([tag, hosts]) => (
          <div key={tag} className="animate-slide-up">
            
            {/* Tag Header */}
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row', 
              alignItems: isMobile ? 'flex-start' : 'center', 
              justifyContent: 'space-between', 
              marginBottom: '16px', 
              paddingBottom: '8px', 
              borderBottom: '1px solid var(--border-color)',
              gap: isMobile ? '12px' : '0' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tag}</span>
                <span style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>{hosts.length} Rules</span>
              </div>
              <button 
                onClick={() => handleAddHost(tag)} 
                className="btn btn-secondary" 
                style={{ 
                  padding: '8px 16px',        // Increased padding for standard size
                  fontSize: '0.875rem',       // Standard font size (14px)
                  width: isMobile ? '100%' : 'auto', 
                  justifyContent: 'center' 
                }}
              >
                + Add Host
              </button>
            </div>

            {/* Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', 
              gap: '20px' 
            }}>
              {hosts.map((host, idx) => (
                <HostCard 
                  key={idx} 
                  host={host} 
                  isMobile={isMobile}
                  onEdit={() => setEditingHost({ tag, index: idx, data: host })}
                  onDelete={() => setDeleteTarget({ tag, index: idx })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {editingHost && <HostModal host={editingHost.data} onClose={() => setEditingHost(null)} onSave={handleUpdateHost} saving={saving} isMobile={isMobile} />}
      {deleteTarget && <ConfirmationModal title="Delete Rule" message="Are you sure? This will remove the host rule permanently." onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} saving={saving} isMobile={isMobile} />}
      {showRawEditor && <RawJsonModal data={hostsData} onClose={() => setShowRawEditor(false)} onSave={(newData) => saveHosts(newData).then(success => success && setShowRawEditor(false))} saving={saving} isMobile={isMobile} />}
    </div>
  );
}

// --- SUB COMPONENTS ---

function HostCard({ host, onEdit, onDelete, isMobile }) {
  const isEnabled = !host.is_disabled;
  
  return (
    <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', opacity: isEnabled ? 1 : 0.6, borderLeft: isEnabled ? '4px solid var(--accent-color)' : '4px solid var(--border-color)' }}>
      <div style={{ padding: '20px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{host.remark || 'Unnamed Rule'}</h4>
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', background: isEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isEnabled ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
            {isEnabled ? 'ACTIVE' : 'DISABLED'}
          </span>
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Address</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '70%' }}>{host.address}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Port</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: '600' }}>{host.port || 'Default'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {host.sni && <Badge label="SNI" value={host.sni} />}
          {host.host && <Badge label="Host" value={host.host} />}
          {host.security && host.security !== 'none' && <Badge label="Sec" value={host.security === 'inbound_default' ? 'Default' : host.security} />}
        </div>
      </div>

      <div style={{ padding: '12px 20px', background: 'var(--bg-card-hover)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onEdit} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>Edit</button>
        <button onClick={onDelete} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem', flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>Delete</button>
      </div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', maxWidth: '100%' }}>
      <span style={{ background: 'var(--bg-card-hover)', padding: '2px 6px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
      <span style={{ padding: '2px 6px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{value}</span>
    </div>
  );
}

function HostModal({ host, onClose, onSave, saving, isMobile }) {
  const [tab, setTab] = useState('basic'); 
  const [formData, setFormData] = useState({ ...host });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = { ...formData };
    if (!cleaned.port) cleaned.port = null; 
    onSave(cleaned);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '10px' }}>
      <div className="modal-content" style={{ maxWidth: '600px', width: isMobile ? '100%' : '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{host.remark ? 'Edit Rule' : 'New Rule'}</h3>
          <button onClick={onClose} className="modal-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', overflowX: 'auto' }}>
          {['basic', 'connection', 'advanced'].map(t => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              style={{ 
                padding: '12px 16px', 
                color: tab === t ? 'var(--accent-color)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-color)' : '2px solid transparent',
                fontWeight: '600',
                textTransform: 'capitalize',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            
            {tab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Remark Name</label>
                  <input type="text" className="form-input" value={formData.remark || ''} onChange={e => handleChange('remark', e.target.value)} placeholder="e.g. My Custom Rule" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Destination Address</label>
                  <input type="text" className="form-input" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} placeholder="domain.com or IP" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input type="number" className="form-input" value={formData.port || ''} onChange={e => handleChange('port', e.target.value)} placeholder="Leave empty for default" />
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontWeight: '500' }}>Enable this rule</span>
                    <input type="checkbox" style={{ width: '18px', height: '18px' }} checked={!formData.is_disabled} onChange={e => handleChange('is_disabled', !e.target.checked)} />
                  </label>
                </div>
              </div>
            )}

            {tab === 'connection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">SNI (Server Name Indication)</label>
                  <input type="text" className="form-input" value={formData.sni || ''} onChange={e => handleChange('sni', e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Host Header</label>
                  <input type="text" className="form-input" value={formData.host || ''} onChange={e => handleChange('host', e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Path</label>
                  <input type="text" className="form-input" value={formData.path || ''} onChange={e => handleChange('path', e.target.value)} placeholder="/" />
                </div>
              </div>
            )}

            {tab === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Security</label>
                    <select className="form-input" value={formData.security || 'inbound_default'} onChange={e => handleChange('security', e.target.value)}>
                      <option value="inbound_default">Default</option>
                      <option value="none">None</option>
                      <option value="tls">TLS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fingerprint</label>
                    <select className="form-input" value={formData.fingerprint || ''} onChange={e => handleChange('fingerprint', e.target.value)}>
                      <option value="">None</option>
                      <option value="chrome">Chrome</option>
                      <option value="firefox">Firefox</option>
                      <option value="random">Random</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">ALPN</label>
                  <input type="text" className="form-input" value={formData.alpn || ''} onChange={e => handleChange('alpn', e.target.value)} placeholder="h2,http/1.1" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Checkbox label="Allow Insecure" checked={formData.allowinsecure} onChange={v => handleChange('allowinsecure', v)} />
                  <Checkbox label="Enable Mux" checked={formData.mux_enable} onChange={v => handleChange('mux_enable', v)} />
                  <Checkbox label="Random User Agent" checked={formData.random_user_agent} onChange={v => handleChange('random_user_agent', v)} />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Rule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} style={{ width: '16px', height: '16px' }} />
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  );
}

function ConfirmationModal({ title, message, onConfirm, onCancel, saving, isMobile }) {
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ padding: '10px' }}>
      <div className="modal-content" style={{ maxWidth: '400px', width: isMobile ? '100%' : '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3 style={{ color: '#ef4444' }}>{title}</h3></div>
        <div className="modal-body"><p style={{ color: 'var(--text-secondary)' }}>{message}</p></div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn btn-danger" disabled={saving}>{saving ? 'Processing...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

function RawJsonModal({ data, onClose, onSave, saving, isMobile }) {
  const [text, setText] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setText(newVal);
    try {
      if (newVal.trim() === '') { setError(''); return; }
      JSON.parse(newVal);
      setError('');
    } catch (err) {
      let msg = err.message || 'Syntax Error';
      const match = msg.match(/at position (\d+)/);
      if (match) {
        const position = parseInt(match[1], 10);
        const lineCount = newVal.substring(0, position).split('\n').length;
        msg = `Syntax Error (Line ${lineCount}): ${msg.replace(/ in JSON at position \d+/, '')}`;
      }
      setError(msg);
    }
  };

  const handleSave = () => {
    if (error) return;
    try { 
      onSave(JSON.parse(text)); 
    } catch(e) { 
      setError(e.message); 
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
        <div className="modal-header"><h3>Raw JSON</h3><button onClick={onClose} className="modal-close">X</button></div>
        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {error && <div style={{ color: '#ef4444', marginBottom: '10px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>{error}</div>}
          <textarea 
            className="form-input" 
            style={{ 
              fontFamily: 'monospace', 
              flex: 1, 
              resize: 'none',
              width: '100%'
            }} 
            value={text} 
            onChange={handleInputChange} 
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        <div className="modal-footer" style={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? '8px' : '12px' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ width: isMobile ? '100%' : 'auto' }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving || !!error} style={{ width: isMobile ? '100%' : 'auto' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;
}

function EmptyState({ message }) {
  return <div style={{ textAlign: 'center', padding: '60px' }}><h3 style={{ color: 'var(--text-muted)' }}>{message}</h3></div>;
}

export default Hosts;