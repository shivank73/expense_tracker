import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';

const APPLE_COLORS = ['#FF375F', '#0A84FF', '#FF9F0A', '#32D74B', '#BF5AF2', '#5E5CE6', '#FFD60A'];
const getHashColor = (str) => {
  let hash = 0;
  if (!str) return APPLE_COLORS[0];
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return APPLE_COLORS[Math.abs(hash) % APPLE_COLORS.length];
};

const isPastDue = (dateString) => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dateString);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate <= today;
};

const isUpcoming = (dateString) => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const dueDate = new Date(dateString);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate > today && dueDate <= nextWeek;
};

const PREDEFINED_CATEGORIES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Utilities', 'Other Expense'];

export default function Autopilot() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('subscriptions'); 
  const [data, setData] = useState({ subscriptions: [], bills: [], debts: [] });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [activePaymentId, setActivePaymentId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);

  const [isMounted, setIsMounted] = useState(false);

  // --- ANIMATION STATES ---
  const [processingId, setProcessingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 100);

    const fetchAutopilotData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        const res = await axios.get('https://cashcue-api.onrender.com/api/autopilot', { headers: { Authorization: `Bearer ${token}` } });
        setData(res.data);
      } catch (error) {
        if (error.response?.status === 401) handleLogout();
      }
    };
    fetchAutopilotData();

    return () => clearTimeout(t);
  }, []);

  const openForm = () => {
    if (activeTab === 'subscriptions') setFormData({ name: '', price: '', cycle: 'Monthly', nextPaymentDate: new Date().toISOString().split('T')[0], category: '', autoPay: false });
    if (activeTab === 'bills') setFormData({ name: '', amount: '', frequency: 'Monthly', nextDueDate: new Date().toISOString().split('T')[0], autoPay: false, category: '' });
    if (activeTab === 'debts') setFormData({ type: 'BORROWED', personName: '', totalAmount: '', amountPaid: 0, dueDate: '' });
    setShowCategoryMenu(false); 
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let payload = { ...formData };

      if (activeTab === 'subscriptions' || activeTab === 'bills') {
        if (!payload.category) payload.category = 'General';
      }
      if (activeTab === 'debts' && !payload.dueDate) delete payload.dueDate;

      if (activeTab === 'subscriptions') endpoint = '/api/autopilot/subscription';
      if (activeTab === 'bills') endpoint = '/api/autopilot/bill';
      if (activeTab === 'debts') endpoint = '/api/autopilot/debt';

      const res = await axios.post(`https://cashcue-api.onrender.com${endpoint}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setData(prev => ({ ...prev, [activeTab]: [res.data, ...prev[activeTab]] }));
        setIsFormOpen(false);
        setIsSubmitting(false);
      }, 400); // 400ms delay for form submission animation
    } catch (error) {
      setIsSubmitting(false);
      alert(error.response?.data?.message || "Failed to save entry.");
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Delete this ${type}?`)) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const apiType = type === 'subscriptions' ? 'sub' : type === 'bills' ? 'bill' : 'debt';
      await axios.delete(`https://cashcue-api.onrender.com/api/autopilot/${apiType}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setData(prev => ({ ...prev, [type]: prev[type].filter(item => item.id !== id) }));
        setProcessingId(null);
      }, 400); // 400ms delay for fade out animation
    } catch (error) {
      setProcessingId(null);
      alert("Failed to delete.");
    }
  };

  const handleApprove = async (id, type) => {
    setProcessingId(id); 
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`https://cashcue-api.onrender.com/api/autopilot/approve/${type}/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        const stateKey = type === 'sub' ? 'subscriptions' : type === 'bill' ? 'bills' : 'debts';
        setData(prev => ({ ...prev, [stateKey]: prev[stateKey].map(item => item.id === id ? res.data : item) }));
        setProcessingId(null);
      }, 400); 

    } catch (error) { 
      setProcessingId(null);
      const exactError = error.response?.data?.message || error.response?.data?.error || error.message;
      alert(`Approval Failed: ${exactError}`); 
    }
  };

  const handleLogPayment = async (id) => {
    if (!paymentAmount || isNaN(paymentAmount) || parseFloat(paymentAmount) <= 0) return alert("Enter a valid amount.");
    setProcessingId(id); 
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`https://cashcue-api.onrender.com/api/autopilot/debt/${id}`, { amountPaid: paymentAmount }, { headers: { Authorization: `Bearer ${token}` } });
      setTimeout(() => {
        setData(prev => ({ ...prev, debts: prev.debts.map(d => d.id === id ? res.data : d) }));
        setActivePaymentId(null);
        setPaymentAmount('');
        setProcessingId(null);
      }, 400);
    } catch (error) {
      setProcessingId(null);
      alert("Failed to log payment.");
    }
  };

  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  let subMonthly = 0;
  data.subscriptions.forEach(sub => { subMonthly += sub.cycle === 'Yearly' ? sub.price / 12 : sub.price; });
  let billMonthly = 0;
  data.bills.forEach(bill => {
    if (bill.frequency === 'Yearly') billMonthly += bill.amount / 12;
    else if (bill.frequency === 'Quarterly') billMonthly += bill.amount / 3;
    else billMonthly += bill.amount;
  });

  let debtRemaining = 0;
  data.debts.forEach(d => { if (d.type === 'BORROWED') debtRemaining += (d.totalAmount - d.amountPaid); });
  let debtMonthlyEstimate = debtRemaining > 0 ? debtRemaining / 12 : 0; 
  const totalMonthlyCommitment = subMonthly + billMonthly + debtMonthlyEstimate;

  const generateAIBrief = () => {
    setAiLoading(true);
    setAiSummary(null);
    
    setTimeout(() => {
      const upcomingSubs = data.subscriptions.filter(s => new Date(s.nextPaymentDate) <= nextWeek && new Date(s.nextPaymentDate) >= today);
      const upcomingBills = data.bills.filter(b => new Date(b.nextDueDate) <= nextWeek && new Date(b.nextDueDate) >= today);
      
      const next7DaysTotal = upcomingSubs.reduce((sum, s) => sum + s.price, 0) + upcomingBills.reduce((sum, b) => sum + b.amount, 0);
      
      const immediateNames = [...upcomingSubs.map(s => s.name), ...upcomingBills.map(b => b.name)];
      let namesString = immediateNames.length > 0 
        ? (immediateNames.length <= 2 ? immediateNames.join(' and ') : `${immediateNames[0]}, ${immediateNames[1]}, and ${immediateNames.length - 2} other(s)`) 
        : '';

      const activeDebts = data.debts.filter(d => d.type === 'BORROWED' && d.totalAmount > d.amountPaid);
      let debtInsight = "You are currently debt-free. Excellent structural stability.";
      
      if (activeDebts.length > 0) {
        const closestDebt = activeDebts.reduce((prev, current) => {
          return (current.amountPaid / current.totalAmount) > (prev.amountPaid / prev.totalAmount) ? current : prev;
        });
        const percentDone = Math.round((closestDebt.amountPaid / closestDebt.totalAmount) * 100);
        debtInsight = `You are servicing ${activeDebts.length} active liability. Keep pushing on the ${closestDebt.personName} debt—you are already ${percentDone}% of the way to clearing it.`;
      }

      let brief = `Financial repository analyzed. Your automated baseline requires ${settings?.currency || '$'}${totalMonthlyCommitment.toFixed(0)} per month to maintain. `;
      
      if (next7DaysTotal > 0) {
        brief += `\n\nAction Required: You need exactly ${settings?.currency || '$'}${next7DaysTotal.toFixed(2)} liquid cash in the next 7 days to cover upcoming hits from ${namesString}. `;
      } else {
        brief += `\n\nCashflow is clear. No automated charges will hit your accounts in the next 7 days. `;
      }

      brief += `\n\n${debtInsight}`;
      
      setAiSummary(brief);
      setAiLoading(false);
    }, 1200); 
  };

  const getTabTheme = () => {
    if (activeTab === 'subscriptions') return { color: 'var(--neon-blue)', bg: 'rgba(10, 132, 255, 0.15)', label: 'Subscription' };
    if (activeTab === 'bills') return { color: 'var(--neon-orange)', bg: 'rgba(255, 159, 10, 0.15)', label: 'Recurring Bill' };
    return { color: 'var(--neon-purple)', bg: 'rgba(191, 90, 242, 0.15)', label: 'Debt Record' };
  };
  const theme = getTabTheme();

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
          <span style={{ fontSize: '22px', fontWeight: '700' }}>CashCue</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <div className="nav-item" onClick={() => navigate('/dashboard')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</div>

          <div className="nav-item" onClick={() => navigate('/budgets')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Budgets</div>

          <div className="nav-item active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> Autopilot</div>

          <div className="nav-item" onClick={() => navigate('/portfolio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>

          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>

          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>

          <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
        </nav>
        <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)', marginTop: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <h2>Autopilot Command</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: '12px' }}>
                {['subscriptions', 'bills', 'debts'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => { setActiveTab(tab); setIsFormOpen(false); }} 
                    style={{ 
                      background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent', 
                      color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                      textTransform: 'capitalize'
                    }}
                  >
                    {tab === 'debts' ? 'Debt Tracker' : tab}
                  </button>
                ))}
              </div>

              {!isFormOpen ? (
                <button className="btn-action" style={{ color: theme.color, backgroundColor: theme.bg }} onClick={openForm}>
                  <span style={{ fontSize: '18px' }}>+</span> Add {theme.label}
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            
            <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(10, 132, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                </div>
                <h3 className="card-subtitle" style={{ margin: 0 }}>Monthly Cashflow Baseline</h3>
              </div>
              <p style={{ fontSize: '42px', fontWeight: '700', letterSpacing: '-1px', color: 'var(--text-primary)', marginBottom: '24px' }}>{settings?.currency || '$'}{totalMonthlyCommitment.toFixed(0)}</p>
              
              <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-input)', marginBottom: '16px' }}>
                 <div style={{ width: isMounted ? `${(subMonthly / totalMonthlyCommitment) * 100}%` : '0%', backgroundColor: 'var(--neon-blue)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                 <div style={{ width: isMounted ? `${(billMonthly / totalMonthlyCommitment) * 100}%` : '0%', backgroundColor: 'var(--neon-orange)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                 <div style={{ width: isMounted ? `${(debtMonthlyEstimate / totalMonthlyCommitment) * 100}%` : '0%', backgroundColor: 'var(--neon-purple)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--neon-blue)'}}></div><span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)'}}>Subs ({settings?.currency || '$'}{subMonthly.toFixed(0)})</span></div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--neon-orange)'}}></div><span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)'}}>Bills ({settings?.currency || '$'}{billMonthly.toFixed(0)})</span></div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--neon-purple)'}}></div><span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)'}}>Debts ({settings?.currency || '$'}{debtMonthlyEstimate.toFixed(0)})</span></div>
              </div>
            </div>

            <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                 <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(50, 215, 75, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                 </div>
                 <h3 className="card-subtitle" style={{ margin: 0 }}>AI Diagnostics</h3>
              </div>
              
              {!aiSummary ? (
                <div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>Scan your active repo of data for upcoming warnings and cashflow bottlenecks.</p>
                  <button onClick={generateAIBrief} disabled={aiLoading} className="btn-secondary" style={{ color: 'var(--neon-green)', borderColor: 'var(--neon-green)' }}>
                    {aiLoading ? 'Analyzing Repo...' : 'Generate Financial Brief'}
                  </button>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', borderLeft: '3px solid var(--neon-green)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>{aiSummary}</p>
                </div>
              )}
            </div>
          </div>

          {isFormOpen && (
            <form className="card" style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px', border: `1px solid ${theme.color}`, opacity: isSubmitting ? 0.6 : 1, transform: isSubmitting ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s ease' }} onSubmit={handleSubmit}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.color }}>New {activeTab.slice(0, -1)}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                
                {/* --- SUBSCRIPTIONS --- */}
                {activeTab === 'subscriptions' && (
                  <>
                    <input type="text" placeholder="Service Name (e.g. Netflix)" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isSubmitting} />
                    <input type="number" step="0.01" placeholder={`Price (${settings?.currency || '$'})`} required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} disabled={isSubmitting} />
                    <select value={formData.cycle} onChange={e => setFormData({...formData, cycle: e.target.value})} disabled={isSubmitting}>
                      <option value="Monthly">Monthly</option><option value="Yearly">Yearly</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Renews:</span>
                      <input type="date" required value={formData.nextPaymentDate} onChange={e => setFormData({...formData, nextPaymentDate: e.target.value})} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0' }} disabled={isSubmitting} />
                    </div>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0 8px 0 16px' }}>
                      <input 
                        type="text" 
                        placeholder="Custom Tag or Select →" 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0', fontSize: '14px', width: '100%' }}
                        disabled={isSubmitting}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                        style={{ background: showCategoryMenu ? 'var(--text-primary)' : 'transparent', color: showCategoryMenu ? '#000' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                        disabled={isSubmitting}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                      
                      {showCategoryMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', minWidth: '220px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', marginBottom: '4px' }}>Dashboard Templates</span>
                          {PREDEFINED_CATEGORIES.map(cat => (
                             <button
                               key={cat}
                               type="button"
                               onClick={() => { setFormData({...formData, category: cat}); setShowCategoryMenu(false); }}
                               style={{ textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.2s' }}
                               onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                               onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                             >
                               {cat}
                             </button>
                          ))}
                          {settings?.categoryTags?.filter(t => t.type !== 'Income').length > 0 && (
                            <>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', marginBottom: '4px' }}>My Custom Tags</span>
                              {settings.categoryTags.filter(t => t.type !== 'Income').map(tag => (
                                 <button
                                   key={tag.id}
                                   type="button"
                                   onClick={() => { setFormData({...formData, category: tag.name}); setShowCategoryMenu(false); }}
                                   style={{ textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.2s' }}
                                   onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                   onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                 >
                                   {tag.name} ({tag.type})
                                 </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontSize: '14px' }}>
                      <input type="checkbox" checked={formData.autoPay} onChange={e => setFormData({...formData, autoPay: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: theme.color }} disabled={isSubmitting}/>
                      Auto-Pay Enabled
                    </label>
                  </>
                )}

                {/* --- BILLS --- */}
                {activeTab === 'bills' && (
                  <>
                    <input type="text" placeholder="Bill Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isSubmitting} />
                    <input type="number" step="0.01" placeholder={`Amount (${settings?.currency || '$'})`} required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} disabled={isSubmitting} />
                    <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} disabled={isSubmitting}>
                      <option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Yearly">Yearly</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Due:</span>
                      <input type="date" required value={formData.nextDueDate} onChange={e => setFormData({...formData, nextDueDate: e.target.value})} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0' }} disabled={isSubmitting} />
                    </div>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0 8px 0 16px' }}>
                      <input 
                        type="text" 
                        placeholder="Custom Tag or Select →" 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0', fontSize: '14px', width: '100%' }}
                        disabled={isSubmitting}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                        style={{ background: showCategoryMenu ? 'var(--text-primary)' : 'transparent', color: showCategoryMenu ? '#000' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                        disabled={isSubmitting}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                      
                      {showCategoryMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', minWidth: '220px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', marginBottom: '4px' }}>Dashboard Templates</span>
                          {PREDEFINED_CATEGORIES.map(cat => (
                             <button
                               key={cat}
                               type="button"
                               onClick={() => { setFormData({...formData, category: cat}); setShowCategoryMenu(false); }}
                               style={{ textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.2s' }}
                               onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                               onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                             >
                               {cat}
                             </button>
                          ))}
                          {settings?.categoryTags?.filter(t => t.type !== 'Income').length > 0 && (
                            <>
                              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', marginBottom: '4px' }}>My Custom Tags</span>
                              {settings.categoryTags.filter(t => t.type !== 'Income').map(tag => (
                                 <button
                                   key={tag.id}
                                   type="button"
                                   onClick={() => { setFormData({...formData, category: tag.name}); setShowCategoryMenu(false); }}
                                   style={{ textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', transition: 'background 0.2s' }}
                                   onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                   onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                 >
                                   {tag.name} ({tag.type})
                                 </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontSize: '14px' }}>
                      <input type="checkbox" checked={formData.autoPay} onChange={e => setFormData({...formData, autoPay: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: theme.color }} disabled={isSubmitting}/>
                      Auto-Pay Enabled
                    </label>
                  </>
                )}

                {/* --- DEBTS --- */}
                {activeTab === 'debts' && (
                  <>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} disabled={isSubmitting}>
                      <option value="BORROWED">I Borrowed Money</option><option value="LENT">I Lent Money</option>
                    </select>
                    <input type="text" placeholder="Entity Name" required value={formData.personName} onChange={e => setFormData({...formData, personName: e.target.value})} disabled={isSubmitting} />
                    <input type="number" step="0.01" placeholder={`Total Amount (${settings?.currency || '$'})`} required value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} disabled={isSubmitting} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Target Date:</span>
                      <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: 'var(--text-primary)', padding: '12px 0' }} disabled={isSubmitting} />
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Save Entry'}</button>
              </div>
            </form>
          )}

          {/* --- TAB 1: SUBSCRIPTIONS --- */}
          {activeTab === 'subscriptions' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {data.subscriptions.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No active subscriptions.</p>}
              {data.subscriptions.map(sub => {
                const tagColor = getHashColor(sub.category);
                const isDue = isPastDue(sub.nextPaymentDate); 
                const isSoon = isUpcoming(sub.nextPaymentDate); 
                const isProcessing = processingId === sub.id;

                return (
                  <div key={sub.id} className="card" style={{ padding: '24px', borderTop: `4px solid ${tagColor}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge" style={{ backgroundColor: `${tagColor}15`, color: tagColor, fontSize: '11px', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                          {sub.category || 'General'}
                        </span>
                        {sub.autoPay && <span className="badge" style={{ backgroundColor: 'var(--neon-green)', color: 'var(--bg-main)', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>AUTO-PAY</span>}
                        {isDue && <span className="badge" style={{ backgroundColor: 'var(--neon-pink)', color: 'var(--bg-main)', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>DUE</span>}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isDue && !sub.autoPay && (
                          <button className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleApprove(sub.id, 'sub')} disabled={isProcessing}>
                            {isProcessing ? '...' : 'Approve'}
                          </button>
                        )}
                        <button className="btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleDelete(sub.id, 'subscriptions')} disabled={isProcessing}>
                           {isProcessing ? '...' : 'Stop'}
                        </button>
                      </div>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>{sub.name}</h3>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>
                      {settings?.currency || '$'}{sub.price.toFixed(2)} <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>/ {sub.cycle.toLowerCase()}</span>
                    </p>
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Renews on</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: isDue ? 'var(--neon-pink)' : isSoon ? 'var(--neon-orange)' : 'var(--text-primary)' }}>{new Date(sub.nextPaymentDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* --- TAB 2: RECURRING BILLS --- */}
          {activeTab === 'bills' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
               {data.bills.length === 0 && <p style={{ color: 'var(--text-secondary)', padding: '32px', textAlign: 'center' }}>No recurring bills.</p>}
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {data.bills.map((bill, index) => {
                   const tagColor = getHashColor(bill.category);
                   const isDue = isPastDue(bill.nextDueDate); 
                   const isSoon = isUpcoming(bill.nextDueDate); 
                   const isProcessing = processingId === bill.id;

                   return (
                     <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderTop: index !== 0 ? '1px solid var(--border-color)' : 'none', opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.3s ease', backgroundColor: isProcessing ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: `${tagColor}15`, color: tagColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                         </div>
                         <div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                             <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{bill.name}</p>
                             <span className="badge" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>{bill.category || 'General'}</span>
                             {bill.autoPay && <span className="badge" style={{ backgroundColor: 'var(--neon-green)', color: 'var(--bg-main)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>AUTO-PAY</span>}
                             {isDue && <span className="badge" style={{ backgroundColor: 'var(--neon-pink)', color: 'var(--bg-main)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>DUE</span>}
                           </div>
                           <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bill.frequency}</span>
                         </div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{settings?.currency || '$'}{bill.amount.toFixed(2)}</p>
                            <p style={{ fontSize: '13px', color: isDue ? 'var(--neon-pink)' : isSoon ? 'var(--neon-orange)' : 'var(--text-secondary)', margin: 0, fontWeight: (isDue || isSoon) ? '600' : '400' }}>
                              {isDue ? 'DUE TODAY' : `Due ${new Date(bill.nextDueDate).toLocaleDateString()}`}
                            </p>
                          </div>
                          
                          {isDue && !bill.autoPay && (
                            <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => handleApprove(bill.id, 'bill')} disabled={isProcessing}>
                              {isProcessing ? '...' : 'Approve'}
                            </button>
                          )}
                          <button className="btn-danger" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => handleDelete(bill.id, 'bills')} disabled={isProcessing}>
                            {isProcessing ? '...' : 'Delete'}
                          </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}

          {/* --- TAB 3: DEBT TRACKER --- */}
          {activeTab === 'debts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {data.debts.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No active debts.</p>}
              {data.debts.map(debt => {
                const isLent = debt.type === 'LENT';
                const statusColor = isLent ? 'var(--neon-green)' : 'var(--neon-pink)';
                const percent = Math.min((debt.amountPaid / debt.totalAmount) * 100, 100);
                const isSettled = percent === 100;
                
                const isDue = debt.dueDate ? isPastDue(debt.dueDate) : false; 
                const isSoon = debt.dueDate ? isUpcoming(debt.dueDate) : false; 
                const isProcessing = processingId === debt.id;

                return (
                  <div key={debt.id} className="card" style={{ padding: '32px', borderLeft: `4px solid ${statusColor}`, opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                      <div>
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                           <span className="badge" style={{ backgroundColor: isLent ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 55, 95, 0.15)', color: statusColor, fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                             {isLent ? 'LENT TO' : 'BORROWED FROM'}
                           </span>
                           {isDue && !isSettled && <span className="badge" style={{ backgroundColor: 'var(--neon-pink)', color: 'var(--bg-main)', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>DUE</span>}
                         </div>
                         <h4 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{debt.personName}</h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{debt.amountPaid.toFixed(2)}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}> / {settings?.currency || '$'}{debt.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                      <div style={{ height: '100%', backgroundColor: statusColor, width: isMounted ? `${percent}%` : '0%', borderRadius: '6px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: isSettled ? 'var(--neon-green)' : isDue ? 'var(--neon-pink)' : isSoon ? 'var(--neon-orange)' : 'var(--text-secondary)' }}>
                        {isSettled ? 'Fully Settled 🎉' : isDue ? `Target Date Reached - ${settings?.currency || '$'}${(debt.totalAmount - debt.amountPaid).toFixed(2)} remaining` : isSoon ? `Approaching Target - ${settings?.currency || '$'}${(debt.totalAmount - debt.amountPaid).toFixed(2)} remaining` : `${settings?.currency || '$'}${(debt.totalAmount - debt.amountPaid).toFixed(2)} remaining`}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                         {activePaymentId === debt.id && !isSettled ? (
                           <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '4px', borderRadius: '8px' }}>
                             <input type="number" placeholder="Amt" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '80px', padding: '6px 8px', fontSize: '13px', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }} disabled={isProcessing} />
                             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleLogPayment(debt.id)} disabled={isProcessing}>{isProcessing ? '...' : 'Log'}</button>
                             <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setActivePaymentId(null); setPaymentAmount(''); }} disabled={isProcessing}>Cancel</button>
                           </div>
                         ) : !isSettled && (
                           <>
                             {isDue && <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleApprove(debt.id, 'debt')} disabled={isProcessing}>{isProcessing ? 'Processing...' : 'Approve Full Payload'}</button>}
                             <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setActivePaymentId(debt.id)} disabled={isProcessing}>Log Payment</button>
                           </>
                         )}
                         <button className="btn-danger" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleDelete(debt.id, 'debts')} disabled={isProcessing}>
                           {isProcessing ? '...' : 'Delete'}
                         </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}