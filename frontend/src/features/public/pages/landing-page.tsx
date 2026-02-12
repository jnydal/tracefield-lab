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
          <img
            src="/images/main.png"
            alt="Entity Resolver: data ingestion, entity mapping, and statistical analysis pipeline"
            className="w-full h-auto rounded-2xl object-contain"
          />
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
