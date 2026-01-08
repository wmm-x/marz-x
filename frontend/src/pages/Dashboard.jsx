import { useState, useEffect, useRef } from 'react';
import { useMarzban } from '../context/MarzbanContext';
import { marzbanApi } from '../services/api';
import toast from 'react-hot-toast';

function Dashboard() {
  const { activeConfig } = useMarzban();
  const [stats, setStats] = useState(null);
  const [monthlyUsage, setMonthlyUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [restarting, setRestarting] = useState(false);
  const intervalRef = useRef(null);

  useEffect(function() {
    if (activeConfig) {
      loadStats();
      loadMonthlyUsage();
      startAutoRefresh();
    }
    return function() {
      stopAutoRefresh();
    };
  }, [activeConfig]);

  var startAutoRefresh = function() {
    stopAutoRefresh();
    intervalRef.current = setInterval(function() {
      loadStatsQuiet();
    }, 3000);
  };

  var stopAutoRefresh = function() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  var loadStats = async function() {
    try {
      setLoading(true);
      var res = await marzbanApi.getSystemStats(activeConfig. id);
      setStats(res. data);
      setLastUpdate(new Date());
    } catch (error) {
      toast.error('Failed to load system stats');
    } finally {
      setLoading(false);
    }
  };

  var loadStatsQuiet = async function() {
    try {
      var res = await marzbanApi. getSystemStats(activeConfig.id);
      setStats(res. data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh stats');
    }
  };

  var loadMonthlyUsage = async function() {
  try {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    
    // Start date:  first day of current month
    var startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    
    // End date: last day of current month
    var lastDay = new Date(year, month, 0).getDate();
    var endDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    
    console.log('Loading monthly usage:', startDate, 'to', endDate);
    
    var res = await marzbanApi.getNodesUsage(activeConfig.id, startDate, endDate);
    console.log('Monthly usage response:', res. data);
    setMonthlyUsage(res. data);
  } catch (error) {
    console.error('Failed to load monthly usage:', error);
  }
};
  var handleRestartXray = async function() {
    if (! confirm('Are you sure you want to restart Xray Core?')) return;
    
    setRestarting(true);
    try {
      await marzbanApi. restartXray(activeConfig. id);
      toast.success('Xray Core restarted successfully! ');
    } catch (error) {
      toast.error('Failed to restart Xray Core');
    } finally {
      setRestarting(false);
    }
  };

  var formatBytes = function(bytes) {
    if (! bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  var formatSpeed = function(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
    var k = 1024;
    var sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    var i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math. pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  var formatTime = function(date) {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  var formatMemory = function(bytes) {
    if (!bytes) return '0 GB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  var getMonthName = function() {
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
    return months[new Date().getMonth()];
  };

  var calculateTotalMonthlyUsage = function() {
  if (!monthlyUsage || ! monthlyUsage.usages || monthlyUsage.usages. length === 0) {
    return { download: 0, upload: 0, total: 0 };
  }
  
  var totalDownload = 0;
  var totalUpload = 0;
  
  monthlyUsage.usages.forEach(function(usage) {
    // API returns uplink and downlink
    totalUpload += usage.uplink || 0;
    totalDownload += usage.downlink || 0;
  });
  
  return {
    download: totalDownload,
    upload: totalUpload,
    total: totalDownload + totalUpload
  };
};

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading Dashboard... </p>
      </div>
    );
  }

  if (! stats) {
    return (
      <div className="empty-state">
        <div className="icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2>Failed to Load Stats</h2>
        <p>Unable to connect to the server. </p>
        <button onClick={loadStats} className="btn btn-primary">Try Again</button>
      </div>
    );
  }

  var cpuPercent = Math.round(stats.cpu_usage || 0);
  var memoryPercent = Math.round((stats.mem_used / stats.mem_total) * 100);
  var monthlyData = calculateTotalMonthlyUsage();

  return (
    <div className="animate-fade-in">
      {/* Server Info Card */}
      <div className="server-info-card">
        <div className="server-info-header">
          <div className="server-info-title">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <div>
              <h2>{activeConfig ?  activeConfig.name : 'Server'}</h2>
              <p>{activeConfig ? activeConfig.endpointUrl : ''}</p>
            </div>
          </div>
          <div className="server-actions">
            <div className="live-indicator">
              <div className="dot"></div>
              <span className="text">Live</span>
              <span className="time">{formatTime(lastUpdate)}</span>
            </div>
            <button onClick={handleRestartXray} className="btn btn-warning" disabled={restarting}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{restarting ? 'Restarting...' : 'Restart Xray'}</span>
            </button>
            <button onClick={loadStats} className="btn btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Server Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* CPU Speedometer */}
          <div className="metric-panel" style={{ display: 'flex', alignItems:  'center', gap: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding:  '24px', border: '1px solid var(--border-color)' }}>
            <Speedometer value={cpuPercent} label="CPU" color={cpuPercent > 80 ? '#ef4444' : cpuPercent > 60 ?  '#f59e0b' :  '#22c55e'} />
            <div className="metric-panel-text">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Processor</p>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: '700' }}>{stats.cpu_cores} Cores</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '8px' }}>Usage:  {cpuPercent}%</p>
            </div>
          </div>

          {/* Memory Speedometer */}
          <div className="metric-panel" style={{ display: 'flex', alignItems: 'center', gap: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding:  '24px', border: '1px solid var(--border-color)' }}>
            <Speedometer value={memoryPercent} label="RAM" color={memoryPercent > 80 ? '#ef4444' : memoryPercent > 60 ? '#f59e0b' : '#3b82f6'} />
            <div className="metric-panel-text">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memory</p>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: '700' }}>{formatMemory(stats.mem_total)}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '8px' }}>Used: {formatMemory(stats.mem_used)}</p>
            </div>
          </div>

          {/* Network Speed */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding:  '24px', border: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>Real-time Network</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap:  '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', borderRadius: '10px', display: 'flex', alignItems:  'center', justifyContent:  'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: '20px', height: '20px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>Download</p>
                  <p style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: '700' }}>{formatSpeed(stats. incoming_bandwidth_speed)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: '20px', height: '20px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--accent-blue)', fontSize: '0.8125rem' }}>Upload</p>
                  <p style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: '700' }}>{formatSpeed(stats.outgoing_bandwidth_speed)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Server Info Metrics - 4 Cards */}
        <div className="metric-grid" style={{ marginTop: '20px' }}>
          {/* Marzban Version */}
          <div className="metric-card">
            <div className="icon" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div className="value">{stats.version}</div>
            <div className="label">Marzban Version</div>
          </div>

          {/* Monthly Usage - Replaced Xray Version */}
          <div className="metric-card" style={{ borderColor: 'rgba(139, 92, 246, 0.3)' }}>
            <div className="icon" style={{ background:  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="value" style={{ color: 'var(--accent-purple)', fontSize: '1.25rem' }}>{formatBytes(monthlyData.total)}</div>
            <div className="label">Monthly Usage</div>
          </div>

          {/* CPU Cores */}
          <div className="metric-card">
            <div className="icon" style={{ background:  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="value">{stats.cpu_cores}</div>
            <div className="label">CPU Cores</div>
          </div>

          {/* Total RAM */}
          <div className="metric-card">
            <div className="icon" style={{ background:  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="value">{formatMemory(stats.mem_total)}</div>
            <div className="label">Total RAM</div>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="users-section">
        <div className="section-header">
          <h3>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            User Statistics
          </h3>
        </div>

        <div className="user-stats-grid">
          <div className="user-stat-card total">
            <div className="value">{stats.total_user}</div>
            <div className="label">Total Users</div>
          </div>
          <div className="user-stat-card online">
            <div className="value">{stats.online_users}</div>
            <div className="label">Online Now</div>
          </div>
          <div className="user-stat-card active">
            <div className="value">{stats.users_active}</div>
            <div className="label">Active</div>
          </div>
          <div className="user-stat-card expired">
            <div className="value">{stats.users_expired}</div>
            <div className="label">Expired</div>
          </div>
          <div className="user-stat-card limited">
            <div className="value">{stats.users_limited}</div>
            <div className="label">Limited</div>
          </div>
          <div className="user-stat-card disabled">
            <div className="value">{stats.users_disabled + stats.users_on_hold}</div>
            <div className="label">Disabled/Hold</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Speedometer Component
// Speedometer Component - Fixed Centering
function Speedometer({ value, label, color }) {
  var size = 120; // Base size, CSS will override
  var strokeWidth = 10;
  var radius = (size - strokeWidth) / 2;
  var circumference = 2 * Math. PI * radius;
  var offset = circumference - (value / 100) * circumference;
  var center = size / 2;

  return (
    <div className="speedometer">
      <svg 
        className="speedometer-circle" 
        viewBox={"0 0 " + size + " " + size}
      >
        <circle
          className="speedometer-bg"
          cx={center}
          cy={center}
          r={radius}
        />
        <circle
          className="speedometer-progress"
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="speedometer-center">
        <div className="speedometer-value" style={{ color:  color }}>{value}%</div>
        <div className="speedometer-label">{label}</div>
      </div>
    </div>
  );
}

export default Dashboard;