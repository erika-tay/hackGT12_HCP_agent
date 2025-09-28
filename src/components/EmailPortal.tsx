'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Send } from "lucide-react";
import { useSpell, ActivationMode, Hotkey } from 'cedar-os';



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
    if (!selectedEmail) {
      alert('Please select a patient email first!');
      return;
    }
    
    fetchPatientSummaryWithMastra(selectedEmail.id);
  };  const selectedPatient = mockPatients.find(p => p.id === selectedPatientId);



  return (
    <>
      {selectedEmail && (
        <LabSpell 
          selectedPatientId={selectedEmail.id}
          onFetchSummary={fetchPatientSummaryWithMastra}
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
    </>
  );
};

interface LabSpellProps {
  selectedPatientId: string;
  onFetchSummary: (patientId: string) => void;
}

function LabSpell({ selectedPatientId, onFetchSummary }: LabSpellProps) {
  const [loading, setLoading] = useState(false);
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [query, setQuery] = useState('');

  const { isActive, deactivate } = useSpell({
    id: 'lab-spell',
    activationConditions: {
      events: ['cmd+k'],
      mode: ActivationMode.TOGGLE,
    },
    onActivate: async () => {
      if (selectedPatientId) {
        setLoading(true);
        try {
          const response = await fetch(`http://localhost:4001/api/patient/${selectedPatientId}/summary`);
          const result = await response.json();
          if (result.success) {
            setPatientSummary(result);
          } else {
            alert(`Mastra Agent Error: ${result.error}`);
          }
        } catch (error: any) {
          alert(`Network error: ${error.message}`);
        } finally {
          setLoading(false);
        }
      } else {
        alert('Please select a patient first!');
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
							<h2 className='text-lg font-semibold'>📊 Patient Summary</h2>
						</div>
						<button 
							onClick={deactivate}
							className='p-2 hover:bg-gray-100 rounded-full'
						>
							<span className='text-gray-500'>×</span>
						</button>
					</div>
					<div className='px-6 pb-4 text-sm text-gray-500 flex items-center gap-2'>
						<span className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></span>
						Auto-generated Report
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

export default EmailPortal;
