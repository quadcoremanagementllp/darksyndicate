import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Dark Syndicate Gaming World handles account, booking, payment, and contact information.',
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      description="This policy explains what information we use to operate the website, manage bookings, and respond to customers."
      currentPath="/privacy-policy"
    >
      <PolicySection title="Information we collect">
        <p>When you register, book, or contact us, we may collect your name, email address, phone number, account details, selected station and session time, player count, messages, and booking history. We also keep payment status, amount, and gateway transaction identifiers so we can reconcile payments and refunds.</p>
        <p>For staff accounts, we may additionally collect work contact details, residential address, identification information and uploaded KYC documents needed for onboarding and access control.</p>
      </PolicySection>
      <PolicySection title="How we use information">
        <p>We use this information to create accounts, confirm reservations, check players in, deliver digital passes, process payments and refunds, provide support, send booking or service alerts, protect the website, and maintain financial and security records.</p>
      </PolicySection>
      <PolicySection title="Payments and service providers">
        <p>Razorpay processes online payments. We receive payment results and transaction references, but we do not store your card number, CVV, UPI PIN, or online banking password. We may share the information necessary to run the site with payment, hosting, email, and notification providers, and with authorities when legally required.</p>
      </PolicySection>
      <PolicySection title="Cookies, storage, and notifications">
        <p>The site uses essential browser storage and session information to keep you signed in and remember interface preferences. If you enable browser notifications, we use that permission to send relevant service alerts; you can turn it off in your browser settings.</p>
      </PolicySection>
      <PolicySection title="Retention and your choices">
        <p>We keep records for as long as needed to provide services, resolve disputes, maintain accounting and security records, and meet legal obligations. You can update your account details in your profile. Contact us to request access, correction, or deletion of personal information; some transaction records may need to be retained for legal or accounting reasons.</p>
      </PolicySection>
      <PolicySection title="Security and changes">
        <p>We use access controls and other reasonable safeguards to protect information. No online system can guarantee absolute security. If this policy changes, the updated version and date will appear on this page.</p>
      </PolicySection>
    </PolicyPage>
  );
}
