import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    checkAuth();
  }, []);

  

  var checkAuth = async function() {
    var token = localStorage.getItem('token');
    var savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        // First set user from localStorage immediately
        setUser(JSON.parse(savedUser));
        
        // Then verify token in background (don't logout on failure)
        try {
          var res = await authApi.me();
          if (res.data && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON. stringify(res.data.user));
          }
        } catch (verifyError) {
          // Only logout if it's a 401 unauthorized error
          if (verifyError.response && verifyError.response.status === 401) {
            console.log('Token expired, logging out');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            // Network error or server error - keep user logged in
            console.log('Token verify failed (network issue), keeping session:', verifyError. message);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Keep user logged in if there's a parsing error
      }
    }
    setLoading(false);
  };

  var login = async function(username, password) {
    try {
      var res = await authApi.login({ username:  username, email: username, password: password });
      var userData = res.data. user;
      var token = res.data.token;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { user: userData, token: token };
    } catch (error) {
      throw error;
    }
  };

  var logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  var updateUser = function(updatedUser) {
    setUser(updatedUser);
    localStorage.setItem('user', JSON. stringify(updatedUser));
  };

  var value = {
    user: user,
    loading: loading,
    login: login,
    logout: logout,
    updateUser: updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  var context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;