# Datasets

## Dataset Philosophy

The repository should distinguish three states clearly:

1. **local and validated**
2. **cataloged but not yet ingested**
3. **gated, large, or still operationally difficult**

The scientific error to avoid is pretending these states are the same.

## Family A: Individual Spectra

### Current local anchor

- **USGS Spectral Library v7**
  - official data release:
    `https://www.usgs.gov/data/usgs-spectral-library-version-7-data`
  - role:
    material-reference spectra, one-spectrum documents, vocabulary
    experiments, reference alignment

### Important expansion line

- **ECOSTRESS Spectral Library**
  - official site: `https://speclib.jpl.nasa.gov/`
  - role:
    richer vegetation, mineral, non-photosynthetic vegetation, and
    man-made material coverage
  - constraint:
    bulk acquisition remains operationally awkward even though public
    metadata is visible

## Family B: Labeled Spectral Images

### Current local anchors

- Indian Pines
- Salinas / Salinas-A
- Pavia University
- Kennedy Space Center
- Botswana

These remain excellent for:

- label-topic association
- classification baselines
- topic stability
- region-document comparisons

### High-value additions

- **WHU-Hi**
  - official sharing page:
    `https://rsidea.whu.edu.cn/e-resource_WHUHi_sharing.htm`
  - role:
    open UAV HSI crop classification with high spatial resolution

- **Houston 2013 HSI + LiDAR**
  - official contest page:
    `https://machinelearning.ee.uh.edu/2013-ieee-grss-data-fusion-contest/`
  - role:
    multimodal urban benchmark
  - constraint:
    access and redistribution must be treated carefully

- **HyRANK**
  - role:
    cross-scene transfer benchmark for hyperspectral classification
  - constraint:
    canonical acquisition and split reproduction still need to be made
    operational in the repo

- **HYPSO-1 Sea-Land-Cloud**
  - official dataset note:
    `https://ntnu-smallsat-lab.github.io/hypso1_sea_land_clouds_dataset/dataset.html`
  - verified note:
    the official page reports `200` calibrated hyperspectral images and
    pixel-level labels for `38` sea/land/cloud scenes
  - role:
    modern open satellite HSI with coarse physical labels
  - useful because:
    it adds a public labeled satellite case beyond the classic academic
    scene tradition

## Family C: Unlabeled Spectral Images

### Current local anchors

- Cuprite
- Samson ROI
- Jasper Ridge ROI
- Urban ROI
- MicaSense field MSI orthomosaics

These are the strongest current ground for:

- exploratory topic structure
- spatial regime analysis
- reference alignment
- comparison against unmixing-style baselines

### High-value additions

- **HySpecNet-11k**
  - official site: `https://hyspecnet.rsim.berlin/`
  - verified note:
    as of `2026-05-02`, the site reports `11,483` non-overlapping
    `128 x 128` EnMAP patches with `224` bands, but also states that the
    dataset is currently not downloadable because of EnMAP licensing
    issues
  - explicit note:
    bands `127-141` and `161-167` are affected by strong water-vapor
    absorption and are suggested for exclusion
  - role:
    large HSI patch corpora from EnMAP
  - constraint:
    licensed under EnMAP data-use conditions

- **EnMAP mission data**
  - official access:
    `https://web.geoservice.dlr.de/web/datasets/enmap`
  - note:
    official mission sources state that EnMAP routine operations and
    user data access started on `November 2, 2022`
  - role:
    open modern satellite HSI for curated patch workflows

## Family D: Regions With Measurements

### Current local anchor

- **HIDSAG**
  - official paper:
    `https://www.nature.com/articles/s41597-023-02061-x`
  - verified note:
    the official 2023 paper reports five subsets totaling `307` mineral
    samples
  - current local scope:
    `GEOMET`, `MINERAL1`, `MINERAL2`, `GEOCHEM`, `PORPHYRY`
  - role:
    the most important measured-target dataset in the repo

### Why Family D is central

This family is where the project's thesis is hardest to fake:

- targets are external to the image itself
- spectral populations belong to sample supports
- preprocessing and split design materially change conclusions
- topic-routing can be tested against real regression/classification
  tasks

## Large MSI Patch Archives

These are still important even if they are not hyperspectral:

- **EuroSAT**
  - official repo: `https://github.com/phelber/EuroSAT`
  - role:
    compact Sentinel-2 thematic groups

- **BigEarthNet**
  - official site: `https://bigearth.net/`
  - role:
    large-scale multi-label patch archive for metadata-driven subsetting
  - note:
    BigEarthNet v2.0 uses a refined 19-class nomenclature

## Laboratory-Style Complements

- **CAVE multispectral image database**
  - official index:
    `https://www.cs.columbia.edu/CAVE/databases/multispectral/images/`
  - role:
    controlled laboratory scenes and object-level variability
  - constraint:
    acquisition path is available but brittle compared with other
    sources

## Recommended Priority Order

1. finish HIDSAG-centered Family D surfacing
2. preserve Cuprite + USGS as mineral interpretation baseline
3. add WHU-Hi or HyRANK for better transfer diversity
4. add HySpecNet-11k and/or curated EnMAP patches for large-patch HSI
5. add HYPSO-1 as a modern open labeled satellite HSI case
6. improve ECOSTRESS extraction pathway for Family A expansion
