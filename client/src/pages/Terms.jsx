import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    // Store acceptance in localStorage
    localStorage.setItem('terms_accepted_at', new Date().toISOString());
    localStorage.setItem('terms_version', '1.0');

    // Also notify backend
    fetch('/api/v1/users/accept-terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '1.0' }),
    }).catch(() => {
      // Continue even if request fails
    });

    setAccepted(true);
    setTimeout(() => navigate(-1), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060A14] to-[#0B0F1A]">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-[#00FFB2]/20 bg-[#060A14]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#1E2640] rounded-lg">
            <ChevronLeft size={24} className="text-[#00FFB2]" />
          </button>
          <h1 className="text-xl font-bold text-white">Terms of Service</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-[#0B0F1A] border border-[#00FFB2]/20 rounded-xl p-6 space-y-6">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-[#00FFB2]">1. Acceptance of Terms</h2>
            <p>By accessing and using CrikeX, you accept and agree to be bound by the terms and provision of this agreement.</p>

            <h2 className="text-[#00FFB2]">2. User Eligibility</h2>
            <ul>
              <li>Must be 18 years of age or older</li>
              <li>Must have valid KYC (Identity verification)</li>
              <li>Must be a resident of a state where CrikeX is legally available</li>
              <li>Must not be restricted by applicable laws</li>
            </ul>

            <h2 className="text-[#00FFB2]">3. Fantasy Cricket & Predictions</h2>
            <p>CrikeX is a skill-based prediction platform, not gambling. Results are determined by user knowledge and prediction accuracy.</p>

            <h2 className="text-[#00FFB2]">4. Deposits and Withdrawals</h2>
            <ul>
              <li>Minimum deposit: ₹100</li>
              <li>TDS (30%) applicable on winnings</li>
              <li>Withdrawal processing: 1-2 business days</li>
            </ul>

            <h2 className="text-[#00FFB2]">5. Prohibited Activities</h2>
            <ul>
              <li>Collusion or coordinated betting</li>
              <li>Use of multiple accounts</li>
              <li>Automated betting scripts</li>
              <li>Unauthorized access attempts</li>
            </ul>

            <h2 className="text-[#00FFB2]">6. Dispute Resolution</h2>
            <p>Disputes resolved through support team at support@crikex.app</p>

            <h2 className="text-[#00FFB2]">7. Governing Law</h2>
            <p>These terms are governed by Indian law.</p>
          </div>

          {/* Acceptance Checkbox */}
          <div className="border-t border-[#00FFB2]/20 pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="w-5 h-5 accent-[#00FFB2]"
              />
              <span className="text-[#A0AEC0]">I accept the Terms of Service</span>
            </label>

            {accepted && (
              <button
                onClick={handleAccept}
                className="mt-4 w-full bg-[#00FFB2] text-[#060A14] font-bold py-3 rounded-lg hover:bg-[#00FFB2]/90 transition"
              >
                Continue ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
