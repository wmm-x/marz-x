import { useState, useEffect } from 'react';
import StreamSettings from '../common/StreamSettings';

// Helper: Convert Object to Array [{key, value}]
const objToArray = (obj) => {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => ({ key: k, value: v }));
};

// Helper: Convert Array [{key, value}] to Object
const arrayToObj = (arr) => {
  const obj = {};
  if (!arr) return obj;
  arr.forEach(item => {
    if (item.key && item.key.trim() !== '') {
      obj[item.key.trim()] = item.value;
    }
  });
  return obj;
};

// Helper to initialize state from Raw JSON AND Defaults
const getInitialState = (inbound, defaultCert) => {
  const tls = inbound?.streamSettings?.tlsSettings;
  const cert0 = tls?.certificates?.[0] || {};
  const reality = inbound?.streamSettings?.realitySettings || {};
  const ws = inbound?.streamSettings?.wsSettings || {};
  
  // TCP
  const tcp = inbound?.streamSettings?.tcpSettings || {};
  const req = tcp?.header?.request || {};
  const res = tcp?.header?.response || {};

  // KCP & GRPC
  const kcp = inbound?.streamSettings?.kcpSettings || {};
  const grpc = inbound?.streamSettings?.grpcSettings || {};

  // HTTP Upgrade & SplitHTTP & XHTTP
  const httpup = inbound?.streamSettings?.httpupgradeSettings || {};
  const split = inbound?.streamSettings?.splithttpSettings || {};
  const xmux = split.xmux || {};
  const xhttp = inbound?.streamSettings?.xhttpSettings || {};
  
  // HTTP/2
  const http = inbound?.streamSettings?.httpSettings || {};

  return {
    tag: inbound?.tag || '',
    port: inbound?.port || 8080,
    listen: inbound?.listen || '0.0.0.0',
    protocol: 'vless',
    
    // Stream Defaults
    network: inbound?.streamSettings?.network || 'tcp',
    security: inbound?.streamSettings?.security || 'none',

    // TCP Settings
    tcpAcceptProxyProtocol: tcp.acceptProxyProtocol || false,
    tcpHeaderType: tcp.header?.type || 'none',
    tcpReqVersion: req.version || '1.1',
    tcpReqMethod: req.method || 'GET',
    tcpReqPath: req.path?.join(',') || '/',
    tcpReqHeaders: objToArray(req.headers), 
    tcpResVersion: res.version || '1.1',
    tcpResStatus: res.status || '200',
    tcpResReason: res.reason || 'OK',
    tcpResHeaders: objToArray(res.headers), 

    // KCP Settings
    kcpMtu: kcp.mtu || 1350,
    kcpTti: kcp.tti || 50,
    kcpUplink: kcp.uplinkCapacity || 5,
    kcpDownlink: kcp.downlinkCapacity || 20,
    kcpCongestion: kcp.congestion || false,
    kcpReadBuffer: kcp.readBufferSize || 2,
    kcpWriteBuffer: kcp.writeBufferSize || 2,
    kcpHeaderType: kcp.header?.type || 'none',
    kcpSeed: kcp.seed || '',
    kcpDomain: kcp.header?.domain || '',

    // GRPC Settings
    grpcServiceName: grpc.serviceName || '',
    grpcMultiMode: grpc.multiMode || false,

    // HTTP/2 Settings
    httpPath: http.path || '/',
    httpHost: http.host || [],

    // HTTP Upgrade Settings
    httpUpgradePath: httpup.path || '/',
    httpUpgradeHost: httpup.host || '',
    httpUpgradeAcceptProxyProtocol: httpup.acceptProxyProtocol || false,
    httpUpgradeHeaders: objToArray(httpup.headers),

    // SplitHTTP Settings
    splitHttpPath: split.path || '/',
    splitHttpHost: split.host || '',
    splitHttpHeaders: objToArray(split.headers),
    splitHttpMode: split.mode || 'auto',
    splitHttpScMaxConcurrentPosts: split.scMaxConcurrentPosts || '100-200',
    splitHttpScMaxEachPostBytes: split.scMaxEachPostBytes || '1000000-2000000',
    splitHttpScMinPostsIntervalMs: split.scMinPostsIntervalMs || '10-50',
    splitHttpXPaddingBytes: split.xPaddingBytes || '100-1000',
    splitHttpNoSSEHeader: split.noSSEHeader || false,
    splitHttpNoGRPCHeader: split.noGRPCHeader || false,
    // XMUX
    splitHttpXmuxMaxConcurrency: xmux.maxConcurrency || '16-32',
    splitHttpXmuxMaxConnections: xmux.maxConnections || 0,
    splitHttpXmuxCMaxReuseTimes: xmux.cMaxReuseTimes || '64-128',
    splitHttpXmuxCMaxLifetimeMs: xmux.cMaxLifetimeMs || 0,

    // XHTTP Settings
    xhttpPath: xhttp.path || '/path',
    xhttpHost: xhttp.host || 'hostname',
    xhttpHeaders: objToArray(xhttp.headers),
    xhttpNoSSEHeader: xhttp.noSSEHeader || false,
    xhttpXPaddingBytes: xhttp.xPaddingBytes || '100-1000',
    xhttpMode: xhttp.mode || 'auto',

    // TLS Settings
    tlsServerName: tls?.serverName || '',
    tlsMinVersion: tls?.minVersion || '1.0',
    tlsMaxVersion: tls?.maxVersion || '1.3',
    tlsCipherSuites: tls?.cipherSuites || 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:RSA-AES128-GCM-SHA256:RSA-AES256-GCM-SHA384:RSA-AES128-SHA:RSA-AES256-SHA',
    tlsRejectUnknownSni: tls?.rejectUnknownSni || false,
    tlsDisableSystemRoot: tls?.disableSystemRoot || false,
    tlsSessionResumption: tls?.enableSessionResumption || false,
    tlsAlpn: tls?.alpn?.join(',') || 'h2,http/1.1',
    tlsCertFile: cert0.certificateFile || defaultCert?.certificateFile || '/var/lib/marzban/certs/fullchain.pem',
    tlsKeyFile: cert0.keyFile || defaultCert?.keyFile || '/var/lib/marzban/certs/privkey.pem',
    tlsOcsp: cert0.ocspStapling || 3600,
    tlsUsage: cert0.usage || 'encipherment',

    // WS Settings
    wsAcceptProxyProtocol: ws.acceptProxyProtocol || false,
    wsPath: ws.path || '/',
    wsHost: ws.headers?.Host || '',
    wsHeaders: objToArray(ws.headers), 
    
    // Reality Settings (Now storing as Arrays)
    realityDest: reality.dest || '',
    realityServerNames: reality.serverNames || [], // Array
    realityPrivateKey: reality.privateKey || '',
    realityPublicKey: reality.publicKey || '',
    realityShortIds: reality.shortIds || [], // Array
    realitySpiderX: reality.spiderX || '/',
    realityFingerprint: reality.fingerprint || 'chrome',
    realityXver: reality.xver || 0,
  };
};

export default function VlessInbound({ initialData, defaultCert, onClose, onSave, saving }) {
  const [formData, setFormData] = useState(getInitialState(initialData, defaultCert));
  const [tab, setTab] = useState('general');

  // Auto-tag generator
  useEffect(() => {
    if (!initialData) {
      const net = formData.network.toUpperCase();
      const sec = formData.security !== 'none' ? `+${formData.security.toUpperCase()}` : '';
      const tag = `VLESS+${net}${sec}+${formData.port}`;
      setFormData(prev => ({ ...prev, tag }));
    }
  }, [formData.network, formData.security, formData.port]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const streamSettings = {
      network: formData.network,
      security: formData.security,
    };

    // 1. TCP Settings
    if (formData.network === 'tcp') {
      const tcpSettings = {
        acceptProxyProtocol: formData.tcpAcceptProxyProtocol,
        header: { type: formData.tcpHeaderType }
      };
      if (formData.tcpHeaderType === 'http') {
        tcpSettings.header.request = {
          version: formData.tcpReqVersion,
          method: formData.tcpReqMethod,
          path: formData.tcpReqPath.split(',').map(s => s.trim()).filter(s => s),
          headers: arrayToObj(formData.tcpReqHeaders)
        };
        tcpSettings.header.response = {
          version: formData.tcpResVersion,
          status: formData.tcpResStatus,
          reason: formData.tcpResReason,
          headers: arrayToObj(formData.tcpResHeaders)
        };
      }
      streamSettings.tcpSettings = tcpSettings;
    }

    // 2. KCP Settings
    if (formData.network === 'kcp') {
      streamSettings.kcpSettings = {
        mtu: parseInt(formData.kcpMtu),
        tti: parseInt(formData.kcpTti),
        uplinkCapacity: parseInt(formData.kcpUplink),
        downlinkCapacity: parseInt(formData.kcpDownlink),
        congestion: formData.kcpCongestion,
        readBufferSize: parseInt(formData.kcpReadBuffer),
        writeBufferSize: parseInt(formData.kcpWriteBuffer),
        header: { 
          type: formData.kcpHeaderType,
          domain: formData.kcpDomain || undefined
        },
        seed: formData.kcpSeed || undefined
      };
    }

    // 3. WebSocket Settings
    if (formData.network === 'ws') {
      const wsHeaders = arrayToObj(formData.wsHeaders);
      if (formData.wsHost) wsHeaders.Host = formData.wsHost; 

      streamSettings.wsSettings = {
        acceptProxyProtocol: formData.wsAcceptProxyProtocol,
        path: formData.wsPath,
        headers: wsHeaders
      };
    }
    
    // 4. GRPC Settings
    if (formData.network === 'grpc') {
      streamSettings.grpcSettings = {
        serviceName: formData.grpcServiceName,
        multiMode: formData.grpcMultiMode
      };
    }

    // 5. HTTP Upgrade
    if (formData.network === 'httpupgrade') {
      streamSettings.httpupgradeSettings = {
        acceptProxyProtocol: formData.httpUpgradeAcceptProxyProtocol,
        path: formData.httpUpgradePath,
        host: formData.httpUpgradeHost,
        headers: arrayToObj(formData.httpUpgradeHeaders)
      };
    }

    // 6. SplitHTTP
    if (formData.network === 'splithttp') {
      streamSettings.splithttpSettings = {
        path: formData.splitHttpPath,
        host: formData.splitHttpHost,
        headers: arrayToObj(formData.splitHttpHeaders),
        scMaxConcurrentPosts: formData.splitHttpScMaxConcurrentPosts,
        scMaxEachPostBytes: formData.splitHttpScMaxEachPostBytes,
        scMinPostsIntervalMs: formData.splitHttpScMinPostsIntervalMs,
        xPaddingBytes: formData.splitHttpXPaddingBytes,
        noSSEHeader: formData.splitHttpNoSSEHeader,
        noGRPCHeader: formData.splitHttpNoGRPCHeader,
        mode: formData.splitHttpMode,
        xmux: {
          maxConcurrency: formData.splitHttpXmuxMaxConcurrency,
          maxConnections: parseInt(formData.splitHttpXmuxMaxConnections),
          cMaxReuseTimes: formData.splitHttpXmuxCMaxReuseTimes,
          cMaxLifetimeMs: parseInt(formData.splitHttpXmuxCMaxLifetimeMs)
        }
      };
    }

    // 7. XHTTP
    if (formData.network === 'xhttp') {
      streamSettings.xhttpSettings = {
        path: formData.xhttpPath,
        host: formData.xhttpHost,
        headers: arrayToObj(formData.xhttpHeaders),
        noSSEHeader: formData.xhttpNoSSEHeader,
        xPaddingBytes: formData.xhttpXPaddingBytes,
        mode: formData.xhttpMode
      };
    }

    // 8. HTTP/2
    if (formData.network === 'http') {
      streamSettings.httpSettings = {
        path: formData.httpPath,
        host: formData.httpHost
      };
    }

    // 9. TLS Settings
    if (formData.security === 'tls') {
      streamSettings.tlsSettings = {
        serverName: formData.tlsServerName,
        minVersion: formData.tlsMinVersion,
        maxVersion: formData.tlsMaxVersion,
        cipherSuites: formData.tlsCipherSuites,
        rejectUnknownSni: formData.tlsRejectUnknownSni,
        disableSystemRoot: formData.tlsDisableSystemRoot,
        enableSessionResumption: formData.tlsSessionResumption,
        alpn: formData.tlsAlpn.split(',').map(s => s.trim()).filter(s => s),
        certificates: [{
          certificateFile: formData.tlsCertFile, 
          keyFile: formData.tlsKeyFile,           
          ocspStapling: parseInt(formData.tlsOcsp),
          usage: formData.tlsUsage,
          buildChain: false
        }]
      };
    }

    // 10. REALITY Settings
    if (formData.security === 'reality') {
      streamSettings.realitySettings = {
        show: true,
        dest: formData.realityDest,
        xver: parseInt(formData.realityXver),
        serverNames: formData.realityServerNames.filter(s => s && s.trim() !== ''),
        privateKey: formData.realityPrivateKey,
        publicKey: formData.realityPublicKey,
        shortIds: formData.realityShortIds.filter(s => s && s.trim() !== ''),
        spiderX: formData.realitySpiderX,
        fingerprint: formData.realityFingerprint
      };
    }

    const inbound = {
      tag: formData.tag,
      listen: formData.listen,
      port: parseInt(formData.port),
      protocol: "vless",
      settings: { clients: [], decryption: "none" },
      streamSettings: streamSettings,
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      }
    };

    onSave(inbound);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div className="nav-tabs" style={{ borderRadius: '0', borderBottom: '1px solid var(--border-color)', margin: 0, padding: '8px 16px 0' }}>
        {['general', 'transport', 'security', 'socket'].map(t => (
          <button 
            key={t} 
            type="button" 
            onClick={() => setTab(t)} 
            className={`nav-link ${tab === t ? 'active' : ''}`}
            style={{ 
              textTransform: 'capitalize', 
              borderRadius: '8px 8px 0 0', 
              borderBottom: tab === t ? 'none' : '1px solid transparent',
              padding: '10px 16px',
              cursor: 'pointer'
            }}
          >
            {t}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {tab === 'general' && (
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
          </div>
        )}
        
        <StreamSettings tab={tab} formData={formData} setFormData={setFormData} />
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>Save VLESS</button>
      </div>
    </form>
  );
}