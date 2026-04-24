import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';

const APPLE_COLORS = ['#FF375F', '#0A84FF', '#FF9F0A', '#32D74B', '#BF5AF2', '#5E5CE6', '#FFD60A'];

const getCategoryColor = (category) => {
  if (category === 'Housing') return '#FF9F0A'; 
  if (category === 'Transportation') return '#0A84FF'; 
  if (category === 'Food') return '#32D74B'; 
  if (category === 'Entertainment') return '#FF375F'; 
  if (category === 'Utilities') return '#BF5AF2'; 
  if (category === 'Other Expense') return '#5E5CE6'; 
  
  if (category === 'Salary') return '#32D74B'; 
  if (category === 'Freelance') return '#0A84FF'; 
  if (category === 'Investments') return '#BF5AF2'; 
  if (category === 'Other Income') return '#FFD60A'; 
  
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return APPLE_COLORS[Math.abs(hash) % APPLE_COLORS.length];
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Housing': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
    case 'Food': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>;
    case 'Transportation': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v-2a2 2 0 0 1 2-2h2"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle><line x1="5" y1="17" x2="2" y2="17"></line><line x1="22" y1="17" x2="19" y2="17"></line><path d="M3 12v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"></path></svg>;
    case 'Entertainment': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>;
    case 'Utilities': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
    default: return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
  }
};

export default function Budgets() {
  const { settings } = useSettings();
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]); 
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ category: 'Utilities', limit: '' });

  const [showFilter, setShowFilter] = useState(false);
  const [ringSelection, setRingSelection] = useState([]); 

  const [isMounted, setIsMounted] = useState(false);
  
  // --- ANIMATION STATES ---
  const [processingId, setProcessingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 100);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();

        const [budgetRes, txRes] = await Promise.all([
          axios.get('https://cashcue-api.onrender.com/api/budgets', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('https://cashcue-api.onrender.com/api/transactions', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        setBudgets(budgetRes.data);
        setTransactions(txRes.data);
      } catch (error) {
        console.error(error);
        if (error.response?.status === 401) handleLogout();
      }
    };
    fetchData();

    return () => clearTimeout(t);
  }, []);

  const computedBudgets = budgets.map(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === b.category)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return { ...b, spent }; 
  });

  const totalBudgeted = computedBudgets.reduce((sum, b) => sum + parseFloat(b.limit), 0);
  const totalSpent = computedBudgets.reduce((sum, b) => sum + parseFloat(b.spent), 0);
  const totalRemaining = totalBudgeted - totalSpent;

  let displayRings = [];
  if (ringSelection.length > 0) {
    displayRings = computedBudgets.filter(b => ringSelection.includes(b.id));
  } else {
    displayRings = [...computedBudgets].sort((a, b) => b.limit - a.limit).slice(0, 3);
  }

  const ringsSpent = displayRings.reduce((s, b) => s + b.spent, 0);
  const ringsLimit = displayRings.reduce((s, b) => s + b.limit, 0);
  const ringsPercentage = ringsLimit > 0 ? Math.round((ringsSpent / ringsLimit) * 100) : 0;

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('https://cashcue-api.onrender.com/api/budgets', {
        category: formData.category,
        limit: parseFloat(formData.limit)
      }, { headers: { Authorization: `Bearer ${token}` } });

      setTimeout(() => {
        setBudgets([res.data, ...budgets]);
        setIsFormOpen(false);
        setFormData({ category: 'Utilities', limit: '' });
        setIsSubmitting(false);
      }, 400); // 400ms delay for animation
    } catch (error) {
      setIsSubmitting(false);
      alert(error.response?.data?.message || "Failed to save budget.");
    }
  };

  const handleDelete = async (id) => { 
    if (!window.confirm("Delete this budget limit?")) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://cashcue-api.onrender.com/api/budgets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setBudgets(budgets.filter(b => b.id !== id));
        setRingSelection(ringSelection.filter(selectedId => selectedId !== id));
        setProcessingId(null);
      }, 400); // 400ms delay for fade out
    } catch (error) {
      setProcessingId(null);
      alert("Failed to delete budget.");
    }
  };

  const toggleRingSelection = (id) => {
    if (ringSelection.includes(id)) {
      setRingSelection(ringSelection.filter(item => item !== id));
    } else {
      if (ringSelection.length >= 3) return alert("You can only track 3 categories in the rings.");
      setRingSelection([...ringSelection, id]);
    }
  };

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

          <div className="nav-item active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Budgets</div>

          <div className="nav-item" onClick={() => navigate('/autopilot')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg> Autopilot</div>

          <div className="nav-item" onClick={() => navigate('/portfolio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>

          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>

          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>

          <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Settings</div>
        </nav>
        <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)', marginTop: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <h2>Monthly Budgets</h2>
            {!isFormOpen ? (
              <button className="btn-action" style={{ color: 'var(--neon-blue)', backgroundColor: 'rgba(10, 132, 255, 0.15)' }} onClick={() => setIsFormOpen(true)}>
                <span style={{ fontSize: '18px' }}>+</span> New Budget
              </button>
            ) : (
              <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
            )}
          </div>

          {isFormOpen && (
            <form className="card" style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px', border: `1px solid var(--neon-blue)`, opacity: isSubmitting ? 0.6 : 1, transform: isSubmitting ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }} onSubmit={handleSaveBudget}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--neon-blue)' }}>Set Category Limit</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} disabled={isSubmitting}>
                  <optgroup label="Default Categories">
                    <option value="Housing">Housing</option><option value="Food">Food & Dining</option>
                    <option value="Transportation">Transportation</option><option value="Entertainment">Entertainment</option>
                    <option value="Utilities">Utilities & Bills</option><option value="Other Expense">Other Expense</option>
                  </optgroup>
                  {settings?.categoryTags?.filter(t => t.type !== 'Income').length > 0 && (
                    <optgroup label="My Custom Tags">
                      {settings.categoryTags.filter(t => t.type !== 'Income').map(tag => (
                        <option key={tag.id} value={tag.name}>{tag.name} ({tag.type})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <input type="number" step="1" placeholder={`Maximum Limit (${settings?.currency || '$'})`} required value={formData.limit} onChange={e => setFormData({...formData, limit: e.target.value})} disabled={isSubmitting} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Save Budget'}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="card" style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(10, 132, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  </div>
                  <p className="card-subtitle" style={{ margin: 0 }}>Total Budgeted</p>
                </div>
                <p style={{ fontSize: '42px', fontWeight: '700', letterSpacing: '-1px', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{totalBudgeted.toLocaleString()}</p>
              </div>

              <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
                <div className="card" style={{ flex: 1, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 55, 95, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-pink)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                    </div>
                    <p className="card-subtitle" style={{ margin: 0 }}>Spent</p>
                  </div>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{totalSpent.toLocaleString()}</p>
                </div>

                <div className="card" style={{ flex: 1, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(50, 215, 75, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <p className="card-subtitle" style={{ margin: 0 }}>Remaining</p>
                  </div>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: totalRemaining >= 0 ? 'var(--neon-green)' : 'var(--neon-pink)' }}>
                    {settings?.currency || '$'}{Math.abs(totalRemaining).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '32px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(191, 90, 242, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-purple)' }}>
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                     </div>
                     <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Active Tracking</h3>
                   </div>

                   <div style={{ position: 'relative' }}>
                     <button 
                       onClick={() => setShowFilter(!showFilter)} 
                       style={{ background: showFilter ? 'var(--text-primary)' : 'var(--bg-elevated)', color: showFilter ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '12px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                     >
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                     </button>
                     
                     {showFilter && (
                       <div style={{ position: 'absolute', top: '50px', right: '0', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', minWidth: '240px', zIndex: 10, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                         <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracked in Rings (Max 3)</p>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                           {computedBudgets.map(b => (
                             <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>
                               <input 
                                 type="checkbox" 
                                 checked={ringSelection.length > 0 ? ringSelection.includes(b.id) : displayRings.find(r => r.id === b.id) !== undefined}
                                 onChange={() => toggleRingSelection(b.id)}
                                 style={{ width: '16px', height: '16px', accentColor: getCategoryColor(b.category), cursor: 'pointer' }}
                               />
                               <span style={{ flex: 1 }}>{b.category}</span>
                             </label>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flex: 1, width: '100%' }}>
                  <div style={{ width: '200px', height: '200px', position: 'relative' }}>
                    <svg viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      {displayRings.map((b, index) => {
                        const radius = 85 - (index * 22); 
                        const circumference = 2 * Math.PI * radius;
                        const percent = Math.min(b.spent / b.limit, 1);
                        const offset = circumference - (percent * circumference);
                        const color = getCategoryColor(b.category);

                        return (
                          <g key={b.id}>
                            <circle cx="100" cy="100" r={radius} stroke="var(--bg-elevated)" strokeWidth="14" fill="none" />
                            <circle cx="100" cy="100" r={radius} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isMounted ? offset : circumference} style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                          </g>
                        );
                      })}
                    </svg>
                    
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                        <path d="M7 15h.01"></path>
                        <path d="M11 15h2"></path>
                      </svg>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '160px' }}>
                     {displayRings.map((b) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getCategoryColor(b.category) }} /> 
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{b.category}</p>
                            <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0}% Consumed
                            </p>
                          </div>
                        </div>
                     ))}
                     
                     <div style={{ marginTop: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tracked</p>
                         <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{ringsPercentage}%</p>
                       </div>
                     </div>
                  </div>
                </div>

            </div>
          </div>

          <div className="card" style={{ padding: '32px' }}>
            
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255, 159, 10, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-orange)' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Master List</h3>
                <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{settings?.currency || '$'}{totalBudgeted.toLocaleString()}</p>
              </div>
            </div>

            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Allocation</p>

            <div style={{ display: 'flex', gap: '4px', height: '24px', width: '100%', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
              {computedBudgets.map(b => (
                <div key={b.id} style={{ width: isMounted ? `${(b.limit / totalBudgeted) * 100}%` : '0%', backgroundColor: getCategoryColor(b.category), transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} title={b.category} />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {computedBudgets.length === 0 && (
                 <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No budgets set yet. Click "New Budget" to begin.</p>
              )}
              {computedBudgets.map((b, index) => {
                const percent = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
                const remaining = b.limit - b.spent;
                const color = getCategoryColor(b.category);
                const isOver = remaining < 0;
                const isProcessing = processingId === b.id;

                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 16px', borderTop: index !== 0 ? '1px solid var(--border-color)' : 'none', borderRadius: '12px', transition: 'all 0.3s ease', opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.98)' : 'scale(1)' }} onMouseEnter={e => !isProcessing && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')} onMouseLeave={e => !isProcessing && (e.currentTarget.style.backgroundColor = 'transparent')}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                       <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
                          {getCategoryIcon(b.category)}
                       </div>
                       
                       <div>
                          <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{b.category}</p>
                          <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--neon-pink)', marginTop: '4px' }}>
                            -{settings?.currency || '$'}{b.spent.toLocaleString()} spent
                          </p>
                       </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '24px' }}>
                       <div>
                         <p style={{ fontSize: '16px', fontWeight: '600', color: isOver ? 'var(--neon-pink)' : 'var(--neon-green)' }}>
                            {settings?.currency || '$'}{isOver ? 0 : remaining.toLocaleString()} ({percent.toFixed(1)}%)
                         </p>
                         <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Budget {settings?.currency || '$'}{b.limit.toLocaleString()}
                         </p>
                       </div>
                       <button className="btn-danger" style={{ fontSize: '13px', padding: '8px', opacity: 0.7 }} onClick={() => handleDelete(b.id)} disabled={isProcessing}>
                         {isProcessing ? '...' : 'Delete'}
                       </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}