/** Datos de contacto para Support. Configurables por environment si se requiere. */
export const SUPPORT_CONTACT = {
  phone: '+1 (555) 123-4567',
  email: 'support@bakitchenandbathdesign.com',
  web: 'https://bakitchenandbathdesign.com',
  smsNumber: '+15551234567'
} as const;

export const SUPPORT_FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I view my project estimate?',
    answer: 'Go to My Projects, select your project, and tap on the estimate you want to review. You can approve or request changes from there.'
  },
  {
    question: 'How do I approve an estimate?',
    answer: 'Open the estimate from your project, review the details, and tap "Approve" when ready. You will receive a confirmation.'
  },
  {
    question: 'How do I schedule or confirm an appointment?',
    answer: 'Appointments are created by our team. You will receive an SMS and in-app notification. Open the project and tap "Confirm" on the appointment to confirm.'
  },
  {
    question: 'How can I contact support?',
    answer: 'Use the contact options above: call, email, or send an SMS. We typically respond within 24 hours on business days.'
  },
  {
    question: 'Where can I find my documents and photos?',
    answer: 'In your project, go to Documents to see all files, photos, and the proposal PDF.'
  }
];
