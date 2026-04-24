import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const APPLE_COLORS = ['#FF375F', '#0A84FF', '#FF9F0A', '#32D74B', '#BF5AF2', '#5E5CE6', '#FFD60A'];

const PREDEFINED_EXPENSES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Utilities', 'Borrowed From', 'Other Expense'];
const PREDEFINED_INCOME = ['Salary', 'Freelance', 'Investments', 'Lent To', 'Other Income'];

const getCategoryColor = (category) => {
  if (category === 'Housing') return '#FF9F0A'; 
  if (category === 'Transportation') return '#0A84FF'; 
  if (category === 'Food') return '#32D74B'; 
  if (category === 'Entertainment') return '#FF375F'; 
  if (category === 'Utilities') return '#BF5AF2'; 
  if (category === 'Borrowed From') return '#FF375F'; 
  if (category === 'Other Expense') return '#5E5CE6'; 
  
  if (category === 'Salary') return '#32D74B'; 
  if (category === 'Freelance') return '#0A84FF'; 
  if (category === 'Investments') return '#BF5AF2'; 
  if (category === 'Lent To') return '#32D74B'; 
  if (category === 'Other Income') return '#FFD60A'; 
  
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return APPLE_COLORS[Math.abs(hash) % APPLE_COLORS.length];
};

export default function Dashboard() {
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState([]);
  const [autopilotData, setAutopilotData] = useState({ subscriptions: [], bills: [], debts: [] }); 
  
  const [formType, setFormType] = useState('none'); 
  const [formData, setFormData] = useState({ name: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'General' });
  
  const [chartMode, setChartMode] = useState('expense'); 
  const [chartView, setChartView] = useState('overview'); 
  const [activeCategory, setActiveCategory] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showLedgerFilter, setShowLedgerFilter] = useState(false);
  const [ledgerFilterType, setLedgerFilterType] = useState('expense'); 
  const [ledgerSelectedCategory, setLedgerSelectedCategory] = useState('All');
  
  const [ledgerSelectedMonth, setLedgerSelectedMonth] = useState('All');

  // --- ANIMATION STATES ---
  const [processingId, setProcessingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchEcosystem = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        
        const [txRes, autoRes] = await Promise.all([
          axios.get('http://localhost:3000/api/transactions', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/autopilot', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        setTransactions(txRes.data);
        setAutopilotData(autoRes.data);
      } catch (error) {
        if (error.response?.status === 401) handleLogout();
      }
    };
    fetchEcosystem();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { ...formData, type: formType, amount: parseFloat(formData.amount) };
      const res = await axios.post('http://localhost:3000/api/transactions', payload, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setTransactions([res.data, ...transactions]); 
        handleCloseForm();
        setIsSubmitting(false);
      }, 400); // 400ms delay to allow animation
    } catch (error) { 
      setIsSubmitting(false);
      alert("Failed to save transaction."); 
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this transaction?")) return;
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/transactions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      
      setTimeout(() => {
        setTransactions(transactions.filter(t => t.id !== id));
        setProcessingId(null);
      }, 400); // 400ms delay for fade out
    } catch (error) { 
      setProcessingId(null);
      alert("Failed to delete transaction."); 
    }
  };

  const handleOpenForm = (type) => { setFormType(type); setFormData({ ...formData, category: type === 'income' ? 'Salary' : 'Housing' }); };
  const handleCloseForm = () => { setFormType('none'); setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'General' }); };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runInc = 0, runExp = 0, runBal = 0;
  const incomeTrend = [], expenseTrend = [], balanceTrend = [];
  
  sortedTx.forEach(t => {
    const amt = parseFloat(t.amount);
    if (t.type === 'income') { runInc += amt; runBal += amt; incomeTrend.push({ val: runInc }); } 
    else { runExp += amt; runBal -= amt; expenseTrend.push({ val: runExp }); }
    balanceTrend.push({ val: runBal });
  });
  
  if (incomeTrend.length === 0) incomeTrend.push({val: 0});
  if (expenseTrend.length === 0) expenseTrend.push({val: 0});
  if (balanceTrend.length === 0) balanceTrend.push({val: 0});

  const getMonthlyStats = (type) => {
    const now = new Date();
    const currM = now.getMonth(); const currY = now.getFullYear();
    const prevM = currM === 0 ? 11 : currM - 1; const prevY = currM === 0 ? currY - 1 : currY;

    const currTotal = transactions.filter(t => { const d = new Date(t.date); return t.type === type && d.getMonth() === currM && d.getFullYear() === currY; }).reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const prevTotal = transactions.filter(t => { const d = new Date(t.date); return t.type === type && d.getMonth() === prevM && d.getFullYear() === prevY; }).reduce((sum, t) => sum + parseFloat(t.amount), 0);

    if (prevTotal === 0) return { text: "No prior data", color: "var(--text-secondary)", icon: null };
    const diff = currTotal - prevTotal; const percent = Math.abs((diff / prevTotal) * 100).toFixed(1);
    
    const isUp = diff >= 0; const isGood = type === 'expense' ? !isUp : isUp;
    const color = isGood ? 'var(--neon-green)' : 'var(--neon-pink)';
    const icon = isUp 
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>;
    return { text: `${percent}% from last month`, color, icon };
  };

  const getBalanceStats = () => {
    const now = new Date();
    const currM = now.getMonth(); const currY = now.getFullYear();
    const prevM = currM === 0 ? 11 : currM - 1; const prevY = currM === 0 ? currY - 1 : currY;

    const currInc = transactions.filter(t => t.type === 'income' && new Date(t.date).getMonth() === currM && new Date(t.date).getFullYear() === currY).reduce((s, t) => s + parseFloat(t.amount), 0);
    const currExp = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currM && new Date(t.date).getFullYear() === currY).reduce((s, t) => s + parseFloat(t.amount), 0);
    const currNet = currInc - currExp;

    const prevInc = transactions.filter(t => t.type === 'income' && new Date(t.date).getMonth() === prevM && new Date(t.date).getFullYear() === prevY).reduce((s, t) => s + parseFloat(t.amount), 0);
    const prevExp = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === prevM && new Date(t.date).getFullYear() === prevY).reduce((s, t) => s + parseFloat(t.amount), 0);
    const prevNet = prevInc - prevExp;

    if (prevNet === 0) return { text: "No prior data", color: "var(--text-secondary)", icon: null };
    const diff = currNet - prevNet; const percent = Math.abs((diff / prevNet) * 100).toFixed(1);
    const isUp = diff >= 0; const color = isUp ? 'var(--neon-green)' : 'var(--neon-pink)';
    
    const icon = isUp 
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>;
    return { text: `${percent}% from last month`, color, icon };
  };

  const incomeStats = getMonthlyStats('income'); 
  const expenseStats = getMonthlyStats('expense'); 
  const balanceStats = getBalanceStats();

  const unifiedTransactions = [...transactions];

  autopilotData.subscriptions.forEach(sub => {
    unifiedTransactions.push({
      id: `auto-${sub.id}`,
      name: sub.name,
      category: PREDEFINED_EXPENSES.includes(sub.category) ? sub.category : 'Other Expense',
      amount: sub.cycle === 'Yearly' ? sub.price / 12 : sub.price,
      type: 'expense'
    });
  });

  autopilotData.bills.forEach(bill => {
    let monthlyAmt = bill.amount;
    if (bill.frequency === 'Yearly') monthlyAmt = bill.amount / 12;
    if (bill.frequency === 'Quarterly') monthlyAmt = bill.amount / 3;
    unifiedTransactions.push({
      id: `auto-${bill.id}`,
      name: bill.name,
      category: PREDEFINED_EXPENSES.includes(bill.category) ? bill.category : 'Other Expense',
      amount: monthlyAmt,
      type: 'expense'
    });
  });

  autopilotData.debts.forEach(debt => {
    const remaining = debt.totalAmount - debt.amountPaid;
    if (remaining > 0) {
      if (debt.type === 'BORROWED') {
        unifiedTransactions.push({ id: `auto-${debt.id}`, name: debt.personName, category: 'Borrowed From', amount: remaining / 12, type: 'expense' });
      } else if (debt.type === 'LENT') {
        unifiedTransactions.push({ id: `auto-${debt.id}`, name: debt.personName, category: 'Lent To', amount: remaining / 12, type: 'income' });
      }
    }
  });

  const filteredChartTransactions = unifiedTransactions.filter(t => t.type === chartMode);
  let chartData = [], chartCenterValue = 0, chartCenterLabel = '';

  if (chartView === 'overview') {
    const categoryMap = filteredChartTransactions.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount); return acc; }, {});
    chartData = Object.keys(categoryMap).map(key => ({ name: key, value: categoryMap[key] })).sort((a, b) => b.value - a.value); 
    chartCenterValue = chartData.reduce((sum, item) => sum + item.value, 0); 
    chartCenterLabel = chartMode === 'expense' ? 'Unified Expenses' : 'Unified Income';
  } else if (chartView === 'detail' && activeCategory) {
    const specificData = filteredChartTransactions.filter(t => t.category === activeCategory);
    const itemMap = specificData.reduce((acc, t) => { acc[t.name] = (acc[t.name] || 0) + parseFloat(t.amount); return acc; }, {});
    chartData = Object.keys(itemMap).map(key => ({ name: key, value: itemMap[key] })).sort((a, b) => b.value - a.value);
    chartCenterValue = chartData.reduce((sum, item) => sum + item.value, 0); 
    chartCenterLabel = `${activeCategory} Total`;
  }

  const handleSliceClick = (data) => { if (chartView === 'overview') { setActiveCategory(data.name); setChartView('detail'); } };
  const handleBackToOverview = () => { setChartView('overview'); setActiveCategory(null); };

  const availableMonths = [...new Set(transactions.map(t => {
    const d = new Date(t.date);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }))].sort((a, b) => new Date(b) - new Date(a));

  const filteredLedgerTx = transactions.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = t.name.toLowerCase().includes(searchLower) || 
                          t.amount.toString().includes(searchLower) ||
                          t.category.toLowerCase().includes(searchLower);
                          
    const matchesCategory = ledgerSelectedCategory === 'All' ? true : t.category === ledgerSelectedCategory;
    
    const txMonthYear = new Date(t.date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const matchesMonth = ledgerSelectedMonth === 'All' ? true : txMonthYear === ledgerSelectedMonth;

    return matchesSearch && matchesCategory && matchesMonth;
  });

  const descendingTx = [...filteredLedgerTx].sort((a, b) => new Date(b.date) - new Date(a.date));
  const clusteredLedger = descendingTx.reduce((acc, t) => {
    const dateObj = new Date(t.date);
    const monthYear = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(t);
    return acc;
  }, {});

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#cashcue-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="cashcue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--neon-blue)" /><stop offset="100%" stopColor="var(--neon-purple)" />
              </linearGradient>
            </defs>
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><rect x="16" y="14" width="4" height="4" rx="1" fill="var(--neon-blue)" stroke="none" />
          </svg>
          <span style={{ fontSize: '22px', fontWeight: '700' }}>CashCue</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <div className="nav-item active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard</div>
          <div className="nav-item" onClick={() => navigate('/budgets')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Budgets</div>
          <div className="nav-item" onClick={() => navigate('/autopilot')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg> Autopilot</div>
          <div className="nav-item" onClick={() => navigate('/portfolio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>
          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>
          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>

          <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
       
        </nav>

        <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)', marginTop: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <h2>Dashboard</h2>
            {formType === 'none' ? (
              <div style={{ display: 'flex', gap: '16px' }}>
                <button className="btn-action" style={{ color: 'var(--neon-green)', backgroundColor: 'rgba(50, 215, 75, 0.15)' }} onClick={() => handleOpenForm('income')}>
                  <span style={{ fontSize: '18px' }}>+</span> Add Income
                </button>
                <button className="btn-action" style={{ color: 'var(--neon-pink)', backgroundColor: 'rgba(255, 55, 95, 0.15)' }} onClick={() => handleOpenForm('expense')}>
                  <span style={{ fontSize: '18px' }}>+</span> Add Expense
                </button>
              </div>
            ) : (
              <button className="btn-secondary" onClick={handleCloseForm}>Cancel Entry</button>
            )}
          </div>

          {formType !== 'none' && (
            <form className="card" style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px', border: `1px solid ${formType === 'income' ? 'var(--neon-green)' : 'var(--neon-pink)'}`, opacity: isSubmitting ? 0.6 : 1, transform: isSubmitting ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s' }} onSubmit={handleSubmit}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: formType === 'income' ? 'var(--neon-green)' : 'var(--neon-pink)' }}>New {formType === 'income' ? 'Income' : 'Expense'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                <input type="text" placeholder="Description" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isSubmitting} />
                <input type="number" step="0.01" placeholder={`Amount (${settings?.currency || '$'})`} required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} disabled={isSubmitting} />
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} disabled={isSubmitting} />
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} disabled={isSubmitting}>
                  {formType === 'income' ? (
                    <>
                      <optgroup label="Default Income">
                        <option value="Salary">Salary / Paycheck</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Investments">Investments</option>
                        <option value="Lent To">Lent To (Debt)</option>
                        <option value="Other Income">Other Income</option>
                      </optgroup>
                      {settings?.categoryTags?.filter(t => t.type === 'Income').length > 0 && (
                        <optgroup label="My Custom Tags">
                          {settings.categoryTags.filter(t => t.type === 'Income').map(tag => (
                            <option key={tag.id} value={tag.name}>{tag.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      <optgroup label="Default Expenses">
                        <option value="Housing">Housing</option>
                        <option value="Food">Food & Dining</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Utilities">Utilities & Bills</option>
                        <option value="Borrowed From">Borrowed From (Debt)</option>
                        <option value="Other Expense">Other Expense</option>
                      </optgroup>
                      {settings?.categoryTags?.filter(t => t.type !== 'Income').length > 0 && (
                        <optgroup label="My Custom Tags">
                          {settings.categoryTags.filter(t => t.type !== 'Income').map(tag => (
                            <option key={tag.id} value={tag.name}>{tag.name} ({tag.type})</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" style={{ background: formType === 'income' ? 'var(--neon-green)' : 'var(--neon-pink)' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
            <div className="card stat-card" style={{ padding: '24px' }}>
              <div className="stat-header">
                <p className="card-subtitle">Current Balance</p>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(10, 132, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
              </div>
              <p className="stat-value">{settings?.currency || '$'}{netBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            
            <div className="card stat-card" style={{ padding: '24px' }}>
              <div className="stat-header">
                <p className="card-subtitle">Actual Income</p>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(50, 215, 75, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                </div>
              </div>
              <p className="stat-value" style={{ color: 'var(--neon-green)' }}>{settings?.currency || '$'}{totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            
            <div className="card stat-card" style={{ padding: '24px' }}>
              <div className="stat-header">
                <p className="card-subtitle">Actual Expenses</p>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 55, 95, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-pink)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                </div>
              </div>
              <p className="stat-value" style={{ color: 'var(--neon-pink)' }}>{settings?.currency || '$'}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px', width: '100%' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '0' }}>
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ zIndex: 2, position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <p className="card-subtitle" style={{ margin: 0 }}>Net Balance</p>
                      </div>
                      <p style={{ fontSize: '48px', fontWeight: '700', letterSpacing: '-1px', color: netBalance >= 0 ? 'var(--text-primary)' : 'var(--neon-pink)', marginBottom: '12px' }}>
                        {settings?.currency || '$'}{netBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: balanceStats.color, fontSize: '14px', fontWeight: '600' }}>
                        {balanceStats.icon} {balanceStats.text}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: '-10px', left: 0, right: 0, height: '100px', opacity: 0.25, zIndex: 1 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceTrend}><Area type="monotone" dataKey="val" stroke="var(--neon-blue)" fill="var(--neon-blue)" strokeWidth={3} /></AreaChart>
                      </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
                    <div className="card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ zIndex: 2, position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(50, 215, 75, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                            </div>
                            <p className="card-subtitle" style={{ margin: 0 }}>Income</p>
                          </div>
                          <p style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-primary)', marginBottom: '8px' }}>{settings?.currency || '$'}{totalIncome.toFixed(0)}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: incomeStats.color, fontSize: '13px', fontWeight: '600' }}>
                            {incomeStats.icon} {incomeStats.text}
                          </div>
                        </div>
                        <div style={{ position: 'absolute', bottom: '-5px', left: 0, right: 0, height: '60px', opacity: 0.15, zIndex: 1 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={incomeTrend}><Area type="monotone" dataKey="val" stroke="var(--neon-green)" fill="var(--neon-green)" strokeWidth={3} /></AreaChart>
                          </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ zIndex: 2, position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 55, 95, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-pink)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                            </div>
                            <p className="card-subtitle" style={{ margin: 0 }}>Expenses</p>
                          </div>
                          <p style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-primary)', marginBottom: '8px' }}>{settings?.currency || '$'}{totalExpenses.toFixed(0)}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: expenseStats.color, fontSize: '13px', fontWeight: '600' }}>
                            {expenseStats.icon} {expenseStats.text}
                          </div>
                        </div>
                        <div style={{ position: 'absolute', bottom: '-5px', left: 0, right: 0, height: '60px', opacity: 0.15, zIndex: 1 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={expenseTrend}><Area type="monotone" dataKey="val" stroke="var(--neon-pink)" fill="var(--neon-pink)" strokeWidth={3} /></AreaChart>
                          </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {chartMode === 'expense' ? (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255, 55, 95, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-pink)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      </div>
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(50, 215, 75, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                      </div>
                    )}
                    <h3 style={{ fontSize: '20px', fontWeight: '700' }}>
                      {chartView === 'overview' ? (chartMode === 'expense' ? 'Unified Expenses' : 'Unified Income') : `${activeCategory} Breakdown`}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {chartView === 'detail' ? (
                       <button className="btn-secondary" onClick={handleBackToOverview}>← Back</button>
                    ) : (
                       <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: '12px' }}>
                         <button 
                            onClick={() => { setChartMode('expense'); setChartView('overview'); setActiveCategory(null); }} 
                            style={{ background: chartMode === 'expense' ? 'var(--bg-elevated)' : 'transparent', color: chartMode === 'expense' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: chartMode === 'expense' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                         >Expenses</button>
                         <button 
                            onClick={() => { setChartMode('income'); setChartView('overview'); setActiveCategory(null); }} 
                            style={{ background: chartMode === 'income' ? 'var(--bg-elevated)' : 'transparent', color: chartMode === 'income' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: chartMode === 'income' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                         >Income</button>
                       </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, height: '280px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <p style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{chartCenterValue.toFixed(0)}</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '4px' }}>{chartCenterLabel}</p>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={90} outerRadius={120} paddingAngle={4} dataKey="value" stroke="none" onClick={(data) => handleSliceClick(data)} style={{ cursor: chartView === 'overview' ? 'pointer' : 'default' }}>
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getCategoryColor(chartView === 'overview' ? entry.name : activeCategory)} />)}
                        </Pie>
                        <Tooltip formatter={(val) => `${settings?.currency || '$'}${val.toFixed(2)}`} contentStyle={{ background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, paddingLeft: '40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {chartData.map((entry, index) => {
                        const itemColor = getCategoryColor(chartView === 'overview' ? entry.name : activeCategory);
                        return (
                          <div key={index} onClick={() => handleSliceClick(entry)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', cursor: chartView === 'overview' ? 'pointer' : 'default' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '5px', backgroundColor: itemColor }} />
                              <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>{entry.name}</span>
                            </div>
                            <div style={{ flex: 1, borderBottom: '1px dashed rgba(255,255,255,0.15)', margin: '0 24px', transform: 'translateY(2px)' }}></div>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{settings?.currency || '$'}{entry.value.toFixed(2)}</span>
                          </div>
                        )
                    })}
                  </div>
                </div>
            </div>
          </div>

          <div className="card">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Recent Ledger</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input 
                    type="text" 
                    placeholder="Search ledger..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px 12px 8px 36px', color: 'var(--text-primary)', fontSize: '14px', width: '220px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit' }}
                  />
                </div>

                <select
                  value={ledgerSelectedMonth}
                  onChange={e => setLedgerSelectedMonth(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                >
                  <option value="All">All Months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div style={{ position: 'relative' }}>
                   <button 
                     onClick={() => setShowLedgerFilter(!showLedgerFilter)}
                     style={{ background: showLedgerFilter || ledgerSelectedCategory !== 'All' ? 'var(--text-primary)' : 'var(--bg-elevated)', color: showLedgerFilter || ledgerSelectedCategory !== 'All' ? '#000' : 'var(--text-primary)', border: `1px solid ${ledgerSelectedCategory !== 'All' ? 'transparent' : 'var(--border-color)'}`, padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                   >
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                   </button>
                   
                   {showLedgerFilter && (
                     <div style={{ position: 'absolute', top: '44px', right: '0', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', minWidth: '240px', zIndex: 10, boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                        
                        <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: '10px', marginBottom: '16px' }}>
                          <button 
                            onClick={() => { setLedgerFilterType('expense'); setLedgerSelectedCategory('All'); }} 
                            style={{ flex: 1, background: ledgerFilterType === 'expense' ? 'var(--bg-elevated)' : 'transparent', color: ledgerFilterType === 'expense' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', padding: '6px 0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: ledgerFilterType === 'expense' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                          >Expenses</button>
                          <button 
                            onClick={() => { setLedgerFilterType('income'); setLedgerSelectedCategory('All'); }} 
                            style={{ flex: 1, background: ledgerFilterType === 'income' ? 'var(--bg-elevated)' : 'transparent', color: ledgerFilterType === 'income' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', padding: '6px 0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: ledgerFilterType === 'income' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                          >Income</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button 
                            onClick={() => { setLedgerSelectedCategory('All'); setShowLedgerFilter(false); }}
                            style={{ textAlign: 'left', background: 'none', border: 'none', color: ledgerSelectedCategory === 'All' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: ledgerSelectedCategory === 'All' ? '600' : '500', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', backgroundColor: ledgerSelectedCategory === 'All' ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                          >All Categories</button>
                          
                          {(ledgerFilterType === 'expense' 
                            ? [...PREDEFINED_EXPENSES, ...(settings?.categoryTags?.filter(t => t.type !== 'Income').map(t => t.name) || [])]
                            : [...PREDEFINED_INCOME, ...(settings?.categoryTags?.filter(t => t.type === 'Income').map(t => t.name) || [])]
                          ).map(cat => (
                            <button 
                              key={cat}
                              onClick={() => { setLedgerSelectedCategory(cat); setShowLedgerFilter(false); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', background: 'none', border: 'none', color: ledgerSelectedCategory === cat ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: ledgerSelectedCategory === cat ? '600' : '500', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', backgroundColor: ledgerSelectedCategory === cat ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                            >
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getCategoryColor(cat) }}></div>
                              {cat}
                            </button>
                          ))}
                        </div>
                     </div>
                   )}
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {Object.entries(clusteredLedger).length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No transactions match your search.</p>}
                
                {Object.entries(clusteredLedger).map(([monthYear, txs]) => (
                  <div key={monthYear} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', marginTop: '12px' }}>
                      <h4 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{monthYear}</h4>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 100%)' }}></div>
                    </div>
                    {txs.map(t => {
                      const badgeColor = getCategoryColor(t.category);
                      const isProcessing = processingId === t.id;
                      
                      return (
                        <div className="sub-item" key={t.id} style={{ opacity: isProcessing ? 0.5 : 1, transform: isProcessing ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.3s ease' }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)' }}>{t.name}</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', marginTop: '6px' }}>{new Date(t.date).toLocaleDateString()}</p>
                            </div>
                            
                            <div style={{ flex: 1, textAlign: 'center' }}>
                              <span className="badge" style={{ backgroundColor: `${badgeColor}25`, color: badgeColor, padding: '6px 14px' }}>
                                {t.category}
                              </span>
                            </div>
                            
                            <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px' }}>
                                <p style={{ fontSize: '18px', fontWeight: '700', color: t.type === 'income' ? 'var(--neon-green)' : 'var(--text-primary)' }}>{t.type === 'income' ? '+' : '-'}{settings?.currency || '$'}{t.amount.toFixed(2)}</p>
                                <button className="btn-danger" onClick={() => handleDelete(t.id)} disabled={isProcessing}>
                                  {isProcessing ? '...' : 'Trash'}
                                </button>
                            </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}