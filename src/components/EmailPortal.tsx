'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send } from "lucide-react";
import { CedarCopilot, useSpell } from 'cedar-os';
import type { ProviderConfig } from 'cedar-os';

// Magic Wand Icon for the spell
const MagicWandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.998 15.998 0 011.622-3.385m5.043.025a15.998 15.998 0 001.622-3.385m3.388 1.62a15.998 15.998 0 00-1.622 3.385m-5.043-.025a15.998 15.998 0 01-3.388-1.621m5.043.025a15.998 15.998 0 013.388 1.622m0-11.218a4.5 4.5 0 11-8.4 2.245 4.5 4.5 0 018.4-2.245z" />
  </svg>
);

interface Patient {
  id: string;
  name: string;
  mrn: string;
  email: string;
  body : string;
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
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [draftReply, setDraftReply] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<Error | null>(null);

  // AI-powered email reply generation function
  const generateEmailReply = async () => {
    setIsAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch(`http://localhost:4001/api/emails/${selectedEmail.id}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          originalEmail: selectedEmail.body,
          currentDraft: draftReply
        }),
      });
      
      if (!response.body) throw new Error("Response body is empty.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentFullText = draftReply;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        currentFullText += chunk;
        setDraftReply(currentFullText);
      }
    } catch (error: any) {
      setAiError(error);
      console.error('Email reply generation error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const prioritizeEmail = async () => {

    try {
      const response = await fetch(`http://localhost:4001/api/patient/${selectedPatientId}/prioritize-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          text: selectedEmail.body,
        }),
      });
  
      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  
      const result = await response.json();
  
      if (!result.success) throw new Error(result.error || 'Unknown error from agent');
  
      // result.data contains { priority: 'High' | 'Medium' | 'Low', reasoning: string }
      return result.data;
  
    } catch (error: any) {
      setAiError(error.message);
      console.error('Email prioritization error:', error);
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };
  


  // Mock patient data (in real app, this would come from props or API)
  const mockPatients: Patient[] = [
    { 
      id: '550e8400-e29b-41d4-a716-446655440000', 
      name: 'John Smith', 
      mrn: 'MRN001',
      email: 'URGENT: Cardiac Enzymes Elevated - Immediate Review Required',
      body: `*** AUTOMATED CLINICAL ALERT ***

IMMEDIATE ATTENTION REQUIRED

Patient: John Smith (MRN: MRN001)
Alert Trigger: Critical Lab Value Detected

Details:
Recent cardiac enzyme panel returned values indicating a high probability of an acute cardiac event.

Troponin I: 15.2 ng/mL (Reference: <0.04 ng/mL) - CRITICAL

CK-MB: 8.5 ng/mL (Reference: 0.6-6.3 ng/mL) - HIGH

Please review the patient's full chart, including recent ECGs and medication history, and take immediate action.

This is an automated notification from the Clinical Decision Support System.
      `
    },
    { 
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', 
      name: 'Sarah Johnson', 
      mrn: 'MRN002',
      email: 'Lab Results: Diabetes Management - A1C Results Available',
      body: `Hi Dr. Anya's office,

I saw on the portal that my latest A1c results came in. It looks like the number is 7.2%, which seems a little high to me.

Could you please let me know if I should be concerned or if there's anything I should change with my diet or metformin? Just want to stay on top of things.

Thanks,
Sarah Johnson
      `
    },
    { 
      id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', 
      name: 'Michael Brown', 
      mrn: 'MRN003', 
      email: "Prescription Refill Request - Cholesterol Medication Due",
      body: `Hello, I hope this is the right place to ask. I'm running low on my cholesterol medication, Atorvastatin 20mg, and the bottle says I have no refills left.

Could you please send a new 90-day prescription to my usual pharmacy (CVS on Main St)?

Thank you for your help!

Best,
Michael Brown`
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
            setDraftReply('');
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
                  onClick={() => {
                    setSelectedEmail(patient);
                    setSelectedPatientId(patient.id);
                    setDraftReply('');
                  }}
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
              <div className="text-gray-700 text-sm whitespace-pre-wrap">
                {selectedEmail.body}
              </div>
            </div>

            {/* Reply Box */}
            <textarea
              rows={5}
              placeholder="Type your reply here, or use AI to generate one..."
              className="w-full border border-gray-300 rounded-md p-3 text-sm mb-3 focus:ring-2 focus:ring-blue-500"
              value={draftReply}
              onChange={(e) => setDraftReply(e.target.value)}
              disabled={isAiLoading}
            />
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <button 
                  onClick={generateEmailReply}
                  disabled={isAiLoading || !selectedEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MagicWandIcon />
                  {isAiLoading ? 'Generating...' : (draftReply ? 'Continue Draft' : 'Draft Reply')}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                  📨 Send Reply
                </button>
                <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                  ➡️ Forward
                </button>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={prioritizeEmail}
                  disabled={isAiLoading || !selectedEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Find Priority
                </button>
                
              </div>

            </div>
            
            {aiError && (
              <div className="text-sm text-red-500 mb-2">
                Error: {aiError.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapped component with Cedar Copilot
const EmailPortalWithCedar: React.FC = () => {
  const llmProvider: ProviderConfig = {
    provider: 'openai',
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  };

  return (
    <CedarCopilot llmProvider={llmProvider}>
      <EmailPortal />
    </CedarCopilot>
  );
};

export default EmailPortalWithCedar;
