import { createContext, useContext, useState, useEffect } from 'react';
import { marzbanApi } from '../services/api';
import { useAuth } from './AuthContext';

var MarzbanContext = createContext(null);

export function MarzbanProvider({ children }) {
  var { isAuthenticated } = useAuth();
  var [configs, setConfigs] = useState([]);
  var [activeConfig, setActiveConfig] = useState(null);
  var [loading, setLoading] = useState(false);

  useEffect(function() {
    if (isAuthenticated) {
      loadConfigs();
    } else {
      setConfigs([]);
      setActiveConfig(null);
    }
  }, [isAuthenticated]);

  var loadConfigs = async function() {
    try {
      setLoading(true);
      var res = await marzbanApi. getConfigs();
      var loadedConfigs = (res.data && res.data.configs) ? res.data.configs : [];
      setConfigs(loadedConfigs);

      if (loadedConfigs.length > 0 && !activeConfig) {
        setActiveConfig(loadedConfigs[0]);
      }

      if (activeConfig) {
        var found = null;
        for (var i = 0; i < loadedConfigs.length; i++) {
          if (loadedConfigs[i].id === activeConfig.id) {
            found = loadedConfigs[i];
            break;
          }
        }
        if (found) {
          setActiveConfig(found);
        } else {
          setActiveConfig(loadedConfigs[0] || null);
        }
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  var addConfig = async function(data) {
    try {
      var res = await marzbanApi. connect(data);
      await loadConfigs();
      if (res.data && res.data.config) {
        setActiveConfig(res.data.config);
      }
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  var updateConfig = async function(id, data) {
    try {
      var res = await marzbanApi.updateConfig(id, data);
      await loadConfigs();
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  var removeConfig = async function(id) {
    try {
      await marzbanApi.deleteConfig(id);
      if (activeConfig && activeConfig.id === id) {
        setActiveConfig(null);
      }
      await loadConfigs();
    } catch (error) {
      throw error;
    }
  };

  var selectConfig = function(config) {
    setActiveConfig(config);
  };

  var refreshConfigs = async function() {
    await loadConfigs();
  };

  var value = {
    configs: configs,
    activeConfig: activeConfig,
    loading: loading,
    loadConfigs: loadConfigs,
    addConfig: addConfig,
    updateConfig: updateConfig,
    removeConfig: removeConfig,
    selectConfig: selectConfig,
    refreshConfigs: refreshConfigs,
    hasConfigs: configs.length > 0
  };

  return (
    <MarzbanContext.Provider value={value}>
      {children}
    </MarzbanContext.Provider>
  );
}

export function useMarzban() {
  var context = useContext(MarzbanContext);
  if (!context) {
    throw new Error('useMarzban must be used within a MarzbanProvider');
  }
  return context;
}

export default MarzbanContext;