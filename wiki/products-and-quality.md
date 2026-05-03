# Products And Quality

## Principle

The stack only matters if it produces defensible products and defensible
quality estimates.

In this repository, a "product" is not merely a screen. It is a
precomputed research artifact with a traceable builder, schema,
downstream use, and explicit claim boundary.

That means:

- `data/local/` holds heavy working state
- `data/derived/` holds curated products for the web
- `derived/manifests/index.json` is the claim contract
- the web app may only surface what the pipeline has materially built

## How The Stack Maps To Products

### 1. Scene EDA products

Builder:

- `data-pipeline/build_eda_views.py`

Primary packages:

- `numpy`
- `scipy`
- `scikit-learn`

Products:

- class distributions
- class mean and spread spectra
- cosine distance matrices
- SAM distance matrices
- Fisher-style band discrimination
- class separability summaries

Why this stack matters:

- `numpy` handles bandwise spectra aggregation
- `scipy` supports statistical tests and numerical summaries
- `scikit-learn` supports discriminative statistics and consistency with
  later supervised baselines

Quality role:

- establishes whether a scene is even structurally analyzable
- surfaces band-level separability before any topic model is fit
- supplies a baseline against which document construction and topic
  mixtures can later be judged

### 2. Grouping products

Builder:

- `data-pipeline/build_groupings.py`

Primary packages:

- `scikit-image`
- `numpy`
- `scipy`
- `Pillow`

Products:

- patch-based document assignment maps
- SLIC-based grouping maps
- group-size distributions
- per-group mean and standard-deviation spectra
- preview overlays

Why this stack matters:

- `scikit-image` provides serious segmentation primitives rather than
  improvised grouping heuristics
- `numpy`/`scipy` summarize spectra inside groups
- `Pillow` produces consistent visual debug surfaces

Quality role:

- measures whether the chosen document support is spatially coherent
- exposes how document definition changes the downstream corpus
- supports `document-definition-sensitivity`

### 3. Quantization products

Builder:

- `data-pipeline/build_quantization_views.py`

Primary packages:

- `numpy`
- `scipy`
- `scikit-learn`

Products:

- quantization configuration summaries
- per-recipe vocabulary-size consequences
- document-length distribution changes
- bin-population distributions
- entropy-preservation proxies
- reconstruction RMSE and `R^2`
- neighbor-`Q` sensitivity summaries

Why this stack matters:

- quantization is not a formatting step; it is a research axis
- the relevant question is not "can we bin?" but "what information and
  downstream behavior does each quantizer preserve or distort?"

Quality role:

- quantifies fidelity loss introduced by discretization
- prevents wordification from becoming an opaque preprocessing black box
- turns quantization into an explicit browseable evidence surface

### 4. Wordification products

Builder:

- `data-pipeline/build_wordifications.py`

Primary packages:

- `pandas`
- `pyarrow`
- `numpy`
- `scipy`

Products:

- local parquet corpora
- document sidecars
- vocabulary sidecars
- derived recipe summaries

Why this stack matters:

- `pandas` gives us tractable tabular corpus assembly
- `pyarrow` gives us parquet instead of brittle JSON-heavy corpora
- sparse/vectorized operations keep corpus generation realistic for large
  scenes

Quality role:

- exposes vocabulary size, token frequency, document frequency, and
  zero-token failures
- supplies the inputs for corpus-integrity validation
- makes recipe comparisons explicit and reproducible

### 5. Topic-model products

Builders:

- `data-pipeline/build_lda_sweep.py`
- later `build_lda_canonical_fits`
- later cross-engine variant builders

Primary packages:

- `bertopic`
- `scikit-learn`
- `gensim`
- `tomotopy`
- `pyLDAvis`
- `numpy`
- `scipy`

Products:

- K-by-seed sweeps
- local `phi` and `theta`
- topic prevalence vectors
- top-word summaries
- perplexity/coherence/stability summaries
- canonical-fit intertopic distances

Why this stack matters:

- `scikit-learn` is the fast canonical baseline
- `gensim` and `tomotopy` create the multi-engine comparison the plan
  explicitly demands
- `bertopic` adds a modern embedding-first alternative with modular
  dimensionality reduction, clustering, and c-TF-IDF-based topic
  representation
- `pyLDAvis` formalizes topic relevance instead of relying on raw
  probability ranking alone

Quality role:

- measures held-out perplexity
- measures topic coherence
- measures topic diversity and topic distinctiveness
- measures seed stability via matched topics
- supports recommended-`K` logic from evidence, not taste
- adds a modern non-LDA topic family for checking whether spectral-topic
  structure survives outside Dirichlet count models

### 6. Spectral-library and alignment products

Builders:

- current local-core alignment utilities
- later `build_topic_to_library`

Primary packages:

- `spectral`
- `pysptools`
- `numpy`
- `scipy`
- `rasterio`

Products:

- topic-to-library nearest neighbors
- cosine and SAM similarity summaries
- endmember-adjacent reference comparisons
- library-backed interpretability support

Why this stack matters:

- SAM-like or cosine-only reference checks should be computed with
  wavelength-aware spectral tooling, not generic vector similarity alone
- `pysptools` makes endmember and unmixing-style baselines first-class

Quality role:

- constrains interpretation with external spectral evidence
- supports `spectral-library-alignment`
- reduces the risk of purely narrative topic naming

### 7. Embedding, manifold, and cluster-comparison products

Builders:

- future `build_representations`
- future `build_cross_method_agreement`

Primary packages:

- `scikit-learn`
- `umap-learn`
- `openTSNE`
- `hdbscan`
- `optuna`

Products:

- PCA/NMF/ICA projections
- UMAP and t-SNE embeddings
- HDBSCAN document groupings
- cross-method partition comparisons

Why this stack matters:

- topic models are only methodologically persuasive if adjacent
  non-topic representations are also computed and compared
- `openTSNE` and `UMAP` give more serious manifold options than a single
  default projection

Quality role:

- supports cross-method agreement matrices
- shows whether topic structure is unique, redundant, or contradicted
- supports what the plan calls "what unites? what separates?"

### 8. Deep representation and neural topic products

Builders:

- future CAE/VAE/ETM/ProdLDA slices inside `build_representations` and
  topic-variant builders

Primary packages:

- `torch`
- `lightning`
- `torchmetrics`
- `einops`
- `pyro-ppl`

Products:

- CAE-1D latents
- CAE-2D latents
- CAE-3D latents
- VAE and neural-topic baselines
- reconstruction losses and transfer features

Why this stack matters:

- convolutional and variational models are not optional embellishments in
  a plan that explicitly calls for CAE and neural topic families
- the repo needs a disciplined neural stack, not one-off scripts with
  hidden dependencies

Quality role:

- reconstruction error
- latent transfer quality
- downstream classifier/regressor performance
- direct comparison against symbolic topic models

### 9. Statistical and Bayesian comparison products

Builders:

- future `build_method_statistics`
- future `build_validation_blocks`

Primary packages:

- `statsmodels`
- `scikit-posthocs`
- `imbalanced-learn`
- `pymc`
- `arviz`

Products:

- CI95 summaries
- paired-comparison matrices
- corrected p-value surfaces
- effect-size surfaces
- Bayesian posterior dominance matrices
- method-ranking summaries

Why this stack matters:

- a single F1 or `R^2` is not a method comparison framework
- the plan asks for repeated evaluation, uncertainty, paired tests,
  dominance, and Bayesian probability of superiority

Quality role:

- converts scores into evidence
- distinguishes noise from robust improvement
- prevents the web from overstating fragile differences

## Quality Estimation Families

### Corpus integrity

Main questions:

- How many documents survived?
- How large is the vocabulary?
- Are document lengths plausible?
- Did any recipe create zero-token documents?

Primary stack:

- `pandas`
- `pyarrow`
- `numpy`

Primary outputs:

- `derived/recipes/*`
- validation block `corpus-integrity`

### Quantization quality

Main questions:

- How much information is preserved after discretization?
- How much reconstruction loss did the quantizer introduce?
- How unstable is downstream behavior when `Q` changes?

Primary stack:

- `numpy`
- `scipy`
- `scikit-learn`

Primary outputs:

- `derived/quantization/*`
- validation block `quantization-sensitivity`

### Topic quality

Main questions:

- Are the topics coherent?
- Are they stable across seeds?
- Do they cover the corpus without degenerating?
- Is the chosen `K` defensible?

Primary stack:

- `scikit-learn`
- `gensim`
- `tomotopy`
- `pyLDAvis`

Primary outputs:

- `derived/lda_sweep/*`
- later `derived/lda_canonical/*`
- validation block `topic-stability`

### Supervised utility quality

Main questions:

- Do topic mixtures or latent representations help prediction?
- Is improvement stable across folds and seeds?
- Is performance robust under imbalance?

Primary stack:

- `scikit-learn`
- `imbalanced-learn`
- `statsmodels`

Primary outputs:

- `derived/methods/*`
- validation block `supervision-association`

### Spatial quality

Main questions:

- Are topic or grouping assignments spatially coherent?
- Do topic-dominance maps align with meaningful structures?
- Where do topics and labels disagree?

Primary stack:

- `scikit-image`
- `numpy`
- `scipy`
- later raster-aware utilities through `rasterio`

Primary outputs:

- `derived/spatial/*`

### External-reference quality

Main questions:

- Do topics align with known reference spectra?
- Do measurement-conditioned regimes make sense?
- Are topic narratives externally constrained?

Primary stack:

- `spectral`
- `pysptools`
- `numpy`
- `scipy`

Primary outputs:

- `derived/topic_to_library/*`
- `derived/external_validation/*`
- validation block `spectral-library-alignment`

### Bayesian comparative quality

Main questions:

- What is the posterior probability that one method dominates another?
- Are observed gains likely to generalize across datasets?

Primary stack:

- `pymc`
- `arviz`

Primary outputs:

- `derived/methods/*`
- posterior dominance views in the statistical layer

## Current State Versus Planned State

### Already implemented with the hardened stack available

- EDA builder
- grouping builder
- quantization builder
- wordification builder
- thin-slice sklearn LDA sweep builder in progress

### Now unblocked by the hardened stack

- gensim/tomotopy topic variants
- BERTopic embedding-first topic variants
- pyLDAvis-faithful topic summaries
- UMAP/openTSNE/HDBSCAN representation branches
- CAE/VAE/ProdLDA-style neural branches
- PyMC/ArviZ statistical-comparison layer
- richer spectral-library alignment

## Product Discipline

The stack should be used with a hard rule:

- a package exists to support a builder
- a builder exists to produce a product
- a product exists to support a claim

If any step in that chain is missing, the web should not pretend the
claim is available.
