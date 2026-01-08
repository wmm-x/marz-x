import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarzban } from '../context/MarzbanContext';
import { marzbanApi, authApi } from '../services/api';
import toast from 'react-hot-toast';

function Settings() {
  const { user } = useAuth();
  const { configs, loadConfigs, selectConfig, activeConfig } = useMarzban();
  const [showAddServer, setShowAddServer] = useState(false);
  const [showEditServer, setShowEditServer] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  var handleDeleteConfig = async function(config) {
  if (! confirm('Remove server "' + config.name + '"? ')) return;
  
  try {
    await marzbanApi.deleteConfig(config.id);
    toast.success('Server removed');
    loadConfigs();
  } catch (error) {
    toast.error('Failed to remove server');
  }
};

  var handleEditConfig = function (config) {
    setEditingConfig(config);
    setShowEditServer(true);
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Settings</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Manage your account and server connections</p>
      </div>

      {/* Account Settings Card */}
      <div style={{
        background: 'linear-gradient(135deg, #131111ff 0%, #050505ff 100%)', // Updated Background
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', color: 'var(--accent-blue)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account Settings
          </h3>
        </div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'white',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              {user && user.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: '600', fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                {user ? user.username || user.email || 'Administrator' : 'Administrator'}
              </p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {user ? user.name || 'Admin Account' : 'Admin Account'}
              </p>
            </div>
          </div>
          <button onClick={function () { setShowChangePassword(true); }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Marzban Servers Card */}
      <div style={{
        background: 'linear-gradient(135deg, #080808ff 0%, #030509 100%)', // Updated Background
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px', color: 'var(--accent-cyan)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            Marzban Servers
          </h3>
          <button onClick={function () { setShowAddServer(true); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Server
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {configs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ width: '32px', height: '32px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>No servers configured</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px', opacity: 0.7 }}>Add a Marzban server to get started</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {configs.map(function (config) {
                var isActive = activeConfig && activeConfig.id === config.id;
                return (
                  <div
                    key={config.id}
                    style={{
                      background: isActive ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid ' + (isActive ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-color)'),
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '200px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)'
                      }}></div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)', fontSize: '1rem' }}>
                          {config.name}
                          {isActive && (
                            <span style={{
                              marginLeft: '10px',
                              padding: '2px 8px',
                              background: 'var(--accent-purple)',
                              borderRadius: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: '600',
                              color: 'white',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Active
                            </span>
                          )}
                        </p>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                          {config.endpointUrl}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!isActive && (
                        <button
                          onClick={function () { selectConfig(config); toast.success('Switched to ' + config.name); }}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Select
                        </button>
                      )}
                      <button
                        onClick={function () { handleEditConfig(config); }}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={function () { handleDeleteConfig(config); }}
                        className="btn btn-danger"
                        style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddServer && (
        <AddServerModal
          onClose={function () { setShowAddServer(false); }}
          onSuccess={function () { setShowAddServer(false); loadConfigs(); }}
        />
      )}

      {/* Edit Server Modal */}
      {showEditServer && editingConfig && (
        <EditServerModal
          config={editingConfig}
          onClose={function () { setShowEditServer(false); setEditingConfig(null); }}
          onSuccess={function () { setShowEditServer(false); setEditingConfig(null); loadConfigs(); }}
        />
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={function () { setShowChangePassword(false); }}
        />
      )}
    </div>
  );
}

function AddServerModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    endpointUrl: '',
    username: '',
    password: ''
  });

  var handleSubmit = async function (e) {
    e.preventDefault();
    setLoading(true);

    try {
      await marzbanApi.connect(formData);
      toast.success('Server connected successfully! ');
      onSuccess();
    } catch (error) {
      var msg = error.response?.data?.error || 'Failed to connect to server';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '480px',
          background: 'linear-gradient(135deg, #000000ff 0%, #030509 100%)', 
          border: '1px solid var(--border-color)' 
        }} 
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="modal-header">
          <h3>Add Marzban Server</h3>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Server Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={function (e) { setFormData({ ...formData, name: e.target.value }); }}
                className="form-input"
                placeholder="My Marzban Server"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint URL</label>
              <input
                type="url"
                value={formData.endpointUrl}
                onChange={function (e) { setFormData({ ...formData, endpointUrl: e.target.value }); }}
                className="form-input"
                placeholder="https://panel.example.com:8000"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={function (e) { setFormData({ ...formData, username: e.target.value }); }}
                className="form-input"
                placeholder="admin"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={function (e) { setFormData({ ...formData, password: e.target.value }); }}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditServerModal({ config, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: config.name || '',
    endpointUrl:  config.endpointUrl || '',
    username: '',
    password: ''
  });

  var handleSubmit = async function(e) {
    e.preventDefault();
    
    if (!formData.name. trim()) {
      toast.error('Server name is required');
      return;
    }
    
    if (!formData.endpointUrl.trim()) {
      toast.error('Endpoint URL is required');
      return;
    }

    setLoading(true);

    try {
      var updateData = { 
        name: formData.name.trim(), 
        endpointUrl:  formData.endpointUrl. trim() 
      };
      
      if (formData. username.trim() && formData.password) {
        updateData.username = formData.username.trim();
        updateData.password = formData.password;
      }
      
      var response = await marzbanApi.updateConfig(config.id, updateData);
      
      if (response && response.data) {
        toast.success('Server updated successfully!');
        onSuccess();
      }
    } catch (error) {
      console.error('Update server error:', error);
      var msg = 'Failed to update server';
      if (error.response && error.response.data && error.response.data.error) {
        msg = error.response.data.error;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '480px',
          background: 'linear-gradient(135deg, #201d1dff 0%, #030509 100%)', 
          border: '1px solid var(--border-color)'
        }} 
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="modal-header">
          <h3>Edit Server</h3>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Server Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={function(e) { setFormData({...formData, name: e. target.value}); }}
                className="form-input"
                placeholder="My Marzban Server"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint URL</label>
              <input
                type="url"
                value={formData.endpointUrl}
                onChange={function(e) { setFormData({...formData, endpointUrl: e. target.value}); }}
                className="form-input"
                placeholder="https://panel.example.com:8000"
                required
              />
            </div>
            
            <div style={{ 
              padding: '12px', 
              background: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: '8px', 
              border: '1px solid rgba(59, 130, 246, 0.2)', 
              margin: '16px 0' 
            }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--accent-blue)' }}>
                Leave username and password empty to keep existing credentials
              </p>
            </div>
            
            <div className="form-group">
              <label className="form-label">New Username (optional)</label>
              <input
                type="text"
                value={formData.username}
                onChange={function(e) { setFormData({...formData, username: e.target.value}); }}
                className="form-input"
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password (optional)</label>
              <input
                type="password"
                value={formData.password}
                onChange={function(e) { setFormData({...formData, password: e. target.value}); }}
                className="form-input"
                placeholder="Leave empty to keep current"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // FIX: Removed showCurrentPassword state
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [username, setUsername] = useState(user?.username || user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  var handleSubmit = async function(e) {
    e.preventDefault();
    if (! username || username.trim() === '') { toast.error('Username is required'); return; }
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
      if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    }
    if (!currentPassword) { toast.error('Current password is required'); return; }

    setLoading(true);
    try {
      var updateData = { username: username. trim(), currentPassword: currentPassword };
      if (newPassword) { updateData.newPassword = newPassword; }
      await authApi.updateProfile(updateData);
      toast.success('Profile updated!  Please login with your new credentials.');
      logout();
    } catch (error) {
      var msg = error.response?.data?.error || 'Failed to update profile';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '450px',
          background: 'linear-gradient(135deg, #000000ff 0%, #0c0c0cff 100%)', // Updated Background
          border: '1px solid var(--border-color)'
        }} 
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Username Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" style={{ width: '18px', height:  '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>Login Credentials</span>
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input type="text" value={username} onChange={function(e) { setUsername(e.target.value); }} className="form-input" placeholder="Enter username" required />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>This is the username you use to login</p>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '20px 0' }}></div>

            {/* Password Section */}
            <div>
              <div style={{ display:  'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" style={{ width: '18px', height:  '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>Password</span>
              </div>

              {/* FIX: Current Password - removed Show/Hide Toggle */}
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={function(e) { setCurrentPassword(e. target.value); }}
                    className="form-input"
                    placeholder="Enter current password"
                    required
                  />
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', margin: '16px 0' }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--accent-blue)' }}>Leave new password fields empty to keep your current password</p>
              </div>

              {/* New Password - Toggle kept */}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={function(e) { setNewPassword(e.target.value); }}
                    className="form-input"
                    placeholder="Enter new password (min 6 chars)"
                    style={{ paddingRight: '48px' }}
                  />
                  <button type="button" onClick={function() { setShowNewPassword(!showNewPassword); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={showNewPassword ? 'Hide' : 'Show'}>
                    {showNewPassword ? (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height:  '20px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>) : (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}
                  </button>
                </div>
              </div>

              {/* Confirm New Password - Toggle kept */}
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' :  'password'}
                    value={confirmPassword}
                    onChange={function(e) { setConfirmPassword(e.target.value); }}
                    className="form-input"
                    placeholder="Confirm new password"
                    style={{ paddingRight: '48px' }}
                  />
                  <button type="button" onClick={function() { setShowConfirmPassword(!showConfirmPassword); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={showConfirmPassword ? 'Hide' :  'Show'}>
                    {showConfirmPassword ? (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>) : (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', marginTop: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--accent-orange)' }}>⚠️ After saving changes, you will be logged out and need to login with your new credentials.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default Settings;