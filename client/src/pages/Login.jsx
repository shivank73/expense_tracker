import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [isLoginView, setIsLoginView] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // If they are already logged in, boot them to the dashboard immediately
  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  // --- Real-time Password Validation ---
  const pwdRules = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password)
  };
  const isPwdValid = Object.values(pwdRules).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginView) {
        // --- LOGIN API CALL ---
        const res = await axios.post('http://localhost:3000/api/auth/login', {
          email: formData.email,
          password: formData.password
        });
        localStorage.setItem('token', res.data.token);
        
        // Use window.location.href to force a full React remount. 
        // This guarantees the SettingsContext fetches the fresh user data.
        window.location.href = '/dashboard';

      } else {
        // --- SIGN UP API CALL ---
        if (!isPwdValid) {
          setError('Please meet all password requirements.');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        const res = await axios.post('http://localhost:3000/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
        localStorage.setItem('token', res.data.token);
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchView = (toLogin) => {
    setIsLoginView(toLogin);
    setError('');
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
  };

  const sleekInputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px 20px 16px 48px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '15px', transition: 'all 0.2s', appearance: 'none', WebkitAppearance: 'none' };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-main)' }}>
      
      {/* THE NEBULA BACKGROUND EFFECTS */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(10, 132, 255, 0.15) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(191, 90, 242, 0.15) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 1, pointerEvents: 'none' }} />

      <div className="card" style={{ zIndex: 10, width: '100%', maxWidth: '440px', padding: '40px', background: 'rgba(28, 28, 30, 0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)' }}>
        
        {/* BRANDING HEADER */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#cashcue-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
            <defs><linearGradient id="cashcue-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--neon-blue)" /><stop offset="100%" stopColor="var(--neon-purple)" /></linearGradient></defs>
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><rect x="16" y="14" width="4" height="4" rx="1" fill="var(--neon-blue)" stroke="none" />
          </svg>
          <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', margin: '0 0 8px 0' }}>CashCue</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>Architect your financial reality.</p>
        </div>

        {/* VIEW TOGGLE PILL */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '16px', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => switchView(true)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: isLoginView ? 'var(--bg-elevated)' : 'transparent', color: isLoginView ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: 'none' }}>
            Sign In
          </button>
          <button onClick={() => switchView(false)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: !isLoginView ? 'var(--bg-elevated)' : 'transparent', color: !isLoginView ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: 'none' }}>
            Create Account
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 55, 95, 0.1)', border: '1px solid rgba(255, 55, 95, 0.3)', color: 'var(--neon-pink)', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', marginBottom: '24px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* NAME FIELD (SIGN UP ONLY) */}
          {!isLoginView && (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={sleekInputStyle} required={!isLoginView} />
            </div>
          )}

          {/* EMAIL FIELD */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <input type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={sleekInputStyle} required />
          </div>

          {/* PASSWORD FIELD */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <input type={showPwd ? "text" : "password"} placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={{...sleekInputStyle, paddingRight: '44px'}} required />
            <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showPwd ? 'var(--neon-blue)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              {showPwd ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              )}
            </button>
          </div>

          {/* PASSWORD STRENGTH CHECKLIST (SIGN UP ONLY) */}
          {!isLoginView && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: pwdRules.length ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                {pwdRules.length ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-secondary)'}}/>} 
                8+ Characters
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: pwdRules.upper ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                {pwdRules.upper ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-secondary)'}}/>} 
                Uppercase Letter
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: pwdRules.number ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                {pwdRules.number ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-secondary)'}}/>} 
                Number
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: pwdRules.special ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                {pwdRules.special ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : <div style={{width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-secondary)'}}/>} 
                Special Symbol
              </div>
            </div>
          )}

          {/* CONFIRM PASSWORD (SIGN UP ONLY) */}
          {!isLoginView && (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <input type={showConfirmPwd ? "text" : "password"} placeholder="Confirm Password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} style={{...sleekInputStyle, paddingRight: '44px'}} required={!isLoginView} />
              <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showConfirmPwd ? 'var(--neon-blue)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                {showConfirmPwd ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                )}
              </button>
            </div>
          )}

          <button type="submit" disabled={loading || (!isLoginView && !isPwdValid)} style={{ background: (loading || (!isLoginView && !isPwdValid)) ? 'var(--border-color)' : 'var(--neon-blue)', color: (loading || (!isLoginView && !isPwdValid)) ? 'var(--text-secondary)' : '#fff', padding: '16px', borderRadius: '14px', border: 'none', fontSize: '15px', fontWeight: '700', cursor: (loading || (!isLoginView && !isPwdValid)) ? 'not-allowed' : 'pointer', marginTop: '16px', transition: 'all 0.3s', boxShadow: 'none' }}>
            {loading ? 'Processing Protocol...' : (isLoginView ? 'Access Command Center' : 'Initialize Account')}
          </button>

        </form>
      </div>
    </div>
  );
}