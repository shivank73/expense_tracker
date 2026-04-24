import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useSettings } from '../context/SettingsContext';

const PREDEFINED_ASSET_TAGS = ['Checking', 'Savings', 'Real Estate', 'Precious Metals', 'Vault', 'Collectibles', 'Other Asset'];

export default function PortfolioAssets() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('assets'); 
  const [data, setData] = useState({ assets: [], passiveIncomes: [] });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'BANK', currentValue: '', targetValue: '', category: '' });
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // Freelance State
  const [freelanceData, setFreelanceData] = useState({ date: new Date().toISOString().split('T')[0], amount: '', source: 'Freelance Work' });

  // UI States
  const [processingId, setProcessingId] = useState(null);
  const [updateId, setUpdateId] = useState(null);
  const [sellId, setSellId] = useState(null);
  const [actionValue, setActionValue] = useState('');
  
  const [efInjectAmount, setEfInjectAmount] = useState('');

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        const res = await axios.get('http://localhost:3000/api/portfolio', { headers: { Authorization: `Bearer ${token}` } });
        setData(res.data);
      } catch (error) {
        if (error.response?.status === 401) handleLogout();
      }
    };
    fetchPortfolio();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let payload = { ...formData, currentValue: parseFloat(formData.currentValue) };
      
      if (payload.type === 'EMERGENCY' && payload.targetValue) {
        payload.targetValue = parseFloat(payload.targetValue);
      } else {
        payload.targetValue = null; 
      }
      if (!payload.category) payload.category = 'General';

      const res = await axios.post('http://localhost:3000/api/portfolio/asset', payload, { headers: { Authorization: `Bearer ${token}` } });
      setData(prev => ({ ...prev, assets: [res.data, ...prev.assets] }));
      setIsFormOpen(false);
      setFormData({ name: '', type: 'BANK', currentValue: '', targetValue: '', category: '' });
    } catch (error) { alert("Failed to save asset."); }
  };

  const handleFreelanceSubmit = async (e) => {
    e.preventDefault();
    if (!freelanceData.amount || isNaN(freelanceData.amount)) return;
    setProcessingId('freelance-submit');
    try {
      const token = localStorage.getItem('token');
      const payload = { amount: parseFloat(freelanceData.amount), date: freelanceData.date, source: freelanceData.source };
      const res = await axios.post('http://localhost:3000/api/portfolio/passive', payload, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setData(prev => ({ ...prev, passiveIncomes: [...prev.passiveIncomes, res.data] }));
        setFreelanceData({ ...freelanceData, amount: '' });
        setProcessingId(null);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Failed to log work."); }
  };

  const handleUpdate = async (id, overrideValue = null) => {
    const finalVal = overrideValue || actionValue;
    if (!finalVal || isNaN(finalVal)) return alert("Invalid amount");
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`http://localhost:3000/api/portfolio/asset/${id}`, { currentValue: parseFloat(finalVal) }, { headers: { Authorization: `Bearer ${token}` } });
      setTimeout(() => {
        setData(prev => ({ ...prev, assets: prev.assets.map(a => a.id === id ? res.data : a) }));
        setUpdateId(null); setActionValue(''); setEfInjectAmount('');
        setProcessingId(null);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Update failed."); }
  };

  const handleEmergencyInject = () => {
    const amt = parseFloat(efInjectAmount);
    if (!amt || isNaN(amt)) return;
    const targetEf = emergency[0]; 
    if (targetEf) handleUpdate(targetEf.id, targetEf.currentValue + amt);
  };

  const handleSell = async (id) => {
    if (!actionValue || isNaN(actionValue)) return alert("Invalid final amount");
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:3000/api/portfolio/sell/${id}`, { finalValue: parseFloat(actionValue) }, { headers: { Authorization: `Bearer ${token}` } });
      setTimeout(() => {
        setData(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
        setSellId(null); setActionValue(''); setProcessingId(null);
        alert(`Asset Realized. Bridge Delta Pushed.\nProfit/Loss: ${settings?.currency || '$'}${res.data.profitDelta.toFixed(2)}`);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Sell transfer failed."); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete locally?")) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/portfolio/asset/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setTimeout(() => {
        setData(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
        setProcessingId(null);
      }, 300);
    } catch (error) { setProcessingId(null); }
  };

  // --- MATH & SEGMENTATION ---
  const banks = data.assets.filter(a => a.type === 'BANK');
  const checkings = banks.filter(b => b.category.toLowerCase().includes('check') || b.category === 'General');
  const savings = banks.filter(b => b.category.toLowerCase().includes('sav') || b.category.toLowerCase().includes('vault'));
  
  const cash = data.assets.filter(a => a.type === 'CASH');
  const emergency = data.assets.filter(a => a.type === 'EMERGENCY');
  
  const tangibles = data.assets.filter(a => a.type === 'TANGIBLE');
  const rentals = data.assets.filter(a => a.type === 'RENTAL');
  const variableHoldings = [...tangibles, ...rentals]; 

  const checkTotal = checkings.reduce((s, a) => s + a.currentValue, 0);
  const savTotal = savings.reduce((s, a) => s + a.currentValue, 0);
  const cashTotal = cash.reduce((s, a) => s + a.currentValue, 0);
  const efTotal = emergency.reduce((s, a) => s + a.currentValue, 0);
  const efTarget = emergency.reduce((s, a) => s + (a.targetValue || 0), 0);
  
  const tangibleTotal = tangibles.reduce((s, a) => s + a.currentValue, 0);
  const rentalTotal = rentals.reduce((s, a) => s + a.currentValue, 0);
  
  const passiveTotal = data.passiveIncomes.reduce((s, p) => s + p.amount, 0);

  const totalCapital = checkTotal + savTotal + cashTotal + efTotal + tangibleTotal + rentalTotal + passiveTotal;

  const macroChartData = [
    { name: 'Checking', value: checkTotal, fill: 'var(--neon-blue)' },
    { name: 'Savings', value: savTotal, fill: 'var(--neon-orange)' }, 
    { name: 'Emergency', value: efTotal, fill: 'var(--neon-green)' },
    { name: 'Cash', value: cashTotal, fill: 'var(--neon-pink)' }, 
    { name: 'Tangibles', value: tangibleTotal, fill: 'var(--neon-purple)' },
    { name: 'Real Estate', value: rentalTotal, fill: '#FFD60A' }, 
    { name: 'Freelance', value: passiveTotal, fill: '#64D2FF' } 
  ].filter(d => d.value > 0);

  const sparklineData = [
    { check: checkTotal * 0.8, sav: savTotal * 0.8 }, 
    { check: checkTotal * 0.85, sav: savTotal * 0.95 }, 
    { check: checkTotal * 0.9, sav: savTotal * 0.85 }, 
    { check: checkTotal, sav: savTotal }
  ];

  // --- LEETCODE HEATMAP LOGIC ---
  const last28Days = Array.from({length: 28}).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i));
    return d.toISOString().split('T')[0];
  });
  
  const heatmapData = last28Days.map(date => {
    const dayEarnings = data.passiveIncomes.filter(p => new Date(p.date).toISOString().split('T')[0] === date).reduce((s, p) => s + p.amount, 0);
    return { date, amount: dayEarnings };
  });
  
  const maxEarnings = Math.max(...heatmapData.map(d => d.amount), 1);
  const thirtyDayYield = heatmapData.reduce((s, d) => s + d.amount, 0);

  const getHeatmapColor = (amount) => {
    if (amount === 0) return 'var(--bg-input)';
    const ratio = amount / maxEarnings;
    if (ratio <= 0.25) return '#17401C'; 
    if (ratio <= 0.50) return '#21612A'; 
    if (ratio <= 0.75) return '#2A8137'; 
    return 'var(--neon-green)';          
  };

  const recentPassiveLogs = [...data.passiveIncomes].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#cashcue-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="cashcue-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--neon-blue)" /><stop offset="100%" stopColor="var(--neon-purple)" /></linearGradient>
            </defs>
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><rect x="16" y="14" width="4" height="4" rx="1" fill="var(--neon-blue)" stroke="none" />
          </svg>
          <span>CashCue</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <div className="nav-item" onClick={() => navigate('/dashboard')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</div>
          <div className="nav-item" onClick={() => navigate('/budgets')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Budgets</div>
          <div className="nav-item" onClick={() => navigate('/autopilot')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg> Autopilot</div>
          
          <div className="nav-item active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>
          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>
          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="nav-item" onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Settings</div>
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(10, 132, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)', border: '1px solid rgba(10, 132, 255, 0.2)' }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
               </div>
               <h2>Portfolio Command</h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <button style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: 'none', padding: '8px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>Assets</button>
                  <button onClick={() => navigate('/holdings')} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '8px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s' }}>Holdings</button>
              </div>

              {!isFormOpen ? (
                <button className="btn-action" style={{ color: 'var(--neon-blue)', backgroundColor: 'rgba(10, 132, 255, 0.15)' }} onClick={() => setIsFormOpen(true)}>
                  <span style={{ fontSize: '18px' }}>+</span> Add Asset
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
              )}
            </div>
          </div>

          {isFormOpen && (
            <form className="card" style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--neon-blue)' }} onSubmit={handleSubmit}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--neon-blue)' }}>New Local Asset</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Physical Cash</option>
                  <option value="EMERGENCY">Emergency Fund</option>
                  <option value="TANGIBLE">Tangible (Gold, Art)</option>
                  <option value="RENTAL">Rental Property</option>
                </select>
                <input type="text" placeholder="Description" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <input type="number" step="0.01" placeholder={`Current Value (${settings?.currency || '$'})`} required value={formData.currentValue} onChange={e => setFormData({...formData, currentValue: e.target.value})} />
                
                {formData.type === 'EMERGENCY' && (
                  <input type="number" step="0.01" placeholder={`Target Goal (${settings?.currency || '$'})`} required value={formData.targetValue} onChange={e => setFormData({...formData, targetValue: e.target.value})} />
                )}

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '0 8px 0 16px' }}>
                  <input type="text" placeholder="Custom Tag or Select →" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0', fontSize: '14px' }}/>
                  <button type="button" onClick={() => setShowCategoryMenu(!showCategoryMenu)} style={{ background: showCategoryMenu ? 'var(--text-primary)' : 'transparent', color: showCategoryMenu ? '#000' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  
                  {showCategoryMenu && (
                    <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', minWidth: '220px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '4px 8px', display: 'block', marginBottom: '4px' }}>Templates</span>
                      {PREDEFINED_ASSET_TAGS.map(cat => (
                         <button key={cat} type="button" onClick={() => { setFormData({...formData, category: cat}); setShowCategoryMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>{cat}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary">Lock In Asset</button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', marginBottom: '24px' }}>
             
             {/* LEFT: CIRCULAR MACRO HUB */}
             <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start', marginBottom: '20px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>
                  <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>Asset Allocation</h3>
                </div>
                <div style={{ position: 'relative', width: '240px', height: '240px' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10 }}>
                      <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{totalCapital >= 1000 ? (totalCapital/1000).toFixed(1) + 'k' : totalCapital}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Capital</p>
                    </div>
                    {macroChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={macroChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                            {macroChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                          </Pie>
                          <RechartsTooltip formatter={(val) => `${settings?.currency || '$'}${val.toLocaleString()}`} contentStyle={{ background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '8px solid var(--border-color)' }} />
                    )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
                  {macroChartData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: d.fill }}></div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
             </div>

             {/* RIGHT: SPARKLINE MICRO GRID */}
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* High Contrast Bank Card */}
                <div className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Liquid Bank Accounts</p>
                      <p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{(checkTotal + savTotal).toLocaleString()}</p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--neon-blue)', fontWeight: '600' }}>Chk: {settings?.currency || '$'}{checkTotal}</span>
                        <span style={{ fontSize: '12px', color: 'var(--neon-orange)', fontWeight: '600' }}>Sav: {settings?.currency || '$'}{savTotal}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, marginTop: '20px', marginLeft: '-24px', marginRight: '-24px', marginBottom: '-24px', opacity: 0.4 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData}>
                        <Area type="monotone" dataKey="check" stroke="var(--neon-blue)" fill="var(--neon-blue)" strokeWidth={3} />
                        <Area type="monotone" dataKey="sav" stroke="var(--neon-orange)" fill="var(--neon-orange)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Emergency Card WITH Injector */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Emergency Vault</p>
                      <div style={{ background: 'rgba(50, 215, 75, 0.15)', color: 'var(--neon-green)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{efTarget > 0 ? ((efTotal/efTarget)*100).toFixed(0) : 0}% SAVED</div>
                    </div>
                    <p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{efTotal.toLocaleString()}</p>
                    
                    {emergency.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', background: 'var(--bg-input)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <input type="number" placeholder={`Inject Funds (${settings?.currency || '$'})`} value={efInjectAmount} onChange={e => setEfInjectAmount(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', flex: 1, paddingLeft: '6px' }} />
                        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--neon-green)' }} onClick={handleEmergencyInject}>Deposit</button>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                       <span>Progress</span><span>Target: {settings?.currency || '$'}{efTarget.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--neon-green)', width: `${Math.min((efTotal/(efTarget||1))*100, 100)}%`, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                  </div>
                </div>

                {/* Cash Card - Cleaned Up */}
                <div className="card" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                     <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 55, 95, 0.15)', color: 'var(--neon-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>
                     </div>
                     <div>
                       <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Physical Cash Reserves</p>
                       <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{cashTotal.toLocaleString()}</p>
                     </div>
                   </div>
                </div>

             </div>
          </div>

          {/* ADDED: BANK ACCOUNTS & CASH MANAGEMENT LEDGER */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2.5"><rect x="3" y="8" width="18" height="12" rx="2"></rect><line x1="12" y1="8" x2="12" y2="4"></line><line x1="8" y1="4" x2="16" y2="4"></line></svg>
               <h3 style={{ fontSize: '18px', margin: 0 }}>Liquid Bank Accounts & Cash</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...banks, ...cash].length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No liquid bank or cash accounts active.</p>}
              
              {[...banks, ...cash].map(a => {
                const isProcessing = processingId === a.id;
                const isBank = a.type === 'BANK';
                const accentColor = isBank ? 'var(--neon-blue)' : 'var(--neon-green)';

                return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-input)', borderRadius: '12px', borderLeft: `3px solid ${accentColor}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }}>
                  
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '600' }}>{a.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.category || a.type}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Funding Source</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{settings?.currency || '$'}{a.currentValue.toLocaleString()}</p>
                    </div>
                    
                    {updateId === a.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder={`New Bal ${settings?.currency || '$'}`} style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                        <button onClick={() => handleUpdate(a.id)} disabled={isProcessing} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--neon-blue)', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{isProcessing ? '...' : 'Save'}</button>
                        <button onClick={() => { setUpdateId(null); setActionValue(''); }} style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>X</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => { setUpdateId(a.id); setActionValue(''); }} style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Update</button>
                        <button onClick={() => handleDelete(a.id)} style={{ background: 'transparent', color: 'var(--neon-pink)', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Drop</button>
                      </div>
                    )}
                  </div>

                </div>
              )})}
            </div>
          </div>

          {/* RESTORED: TANGIBLE & REAL ESTATE MATRIX */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-purple)" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
               <h3 style={{ fontSize: '18px', margin: 0 }}>Variable Holdings (Tangibles & Real Estate)</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {variableHoldings.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No tangible or rental assets logged.</p>}
              
              {variableHoldings.map(a => {
                const pl = a.currentValue - (a.basis || 0);
                const isProcessing = processingId === a.id;
                const isRealEstate = a.type === 'RENTAL';
                const accentColor = isRealEstate ? '#FFD60A' : 'var(--neon-purple)';

                return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-input)', borderRadius: '12px', borderLeft: `3px solid ${accentColor}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }}>
                  
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '600' }}>{a.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.category || a.type.replace('_', ' ')}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Initial Basis: {settings?.currency || '$'}{(a.basis || 0).toLocaleString()}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{settings?.currency || '$'}{a.currentValue.toLocaleString()}</p>
                      {pl !== 0 && (
                        <p style={{ fontSize: '12px', color: pl >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)', margin: 0, fontWeight: '600' }}>
                           {pl >= 0 ? '+' : ''}{settings?.currency || '$'}{pl.toLocaleString()} Unrealized
                        </p>
                      )}
                    </div>
                    
                    {updateId === a.id || sellId === a.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder={sellId ? `Final ${settings?.currency || '$'}` : `New Val ${settings?.currency || '$'}`} style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                        <button onClick={() => sellId ? handleSell(a.id) : handleUpdate(a.id)} disabled={isProcessing} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: sellId ? 'var(--neon-green)' : 'var(--neon-blue)', color: sellId ? '#000' : '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{isProcessing ? '...' : 'Confirm'}</button>
                        <button onClick={() => { setUpdateId(null); setSellId(null); setActionValue(''); }} style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>X</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button onClick={() => { setUpdateId(a.id); setActionValue(''); }} style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Update</button>
                        <button onClick={() => { setSellId(a.id); setActionValue(''); }} style={{ background: 'var(--neon-green)', color: '#000', borderRadius: '12px', padding: '6px 16px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Realize</button>
                        <button onClick={() => handleDelete(a.id)} style={{ background: 'transparent', color: 'var(--neon-pink)', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Drop</button>
                      </div>
                    )}
                  </div>

                </div>
              )})}
            </div>
          </div>

          {/* BOTTOM ROW: FREELANCE HEATMAP & LEDGER */}
          <div className="card">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-green)" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                 <h3 style={{ fontSize: '18px', margin: 0 }}>Passive Work Tracker</h3>
               </div>
               <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(50, 215, 75, 0.15)', color: 'var(--neon-green)', fontWeight: '600' }}>Freelance Heatmap</span>
             </div>
             
             <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
               
               {/* 30-Day Activity Grid (Strict 7x4 Leetcode Layout) */}
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Last 28 Days Matrix</p>
                 <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gap: '4px' }}>
                    {heatmapData.map((day, idx) => (
                        <div key={idx} title={`${day.date}: ${settings?.currency || '$'}${day.amount}`} style={{ width: '22px', height: '22px', borderRadius: '4px', backgroundColor: getHeatmapColor(day.amount), border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s', cursor: 'crosshair' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}></div>
                    ))}
                 </div>
               </div>

               {/* RECENT LOGS LEDGER */}
               <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>30-Day Yield</p>
                 <p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--neon-green)', marginBottom: '24px' }}>{settings?.currency || '$'}{thirtyDayYield.toLocaleString()}</p>
                 
                 <p style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '12px' }}>Recent Entries</p>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {recentPassiveLogs.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No recent logs.</span>}
                   {recentPassiveLogs.map(log => (
                     <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                       <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(log.date).toLocaleDateString()}</span>
                       <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>+{settings?.currency || '$'}{log.amount.toFixed(2)}</span>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Add Work Form */}
               <form onSubmit={handleFreelanceSubmit} style={{ width: '280px', background: 'var(--bg-input)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', opacity: processingId === 'freelance-submit' ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                 <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'var(--neon-green)' }}>Log Yield</p>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <input type="date" required value={freelanceData.date} onChange={e => setFreelanceData({...freelanceData, date: e.target.value})} style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'var(--bg-elevated)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}/>
                    <input type="number" placeholder={`Amount Earned (${settings?.currency || '$'})`} required value={freelanceData.amount} onChange={e => setFreelanceData({...freelanceData, amount: e.target.value})} style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'var(--bg-elevated)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}/>
                 </div>
                 <button type="submit" style={{ width: '100%', padding: '12px', fontSize: '14px', background: 'var(--neon-green)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }} disabled={processingId === 'freelance-submit'}>
                   {processingId === 'freelance-submit' ? 'Logging...' : 'Record Earnings'}
                 </button>
               </form>

             </div>
          </div>

        </div>
      </main>
    </div>
  );
}