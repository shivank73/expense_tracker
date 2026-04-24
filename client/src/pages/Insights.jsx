import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

export default function Insights() {
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return handleLogout();
        const res = await axios.get('http://localhost:3000/api/insights/phase1', { headers: { Authorization: `Bearer ${token}` } });
        setInsights(res.data);
      } catch (error) {
        if (error.response?.status === 401) handleLogout();
        setError(true);
      }
    };
    fetchInsights();
  }, []);

  const isStrength = insights?.swot?.savingsRate >= 0.20; 
  const isWeakness = insights?.swot?.fixedToIncomeRatio > 0.40; 
  const isOpportunity = insights?.swot?.inflationDragAmount > 50; 
  const isThreat = insights?.swot?.isLifestyleCreepActive; 

  const volData = insights ? [
    { name: 'Stable Cash', value: insights.volatility.stableValue, color: '#32D74B' },
    { name: 'Market Exposed', value: insights.volatility.volatileValue, color: '#FF9F0A' }
  ].filter(d => d.value > 0) : [];

  const flatCardStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column'
  };

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
          <div className="nav-item active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg> Insights</div>
          <div className="nav-item" onClick={() => navigate('/goals')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Goals</div>
          <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => navigate('/settings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings</div>
        </nav>
        <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--neon-pink)', marginTop: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log Out</div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px' }}>
          
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '32px', letterSpacing: '-0.5px' }}>Intelligence Engine</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Real-time analytical evaluation of your financial architecture.</p>
          </div>

          {error ? (
             <div style={{...flatCardStyle, textAlign: 'center', border: '1px solid rgba(255, 55, 95, 0.3)' }}>
               <h3 style={{ color: 'var(--neon-pink)', marginBottom: '8px' }}>Ledger Connection Failed</h3>
               <p style={{ color: 'var(--text-secondary)', margin: 0 }}>The intelligence engine could not sync with the master database.</p>
             </div>
          ) : !insights ? (
             <div style={{ display: 'flex', height: '40vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
               Compiling Intelligence...
             </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              <div style={flatCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(10, 132, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-blue)', border: '1px solid rgba(10,132,255,0.1)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', margin: '0 0 4px 0', color: 'var(--text-primary)', fontWeight: '700' }}>Lifestyle Creep Trajectory</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Tracking historical income growth versus discretionary wants spending.</p>
                  </div>
                </div>

                <div style={{ width: '100%', height: '360px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={insights.lifestyleCurve} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--neon-green)" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="var(--neon-green)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorWants" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--neon-pink)" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="var(--neon-pink)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{fontSize: 12, fill: 'var(--text-secondary)'}} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="rgba(255,255,255,0.3)" tick={{fontSize: 12, fill: 'var(--text-secondary)'}} tickLine={false} axisLine={false} tickFormatter={(val) => `${settings?.currency || '$'}${val}`} dx={-10} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ fontWeight: '600' }}
                        formatter={(value, name) => [`${settings?.currency || '$'}${value.toLocaleString()}`, name === 'wantsExpense' ? 'Discretionary Wants' : 'Total Income']}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '13px', color: 'var(--text-primary)', paddingBottom: '10px' }}
                        formatter={(value) => value === 'wantsExpense' ? 'Discretionary Wants' : 'Total Income'}
                      />
                      <Area type="monotone" dataKey="income" stroke="var(--neon-green)" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" activeDot={{r: 6, strokeWidth: 0, fill: 'var(--neon-green)'}} />
                      <Area type="monotone" dataKey="wantsExpense" stroke="var(--neon-pink)" strokeWidth={2} fillOpacity={1} fill="url(#colorWants)" activeDot={{r: 6, strokeWidth: 0, fill: 'var(--neon-pink)'}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>Deep Diagnostics</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
                    <div style={{...flatCardStyle, padding: '24px', background: isStrength ? 'rgba(50, 215, 75, 0.05)' : flatCardStyle.background, border: isStrength ? '1px solid rgba(50, 215, 75, 0.3)' : flatCardStyle.border }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neon-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--neon-green)', letterSpacing: '1px' }}>STRENGTH</span>
                      </div>
                      {isStrength ? (
                        <div>
                          <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>High Capital Efficiency</h4>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>You are successfully retaining <span style={{color: 'var(--neon-green)', fontWeight: '700'}}>{(insights.swot.savingsRate * 100).toFixed(1)}%</span> of your monthly income.</p>
                        </div>
                      ) : (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 'auto 0', fontStyle: 'italic' }}>Push your monthly savings/retention rate above 20% to unlock.</p>
                      )}
                    </div>
                    
                    <div style={{...flatCardStyle, padding: '24px', background: isWeakness ? 'rgba(255, 55, 95, 0.05)' : flatCardStyle.background, border: isWeakness ? '1px solid rgba(255, 55, 95, 0.3)' : flatCardStyle.border }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neon-pink)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--neon-pink)', letterSpacing: '1px' }}>WEAKNESS</span>
                      </div>
                      {isWeakness ? (
                        <div>
                          <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Structural Anchor</h4>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}><span style={{color: 'var(--neon-pink)', fontWeight: '700'}}>{(insights.swot.fixedToIncomeRatio * 100).toFixed(0)}%</span> of your baseline income is aggressively locked into fixed autopilot bills.</p>
                        </div>
                      ) : (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 'auto 0', fontStyle: 'italic' }}>Fixed obligations are operating within healthy margins.</p>
                      )}
                    </div>
                    
                    <div style={{...flatCardStyle, padding: '24px', background: isOpportunity ? 'rgba(10, 132, 255, 0.05)' : flatCardStyle.background, border: isOpportunity ? '1px solid rgba(10, 132, 255, 0.3)' : flatCardStyle.border }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--neon-blue)', letterSpacing: '1px' }}>OPPORTUNITY</span>
                      </div>
                      {isOpportunity ? (
                        <div>
                          <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Inflation Drag</h4>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>You have unallocated capital losing roughly <span style={{color: 'var(--neon-blue)', fontWeight: '700'}}>{settings?.currency || '$'}{insights.swot.inflationDragAmount.toFixed(0)}/year</span> in purchasing power.</p>
                        </div>
                      ) : (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 'auto 0', fontStyle: 'italic' }}>Capital is operating efficiently with minimal inflation drag.</p>
                      )}
                    </div>
                    
                    <div style={{...flatCardStyle, padding: '24px', background: isThreat ? 'rgba(191, 90, 242, 0.05)' : flatCardStyle.background, border: isThreat ? '1px solid rgba(191, 90, 242, 0.3)' : flatCardStyle.border }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neon-purple)" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--neon-purple)', letterSpacing: '1px' }}>THREAT</span>
                      </div>
                      {isThreat ? (
                        <div>
                          <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Lifestyle Creep Velocity</h4>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>Your discretionary 'Wants' are growing at <span style={{color: 'var(--neon-purple)', fontWeight: '700'}}>{(insights.swot.wantsVelocity * 100).toFixed(1)}%</span>, outpacing your income growth.</p>
                        </div>
                      ) : (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 'auto 0', fontStyle: 'italic' }}>Income velocity is currently outpacing lifestyle expansion.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>Subscription Drain</h3>
                    <div style={{...flatCardStyle, padding: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '20px' }}>
                        <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{settings?.currency || '$'}{insights.autopilotErosion.oneYear.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</p>
                        <p style={{ fontSize: '14px', color: 'var(--neon-pink)', fontWeight: '600', paddingBottom: '6px', margin: 0 }}>/ Year</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>5-Year Capital Drain</span>
                          <span style={{ fontSize: '14px', fontWeight: '600' }}>{settings?.currency || '$'}{insights.autopilotErosion.fiveYear.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>10-Year Capital Drain</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--neon-pink)' }}>{settings?.currency || '$'}{insights.autopilotErosion.tenYear.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                     <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>Goal Exposure</h3>
                     <div style={{...flatCardStyle, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
                       <div style={{ flex: 1, position: 'relative', minHeight: '220px' }}>
                         {volData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                               <Pie data={volData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                                 {volData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                               </Pie>
                               <Tooltip formatter={(val) => `${settings?.currency || '$'}${val.toLocaleString(undefined, {maximumFractionDigits: 0})}`} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', color: '#fff' }} />
                               <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '15px' }} />
                             </PieChart>
                           </ResponsiveContainer>
                         ) : (
                           <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No capital allocated to goals.</div>
                         )}
                         {volData.length > 0 && (
                             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', marginTop: '-15px' }}>
                               <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>{((insights.volatility.volatileValue / insights.volatility.totalAllocated) * 100).toFixed(0)}%</span><br/>
                               <span style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>RISK</span>
                             </div>
                         )}
                       </div>
                     </div>
                  </div>

                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '32px' }}>
                <div style={{...flatCardStyle, gap: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(191, 90, 242, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-purple)', border: '1px solid rgba(191,90,242,0.1)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--text-primary)', fontWeight: '700' }}>50/30/20 Blueprint</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Distribution of {settings?.currency || '$'}{insights.blueprint.income.toLocaleString()}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Needs <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>(50%)</span></span>
                        <span style={{ color: insights.blueprint.needs > insights.blueprint.income * 0.5 ? 'var(--neon-pink)' : 'var(--text-primary)' }}>
                          {insights.blueprint.income > 0 ? ((insights.blueprint.needs / insights.blueprint.income) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (insights.blueprint.needs / insights.blueprint.income) * 100 || 0)}%`, height: '100%', background: insights.blueprint.needs > insights.blueprint.income * 0.5 ? 'var(--neon-pink)' : 'var(--neon-blue)', borderRadius: '4px' }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Wants <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>(30%)</span></span>
                        <span style={{ color: insights.blueprint.wants > insights.blueprint.income * 0.3 ? 'var(--neon-pink)' : 'var(--text-primary)' }}>
                          {insights.blueprint.income > 0 ? ((insights.blueprint.wants / insights.blueprint.income) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (insights.blueprint.wants / insights.blueprint.income) * 100 || 0)}%`, height: '100%', background: insights.blueprint.wants > insights.blueprint.income * 0.3 ? 'var(--neon-pink)' : 'var(--neon-purple)', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Savings/Liquid <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>(20%)</span></span>
                        <span style={{ color: insights.blueprint.savings < insights.blueprint.income * 0.2 ? 'var(--neon-pink)' : 'var(--neon-green)' }}>
                          {insights.blueprint.income > 0 ? ((insights.blueprint.savings / insights.blueprint.income) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (insights.blueprint.savings / insights.blueprint.income) * 100 || 0)}%`, height: '100%', background: insights.blueprint.savings < insights.blueprint.income * 0.2 ? 'var(--neon-pink)' : 'var(--neon-green)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={flatCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(50, 215, 75, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-green)', border: '1px solid rgba(50,215,75,0.1)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--text-primary)', fontWeight: '700' }}>Time-Value Index</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Expenses translated into life-hours worked.</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>True Hourly Rate</p>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--neon-green)', margin: 0 }}>{settings?.currency || '$'}{insights.timeValue.hourlyRate.toFixed(2)}</p>
                    </div>
                  </div>

                  {insights.timeValue.expenses.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {insights.timeValue.expenses.map((expense) => {
                        const barWidth = Math.min(100, (expense.costInHours / 40) * 100); 
                        return (
                          <div key={expense.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1.5 }}>
                              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{expense.name}</p>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{settings?.currency || '$'}{expense.amount.toFixed(2)}</span>
                            </div>
                            <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                              <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--neon-pink)', margin: 0 }}>{expense.costInHours.toFixed(1)} hrs</p>
                              <div style={{ width: '80%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', alignSelf: 'flex-end', display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--neon-pink)', borderRadius: '3px' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>
                      No active expenses to calculate.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}