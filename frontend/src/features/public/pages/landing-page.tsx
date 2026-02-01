import { Button } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <section className="landing-page">
      <div className="landing-shell">
        <div className="landing-hero">
          <p className="landing-hero-kicker">Tracefield Lab</p>
          <h1 className="landing-hero-title">
            Bygg, analyser og del forskningspipelines med sikker sporbarhet.
          </h1>
          <p className="landing-hero-copy">
            Samle data, kartlegg entiteter og kjør analysejobber i ett samlet miljø
            for forskningsarbeid som trenger både tempo og kontroll.
          </p>
        </div>

        <div className="landing-illustration" aria-hidden="true">
          <svg viewBox="0 0 520 320" role="img" aria-label="Pipeline illustrasjon">
            <defs>
              <linearGradient id="landingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.12" />
              </linearGradient>
            </defs>
            <rect x="20" y="20" width="480" height="280" rx="24" fill="url(#landingGradient)" />
            <rect x="60" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="200" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="340" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="120" y="190" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="280" y="190" width="120" height="76" rx="12" fill="#ffffff" />
            <path d="M180 108h20m80 0h20m80 0h20" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <path d="M240 146v24m0 0h80m0 0v24" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <path d="M180 228h20m80 0h20" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <circle cx="120" cy="108" r="6" fill="#3b82f6" />
            <circle cx="260" cy="108" r="6" fill="#3b82f6" />
            <circle cx="400" cy="108" r="6" fill="#3b82f6" />
            <circle cx="180" cy="228" r="6" fill="#3b82f6" />
            <circle cx="320" cy="228" r="6" fill="#3b82f6" />
          </svg>
        </div>

        <div className="landing-cta-card">
          <div>
            <h2 className="landing-cta-title">Logg inn og start et nytt forskningsløp</h2>
            <p className="landing-cta-copy">
              Fortsett til innlogging for å administrere datasett, entiteter og
              analysejobber.
            </p>
          </div>
          <div className="landing-cta-actions">
            <Button
              type="button"
              className="landing-cta-button"
              onClick={() => navigate('/login')}
            >
              Gå til innlogging
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
