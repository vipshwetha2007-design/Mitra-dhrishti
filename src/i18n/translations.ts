import type { LanguageCode } from '../types/domain';

export interface TranslationBundle {
  appTagline: string;
  clinicalBoundaryShort: string;
  nav: {
    dashboard: string;
    prevent: string;
    preventSub: string;
    detect: string;
    detectSub: string;
    protect: string;
    protectSub: string;
    reports: string;
    appointments: string;
    referrals: string;
    notifications: string;
    offline: string;
    simulink: string;
    settings: string;
  };
  topbar: {
    searchPlaceholder: string;
    online: string;
    offline: string;
    syncPending: string;
    switchRole: string;
    signIn: string;
  };
  hero: {
    welcomeBack: string;
    subtitle: string;
    tagline: string;
    exploreCta: string;
  };
  pillars: {
    preventTitle: string;
    preventDesc: string;
    detectTitle: string;
    detectDesc: string;
    protectTitle: string;
    protectDesc: string;
  };
}

export const TRANSLATIONS: Record<LanguageCode, TranslationBundle> = {
  en: {
    appTagline: 'Prevent • Detect • Protect',
    clinicalBoundaryShort:
      'Screening & care-coordination prototype only — not a diagnostic replacement. All clinical decisions remain with authorised healthcare professionals.',
    nav: {
      dashboard: 'Dashboard',
      prevent: 'Prevent',
      preventSub: 'Diabetes Care',
      detect: 'Detect',
      detectSub: 'Retinal Screening',
      protect: 'Protect',
      protectSub: 'Clinical Follow-up',
      reports: 'My Reports',
      appointments: 'Appointments',
      referrals: 'Referrals',
      notifications: 'Notifications',
      offline: 'Offline Sync',
      simulink: 'Simulink Analytics',
      settings: 'Settings',
    },
    topbar: {
      searchPlaceholder: 'Search patients, reports, or services...',
      online: 'Online',
      offline: 'Offline Mode',
      syncPending: 'pending sync',
      switchRole: 'Switch Role / Account',
      signIn: 'Sign In',
    },
    hero: {
      welcomeBack: 'Welcome back',
      subtitle: 'Your health. Our priority.',
      tagline: 'Prevent diabetes risk. Support retinal screening. Protect continuity of care.',
      exploreCta: 'Explore Your Health',
    },
    pillars: {
      preventTitle: 'PREVENT',
      preventDesc: 'Manage Type 2 Diabetes Risk',
      detectTitle: 'DETECT',
      detectDesc: 'AI-Assisted Retinal Screening',
      protectTitle: 'PROTECT',
      protectDesc: 'Clinician Review & Follow-up',
    },
  },
  ta: {
    appTagline: 'தடுப்பு • கண்டறிதல் • பாதுகாப்பு',
    clinicalBoundaryShort:
      'இது சுகாதார பரிசோதனை மற்றும் பராமரிப்பு உதவி மாதிரி மட்டுமே — மருத்துவ நோயறிதலுக்கு மாற்று அல்ல. அனைத்து மருத்துவ முடிவுகளும் அங்கீகரிக்கப்பட்ட மருத்துவர்களால் எடுக்கப்படும்.',
    nav: {
      dashboard: 'முகப்பு',
      prevent: 'தடுப்பு (Prevent)',
      preventSub: 'நீரிழிவு பராமரிப்பு',
      detect: 'கண்டறிதல் (Detect)',
      detectSub: 'விழித்திரை பரிசோதனை',
      protect: 'பாதுகாப்பு (Protect)',
      protectSub: 'மருத்துவ பின்தொடர்தல்',
      reports: 'அறிக்கைகள்',
      appointments: 'சந்திப்புகள்',
      referrals: 'பரிந்துரைகள்',
      notifications: 'அறிவிப்புகள்',
      offline: 'ஆஃப்லைன் ஒத்திசைவு',
      simulink: 'சிமுலிங்க் பகுப்பாய்வு',
      settings: 'அமைப்புகள்',
    },
    topbar: {
      searchPlaceholder: 'நோயாளிகள், அறிக்கைகள் அல்லது சேவைகளைத் தேடுங்கள்...',
      online: 'இணைப்பில்',
      offline: 'ஆஃப்லைன் நிலை',
      syncPending: 'ஒத்திசைவு நிலுவையில்',
      switchRole: 'பயனர் பங்கு மாற்று',
      signIn: 'உள்நுழைக',
    },
    hero: {
      welcomeBack: 'மீண்டும் வருக',
      subtitle: 'உங்கள் நலம். எங்கள் முன்னுரிமை.',
      tagline: 'நீரிழிவு அபாயத்தைத் தடுக்கவும். விழித்திரை பரிசோதனையை ஆதரிக்கவும். தொடர் பராமரிப்பைப் பாதுகாக்கவும்.',
      exploreCta: 'உங்கள் நலனை ஆராய்க',
    },
    pillars: {
      preventTitle: 'தடுப்பு · PREVENT',
      preventDesc: 'நீரிழிவு வாழ்க்கைமுறை அபாய மேலாண்மை',
      detectTitle: 'கண்டறிதல் · DETECT',
      detectDesc: 'AI உதவி விழித்திரை பரிசோதனை',
      protectTitle: 'பாதுகாப்பு · PROTECT',
      protectDesc: 'மருத்துவர் மதிப்பாய்வு & பின்தொடர்தல்',
    },
  },
  // Hindi architecture ready — falls back cleanly to English strings until clinical Tamil/Hindi localization review completes
  hi: {
    appTagline: 'रोकथाम • पहचान • सुरक्षा',
    clinicalBoundaryShort:
      'यह केवल स्वास्थ्य स्क्रीनिंग और देखभाल सहायता प्रोटोटाइप है — नैदानिक निदान का विकल्प नहीं। (Hindi localization scaffold active)',
    nav: {
      dashboard: 'डैशबोर्ड',
      prevent: 'Prevent (रोकथाम)',
      preventSub: 'मधुमेह देखभाल',
      detect: 'Detect (पहचान)',
      detectSub: 'रेटिना स्क्रीनिंग',
      protect: 'Protect (सुरक्षा)',
      protectSub: 'क्लिनिकल फॉलो-अप',
      reports: 'रिपोर्ट्स',
      appointments: 'अपॉइंटमेंट्स',
      referrals: 'रेफरल',
      notifications: 'सूचनाएं',
      offline: 'ऑफ़लाइन सिंक',
      simulink: 'सिमुलिंक विश्लेषण',
      settings: 'सेटिंग्स',
    },
    topbar: {
      searchPlaceholder: 'रोगी, रिपोर्ट या सेवाएं खोजें...',
      online: 'ऑनलाइन',
      offline: 'ऑफ़लाइन मोड',
      syncPending: 'सिंक लंबित',
      switchRole: 'भूमिका बदलें',
      signIn: 'साइन इन',
    },
    hero: {
      welcomeBack: 'वापसी पर स्वागत है',
      subtitle: 'आपका स्वास्थ्य। हमारी प्राथमिकता।',
      tagline: 'मधुमेह जोखिम रोकें। रेटिना स्क्रीनिंग का समर्थन करें। निरंतर देखभाल सुनिश्चित करें।',
      exploreCta: 'स्वास्थ्य देखें',
    },
    pillars: {
      preventTitle: 'PREVENT (रोकथाम)',
      preventDesc: 'मधुमेह जोखिम प्रबंधन',
      detectTitle: 'DETECT (पहचान)',
      detectDesc: 'AI-सहायता प्राप्त रेटिना स्क्रीनिंग',
      protectTitle: 'PROTECT (सुरक्षा)',
      protectDesc: 'डॉक्टर समीक्षा और फॉलो-अप',
    },
  },
};
