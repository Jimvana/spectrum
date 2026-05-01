# Spectrum Benchmark Log

Cumulative benchmark history. Each entry records what changed between runs so storage, speed, and ranking movement has context.

## 2026-05-01 - 6k chunks current baseline

**Change note:** Spectrum storage benchmark after replacing the Spectrum JSON BM25 index with compact binary postings/frequency storage.

**Run:** `wiki_enwiki_fullxml_sample/page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=26, top_k=5

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,395 | 4,172,510 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.657 | 5.947 |
| Hit@1 | 1.000 | 0.923 |
| MRR | 1.000 | 0.936 |
| Recall@5 | 1.000 | 0.962 |
| Avg query ms | 1.233 | 2.988 |
| Avg decode ms | 0.000 | 2.932 |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01 - 1.8k chunks current baseline

**Change note:** Same binary Spectrum BM25 storage path as the 6k run, tested with smaller chunks.

**Run:** `wiki_enwiki_fullxml_sample/page_index.json`, pages=120, chunks=2,377, raw=4,130,031 bytes, chunk_chars=1,800, overlap=180, queries=28, top_k=5

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 7,234,684 | 5,913,788 |
| Ratio vs raw chunks | 1.752x | 1.432x |
| Payload bytes | 4,374,718 | 2,868,949 |
| Index/vector bytes | 2,859,846 | 3,044,622 |
| Build seconds | 0.722 | 6.234 |
| Hit@1 | 0.964 | 0.929 |
| MRR | 0.964 | 0.941 |
| Recall@5 | 0.964 | 0.964 |
| Avg query ms | 1.394 | 8.014 |
| Avg decode ms | 0.000 | 1.697 |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01 - Core RAG index persistence

**Change note:** Core `rag.indexer`, `rag.query`, and `rag.benchmark` now default to compact binary `rag/index.bin` instead of JSON `rag/index.json`. This is the small local code/spec index, separate from the Wikipedia storage benchmark above.

| Metric | JSON index | Binary index |
|---|---:|---:|
| Index bytes | 298,203 | 117,492 |
| Size reduction | n/a | 60.6% |

## 2026-05-01 - Ranking harness, no query expansion

**Change note:** Added `rag/ranking_eval.py` to compare Spectrum ranking variants and diagnose failures without adding query expansion.

**6k chunk run:** `rag/ranking_eval_6k/ranking_eval.md`, queries=26, top_k=5

| Variant | Hit@1 | MRR | Recall@5 | Avg query ms | P95 query ms |
|---|---:|---:|---:|---:|---:|
| Conventional TF-IDF | 1.000 | 1.000 | 1.000 | 0.822 | 0.909 |
| Spectrum BM25 | 0.923 | 0.936 | 0.962 | 2.281 | 2.766 |
| Spectrum unique query | 0.923 | 0.936 | 0.962 | 2.269 | 2.742 |
| Spectrum DF90 | 0.923 | 0.936 | 0.962 | 0.920 | 1.498 |
| Spectrum DF75 | 0.923 | 0.936 | 0.962 | 0.454 | 0.766 |
| Spectrum title boost 1 | 0.923 | 0.942 | 0.962 | 2.496 | 3.002 |
| Spectrum title boost 2 | 0.846 | 0.885 | 0.923 | 2.504 | 2.998 |

**1.8k chunk run:** `rag/ranking_eval_1800/ranking_eval.md`, queries=28, top_k=5

| Variant | Hit@1 | MRR | Recall@5 | Avg query ms | P95 query ms |
|---|---:|---:|---:|---:|---:|
| Conventional TF-IDF | 0.964 | 0.964 | 0.964 | 0.961 | 1.105 |
| Spectrum BM25 | 0.929 | 0.941 | 0.964 | 6.427 | 12.541 |
| Spectrum unique query | 0.929 | 0.946 | 0.964 | 6.414 | 12.898 |
| Spectrum DF90 | 0.929 | 0.941 | 0.964 | 2.261 | 6.969 |
| Spectrum DF75 | 0.893 | 0.911 | 0.929 | 1.416 | 2.722 |
| Spectrum title boost 1 | 0.929 | 0.929 | 0.929 | 7.056 | 12.957 |
| Spectrum title boost 2 | 0.893 | 0.902 | 0.929 | 7.058 | 13.110 |

**Diagnostic takeaway:** Failures are mostly not synonym problems. The weak spots are CamelCase/title fallback drops, high-frequency control tokens, common words/numbers, and wiki redirect/citation boilerplate.

## 2026-05-01 - Ranking tuning variants

**Change note:** Added repeatable tuned variants to `rag/ranking_eval.py`: `df50`, `b025_title_boost_025`, and `b1_df90`.

**6k chunk run:** `rag/ranking_eval_6k_latest/ranking_eval.md`, queries=26, top_k=5

| Variant | Hit@1 | MRR | Recall@5 | Avg query ms | P95 query ms |
|---|---:|---:|---:|---:|---:|
| Conventional TF-IDF | 1.000 | 1.000 | 1.000 | 0.826 | 1.038 |
| Spectrum BM25 baseline | 0.923 | 0.936 | 0.962 | 2.333 | 2.782 |
| Spectrum DF50 | 0.923 | 0.936 | 0.962 | 0.293 | 0.537 |
| Spectrum b=0.25 + title boost 0.25 | 0.962 | 0.962 | 0.962 | 2.577 | 3.031 |

**1.8k chunk run:** `rag/ranking_eval_1800_latest/ranking_eval.md`, queries=28, top_k=5

| Variant | Hit@1 | MRR | Recall@5 | Avg query ms | P95 query ms |
|---|---:|---:|---:|---:|---:|
| Conventional TF-IDF | 0.964 | 0.964 | 0.964 | 1.053 | 1.301 |
| Spectrum BM25 baseline | 0.929 | 0.941 | 0.964 | 7.217 | 13.636 |
| Spectrum DF50 | 0.929 | 0.929 | 0.929 | 0.847 | 1.481 |
| Spectrum b=1.0 + DF90 | 0.964 | 0.964 | 0.964 | 2.500 | 7.500 |

**Diagnostic takeaway:** Ranking can be improved without query expansion, but the best setting differs by chunk profile. The next step is a fuller parameter sweep plus labelled queries before changing production defaults.
## 2026-05-01T19:49:21+00:00

**Change note:** Post ranking-harness and binary postings loader fix; no query expansion or ranking algorithm change.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,395 | 4,172,510 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.685 | 6.196 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.200 | 2.819 |
| Avg decode ms | 0.000 | 3.449 |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01T20:50:32+00:00

**Change note:** Added CPU and decode-byte cost metrics to storage benchmark; 6k chunk profile.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,427 | 4,172,542 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.686 | 6.034 |
| Build CPU seconds | 0.656 | 5.953 |
| Build MiB/CPU second | 5.989 | 0.660 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.204 | 2.823 |
| Avg query CPU ms | 0.488 | 3.906 |
| Avg decode ms | 0.000 | 3.023 |
| Avg decode CPU ms | 0.000 | 1.953 |
| Avg decode input bytes | 0 | 3,013.6 |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01T20:50:33+00:00

**Change note:** Added CPU and decode-byte cost metrics to storage benchmark; 1.8k chunk profile.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=2,377, raw=4,130,031 bytes, chunk_chars=1,800, overlap=180, queries=32, top_k=5

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 7,234,715 | 5,913,820 |
| Ratio vs raw chunks | 1.752x | 1.432x |
| Payload bytes | 4,374,718 | 2,868,949 |
| Index/vector bytes | 2,859,846 | 3,044,622 |
| Build seconds | 0.709 | 6.534 |
| Build CPU seconds | 0.703 | 6.344 |
| Build MiB/CPU second | 5.602 | 0.621 |
| Hit@1 | 1.000 | 0.969 |
| MRR | 1.000 | 0.984 |
| Recall@5 | 1.000 | 1.000 |
| Avg query ms | 1.487 | 7.977 |
| Avg query CPU ms | 0.977 | 8.301 |
| Avg decode ms | 0.000 | 3.774 |
| Avg decode CPU ms | 0.000 | 1.465 |
| Avg decode input bytes | 0 | 1,211.0 |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01T21:06:33+00:00

**Change note:** Production-style optimized 6k run: optimized token-to-id/query scoring, skipped build-time verification, Spectrum DF50 query filter.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=0.75, spectrum_max_df_ratio=0.5, skip_verify=True

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,426 | 4,172,573 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.664 | 4.069 |
| Build CPU seconds | 0.625 | 3.906 |
| Build MiB/CPU second | 6.288 | 1.006 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.160 | 0.306 |
| Avg query CPU ms | 0.488 | 0.488 |
| Avg decode ms | 0.000 | 2.982 |
| Avg decode CPU ms | 0.000 | 2.441 |
| Avg decode input bytes | 0 | 3,013.6 |
| Spectrum fidelity verified | n/a | False |
| Spectrum lossless | n/a | None |
| Fidelity failures | n/a | not checked |

## 2026-05-01T21:06:33+00:00

**Change note:** Production-style optimized 1.8k run: optimized token-to-id/query scoring, skipped build-time verification, Spectrum b=1.0 with DF90 query filter.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=2,377, raw=4,130,031 bytes, chunk_chars=1,800, overlap=180, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=1.0, spectrum_max_df_ratio=0.9, skip_verify=True

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 7,234,716 | 5,913,851 |
| Ratio vs raw chunks | 1.752x | 1.432x |
| Payload bytes | 4,374,718 | 2,868,949 |
| Index/vector bytes | 2,859,846 | 3,044,622 |
| Build seconds | 0.707 | 4.377 |
| Build CPU seconds | 0.703 | 4.266 |
| Build MiB/CPU second | 5.602 | 0.923 |
| Hit@1 | 1.000 | 0.969 |
| MRR | 1.000 | 0.984 |
| Recall@5 | 1.000 | 1.000 |
| Avg query ms | 1.478 | 1.700 |
| Avg query CPU ms | 1.465 | 0.488 |
| Avg decode ms | 0.000 | 2.022 |
| Avg decode CPU ms | 0.000 | 0.977 |
| Avg decode input bytes | 0 | 1,209.6 |
| Spectrum fidelity verified | n/a | False |
| Spectrum lossless | n/a | None |
| Fidelity failures | n/a | not checked |

## 2026-05-01T21:07:40+00:00

**Change note:** Production-style optimized 6k quality run: optimized token-to-id/query scoring, skipped build-time verification, Spectrum b=0.25 with title boost 0.25.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=0.25, spectrum_max_df_ratio=None, spectrum_title_boost=0.25, skip_verify=True

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,426 | 4,172,572 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.655 | 4.049 |
| Build CPU seconds | 0.625 | 3.875 |
| Build MiB/CPU second | 6.288 | 1.014 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.072 | 1.886 |
| Avg query CPU ms | 0.488 | 1.953 |
| Avg decode ms | 0.000 | 2.867 |
| Avg decode CPU ms | 0.000 | 2.441 |
| Avg decode input bytes | 0 | 3,008.8 |
| Spectrum fidelity verified | n/a | False |
| Spectrum lossless | n/a | None |
| Fidelity failures | n/a | not checked |

## 2026-05-01T21:08:12+00:00

**Change note:** Verified optimized 6k run after token-to-id/query scoring changes; fidelity verification enabled with Spectrum DF50 query filter.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=0.75, spectrum_max_df_ratio=0.5, spectrum_title_boost=0.0, skip_verify=False

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,426 | 4,172,572 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.708 | 5.584 |
| Build CPU seconds | 0.672 | 5.391 |
| Build MiB/CPU second | 5.849 | 0.729 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.102 | 0.286 |
| Avg query CPU ms | 0.000 | 0.488 |
| Avg decode ms | 0.000 | 2.815 |
| Avg decode CPU ms | 0.000 | 1.465 |
| Avg decode input bytes | 0 | 3,013.6 |
| Spectrum fidelity verified | n/a | True |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01T21:10:58+00:00

**Change note:** Full verified current benchmark vs conventional raw+TF-IDF; 6k chunks with optimized Spectrum DF50 query filter.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=782, raw=4,120,949 bytes, chunk_chars=6,000, overlap=600, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=0.75, spectrum_max_df_ratio=0.5, spectrum_title_boost=0.0, skip_verify=False

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 6,430,427 | 4,172,571 |
| Ratio vs raw chunks | 1.560x | 1.013x |
| Payload bytes | 4,226,166 | 2,275,732 |
| Index/vector bytes | 2,204,110 | 1,896,562 |
| Build seconds | 0.666 | 5.452 |
| Build CPU seconds | 0.672 | 5.406 |
| Build MiB/CPU second | 5.849 | 0.727 |
| Hit@1 | 0.938 | 0.938 |
| MRR | 0.953 | 0.938 |
| Recall@5 | 0.969 | 0.938 |
| Avg query ms | 1.120 | 0.287 |
| Avg query CPU ms | 0.488 | 0.977 |
| Avg decode ms | 0.000 | 3.212 |
| Avg decode CPU ms | 0.000 | 2.930 |
| Avg decode input bytes | 0 | 3,013.6 |
| Spectrum fidelity verified | n/a | True |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

## 2026-05-01T21:10:58+00:00

**Change note:** Full verified current benchmark vs conventional raw+TF-IDF; 1.8k chunks with optimized Spectrum b=1.0 DF90 query filter.

**Run:** `wiki_enwiki_fullxml_sample\page_index.json`, pages=120, chunks=2,377, raw=4,130,031 bytes, chunk_chars=1,800, overlap=180, queries=32, top_k=5, spectrum_k1=1.5, spectrum_b=1.0, spectrum_max_df_ratio=0.9, spectrum_title_boost=0.0, skip_verify=False

| Metric | Conventional raw+TF-IDF | Spectrum `.spec`+binary BM25 |
|---|---:|---:|
| Total store bytes | 7,234,716 | 5,913,850 |
| Ratio vs raw chunks | 1.752x | 1.432x |
| Payload bytes | 4,374,718 | 2,868,949 |
| Index/vector bytes | 2,859,846 | 3,044,622 |
| Build seconds | 0.681 | 5.921 |
| Build CPU seconds | 0.688 | 5.844 |
| Build MiB/CPU second | 5.729 | 0.674 |
| Hit@1 | 1.000 | 0.969 |
| MRR | 1.000 | 0.984 |
| Recall@5 | 1.000 | 1.000 |
| Avg query ms | 1.493 | 1.694 |
| Avg query CPU ms | 0.000 | 0.977 |
| Avg decode ms | 0.000 | 2.250 |
| Avg decode CPU ms | 0.000 | 1.465 |
| Avg decode input bytes | 0 | 1,209.6 |
| Spectrum fidelity verified | n/a | True |
| Spectrum lossless | n/a | True |
| Fidelity failures | n/a | 0 |

