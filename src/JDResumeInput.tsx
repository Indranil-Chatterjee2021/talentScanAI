import React, { useState } from 'react';
import { commonSkills } from './commonSkills';
import { JDResumeInputProps } from './interfaces';

function appendSkill(current: string, skill: string): string {
  const existing = current.split(',').map(s => s.trim()).filter(Boolean);
  if (existing.some(s => s.toLowerCase() === skill.toLowerCase())) {
    return current; // Avoid duplicates
  }
  return existing.length > 0 ? `${current}, ${skill}` : skill;
}

function removeSkill(current: string, skillToRemove: string): string {
  const existing = current.split(',').map(s => s.trim()).filter(Boolean);
  return existing.filter(s => s.toLowerCase() !== skillToRemove.toLowerCase()).join(', ');
}

function getSkillsArray(skillsString: string): string[] {
  return skillsString.split(',').map(s => s.trim()).filter(Boolean);
}

const JDResumeInput: React.FC<JDResumeInputProps> = ({ jd, setJD, onSubmit, readonly, onEdit, onRescan, showRescan }) => {
  const [customMustHave, setCustomMustHave] = useState('');
  const [customNiceToHave, setCustomNiceToHave] = useState('');

  const handleAddCustomMustHave = () => {
    if (customMustHave.trim()) {
      setJD({ ...jd, mustHave: appendSkill(jd.mustHave, customMustHave.trim()) });
      setCustomMustHave('');
    }
  };

  const handleAddCustomNiceToHave = () => {
    if (customNiceToHave.trim()) {
      setJD({ ...jd, niceToHave: appendSkill(jd.niceToHave, customNiceToHave.trim()) });
      setCustomNiceToHave('');
    }
  };

  return (
    <div className="upload-section">
      <div className="jd-resume-section">
        <h2 style={{ fontSize: 22, fontWeight: 700, background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>Job Description</h2>
      {readonly ? (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Must Have Tech Skills:</label>
            <div style={{ background: '#f3f4f6', padding: 8, borderRadius: 4, border: '1px solid #e5e7eb', marginTop: 4, fontWeight: 700 }}>{jd.mustHave}</div>
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontWeight: 600, color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nice to Have Skills:</label>
            <div style={{ background: '#f3f4f6', padding: 8, borderRadius: 4, border: '1px solid #e5e7eb', marginTop: 4, fontWeight: 700 }}>{jd.niceToHave}</div>
          </div>
          <button type="button" className="bulk-upload-button" style={{ marginRight: 16 }} onClick={onEdit}>Edit JD</button>
          {showRescan && onRescan && (
            <button type="button" className="bulk-upload-button" style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #4ade80 100%)', marginLeft: 0 }} onClick={onRescan}>Rescan Candidates</button>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="jd-must-have" style={{ fontWeight: 600, color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Must Have Tech Skills:</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 8 }}>
              <select
                onChange={e => {
                  if (e.target.value) {
                    setJD({ ...jd, mustHave: appendSkill(jd.mustHave, e.target.value) });
                    e.target.value = '';
                  }
                }}
                style={{
                  fontSize: 13,
                  padding: 6,
                  width: 200,
                  borderRadius: 4,
                  border: '1px solid #ccc'
                }}
              >
                <option value="">➕ Add from list...</option>
                {commonSkills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <input
                type="text"
                value={customMustHave}
                onChange={e => setCustomMustHave(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomMustHave())}
                placeholder="Or type custom skill..."
                style={{
                  flex: 1,
                  fontSize: 13,
                  padding: 6,
                  borderRadius: 4,
                  border: '1px solid #ccc'
                }}
              />

              <button
                type="button"
                onClick={handleAddCustomMustHave}
                disabled={!customMustHave.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: 'none',
                  background: customMustHave.trim() ? 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' : '#ccc',
                  color: 'white',
                  cursor: customMustHave.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Add
              </button>
            </div>

            {/* Skills Chips Display */}
            {getSkillsArray(jd.mustHave).length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 8,
                marginBottom: 8,
                padding: 12,
                background: 'var(--bg-section)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                {getSkillsArray(jd.mustHave).map(skill => (
                  <span
                    key={skill}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
                      color: 'white',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'default'
                    }}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setJD({ ...jd, mustHave: removeSkill(jd.mustHave, skill) })}
                      style={{
                        background: 'rgba(255, 255, 255, 0.3)',
                        border: 'none',
                        borderRadius: 4,
                        color: 'white',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                      title="Remove skill"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              id="jd-must-have"
              value={jd.mustHave || ''}
              onChange={e => setJD({ ...jd, mustHave: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontWeight: 700, display: 'none' }}
              placeholder="List must-have tech skills..."
              required
            />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="jd-nice-to-have" style={{ fontWeight: 600, color: '#666', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nice to Have Skills:</label>
            <select
              onChange={e => {
                if (e.target.value) {
                  setJD({ ...jd, niceToHave: appendSkill(jd.niceToHave, e.target.value) });
                  e.target.value = '';
                }
              }}
              style={{
                fontSize: 13,
                padding: 8,
                marginTop: 4,
                marginBottom: 8,
                width: '100%',
                borderRadius: 4,
                border: '1px solid #ccc'
              }}
            >
              <option value="">➕ Select from common skills...</option>
              {commonSkills.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Skills Chips Display */}
            {getSkillsArray(jd.niceToHave).length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 8,
                marginBottom: 8,
                padding: 12,
                background: 'var(--bg-section)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                {getSkillsArray(jd.niceToHave).map(skill => (
                  <span
                    key={skill}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                      color: 'white',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'default'
                    }}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setJD({ ...jd, niceToHave: removeSkill(jd.niceToHave, skill) })}
                      style={{
                        background: 'rgba(255, 255, 255, 0.3)',
                        border: 'none',
                        borderRadius: 4,
                        color: 'white',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                      title="Remove skill"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              id="jd-nice-to-have"
              value={jd.niceToHave || ''}
              onChange={e => setJD({ ...jd, niceToHave: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontWeight: 700, display: 'none' }}
              placeholder="List nice-to-have skills..."
            />
          </div>
          <button type="submit" className="bulk-upload-button" style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #06b6d4 100%)', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', textAlign: 'center', boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)', position: 'relative', overflow: 'hidden' }}>Submit JD</button>
        </form>
      )}
    </div>
  </div>
  );
};

export default JDResumeInput;
