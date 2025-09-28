'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send } from "lucide-react";

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
  const [selectedTab, setSelectedTab] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Patient | null>(null);

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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md p-4 flex flex-col">
        <h2 className="text-2xl font-bold mb-6">📧 Mail</h2>
        <button
          onClick={() => {
            setSelectedTab('inbox');
            setSelectedEmail(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md mb-2 ${
            selectedTab === 'inbox' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <Mail size={18} /> Inbox
        </button>
        <button
          onClick={() => {
            setSelectedTab('sent');
            setSelectedEmail(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md ${
            selectedTab === 'sent' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <Send size={18} /> Sent
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Email List */}
        {!selectedEmail && (
          <div className="p-6 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 capitalize">{selectedTab}</h2>
            <div className="space-y-2">
              {mockPatients.map(patient => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedEmail(patient)}
                  className="bg-white border rounded-md p-4 cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                >
                  {/* Priority dot placeholder (could be added dynamically from patientSummary later) */}
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{patient.email}</h3>
                    <p className="text-sm text-gray-600">Patient: {patient.name} ({patient.mrn})</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email Detail */}
        {selectedEmail && (
          <div className="flex-1 p-6 overflow-y-auto">
            <button
              onClick={() => setSelectedEmail(null)}
              className="mb-4 text-blue-600 hover:underline text-sm"
            >
              ← Back to {selectedTab}
            </button>

            <h2 className="text-2xl font-bold mb-2">{selectedEmail.email}</h2>
            <p className="text-sm text-gray-600 mb-4">
              Patient: {selectedEmail.name} | MRN: {selectedEmail.mrn}
            </p>
            <div className="bg-white border rounded-md p-4 mb-4">
              <p className="text-gray-700 text-sm">
                Full details would be shown here, including patient summary and relevant labs.
              </p>
            </div>

            {/* Reply Box */}
            <textarea
              rows={3}
              placeholder="Type your reply here..."
              className="w-full border border-gray-300 rounded-md p-2 text-sm mb-2 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                📨 Send Reply
              </button>
              <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                ➡️ Forward
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailPortal;
