import { useState, useEffect } from 'react';
import { useMarzban } from '../context/MarzbanContext';
import { marzbanApi } from '../services/api';
import toast from 'react-hot-toast';

function Nodes() {
  const { activeConfig } = useMarzban();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    if (activeConfig) {
      loadNodes();
    }
  }, [activeConfig]);

  var loadNodes = async function() {
    try {
      setLoading(true);
      var res = await marzbanApi.getNodes(activeConfig.id);
      setNodes(res.data);
    } catch (error) {
      toast.error('Failed to load nodes');
    } finally {
      setLoading(false);
    }
  };

  var getStatusColor = function(status) {
    var colors = {
      connected: '#10b981',
      connecting: '#f59e0b',
      error: '#ef4444',
      disabled: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  var getStatusBadge = function(status) {
    var classes = {
      connected: 'badge badge-success',
      connecting: 'badge badge-warning',
      error: 'badge badge-danger',
      disabled: 'badge badge-gray',
    };
    return classes[status] || 'badge badge-gray';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading nodes...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:  '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight:  '700', color: '#111827', margin: 0 }}>Nodes</h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Total: {nodes.length} nodes</p>
        </div>
        <button onClick={loadNodes} className="btn btn-secondary">
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004. 582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Nodes Grid */}
      {nodes.length === 0 ? (
        <div className="empty-state">
          <div className="icon-box">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <h2>No Nodes Found</h2>
          <p>There are no nodes configured in your Marzban server.</p>
        </div>
      ) : (
        <div className="grid-3">
          {nodes. map(function(node) {
            return (
              <div key={node.id} className="card node-card">
                <div className="card-body">
                  {/* Node Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:  'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems:  'center', gap: '12px' }}>
                      <div style={{
                        width:  '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: getStatusColor(node.status),
                        animation: node.status === 'connecting' ? 'pulse 2s infinite' : 'none'
                      }}></div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight:  '600', color: '#111827' }}>{node.name}</h3>
                    </div>
                    <span className={getStatusBadge(node.status)}>{node.status}</span>
                  </div>

                  {/* Node Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Address</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#111827' }}>{node.address}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent:  'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize:  '0.875rem' }}>Port</span>
                      <span style={{ fontFamily: 'monospace', fontSize:  '0.875rem', color: '#111827' }}>{node.port}</span>
                    </div>
                    <div style={{ display:  'flex', justifyContent: 'space-between' }}>
                      <span style={{ color:  '#6b7280', fontSize: '0.875rem' }}>API Port</span>
                      <span style={{ fontFamily: 'monospace', fontSize:  '0.875rem', color: '#111827' }}>{node.api_port}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent:  'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize:  '0.875rem' }}>Usage Coefficient</span>
                      <span style={{ fontSize: '0.875rem', color: '#111827' }}>{node.usage_coefficient}x</span>
                    </div>
                    {node.xray_version && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Xray Version</span>
                        <span style={{ fontSize: '0.875rem', color: '#111827' }}>{node.xray_version}</span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {node.message && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#dc2626',
                      fontSize: '0.875rem'
                    }}>
                      {node.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Nodes;