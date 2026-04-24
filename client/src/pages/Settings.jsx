import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const navigate = useNavigate();
  const { updateGlobalSettings } = useSettings();
  const [settings, setSettings] = useState({ currency: '$', theme: 'dark', categoryTags: [] });
  
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  
  const [newTag, setNewTag] = useState({ name: '', type: 'Needs' });
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        const res = await axios.get('https://cashcue-api.onrender.com/api/settings', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setSettings(res.data);
      } catch (error) {
        if (error.response?.status === 401) handleLogout();
        showFeedback("Failed to load settings.", "error");
      }
    };
    fetchSettings();
  }, []);

  const showFeedback = (msg, type) => {
    setFeedback({ message: msg, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 4000);
  };

  const handlePreferenceChange = async (key, value) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch('https://cashcue-api.onrender.com/api/settings/preferences', { [key]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(prev => ({ ...prev, [key]: value }));
      updateGlobalSettings({ [key]: value }); 
      showFeedback(`${key.charAt(0).toUpperCase() + key.slice(1)} updated successfully.`, "success");
    } catch (error) {
      showFeedback("Failed to update preference.", "error");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return showFeedback("New passwords do not match.", "error");
    try {
      const token = localStorage.getItem('token');
      await axios.post('https://cashcue-api.onrender.com/api/settings/password', {
        currentPassword: passwords.current, newPassword: passwords.new
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPwd({ current: false, new: false, confirm: false }); 
      showFeedback("Password changed successfully.", "success");
    } catch (error) {
      showFeedback(error.response?.data?.error || "Failed to change password.", "error");
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTag.name) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('https://cashcue-api.onrender.com/api/settings/tags', newTag, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedTags = [...settings.categoryTags, res.data];
      setSettings(prev => ({ ...prev, categoryTags: updatedTags }));
      updateGlobalSettings({ categoryTags: updatedTags }); 
      setNewTag({ name: '', type: 'Needs' });
      showFeedback("Custom tag added successfully.", "success");
    } catch (error) {
      showFeedback(error.response?.data?.error || "Failed to add tag.", "error");
    }
  };

  const handleDeleteTag = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://cashcue-api.onrender.com/api/settings/tags/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedTags = settings.categoryTags.filter(t => t.id !== id);
      setSettings(prev => ({ ...prev, categoryTags: updatedTags }));
      updateGlobalSettings({ categoryTags: updatedTags }); 
      showFeedback("Tag deleted successfully.", "success");
    } catch (error) {
      showFeedback("Failed to delete tag.", "error");
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('https://cashcue-api.onrender.com/api/settings/export', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob' 
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'CashCue_Ledger.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showFeedback("Ledger exported successfully.", "success");
    } catch (error) {
      showFeedback("Failed to export ledger.", "error");
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("WARNING: This will permanently delete all your transactions, goals, and assets. Your account and preferences will remain. Proceed?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete('https://cashcue-api.onrender.com/api/settings/purge', {
        headers: { Authorization: `Bearer ${token}` }
      });
      showFeedback("Ledger successfully wiped.", "success");
    } catch (error) {
      showFeedback("Failed to wipe ledger.", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete your account and ALL associated data. This cannot be undone. Are you sure?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete('https://cashcue-api.onrender.com/api/settings/account', {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleLogout();
    } catch (error) {
      showFeedback("Failed to delete account.", "error");
    }
  };

  const togglePwdVisibility = (field) => {
    setShowPwd(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const flatCardStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative' };
  const sleekInputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px 20px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '15px', transition: 'border-color 0.2s', appearance: 'none', WebkitAppearance: 'none' };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#cashcue-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs><linearGradient id="cashcue-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--neon-blue)" /><stop offset="100%" stopColor="var(--neon-purple)" /></linearGradient></defs>
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><rect x="16" y="14" width="4" height="4" rx="1" fill="var(--neon-blue)" stroke="none" />
          </svg>
          <span style={{ fontSize: '22px', fontWeight: '700' }}>CashCue</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <div className="nav-item" onClick={() => navigate('/dashboard')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</div>
          <div className="nav-item" onClick={() => navigate('/budgets')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Budgets</div>
          <div className="nav-item" onClick={() => navigate('/autopilot')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg> Autopilot</div>
          <div className="nav-item" onClick={() => navigate('/portfolio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>
          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>
          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>
          <div className="nav-item active" style={{ marginTop: 'auto' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
        </nav>
        <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)', marginTop: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '60px' }}>
          
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '32px', letterSpacing: '-0.5px' }}>Command Center</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Manage preferences, security, and global data structures.</p>
          </div>

          {feedback.message && (
            <div style={{ background: feedback.type === 'success' ? 'rgba(50, 215, 75, 0.1)' : 'rgba(255, 55, 95, 0.1)', color: feedback.type === 'success' ? 'var(--neon-green)' : 'var(--neon-pink)', border: `1px solid ${feedback.type === 'success' ? 'var(--neon-green)' : 'var(--neon-pink)'}`, padding: '16px 24px', borderRadius: '14px', marginBottom: '32px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {feedback.type === 'success' ? (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ) : (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              )}
              {feedback.message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>

            {/* SECTION 1: PREFERENCES */}
            <div style={flatCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(10, 132, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, fontWeight: '700' }}>Localization & Aesthetics</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Global Currency Symbol</label>
                  <div style={{ position: 'relative' }}>
                    <select value={settings.currency} onChange={(e) => handlePreferenceChange('currency', e.target.value)} style={{...sleekInputStyle, cursor: 'pointer'}}>
                      <option value="$">USD ($)</option>
                      <option value="€">EUR (€)</option>
                      <option value="£">GBP (£)</option>
                      <option value="₹">INR (₹)</option>
                      <option value="¥">JPY (¥)</option>
                    </select>
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Aesthetic Engine</label>
                  <div style={{ position: 'relative' }}>
                    <select value={settings.theme} onChange={(e) => handlePreferenceChange('theme', e.target.value)} style={{...sleekInputStyle, cursor: 'pointer'}}>
                      <option value="dark">Dark Mode</option>
                      <option value="oled">Eclipse Mode</option>
                    </select>
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 2: CUSTOM TAXONOMY (TAGS) */}
            <div style={flatCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(191, 90, 242, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-purple)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 4px 0', fontWeight: '700' }}>Taxonomy Engine</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Create custom tags routed to the Intelligence Engine.</p>
                </div>
              </div>

              <form onSubmit={handleAddTag} style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '6px', marginBottom: '24px', alignItems: 'center', transition: 'border-color 0.2s' }}>
                
                <input 
                  type="text" 
                  placeholder="e.g., Sneakers" 
                  value={newTag.name} 
                  onChange={e => setNewTag({...newTag, name: e.target.value})} 
                  style={{ border: 'none', background: 'transparent', outline: 'none', flex: 2, padding: '10px 16px', color: 'var(--text-primary)', fontSize: '15px' }} 
                  required 
                />
                
                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
                
                <div style={{ flex: 1, position: 'relative' }}>
                  <select 
                    value={newTag.type} 
                    onChange={e => setNewTag({...newTag, type: e.target.value})} 
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', padding: '10px 16px', color: 'var(--text-secondary)', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', fontSize: '14px', fontWeight: '500' }}
                  >
                    <option value="Needs">Route → Needs</option>
                    <option value="Wants">Route → Wants</option>
                    <option value="Savings">Route → Savings</option>
                    <option value="Income">Route → Income</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '12px 24px', borderRadius: '12px', marginLeft: '6px', whiteSpace: 'nowrap' }}>Create Tag</button>
              </form>

              {settings.categoryTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                  {settings.categoryTags.map(tag => (
                    <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', padding: '8px 14px 8px 16px', borderRadius: '100px', fontSize: '14px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{tag.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginRight: '4px' }}>({tag.type})</span>
                      <button onClick={() => handleDeleteTag(tag.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,55,95,0.1)', border: 'none', color: 'var(--neon-pink)', cursor: 'pointer', width: '22px', height: '22px', borderRadius: '50%', transition: 'all 0.2s' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 3: SECURITY */}
            <div style={flatCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(50, 215, 75, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, fontWeight: '700' }}>Security Protocol</h3>
              </div>
              
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                  <input 
                    type={showPwd.current ? "text" : "password"} 
                    placeholder="Current Password" 
                    value={passwords.current} 
                    onChange={e => setPasswords({...passwords, current: e.target.value})} 
                    style={{...sleekInputStyle, paddingLeft: '44px', paddingRight: '44px'}} 
                    required 
                  />
                  <button type="button" onClick={() => togglePwdVisibility('current')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showPwd.current ? 'var(--neon-blue)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    {showPwd.current ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    )}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neon-blue)', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                  <input 
                    type={showPwd.new ? "text" : "password"} 
                    placeholder="New Password" 
                    value={passwords.new} 
                    onChange={e => setPasswords({...passwords, new: e.target.value})} 
                    style={{...sleekInputStyle, paddingLeft: '44px', paddingRight: '44px'}} 
                    required 
                  />
                  <button type="button" onClick={() => togglePwdVisibility('new')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showPwd.new ? 'var(--neon-blue)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    {showPwd.new ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    )}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <input 
                    type={showPwd.confirm ? "text" : "password"} 
                    placeholder="Confirm New Password" 
                    value={passwords.confirm} 
                    onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
                    style={{...sleekInputStyle, paddingLeft: '44px', paddingRight: '44px'}} 
                    required 
                  />
                  <button type="button" onClick={() => togglePwdVisibility('confirm')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showPwd.confirm ? 'var(--neon-blue)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    {showPwd.confirm ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    )}
                  </button>
                </div>

                <button type="submit" className="btn-secondary" style={{ alignSelf: 'flex-start', background: 'var(--text-primary)', color: 'var(--bg-main)', marginTop: '8px', padding: '12px 24px', fontWeight: '700' }}>Update Password</button>
              </form>
            </div>

            {/* SECTION 4: DATA & DANGER ZONE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              
              <div style={flatCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 159, 10, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-orange)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </div>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, fontWeight: '700' }}>Data Export</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6 }}>Download a complete, unencrypted CSV payload of your entire financial ledger history for external backup.</p>
                <button onClick={handleExport} className="btn-secondary" style={{ marginTop: 'auto', alignSelf: 'flex-start', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  Download CSV
                </button>
              </div>

              <div style={{...flatCardStyle, border: '1px solid rgba(255, 55, 95, 0.25)', background: 'rgba(255, 55, 95, 0.02)'}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 55, 95, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-pink)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  </div>
                  <h3 style={{ fontSize: '14px', color: 'var(--neon-pink)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, fontWeight: '700' }}>Danger Zone</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6 }}>These actions are permanent. Purging wipes your ledger but keeps your account. Deletion removes everything.</p>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                  <button onClick={handlePurge} className="btn-action" style={{ background: 'rgba(255, 55, 95, 0.1)', color: 'var(--neon-pink)', fontSize: '13px', padding: '10px 16px', border: '1px solid rgba(255, 55, 95, 0.2)' }}>Purge Ledger</button>
                  <button onClick={handleDeleteAccount} className="btn-action" style={{ background: 'var(--neon-pink)', color: '#fff', fontSize: '13px', padding: '10px 16px', border: 'none' }}>Delete Account</button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>
    </div>
  );
}