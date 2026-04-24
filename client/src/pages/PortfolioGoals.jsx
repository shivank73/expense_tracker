import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useSettings } from '../context/SettingsContext';

const GOAL_COLORS = ['#0A84FF', '#32D74B', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF'];
const PIE_COLORS = ['#0A84FF', '#BF5AF2', '#FF9F0A', '#32D74B', '#FF375F'];
const CATEGORIES = ['Real Estate', 'Vehicle', 'Travel', 'Emergency', 'Retirement', 'Education', 'General'];

const VaultIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="21" width="18" height="2"/><path d="M3 7h18"/><path d="M12 2 3 7h18Z"/><path d="M6 21V11"/><path d="M10 21V11"/><path d="M14 21V11"/><path d="M18 21V11"/></svg>);
const MarketIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);

export default function PortfolioGoals() {
  const { settings } = useSettings();
  const [goals, setGoals] = useState([]);
  const [fundingSources, setFundingSources] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', targetAmount: '', deadline: '', category: 'Real Estate', color: GOAL_COLORS[0],
    monthlyContribution: '', initialAllocationId: '', initialAllocationAmount: '', unit: 'FIXED'
  });

  const [allocator, setAllocator] = useState({ goalId: null, sourceId: '', amount: '', mode: 'DEPOSIT', unit: 'FIXED' });
  const [selectedAnalyticsId, setSelectedAnalyticsId] = useState('');

  const navigate = useNavigate();
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        
        const fetchGoals = axios.get('http://localhost:3000/api/goals', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }));
        const fetchAssets = axios.get('http://localhost:3000/api/portfolio', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { assets: [] } }));
        const fetchHoldings = axios.get('http://localhost:3000/api/portfolio/holdings', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }));

        const [goalsRes, assetsRes, holdingsRes] = await Promise.all([fetchGoals, fetchAssets, fetchHoldings]);
        
        const fetchedGoals = Array.isArray(goalsRes.data) ? goalsRes.data : [];
        setGoals(fetchedGoals);
        if (fetchedGoals.length > 0 && !selectedAnalyticsId) setSelectedAnalyticsId(fetchedGoals[0].id);
        
        const rawAssets = Array.isArray(assetsRes.data) ? assetsRes.data : (assetsRes.data?.assets || []);
        const rawHoldings = Array.isArray(holdingsRes.data) ? holdingsRes.data : (holdingsRes.data?.holdings || []);
        
        const liquid = rawAssets.filter(a => a.type === 'BANK' || a.type === 'CASH').map(a => ({ ...a, pipeType: 'ASSET' }));
        const market = rawHoldings.map(h => ({ ...h, pipeType: 'HOLDING', name: h.symbol || 'Unknown Asset', currentValue: (h.quantity || 0) * (h.currentPrice || 0) }));
        
        setFundingSources([...liquid, ...market]);
      } catch (error) { if (error.response?.status === 401) handleLogout(); }
    };
    fetchData();
  }, []);

  // --- THE SHADOW LEDGER ENGINE ---
  const allocatedBySource = {};
  goals.forEach(g => {
    g.allocations?.forEach(a => {
      allocatedBySource[a.sourceId] = (allocatedBySource[a.sourceId] || 0) + a.amount;
    });
  });

  const shadowSources = fundingSources.map(src => {
    const allocated = allocatedBySource[src.id] || 0;
    const shadowBalance = Math.max(0, src.currentValue - allocated);
    return { ...src, shadowBalance };
  });

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setProcessingId('create');
    try {
      const token = localStorage.getItem('token');
      const payload = { ...formData };
      
      if (formData.initialAllocationId && formData.initialAllocationAmount) {
        const selectedSource = shadowSources.find(s => s.id === formData.initialAllocationId);
        if (selectedSource) {
          let finalAmount = parseFloat(formData.initialAllocationAmount);
          if (formData.unit === 'PERCENT') finalAmount = (finalAmount / 100) * selectedSource.currentValue;
          
          if (finalAmount > selectedSource.shadowBalance) {
            alert(`Insufficient Sandbox Funds. You only have ${settings?.currency || '$'}${selectedSource.shadowBalance.toFixed(2)} available to allocate from ${selectedSource.name}.`);
            setProcessingId(null); return;
          }
          payload.initialAllocation = { type: selectedSource.pipeType, id: selectedSource.id, amount: finalAmount };
        }
      }

      const res = await axios.post('http://localhost:3000/api/goals', payload, { headers: { Authorization: `Bearer ${token}` } });
      const freshGoals = await axios.get('http://localhost:3000/api/goals', { headers: { Authorization: `Bearer ${token}` } });
      setGoals(Array.isArray(freshGoals.data) ? freshGoals.data : []);
      
      if (!selectedAnalyticsId) setSelectedAnalyticsId(res.data.id);
      setIsFormOpen(false);
      setFormData({ name: '', targetAmount: '', deadline: '', category: 'Real Estate', color: GOAL_COLORS[0], monthlyContribution: '', initialAllocationId: '', initialAllocationAmount: '', unit: 'FIXED' });
    } catch (error) { alert('Failed to construct goal.'); }
    setProcessingId(null);
  };

  const handleAllocation = async (goalId, targetAmount, currentAmount) => {
    if (!allocator.sourceId || !allocator.amount) return;
    const selectedSource = shadowSources.find(s => s.id === allocator.sourceId);
    if (!selectedSource) return;

    let finalAmount = parseFloat(allocator.amount);
    if (allocator.unit === 'PERCENT') finalAmount = (finalAmount / 100) * selectedSource.currentValue;

    if (allocator.mode === 'DEPOSIT') {
      if (finalAmount > selectedSource.shadowBalance) return alert(`Insufficient Sandbox Funds. You only have ${settings?.currency || '$'}${selectedSource.shadowBalance.toFixed(2)} available.`);
      if (currentAmount + finalAmount > targetAmount) return alert(`This exceeds your goal target by ${settings?.currency || '$'}${((currentAmount + finalAmount) - targetAmount).toLocaleString()}.`);
    } else if (allocator.mode === 'RECLAIM') {
      finalAmount = -Math.abs(finalAmount); 
      if (Math.abs(finalAmount) > currentAmount) return alert(`You cannot reclaim more than the ${settings?.currency || '$'}${currentAmount.toLocaleString()} saved.`);
    }

    setProcessingId(goalId);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3000/api/goals/${goalId}/inject`, { sourceType: selectedSource.pipeType, sourceId: allocator.sourceId, amount: finalAmount }, { headers: { Authorization: `Bearer ${token}` } });
      
      const res = await axios.get('http://localhost:3000/api/goals', { headers: { Authorization: `Bearer ${token}` } });
      const newGoals = Array.isArray(res.data) ? res.data : [];
      setGoals(newGoals);
      
      if(selectedAnalyticsId === goalId) setSelectedAnalyticsId(goalId);
      setAllocator({ goalId: null, sourceId: '', amount: '', mode: 'DEPOSIT', unit: 'FIXED' });
    } catch (error) { alert('Allocation transaction failed.'); }
    setTimeout(() => setProcessingId(null), 300);
  };

  const toggleLock = async (goalId, currentLockState) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:3000/api/goals/${goalId}/lock`, { isLocked: !currentLockState }, { headers: { Authorization: `Bearer ${token}` } });
      setGoals(goals.map(g => g.id === goalId ? { ...g, isLocked: !currentLockState } : g));
    } catch (error) {}
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm("Drop this milestone? Capital remains safely in your Portfolio.")) return;
    setProcessingId(goalId);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/goals/${goalId}`, { headers: { Authorization: `Bearer ${token}` } });
      const newGoals = goals.filter(g => g.id !== goalId);
      setGoals(newGoals);
      if (selectedAnalyticsId === goalId) setSelectedAnalyticsId(newGoals[0]?.id || '');
    } catch (error) {}
    setProcessingId(null);
  };

  const totalTarget = goals.reduce((s, g) => s + (Number(g.targetAmount) || 0), 0);
  const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
  const unallocatedCapital = shadowSources.reduce((s, f) => s + f.shadowBalance, 0);
  const timelineGoals = [...goals].filter(g => g.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  let availableAssetsData = shadowSources.map(src => ({
    name: src.name, value: src.shadowBalance || 0
  })).filter(item => item.value > 0).sort((a,b) => b.value - a.value);

  if (availableAssetsData.length > 4) {
    const top4 = availableAssetsData.slice(0, 4);
    const otherVal = availableAssetsData.slice(4).reduce((sum, item) => sum + item.value, 0);
    availableAssetsData = [...top4, { name: 'Other Assets', value: otherVal }];
  }

  // --- TRAJECTORY MATH (SLIDER REMOVED) ---
  const analyticsGoal = goals.find(g => g.id === selectedAnalyticsId);
  const trajectoryData = [];
  
  if (analyticsGoal) {
    const velocity = analyticsGoal.monthlyContribution || 0;
    let renderMonths = 24; 
    
    if (analyticsGoal.deadline) {
       const ms = new Date(analyticsGoal.deadline).getTime() - new Date().getTime();
       const mosToDeadline = Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.4));
       if (mosToDeadline > 0) renderMonths = Math.min(mosToDeadline, 60); 
    }

    for(let i=0; i<=renderMonths; i++) {
       trajectoryData.push({ 
         month: `M${i}`, 
         Projected: Math.min(analyticsGoal.currentAmount + (velocity * i), analyticsGoal.targetAmount) 
       });
    }
  }

  const getSourceIcon = (sourceId) => {
    const src = shadowSources.find(s => s.id === sourceId);
    if (!src) return null;
    return src.pipeType === 'HOLDING' ? <MarketIcon /> : <VaultIcon />;
  };

  return (
    <div className="app-layout">
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
          <div className="nav-item" onClick={() => navigate('/portfolio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Portfolio</div>
          <div className="nav-item" onClick={() => navigate('/insights')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>
          <div className="nav-item active" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="nav-item" onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               
               <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
                 <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <polygon points="12 2 22 12 12 22 2 12" fill="rgba(191, 90, 242, 0.15)" stroke="var(--neon-purple)" />
                   <polygon points="12 6 18 12 12 18 6 12" fill="var(--neon-blue)" stroke="none" />
                 </svg>
               </div>

               <div>
                 <h2 style={{ margin: '0 0 4px 0', fontWeight: '600' }}>Milestones Engine</h2>
                 <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{settings?.currency || '$'}{totalSaved.toLocaleString()} locked of {settings?.currency || '$'}{totalTarget.toLocaleString()} global target.</p>
               </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'default' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-green)' }}></span>
                <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Unallocated Pool</span>
                <span style={{ fontSize: '15px', fontWeight: '800' }}>{settings?.currency || '$'}{unallocatedCapital.toLocaleString()}</span>
              </button>
              
              <button className="btn-action" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }} onClick={() => setIsFormOpen(!isFormOpen)}>
                {isFormOpen ? 'Close Builder' : '+ New Milestone'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', marginBottom: '24px' }}>
            
            <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Projected Horizon</h3>
              {timelineGoals.length > 0 ? (
                <div style={{ position: 'relative', height: '60px', display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ position: 'absolute', left: '0', right: '0', height: '0', borderTop: '2px dashed var(--border-color)', zIndex: 1 }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2, padding: '0 10px' }}>
                    {timelineGoals.map(goal => (
                      <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
                        <div style={{ padding: '4px 12px', borderRadius: '16px', background: 'var(--bg-input)', border: `2px solid ${goal.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: goal.color }}></span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{goal.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>No active deadlines mapped on the horizon.</p>
              )}
            </div>

            <div className="card" style={{ padding: '24px 24px 32px 24px', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '12px', margin: '0 0 8px 0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Available Assets</h3>
              <div style={{ flex: 1, position: 'relative', minHeight: '180px' }}>
                {availableAssetsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={availableAssetsData} cx="50%" cy="40%" innerRadius={45} outerRadius={65} stroke="none" dataKey="value" animationDuration={1200} animationEasing="ease-out" paddingAngle={2}>
                        {availableAssetsData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ fontWeight: '700' }} formatter={(val) => `${settings?.currency || '$'}${val.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '600', paddingTop: '0px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>No assets available.</div>
                )}
              </div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', marginBottom: '40px' }}>
            <div className="card" style={{ padding: '32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <h3 style={{ fontSize: '14px', margin: '0 0 8px 0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Goal Summary</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', maxHeight: '200px', paddingRight: '8px' }}>
                 {goals.map(g => {
                    const percent = g.targetAmount > 0 ? Math.min(((g.currentAmount || 0) / g.targetAmount) * 100, 100) : 0;
                    return (
                      <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{g.name} <span style={{color:'var(--text-secondary)', fontWeight:'400'}}>({Math.floor(percent)}%)</span></span>
                          <span style={{ color: 'var(--text-secondary)' }}>{g.deadline ? new Date(g.deadline).toLocaleDateString(undefined, {month:'short', year:'numeric'}) : 'No Target'}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                           <div style={{ width: `${percent}%`, height: '100%', background: g.color, borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                        </div>
                      </div>
                    )
                 })}
                 {goals.length === 0 && <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>No goals constructed.</span>}
               </div>
            </div>

            <div className="card" style={{ padding: '32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                 <h3 style={{ fontSize: '14px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Trajectory Analytics</h3>
                 <select value={selectedAnalyticsId} onChange={e => setSelectedAnalyticsId(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                 </select>
               </div>

               <div style={{ flex: 1, minHeight: '150px' }}>
                 {analyticsGoal ? (
                   <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={trajectoryData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                         <defs>
                           <linearGradient id={`color-${analyticsGoal.id}`} x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor={analyticsGoal.color} stopOpacity={0.4}/>
                             <stop offset="95%" stopColor={analyticsGoal.color} stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                         <XAxis dataKey="month" hide />
                         <YAxis hide domain={[0, analyticsGoal.targetAmount]} />
                         <RechartsTooltip contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ color: analyticsGoal.color, fontWeight: '700' }} labelStyle={{ display: 'none' }} formatter={(value) => [`${settings?.currency || '$'}${value.toLocaleString()}`, 'Projected']}/>
                         <Area type="monotone" dataKey="Projected" stroke={analyticsGoal.color} strokeWidth={3} fillOpacity={1} fill={`url(#color-${analyticsGoal.id})`} isAnimationActive={false} />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                 ) : (
                   <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>Select a goal to view trajectory.</div>
                 )}
               </div>
            </div>
          </div>

          {isFormOpen && (
            <form className="card" style={{ marginBottom: '40px', padding: '32px', background: 'var(--bg-elevated)', borderTop: `3px solid ${formData.color}`, transition: 'all 0.3s' }} onSubmit={handleCreateGoal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>Construct Target</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                   {GOAL_COLORS.map(c => (
                     <div key={c} onClick={() => setFormData({...formData, color: c})} style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: c, cursor: 'pointer', border: formData.color === c ? '2px solid #fff' : '2px solid transparent', transition: 'all 0.2s' }}></div>
                   ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Goal Title</label>
                  <input type="text" placeholder="e.g. Dream Home" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Category</label>
                  <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-primary)', outline: 'none' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Target ({settings?.currency || '$'})</label>
                  <input type="number" required value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Deadline</label>
                  <input type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '13px 14px', color: 'var(--text-primary)', colorScheme: 'dark', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Velocity ({settings?.currency || '$'}/mo)</label>
                  <input type="number" placeholder="Drives Projections" value={formData.monthlyContribution} onChange={e => setFormData({...formData, monthlyContribution: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-primary)', outline: 'none' }} />
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Initial Fractional Injection</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                        {getSourceIcon(formData.initialAllocationId)}
                      </div>
                      <select value={formData.initialAllocationId} onChange={e => setFormData({...formData, initialAllocationId: e.target.value})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 14px 14px 36px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}>
                        <option value="">Select Source...</option>
                        {shadowSources.map(a => <option key={a.id} value={a.id}>{a.name} ({settings?.currency || '$'}{Number(a.shadowBalance || 0).toLocaleString()})</option>)}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '150px' }}>
                       <button type="button" onClick={() => setFormData({...formData, unit: formData.unit === 'FIXED' ? 'PERCENT' : 'FIXED'})} style={{ padding: '0 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer', borderRight: '1px solid var(--border-color)' }}>
                         {formData.unit === 'FIXED' ? settings?.currency || '$' : '%'}
                       </button>
                       <input type="number" placeholder="0.00" value={formData.initialAllocationAmount} onChange={e => setFormData({...formData, initialAllocationAmount: e.target.value})} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', padding: '14px 10px', outline: 'none' }} />
                    </div>
                  </div>
                  {formData.unit === 'PERCENT' && formData.initialAllocationAmount && formData.initialAllocationId && (
                     <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                       ({formData.initialAllocationAmount}% limit ≈ {settings?.currency || '$'}{(parseFloat(formData.initialAllocationAmount) / 100 * shadowSources.find(s => s.id === formData.initialAllocationId).currentValue).toLocaleString()})
                     </span>
                  )}
                 </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={processingId === 'create'} style={{ background: formData.color, padding: '14px 32px', fontSize: '14px', fontWeight: '700', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  {processingId === 'create' ? 'Constructing...' : 'Launch Target'}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            {goals.map(goal => {
              const currentAmount = goal.currentAmount || 0;
              const percent = goal.targetAmount > 0 ? Math.min((currentAmount / goal.targetAmount) * 100, 100) : 0;
              
              const radius = 64;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (percent / 100) * circumference;

              let etaDateString = "No ETA";
              let isUrgent = false;

              if (goal.monthlyContribution > 0 && goal.remainingDelta > 0) {
                const projectedMonths = Math.ceil(goal.remainingDelta / goal.monthlyContribution);
                const d = new Date(); d.setMonth(d.getMonth() + projectedMonths);
                etaDateString = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
              } else if (goal.remainingDelta <= 0) {
                etaDateString = "COMPLETED";
              }

              if (goal.deadline) {
                 const timeDiff = new Date(goal.deadline).getTime() - new Date().getTime();
                 const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                 if (daysLeft <= 30 && daysLeft >= 0) isUrgent = true;
              }

              const isProcessing = processingId === goal.id;

              return (
              <div key={goal.id} className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--bg-elevated)', border: `1px solid var(--border-color)`, opacity: isProcessing ? 0.6 : 1, transform: isProcessing ? 'scale(0.99)' : 'scale(1)', transition: 'all 0.3s ease-out' }}>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                   <div>
                     <h3 style={{ fontSize: '20px', margin: '0 0 8px 0', fontWeight: '700' }}>{goal.name}</h3>
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>{goal.category}</span>
                       
                       {goal.deadline && (
                         <span style={{ 
                           fontSize: '12px', fontWeight: '600', 
                           color: isUrgent ? 'var(--neon-pink)' : (goal.isOnTrack ? 'var(--text-primary)' : 'var(--text-secondary)'), 
                           background: isUrgent ? 'rgba(255, 55, 95, 0.1)' : 'transparent',
                           border: isUrgent ? '1px solid rgba(255, 55, 95, 0.2)' : '1px solid transparent',
                           padding: '4px 10px', borderRadius: '4px' 
                         }}>
                           Target: {new Date(goal.deadline).toLocaleDateString()}
                         </span>
                       )}
                     </div>
                   </div>
                   
                   <div style={{ display: 'flex', gap: '16px' }}>
                     <button onClick={() => toggleLock(goal.id, goal.isLocked)} style={{ background: 'transparent', border: 'none', color: goal.isLocked ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                       {goal.isLocked ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0"></path></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>}
                     </button>
                     <button onClick={() => !goal.isLocked && handleDelete(goal.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: goal.isLocked ? 'not-allowed' : 'pointer', opacity: goal.isLocked ? 0.3 : 1 }}>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                     </button>
                   </div>
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '32px' }}>
                    <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth="10" />
                        <circle cx="70" cy="70" r={radius} fill="none" stroke={goal.color} strokeWidth="10" strokeLinecap="square" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} transform="rotate(-90 70 70)" />
                        <rect x="126" y="66" width="8" height="8" fill="var(--bg-input)" stroke={percent >= 25 ? goal.color : 'var(--bg-elevated)'} strokeWidth="2" />
                        <rect x="66" y="126" width="8" height="8" fill="var(--bg-input)" stroke={percent >= 50 ? goal.color : 'var(--bg-elevated)'} strokeWidth="2" />
                        <rect x="6" y="66" width="8" height="8" fill="var(--bg-input)" stroke={percent >= 75 ? goal.color : 'var(--bg-elevated)'} strokeWidth="2" />
                        <rect x="66" y="6" width="8" height="8" fill="var(--bg-input)" stroke={percent >= 100 ? goal.color : 'var(--bg-elevated)'} strokeWidth="2" />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{Math.floor(percent)}%</p>
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', margin: '0 0 4px 0' }}>Saved Capital</p>
                      <p style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{settings?.currency || '$'}{currentAmount.toLocaleString()}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target</span>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{settings?.currency || '$'}{goal.targetAmount.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ETA</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: goal.color }}>{etaDateString}</span>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   {goal.allocations?.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px' }}>
                       {goal.allocations.map(alloc => {
                         const source = shadowSources.find(s => s.id === alloc.sourceId);
                         const isVolatile = alloc.sourceType === 'HOLDING';
                         return (
                           <span key={alloc.id} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '6px', background: isVolatile ? 'rgba(255, 159, 10, 0.12)' : 'rgba(10, 132, 255, 0.12)', color: isVolatile ? '#FF9F0A' : '#0A84FF', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                             {isVolatile ? <MarketIcon/> : <VaultIcon/>} {source ? source.name : 'Asset'} <span style={{ opacity: 0.6 }}>|</span> {settings?.currency || '$'}{alloc.amount.toLocaleString()}
                           </span>
                         );
                       })}
                     </div>
                   )}

                   {allocator.goalId === goal.id ? (
                      <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: `1px solid var(--border-color)` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                           <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '4px' }}>
                             <button onClick={() => setAllocator({...allocator, mode: 'DEPOSIT'})} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '4px', cursor: 'pointer', background: allocator.mode === 'DEPOSIT' ? goal.color : 'transparent', color: allocator.mode === 'DEPOSIT' ? '#fff' : 'var(--text-secondary)' }}>Deposit</button>
                             <button onClick={() => setAllocator({...allocator, mode: 'RECLAIM'})} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '4px', cursor: 'pointer', background: allocator.mode === 'RECLAIM' ? 'var(--text-primary)' : 'transparent', color: allocator.mode === 'RECLAIM' ? 'var(--bg-elevated)' : 'var(--text-secondary)' }}>Withdraw</button>
                           </div>
                           <button onClick={() => setAllocator({ goalId: null, sourceId: '', amount: '', mode: 'DEPOSIT', unit: 'FIXED' })} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                          
                          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <div style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                              {getSourceIcon(allocator.sourceId)}
                            </div>
                            <select value={allocator.sourceId} onChange={e => setAllocator({...allocator, sourceId: e.target.value})} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', padding: '14px 14px 14px 36px', outline: 'none', appearance: 'none' }}>
                              <option value="">Select Source...</option>
                              {shadowSources.map(a => <option key={a.id} value={a.id}>{a.name} ({settings?.currency || '$'}{Number(a.shadowBalance||0).toLocaleString()})</option>)}
                            </select>
                          </div>
                          
                          <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '140px' }}>
                             <button onClick={() => setAllocator({...allocator, unit: allocator.unit === 'FIXED' ? 'PERCENT' : 'FIXED'})} style={{ padding: '0 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer', borderRight: '1px solid var(--border-color)' }}>
                               {allocator.unit === 'FIXED' ? settings?.currency || '$' : '%'}
                             </button>
                             <input type="number" placeholder="0.00" value={allocator.amount} onChange={e=>setAllocator({...allocator, amount: e.target.value})} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', padding: '14px 10px', outline: 'none' }}/>
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px', minHeight: '16px' }}>
                           {allocator.unit === 'PERCENT' && allocator.amount && allocator.sourceId && (
                             <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                               ({allocator.amount}% limit ≈ {settings?.currency || '$'}{(parseFloat(allocator.amount) / 100 * shadowSources.find(s => s.id === allocator.sourceId).currentValue).toLocaleString()})
                             </span>
                           )}
                        </div>
                        
                        <button onClick={() => handleAllocation(goal.id, goal.targetAmount, currentAmount)} disabled={isProcessing} style={{ width: '100%', background: goal.color, color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}>
                          {isProcessing ? 'Processing Ledger...' : `Confirm Transaction`}
                        </button>
                      </div>
                   ) : (
                      <button onClick={() => { if(!goal.isLocked) setAllocator({...allocator, goalId: goal.id}); }} style={{ width: '100%', padding: '16px', borderRadius: '10px', background: goal.isLocked ? 'transparent' : goal.color, border: goal.isLocked ? '1px solid var(--border-color)' : 'none', color: goal.isLocked ? 'var(--text-secondary)' : '#fff', fontSize: '14px', fontWeight: '700', cursor: goal.isLocked ? 'not-allowed' : 'pointer' }}>
                        {goal.isLocked ? 'Ledger Locked' : 'Manage Allocation Ledger'}
                      </button>
                   )}
                 </div>

              </div>
            )})}
          </div>

        </div>
      </main>
    </div>
  );
}