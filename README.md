# Spectrum Algo

Spectrum Algo is an experimental semantic compression and retrieval-ready storage format for code and structured text.

The project converts source text into `.spec` files by mapping meaningful language tokens to stable integer IDs, run-length encoding repeated IDs, and compressing the resulting stream. Unlike a passive compressor, the stored representation keeps a searchable semantic-token layer: token IDs can be indexed directly, compared, and decoded back to the original source on demand.

## Why It Exists

Most retrieval systems store raw chunks and build a separate search index beside them. Spectrum tests a different idea:

> The compressed artifact and the retrieval representation can be the same thing.

The current proof path is local, explainable, compressed retrieval for code and structured text. The project is not trying to beat gzip, Brotli, or zstd as a pure byte compressor. Those tools are storage baselines. Spectrum's claim is that `.spec` can be compact, lossless, searchable, and explainable at the same time.

## Current Status

- `.spec` binary format proven with byte-for-byte round trips.
- Dictionary v10 covers Python, HTML, JavaScript, TypeScript, CSS, SQL, Rust, PHP, English text, and XML/Wiki syntax.
- Encoders, decoders, migration tooling, and version snapshots are included.
- Wikipedia/XML shard experiments verify large lossless corpora locally.
- RAG storage benchmarks compare conventional raw text plus TF-IDF against `.spec` chunks plus a compact Spectrum BM25 index.

Current 120-page Wikipedia sample signal with 6k-character chunks:

| Store | Total bytes | Payload bytes | Index/vector bytes | Hit@1 | MRR | Avg query time |
|---|---:|---:|---:|---:|---:|---:|
| Conventional raw+TF-IDF | 6,430,395 | 4,226,166 | 2,204,110 | 1.000 | 1.000 | 1.233 ms |
| Spectrum `.spec`+binary BM25 | 4,172,510 | 2,275,732 | 1,896,562 | 0.923 | 0.936 | 2.988 ms |

The benchmark is still small and should not be treated as a production retrieval claim. It is a proof harness for measuring storage size, query quality, latency, decode cost, and lossless fidelity.

## The `.spec` Format

Each `.spec` file has a 16-byte uncompressed header followed by a zlib-compressed token stream.

```text
Header:
  [0:4]   Magic:           b'SPEC'
  [4:6]   Dict version:    uint16 BE
  [6:8]   Flags:           uint16 BE
  [8:12]  Original length: uint32 BE
  [12:14] Language ID:     uint16 BE
  [14:16] Checksum:        uint16 BE

Body:
  zlib-compressed uint32 token IDs
```

Unknown characters fall back to ASCII or Unicode marker IDs, so decoding remains lossless. The header stores dictionary version, language ID, source length, flags, and a checksum for verification.

## Repository Layout

```text
encoder/             Original PNG/token encoder proof
decoder/             Original PNG/token decoder proof
spec_format/         Current .spec encoder, decoder, migrator, and frozen versions
tokenizers/          Language-specific tokenizers
rag/                 Retrieval and storage benchmark harnesses
tools/               Wikipedia verification, indexing, and read tools
versions/            Versioned snapshots of the encoding stack
chrome-extension/    Browser proof tools for local Spectrum/Wiki viewing
Runtime/             Runtime planning and implementation notes
Website/             Project website assets
```

Large Wikipedia dumps, generated benchmark stores, `.spec` outputs, caches, and local artifacts are intentionally ignored by Git.

## Basic Usage

Encode and decode workflows are currently Python script based. The exact commands vary by experiment, but the active RAG proof harness is:

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

See `PROJECT_OUTLINE.md`, `RETRIEVAL_POSITIONING.md`, `RAG_STORAGE_BENCHMARK.md`, `RAG_RANKING_TODO.md`, and `BENCHMARK_LOG.md` for the detailed design notes and benchmark history.

## Roadmap

- Improve query normalization and ranking quality for Spectrum BM25.
- Add stronger baselines such as Lucene, Zoekt, Chroma, FAISS, neural embeddings, and hybrid retrieval.
- Package corpus shards, manifests, and dictionary libraries into a portable `.specpack` format.
- Decide whether library dependencies should remain manifest-level or move into a future header format.

## License

Spectrum Algo is released under the MIT License. See `LICENSE`.
