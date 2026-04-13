import { useState } from 'react';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    // Store acceptance in localStorage
    localStorage.setItem('privacy_accepted_at', new Date().toISOString());
    localStorage.setItem('privacy_version', '1.0');

    // Notify backend
    fetch('/api/v1/users/accept-privacy', {
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
          <h1 className="text-xl font-bold text-white">Privacy Policy</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-[#0B0F1A] border border-[#00FFB2]/20 rounded-xl p-6 space-y-6">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-[#00FFB2]">1. Information We Collect</h2>
            <ul>
              <li><strong>Personal Information:</strong> Name, phone, email, address</li>
              <li><strong>KYC Information:</strong> PAN, Aadhaar, bank account details</li>
              <li><strong>Usage Data:</strong> Predictions, bets, login history, IP address</li>
              <li><strong>Device Information:</strong> Device type, OS, browser</li>
            </ul>

            <h2 className="text-[#00FFB2]">2. How We Use Your Information</h2>
            <ul>
              <li>To provide and improve services</li>
              <li>KYC verification and compliance</li>
              <li>Fraud detection and prevention</li>
              <li>Customer support</li>
              <li>Legal compliance</li>
            </ul>

            <h2 className="text-[#00FFB2]">3. Data Security</h2>
            <ul>
              <li>End-to-end encryption for sensitive data</li>
              <li>PCI-DSS compliance for payment data</li>
              <li>Regular security audits</li>
              <li>Secure data centers with backups</li>
            </ul>

            <h2 className="text-[#00FFB2]">4. Your Rights</h2>
            <ul>
              <li>Right to access your data</li>
              <li>Right to correct inaccurate data</li>
              <li>Right to request data deletion (within legal limits)</li>
              <li>Right to opt-out of marketing</li>
            </ul>

            <h2 className="text-[#00FFB2]">5. Third-Party Services</h2>
            <p>We use trusted providers:</p>
            <ul>
              <li>Razorpay - Payments (PCI-DSS compliant)</li>
              <li>Appwrite - Authentication & Storage</li>
              <li>Nhost - Database Management</li>
            </ul>

            <h2 className="text-[#00FFB2]">6. Data Retention</h2>
            <ul>
              <li>Account data: Retained during active account + 5 years post-deletion</li>
              <li>Transaction data: Retained for 7 years (tax/regulatory requirement)</li>
              <li>Cookie data: Deleted after 30 days of inactivity</li>
            </ul>

            <h2 className="text-[#00FFB2]">7. Legal Compliance</h2>
            <ul>
              <li><strong>GDPR:</strong> Compliant for EU users</li>
              <li><strong>DPDP Act:</strong> Compliant with India's Digital Personal Data Protection</li>
              <li><strong>KYC/AML:</strong> Full compliance with regulatory requirements</li>
            </ul>

            <h2 className="text-[#00FFB2]">8. Contact</h2>
            <p>For privacy concerns: <strong>privacy@crikex.app</strong></p>

            <h2 className="text-[#00FFB2]">Effective Date</h2>
            <p>This policy is effective from January 1, 2026</p>
          </div>

          {/* Key Security Features */}
          <div className="bg-[#060A14]/50 border border-[#00FFB2]/20 rounded-lg p-4 space-y-3">
            <h3 className="text-[#00FFB2] font-bold flex items-center gap-2">
              <CheckCircle size={20} /> Your Data is Protected
            </h3>
            <ul className="space-y-2 text-[#A0AEC0] text-sm">
              <li>✓ All payments encrypted with PCI-DSS</li>
              <li>✓ KYC data encrypted and stored securely</li>
              <li>✓ Regular security audits and penetration testing</li>
              <li>✓ GDPR & DPDP Act compliant</li>
            </ul>
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
              <span className="text-[#A0AEC0]">I accept the Privacy Policy</span>
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
