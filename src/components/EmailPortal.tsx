'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send, Wand2 } from "lucide-react";
import { useSpell, ActivationMode, Hotkey } from 'cedar-os';
import { useRegisterState, useRegisterFrontendTool, useSubscribeStateToAgentContext } from 'cedar-os';
import { z } from 'zod';



interface EmailPriority {
  emailId: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

interface Patient {
  id: string;
  name: string;
  mrn: string;
  email: string;
  body: string;
  priority?: EmailPriority;
  created_at?: string; // Supabase timestamp
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

// Simplified Cedar OS integration using native patterns

const EmailPortal: React.FC = () => {
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [selectedTab, setSelectedTab] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Patient | null>(null);
  const [draftReply, setDraftReply] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<Error | null>(null);
  const [emailPriorities, setEmailPriorities] = useState<EmailPriority[]>([]);
  const [sortByDate, setSortByDate] = useState(false);

  // Register email draft as Cedar state - this makes it available to AI agents
  useRegisterState({
    key: 'emailDraft',
    description: 'Current email draft being composed',
    value: draftReply,
    setValue: setDraftReply,
    stateSetters: {
      generateReply: {
        name: 'generateEmailReply',
        description: 'Generate or continue an email reply using healthcare context',
        argsSchema: z.object({
          continueExisting: z.boolean().describe('Whether to continue existing draft or start fresh'),
        }),
        execute: (currentDraft: string, setValue: (newValue: string) => void, args: { continueExisting: boolean }) => {
          // This will be handled by the backend via Cedar's agent system
          setValue(currentDraft); // Placeholder - backend will update via Cedar
        },
      },
    },
  });

  // Subscribe selected email context to Cedar agents
  useSubscribeStateToAgentContext(
    'currentEmailContext', 
    () => ({
      selectedEmail: selectedEmail ? {
        id: selectedEmail.id,
        subject: selectedEmail.email,
        body: selectedEmail.body,
        patient: {
          name: selectedEmail.name,
          mrn: selectedEmail.mrn,
          id: selectedEmail.id
        }
      } : null,
      patientSummary: patientSummary?.data || null,
      draftState: {
        current: draftReply,
        isEmpty: !draftReply.trim(),
        wordCount: draftReply.trim().split(/\s+/).filter(w => w).length,
      }
    }), 
    {
      showInChat: false, // Don't show in chat, just provide context
      color: '#9333EA',
    }
  );

  // Register frontend tool for Cedar AI agents to use
  useRegisterFrontendTool({
    name: 'generateHealthcareEmailReply',
    description: 'Generate contextual email reply for healthcare communication',
    argsSchema: z.object({
      instruction: z.string().describe('Specific instruction for the email reply generation'),
      continueExisting: z.boolean().optional().describe('Whether to continue existing draft'),
    }),
    execute: async (args: { instruction: string; continueExisting?: boolean }) => {
      if (!selectedEmail) return;

      console.log('🏥 Cedar AI executing healthcare email reply generation:', args);
      await handleGenerateReply(args.instruction, args.continueExisting);
    },
  });

  // Direct function for UI button clicks
  const handleGenerateReply = async (instruction?: string, continueExisting?: boolean) => {
    if (!selectedEmail) return;

    console.log('🏥 Generating healthcare email reply...');

    try {
      // Simple call to our healthcare backend - minimal frontend logic
      const response = await fetch(`http://localhost:4001/api/emails/${selectedEmail.id}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedEmail.id,
          originalEmail: selectedEmail.body,
          currentDraft: draftReply,
          instruction: instruction || (draftReply ? 
            'Continue and improve the existing email draft with professional healthcare context' : 
            'Generate a professional healthcare email reply based on the patient context and original email'),
          continueExisting: continueExisting ?? !!draftReply.trim()
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = continueExisting ? draftReply : '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          accumulatedText += chunk;
          setDraftReply(accumulatedText);
        }
      }
    } catch (error) {
      console.error('❌ Failed to generate email reply:', error);
      alert('Failed to generate email reply. Please check if the healthcare server is running on port 4001.');
    }
  };

  const prioritizeEmail = async () => {
    const getEmailPriority = (text: string, subject: string) => {
      // Keywords indicating high priority
      const urgentKeywords = ['URGENT', 'IMMEDIATE', 'CRITICAL', 'EMERGENCY', 'ABNORMAL', 'ELEVATED'];
      const mediumKeywords = ['REVIEW', 'FOLLOW-UP', 'RESULTS', 'AVAILABLE', 'DUE'];
      
      // Check subject and body for urgent keywords
      const textUpper = (text + ' ' + subject).toUpperCase();
      const hasUrgentKeywords = urgentKeywords.some(keyword => textUpper.includes(keyword));
      const hasMediumKeywords = mediumKeywords.some(keyword => textUpper.includes(keyword));
      
      // Check for clinical values that might indicate urgency
      const hasCriticalValues = textUpper.includes('CRITICAL') && textUpper.includes('REFERENCE');
      const hasDeadline = /DUE|BY|DEADLINE|EXPIRES?/i.test(text);
      
      if (hasUrgentKeywords || hasCriticalValues) {
        return 'HIGH';
      } else if (hasMediumKeywords || hasDeadline) {
        return 'MEDIUM';
      }
      return 'LOW';
    };

    try {
      const response = await fetch(`http://localhost:4001/api/patient/${selectedPatientId}/prioritize-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          text: selectedEmail ? selectedEmail.body : '',
          subject: selectedEmail ? selectedEmail.email : '',
          suggestedPriority: selectedEmail ? getEmailPriority(selectedEmail.body, selectedEmail.email) : 'LOW'
        }),
      });
  
      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  
      const result = await response.json();
  
      if (!result.success) throw new Error(result.error || 'Unknown error from agent');
  
      // Update email priorities state with the new priority
      const newPriority: EmailPriority = {
        emailId: selectedPatientId,
        priority: getEmailPriority(selectedEmail?.body || '', selectedEmail?.email || ''),
        reasoning: result.data.reasoning || 'Priority based on content analysis'
      };
      
      setEmailPriorities(prev => {
        const filtered = prev.filter(p => p.emailId !== selectedPatientId);
        return [...filtered, newPriority];
      });
      
      return newPriority;
  
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

  // Fetch emails from Supabase through our backend
  const fetchEmails = async () => {
    try {
      console.log('Fetching emails from backend...');
      const response = await fetch('http://localhost:4001/api/emails');
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      if (data.success && data.emails) {
        // Update mock patients with backend data
        const updatedPatients = mockPatients.map(patient => {
          const backendEmail = data.emails.find((e: any) => e.id === patient.id);
          if (backendEmail) {
            return {
              ...patient,
              created_at: backendEmail.created_at,
              priority: backendEmail.priority
            };
          }
          return patient;
        });
        console.log('Updated patients with timestamps:', updatedPatients);
        // Update email priorities based on backend data
        const priorities = data.emails.map((email: any) => ({
          emailId: email.id,
          priority: email.priority || 'LOW',
          reasoning: 'Priority based on content analysis'
        }));
        setEmailPriorities(priorities);
      }
    } catch (error) {
      console.error('Failed to fetch email data:', error);
    }
  };

  // Initialize emails and check agent status on mount
  useEffect(() => {
    const initializeEmails = async () => {
      await Promise.all([
        checkAgentStatus(),
        fetchEmails()
      ]);
      // Initial priority calculation
      const priorities: EmailPriority[] = mockPatients.map(patient => ({
        emailId: patient.id,
        priority: patient.email.toUpperCase().includes('URGENT') || 
                 patient.email.toUpperCase().includes('IMMEDIATE') || 
                 patient.body.toUpperCase().includes('CRITICAL') ? 'HIGH' :
                 patient.email.toUpperCase().includes('RESULTS') || 
                 patient.email.toUpperCase().includes('DUE') ? 'MEDIUM' : 'LOW',
        reasoning: 'Priority based on content analysis'
      }));
      console.log('Initial priorities:', priorities);
      setEmailPriorities(priorities);
      // Then call the API
      prioritizeAllEmails();
    };
    initializeEmails();
  }, []);

  const prioritizeAllEmails = async () => {
    const getEmailPriority = (text: string, subject: string) => {
      // Keywords indicating high priority
      const urgentKeywords = ['URGENT', 'IMMEDIATE', 'CRITICAL', 'EMERGENCY', 'ABNORMAL', 'ELEVATED'];
      const mediumKeywords = ['REVIEW', 'FOLLOW-UP', 'RESULTS', 'AVAILABLE', 'DUE'];
      
      // Check subject and body for urgent keywords
      const textUpper = (text + ' ' + subject).toUpperCase();
      const hasUrgentKeywords = urgentKeywords.some(keyword => textUpper.includes(keyword));
      const hasMediumKeywords = mediumKeywords.some(keyword => textUpper.includes(keyword));
      
      // Check for clinical values that might indicate urgency
      const hasCriticalValues = textUpper.includes('CRITICAL') && textUpper.includes('REFERENCE');
      const hasDeadline = /DUE|BY|DEADLINE|EXPIRES?/i.test(text);
      
      if (hasUrgentKeywords || hasCriticalValues) {
        return 'HIGH';
      } else if (hasMediumKeywords || hasDeadline) {
        return 'MEDIUM';
      }
      return 'LOW';
    };

    try {
      const response = await fetch('http://localhost:4001/api/prioritize-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: mockPatients.map(patient => ({
            id: patient.id,
            patientId: patient.id,
            text: patient.body,
            subject: patient.email,
            suggestedPriority: getEmailPriority(patient.body, patient.email)
          }))
        })
      });

      const result = await response.json();
      if (result.success) {
        // Convert the priorities to match our interface
        const priorities: EmailPriority[] = mockPatients.map(patient => {
          const priority = getEmailPriority(patient.body, patient.email);
          console.log(`Setting priority for ${patient.name}:`, priority);
          return {
            emailId: patient.id,
            priority,
            reasoning: result.data.find((r: any) => r.emailId === patient.id)?.reasoning || 'Priority based on content analysis'
          };
        });
        console.log('Setting email priorities:', priorities);
        setEmailPriorities(priorities);
      }
    } catch (error) {
      console.error('Failed to prioritize emails:', error);
    }
  };

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
    if (!selectedEmail) {
      alert('Please select a patient email first!');
      return;
    }
    
    fetchPatientSummaryWithMastra(selectedEmail.id);
  };  const selectedPatient = mockPatients.find(p => p.id === selectedPatientId);



  return (
    <>
      {selectedEmail && (
        <CommandPaletteSpell 
          selectedPatientId={selectedEmail.id}
          onFetchSummary={fetchPatientSummaryWithMastra}
          isPatientSummaryOpen={!!patientSummary}
        />
      )}
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
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold capitalize">{selectedTab}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {sortByDate ? 'Sorted by most recent' : 'Sorted by priority'}
                </p>
              </div>
              <button
                onClick={() => setSortByDate(!sortByDate)}
                className="px-3 py-1 text-sm bg-white border rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                {sortByDate ? (
                  <>
                    <span>📅 Sort by Date</span>
                    <span className="text-xs text-gray-500">(newest first)</span>
                  </>
                ) : (
                  <>
                    <span>🚨 Sort by Priority</span>
                    <span className="text-xs text-gray-500">(high to low)</span>
                  </>
                )}
              </button>
            </div>
            <div className="space-y-2">
              {mockPatients
                .map(patient => {
                  const priority = emailPriorities.find(p => p.emailId === patient.id);
                  console.log(`Rendering ${patient.name} with priority:`, priority);
                  return {
                    ...patient,
                    priority
                  };
                })
                .sort((a, b) => {
                  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                  const priorityA = a.priority?.priority || 'LOW';
                  const priorityB = b.priority?.priority || 'LOW';
                  return priorityOrder[priorityA] - priorityOrder[priorityB];
                })
                .map(patient => (
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
                  <span 
                    className={`w-3 h-3 rounded-full ${
                      !patient.priority ? 'bg-gray-300' :
                      patient.priority.priority === 'HIGH' ? 'bg-red-500' :
                      patient.priority.priority === 'MEDIUM' ? 'bg-yellow-500' :
                      patient.priority.priority === 'LOW' ? 'bg-green-500' :
                      'bg-gray-300'
                    }`}
                    title={patient.priority?.reasoning || 'Priority: ' + (patient.priority?.priority || 'Not set')}
                  ></span>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{patient.email}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm text-gray-600">Patient: {patient.name} ({patient.mrn})</p>
                      <p className="text-xs text-gray-500">
                        {patient.created_at
                          ? new Date(patient.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              hour12: true
                            })
                          : 'Time not available'}
                      </p>
                    </div>
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
              onClick={() => {
                setSelectedEmail(null);
                setSelectedPatientId('');
              }}
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

            />
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (selectedEmail) {
                      console.log('🔮 Cedar: Triggering healthcare email reply generation');
                      // Call our healthcare backend directly
                      handleGenerateReply();
                    }
                  }}
                  disabled={!selectedEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use CARE to generate contextual healthcare email reply"
                >
                  <Wand2 size={16} />
                  {draftReply ? '✨ Continue with CARE' : '✨ Generate with CARE'}
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

            </div>
            
            <div className="text-xs text-gray-500 mt-2">
              💡 CARE will use patient context and medical data automatically
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

interface CommandPaletteSpellProps {
  selectedPatientId?: string;
  onFetchSummary: (patientId: string) => void;
  isPatientSummaryOpen: boolean;
}

function CommandPaletteSpell({ selectedPatientId, onFetchSummary, isPatientSummaryOpen }: CommandPaletteSpellProps) {
  const [loading, setLoading] = useState(false);
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [mode, setMode] = useState<'summary' | 'generate'>('summary');
  const [query, setQuery] = useState('');

    const { isActive, deactivate } = useSpell({
    id: 'command-palette',
    activationConditions: {
      events: ['cmd+k'],
      mode: ActivationMode.TOGGLE,
    },
    onActivate: async () => {
      if (isPatientSummaryOpen) {
        setMode('generate');
      } else if (selectedPatientId) {
        setMode('summary');
        setLoading(true);
        try {
          const response = await fetch(`http://localhost:4001/api/patient/${selectedPatientId}/summary`);
          const result = await response.json();
          if (result.success) {
            setPatientSummary(result);
          } else {
            alert(`Error: ${result.error}`);
          }
        } catch (error: any) {
          alert(`Network error: ${error.message}`);
        } finally {
          setLoading(false);
        }
      } else {
        setMode('generate');
      }
    },
    preventDefaultEvents: true,
  });

  if (!isActive) return null;

	return (
		<div className='fixed inset-y-0 right-0 z-50 flex bg-black/20'>
			<div className='w-[500px] h-full overflow-y-auto bg-white shadow-xl border-l border-gray-200'>
				<div className='sticky top-0 bg-white border-b z-10'>
					<div className='flex justify-between items-center px-6 py-4'>
						<div className='flex items-center gap-2'>
							<h2 className='text-lg font-semibold'>
								{mode === 'summary' ? '📊 Patient Summary' : '✨ Generate with Care'}
							</h2>
						</div>
						<div className='flex items-center gap-2'>
							{isPatientSummaryOpen && (
								<button
									onClick={() => setMode(mode === 'summary' ? 'generate' : 'summary')}
									className='p-2 hover:bg-gray-100 rounded-full text-gray-500'
									title={mode === 'summary' ? 'Switch to Generate' : 'View Patient Summary'}
								>
									{mode === 'summary' ? <Wand2 size={16} /> : '📊'}
								</button>
							)}
							<button 
								onClick={deactivate}
								className='p-2 hover:bg-gray-100 rounded-full'
							>
								<span className='text-gray-500'>×</span>
							</button>
						</div>
					</div>
					<div className='px-6 pb-4 text-sm text-gray-500 flex items-center gap-2'>
						<span className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></span>
						{mode === 'summary' ? 'Auto-generated Report' : 'AI-powered Assistant'}
					</div>
				</div>

				{loading ? (
					<div className='flex items-center justify-center py-8'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
					</div>
				) : patientSummary ? (
					<div className='p-6 space-y-6'>
						{/* Patient Header */}
						<div className='flex justify-between items-start'>
							<div>
								<div className='flex items-center gap-2'>
									<h3 className='text-xl font-bold'>👤 {patientSummary.data.patient.name}</h3>
								</div>
								<p className='text-gray-600 text-sm'>MRN: {patientSummary.data.patient.mrn}</p>
							</div>
							<div>
								<div className='text-right mb-1'>
									<span className='text-gray-600 mr-2'>Health Score:</span>
									<span className={`font-bold ${
										parseInt(patientSummary.data.stats.healthScore.toString()) >= 70 ? 'text-green-600' : 'text-red-600'
									}`}>{patientSummary.data.stats.healthScore}/100</span>
								</div>
								<div className='flex items-center justify-end gap-2'>
									<span className='text-gray-600'>Risk Level:</span>
									<span className={`px-2 py-0.5 text-xs font-bold rounded ${
										patientSummary.data.stats.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
										'bg-yellow-100 text-yellow-700'
									}`}>{patientSummary.data.stats.riskLevel}</span>
								</div>
								<div className='text-right mt-1 text-sm text-gray-500'>
									DOB: {patientSummary.data.patient.dateOfBirth}
								</div>
							</div>
						</div>

						{/* Stats Grid */}
							<div className='grid grid-cols-4 gap-3'>
								<div className='bg-gray-50 rounded-lg p-3 text-center'>
									<div className='text-2xl font-bold text-gray-700'>{patientSummary.data.stats.totalLabs}</div>
									<div className='text-xs text-gray-500'>Recent Labs</div>
								</div>
								<div className='bg-red-50 rounded-lg p-3 text-center'>
									<div className='text-2xl font-bold text-red-600'>{patientSummary.data.stats.abnormalLabs}</div>
									<div className='text-xs text-red-500'>Abnormal</div>
								</div>
								<div className='bg-green-50 rounded-lg p-3 text-center'>
									<div className='text-2xl font-bold text-green-600'>{patientSummary.data.stats.activeMedications}</div>
									<div className='text-xs text-green-500'>Medications</div>
								</div>
								<div className='bg-yellow-50 rounded-lg p-3 text-center'>
									<div className='text-2xl font-bold text-yellow-600'>{patientSummary.data.stats.recentEmails}</div>
									<div className='text-xs text-yellow-500'>Recent Emails</div>
								</div>
							</div>						{/* Alerts */}
						{patientSummary.data.alerts && patientSummary.data.alerts.length > 0 && (
							<div className='bg-red-50 rounded-lg overflow-hidden'>
								<div className='bg-red-100 px-4 py-2'>
									<h3 className='text-red-700 font-semibold'>⚠️ Clinical Alerts:</h3>
								</div>
								<div className='p-4 space-y-3'>
									{patientSummary.data.alerts.map((alert: any, index: number) => (
										<div key={index} className='bg-white rounded-lg p-3 border border-red-100'>
											<div className='flex justify-between items-start'>
												<span className='font-medium flex-1'>{alert.message}</span>
												<div className='flex gap-2 ml-4'>
													<span className={`px-2 py-0.5 text-xs font-bold rounded ${
														alert.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
														alert.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
														'bg-blue-100 text-blue-700'
													}`}>{alert.severity}</span>
													{alert.action_required && (
														<span className='px-2 py-0.5 text-xs font-bold rounded bg-orange-100 text-orange-700'>
															ACTION REQUIRED
														</span>
													)}
												</div>
											</div>
											<div className='mt-1 text-xs text-gray-500'>
												Category: {alert.category} {alert.priority && `| ${alert.priority}`}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Labs */}
						<div>
							<h3 className='font-semibold mb-3'>🧪 Recent Lab Results:</h3>
							<div className='space-y-2'>
								{patientSummary.data.recentLabs.map((lab: any, index: number) => (
									<div 
										key={index} 
										className={`p-3 rounded-lg ${lab.is_abnormal ? 'bg-red-50' : 'bg-gray-50'}`}
									>
										<div className='flex justify-between items-start'>
											<div>
												<div className='font-medium'>
													{lab.test_name}
													<span className='text-sm text-gray-500 ml-2'>({lab.lab_date})</span>
												</div>
												{lab.ai_interpretation && (
													<div className='text-xs text-blue-600 mt-1'>
														ℹ️ Analysis: {lab.ai_interpretation}
													</div>
												)}
											</div>
											<div className='text-right'>
												<span className={`font-bold ${lab.is_abnormal ? 'text-red-600' : 'text-gray-700'}`}>
													{lab.value} {lab.unit}
												</span>
												{lab.is_abnormal && (
													<span className='ml-2 px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700'>
														{lab.abnormal_type?.toUpperCase()}
													</span>
												)}
											</div>
										</div>
									</div>
								))}
								{patientSummary.data.recentLabs.length === 0 && (
									<div className='text-center text-gray-500 py-4'>
										No recent lab results available
									</div>
								)}
							</div>
						</div>

						{/* Medications */}
						<div>
							<h3 className='font-semibold mb-3'>💊 Active Medications:</h3>
							<div className='space-y-2'>
								{patientSummary.data.medications.map((med: any, index: number) => (
									<div key={index} className='p-3 rounded-lg bg-green-50'>
										<div className='flex justify-between items-start'>
											<div>
												<span className='font-medium'>{med.medication_name}</span>
												{med.warning && (
													<div className='text-xs text-yellow-600 mt-1'>
														⚠️ {med.warning}
													</div>
												)}
											</div>
											<div className='text-sm text-gray-600'>
												{med.dosage} - {med.frequency}
											</div>
										</div>
									</div>
								))}
								{patientSummary.data.medications.length === 0 && (
									<div className='text-center text-gray-500 py-4'>
										No active medications
									</div>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className='p-6 text-center'>
						<div className='text-gray-400'>
							<svg className='w-12 h-12 mx-auto mb-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
							</svg>
							<p className='text-sm'>Select a patient and press</p>
							<kbd className='mt-2 inline-block px-2 py-1 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded'>⌘K</kbd>
							<p className='mt-2 text-sm'>to view their summary</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// Export the component directly - Cedar is already configured at root level
export default EmailPortal;
