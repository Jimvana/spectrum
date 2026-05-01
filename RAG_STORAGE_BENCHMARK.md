# Spectrum RAG Storage Benchmark

## Purpose

This is now the main proof path for Spectrum.

The goal is to compare a conventional local RAG store against a Spectrum RAG
store built from the same chunks, measuring:

- total disk size
- payload size
- index/vector size
- build time
- build CPU time
- build throughput
- query latency
- query CPU time
- retrieval quality
- decode latency
- decode CPU time
- decoded `.spec` bytes read per query
- lossless round-trip fidelity

This is a better proof than trying to perfectly render Wikipedia in Chrome.
Wikipedia is useful as a large text corpus, but the real claim is
retrieval-ready storage.

## Harness

Run:

```powershell
python rag\storage_benchmark.py `
  --page-index wiki_enwiki_fullxml_sample\page_index.json `
  --out-dir rag\storage_benchmark_6k `
  --max-pages 120 `
  --chunk-chars 6000 `
  --overlap-chars 600 `
  --queries 40 `
  --top-k 5
```

To append a cumulative benchmark entry with the reason for the run:

```powershell
python rag\storage_benchmark.py `
  --page-index wiki_enwiki_fullxml_sample\page_index.json `
  --out-dir rag\storage_benchmark_6k `
  --max-pages 120 `
  --chunk-chars 6000 `
  --overlap-chars 600 `
  --queries 40 `
  --top-k 5 `
  --append-log `
  --change-note "Describe what changed since the previous run"
```

The cumulative score history lives in `BENCHMARK_LOG.md`.

Cost metrics now include both wall-clock time and Python process CPU time.
CPU time is a rough local proxy for compute and power cost; it is not a direct
energy measurement. On multi-threaded library calls, process CPU can exceed wall
time because it accumulates CPU used across worker threads.

The script builds:

1. Conventional local RAG baseline:
   - `chunks.jsonl` with raw chunk text
   - persisted TF-IDF sparse vector matrix
   - TF-IDF vocabulary

2. Spectrum RAG store:
   - one `.spec` file per chunk
   - compact binary Spectrum token BM25 postings/frequency index
   - no raw chunk text stored in the Spectrum store

Current baseline uses scikit-learn TF-IDF because Chroma/FAISS are not
installed locally. Chroma, FAISS, neural embeddings, and hybrid baselines can be
added as later comparisons.

## Current Result: 6k Character Chunks

Source:

- `wiki_enwiki_fullxml_sample/page_index.json`
- 120 pages
- 782 chunks
- 4,120,949 raw chunk bytes

Storage:

| Store | Bytes | Ratio vs raw chunks | Build seconds |
|---|---:|---:|---:|
| Conventional raw+TF-IDF | 6,430,395 | 1.560x | 0.657 |
| Spectrum `.spec`+binary BM25 | 4,172,510 | 1.013x | 5.947 |

Components:

| Store | Payload bytes | Index/vector bytes | Metadata bytes |
|---|---:|---:|---:|
| Conventional raw+TF-IDF | 4,226,166 | 2,204,110 | 119 |
| Spectrum `.spec`+binary BM25 | 2,275,732 | 1,896,562 | 216 |

Retrieval:

| Store | Hit@1 | MRR | Recall@5 | Avg query ms | Avg decode ms |
|---|---:|---:|---:|---:|---:|
| Conventional raw+TF-IDF | 1.000 | 1.000 | 1.000 | 1.233 | 0.000 |
| Spectrum `.spec`+binary BM25 | 0.923 | 0.936 | 0.962 | 2.988 | 2.932 |

Latest cost run:

| Store | Build CPU sec | MiB/CPU sec | Avg query CPU ms | Avg decode CPU ms | Avg decode input bytes |
|---|---:|---:|---:|---:|---:|
| Conventional raw+TF-IDF | 0.672 | 5.849 | 0.000 | 0.000 | 0.0 |
| Spectrum `.spec`+binary BM25, verified, DF50 | 5.391 | 0.729 | 0.488 | 1.465 | 3,013.6 |
| Spectrum `.spec`+binary BM25, production DF50 | 3.906 | 1.006 | 0.488 | 2.441 | 3,013.6 |

Fidelity:

- Spectrum lossless round-trip: true
- Fidelity failures: 0

## Current Result: 1.8k Character Chunks

Source:

- 120 pages
- 2,377 chunks
- 4,130,031 raw chunk bytes

Storage:

| Store | Bytes | Ratio vs raw chunks |
|---|---:|---:|
| Conventional raw+TF-IDF | 7,234,684 | 1.752x |
| Spectrum `.spec`+binary BM25 | 5,913,788 | 1.432x |

Components:

| Store | Payload bytes | Index/vector bytes |
|---|---:|---:|
| Conventional raw+TF-IDF | 4,374,718 | 2,859,846 |
| Spectrum `.spec`+binary BM25 | 2,868,949 | 3,044,622 |

Latest cost run:

| Store | Build CPU sec | MiB/CPU sec | Avg query CPU ms | Avg decode CPU ms | Avg decode input bytes |
|---|---:|---:|---:|---:|---:|
| Conventional raw+TF-IDF | 0.703 | 5.602 | 1.465 | 0.000 | 0.0 |
| Spectrum `.spec`+binary BM25, production b=1.0 DF90 | 4.266 | 0.923 | 0.488 | 0.977 | 1,209.6 |

Interpretation:

- Spectrum payload is much smaller than raw chunk text.
- The compact binary BM25 index removes the previous JSON-index bottleneck.
- Spectrum now wins total store size on both tested chunk profiles.
- With larger chunks, Spectrum is close to raw payload size while remaining
  retrieval-ready.
- The next engineering target is retrieval quality and larger, more realistic
  labelled query sets.

## Honest Takeaway

Spectrum is not proven as a universal replacement yet.

What is proven locally:

- `.spec` chunks are lossless.
- `.spec` payloads are substantially smaller than raw text chunks.
- Spectrum token retrieval can reach similar Hit@1 on this generated query set.
- Decode-on-demand works.
- The binary index fixes the largest storage bottleneck, though conventional
  TF-IDF remains faster on these runs.

Next proof step:

1. Add a Chroma/FAISS/neural embedding baseline.
2. Run the same benchmark on the larger `wiki_enwiki_fullxml_1hr` page index.
3. Add labelled human queries, not only generated title/content queries.
4. Improve query normalization and ranking against conventional TF-IDF.

The working checklist for ranking/query-normalization work lives in
`RAG_RANKING_TODO.md`. Future sessions should mark items off there as they are
implemented and re-tested.
