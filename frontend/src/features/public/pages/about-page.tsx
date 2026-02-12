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

        <div className="mt-8 rounded-xl border border-slate-200/80 bg-white p-4 shadow-lg overflow-hidden" aria-hidden="true">
          <svg viewBox="0 0 520 320" className="w-full h-auto" role="img" aria-label="Pipeline illustration">
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
