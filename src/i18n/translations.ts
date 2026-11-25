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
  dashboard: {
    healthOverview: string;
    last6Months: string;
    last3Months: string;
    retinalResult: string;
    preventionProgramme: string;
    upcomingAppointments: string;
    quickActions: string;
    healthInsights: string;
    alertsNotifications: string;
    systemStatus: string;
    allSystemsOnline: string;
    offlineModeAvailable: string;
    offlineModeDesc: string;
    viewReport: string;
    viewAll: string;
    continueProgramme: string;
    takeAssessment: string;
    uploadImage: string;
    viewReports: string;
    bookAppointment: string;
    riskScore: string;
    activity: string;
    sleep: string;
    lowRisk: string;
    moderateRisk: string;
    highRisk: string;
    notAssessed: string;
    noDrDetected: string;
    drDetected: string;
    pendingReview: string;
    allGood: string;
    actionRequired: string;
    noAppointments: string;
    noNotifications: string;
    noScreeningsYet: string;
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
    dashboard: {
      healthOverview: 'Health Overview',
      last6Months: 'Last 6 Months',
      last3Months: 'Last 3 Months',
      retinalResult: 'Retinal Screening Result',
      preventionProgramme: 'Prevention Programme',
      upcomingAppointments: 'Upcoming Appointments',
      quickActions: 'Quick Actions',
      healthInsights: 'Health Insights',
      alertsNotifications: 'Alerts & Notifications',
      systemStatus: 'System Status',
      allSystemsOnline: 'All Systems Online',
      offlineModeAvailable: 'Offline Mode Available',
      offlineModeDesc: 'Access core features without internet',
      viewReport: 'View Report →',
      viewAll: 'View All →',
      continueProgramme: 'Continue Programme →',
      takeAssessment: 'Risk\nAssessment',
      uploadImage: 'Upload\nImage',
      viewReports: 'View\nReports',
      bookAppointment: 'Book\nVisit',
      riskScore: 'Risk Score',
      activity: 'Activity',
      sleep: 'Sleep',
      lowRisk: 'Low Risk',
      moderateRisk: 'Moderate Risk',
      highRisk: 'High Risk',
      notAssessed: 'Not Assessed',
      noDrDetected: 'No DR Detected',
      drDetected: 'DR Detected',
      pendingReview: 'Pending Doctor Review',
      allGood: 'Care Plan on Track',
      actionRequired: 'Action Required',
      noAppointments: 'No upcoming appointments scheduled',
      noNotifications: 'No active alerts for your profile',
      noScreeningsYet: 'No retinal screenings recorded yet',
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
    dashboard: {
      healthOverview: 'உடல்நல மேலோட்டம்',
      last6Months: 'கடந்த 6 மாதங்கள்',
      last3Months: 'கடந்த 3 மாதங்கள்',
      retinalResult: 'விழித்திரை பரிசோதனை முடிவு',
      preventionProgramme: 'தடுப்பு திட்டம்',
      upcomingAppointments: 'வரவிருக்கும் சந்திப்புகள்',
      quickActions: 'விரைவு நடவடிக்கைகள்',
      healthInsights: 'சுகாதார நுண்ணறிவு',
      alertsNotifications: 'எச்சரிக்கைகள் & அறிவிப்புகள்',
      systemStatus: 'கணினி நிலை',
      allSystemsOnline: 'அனைத்து அமைப்புகளும் இணைப்பில் உள்ளன',
      offlineModeAvailable: 'ஆஃப்லைன் பயன்முறை உள்ளது',
      offlineModeDesc: 'இணையம் இல்லாமல் முக்கிய அம்சங்களைப் பயன்படுத்துங்கள்',
      viewReport: 'அறிக்கையைக் காண்க →',
      viewAll: 'அனைத்தையும் காண்க →',
      continueProgramme: 'திட்டத்தைத் தொடரவும் →',
      takeAssessment: 'ஆபத்து\nமதிப்பீடு',
      uploadImage: 'படம்\nபதிவேற்றுக',
      viewReports: 'அறிக்கைகள்\nகாண்க',
      bookAppointment: 'சந்திப்பு\nமுன்பதிவு',
      riskScore: 'ஆபத்து மதிப்பெண்',
      activity: 'செயல்பாடு',
      sleep: 'தூக்கம்',
      lowRisk: 'குறைந்த ஆபத்து',
      moderateRisk: 'நடுத்தர ஆபத்து',
      highRisk: 'அதிக ஆபத்து',
      notAssessed: 'மதிப்பிடப்படவில்லை',
      noDrDetected: 'விழித்திரை பாதிப்பு இல்லை',
      drDetected: 'விழித்திரை பாதிப்பு கண்டறியப்பட்டது',
      pendingReview: 'மருத்துவர் மதிப்பாய்வு நிலுவையில்',
      allGood: 'பராமரிப்பு சீராக உள்ளது',
      actionRequired: 'நடவடிக்கை தேவை',
      noAppointments: 'வரவிருக்கும் சந்திப்புகள் எதுவும் இல்லை',
      noNotifications: 'புதிய அறிவிப்புகள் எதுவும் இல்லை',
      noScreeningsYet: 'விழித்திரை பரிசோதனை எதுவும் இல்லை',
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
    dashboard: {
      healthOverview: 'स्वास्थ्य अवलोकन',
      last6Months: 'पिछले 6 महीने',
      last3Months: 'पिछले 3 महीने',
      retinalResult: 'रेटिना स्क्रीनिंग परिणाम',
      preventionProgramme: 'रोकथाम कार्यक्रम',
      upcomingAppointments: 'आगामी अपॉइंटमेंट्स',
      quickActions: 'त्वरित कार्रवाई',
      healthInsights: 'स्वास्थ्य अंतर्दृष्टि',
      alertsNotifications: 'अलर्ट और सूचनाएं',
      systemStatus: 'सिस्टम स्थिति',
      allSystemsOnline: 'सभी सिस्टम ऑनलाइन हैं',
      offlineModeAvailable: 'ऑफ़लाइन मोड उपलब्ध',
      offlineModeDesc: 'इंटरनेट के बिना मुख्य सुविधाएं उपयोग करें',
      viewReport: 'रिपोर्ट देखें →',
      viewAll: 'सभी देखें →',
      continueProgramme: 'कार्यक्रम जारी रखें →',
      takeAssessment: 'जोखिम\nमूल्यांकन',
      uploadImage: 'छवि\nअपलोड करें',
      viewReports: 'रिपोर्ट्स\nदेखें',
      bookAppointment: 'अपॉइंटमेंट\nबुक करें',
      riskScore: 'जोखिम स्कोर',
      activity: 'गतिविधि',
      sleep: 'नींद',
      lowRisk: 'कम जोखिम',
      moderateRisk: 'मध्यम जोखिम',
      highRisk: 'उच्च जोखिम',
      notAssessed: 'मूल्यांकन नहीं हुआ',
      noDrDetected: 'डीआर नहीं पाया गया',
      drDetected: 'डीआर पाया गया',
      pendingReview: 'डॉक्टर समीक्षा लंबित',
      allGood: 'सब ठीक है',
      actionRequired: 'कार्रवाई आवश्यक',
      noAppointments: 'कोई आगामी अपॉइंटमेंट नहीं',
      noNotifications: 'कोई नई सूचना नहीं',
      noScreeningsYet: 'कोई रेटिना स्क्रीनिंग नहीं',
    },
  },
};
