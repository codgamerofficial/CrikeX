import logger from '../utils/logger.js';

/**
 * Track user's acceptance of Terms & Privacy policies
 */
export class AcceptanceTracker {
  constructor() {
    // In-memory store, should be persisted to Nhost in production
    this.acceptances = new Map();
  }

  /**
   * Record T&C and Privacy Policy acceptance
   */
  recordAcceptance(userId, version = '1.0') {
    const record = {
      userId,
      termsVersion: version,
      privacyVersion: version,
      acceptedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    };

    this.acceptances.set(userId, record);

    logger.info('User acceptance recorded', {
      userId,
      version,
      timestamp: record.acceptedAt,
    });

    return record;
  }

  /**
   * Check if user has accepted current version
   */
  hasAccepted(userId, version = '1.0') {
    const record = this.acceptances.get(userId);
    return record && record.termsVersion === version && record.privacyVersion === version;
  }

  /**
   * Get user's acceptance history
   */
  getAcceptanceHistory(userId) {
    return this.acceptances.get(userId) || null;
  }

  /**
   * Update acceptance (when new versions released)
   */
  updateAcceptance(userId, version = '1.0') {
    const existing = this.acceptances.get(userId);
    const updated = {
      ...existing,
      termsVersion: version,
      privacyVersion: version,
      acceptedAt: new Date(),
    };

    this.acceptances.set(userId, updated);
    return updated;
  }
}

export const acceptanceTracker = new AcceptanceTracker();

/**
 * Terms & Privacy Policy Versions
 */
export const POLICIES = {
  terms: {
    version: '1.0',
    effectiveDate: '2026-01-01',
    content: `
# Terms of Service - CrikeX Fantasy Cricket

## 1. Acceptance of Terms
By accessing and using CrikeX, you accept and agree to be bound by the terms and provision of this agreement.

## 2. User Eligibility
- Must be 18 years of age or older
- Must have valid KYC (Identity verification)
- Must be a resident of a state where CrikeX is legally available
- Must not be restricted by applicable laws

## 3. Fantasy Cricket & Predictions
- CrikeX is a skill-based prediction platform, not gambling
- Results are determined by user knowledge, analysis, and prediction accuracy
- Winnings are returned based on performance in contests and predictions
- No real-time betting or bookmaking services offered

## 4. Deposits and Withdrawals
- Minimum deposit: ₹100
- Deposits processed via Razorpay
- Withdrawals require KYC verification
- TDS (30%) applicable on winnings as per Indian regulations
- Withdrawal processing time: 1-2 business days

## 5. Responsible Usage
- Users must set betting limits as available in settings
- Self-exclusion option available for problem gamers
- Reality check reminders enabled by default
- Fraudulent activity will result in account termination

## 6. Prohibited Activities
- Collusion or coordinated betting
- Use of multiple accounts
- Automated betting scripts or bots
- Unauthorized access or hacking attempts
- Abusive or harassing behavior

## 7. Dispute Resolution
- Disputes resolved through support team
- Arbitration for unresolved issues
- Contact: support@crikex.app

## 8. Limitation of Liability
CrikeX is provided "as is" without warranties. We're not liable for losses or damages.

## 9. Changes to Terms
We reserve the right to modify these terms. Users will be notified of changes.

## 10. Governing Law
These terms are governed by Indian law.
    `,
  },
  privacy: {
    version: '1.0',
    effectiveDate: '2026-01-01',
    content: `
# Privacy Policy - CrikeX

## 1. Information We Collect
- Personal Information: Name, phone, email, address
- KYC Information: PAN, Aadhaar, bank account details
- Usage Data: Predictions, bets, login history, IP address
- Device Information: Device type, OS, browser

## 2. How We Use Your Information
- To provide and improve services
- KYC verification and compliance
- Fraud detection and prevention
- Customer support
- Marketing (with consent)
- Legal compliance

## 3. Data Security
- End-to-end encryption for sensitive data
- PCI-DSS compliance for payment data
- Regular security audits
- Secure data centers with backups

## 4. Your Rights
- Right to access your data
- Right to correct inaccurate data
- Right to request data deletion (within legal limits)
- Right to opt-out of marketing

## 5. Third-Party Services
We use:
- Razorpay for payments (not shared for other purposes)
- Appwrite for authentication
- Nhost for database
- Third parties bound by privacy agreements

## 6. Data Retention
- Account data: Retained during active account + 5 years post-deletion
- Transaction data: Retained for 7 years (tax/regulatory requirement)
- Cookie data: Deleted after 30 days of inactivity

## 7. Children's Privacy
CrikeX is not for users under 18. We don't knowingly collect data from minors.

## 8. GDPR & DPDP Compliance
- We comply with GDPR for EU users
- We comply with India's Digital Personal Data Protection Act
- Data Processing Agreements in place

## 9. Contact
For privacy concerns: privacy@crikex.app

## 10. Updates
This policy may be updated. Changes effective immediately upon posting.
    `,
  },
};

/**
 * Get rendered policy content
 */
export function getPolicyContent(type, version = '1.0') {
  const policy = POLICIES[type];
  if (!policy) return null;

  return {
    version: policy.version,
    effectiveDate: policy.effectiveDate,
    content: policy.content,
    type,
  };
}
