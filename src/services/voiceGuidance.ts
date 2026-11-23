/**
 * MRITIDHRISTI — PREVENT • DETECT • PROTECT
 * Regional Language Voice Guidance & Read-Aloud Accessibility Engine
 * File: src/services/voiceGuidance.ts
 * Problem Statement: SIH26038 — Explainable AI for DR Screening in Rural India
 * Supported Locales: Tamil (ta-IN), Hindi (hi-IN), English (en-IN)
 */

export interface VoicePrompt {
  id: string;
  category: 'prevent_wizard' | 'screening_result' | 'appointment_reminder' | 'clinic_guidance';
  texts: {
    ta: string;
    hi: string;
    en: string;
  };
}

export const CLINICAL_VOICE_PROMPTS: Record<string, VoicePrompt> = {
  lifestyle_intro: {
    id: 'lifestyle_intro',
    category: 'prevent_wizard',
    texts: {
      ta: 'வணக்கம். உங்கள் வாழ்க்கைமுறை மற்றும் நீரிழிவு அபாய மதிப்பீட்டைத் தொடங்குவோம். ஒவ்வொரு கேள்விக்கும் பதிலளிக்கவும்.',
      hi: 'नमस्ते। आइए अपनी जीवनशैली और मधुमेह जोखिम मूल्यांकन शुरू करें। कृपया प्रत्येक प्रश्न का उत्तर दें।',
      en: 'Welcome. Let us begin your lifestyle and diabetes risk assessment. Please answer each question.',
    },
  },
  retinal_capture_instruction: {
    id: 'retinal_capture_instruction',
    category: 'clinic_guidance',
    texts: {
      ta: 'கண் பரிசோதனை துவங்குகிறது. பச்சை நிற ஒளியை உற்று நோக்கவும். கண் சிமிட்டாமல் நேராக பார்க்கவும்.',
      hi: 'आंखों की जांच शुरू हो रही है। कृपया हरी बत्ती पर ध्यान केंद्रित करें और सीधे देखें।',
      en: 'Eye screening beginning. Please focus on the green internal fixation target and hold steady.',
    },
  },
  screening_routine: {
    id: 'screening_routine',
    category: 'screening_result',
    texts: {
      ta: 'உங்கள் விழித்திரை படம் சாதாரணமாக உள்ளது. அடுத்த பரிசோதனை ஓராண்டு கழித்து செய்யப்படும்.',
      hi: 'आपकी रेटिना जांच सामान्य है। अगली जांच एक वर्ष बाद निर्धारित है।',
      en: 'Your retinal scan shows no apparent diabetic retinopathy. Routine follow-up scheduled in 12 months.',
    },
  },
  screening_referral: {
    id: 'screening_referral',
    category: 'screening_result',
    texts: {
      ta: 'உங்கள் விழித்திரையில் மாற்றங்கள் கண்டறியப்பட்டுள்ளன. மாவட்ட கண் மருத்துவரிடம் விரிவான பரிசோதனைக்கு பரிந்துரைக்கப்படுகிறீர்கள்.',
      hi: 'आपकी रेटिना में बदलाव देखे गए हैं। आपको जिला अस्पताल में नेत्र रोग विशेषज्ञ के पास भेजा जा रहा है।',
      en: 'Retinal changes detected. You have been referred for comprehensive specialist ophthalmology evaluation.',
    },
  },
  appointment_reminder: {
    id: 'appointment_reminder',
    category: 'appointment_reminder',
    texts: {
      ta: 'நினைவூட்டல்: உங்கள் கண் மருத்துவ பரிசோதனைக்கான தேதி நெருங்குகிறது. கிராம சுகாதார செவிலியர் உங்களுடன் வருவார்.',
      hi: 'याद दिलाना: आपकी नेत्र जांच की तारीख नजदीक आ रही है। स्वास्थ्य कार्यकर्ता आपकी सहायता करेंगे।',
      en: 'Reminder: Your eye clinic appointment is scheduled soon. Your village health nurse will assist you.',
    },
  },
};

class VoiceGuidanceService {
  private isSpeaking = false;
  private currentLanguage: 'ta' | 'hi' | 'en' = 'ta';

  public setLanguage(lang: 'ta' | 'hi' | 'en') {
    this.currentLanguage = lang;
  }

  public getLanguage(): 'ta' | 'hi' | 'en' {
    return this.currentLanguage;
  }

  /**
   * Speaks the localized text for a registered clinical prompt or raw text.
   */
  public speak(promptOrText: string, langOverride?: 'ta' | 'hi' | 'en'): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.log('[VoiceGuidance Audio Simulation]:', promptOrText);
        return resolve(true);
      }

      const lang = langOverride || this.currentLanguage;
      let textToSpeak = promptOrText;

      if (CLINICAL_VOICE_PROMPTS[promptOrText]) {
        textToSpeak = CLINICAL_VOICE_PROMPTS[promptOrText].texts[lang] || CLINICAL_VOICE_PROMPTS[promptOrText].texts.en;
      }

      window.speechSynthesis.cancel(); // Cancel any prior utterances

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const bcpLangMap = { ta: 'ta-IN', hi: 'hi-IN', en: 'en-IN' };
      utterance.lang = bcpLangMap[lang] || 'en-IN';
      utterance.rate = 0.90; // Slightly slower for clarity in rural health outreach
      utterance.pitch = 1.0;

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve(true);
      };

      utterance.onerror = (e) => {
        console.warn('VoiceGuidance utterance error:', e);
        this.isSpeaking = false;
        resolve(false);
      };

      this.isSpeaking = true;
      window.speechSynthesis.speak(utterance);
    });
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public speaking(): boolean {
    return this.isSpeaking;
  }
}

export const voiceGuidance = new VoiceGuidanceService();
