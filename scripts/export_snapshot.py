# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "fastembed==0.8.0",
#     "numpy",
#     "psycopg2-binary==2.9.10",
#     "scikit-learn",
# ]
# ///
"""Export a static snapshot of the pipeline database for the React frontend.

Reads the three pipeline tables (`raw_data` -> `processed_data` -> `documents`)
after the real scraper/worker have populated them, and writes
`src/data/snapshot.json`, which the layer pages render. Everything in the
snapshot is computed from the database; nothing is hand-written.

What it produces:
- stage counts, table sizes and per-content-type chunk statistics
- one row per condition (symptoms, paragraphs, lists, chunks, raw size, ...)
- a data-quality audit (non-breaking spaces, filtered placeholders, empty
  fields, title -> condition_name normalization)
- a sample record traced through all three stages
- a 3-D t-SNE map of every 384-d chunk embedding, fitted together with the
  sample questions so each question lands next to the passages it matches
  (PCA variance reported too)
- retrieval traces for sample questions, reproducing the API's retrieval:
  top-20 cosine search -> cross-encoder re-rank -> threshold -2.0 -> top 5
  (the API's LLM query-rephrasing step is skipped: the sample questions are
  already standalone)

Usage (uv resolves the inline dependencies above):

    DATABASE_URL=postgresql://postgres:<pw>@localhost:55433/medical_conditions_db \
    uv run scripts/export_snapshot.py
"""

import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psycopg2
from fastembed import TextEmbedding
from fastembed.rerank.cross_encoder import TextCrossEncoder
from sklearn.manifold import TSNE

OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "snapshot.json"

# Must match medical_conditions_api/app/core/embedding.py and the worker.
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
RERANK_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"
TOP_K = 20
RELEVANCE_THRESHOLD = -2.0
TOP_N = 5

SAMPLE_CONDITION = "Acne"
SAMPLE_QUESTIONS = [
    "What are the symptoms of asthma?",
    "How is acne treated?",
    "Can an online doctor prescribe medication for a urinary tract infection?",
    "What helps with insomnia?",
    "Who won the last football world cup?",
]

NBSP = " "


def count_nbsp(value) -> int:
    if isinstance(value, str):
        return value.count(NBSP)
    if isinstance(value, dict):
        return sum(count_nbsp(v) for v in value.values())
    if isinstance(value, list):
        return sum(count_nbsp(v) for v in value)
    return 0


def parse_vector(text: str) -> list[float]:
    return [float(x) for x in text.strip("[]").split(",")]


def preview(text: str, n: int = 140) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


def align_cloud(coords: np.ndarray, n_docs: int) -> np.ndarray:
    """Center on the first n_docs rows, rotate onto their principal axes
    (largest variance -> x, second -> z, smallest -> y) and scale into the unit
    sphere. This only turns (and mirrors) the map, so every distance and
    neighbourhood stays the same."""
    coords = coords - coords[:n_docs].mean(axis=0)
    _, _, axes = np.linalg.svd(coords[:n_docs], full_matrices=False)
    # Make each axis point toward its largest component, so the result is stable.
    signs = np.sign(axes[np.arange(3), np.abs(axes).argmax(axis=1)])
    axes = axes * signs[:, None]
    rotated = coords @ axes.T  # columns: pc1, pc2, pc3
    rotated = rotated[:, [0, 2, 1]]  # x = pc1, y = pc3, z = pc2
    return rotated / np.linalg.norm(rotated[:n_docs], axis=1).max()


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # ---- stage counts & sizes ------------------------------------------------
    stages = {}
    for table in ("raw_data", "processed_data", "documents"):
        cur.execute(
            f"SELECT count(*), pg_total_relation_size('{table}') FROM {table}"
        )
        rows, size = cur.fetchone()
        stages[table] = {"rows": rows, "bytes": size}

    cur.execute(
        """SELECT content_type, count(*), round(avg(length(content))),
                  min(length(content)), max(length(content))
           FROM documents GROUP BY 1 ORDER BY 2 DESC"""
    )
    chunk_types = [
        {"type": t, "count": c, "avgChars": int(a), "minChars": mn, "maxChars": mx}
        for t, c, a, mn, mx in cur.fetchall()
    ]

    # ---- per-condition rows --------------------------------------------------
    cur.execute(
        """SELECT r.source, r.content, p.condition_name, p.content, p.processor_version
           FROM raw_data r JOIN processed_data p ON p.raw_data_id = r.id"""
    )
    joined = cur.fetchall()

    cur.execute(
        """SELECT p.condition_name, d.content_type, count(*), sum(length(d.content))
           FROM documents d JOIN processed_data p ON p.id = d.processed_data_id
           GROUP BY 1, 2"""
    )
    chunk_counts: dict[str, dict] = {}
    for name, ctype, c, chars in cur.fetchall():
        entry = chunk_counts.setdefault(name, {"symptom": 0, "paragraph": 0, "list_item": 0, "chars": 0})
        entry[ctype] = c
        entry["chars"] += chars

    conditions = []
    audit_nbsp_raw = audit_nbsp_processed = 0
    empty_intro = empty_sections = empty_faqs = no_symptoms = 0
    normalization = []
    symptom_counter: Counter[str] = Counter()

    for source, raw, name, processed, version in joined:
        slug = source.split(":", 1)[1]
        symptoms = raw.get("symptoms", {}).get("list", []) if isinstance(raw.get("symptoms"), dict) else []
        p_content = processed.get("onlineDiagnosingAndTreating", {}).get("content", {})
        paragraphs = p_content.get("paragraphs", []) if isinstance(p_content, dict) else []
        lists = p_content.get("lists", []) if isinstance(p_content, dict) else []
        raw_blocks = raw.get("onlineDiagnosingAndTreating", {}).get("content", [])

        nb_raw, nb_proc = count_nbsp(raw), count_nbsp(processed)
        audit_nbsp_raw += nb_raw
        audit_nbsp_processed += nb_proc
        empty_intro += int(not raw.get("introduction"))
        empty_sections += int(not raw.get("sections"))
        empty_faqs += int(not raw.get("faqs"))
        no_symptoms += int(not symptoms)
        symptom_counter.update({s.strip() for s in symptoms if s.strip()})

        if raw.get("title") != name:
            normalization.append({"title": raw.get("title"), "conditionName": name})

        counts = chunk_counts.get(name, {"symptom": 0, "paragraph": 0, "list_item": 0, "chars": 0})
        conditions.append(
            {
                "name": name,
                "slug": slug,
                "url": raw.get("url"),
                "symptoms": len(symptoms),
                "rawBlocks": len(raw_blocks),
                "paragraphs": len(paragraphs),
                "lists": len(lists),
                "chunks": counts["symptom"] + counts["paragraph"] + counts["list_item"],
                "chunkChars": counts["chars"],
                "rawBytes": len(json.dumps(raw, ensure_ascii=False).encode()),
                "nbsp": nb_raw,
                "processorVersion": version,
            }
        )
    conditions.sort(key=lambda c: c["name"].lower())

    # ---- sample record through every stage -----------------------------------
    cur.execute(
        """SELECT r.id, r.source, r.content, r.created_at, p.id, p.content, p.processing_metadata
           FROM raw_data r JOIN processed_data p ON p.raw_data_id = r.id
           WHERE p.condition_name = %s""",
        (SAMPLE_CONDITION,),
    )
    rid, rsource, rcontent, rcreated, pid, pcontent, pmeta = cur.fetchone()
    cur.execute(
        """SELECT id, content_type, content, metadata_, embedding::text
           FROM documents WHERE processed_data_id = %s
           ORDER BY content_type, (metadata_->>'paragraph_index')::int NULLS FIRST,
                    (metadata_->>'list_index')::int NULLS FIRST""",
        (pid,),
    )
    sample_docs = [
        {
            "id": str(i),
            "contentType": t,
            "content": c,
            "metadata": m,
            "embeddingHead": [round(v, 4) for v in parse_vector(e)[:8]],
        }
        for i, t, c, m, e in cur.fetchall()
    ]
    sample = {
        "condition": SAMPLE_CONDITION,
        "raw": {"id": str(rid), "source": rsource, "createdAt": rcreated.isoformat(), "content": rcontent},
        "processed": {"id": str(pid), "content": pcontent, "processingMetadata": pmeta},
        "documents": sample_docs,
    }

    # ---- embedding map ---------------------------------------------------------
    # t-SNE keeps local neighbourhoods (chunks of one condition cluster together),
    # which reads far better than the first principal components; the PCA
    # explained variance is still reported to show how high-dimensional the
    # space is. The sample questions are embedded exactly like the API does
    # (query_embed) and fitted together with the passages, so the 3-D map can
    # show where each question lands.
    cur.execute(
        """SELECT d.id, d.content_type, d.content, d.embedding::text, p.condition_name
           FROM documents d JOIN processed_data p ON p.id = d.processed_data_id
           ORDER BY p.condition_name, d.content_type, d.id"""
    )
    doc_rows = cur.fetchall()
    ids = [str(r[0]) for r in doc_rows]
    matrix = np.array([parse_vector(r[3]) for r in doc_rows], dtype=np.float64)
    mean = matrix.mean(axis=0)
    _, s, _ = np.linalg.svd(matrix - mean, full_matrices=False)
    explained = (s**2 / np.sum(s**2))[:3]

    embedder = TextEmbedding(model_name=EMBEDDING_MODEL)
    reranker = TextCrossEncoder(model_name=RERANK_MODEL)
    question_vecs = [np.asarray(list(embedder.query_embed([q]))[0], dtype=np.float64) for q in SAMPLE_QUESTIONS]

    coords = TSNE(
        n_components=3, perplexity=30, metric="cosine", init="pca", random_state=42
    ).fit_transform(np.vstack([matrix, np.array(question_vecs)]))
    # Center on the passages, turn the cloud so its longest axis is x and its
    # flattest is y (it sits wide in the horizontal scenes), and scale it so
    # every passage fits in the unit sphere.
    n_docs = len(doc_rows)
    coords = align_cloud(coords, n_docs)

    def xyz(row) -> dict:
        return {"x": round(float(row[0]), 4), "y": round(float(row[1]), 4), "z": round(float(row[2]), 4)}

    points = [
        {
            "id": ids[i],
            **xyz(coords[i]),
            "type": doc_rows[i][1],
            "condition": doc_rows[i][4],
            "preview": preview(doc_rows[i][2], 110),
        }
        for i in range(n_docs)
    ]
    question_points = {q: xyz(coords[n_docs + i]) for i, q in enumerate(SAMPLE_QUESTIONS)}

    # ---- retrieval traces (same algorithm as the API) -------------------------
    traces = []
    for question, q_vec in zip(SAMPLE_QUESTIONS, question_vecs):
        q_literal = "[" + ",".join(f"{v:.7f}" for v in q_vec) + "]"
        cur.execute(
            """SELECT d.id, d.content_type, d.content, p.condition_name,
                      1 - (d.embedding <=> %s::vector) AS similarity
               FROM documents d JOIN processed_data p ON p.id = d.processed_data_id
               ORDER BY d.embedding <=> %s::vector LIMIT %s""",
            (q_literal, q_literal, TOP_K),
        )
        candidates = cur.fetchall()
        scores = list(reranker.rerank_pairs([(question, c[2]) for c in candidates]))
        ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
        relevant = [r for r in ranked if r[1] > RELEVANCE_THRESHOLD]
        selected_ids = {str(r[0][0]) for r in relevant[:TOP_N]}
        vector_rank = {str(c[0]): i + 1 for i, c in enumerate(candidates)}

        traces.append(
            {
                "question": question,
                "query": question_points[question],
                "candidates": [
                    {
                        "id": str(c[0]),
                        "type": c[1],
                        "condition": c[3],
                        "preview": preview(c[2], 180),
                        "similarity": round(float(c[4]), 4),
                        "vectorRank": vector_rank[str(c[0])],
                        "rerankScore": round(float(score), 3),
                        "selected": str(c[0]) in selected_ids,
                    }
                    for c, score in ranked
                ],
                "relevantCount": len(relevant),
                "selectedCount": len(selected_ids),
            }
        )

    cur.execute(
        """SELECT count(*) FILTER (WHERE content_type = 'list_item' AND content LIKE %s),
                  count(*) FILTER (WHERE position(chr(160) in content) > 0)
           FROM documents""",
        ("%['%",),
    )
    repr_chunks, nbsp_chunks = cur.fetchone()

    snapshot = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "https://patients.amwell.com/conditions/",
            "embeddingModel": EMBEDDING_MODEL,
            "embeddingDims": int(matrix.shape[1]),
            "rerankModel": RERANK_MODEL,
            "topK": TOP_K,
            "topN": TOP_N,
            "relevanceThreshold": RELEVANCE_THRESHOLD,
            "processorVersion": conditions[0]["processorVersion"] if conditions else None,
        },
        "stages": stages,
        "chunkTypes": chunk_types,
        "conditions": conditions,
        "topSymptoms": symptom_counter.most_common(25),
        "audit": {
            "records": len(joined),
            "nbspRaw": audit_nbsp_raw,
            "nbspProcessed": audit_nbsp_processed,
            "recordsWithNbsp": sum(1 for c in conditions if c["nbsp"]),
            "emptyIntroduction": empty_intro,
            "emptySections": empty_sections,
            "emptyFaqs": empty_faqs,
            "missingSymptoms": no_symptoms,
            "normalizedTitles": len(normalization),
            "normalizationExamples": normalization[:12],
            "distinctSymptoms": len(symptom_counter),
            "listChunksWithPythonRepr": repr_chunks,
            "chunksWithNbsp": nbsp_chunks,
        },
        "sample": sample,
        "projection": {
            "method": "3-D t-SNE (cosine, perplexity 30)",
            "pcaExplainedVariance": [round(float(v), 4) for v in explained],
            "points": points,
        },
        "retrievalTraces": traces,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KiB)")


if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        sys.exit("DATABASE_URL is required")
    main()
