import { useState } from 'react';
import VlessInbound from './protocols/VlessInbound';
import VmessInbound from './protocols/VmessInbound';
import TrojanInbound from './protocols/TrojanInbound';
import ShadowsocksInbound from './protocols/ShadowsocksInbound';
import DokodemoInbound from './protocols/DokodemoInbound';
import HttpInbound from './protocols/HttpInbound';
import SocksInbound from './protocols/SocksInbound';
// Removed WireguardInbound import

const InboundModal = ({ inbound, defaultCert, onClose, onSave, saving }) => {
  const [protocol, setProtocol] = useState(inbound?.protocol || 'vless');

  const commonProps = {
    initialData: inbound,
    defaultCert: defaultCert,
    onClose,
    onSave,
    saving
  };

  const renderProtocolForm = () => {
    switch (protocol) {
      case 'vless': return <VlessInbound {...commonProps} />;
      case 'vmess': return <VmessInbound {...commonProps} />;
      case 'trojan': return <TrojanInbound {...commonProps} />;
      case 'shadowsocks': return <ShadowsocksInbound {...commonProps} />;
      case 'dokodemo-door': return <DokodemoInbound {...commonProps} />;
      case 'http': return <HttpInbound {...commonProps} />;
      case 'socks': return <SocksInbound {...commonProps} />;
      // Removed WireGuard case
      default: return <VlessInbound {...commonProps} />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '900px', 
          width: '95%', 
          height: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: 0, 
          overflow: 'hidden' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Protocol Switcher Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ margin: 0 }}>{inbound ? 'Edit' : 'Add'} Inbound</h3>
            {!inbound && (
              <select 
                value={protocol} 
                onChange={(e) => setProtocol(e.target.value)}
                className="form-input"
                style={{ 
                  width: 'auto', 
                  padding: '6px 32px 6px 12px', 
                  fontSize: '0.9rem',
                  height: 'auto',
                  backgroundPosition: 'right 8px center'
                }}
              >
                <option value="vless">VLESS</option>
                <option value="vmess">VMess</option>
                <option value="trojan">Trojan</option>
                <option value="shadowsocks">Shadowsocks</option>
                <option value="dokodemo-door">Dokodemo-door</option>
                <option value="http">HTTP</option>
                <option value="socks">SOCKS</option>
                {/* Removed WireGuard option */}
              </select>
            )}
          </div>
          <button onClick={onClose} className="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Specific Protocol Component Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderProtocolForm()}
        </div>
        
      </div>
    </div>
  );
};

export default InboundModal;