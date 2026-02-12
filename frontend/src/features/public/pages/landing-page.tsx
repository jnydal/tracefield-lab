import { Button } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { PublicFooter } from '../../../components/public-footer';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <section className="landing-page">
      <div className="landing-shell">
        <div className="landing-hero">
          <p className="landing-hero-kicker">Tracefield Lab</p>
          <h1 className="landing-hero-title">
            Build, analyze, and share research pipelines with secure traceability.
          </h1>
          <p className="landing-hero-copy">
            Collect data, map entities, and run analysis jobs in a unified workspace
            for research teams that need both speed and control.
          </p>
        </div>

        <div className="landing-illustration" aria-hidden="true">
          <svg viewBox="0 0 520 320" role="img" aria-label="Pipeline illustrasjon">
            <rect x="20" y="20" width="480" height="280" rx="24" fill="#e2e8f0" />
            <rect x="60" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="200" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="340" y="70" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="120" y="190" width="120" height="76" rx="12" fill="#ffffff" />
            <rect x="280" y="190" width="120" height="76" rx="12" fill="#ffffff" />
            <path d="M180 108h20m80 0h20m80 0h20" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
            <path d="M240 146v24m0 0h80m0 0v24" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
            <path d="M180 228h20m80 0h20" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
            <circle cx="120" cy="108" r="6" fill="#7c3aed" />
            <circle cx="260" cy="108" r="6" fill="#7c3aed" />
            <circle cx="400" cy="108" r="6" fill="#7c3aed" />
            <circle cx="180" cy="228" r="6" fill="#7c3aed" />
            <circle cx="320" cy="228" r="6" fill="#7c3aed" />
          </svg>
        </div>

        <div className="landing-cta-card">
          <div>
            <h2 className="landing-cta-title">Sign in to start a new research run</h2>
            <p className="landing-cta-copy">
              Continue to sign in to manage datasets, entities, and analysis jobs.
            </p>
          </div>
          <div className="landing-cta-actions">
            <Button
              type="button"
              className="landing-cta-button"
              onClick={() => navigate('/login')}
            >
              Go to sign in
            </Button>
          </div>
        </div>

        <PublicFooter />
      </div>
    </section>
  );
}
