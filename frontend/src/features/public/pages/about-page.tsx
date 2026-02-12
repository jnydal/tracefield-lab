import { Link } from 'react-router-dom';
import { PublicFooter } from '../../../components/public-footer';

export function AboutPage() {
  return (
    <section className="landing-page">
      <div className="landing-shell">
        <div className="landing-hero">
          <p className="landing-hero-kicker">About</p>
          <h1 className="landing-hero-title">
            Tracefield Lab — research pipelines with traceability
          </h1>
          <p className="landing-hero-copy">
            A modular pipeline for multi-dataset analysis: ingestion, entity mapping,
            feature extraction, and statistical analysis in one configurable workspace.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-8 sm:border-slate-300 text-left space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">What it does</h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Tracefield Lab lets research teams register datasets, harmonize entities across
            sources, run embedding and trait workers, and execute analysis jobs with
            effect sizes and correction. Provenance and licensing metadata are tracked
            so workflows stay reproducible and auditable.
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Why this project</h2>
          <p className="text-slate-600 text-sm sm:text-base">
            This is an upskilling initiative: a place to explore
            full-stack pipeline tooling, from APIs and workers to a React front end,
            while keeping the result usable for real research workflows.
          </p>
          <p className="pt-2">
            <Link to="/" className="text-violet-600 hover:text-violet-800 hover:underline font-medium">
              ← Back to home
            </Link>
          </p>
        </div>

        <PublicFooter />
      </div>
    </section>
  );
}
