import { Button } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { PublicFooter } from '../../../components/public-footer';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <section className="landing-page">
      <div className="landing-shell">

        <div className="landing-hero-card">
          <div className="landing-hero">
            <p className="landing-hero-kicker">Tracefield Lab</p>
            <h1 className="landing-hero-title">
              Build, analyze, and share research pipelines with secure traceability.
            </h1>
            <p className="landing-hero-copy">
              A modular pipeline for multi-dataset analysis—ingest heterogeneous sources,
              map entities across them with semantic resolution, and run correlation and
              analysis jobs in one auditable workspace. Built for finding patterns that
              emerge only when you can cross-reference siloed research.
            </p>
          </div>

          <div className="landing-hero-card-visual" aria-hidden="true">
            <img
              src="/images/main.png"
              alt="Entity Resolver: data ingestion, entity mapping, and statistical analysis pipeline"
              className="w-full h-auto rounded-2xl object-contain"
            />
          </div>
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
