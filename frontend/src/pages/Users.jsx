import { useState, useEffect, useRef } from 'react';
import { useMarzban } from '../context/MarzbanContext';
import { usersApi, marzbanApi } from '../services/api';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code'; 

function Users() {
  const { activeConfig } = useMarzban();
  
  // State for data
  const [allUsers, setAllUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [coreConfig, setCoreConfig] = useState(null);
  
  const searchTimeout = useRef(null);

  // 1. Mobile Resize Listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Load Data
  useEffect(function () {
    if (activeConfig) {
      loadAllUsers();
      loadCoreConfig();
    }
  }, [activeConfig, status]);

  // 3. Search Effect
  useEffect(function () {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(function () {
      if (activeConfig) { setPage(0); loadAllUsers(); }
    }, 500);
    return function () { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  // 4. Sort & Paginate
  useEffect(function () {
    if (!allUsers.length) {
      setUsers([]);
      return;
    }

    let sortedList = [...allUsers].sort(function (a, b) {
      var timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      var timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = sortedList.slice(startIndex, endIndex);

    setUsers(paginatedUsers);
  }, [allUsers, page, sortOrder]);


  // --- API FUNCTIONS ---

  var loadAllUsers = async function () {
    try {
      setLoading(true);
      var params = { offset: 0, limit: 10000 }; 
      if (status) params.status = status;
      if (search) params.search = search;
      
      var res = await usersApi.getUsers(activeConfig.id, params);
      
      if (res.data && res.data.users) {
        setAllUsers(res.data.users);
        setTotal(res.data.users.length);
      } else { 
        setAllUsers([]); 
        setTotal(0); 
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
      setAllUsers([]); 
      setTotal(0);
    } finally { setLoading(false); }
  };

  var loadCoreConfig = async function () {
    try {
      try {
        var res = await marzbanApi.getCoreConfig(activeConfig.id);
        if (res.data && res.data.inbounds && res.data.inbounds.length > 0) { setCoreConfig(res.data); return; }
      } catch (e) { console.log('Core config failed'); }
      var inboundsRes = await marzbanApi.getInbounds(activeConfig.id);
      if (inboundsRes.data) {
        var fakeConfig = { inbounds: [] };
        Object.keys(inboundsRes.data).forEach(function (protocol) {
          var tags = inboundsRes.data[protocol];
          if (Array.isArray(tags)) tags.forEach(function (tag) { fakeConfig.inbounds.push({ protocol: protocol, tag: tag }); });
        });
        setCoreConfig(fakeConfig);
      }
    } catch (error) { console.error('Failed to load inbounds:', error); }
  };

  var showConfirm = function (title, message, onConfirm) {
    setConfirmAction({ title: title, message: message, onConfirm: onConfirm });
    setShowConfirmModal(true);
  };

  var handleConfirm = function () {
    if (confirmAction && confirmAction.onConfirm) confirmAction.onConfirm();
    setShowConfirmModal(false); setConfirmAction(null);
  };

  var handleDelete = function (username) {
    showConfirm('Delete User', 'Are you sure you want to delete "' + username + '"?', async function () {
      try { await usersApi.deleteUser(activeConfig.id, username); toast.success('User deleted'); loadAllUsers(); }
      catch (error) { toast.error('Failed to delete user'); }
    });
  };

  var handleResetTraffic = function (username) {
    showConfirm('Reset Traffic', 'Reset traffic for "' + username + '"?', async function () {
      try { await usersApi.resetTraffic(activeConfig.id, username); toast.success('Traffic reset'); loadAllUsers(); }
      catch (error) { toast.error('Failed to reset traffic'); }
    });
  };

  var handleToggleStatus = function (u) {
    var newStatus = u.status === 'active' ? 'disabled' : 'active';
    var action = newStatus === 'active' ? 'Enable' : 'Disable';
    showConfirm(action + ' User', action + ' user "' + u.username + '"?', async function () {
      try { await usersApi.updateUser(activeConfig.id, u.username, { status: newStatus }); toast.success('User ' + (newStatus === 'active' ? 'enabled' : 'disabled')); loadAllUsers(); }
      catch (error) { toast.error('Failed to update status'); }
    });
  };

  var handleEdit = function (u) { setSelectedUser(u); setShowEditModal(true); };
  
  var handleShowLinks = function(u) {
    if ((!u.links || u.links.length === 0) && !u.subscription_url) { 
      toast.error('No links or subscription available'); 
      return; 
    }
    setSelectedUser(u);
    setShowLinksModal(true);
  };

  var formatBytes = function (bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024; var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  var formatDate = function (timestamp) {
    if (!timestamp || timestamp === 0) return 'Never';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  var formatDateTime = function (isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  var getStatusBadge = function (s) {
    var styles = {
      active: { background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' },
      disabled: { background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)' },
      limited: { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
      expired: { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
      on_hold: { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' },
    };
    return styles[s] || styles.disabled;
  };

  var totalPages = Math.ceil(total / limit);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Users</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Total:  {total} users</p>
        </div>
        <button onClick={function () { setShowCreateModal(true); }} className="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span>Create User</span>
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              value={search} 
              onChange={function (e) { setSearch(e.target.value); }} 
              placeholder="Search..." 
              className="form-input" 
              style={{ paddingLeft: '44px', paddingRight: '40px', width: '100%' }} 
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%' }}
                title="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          
          <select value={status} onChange={function (e) { setStatus(e.target.value); setPage(0); }} className="form-input" style={{ width: 'auto', minWidth: '130px' }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="limited">Limited</option>
            <option value="expired">Expired</option>
            <option value="on_hold">On Hold</option>
          </select>

          <select value={sortOrder} onChange={function (e) { setSortOrder(e.target.value); setPage(0); }} className="form-input" style={{ width: 'auto', minWidth: '130px' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <button type="button" className="btn btn-secondary" onClick={function () { setSearch(''); setStatus(''); setSortOrder('newest'); setPage(0); }}>Reset</button>
        </div>
      </div>

      <div style={{ background: isMobile ? 'transparent' : 'var(--bg-card)', border: isMobile ? 'none' : '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container"><div className="spinner"></div><p className="loading-text">Loading users... </p></div>
        ) : users.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: 'var(--text-muted)' }}>No users found</p></div>
        ) : (
          isMobile ? (
            // --- MOBILE CARD VIEW ---
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {users.map(function(u) {
                var pct = u.data_limit ? Math.min((u.used_traffic / u.data_limit) * 100, 100) : 0;
                var stl = getStatusBadge(u.status);
                return (
                  <div key={u.username}  className="table-body" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontWeight: '700', color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>{u.username}</p>
                        {u.note && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{u.note}</p>}
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', ...stl }}>{u.status}</span>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data Usage</span>
                         <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>{formatBytes(u.used_traffic)} / {u.data_limit ? formatBytes(u.data_limit) : '∞'}</span>
                      </div>
                      {u.data_limit > 0 && (
                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px' }}>
                          <div style={{ width: pct + '%', height: '100%', borderRadius: '3px', background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e' }}></div>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expires:</span>
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatDate(u.expire)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDateTime(u.created_at)}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                          <ActionButton onClick={function() { handleShowLinks(u); }} title="Links" color="#8b5cf6" icon="qr" />
                          <ActionButton onClick={function () { handleToggleStatus(u); }} title={u.status === 'active' ? 'Disable' : 'Enable'} color={u.status === 'active' ? '#f59e0b' : '#22c55e'} icon={u.status === 'active' ? 'pause' : 'play'} />
                          <ActionButton onClick={function () { handleResetTraffic(u.username); }} title="Reset" color="#f97316" icon="reset" />
                          <ActionButton onClick={function () { handleEdit(u); }} title="Edit" color="#3b82f6" icon="edit" />
                          <ActionButton onClick={function () { handleDelete(u.username); }} title="Delete" color="#ef4444" icon="delete" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // --- DESKTOP TABLE VIEW ---
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr style={{ background: 'rgba(4, 4, 4, 0.48)' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Username</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Used / Limit</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Expires</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Created</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {users.map(function (u) {
                    var pct = u.data_limit ? Math.min((u.used_traffic / u.data_limit) * 100, 100) : 0;
                    var stl = getStatusBadge(u.status);
                    return (
                      <tr key={u.username} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <p style={{ fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{u.username}</p>
                          {u.note && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{u.note}</p>}
                        </td>
                        <td style={{ padding: '16px 20px' }}><span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: '600', ...stl }}>{u.status}</span></td>
                        <td style={{ padding: '16px 20px' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}><strong>{formatBytes(u.used_traffic)}</strong><span style={{ color: 'var(--text-muted)' }}> / {u.data_limit ? formatBytes(u.data_limit) : '∞'}</span></p>
                          {u.data_limit > 0 && <div style={{ width: '100px', height: '6px', background: 'var(--border-color)', borderRadius: '3px', marginTop: '6px' }}><div style={{ width: pct + '%', height: '100%', borderRadius: '3px', background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e' }}></div></div>}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '16px 20px' }}>{formatDate(u.expire)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '16px 20px' }}>{formatDateTime(u.created_at)}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            <ActionButton onClick={function() { handleShowLinks(u); }} title="Show Links & QRs" color="#8b5cf6" icon="qr" />
                            <ActionButton onClick={function () { handleToggleStatus(u); }} title={u.status === 'active' ? 'Disable' : 'Enable'} color={u.status === 'active' ? '#f59e0b' : '#22c55e'} icon={u.status === 'active' ? 'pause' : 'play'} />
                            <ActionButton onClick={function () { handleResetTraffic(u.username); }} title="Reset traffic" color="#f97316" icon="reset" />
                            <ActionButton onClick={function () { handleEdit(u); }} title="Edit" color="#3b82f6" icon="edit" />
                            <ActionButton onClick={function () { handleDelete(u.username); }} title="Delete" color="#ef4444" icon="delete" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
        
        {/* Pagination Logic for both Views */}
        {users.length > 0 && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: isMobile ? 'none' : '1px solid var(--border-color)', background: isMobile ? 'transparent' : 'transparent' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={function () { setPage(page - 1); }} disabled={page === 0} className="btn btn-secondary" style={{ opacity: page === 0 ? 0.5 : 1 }}>Previous</button>
              <button onClick={function () { setPage(page + 1); }} disabled={page >= totalPages - 1} className="btn btn-secondary" style={{ opacity: page >= totalPages - 1 ? 0.5 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showConfirmModal && confirmAction && <ConfirmModal title={confirmAction.title} message={confirmAction.message} onConfirm={handleConfirm} onCancel={function () { setShowConfirmModal(false); setConfirmAction(null); }} />}
      
      {showLinksModal && selectedUser && <LinksModal userData={selectedUser} serverUrl={activeConfig ? activeConfig.endpointUrl : ''} onClose={function () { setShowLinksModal(false); setSelectedUser(null); }} />}
      {showCreateModal && <CreateUserModal coreConfig={coreConfig} onClose={function () { setShowCreateModal(false); }} onSuccess={function () { setShowCreateModal(false); loadAllUsers(); }} />}
      {showEditModal && selectedUser && <EditUserModal userData={selectedUser} onClose={function () { setShowEditModal(false); setSelectedUser(null); }} onSuccess={function () { setShowEditModal(false); setSelectedUser(null); loadAllUsers(); }} />}
    </div>
  );
}

function ActionButton({ onClick, title, color, icon }) {
  var getIcon = function() {
    switch(icon) {
      case 'copy': return (<path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />);
      case 'link': return (<path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />);
      case 'pause': return (<path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />);
      case 'play': return (<><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></>);
      case 'reset': return (<><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-5h-.581m-15.357-2A8.001 8.001 0 0019.419 15m0 0H15" /></>);
      case 'edit': return (<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />);
      case 'delete': return (<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />);
      case 'qr': return (<path strokeLinecap="round" strokeLinejoin="round" d="M3 4h4v4H3V4zm1 1v2h2V5H4zm14-1h4v4h-4V4zm1 1v2h2V5h-2zM3 16h4v4H3v-4zm1 1v2h2v-2H4zm14-1h4v4h-4v-4zm1 1v2h2v-2h-2zM9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-12h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />);
      default: return null;
    }
  };
  return (<button onClick={onClick} title={title} style={{ padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: color, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={function(e) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }} onMouseOut={function(e) { e.currentTarget.style.background = 'transparent'; }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>{getIcon()}</svg></button>);
}

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (<div className="modal-overlay" onClick={onCancel}><div className="modal-content" style={{ maxWidth: '400px' }} onClick={function (e) { e.stopPropagation(); }}><div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ width: '24px', height: '24px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><h3 style={{ margin: 0 }}>{title}</h3></div></div><div className="modal-body" style={{ paddingTop: '16px' }}><p style={{ color: 'var(--text-secondary)', margin: 0 }}>{message}</p></div><div className="modal-footer" style={{ borderTop: 'none', paddingTop: '8px' }}><button onClick={onCancel} className="btn btn-secondary">Cancel</button><button onClick={onConfirm} className="btn btn-danger">Confirm</button></div></div></div>);
}

// -------------------------------------------------------------------------
// LINKS + QR MODAL (Fixed Layout)
// -------------------------------------------------------------------------
function LinksModal({ userData, serverUrl, onClose }) {
  // Build subscription URL if available
  var getSubPath = function () { if (!userData.subscription_url) return ''; var match = userData.subscription_url.match(/\/sub\/[^\/\s]+/); return match ? match[0] : ''; };
  var getFullSubUrl = function () { var path = getSubPath(); if (!path) return ''; var base = serverUrl.replace(/\/+$/, ''); return base + path; };
  var subUrl = getFullSubUrl();

  // Flatten inbound tags by protocol
  var inboundTagsByProto = {};
  if (userData.inbounds) {
    Object.keys(userData.inbounds).forEach(function(proto) {
      inboundTagsByProto[proto.toLowerCase()] = userData.inbounds[proto] || [];
    });
  }

  // Assign inbound tag names
  var buildNamedLinks = function(links) {
    var counters = {};
    return (links || []).map(function(link) {
      var proto = (link.split('://')[0] || '').toLowerCase();
      counters[proto] = counters[proto] ? counters[proto] + 1 : 1;
      var idx = counters[proto] - 1;
      var nameFromInbound = inboundTagsByProto[proto]?.[idx];
      var displayName = nameFromInbound || fallbackLinkName(link);
      return { link, displayName, proto };
    });
  };

  // Fallback name
  var fallbackLinkName = function(link) {
    try {
      var fragment = link.split('#')[1];
      if (fragment) return decodeURIComponent(fragment);
      var proto = link.split('://')[0];
      return proto ? proto.toUpperCase() + ' Link' : 'Link';
    } catch { return 'Link'; }
  };

  var namedLinks = buildNamedLinks(userData.links || []);

  // Copy helper
  var handleCopy = function (text, label) {
    navigator.clipboard.writeText(text);
    toast.success(`${label || 'Content'} copied to clipboard!`);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '10px' }}>
      <div className="modal-content" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>Links: {userData.username}</h3>
          <button onClick={onClose} className="modal-close" style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
          
          {/* Subscription section */}
          {subUrl && (
            <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ color: '#22d3ee', margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600' }}>Subscription Link</h4>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div 
                  onClick={() => handleCopy(subUrl, 'Subscription URL')}
                  style={{ background: 'white', padding: '12px', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', maxWidth: '100%' }}
                  title="Click QR to copy"
                >
                  <QRCode value={subUrl} size={150} style={{ maxWidth: '100%', height: 'auto' }} />
                </div>
                <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                  <input type="text" value={subUrl} readOnly className="form-input" style={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.8125rem' }} />
                  <button onClick={() => handleCopy(subUrl, 'Subscription URL')} className="btn btn-primary" style={{ background: '#06b6d4', borderColor: '#0891b2', whiteSpace: 'nowrap' }}>Copy</button>
                </div>
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* Links with inbound names */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Node Links ({namedLinks.length})</h4>
            
            {namedLinks.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No links available.</p>
            )}

            {namedLinks.map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-gray">{(item.proto || '').toUpperCase()}</span>
                    <span style={{ wordBreak: 'break-all' }}>{item.displayName}</span>
                  </span>
                  
                  <div 
                    onClick={() => handleCopy(item.link, item.displayName)}
                    style={{ background: 'white', padding: '10px', borderRadius: '12px', cursor: 'pointer', maxWidth: '100%' }}
                    title="Click QR to copy"
                  >
                    <QRCode value={item.link} size={130} style={{ maxWidth: '100%', height: 'auto' }} />
                  </div>

                  <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                    <input type="text" value={item.link} readOnly className="form-input" style={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.75rem', textOverflow: 'ellipsis' }} />
                    <button onClick={() => handleCopy(item.link, item.displayName)} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>Copy</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function generateUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
function parseInbounds(cfg) { if (!cfg || !cfg.inbounds) return {}; var g = {}; cfg.inbounds.forEach(function (i) { if (i.protocol && i.tag) { if (!g[i.protocol]) g[i.protocol] = []; g[i.protocol].push(i.tag); } }); return g; }

function CreateUserModal({ coreConfig, onClose, onSuccess }) {
  const { activeConfig } = useMarzban(); const [loading, setLoading] = useState(false); const [availableInbounds, setAvailableInbounds] = useState({}); const [selectedInbounds, setSelectedInbounds] = useState({}); const [formData, setFormData] = useState({ username: '', status: 'active', data_limit: '', data_limit_unit: 'gb', data_limit_reset_strategy: 'no_reset', expire_days: '', note: '', on_hold_expire_duration: '' });
  useEffect(function () { if (coreConfig) { var parsed = parseInbounds(coreConfig); setAvailableInbounds(parsed); var def = {}; Object.keys(parsed).forEach(function (p) { def[p] = [...parsed[p]]; }); setSelectedInbounds(def); } }, [coreConfig]);
  var toggleInbound = function (p, t) { setSelectedInbounds(function (prev) { var c = prev[p] || []; return { ...prev, [p]: c.includes(t) ? c.filter(function (x) { return x !== t; }) : [...c, t] }; }); };
  var toggleAll = function (p) { setSelectedInbounds(function (prev) { var all = availableInbounds[p] || []; var c = prev[p] || []; return { ...prev, [p]: c.length === all.length ? [] : [...all] }; }); };
  var handleSubmit = async function (e) { e.preventDefault(); if (formData.username.length < 3 || formData.username.length > 32) { toast.error('Username must be 3-32 chars'); return; } if (!/^[a-z0-9_]+$/.test(formData.username)) { toast.error('Username: only a-z, 0-9, _'); return; } var hasInbound = Object.values(selectedInbounds).some(function (t) { return t.length > 0; }); if (!hasInbound) { toast.error('Select at least one inbound'); return; } if (formData.status === 'on_hold' && !formData.on_hold_expire_duration) { toast.error('On Hold requires duration'); return; } setLoading(true); try { var mult = { mb: 1024 * 1024, gb: 1024 * 1024 * 1024, tb: 1024 * 1024 * 1024 * 1024 }; var dataLimit = formData.data_limit ? parseFloat(formData.data_limit) * mult[formData.data_limit_unit] : 0; var expire = (formData.expire_days && formData.status !== 'on_hold') ? Math.floor(Date.now() / 1000) + parseInt(formData.expire_days) * 86400 : 0; var proxies = {}, inbounds = {}; Object.keys(selectedInbounds).forEach(function (p) { if (selectedInbounds[p].length > 0) { inbounds[p] = selectedInbounds[p]; if (p === 'vmess' || p === 'vless') proxies[p] = { id: generateUUID() }; else if (p === 'trojan') proxies[p] = { password: generateUUID() }; else proxies[p] = {}; } }); var userData = { username: formData.username, status: formData.status, data_limit: dataLimit, data_limit_reset_strategy: formData.data_limit_reset_strategy, expire: expire, note: formData.note || '', proxies: proxies, inbounds: inbounds }; if (formData.status === 'on_hold') { userData.on_hold_expire_duration = parseInt(formData.on_hold_expire_duration) * 86400; userData.expire = 0; } await usersApi.createUser(activeConfig.id, userData); toast.success('User created!'); onSuccess(); } catch (error) { var msg = error.response?.data?.detail || error.response?.data?.error || 'Failed'; toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg)); } finally { setLoading(false); } };
  var protocols = Object.keys(availableInbounds);
  
  return (<div className="modal-overlay" onClick={onClose}><div className="modal-content" style={{ maxWidth: '600px' }} onClick={function (e) { e.stopPropagation(); }}><div className="modal-header"><h3>Create New User</h3><button onClick={onClose} className="modal-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div><form onSubmit={handleSubmit}><div className="modal-body"><div className="form-group"><label className="form-label">Username *</label><input type="text" value={formData.username} onChange={function (e) { setFormData({ ...formData, username: e.target.value.toLowerCase() }); }} required className="form-input" placeholder="3-32 chars" /></div><div className="form-group"><label className="form-label">Status</label><select value={formData.status} onChange={function (e) { setFormData({ ...formData, status: e.target.value }); }} className="form-input"><option value="active">Active</option><option value="on_hold">On Hold</option><option value="disabled">Disabled</option></select></div>{formData.status === 'on_hold' && (<div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}><label className="form-label" style={{ color: 'var(--accent-blue)' }}>On Hold Duration (days) *</label><input type="number" value={formData.on_hold_expire_duration} onChange={function (e) { setFormData({ ...formData, on_hold_expire_duration: e.target.value }); }} className="form-input" placeholder="Days" min="1" required /><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Active for this many days after first connection</p></div>)}<div className="form-group"><label className="form-label">Data Limit</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" value={formData.data_limit} onChange={function (e) { setFormData({ ...formData, data_limit: e.target.value }); }} className="form-input" placeholder="0 = Unlimited" min="0" step="0.01" style={{ flex: 1 }} /><select value={formData.data_limit_unit} onChange={function (e) { setFormData({ ...formData, data_limit_unit: e.target.value }); }} className="form-input" style={{ width: 'auto' }}><option value="mb">MB</option><option value="gb">GB</option><option value="tb">TB</option></select></div></div><div className="form-group"><label className="form-label">Data Reset</label><select value={formData.data_limit_reset_strategy} onChange={function (e) { setFormData({ ...formData, data_limit_reset_strategy: e.target.value }); }} className="form-input"><option value="no_reset">No Reset</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select></div>{formData.status !== 'on_hold' && (<div className="form-group"><label className="form-label">Expire After (days)</label><input type="number" value={formData.expire_days} onChange={function (e) { setFormData({ ...formData, expire_days: e.target.value }); }} className="form-input" placeholder="0 = Never" min="0" /></div>)}<div className="form-group"><label className="form-label">Inbounds *</label><div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '16px' }}>{protocols.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Loading...</p> : protocols.map(function (p) { var tags = availableInbounds[p]; var sel = selectedInbounds[p] || []; var all = sel.length === tags.length && tags.length > 0; return (<div key={p} style={{ marginBottom: '16px' }}><div onClick={function () { toggleAll(p); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}><div style={{ width: '20px', height: '20px', borderRadius: '4px', border: '2px solid ' + (all ? 'var(--accent-blue)' : 'var(--border-color)'), background: all ? 'var(--accent-blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{all && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" style={{ width: '14px', height: '14px' }}><path d="M5 13l4 4L19 7" /></svg>}</div><span style={{ fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '0.8125rem' }}>{p}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({sel.length}/{tags.length})</span></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '28px' }}>{tags.map(function (t) { var isSel = sel.includes(t); return (<label key={t} onClick={function () { toggleInbound(p, t); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', background: isSel ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (isSel ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)') }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid ' + (isSel ? 'var(--accent-blue)' : 'var(--text-muted)'), background: isSel ? 'var(--accent-blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isSel && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" style={{ width: '12px', height: '12px' }}><path d="M5 13l4 4L19 7" /></svg>}</div><span style={{ fontSize: '0.8125rem', color: isSel ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t}</span></label>); })}</div></div>); })}</div></div><div className="form-group"><label className="form-label">Note</label><textarea value={formData.note} onChange={function (e) { setFormData({ ...formData, note: e.target.value }); }} className="form-input" placeholder="Optional..." rows={2} /></div></div><div className="modal-footer"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create User'}</button></div></form></div></div>);
}

function EditUserModal({ userData, onClose, onSuccess }) {
  const { activeConfig } = useMarzban(); const [loading, setLoading] = useState(false); const [resettingUUID, setResettingUUID] = useState(false); var targetUsername = userData.username;
  const [formData, setFormData] = useState({ status: userData.status === 'on_hold' ? 'active' : userData.status, data_limit: userData.data_limit ? (userData.data_limit / (1024 * 1024 * 1024)).toFixed(2) : '', data_limit_unit: 'gb', data_limit_reset_strategy: userData.data_limit_reset_strategy || 'no_reset', expire_days: '', note: userData.note || '' });
  var getUUIDs = function() { var uuids = []; if (userData.proxies) { if (userData.proxies.vmess && userData.proxies.vmess.id) uuids.push({ protocol: 'VMess', id: userData.proxies.vmess.id }); if (userData.proxies.vless && userData.proxies.vless.id) uuids.push({ protocol: 'VLess', id: userData.proxies.vless.id }); if (userData.proxies.trojan && userData.proxies.trojan.password) uuids.push({ protocol: 'Trojan', id: userData.proxies.trojan.password }); } return uuids; };
  var handleResetUUID = async function() { setResettingUUID(true); try { await usersApi.revokeSubscription(activeConfig.id, targetUsername); toast.success('UUID reset successfully!'); onSuccess(); } catch (error) { console.error('Reset UUID error:', error); toast.error('Failed to reset UUID'); } finally { setResettingUUID(false); } };
  var handleSubmit = async function(e) { e.preventDefault(); setLoading(true); try { var mult = { mb: 1024 * 1024, gb: 1024 * 1024 * 1024, tb: 1024 * 1024 * 1024 * 1024 }; var updateData = { status: formData.status, note: formData.note || '', data_limit_reset_strategy: formData.data_limit_reset_strategy, data_limit: formData.data_limit ? parseFloat(formData.data_limit) * mult[formData.data_limit_unit] : 0 }; if (formData.expire_days) { updateData.expire = Math.floor(Date.now() / 1000) + parseInt(formData.expire_days) * 86400; } await usersApi.updateUser(activeConfig.id, targetUsername, updateData); toast.success('User updated!'); onSuccess(); } catch (error) { console.error('Update error:', error); var msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to update'; toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg)); } finally { setLoading(false); } };
  var uuids = getUUIDs();
  
  return (<div className="modal-overlay" onClick={onClose}><div className="modal-content" style={{ maxWidth: '550px' }} onClick={function(e) { e.stopPropagation(); }}><div className="modal-header"><h3>Edit:  {targetUsername}</h3><button onClick={onClose} className="modal-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div><form onSubmit={handleSubmit}><div className="modal-body">{uuids.length > 0 && (<div className="form-group" style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><label className="form-label" style={{ color: 'var(--accent-purple)', margin: 0 }}>Current IDs</label><button type="button" onClick={handleResetUUID} disabled={resettingUUID} className="btn btn-warning" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>{resettingUUID ? 'Resetting...' : 'Reset UUID'}</button></div>{uuids.map(function(item, idx) { return (<div key={idx} style={{ marginBottom: idx < uuids.length - 1 ? '8px' : 0 }}><p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>{item.protocol}</p><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><code style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>{item.id}</code><button type="button" onClick={function() { navigator.clipboard.writeText(item.id); toast.success('Copied!'); }} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button></div></div>); })}</div>)}<div className="form-group"><label className="form-label">Status</label><select value={formData.status} onChange={function(e) { setFormData({ ...formData, status: e.target.value }); }} className="form-input"><option value="active">Active</option><option value="disabled">Disabled</option></select></div><div className="form-group"><label className="form-label">Data Limit</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" value={formData.data_limit} onChange={function(e) { setFormData({ ...formData, data_limit: e.target.value }); }} className="form-input" placeholder="0 = Unlimited" min="0" step="0.01" style={{ flex: 1 }} /><select value={formData.data_limit_unit} onChange={function(e) { setFormData({ ...formData, data_limit_unit: e.target.value }); }} className="form-input" style={{ width: 'auto' }}><option value="mb">MB</option><option value="gb">GB</option><option value="tb">TB</option></select></div></div><div className="form-group"><label className="form-label">Data Reset</label><select value={formData.data_limit_reset_strategy} onChange={function(e) { setFormData({ ...formData, data_limit_reset_strategy: e.target.value }); }} className="form-input"><option value="no_reset">No Reset</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select></div><div className="form-group"><label className="form-label">Extend Expiration (days from now)</label><input type="number" value={formData.expire_days} onChange={function(e) { setFormData({ ...formData, expire_days: e.target.value }); }} className="form-input" placeholder="Leave empty to keep current" min="0" /></div><div className="form-group"><label className="form-label">Note</label><textarea value={formData.note} onChange={function(e) { setFormData({ ...formData, note: e.target.value }); }} className="form-input" placeholder="Optional..." rows={2} /></div></div><div className="modal-footer"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button></div></form></div></div>);
}

export default Users;