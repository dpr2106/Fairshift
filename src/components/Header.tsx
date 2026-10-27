import React from 'react';
import { User, Industry } from '../../server/types.js';
import { Language, translations } from '../translations.js';
import { Building2, Stethoscope, Globe, Shield, RefreshCw, UserCheck } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  users: User[];
  currentIndustry: Industry;
  currentLanguage: Language;
  onSelectUser: (user: User) => void;
  onSelectIndustry: (ind: Industry) => void;
  onToggleLanguage: () => void;
  onResetData: () => void;
  viewMode: 'worker' | 'employer';
  onSetViewMode: (mode: 'worker' | 'employer') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  currentIndustry,
  currentLanguage,
  onSelectUser,
  onSelectIndustry,
  onToggleLanguage,
  onResetData,
  viewMode,
  onSetViewMode
}) => {
  const t = translations[currentLanguage];

  return (
    <header className="app-header">
      {/* SDG 8 Top Strip */}
      <div className="sdg-banner">
        <span>🌐 {t.sdgGoal}</span>
        <span>•</span>
        <span>Prompt Wars 2026 SRMIST ACM Hackathon</span>
      </div>

      <div className="header-inner">
        {/* Brand */}
        <div className="brand-section">
          <div className="brand-logo-badge">
            <Shield size={22} />
            <span>FairShift</span>
          </div>
          <div className="brand-titles">
            <h1 className="brand-name">{t.appName}</h1>
            <span className="brand-subtitle">{t.tagline}</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="header-controls">
          {/* Industry Switcher */}
          <div className="control-badge" title={t.switchIndustry}>
            {currentIndustry === 'construction' ? (
              <Building2 size={16} color="#d97706" />
            ) : (
              <Stethoscope size={16} color="#0284c7" />
            )}
            <select
              value={currentIndustry}
              onChange={(e) => onSelectIndustry(e.target.value as Industry)}
              aria-label="Select Industry"
            >
              <option value="construction">🏗️ Construction (Apex Metro)</option>
              <option value="healthcare">🏥 Healthcare (Kaveri Hospital)</option>
            </select>
          </div>

          {/* Persona Switcher */}
          <div className="control-badge" title={t.switchRole}>
            <UserCheck size={16} color="#0d9488" />
            <select
              value={currentUser?.id || ''}
              onChange={(e) => {
                const found = users.find((u) => u.id === e.target.value);
                if (found) onSelectUser(found);
              }}
              aria-label="Select Persona"
            >
              <optgroup label="👷 Blue-Collar Workers">
                <option value="usr-worker-murugan">Murugan K. (Mason / Rigger - Construction)</option>
                <option value="usr-worker-priya">Priya Selvam (Sanitation / Biohazard - Hospital)</option>
                <option value="usr-worker-rajesh">Rajesh V. (Electrician - Construction)</option>
                <option value="usr-worker-deepa">Deepa S. (Aux Nurse - Hospital)</option>
              </optgroup>
              <optgroup label="👔 Authorized Supervisors / HR">
                <option value="usr-mgr-arumugam">Arumugam R. (Site Safety Officer - Construction)</option>
                <option value="usr-mgr-malathi">Dr. Malathi C. (Facilities Director - Hospital)</option>
                <option value="usr-admin-compliance">System Auditor / Compliance Officer</option>
              </optgroup>
            </select>
          </div>

          {/* Language Toggle */}
          <button
            className="lang-btn"
            onClick={onToggleLanguage}
            title="Toggle between English and Tamil"
            aria-label="Switch Language"
          >
            <Globe size={16} />
            <span>{currentLanguage === 'en' ? 'தமிழ் (TA)' : 'English (EN)'}</span>
          </button>

          {/* Reset Demo Button */}
          <button
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
            onClick={onResetData}
            title="Reset to clean demonstration seed data"
          >
            <RefreshCw size={14} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Dual Portal View Toggle */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '8px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <div className="view-mode-tabs" role="tablist">
            <button
              className={`view-mode-btn ${viewMode === 'worker' ? 'active' : ''}`}
              onClick={() => onSetViewMode('worker')}
              role="tab"
              aria-selected={viewMode === 'worker'}
            >
              👷 {t.workerPortal}
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'employer' ? 'active' : ''}`}
              onClick={() => onSetViewMode('employer')}
              role="tab"
              aria-selected={viewMode === 'employer'}
            >
              📊 {t.employerPortal}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
