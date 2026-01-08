import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMarzban } from '../context/MarzbanContext';
import { useTheme } from '../context/ThemeContext';

function Layout() {
  var { user, logout } = useAuth();
  var { configs, activeConfig, selectConfig } = useMarzban();
  var { theme, toggleTheme } = useTheme();
  var navigate = useNavigate();

  var handleLogout = function () {
    logout();
    navigate('/login');
  };

  var handleConfigChange = function (e) {
    var configId = e.target.value;
    var config = null;
    for (var i = 0; i < configs.length; i++) {
      if (configs[i].id === configId) {
        config = configs[i];
        break;
      }
    }
    if (config) {
      selectConfig(config);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          {/* Logo Section */}
          <div className="logo">
            <div className="logo-icon">
              <img
                src="/logo.png"
                alt="App Logo"
                style={{
                  width: '64px',
                  height: '64px',
                  objectFit: 'contain'
                }}
              />
            </div>
            <div className="logo-text">
              <h1>MARZ-X</h1>
              <p>Dashboard</p>
            </div>
          </div>

          {/* Right Header Section */}
          <div className="header-right">

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="icon-btn"
              style={{ marginRight: '8px', color: 'var(--text-muted)' }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '22px', height: '22px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '22px', height: '22px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Server Selector */}
            {configs.length > 0 && (
              <div className="server-selector">
                <div className="status-dot"></div>
                <select value={activeConfig ? activeConfig.id : ''} onChange={handleConfigChange}>
                  {configs.map(function (config) {
                    return (
                      <option key={config.id} value={config.id}>
                        {config.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* User Menu */}
            <div className="user-menu">
              <div className="user-avatar">
                {user && user.username ? user.username.charAt(0).toUpperCase() : user && user.email ? user.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="user-info">
                <p className="name">{user ? user.username || user.name || 'Administrator' : 'Administrator'}</p>
                <p className="email">{user ? user.name || '' : ''}</p>
              </div>
              <button onClick={handleLogout} className="logout-btn" title="Logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)' }}>
        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/users" className={function (props) { return 'nav-link' + (props.isActive ? ' active' : ''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Users</span>
          </NavLink>

          <NavLink to="/core-config" className={function (props) { return 'nav-link' + (props.isActive ? ' active' : ''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Core</span>
          </NavLink>

          <NavLink to="/hosts" className={function (props) { return 'nav-link' + (props.isActive ? ' active' : ''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Hosts</span>
          </NavLink>

          <NavLink to="/settings" className={function (props) { return 'nav-link' + (props.isActive ? ' active' : ''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Page Content */}
        <div style={{ flex: 1 }}>
          <Outlet />
        </div>

        {/* Footer */}
        <footer style={{ 
          marginTop: '40px', 
          padding: '24px 0', 
          textAlign: 'center', 
          color: 'var(--text-muted)', 
          fontSize: '0.8125rem',
          borderTop: '1px solid var(--border-color)' 
        }}>
          Made by <a 
            href="https://github.com/wmm-x" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: 'var(--text-primary)', 
              fontWeight: '600', 
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-color)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          >
            @wmm-x
          </a>
        </footer>
      </main>
    </div>
  );
}

export default Layout;