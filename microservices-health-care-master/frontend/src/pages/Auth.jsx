import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import api from '../api/client';

export default function Auth({ setIsAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const res = await api.post('/users/authenticate', { email: formData.email, password: formData.password });
        if (res.data && res.data.token) {
          localStorage.setItem('token', res.data.token);
          if (res.data.user) {
            localStorage.setItem('user', JSON.stringify(res.data.user));
          } else {
             // fake user if backend doesn't return one immediately
            localStorage.setItem('user', JSON.stringify({ id: 'user-id-mock', firstName: 'John' }));
          }
          setIsAuthenticated(true);
        }
      } else {
        await api.post('/users', { ...formData, role: 'PATIENT' });
        setIsLogin(true); // Switch to login after register
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="glass-card"
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <Activity size={48} color="var(--primary)" style={{ marginBottom: '10px' }} />
          <h2 className="brand-title">{isLogin ? 'Welcome Back' : 'Join MedFlow'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            {isLogin ? 'Secure access to your health portal' : 'Create an account to book your first appointment'}
          </p>
        </div>

        {error && <div style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.875rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">First Name</label>
                <input required className="input-field" name="firstName" onChange={handleChange} />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Last Name</label>
                <input required className="input-field" name="lastName" onChange={handleChange} />
              </div>
            </div>
          )}
          
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input required type="email" className="input-field" name="email" onChange={handleChange} />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input required type="password" className="input-field" name="password" onChange={handleChange} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '10px' }}>
            {loading ? <div className="loader"></div> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </motion.div>
    </div>
  );
}
