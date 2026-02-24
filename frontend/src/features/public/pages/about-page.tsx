import { Link } from 'react-router-dom';
import { PublicFooter } from '../../../components/public-footer';

export function AboutPage() {
  return (
    <section className="about-page">
      <div className="about-shell">
        <div className="about-hero-card">
          <div className="about-hero">
            <p className="about-hero-kicker">About</p>
            <h1 className="about-hero-title">
              Tracefield Lab — research pipelines with traceability
            </h1>
            <p className="about-hero-copy">
              A modular pipeline for multi-dataset analysis: ingestion, entity mapping,
              feature extraction, and statistical analysis in one configurable workspace.
            </p>
          </div>
          <div className="about-hero-card-visual" aria-hidden="true">
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
        </div>

        <div className="about-content-card">
          <div>
            <h2 className="about-content-title">What it does</h2>
            <p className="about-content-copy">
              Tracefield Lab lets research teams register datasets, harmonize entities across
              sources, run embedding and trait workers, and execute analysis jobs with
              effect sizes and correction. Entity resolution uses semantic embeddings (BGE)
              to match entities across datasets; an optional LLM can assist with schema
              inference from samples. Provenance and licensing metadata are tracked
              so workflows stay reproducible and auditable.
            </p>
            <h2 className="about-content-title">What makes it different</h2>
            <p className="about-content-copy">
              Most research tools work within a single dataset or domain. Tracefield Lab
              is built for correlation discovery across heterogeneous sources: different
              labs, disciplines, and formats that rarely get compared. Fixed ontologies
              — predefined taxonomies and vocabularies — are what create those silos and
              make cross-domain science hard: every community speaks its own schema.
              Tracefield goes beyond ontologies by using embeddings: semantic vectors
              let you match and relate entities by meaning, not by agreeing on a single
              vocabulary first. Entity resolution (exact keys plus semantic matching)
              then lets you map “the same thing” across datasets. The feature store and
              analysis layer surface correlations that emerge only when you can
              cross-reference. That makes it a tool for cracking open hermeticized
              science: bringing siloed knowledge into one auditable, reproducible system
              so you can find the patterns that live at the boundaries.
            </p>
            <h2 className="about-content-title">Why this project</h2>
            <p className="about-content-copy">
              Tracefield Lab exists to give researchers a practical way to do cross-dataset
              analysis without rewriting pipelines for each domain. It was built as a
              learning project, but with the constraint that the result had to be usable:
              provenance, reproducibility, and research integrity built in from the start.
            </p>
            <p className="about-content-copy">
              <a
                href="https://www.thor-nydal.no/2026/02/the-infrastructure-science-forgot-why.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                The infrastructure science forgot
              </a>
              : a longer essay on why research keeps contradicting itself and how cross-dataset infrastructure helps.
            </p>
          </div>
          <div className="about-content-back">
            <Link to="/" className="about-content-back-link">
              ← Back to home
            </Link>
          </div>
        </div>

        <PublicFooter />
      </div>
    </section>
  );
}
