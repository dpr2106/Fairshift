import React, { useState, useEffect } from 'react';
import { User, Industry } from '../server/types.js';
import { Language } from './translations.js';
import { api } from './api.js';
import { Header } from './components/Header.js';
import { WorkerPortal } from './components/WorkerPortal.js';
import { EmployerPortal } from './components/EmployerPortal.js';
import { Shield, ExternalLink, HeartHandshake } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndustry, setCurrentIndustry] = useState<Industry>('construction');
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<'worker' | 'employer'>('worker');
  const [loading, setLoading] = useState(true);

  // Load Initial App State
  const loadState = async () => {
    try {
      setLoading(true);
      const [allUsers, me] = await Promise.all([
        api.getAllUsers(),
        api.getCurrentUser()
      ]);
      setUsers(allUsers);
      setCurrentUser(me);
      setCurrentIndustry(me.industry);
      // If the current persona is a manager, default to employer view; if worker, default to worker view
      setViewMode(me.role === 'worker' ? 'worker' : 'employer');
    } catch (err) {
      console.error('Failed to load application state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  // Persona Switch Handler
  const handleSelectUser = (user: User) => {
    api.setUserId(user.id);
    setCurrentUser(user);
    setCurrentIndustry(user.industry);
    setViewMode(user.role === 'worker' ? 'worker' : 'employer');
  };

  // Industry Switch Handler
  const handleSelectIndustry = (ind: Industry) => {
    setCurrentIndustry(ind);
    // Find first user matching that industry
    const match = users.find((u) => u.industry === ind && (viewMode === 'worker' ? u.role === 'worker' : u.role !== 'worker'));
    if (match) {
      api.setUserId(match.id);
      setCurrentUser(match);
    }
  };

  // Language Toggle
  const handleToggleLanguage = () => {
    setCurrentLanguage((prev) => (prev === 'en' ? 'ta' : 'en'));
  };

  // Reset Demo Data
  const handleResetData = async () => {
    if (window.confirm('Reset all shifts, attendance, hazard tickets and feedback to initial hackathon seed demonstration state?')) {
      await api.resetSystem();
      await loadState();
      alert('System demonstration state restored successfully.');
    }
  };

  if (loading || !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0d9488' }}>FairShift</div>
          <p style={{ color: '#64748b', marginTop: 8 }}>Initializing Decent Work & Safety Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        currentUser={currentUser}
        users={users}
        currentIndustry={currentIndustry}
        currentLanguage={currentLanguage}
        onSelectUser={handleSelectUser}
        onSelectIndustry={handleSelectIndustry}
        onToggleLanguage={handleToggleLanguage}
        onResetData={handleResetData}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
      />

      <main className="main-wrapper">
        {viewMode === 'worker' ? (
          <WorkerPortal
            currentUser={currentUser}
            currentIndustry={currentIndustry}
            currentLanguage={currentLanguage}
          />
        ) : (
          <EmployerPortal
            currentUser={currentUser}
            currentIndustry={currentIndustry}
            currentLanguage={currentLanguage}
          />
        )}
      </main>

      {/* Trust & Transparency Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '24px 20px', marginTop: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a' }}>
              <Shield size={18} color="#0d9488" />
              <span>FairShift Platform — UN SDG 8 Decent Work</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
              Empowering construction & healthcare workforces through transparent payslips, validated attendance, and safe hazard escalation.
            </p>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>Prompt Wars 2026 SRMIST</span>
            <span>•</span>
            <span style={{ color: '#0d9488', fontWeight: 600 }}>Google Cloud Run Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
