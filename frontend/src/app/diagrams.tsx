export function HeroGraphic() {
  return (
    <svg className="hero-graphic" viewBox="0 0 520 320" role="img" aria-label="Spectral evidence mapped into corpus definitions and topic mixtures">
      <defs>
        <linearGradient id="heroCopper" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff982b" />
          <stop offset="100%" stopColor="#ffd284" />
        </linearGradient>
        <linearGradient id="heroBlue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#47b4ff" />
          <stop offset="100%" stopColor="#b9e4ff" />
        </linearGradient>
        <linearGradient id="heroRose" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff5d7b" />
          <stop offset="100%" stopColor="#ff9aac" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="504" height="304" rx="24" className="hero-graphic-frame" />
      <g transform="translate(28 28)">
        <text className="hero-graphic-label" x="0" y="0">
          spectral populations to latent routing
        </text>
        <text className="hero-graphic-label soft" x="0" y="22">
          support geometry, symbolic codec, topic mixtures, and downstream tasks
        </text>
      </g>
      <g transform="translate(28 64)">
        <rect x="0" y="0" width="148" height="220" rx="20" className="hero-stack-card" />
        <text className="hero-graphic-label" x="16" y="24">
          support field
        </text>
        <line className="hero-axis" x1="20" y1="170" x2="126" y2="170" />
        <line className="hero-axis" x1="20" y1="170" x2="20" y2="42" />
        <path className="hero-grid" d="M20 62 H126 M20 92 H126 M20 122 H126 M20 152 H126" />
        <path className="hero-grid" d="M46 42 V170 M72 42 V170 M98 42 V170" />
        <path className="hero-curve copper" d="M24 148 C44 134 58 112 78 118 S110 88 126 96" />
        <path className="hero-curve blue" d="M24 134 C48 126 68 108 88 118 S112 144 126 138" />
        <path className="hero-curve sand" d="M24 156 C46 162 66 150 84 154 S108 150 126 148" />
        <text className="hero-graphic-label soft" x="20" y="194">
          wavelength
        </text>
        <text className="hero-graphic-label soft" x="20" y="208">
          support = pixel | patch | sample
        </text>
      </g>
      <g transform="translate(190 64)">
        <rect x="0" y="0" width="144" height="220" rx="20" className="hero-stack-card" />
        <text className="hero-graphic-label" x="16" y="24">
          symbolic codec
        </text>
        {Array.from({ length: 10 }).map((_, index) => (
          <rect
            key={`codec-${index}`}
            x={16}
            y={42 + index * 14}
            width={92 + (index % 4) * 8}
            height="8"
            rx="4"
            className={index % 3 === 0 ? "hero-stack-band copper-fill" : index % 3 === 1 ? "hero-stack-band blue-fill" : "hero-stack-band sand-fill"}
          />
        ))}
        <rect x="16" y="188" width="112" height="12" rx="6" className="hero-document-band" />
        <text className="hero-graphic-label soft" x="16" y="214">
          discretize -&gt; token rules -&gt; documents
        </text>
      </g>
      <g transform="translate(348 64)">
        <rect x="0" y="0" width="144" height="220" rx="20" className="hero-stack-card" />
        <text className="hero-graphic-label" x="16" y="24">
          topic routing
        </text>
        <rect x="16" y="44" width="104" height="46" rx="12" className="hero-node hero-node-blue" />
        <rect x="16" y="100" width="88" height="34" rx="10" className="hero-node hero-node-copper" />
        <rect x="16" y="142" width="72" height="34" rx="10" className="hero-node hero-node-rose" />
        <rect x="16" y="184" width="116" height="12" rx="6" className="hero-mix-bar hero-mix-bar-blue" />
        <rect x="16" y="200" width="82" height="12" rx="6" className="hero-mix-bar hero-mix-bar-copper" />
        <text className="hero-topic-text" x="28" y="70">
          topic bank
        </text>
        <text className="hero-topic-text" x="28" y="122">
          routed task
        </text>
        <text className="hero-topic-text" x="28" y="164">
          retrieval
        </text>
      </g>
      <path className="hero-arrow" d="M178 174 L188 174" />
      <path className="hero-arrow" d="M336 174 L346 174" />
    </svg>
  );
}

export function CorpusDiagram() {
  return (
    <svg className="mini-diagram" viewBox="0 0 640 220" role="img" aria-label="Corpus design diagram">
      <rect x="0.5" y="0.5" width="639" height="219" rx="24" className="diagram-frame" />
      <text x="26" y="30" className="diagram-title">
        corpus construction pipeline
      </text>
      <path className="diagram-grid" d="M26 42 H614 M26 196 H614" />
      <rect x="24" y="56" width="136" height="108" rx="18" className="diagram-panel" />
      <text x="42" y="82" className="diagram-title">
        support
      </text>
      <text x="42" y="106" className="diagram-copy">
        pixel / patch / sample
      </text>
      <text x="42" y="126" className="diagram-copy">
        preserve local variability
      </text>

      <rect x="186" y="56" width="136" height="108" rx="18" className="diagram-panel" />
      <text x="204" y="82" className="diagram-title">
        symbolic bridge
      </text>
      <text x="204" y="106" className="diagram-copy">
        quantization, deltas,
      </text>
      <text x="204" y="126" className="diagram-copy">
        band groups, token events
      </text>

      <rect x="348" y="56" width="136" height="108" rx="18" className="diagram-panel" />
      <text x="366" y="82" className="diagram-title">
        documents
      </text>
      <text x="366" y="106" className="diagram-copy">
        spectrum bag, region bag,
      </text>
      <text x="366" y="126" className="diagram-copy">
        support-aware corpora
      </text>

      <rect x="510" y="56" width="106" height="108" rx="18" className="diagram-panel" />
      <text x="526" y="82" className="diagram-title">
        topics
      </text>
      <text x="526" y="106" className="diagram-copy">
        mixtures,
      </text>
      <text x="526" y="126" className="diagram-copy">
        routing
      </text>

      <path className="diagram-arrow" d="M162 110 L184 110" />
      <path className="diagram-arrow" d="M324 110 L346 110" />
      <path className="diagram-arrow" d="M486 110 L508 110" />
    </svg>
  );
}

export function HierarchyDiagram() {
  return (
    <svg className="mini-diagram" viewBox="0 0 640 220" role="img" aria-label="Hierarchy diagram">
      <rect x="0.5" y="0.5" width="639" height="219" rx="24" className="diagram-frame" />
      <text x="36" y="38" className="diagram-title">
        sample-support hierarchy
      </text>
      <rect x="36" y="68" width="136" height="92" rx="20" className="diagram-panel" />
      <rect x="236" y="52" width="124" height="54" rx="18" className="diagram-panel" />
      <rect x="236" y="122" width="124" height="54" rx="18" className="diagram-panel" />
      <rect x="424" y="42" width="168" height="144" rx="20" className="diagram-panel" />
      <text x="58" y="94" className="diagram-title">
        sample
      </text>
      <text x="58" y="118" className="diagram-copy">
        assay, label, target,
      </text>
      <text x="58" y="138" className="diagram-copy">
        one experimental support
      </text>
      <text x="258" y="82" className="diagram-title">
        cube support
      </text>
      <text x="258" y="152" className="diagram-title">
        region support
      </text>
      <text x="446" y="68" className="diagram-title">
        spectra populations
      </text>
      <text x="446" y="92" className="diagram-copy">
        not one cleaned signature
      </text>
      <text x="446" y="112" className="diagram-copy">
        but many local responses
      </text>
      <rect x="446" y="130" width="118" height="10" rx="5" className="diagram-bar diagram-bar-blue" />
      <rect x="446" y="146" width="92" height="10" rx="5" className="diagram-bar diagram-bar-copper" />
      <rect x="446" y="162" width="66" height="10" rx="5" className="diagram-bar diagram-bar-rose" />
      <path className="diagram-arrow" d="M174 104 L234 82" />
      <path className="diagram-arrow" d="M174 126 L234 148" />
      <path className="diagram-arrow" d="M362 80 L422 80" />
      <path className="diagram-arrow" d="M362 148 L422 148" />
    </svg>
  );
}

export function EquationStrip() {
  return (
    <div className="equation-board">
      <div className="equation-board-head">
        <p className="eyebrow">mathematical contract</p>
        <h3>PTM/LDA only becomes legitimate after the spectral-to-symbolic bridge is declared.</h3>
      </div>
      <div className="equation-grid">
        <article className="equation-card">
          <span className="equation-symbol">theta_d ~ Dir(alpha)</span>
          <p>document-level topic mixture over one spectral support unit</p>
        </article>
        <article className="equation-card">
          <span className="equation-symbol">z_dn ~ Cat(theta_d)</span>
          <p>latent regime assignment for each emitted token event</p>
        </article>
        <article className="equation-card">
          <span className="equation-symbol">w_dn ~ Cat(beta_k)</span>
          <p>topic-conditioned token generation under a finite alphabet</p>
        </article>
        <article className="equation-card">
          <span className="equation-symbol">x(lambda) -&gt; q(x, lambda) -&gt; w</span>
          <p>explicit bridge from continuous spectra to symbolic documents</p>
        </article>
      </div>
    </div>
  );
}
