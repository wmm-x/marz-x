import { useState, useEffect } from 'react';
import { useMarzban } from '../context/MarzbanContext';
import { marzbanApi } from '../services/api';
import toast from 'react-hot-toast';

// Imports for our new modular components
import InboundModal from './InboundModal';
import OutboundModal from './OutboundModal'; 
import RuleModal from './RuleModal';         

import { 
  InboundsTab, 
  OutboundsTab, 
  RoutingTab, 
  RawJsonModal 
} from './CoreConfigSubComponents';

function CoreConfig() {
  const { activeConfig } = useMarzban();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coreConfig, setCoreConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('inbounds');
  
  // --- MOBILE DETECTION ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // --- STATE: Inbounds ---
  const [showAddInbound, setShowAddInbound] = useState(false);
  const [editingInbound, setEditingInbound] = useState(null);

  // --- STATE: Outbounds ---
  const [showAddOutbound, setShowAddOutbound] = useState(false);
  const [editingOutbound, setEditingOutbound] = useState(null);

  // --- STATE: Routing ---
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // --- STATE: Raw JSON ---
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    if (activeConfig) loadCoreConfig();
  }, [activeConfig]);

  const loadCoreConfig = async () => {
    try {
      setLoading(true);
      const res = await marzbanApi.getCoreConfig(activeConfig.id);
      setCoreConfig(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load core config');
    } finally {
      setLoading(false);
    }
  };

  const saveCoreConfig = async (newConfig) => {
    try {
      setSaving(true);
      await marzbanApi.updateCoreConfig(activeConfig.id, newConfig);
      setCoreConfig(newConfig);
      toast.success('Configuration saved');
      return true;
    } catch (error) {
      toast.error('Failed to save configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // --- HELPER: Find Default Certificate ---
  const findDefaultCert = () => {
    if (!coreConfig?.inbounds) return null;
    for (const inbound of coreConfig.inbounds) {
      const certs = inbound?.streamSettings?.tlsSettings?.certificates;
      if (certs && certs.length > 0) {
        return {
          certificateFile: certs[0].certificateFile,
          keyFile: certs[0].keyFile
        };
      }
    }
    return null;
  };

  // --- HANDLERS: Inbounds ---
  const handleSaveInbound = (inbound) => {
    const newConfig = { ...coreConfig };
    if (!newConfig.inbounds) newConfig.inbounds = [];
    if (editingInbound !== null) {
      newConfig.inbounds[editingInbound] = inbound;
    } else {
      newConfig.inbounds.push(inbound);
    }
    saveCoreConfig(newConfig).then(success => {
      if (success) { setShowAddInbound(false); setEditingInbound(null); }
    });
  };

  const handleDeleteInbound = (index) => {
    if (!confirm('Delete this inbound?')) return;
    const newConfig = { ...coreConfig };
    newConfig.inbounds.splice(index, 1);
    saveCoreConfig(newConfig);
  };

  // --- HANDLERS: Outbounds ---
  const handleSaveOutbound = (outbound) => {
    const newConfig = { ...coreConfig };
    if (!newConfig.outbounds) newConfig.outbounds = [];
    if (editingOutbound !== null) {
      newConfig.outbounds[editingOutbound] = outbound;
    } else {
      newConfig.outbounds.push(outbound);
    }
    saveCoreConfig(newConfig).then(success => {
      if (success) { setShowAddOutbound(false); setEditingOutbound(null); }
    });
  };

  const handleDeleteOutbound = (index) => {
    if (!confirm('Delete this outbound?')) return;
    const newConfig = { ...coreConfig };
    newConfig.outbounds.splice(index, 1);
    saveCoreConfig(newConfig);
  };

  // --- HANDLERS: Routing Rules ---
  const handleSaveRule = (rule) => {
    const newConfig = { ...coreConfig };
    if (!newConfig.routing) newConfig.routing = {};
    if (!newConfig.routing.rules) newConfig.routing.rules = [];
    
    if (editingRule !== null) {
      newConfig.routing.rules[editingRule] = rule;
    } else {
      newConfig.routing.rules.push(rule);
    }
    saveCoreConfig(newConfig).then(success => {
      if (success) { setShowAddRule(false); setEditingRule(null); }
    });
  };

  const handleDeleteRule = (index) => {
    if (!confirm('Delete this rule?')) return;
    const newConfig = { ...coreConfig };
    newConfig.routing.rules.splice(index, 1);
    saveCoreConfig(newConfig);
  };

  // --- HANDLERS: General ---
  const handleLogLevelChange = (level) => {
    const newConfig = { ...coreConfig, log: { ...coreConfig.log, loglevel: level } };
    saveCoreConfig(newConfig);
  };

  if (!activeConfig || loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in" style={{ padding: isMobile ? '16px' : '24px' }}>
      {/* Header Section - MOBILE RESPONSIVE */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '24px',
        gap: isMobile ? '16px' : '0'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Core Configuration</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage low-level Xray configuration for {activeConfig.name}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <select 
            value={coreConfig?.log?.loglevel || 'warning'} 
            onChange={(e) => handleLogLevelChange(e.target.value)}
            className="form-input"
            style={{ width: isMobile ? '50%' : 'auto', minWidth: '140px', paddingRight: '35px', cursor: 'pointer' }}
          >
            <option value="debug">Log: Debug</option>
            <option value="info">Log: Info</option>
            <option value="warning">Log: Warning</option>
            <option value="error">Log: Error</option>
            <option value="none">Log: None</option>
          </select>
          
          <button 
            onClick={() => setShowRawJson(true)}
            className="btn btn-secondary"
            style={{ height: '42px', padding: '0 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', flex: isMobile ? 1 : 'none', justifyContent: 'center' }}
          >
            <svg style={{ width: '18px', height: '18px', marginRight: '6px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Edit JSON
          </button>
        </div>
      </div>
      
      {/* Tabs Navigation */}
      <div className="nav-tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {['inbounds', 'outbounds', 'routing'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`nav-link ${activeTab === tab ? 'active' : ''}`}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- RENDER TAB CONTENT (Pass isMobile prop) --- */}
      
      <div style={{ marginTop: '20px' }}>
        {/* Inbounds Tab */}
        {activeTab === 'inbounds' && (
          <InboundsTab 
            inbounds={coreConfig?.inbounds || []}
            onAdd={() => setShowAddInbound(true)}
            onEdit={(idx) => setEditingInbound(idx)}
            onDelete={handleDeleteInbound}
            isMobile={isMobile}
          />
        )}

        {/* Outbounds Tab */}
        {activeTab === 'outbounds' && (
          <OutboundsTab 
            outbounds={coreConfig?.outbounds || []}
            onAdd={() => setShowAddOutbound(true)}
            onEdit={(idx) => setEditingOutbound(idx)}
            onDelete={handleDeleteOutbound}
            isMobile={isMobile}
          />
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <RoutingTab 
            rules={coreConfig?.routing?.rules || []}
            outbounds={coreConfig?.outbounds || []}
            onAdd={() => setShowAddRule(true)}
            onEdit={(idx) => setEditingRule(idx)}
            onDelete={handleDeleteRule}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* --- MODALS --- */}

      {(showAddInbound || editingInbound !== null) && (
        <InboundModal
          inbound={editingInbound !== null ? coreConfig.inbounds[editingInbound] : null}
          defaultCert={findDefaultCert()}
          onClose={() => { setShowAddInbound(false); setEditingInbound(null); }}
          onSave={handleSaveInbound}
          saving={saving}
          isMobile={isMobile}
        />
      )}

      {(showAddOutbound || editingOutbound !== null) && (
        <OutboundModal
          outbound={editingOutbound !== null ? coreConfig.outbounds[editingOutbound] : null}
          onClose={() => { setShowAddOutbound(false); setEditingOutbound(null); }}
          onSave={handleSaveOutbound}
          saving={saving}
          isMobile={isMobile}
        />
      )}

      {(showAddRule || editingRule !== null) && (
        <RuleModal
          rule={editingRule !== null ? coreConfig.routing.rules[editingRule] : null}
          outbounds={coreConfig?.outbounds || []}
          inbounds={coreConfig?.inbounds || []}
          onClose={() => { setShowAddRule(false); setEditingRule(null); }}
          onSave={handleSaveRule}
          saving={saving}
          isMobile={isMobile}
        />
      )}

      {showRawJson && (
        <RawJsonModal
          config={coreConfig}
          onClose={() => setShowRawJson(false)}
          onSave={(newJson) => {
            saveCoreConfig(newJson).then(success => {
              if(success) setShowRawJson(false);
            });
          }}
          saving={saving}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

export default CoreConfig;