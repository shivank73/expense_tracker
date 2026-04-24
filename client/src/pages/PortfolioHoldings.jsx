import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, XAxis } from 'recharts';

const HOLDING_COLORS = { 'STOCK': '#0A84FF', 'CRYPTO': '#FF9F0A', 'BOND': '#FF453A', 'MF': '#BF5AF2', 'FD': '#32D74B' };

export default function PortfolioHoldings() {
  const [holdings, setHoldings] = useState([]);
  const [liquidAssets, setLiquidAssets] = useState([]); 
  const [indices, setIndices] = useState([]);
  const [news, setNews] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  
  // Forms
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ type: 'STOCK', symbol: '', quantity: '1', averageCost: '', fundingSourceId: '', category: 'General', sipAmount: '', interestRate: '' });
  
  // Action States
  const [sellId, setSellId] = useState(null);
  const [sellPrice, setSellPrice] = useState('');
  const [updateId, setUpdateId] = useState(null);
  const [updatePrice, setUpdatePrice] = useState('');

  // SIP Calculator
  const [calcSip, setCalcSip] = useState(500);
  const [calcRate, setCalcRate] = useState(12);
  const [calcYears, setCalcYears] = useState(10);

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchEcosystem = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        
        const [holdRes, assetRes, indRes, newsRes] = await Promise.all([
          axios.get('https://cashcue-api.onrender.com/api/portfolio/holdings', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
          axios.get('https://cashcue-api.onrender.com/api/portfolio', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { assets: [] } })),
          axios.get('https://cashcue-api.onrender.com/api/market/indices', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
          axios.get('https://cashcue-api.onrender.com/api/market/news', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ]);
        
        setHoldings(holdRes.data || []);
        setLiquidAssets((assetRes.data.assets || []).filter(a => a.type === 'BANK' || a.type === 'CASH'));
        setNews(newsRes.data.length ? newsRes.data : [{ id: 1, title: "Market Scraper API Offline - Connect Backend.", source: "System", url: "#" }]);

        if (indRes.data) setIndices(indRes.data);
        else {
          setIndices([
            { name: 'S&P 500', value: 5123.41, change: '+1.2%', isUp: true, chart: [{v: 4950}, {v: 4980}, {v: 4920}, {v: 5050}, {v: 5010}, {v: 5090}, {v: 5123}] },
            { name: 'Sensex', value: 73500.12, change: '-0.4%', isUp: false, chart: [{v: 74200}, {v: 74500}, {v: 74000}, {v: 74100}, {v: 73800}, {v: 73900}, {v: 73500}] },
            { name: 'Nifty 50', value: 22350.50, change: '+0.8%', isUp: true, chart: [{v: 21900}, {v: 22050}, {v: 21950}, {v: 22100}, {v: 22250}, {v: 22200}, {v: 22350}] },
            { name: 'Govt Bonds (10Y)', value: 7.12, change: '-0.05%', isUp: false, chart: [{v: 7.3}, {v: 7.25}, {v: 7.2}, {v: 7.15}, {v: 7.18}, {v: 7.14}, {v: 7.12}] }
          ]);
        }
      } catch (error) { if (error.response?.status === 401) handleLogout(); }
    };
    fetchEcosystem();
  }, []);

  const handleBuy = async (e) => {
    e.preventDefault();
    setProcessingId('buy');
    try {
      const token = localStorage.getItem('token');
      let payload = { ...formData, fundingSourceId: formData.fundingSourceId || null };
      
      if (payload.type === 'MF') {
        payload.sipAmount = parseFloat(formData.sipAmount);
        payload.averageCost = parseFloat(formData.sipAmount); 
        payload.quantity = 1;
      } else if (payload.type === 'FD') {
        payload.averageCost = parseFloat(formData.averageCost); 
        payload.interestRate = parseFloat(formData.interestRate);
        payload.quantity = 1;
      } else {
        payload.quantity = parseFloat(formData.quantity);
        payload.averageCost = parseFloat(formData.averageCost);
      }

      const res = await axios.post('https://cashcue-api.onrender.com/api/portfolio/buy', payload, { headers: { Authorization: `Bearer ${token}` } });
      setHoldings([res.data.holding, ...holdings]);
      
      if (payload.fundingSourceId) {
         const deduction = payload.type === 'MF' ? payload.sipAmount : (payload.quantity * payload.averageCost);
         setLiquidAssets(prev => prev.map(a => a.id === payload.fundingSourceId ? { ...a, currentValue: a.currentValue - deduction } : a));
      }
      setIsFormOpen(false);
      setFormData({ type: 'STOCK', symbol: '', quantity: '1', averageCost: '', fundingSourceId: '', category: 'General', sipAmount: '', interestRate: '' });
    } catch (error) { alert("Buy execution failed."); }
    setProcessingId(null);
  };

  const handleSell = async (id) => {
    if (!sellPrice || isNaN(sellPrice)) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`https://cashcue-api.onrender.com/api/portfolio/holdings/sell/${id}`, { sellPrice: parseFloat(sellPrice) }, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setHoldings(holdings.filter(h => h.id !== id));
        setSellId(null); setSellPrice('');
        setProcessingId(null);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Sell execution failed."); }
  };

  const handleUpdate = async (id) => {
    if (!updatePrice || isNaN(updatePrice)) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`https://cashcue-api.onrender.com/api/portfolio/holdings/${id}`, { currentPrice: parseFloat(updatePrice) }, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setHoldings(holdings.map(h => h.id === id ? { ...h, currentPrice: parseFloat(updatePrice) } : h));
        setUpdateId(null); setUpdatePrice('');
        setProcessingId(null);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Update execution failed."); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Drop record permanently?")) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://cashcue-api.onrender.com/api/portfolio/holdings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setHoldings(holdings.filter(h => h.id !== id));
        setProcessingId(null);
      }, 400);
    } catch (error) { setProcessingId(null); alert("Drop execution failed."); }
  };

  const generateAIDiagnostic = async () => {
    setProcessingId('ai-load');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('https://cashcue-api.onrender.com/api/market/ai', { headers: { Authorization: `Bearer ${token}` } });
      setAiSummary(res.data.summary);
    } catch (error) {
      setAiSummary("AI Engine failed to connect. Please verify your GEMINI_API_KEY.");
    }
    setProcessingId(null);
  };

  // Decoupled Math Engine for Granular Charts
  const equities = holdings.filter(h => h.type === 'STOCK');
  const cryptos = holdings.filter(h => h.type === 'CRYPTO');
  const bonds = holdings.filter(h => h.type === 'BOND');
  const mutualFunds = holdings.filter(h => h.type === 'MF');
  const fixedDeposits = holdings.filter(h => h.type === 'FD');

  const stockTotal = equities.reduce((s, h) => s + (h.quantity * h.currentPrice), 0);
  const cryptoTotal = cryptos.reduce((s, h) => s + (h.quantity * h.currentPrice), 0);
  const bondTotal = bonds.reduce((s, h) => s + (h.quantity * h.currentPrice), 0);
  const mfTotal = mutualFunds.reduce((s, h) => s + (h.quantity * h.currentPrice), 0);
  const fdTotal = fixedDeposits.reduce((s, h) => s + (h.quantity * h.currentPrice), 0);

  const totalMarketValue = stockTotal + cryptoTotal + bondTotal + mfTotal + fdTotal;
  const totalInvested = holdings.reduce((s, h) => s + (h.quantity * h.averageCost), 0);
  const globalPL = totalMarketValue - totalInvested;

  const macroChartData = [
    { name: 'Equities', value: stockTotal, fill: HOLDING_COLORS['STOCK'] },
    { name: 'Crypto', value: cryptoTotal, fill: HOLDING_COLORS['CRYPTO'] },
    { name: 'Govt Bonds', value: bondTotal, fill: HOLDING_COLORS['BOND'] },
    { name: 'Mutual Funds', value: mfTotal, fill: HOLDING_COLORS['MF'] },
    { name: 'Fixed Deposits', value: fdTotal, fill: HOLDING_COLORS['FD'] }
  ].filter(d => d.value > 0);

  const calcData = useMemo(() => {
    const ratePerMonth = (calcRate / 100) / 12;
    let data = []; let invested = 0; let futureValue = 0;
    for (let i = 1; i <= calcYears; i++) {
      invested = calcSip * 12 * i;
      futureValue = calcSip * ((Math.pow(1 + ratePerMonth, i * 12) - 1) / ratePerMonth) * (1 + ratePerMonth);
      data.push({ year: `Year ${i}`, Invested: invested, Value: futureValue });
    }
    return { invested, futureValue, data };
  }, [calcSip, calcRate, calcYears]);

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#cashcue-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs><linearGradient id="cashcue-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--neon-blue)" /><stop offset="100%" stopColor="var(--neon-purple)" /></linearGradient></defs>
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
          <div className="nav-item" onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          
          {/* HEADER TOGGLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(10, 132, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)', border: '1px solid rgba(10, 132, 255, 0.2)' }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
               </div>
               <h2>Market Holdings</h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <button onClick={() => navigate('/portfolio')} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '8px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s' }}>Assets</button>
                  <button style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: 'none', padding: '8px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>Holdings</button>
              </div>
              <button className="btn-action" style={{ color: 'var(--neon-blue)', backgroundColor: 'rgba(10, 132, 255, 0.15)' }} onClick={() => setIsFormOpen(!isFormOpen)}>
                {isFormOpen ? 'Cancel Order' : '+ Buy Asset'}
              </button>
            </div>
          </div>

          {/* DYNAMIC FORM */}
          {isFormOpen && (
            <form className="card" style={{ marginBottom: '32px', position: 'relative', overflow: 'hidden', padding: '32px', background: 'var(--bg-elevated)', borderTop: `4px solid ${HOLDING_COLORS[formData.type]}`, boxShadow: `0 10px 40px ${HOLDING_COLORS[formData.type]}15`, opacity: processingId === 'buy' ? 0.6 : 1, transform: processingId === 'buy' ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }} onSubmit={handleBuy}>
              <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: HOLDING_COLORS[formData.type], filter: 'blur(100px)', opacity: 0.15, zIndex: 0 }}></div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>New Market Position</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Configure and execute your asset allocation.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>CLASS</span>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, symbol: '', quantity: '1', averageCost: '', sipAmount: '', interestRate: ''})} style={{ background: HOLDING_COLORS[formData.type], padding: '8px 16px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}>
                      <option value="STOCK" style={{ background: 'var(--bg-elevated)', color: '#fff' }}>Equities</option>
                      <option value="CRYPTO" style={{ background: 'var(--bg-elevated)', color: '#fff' }}>Crypto</option>
                      <option value="MF" style={{ background: 'var(--bg-elevated)', color: '#fff' }}>Mutual Fund (SIP)</option>
                      <option value="FD" style={{ background: 'var(--bg-elevated)', color: '#fff' }}>Fixed Deposit</option>
                      <option value="BOND" style={{ background: 'var(--bg-elevated)', color: '#fff' }}>Govt Bond</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset Ticker / Name</label>
                    <input type="text" placeholder="e.g. AAPL" required value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', textTransform: 'uppercase', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                  </div>
                  
                  {formData.type === 'MF' ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly SIP ($)</label>
                      <input type="number" step="1" placeholder="0.00" required value={formData.sipAmount} onChange={e => setFormData({...formData, sipAmount: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                     </div>
                  ) : formData.type === 'FD' ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Principal Amount ($)</label>
                        <input type="number" step="1" placeholder="0.00" required value={formData.averageCost} onChange={e => setFormData({...formData, averageCost: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interest Rate (%)</label>
                        <input type="number" step="0.1" placeholder="0.0%" required value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity</label>
                        <input type="number" step="0.0001" placeholder="0" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Cost ($)</label>
                        <input type="number" step="0.01" placeholder="0.00" required value={formData.averageCost} onChange={e => setFormData({...formData, averageCost: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Funding Source</label>
                    <div style={{ position: 'relative' }}>
                      <select required value={formData.fundingSourceId} onChange={e => setFormData({...formData, fundingSourceId: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none', width: '100%', boxSizing: 'border-box', transition: 'border 0.2s' }} onFocus={e => e.target.style.borderColor = HOLDING_COLORS[formData.type]} onBlur={e => e.target.style.borderColor = 'var(--border-color)'}>
                        <option value="">Select Liquid Asset...</option>
                        {liquidAssets.map(a => <option key={a.id} value={a.id}>{a.name} (Bal: ${a.currentValue.toLocaleString()})</option>)}
                      </select>
                      <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Estimated Total Capital Required</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      ${ formData.type === 'MF' ? (parseFloat(formData.sipAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : formData.type === 'FD' ? (parseFloat(formData.averageCost || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : (parseFloat(formData.quantity || 0) * parseFloat(formData.averageCost || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }
                    </p>
                  </div>
                  <button type="submit" className="btn-primary" style={{ background: HOLDING_COLORS[formData.type], padding: '14px 32px', fontSize: '15px', fontWeight: '700', borderRadius: '12px', border: 'none', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', boxShadow: `0 8px 24px ${HOLDING_COLORS[formData.type]}40`, opacity: processingId === 'buy' ? 0.7 : 1 }} disabled={processingId === 'buy'} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    {processingId === 'buy' ? 'Authorizing...' : 'Execute Transaction'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ROW 1: LIVE INDICES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
            {indices.map((index, i) => {
              const strokeColor = index.isUp ? 'var(--neon-green)' : 'var(--neon-pink)';
              return (
              <div key={i} className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ zIndex: 2, position: 'relative' }}>
                   <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>{index.name}</p>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{index.value.toLocaleString()}</p>
                     <span className="badge" style={{ background: index.isUp ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 55, 95, 0.15)', color: strokeColor }}>{index.change}</span>
                   </div>
                 </div>
                 {index.chart && (
                    <div style={{ position: 'absolute', bottom: '-5px', left: 0, right: 0, height: '70px', opacity: 0.25, zIndex: 1 }}>
                      <ResponsiveContainer width="100%" height="100%"><AreaChart data={index.chart}><Area type="monotone" dataKey="v" stroke={strokeColor} fill={strokeColor} strokeWidth={2} /></AreaChart></ResponsiveContainer>
                    </div>
                 )}
              </div>
            )})}
          </div>

          {/* ROW 2: SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
             <div className="card" style={{ borderTop: `3px solid ${HOLDING_COLORS['STOCK']}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Equities & Crypto</p>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={HOLDING_COLORS['STOCK']} strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
               </div>
               <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>${(stockTotal + cryptoTotal).toLocaleString()}</p>
             </div>
             
             <div className="card" style={{ borderTop: `3px solid ${HOLDING_COLORS['MF']}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mutual Funds</p>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={HOLDING_COLORS['MF']} strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
               </div>
               <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>${mfTotal.toLocaleString()}</p>
             </div>
             
             <div className="card" style={{ borderTop: `3px solid ${HOLDING_COLORS['FD']}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Fixed Income & Bonds</p>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={HOLDING_COLORS['FD']} strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
               </div>
               <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>${(fdTotal + bondTotal).toLocaleString()}</p>
             </div>
             
             <div className="card" style={{ background: 'rgba(10, 132, 255, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <p style={{ fontSize: '13px', color: 'var(--neon-blue)', fontWeight: '600' }}>Global Exposure</p>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path></svg>
               </div>
               <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--neon-blue)' }}>${totalMarketValue.toLocaleString()}</p>
             </div>
          </div>

          {/* ROW 3: MACRO PIE & EXPANDED AI CARD */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
             <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Asset Distribution</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Capital allocation across classes.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {macroChartData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: d.fill }}></div>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>${d.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10 }}>
                      <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>${totalMarketValue >= 1000 ? (totalMarketValue/1000).toFixed(1) + 'k' : totalMarketValue}</p>
                      <p style={{ fontSize: '12px', color: globalPL >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)', fontWeight: '700' }}>{globalPL >= 0 ? '+' : ''}${globalPL.toLocaleString(undefined, {maximumFractionDigits: 0})} P/L</p>
                    </div>
                    {macroChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={macroChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">{macroChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie></PieChart>
                      </ResponsiveContainer>
                    ) : <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '8px solid var(--border-color)' }} /> }
                </div>
             </div>

             <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                   <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(191, 90, 242, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-purple)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg></div>
                   <h3 style={{ fontSize: '18px', margin: 0 }}>Quantitative AI Analyst</h3>
                </div>
                {/* UPGRADED AI READING PANE: minHeight, flex-start, and increased line-height */}
                <div style={{ flex: 1, background: 'var(--bg-input)', padding: '20px', borderRadius: '16px', borderLeft: '3px solid var(--neon-purple)', display: 'flex', alignItems: 'flex-start', minHeight: '160px', overflowY: 'auto' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.7', margin: 0 }}>{aiSummary || "Run diagnostic to analyze macro trends against your portfolio exposure. The engine will evaluate global capital flows, sector rotation, and risk parity."}</p>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={generateAIDiagnostic} disabled={processingId === 'ai-load'} className="btn-secondary" style={{ color: 'var(--neon-purple)', borderColor: 'var(--neon-purple)' }}>{processingId === 'ai-load' ? 'Analyzing...' : 'Execute Scan'}</button>
                </div>
             </div>
          </div>

          {/* ROW 4: COMPOUNDING ENGINE & NEWS TRACKER */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div className="card" style={{ display: 'flex', gap: '24px' }}>
               <div style={{ flex: 1 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                   <h3 style={{ fontSize: '18px', margin: 0 }}>Compounding Engine</h3>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Monthly Investment</label><span style={{ fontWeight: '700' }}>${calcSip}</span></div>
                     <input type="range" min="100" max="5000" step="100" value={calcSip} onChange={e => setCalcSip(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--neon-blue)' }} />
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Expected Return (%)</label><span style={{ fontWeight: '700' }}>{calcRate}%</span></div>
                     <input type="range" min="5" max="25" step="1" value={calcRate} onChange={e => setCalcRate(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--neon-green)' }} />
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Time Period (Years)</label><span style={{ fontWeight: '700' }}>{calcYears} Yrs</span></div>
                     <input type="range" min="1" max="30" step="1" value={calcYears} onChange={e => setCalcYears(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--neon-purple)' }} />
                   </div>
                 </div>
                 <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <div><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Invested</p><p style={{ fontSize: '16px', fontWeight: '700' }}>${calcData.invested.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
                    <div style={{ textAlign: 'right' }}><p style={{ fontSize: '12px', color: 'var(--neon-green)' }}>Est. Returns</p><p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--neon-green)' }}>${(calcData.futureValue - calcData.invested).toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
                 </div>
               </div>
               <div style={{ flex: 1.2, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', textAlign: 'right', marginBottom: '16px' }}>Total: ${calcData.futureValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <div style={{ flex: 1, minHeight: '200px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={calcData.data}>
                        <XAxis dataKey="year" hide />
                        <Area type="monotone" dataKey="Value" stackId="1" stroke="var(--neon-blue)" fill="rgba(10, 132, 255, 0.3)" strokeWidth={3} />
                        <Area type="monotone" dataKey="Invested" stackId="2" stroke="var(--text-secondary)" fill="rgba(255, 255, 255, 0.05)" strokeWidth={2} />
                        <RechartsTooltip formatter={(val) => `$${val.toLocaleString(undefined, {maximumFractionDigits: 0})}`} contentStyle={{ background: '#1C1C1E', borderRadius: '8px', border: 'none', color: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8V6Z"></path></svg>
                 <h3 style={{ fontSize: '18px', margin: 0 }}>Business Wire</h3>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                 {news.map(item => (
                   <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--neon-blue)', textTransform: 'uppercase' }}>{item.source}</span></div>
                     <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{item.title}</p>
                   </a>
                 ))}
               </div>
            </div>
          </div>

          {/* ROW 5: SEPARATED LEDGERS WITH PREMIUM CANCEL BUTTONS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
            
            {/* STOCKS, CRYPTO & BONDS */}
            <div className="card">
              <h3 style={{ fontSize: '16px', marginBottom: '16px', color: HOLDING_COLORS['STOCK'] }}>Equities, Crypto & Bonds</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[...equities, ...cryptos, ...bonds].map(h => {
                  const plPercent = (((h.currentPrice - h.averageCost) / h.averageCost) * 100).toFixed(2);
                  const isProcessing = processingId === h.id;
                  return (
                  <div key={h.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', borderLeft: `3px solid ${HOLDING_COLORS[h.type]}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700' }}>{h.symbol}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: plPercent >= 0 ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 55, 95, 0.15)', color: plPercent >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)' }}>{plPercent >= 0 ? '+' : ''}{plPercent}%</span>
                      </div>
                      <span style={{ fontWeight: '700' }}>${(h.quantity * h.currentPrice).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.quantity} units</span>
                      
                      {updateId === h.id ? (
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: `1px solid ${HOLDING_COLORS[h.type]}` }}>
                          <input type="number" placeholder="New Price $" value={updatePrice} onChange={e=>setUpdatePrice(e.target.value)} style={{ width: '70px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '11px', paddingLeft: '4px' }}/>
                          <button onClick={() => handleUpdate(h.id)} disabled={isProcessing} style={{ background: 'var(--neon-blue)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', fontWeight: '700' }}>{isProcessing ? '...' : '✓'}</button>
                          <button onClick={() => { setUpdateId(null); setUpdatePrice(''); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer', padding: '4px 6px', fontWeight: '700' }}>X</button>
                        </div>
                      ) : sellId === h.id ? (
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: `1px solid ${HOLDING_COLORS[h.type]}` }}>
                          <input type="number" placeholder="Exit/Unit $" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} style={{ width: '70px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '11px', paddingLeft: '4px' }}/>
                          <button onClick={() => handleSell(h.id)} disabled={isProcessing} style={{ background: 'var(--neon-green)', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', fontWeight: '700' }}>{isProcessing ? '...' : 'Sell'}</button>
                          <button onClick={() => { setSellId(null); setSellPrice(''); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer', padding: '4px 6px', fontWeight: '700' }}>X</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={()=>setUpdateId(h.id)} style={{ background: 'transparent', color: 'var(--neon-blue)', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Update</button>
                          <button onClick={()=>setSellId(h.id)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Realize</button>
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* MUTUAL FUNDS */}
            <div className="card">
              <h3 style={{ fontSize: '16px', marginBottom: '16px', color: HOLDING_COLORS['MF'] }}>Active SIPs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mutualFunds.map(h => {
                  const plPercent = (((h.currentPrice - h.averageCost) / h.averageCost) * 100).toFixed(2);
                  const isProcessing = processingId === h.id;
                  return (
                  <div key={h.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', borderLeft: `3px solid ${HOLDING_COLORS['MF']}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700' }}>{h.symbol}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: plPercent >= 0 ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 55, 95, 0.15)', color: plPercent >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)' }}>{plPercent >= 0 ? '+' : ''}{plPercent}%</span>
                      </div>
                      <span style={{ fontWeight: '700' }}>${(h.quantity * h.currentPrice).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>${h.sipAmount}/mo</span>
                      
                      {updateId === h.id ? (
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: `1px solid ${HOLDING_COLORS['MF']}` }}>
                          <input type="number" placeholder="New NAV $" value={updatePrice} onChange={e=>setUpdatePrice(e.target.value)} style={{ width: '70px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '11px', paddingLeft: '4px' }}/>
                          <button onClick={() => handleUpdate(h.id)} disabled={isProcessing} style={{ background: 'var(--neon-blue)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', fontWeight: '700' }}>{isProcessing ? '...' : '✓'}</button>
                          <button onClick={() => { setUpdateId(null); setUpdatePrice(''); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer', padding: '4px 6px', fontWeight: '700' }}>X</button>
                        </div>
                      ) : sellId === h.id ? (
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: `1px solid ${HOLDING_COLORS['MF']}` }}>
                          <input type="number" placeholder="Exit/Unit $" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} style={{ width: '70px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '11px', paddingLeft: '4px' }}/>
                          <button onClick={() => handleSell(h.id)} disabled={isProcessing} style={{ background: 'var(--neon-green)', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', fontWeight: '700' }}>{isProcessing ? '...' : 'Sell'}</button>
                          <button onClick={() => { setSellId(null); setSellPrice(''); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer', padding: '4px 6px', fontWeight: '700' }}>X</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={()=>setUpdateId(h.id)} style={{ background: 'transparent', color: 'var(--neon-blue)', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Update NAV</button>
                          <button onClick={()=>setSellId(h.id)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Realize</button>
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* FIXED DEPOSITS */}
            <div className="card">
              <h3 style={{ fontSize: '16px', marginBottom: '16px', color: HOLDING_COLORS['FD'] }}>Fixed Deposits</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fixedDeposits.map(h => {
                  const isProcessing = processingId === h.id;
                  return (
                  <div key={h.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', borderLeft: `3px solid ${HOLDING_COLORS['FD']}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700' }}>{h.symbol}</span>
                      <span style={{ fontWeight: '700' }}>${(h.quantity * h.currentPrice).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.interestRate}% Interest</span>
                      
                      {isProcessing ? (
                        <span style={{ fontSize: '11px', color: 'var(--neon-pink)', fontWeight: '700' }}>Dropping...</span>
                      ) : (
                        <button onClick={()=>handleDelete(h.id)} style={{ background: 'transparent', color: 'var(--neon-pink)', border: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>Close FD</button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
} 