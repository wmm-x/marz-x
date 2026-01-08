import { useState, useEffect } from 'react';

// Helper: Account List Editor
const AccountList = ({ accounts = [], onChange }) => {
  const addAccount = () => {
    onChange([...accounts, { user: '', pass: '' }]);
  };

  const removeAccount = (index) => {
    const newAccounts = accounts.filter((_, i) => i !== index);
    onChange(newAccounts);
  };

  const updateAccount = (index, field, val) => {
    const newAccounts = [...accounts];
    newAccounts[index][field] = val;
    onChange(newAccounts);
  };

  return (
    <div className="card card-body" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>Accounts</label>
        <button 
          type="button" 
          onClick={addAccount}
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}
        >
          + Add User
        </button>
      </div>
      
      {accounts.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
          No authentication (Open Proxy)
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {accounts.map((acc, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Username"
              value={acc.user}
              onChange={(e) => updateAccount(index, 'user', e.target.value)}
              className="form-input"
              style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
            />
            <input 
              type="text" 
              placeholder="Password"
              value={acc.pass}
              onChange={(e) => updateAccount(index, 'pass', e.target.value)}
              className="form-input"
              style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
            />
            <button 
              type="button" 
              onClick={() => removeAccount(index)}
              className="btn btn-danger"
              style={{ padding: '0 10px' }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function HttpInbound({ initialData, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({
    tag: initialData?.tag || '',
    port: initialData?.port || 8080,
    listen: initialData?.listen || '0.0.0.0',
    
    // HTTP Specifics
    accounts: initialData?.settings?.accounts || [],
    allowTransparent: initialData?.settings?.allowTransparent || false,
  });

  // Auto-tag generator
  useEffect(() => {
    if (!initialData) {
      const tag = `HTTP_${formData.port}`;
      setFormData(prev => ({ ...prev, tag }));
    }
  }, [formData.port]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Construct the inbound object
    const inbound = {
      tag: formData.tag,
      port: parseInt(formData.port),
      listen: formData.listen,
      protocol: 'http',
      settings: {
        accounts: formData.accounts.filter(a => a.user && a.pass), // Filter incomplete
        allowTransparent: formData.allowTransparent,
        timeout: 0,
        userLevel: 0
      },
      // Stream settings not required for basic HTTP proxy (defaults to TCP)
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
          style={{ 
            textTransform: 'capitalize', 
            borderRadius: '8px 8px 0 0', 
            borderBottom: 'none',
            padding: '10px 16px',
            cursor: 'pointer'
          }}
        >
          General
        </button>
      </div>
      
      {/* Content */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tag</label>
            <input 
              type="text" 
              value={formData.tag} 
              onChange={e=>setFormData({...formData, tag:e.target.value})} 
              className="form-input" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Port</label>
            <input 
              type="number" 
              value={formData.port} 
              onChange={e=>setFormData({...formData, port:e.target.value})} 
              className="form-input" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Listen IP</label>
            <input 
              type="text" 
              value={formData.listen} 
              onChange={e=>setFormData({...formData, listen:e.target.value})} 
              className="form-input" 
              placeholder="0.0.0.0" 
            />
          </div>

          {/* HTTP Settings */}
          <div className="card card-body" style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '16px', color: '#10b981' }}>HTTP Settings</h4>
            
            <div className="form-group">
               <AccountList 
                 accounts={formData.accounts} 
                 onChange={(newAccounts) => setFormData({...formData, accounts: newAccounts})} 
               />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={formData.allowTransparent} 
                  onChange={e => setFormData({...formData, allowTransparent: e.target.checked})} 
                />
                Allow Transparent
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                Enable transparent proxying (requires traffic redirection).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save HTTP</button>
      </div>
    </form>
  );
}