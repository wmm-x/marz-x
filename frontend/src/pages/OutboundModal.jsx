import { useState } from 'react';
import FreedomOutbound from './protocols/FreedomOutbound';
import BlackholeOutbound from './protocols/BlackholeOutbound';
import WireguardOutbound from './protocols/WireguardOutbound';
// You can add SocksOutbound, VmessOutbound etc. here later

const OutboundModal = ({ outbound, onClose, onSave, saving }) => {
  const [protocol, setProtocol] = useState(outbound?.protocol || 'freedom');

  const commonProps = {
    initialData: outbound,
    onClose,
    onSave,
    saving
  };

  const renderProtocolForm = () => {
    switch (protocol) {
      case 'freedom': return <FreedomOutbound {...commonProps} />;
      case 'blackhole': return <BlackholeOutbound {...commonProps} />;
      case 'wireguard': return <WireguardOutbound {...commonProps} />;
      
      // Fallback for others not yet implemented (generic handler or default to freedom)
      default: return <FreedomOutbound {...commonProps} />;
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
            <h3 style={{ margin: 0 }}>{outbound ? 'Edit' : 'Add'} Outbound</h3>
            {!outbound && (
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
                <option value="freedom">Freedom (Direct)</option>
                <option value="wireguard">WireGuard</option>
                <option value="blackhole">Blackhole (Block)</option>
                {/* Add other protocols here as you implement their forms */}
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

export default OutboundModal;