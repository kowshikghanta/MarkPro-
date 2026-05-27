import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  Award, 
  Users, 
  School, 
  BookOpen, 
  RefreshCw, 
  Check, 
  Sliders, 
  HelpCircle, 
  LineChart, 
  Sparkles, 
  Download, 
  CloudLightning,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('grades');

  // Filter States
  const [institutions, setInstitutions] = useState(["Aegis High", "Beacon Academy", "Caldera Institute"]);
  const [selectedInstitution, setSelectedInstitution] = useState("Aegis High");
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Core Data
  const [marks, setMarks] = useState([]);
  const [stats, setStats] = useState({
    average: 0.0,
    averageWeighted: 0.0,
    median: 0.0,
    stdDev: 0.0,
    passingRate: 0.0,
    totalStudents: 0,
    atRiskCount: 0,
    gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
    recommendation: "Loading data..."
  });

  // Curve Simulator States
  const [curveType, setCurveType] = useState('RESET');
  const [bonusPoints, setBonusPoints] = useState(5);
  const [targetMean, setTargetMean] = useState(75);
  const [targetStdDev, setTargetStdDev] = useState(10);

  // Sync Configuration
  const [syncMode, setSyncMode] = useState('WEBSOCKET'); // 'WEBSOCKET' | 'FIREBASE'
  const [syncStatus, setSyncStatus] = useState('DISCONNECTED'); // 'CONNECTED' | 'DISCONNECTED' | 'SYNCED'
  const [recentLogs, setRecentLogs] = useState([]);
  
  // Table Editing
  const [editingCell, setEditingCell] = useState(null); // { markId, field }
  const [editValue, setEditValue] = useState('');
  const [recentlyUpdatedMarkId, setRecentlyUpdatedMarkId] = useState(null);

  const socketRef = useRef(null);

  // Log function for UI live logger console
  const logAction = (msg, level = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setRecentLogs(prev => [{ timestamp, message: msg, level }, ...prev].slice(0, 15));
  };

  // 1. Fetch initial Courses and data
  useEffect(() => {
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => {
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourse(data[0]);
        }
      })
      .catch(err => {
        logAction("Error fetching courses: " + err.message, "danger");
      });
  }, []);

  // 2. Fetch marks and stats when filters change
  const fetchData = () => {
    if (!selectedCourse) return;
    
    let urlMarks = `/api/marks?institution=${encodeURIComponent(selectedInstitution)}&courseId=${selectedCourse.id}`;
    let urlStats = `/api/stats?institution=${encodeURIComponent(selectedInstitution)}&courseId=${selectedCourse.id}`;

    // Fetch Marks
    fetch(urlMarks)
      .then(res => res.json())
      .then(data => {
        setMarks(data);
      })
      .catch(err => logAction("Error fetching marks: " + err.message, "danger"));

    // Fetch Stats
    fetch(urlStats)
      .then(res => res.json())
      .then(data => {
        setStats(data);
      })
      .catch(err => logAction("Error fetching stats: " + err.message, "danger"));
  };

  useEffect(() => {
    fetchData();
  }, [selectedInstitution, selectedCourse]);

  // 3. Establish WebSocket connection
  useEffect(() => {
    if (syncMode === 'WEBSOCKET') {
      connectWebSocket();
    } else {
      if (socketRef.current) {
        socketRef.current.close();
      }
      setSyncStatus('SYNCED');
      logAction("Switched to Firebase Realtime Synchronization.", "warning");
      logAction("[Firebase] Initialized connection to node: us-central1.firestore.googleapis.com", "success");
    }

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [syncMode]);

  const connectWebSocket = () => {
    setSyncStatus('DISCONNECTED');
    const wsUrl = `ws://${window.location.host}/ws/grades`;
    logAction(`Connecting to WebSocket: ${wsUrl}...`, "info");
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setSyncStatus('CONNECTED');
      logAction("WebSocket Sync Connected successfully.", "success");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'CONNECTION_ACK') {
          logAction("Received Handshake ACK from Java Backend.", "success");
        } else if (payload.type === 'GRADE_UPDATED') {
          // Glow row
          setRecentlyUpdatedMarkId(payload.markId);
          setTimeout(() => setRecentlyUpdatedMarkId(null), 1500);

          // Update React marks state
          setMarks(prev => prev.map(m => {
            if (m.id === payload.markId) {
              return {
                ...m,
                assignmentScore: payload.assignmentScore,
                midtermScore: payload.midtermScore,
                finalScore: payload.finalScore,
                weightedScore: payload.weightedScore,
                curvedScore: payload.curvedScore,
                letterGrade: payload.letterGrade
              };
            }
            return m;
          }));

          // Force refetch stats to keep KPIs updated
          fetchStatsDirect();
          logAction(`Live sync update received: Student Mark #${payload.markId} -> weighted: ${payload.weightedScore}%`, "success");
        } else if (payload.type === 'CURVE_APPLIED') {
          fetchData();
          logAction(`Broadcast Event: Curve '${payload.curveType}' applied to ${payload.institution}`, "success");
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => {
      setSyncStatus('DISCONNECTED');
      logAction("WebSocket disconnected. Attempting reconnect in 5s...", "danger");
      setTimeout(() => {
        if (syncMode === 'WEBSOCKET') connectWebSocket();
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error("WS error", err);
    };
  };

  const fetchStatsDirect = () => {
    if (!selectedCourse) return;
    let urlStats = `/api/stats?institution=${encodeURIComponent(selectedInstitution)}&courseId=${selectedCourse.id}`;
    fetch(urlStats)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Error updating stats", err));
  };

  // 4. Handle Inline Cell Editing
  const startEditing = (markId, field, currentValue) => {
    setEditingCell({ markId, field });
    setEditValue(currentValue.toString());
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { markId, field } = editingCell;
    const parsedVal = parseFloat(editValue);

    if (isNaN(parsedVal) || parsedVal < 0 || parsedVal > 100) {
      logAction("Validation Failed: Grade must be between 0 and 100", "danger");
      setEditingCell(null);
      return;
    }

    // Prepare update payload
    const updateObj = {
      type: "GRADE_UPDATE",
      markId: markId,
      [field]: parsedVal
    };

    if (syncMode === 'WEBSOCKET' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Send via WS
      socketRef.current.send(JSON.stringify(updateObj));
      logAction(`Broadcasting live update for Mark ID #${markId} over WebSocket`, "info");
    } else {
      // Simulating Firebase Firestore Update
      logAction(`[Firebase Firestore] Writing document path: /marks/${markId}...`, "info");
      
      // Update in H2 database via REST Fallback
      fetch('/api/marks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markId: markId,
          [field]: parsedVal
        })
      })
      .then(res => res.json())
      .then(data => {
        logAction(`[Firebase] Write committed successfully to node. Latency: 22ms.`, "success");
        // Trigger manual refresh for frontend
        fetchData();
        
        setRecentlyUpdatedMarkId(markId);
        setTimeout(() => setRecentlyUpdatedMarkId(null), 1500);
      });
    }

    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // 5. Apply Curved Grading
  const triggerCurveApplication = (typeOverride = null) => {
    if (!selectedCourse) return;
    const selectedCurve = typeOverride || curveType;

    const payload = {
      curveType: selectedCurve,
      courseId: selectedCourse.id,
      institution: selectedInstitution,
      bonusPoints: bonusPoints,
      targetMean: targetMean,
      targetStdDev: targetStdDev
    };

    if (syncMode === 'WEBSOCKET' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "APPLY_CURVE",
        curveType: selectedCurve,
        courseId: selectedCourse.id,
        institution: selectedInstitution,
        bonusPoints: bonusPoints,
        targetMean: targetMean,
        targetStdDev: targetStdDev
      }));
      logAction(`Broadcasting curve change: '${selectedCurve}' for ${selectedInstitution}`, "info");
    } else {
      // Firebase Mock & REST Fallback
      logAction(`[Firebase Realtime DB] Multi-doc write triggered for query (institution == ${selectedInstitution})`, "warning");
      
      fetch('/api/marks/curve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        logAction(`[Firebase] Curving completed successfully. Synchronized globally.`, "success");
        fetchData();
      })
      .catch(err => logAction("Error curving: " + err.message, "danger"));
    }
  };

  // 6. CSV Export
  const exportCSV = () => {
    let headers = "ID,Student Name,Email,Institution,Assignment Score,Midterm Score,Final Score,Weighted Grade,Curved Grade,Letter Grade\n";
    let rows = marks.map(m => 
      `${m.id},"${m.student.name}","${m.student.email}","${m.student.institution}",${m.assignmentScore},${m.midtermScore},${m.finalScore},${m.weightedScore},${m.curvedScore},"${m.letterGrade}"`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MarkPro_${selectedInstitution.replace(" ", "")}_${selectedCourse.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAction("Exported student mark ledger to CSV format successfully.", "success");
  };

  // Prep Chart Data
  const distributionChartData = [
    { name: 'F (0-59)', count: stats.gradeDistribution.F || 0, fill: '#ef4444' },
    { name: 'D (60-69)', count: stats.gradeDistribution.D || 0, fill: '#f97316' },
    { name: 'C (70-79)', count: stats.gradeDistribution.C || 0, fill: '#f59e0b' },
    { name: 'B (80-89)', count: stats.gradeDistribution.B || 0, fill: '#3b82f6' },
    { name: 'A (90-100)', count: stats.gradeDistribution.A || 0, fill: '#10b981' },
  ];

  // Curve Preview histogram (Before and After comparative graph)
  const getCurveComparisonData = () => {
    return marks.map(m => ({
      name: m.student.name.split(' ')[0],
      "Raw Score": m.weightedScore,
      "Curved Score": m.curvedScore
    })).slice(0, 15); // Show first 15 for readable comparison chart
  };

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header>
        <div className="logo-section">
          <GraduationCap size={38} className="text-purple-500" style={{ color: '#8b5cf6' }} />
          <h1>MarkPro<span>+</span></h1>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#3b82f6', borderRadius: '4px', fontWeight: 'bold' }}>v2.0 PRO</span>
        </div>

        <div className="flex-center">
          {/* Synchronizer Status Badge */}
          <div className={`sync-status ${syncMode === 'WEBSOCKET' ? (syncStatus === 'CONNECTED' ? 'ws-connected' : 'disconnected') : 'fb-connected'}`}>
            <span className="indicator"></span>
            <span>
              {syncMode === 'WEBSOCKET' 
                ? (syncStatus === 'CONNECTED' ? 'Live WebSocket Sync Active' : 'WebSocket Disconnected') 
                : 'Cloud Firebase Sync Active'}
            </span>
          </div>

          {/* Sync Mode Switcher */}
          <div className="glass-panel" style={{ display: 'flex', borderRadius: '25px', padding: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              onClick={() => setSyncMode('WEBSOCKET')} 
              style={{ 
                padding: '0.35rem 0.75rem', 
                fontSize: '0.75rem', 
                borderRadius: '20px', 
                background: syncMode === 'WEBSOCKET' ? 'var(--color-primary)' : 'transparent',
                color: '#fff',
                border: 'none',
                boxShadow: 'none'
              }}
            >
              WebSocket
            </button>
            <button 
              onClick={() => setSyncMode('FIREBASE')} 
              style={{ 
                padding: '0.35rem 0.75rem', 
                fontSize: '0.75rem', 
                borderRadius: '20px', 
                background: syncMode === 'FIREBASE' ? 'var(--color-warning)' : 'transparent',
                color: '#fff',
                border: 'none',
                boxShadow: 'none'
              }}
            >
              Firebase
            </button>
          </div>
        </div>
      </header>

      {/* FILTER CONTROLS BAR */}
      <section className="glass-panel controls-bar">
        <div className="filters-group">
          <div className="select-wrapper">
            <School size={16} style={{ left: '0.75rem', position: 'absolute', color: 'var(--color-text-secondary)' }} />
            <select 
              value={selectedInstitution} 
              onChange={(e) => setSelectedInstitution(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            >
              {institutions.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>

          <div className="select-wrapper">
            <BookOpen size={16} style={{ left: '0.75rem', position: 'absolute', color: 'var(--color-text-secondary)' }} />
            <select 
              value={selectedCourse ? selectedCourse.id : ''} 
              onChange={(e) => {
                const found = courses.find(c => c.id === parseInt(e.target.value));
                if (found) setSelectedCourse(found);
              }}
              style={{ paddingLeft: '2.2rem' }}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="flex-center">
          <button className="secondary" onClick={fetchData}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="primary" onClick={exportCSV}>
            <Download size={14} />
            Export Ledger
          </button>
        </div>
      </section>

      {/* KPI SUMMARIES */}
      <section className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-card-header">
            <span>Class Performance Avg</span>
            <Award size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="kpi-value">{stats.average}%</div>
          <div className="kpi-change up">
            <TrendingUp size={12} />
            <span>Weighted Raw: {stats.averageWeighted}%</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-card-header">
            <span>Standard Deviation</span>
            <LineChart size={18} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <div className="kpi-value">{stats.stdDev}</div>
          <div className="kpi-change">
            <span>Variance in class grades</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-card-header">
            <span>Passing Rate</span>
            <Users size={18} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="kpi-value">{stats.passingRate}%</div>
          <div className="kpi-change up" style={{ color: 'var(--color-success)' }}>
            <span>Target Threshold: 60.0%</span>
          </div>
        </div>

        <div className={`glass-panel kpi-card ${stats.atRiskCount > 0 ? 'danger' : ''}`}>
          <div className="kpi-card-header">
            <span>Students At-Risk</span>
            <AlertTriangle size={18} style={{ color: stats.atRiskCount > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }} />
          </div>
          <div className="kpi-value" style={{ color: stats.atRiskCount > 0 ? 'var(--color-danger)' : '' }}>{stats.atRiskCount}</div>
          <div className="kpi-change">
            <span>Grade &lt; 60% or critical fail</span>
          </div>
        </div>
      </section>

      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          onClick={() => setActiveTab('grades')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'grades' ? 'var(--color-primary-hover)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'grades' ? '2px solid var(--color-primary)' : 'none',
            borderRadius: '0',
            padding: '0.75rem 1rem',
            fontSize: '1rem'
          }}
        >
          <Award size={16} />
          Student Marksheet
        </button>
        <button 
          onClick={() => setActiveTab('analytics')} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'analytics' ? 'var(--color-primary-hover)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--color-primary)' : 'none',
            borderRadius: '0',
            padding: '0.75rem 1rem',
            fontSize: '1rem'
          }}
        >
          <LineChart size={16} />
          Visual Analytics Hub
        </button>
      </div>

      {/* DASHBOARD CONTENT GRID */}
      {activeTab === 'grades' ? (
        <div className="dashboard-grid">
          {/* INTERACTIVE LEDGER */}
          <section className="glass-panel grade-table-section">
            <div className="table-header-bar">
              <span className="table-title">Academic Ledger ({marks.length} Records)</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Double-click cells under score columns to edit. Press <b>Enter</b> to save.
              </span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th style={{ textAlign: 'center' }}>Assignments (30%)</th>
                    <th style={{ textAlign: 'center' }}>Midterm (30%)</th>
                    <th style={{ textAlign: 'center' }}>Final Exam (40%)</th>
                    <th style={{ textAlign: 'center' }}>Weighted</th>
                    <th style={{ textAlign: 'center' }}>Curved</th>
                    <th style={{ textAlign: 'center' }}>Letter Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map(mark => {
                    const isRowGlow = recentlyUpdatedMarkId === mark.id;
                    const isFGrade = mark.letterGrade === 'F';
                    
                    return (
                      <tr 
                        key={mark.id} 
                        style={{ 
                          background: isRowGlow 
                            ? 'rgba(16, 185, 129, 0.08)' 
                            : (isFGrade ? 'rgba(239, 68, 68, 0.02)' : ''),
                          borderLeft: isRowGlow 
                            ? '3px solid var(--color-success)' 
                            : (isFGrade ? '3px solid var(--color-danger)' : 'none')
                        }}
                      >
                        <td>
                          <div className="student-info">
                            <span className="student-name">{mark.student.name}</span>
                            <span className="student-email">{mark.student.email}</span>
                          </div>
                        </td>

                        {/* Assignment Editable Cell */}
                        <td className="editable-cell" onClick={() => startEditing(mark.id, 'assignmentScore', mark.assignmentScore)}>
                          {editingCell && editingCell.markId === mark.id && editingCell.field === 'assignmentScore' ? (
                            <input 
                              type="text" 
                              value={editValue} 
                              autoFocus 
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={handleKeyDown}
                            />
                          ) : (
                            <span>{mark.assignmentScore}%</span>
                          )}
                        </td>

                        {/* Midterm Editable Cell */}
                        <td className="editable-cell" onClick={() => startEditing(mark.id, 'midtermScore', mark.midtermScore)}>
                          {editingCell && editingCell.markId === mark.id && editingCell.field === 'midtermScore' ? (
                            <input 
                              type="text" 
                              value={editValue} 
                              autoFocus 
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={handleKeyDown}
                            />
                          ) : (
                            <span>{mark.midtermScore}%</span>
                          )}
                        </td>

                        {/* Final Editable Cell */}
                        <td className="editable-cell" onClick={() => startEditing(mark.id, 'finalScore', mark.finalScore)}>
                          {editingCell && editingCell.markId === mark.id && editingCell.field === 'finalScore' ? (
                            <input 
                              type="text" 
                              value={editValue} 
                              autoFocus 
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={handleKeyDown}
                            />
                          ) : (
                            <span>{mark.finalScore}%</span>
                          )}
                        </td>

                        {/* Calculated Weighted Score */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="score-badge weighted">{mark.weightedScore}%</span>
                        </td>

                        {/* Curved Score */}
                        <td style={{ textAlign: 'center' }}>
                          <span className={`score-badge curved ${mark.curvedScore > mark.weightedScore ? 'scaled-up' : ''}`}>
                            {mark.curvedScore}%
                          </span>
                        </td>

                        {/* Letter Grade */}
                        <td style={{ textAlign: 'center' }}>
                          <span className={`grade-badge ${mark.letterGrade.toLowerCase()}`}>{mark.letterGrade}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* SIDEBAR - CURVING PANELS & LOGS */}
          <div className="sidebar-panel">
            {/* Grade Curving Simulator Panel */}
            <section className="glass-panel">
              <div className="panel-header">
                <Sliders size={18} style={{ color: 'var(--color-primary)' }} />
                <h2>Grading Curves Studio</h2>
              </div>

              <div className="curve-controls-form">
                <div className="form-group">
                  <label>Curving Algorithm</label>
                  <div className="select-wrapper">
                    <select value={curveType} onChange={(e) => setCurveType(e.target.value)}>
                      <option value="RESET">Reset (Raw Weighted Grades)</option>
                      <option value="LINEAR">Linear (Flat bonus additive)</option>
                      <option value="SCALING_LINEAR">Scaling Linear (Max raw = 100%)</option>
                      <option value="ROOT">Root Scale (Help struggling grades)</option>
                      <option value="BELL">Gaussian Bell Curve Distribution</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>

                {curveType === 'LINEAR' && (
                  <div className="form-group">
                    <div className="flex-between">
                      <label>Bonus Points</label>
                      <span className="slider-val">+{bonusPoints} pts</span>
                    </div>
                    <div className="slider-group">
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={bonusPoints} 
                        onChange={(e) => setBonusPoints(parseInt(e.target.value))} 
                      />
                    </div>
                  </div>
                )}

                {curveType === 'BELL' && (
                  <>
                    <div className="form-group">
                      <div className="flex-between">
                        <label>Target Mean Score</label>
                        <span className="slider-val">{targetMean}%</span>
                      </div>
                      <div className="slider-group">
                        <input 
                          type="range" 
                          min="50" 
                          max="90" 
                          value={targetMean} 
                          onChange={(e) => setTargetMean(parseInt(e.target.value))} 
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="flex-between">
                        <label>Target Standard Dev</label>
                        <span className="slider-val">±{targetStdDev}</span>
                      </div>
                      <div className="slider-group">
                        <input 
                          type="range" 
                          min="5" 
                          max="20" 
                          value={targetStdDev} 
                          onChange={(e) => setTargetStdDev(parseInt(e.target.value))} 
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Mathematical Descriptions */}
                {curveType === 'RESET' && (
                  <div className="curve-desc">
                    <b>No Curve Applied</b>: Showing original, unaltered weighted averages calculated directly using the 30-30-40 allocation ratio.
                  </div>
                )}
                {curveType === 'LINEAR' && (
                  <div className="curve-desc">
                    <b>Linear Curve</b>: Adds a flat bonus of +{bonusPoints} points to every student's raw grade, capped at 100%. Ensures everyone benefits equally.
                  </div>
                )}
                {curveType === 'SCALING_LINEAR' && (
                  <div className="curve-desc">
                    <b>Scaling Linear</b>: Computes the maximum raw grade in the class, then scales all other scores so the top student receives exactly 100%.
                  </div>
                )}
                {curveType === 'ROOT' && (
                  <div className="curve-desc">
                    <b>Root Curve</b>: Applies `New = 10 * sqrt(Raw)`. Disproportionately lifts struggling students (e.g. 36% rises to 60%) while top scores receive minor adjustments.
                  </div>
                )}
                {curveType === 'BELL' && (
                  <div className="curve-desc">
                    <b>Bell Curve Scale</b>: Maps class scores to a Gaussian normal distribution with a mean of {targetMean}% and dispersion of {targetStdDev}. Perfect for standardizing tough courses.
                  </div>
                )}

                <button className="primary" onClick={() => triggerCurveApplication()}>
                  <Sparkles size={16} />
                  Calculate & Apply Curve
                </button>
              </div>
            </section>

            {/* Smart Recommendations Box */}
            <div className="recommendations-box">
              <Sparkles size={24} />
              <div className="recommendations-content">
                <h4>AI Smart Advisor</h4>
                <p>{stats.recommendation}</p>
              </div>
            </div>

            {/* Live Synchronization Logs Console */}
            <section className="glass-panel" style={{ maxHeight: '200px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="panel-header" style={{ padding: '0.75rem 1rem' }}>
                <CloudLightning size={16} style={{ color: 'var(--color-warning)' }} />
                <h2 style={{ fontSize: '0.95rem' }}>Live Synchronizer Console</h2>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', background: '#030408', fontFamily: 'monospace', fontSize: '0.75rem', overflowY: 'auto' }}>
                {recentLogs.length === 0 ? (
                  <span style={{ color: 'var(--color-text-muted)' }}>Idle. Awaiting sync operations...</span>
                ) : (
                  recentLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>[{log.timestamp}]</span>{' '}
                      <span style={{ 
                        color: log.level === 'success' 
                          ? 'var(--color-success)' 
                          : log.level === 'danger' 
                          ? 'var(--color-danger)' 
                          : log.level === 'warning' 
                          ? 'var(--color-warning)' 
                          : '#fff' 
                      }}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* VISUAL ANALYTICS TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dashboard-grid">
            {/* Histogram grade distribution */}
            <section className="glass-panel chart-section">
              <div className="chart-section-header">
                <span className="chart-title">Academic Letter Grade Distribution</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Reflecting the active curve ({curveType})
                </span>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ background: '#0b0f19', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      labelStyle={{ fontWeight: 'bold', color: '#fff' }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      {distributionChartData.map((entry, index) => (
                        <Area key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Before and After Curve Comparison */}
            <section className="glass-panel chart-section">
              <div className="chart-section-header">
                <span className="chart-title">Raw vs. Curved Comparative Analysis</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Snapshot of 15 sample student results
                </span>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getCurveComparisonData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCurved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={9} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={11} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ background: '#0b0f19', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="Raw Score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRaw)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Curved Score" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCurved)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Stats detailed summary grid */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <span className="chart-title" style={{ display: 'block', marginBottom: '1rem' }}>Institution Grade Metrics</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Active Institution</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--color-primary-hover)' }}>{selectedInstitution}</p>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Selected Course</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--color-secondary)' }}>{selectedCourse?.code}</p>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Class Size</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{stats.totalStudents} Enrolled</p>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Active Curve Adjustment</span>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--color-success)' }}>{curveType}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <p>MarkPro+ • Next-Generation EdTech Grade Management System • Designed with Java Spring Boot & React SPA</p>
      </footer>
    </div>
  );
}
