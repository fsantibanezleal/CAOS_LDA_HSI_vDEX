# Legacy Notebooks

The notebook in this folder is not a polished pipeline. It is the first
practical sketch of the postdoctoral idea.

## Main File

- `LDA_Hyper_legacy.ipynb`

## What It Actually Contains

- loading local `.npz` spectral data
- global normalization
- discretization of intensities
- three document-construction alternatives
- Gensim LDA fitting
- pyLDAvis export

## Why It Still Matters

- it shows the original mapping from spectral data to documents
- it preserves early implementation details that can still inform the
  reusable pipeline

## Why It Is Not Enough

- the data source is ad hoc
- the logic is notebook-centric
- there is no durable experiment contract or validation layer

For a deeper audit, see
[wiki/legacy-audit.md](../../wiki/legacy-audit.md).
