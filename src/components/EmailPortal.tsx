'use client';

import React, { useState, useEffect } from 'react';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  email: string;
}

interface AgentStatus {
  name: string;
  description: string;
  tools: string[];
  status: string;
  framework: string;
  capabilities: string[];
  timestamp: string;
}

interface PatientSummary {
  success: boolean;
  data: {
    patient: {
      name: string;
      mrn: string;
      dateOfBirth: string;
      allergies: string[];
    };
    stats: {
      totalLabs: number;
      abnormalLabs: number;
      criticalLabs: number;
      activeMedications: number;
      recentEmails: number;
      highPriorityEmails: number;
      healthScore: number;
      riskLevel: string;
    };
    recentLabs: any[];
    medications: any[];
    recentEmails: any[];
    alerts: any[];
    workflow: string;
    processedBy: string;
  };
  meta: {
    processedBy: string;
    timestamp: string;
    workflow: string;
    apiVersion: string;
  };
}

const EmailPortal: React.FC = () => {
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  
  // Mock patient data (in real app, this would come from props or API)
  const mockPatients: Patient[] = [
    { 
      id: '550e8400-e29b-41d4-a716-446655440000', 
      name: 'John Smith', 
      mrn: 'MRN001',
      email: 'URGENT: Cardiac Enzymes Elevated - Immediate Review Required'
    },
    { 
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', 
      name: 'Sarah Johnson', 
      mrn: 'MRN002',
      email: 'Lab Results: Diabetes Management - A1C Results Available'
    },
    { 
      id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', 
      name: 'Michael Brown', 
      mrn: 'MRN003',
      email: 'Prescription Refill Request - Cholesterol Medication Due'
    }
  ];

  // Check Mastra agent status on component mount
  useEffect(() => {
    checkAgentStatus();
  }, []);

  const checkAgentStatus = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/agent/status');
      const result = await response.json();
      setAgentStatus(result.success ? result.agent : null);
    } catch (error) {
      console.error('Failed to check agent status:', error);
      setAgentStatus(null);
    }
  };

  const fetchPatientSummaryWithMastra = async (patientId: string) => {
    if (!patientId) return;
    
    setLoading(true);
    setPatientSummary(null);
    
    try {
      console.log('🤖 Calling Mastra Healthcare Agent...');
      
      const response = await fetch(`http://localhost:4001/api/patient/${patientId}/summary`);
      const result = await response.json();
      
      console.log('📡 Mastra Agent Response:', result);
      
      if (result.success) {
        setPatientSummary(result);
        console.log('✅ Mastra agent completed successfully!');
        console.log(`🔧 Workflow: ${result.data.workflow}`);
        console.log(`📊 Health Score: ${result.data.stats.healthScore}/100`);
      } else {
        console.error('❌ Mastra agent failed:', result.error);
        alert(`Mastra Agent Error: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ Network error:', error);
      alert(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMastraAgentClick = () => {
    if (!selectedPatientId) {
      alert('Please select a patient first!');
      return;
    }
    
    fetchPatientSummaryWithMastra(selectedPatientId);
  };

  const selectedPatient = mockPatients.find(p => p.id === selectedPatientId);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📧 Healthcare Email Portal
        </h1>
        <p className="text-gray-600 mb-4">
          Powered by Mastra AI Agent Framework
        </p>
        
        {/* Agent Status Indicator */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex items-center gap-2 ${
            agentStatus ? 'text-green-600' : 'text-red-600'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              agentStatus ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            {agentStatus ? (
              <span>🤖 Mastra Agent Active ({agentStatus.tools ? (typeof agentStatus.tools === 'object' ? Object.keys(agentStatus.tools).length : agentStatus.tools.length) : 0} tools)</span>
            ) : (
              <span>❌ Mastra Agent Disconnected</span>
            )}
          </div>
          
          <button
            onClick={checkAgentStatus}
            className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            🔄 Check Status
          </button>
        </div>
      </div>

      {/* Email Interface Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Email List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">📧 Inbox</h2>
          
          {/* Patient Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Patient Email:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Choose an email --</option>
              {mockPatients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  📧 {patient.email} ({patient.name})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Email Display */}
          {selectedPatient && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold">
                      HIGH PRIORITY
                    </span>
                    <span className="text-xs text-gray-500">Medical</span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1">
                    {selectedPatient.email}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    From: system@hospital.com
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    To: doctor@clinic.com
                  </p>
                  <p className="text-sm text-blue-600">
                    Patient: {selectedPatient.name} (MRN: {selectedPatient.mrn})
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-white border rounded p-3 mb-3">
                <p className="text-sm text-gray-700">
                  New medical information requires immediate attention. Please review patient 
                  records and determine appropriate next steps. Multiple data points suggest 
                  this case needs priority handling.
                </p>
              </div>

              {/* Mastra Agent Action Button */}
              <div className="flex gap-2">
                <button
                  onClick={handleMastraAgentClick}
                  disabled={loading || !agentStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Mastra Agent Processing...
                    </>
                  ) : (
                    <>
                      🤖 Get Patient Summary (Mastra AI)
                    </>
                  )}
                </button>
                
                <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                  📝 Reply
                </button>
                
                <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                  ➡️ Forward
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Agent Tools Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            🔧 Mastra Agent Tools
          </h3>
          
          {agentStatus ? (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Agent:</strong> {agentStatus.name}
              </div>
              <div className="text-sm">
                <strong>Framework:</strong> {agentStatus.framework || 'Mastra'}
              </div>
              <div className="text-sm">
                <strong>Status:</strong> 
                <span className="text-green-600 ml-1">Active</span>
              </div>
              
              <div className="mt-3">
                <strong className="text-sm">Available Tools:</strong>
                <ul className="mt-1 space-y-1">
                  {agentStatus.tools && typeof agentStatus.tools === 'object' ? 
                    Object.values(agentStatus.tools).map((tool: any, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        {tool.id || tool}
                      </li>
                    )) : 
                    (Array.isArray(agentStatus.tools) ? agentStatus.tools.map((tool, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        {tool}
                      </li>
                    )) : [])
                  }
                </ul>
              </div>

              <div className="mt-3">
                <strong className="text-sm">Capabilities:</strong>
                <ul className="mt-1 space-y-1">
                  {agentStatus.capabilities?.map((capability, index) => (
                    <li key={index} className="text-xs text-gray-600">
                      • {capability}
                    </li>
                  )) || []}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              Agent status unavailable. Make sure the API server is running.
            </div>
          )}
        </div>
      </div>

      {/* Mastra Agent Results */}
      {patientSummary && (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-blue-700">
                🤖 Mastra Agent Results
              </h2>
            </div>
            <div className="text-sm text-gray-500">
              Processed by: {patientSummary.meta?.processedBy}
            </div>
          </div>

          {/* Patient Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-lg mb-2 text-blue-800">
              👤 {patientSummary.data.patient.name}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">MRN:</span> {patientSummary.data.patient.mrn}
              </div>
              <div>
                <span className="font-medium">Health Score:</span> 
                <span className={`ml-2 font-bold ${
                  patientSummary.data.stats.healthScore >= 80 ? 'text-green-600' :
                  patientSummary.data.stats.healthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {patientSummary.data.stats.healthScore}/100
                </span>
              </div>
              <div>
                <span className="font-medium">Risk Level:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                  patientSummary.data.stats.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                  patientSummary.data.stats.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {patientSummary.data.stats.riskLevel}
                </span>
              </div>
              <div>
                <span className="font-medium">DOB:</span> {patientSummary.data.patient.dateOfBirth || 'Not available'}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-100 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">{patientSummary.data.stats.totalLabs}</div>
              <div className="text-xs text-gray-500">Recent Labs</div>
            </div>
            <div className="bg-red-100 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{patientSummary.data.stats.abnormalLabs}</div>
              <div className="text-xs text-red-500">Abnormal</div>
            </div>
            <div className="bg-green-100 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{patientSummary.data.stats.activeMedications}</div>
              <div className="text-xs text-green-500">Medications</div>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{patientSummary.data.stats.recentEmails}</div>
              <div className="text-xs text-yellow-500">Recent Emails</div>
            </div>
          </div>

          {/* Mastra-Generated Alerts */}
          {patientSummary.data.alerts && patientSummary.data.alerts.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                🚨 Mastra Agent Alerts:
              </h3>
              {patientSummary.data.alerts.map((alert, index) => (
                <div key={index} className={`p-2 mb-2 rounded text-sm ${
                  alert.severity === 'high' ? 'bg-red-100 border border-red-300' :
                  alert.severity === 'medium' ? 'bg-yellow-100 border border-yellow-300' :
                  'bg-blue-100 border border-blue-300'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-800">{alert.message}</span>
                    <div className="flex gap-2 text-xs">
                      <span className={`px-1 rounded ${
                        alert.severity === 'high' ? 'bg-red-200 text-red-700' :
                        alert.severity === 'medium' ? 'bg-yellow-200 text-yellow-700' :
                        'bg-blue-200 text-blue-700'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      {alert.actionRequired && (
                        <span className="px-1 bg-orange-200 text-orange-700 rounded">
                          ACTION REQUIRED
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Category: {alert.category} | Generated by: {alert.generatedBy}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Labs */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">🧪 Recent Lab Results (Mastra Analysis):</h3>
            {patientSummary.data.recentLabs && patientSummary.data.recentLabs.length > 0 ? (
              <div className="space-y-2">
                {patientSummary.data.recentLabs.map((lab, index) => (
                  <div key={index} className={`p-3 rounded-lg flex justify-between items-center ${
                    lab.is_abnormal ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                  }`}>
                    <div>
                      <span className="font-medium">{lab.test_name}</span>
                      <span className="text-sm text-gray-600 ml-2">({lab.lab_date})</span>
                      {lab.ai_interpretation && (
                        <div className="text-xs text-blue-600 mt-1">
                          🤖 AI: {lab.ai_interpretation}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${lab.is_abnormal ? 'text-red-600' : 'text-gray-700'}`}>
                        {lab.value} {lab.unit}
                      </span>
                      {lab.is_abnormal && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          {lab.abnormal_type?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent lab results available</p>
            )}
          </div>

          {/* Active Medications */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">💊 Active Medications:</h3>
            {patientSummary.data.medications && patientSummary.data.medications.length > 0 ? (
              <div className="space-y-2">
                {patientSummary.data.medications.map((med, index) => (
                  <div key={index} className="p-3 bg-green-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">{med.medication_name}</span>
                      <span className="text-sm text-gray-600">
                        {med.dosage} - {med.frequency}
                      </span>
                    </div>
                    {med.ai_interaction_warnings && (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠️ {med.ai_interaction_warnings}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No active medications</p>
            )}
          </div>

          {/* Mastra Workflow Info */}
          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">🔧 Workflow ID:</span>
                <div className="text-xs text-gray-500 font-mono">
                  {patientSummary.data.workflow}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">🕒 Generated:</span>
                <div className="text-xs text-gray-500">
                  {new Date(patientSummary.meta.timestamp).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">🤖 Agent:</span>
                <div className="text-xs text-gray-500">
                  {patientSummary.data.processedBy}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Panel */}
      <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-700 mb-3">📋 Mastra Agent Demo Instructions:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-yellow-700 mb-2">How It Works:</h4>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Select a patient email from the dropdown</li>
              <li>Click "🤖 Get Patient Summary (Mastra AI)"</li>
              <li>Mastra Agent executes workflow with multiple tools</li>
              <li>Agent queries Supabase, calculates stats, generates alerts</li>
              <li>Comprehensive results displayed with AI insights</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-yellow-700 mb-2">Architecture:</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>📱 React Component (this file)</div>
              <div>↓ API Call</div>
              <div>🌐 Express Server</div>
              <div>↓ Tool Execution</div>
              <div>🤖 Mastra HealthcareAgent Class</div>
              <div>↓ Database Queries</div>
              <div>🗄️ Supabase</div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white border border-yellow-300 rounded">
          <div className="text-xs text-gray-600">
            <strong>API Endpoints Available:</strong> /api/health, /api/agent/status, /api/patient/:id/summary, /api/agent/execute-tool
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPortal;
