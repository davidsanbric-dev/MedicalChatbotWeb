# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "pgvector==0.4.1",
#     "psycopg2-binary==2.9.10",
#     "sqlalchemy==2.0.43",
# ]
# ///
"""Seed a local `raw_data` table from the scraper's JSON output.

Local-only stand-in for `medical_conditions_scraper --all --database`: it writes
the exact dicts the scraper produced (saved under `scraped/*.json`) using the
same `source` format (`medical_conditions:<slug>`), so the real worker can run
against them unchanged without hitting the source website again.

It reuses the worker's own SQLAlchemy models (`medical_conditions_worker/db`),
so the schema is exactly the one the worker expects.

Usage (uv resolves the inline dependencies above):

    DATABASE_URL=postgresql://postgres:<pw>@localhost:55433/medical_conditions_db \
    uv run scripts/load_raw_from_json.py ../medical_conditions_scraper/scraped
"""

import json
import os
import sys
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parents[2] / "medical_conditions_worker"
sys.path.insert(0, str(WORKER_DIR))

from sqlalchemy import text  # noqa: E402

from db.database import SessionLocal, engine  # noqa: E402
from db.models import Base, RawData  # noqa: E402


def main(scraped_dir: Path) -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    Base.metadata.create_all(bind=engine)

    files = sorted(scraped_dir.glob("*.json"))
    inserted = skipped = 0
    with SessionLocal() as session:
        existing = {source for (source,) in session.query(RawData.source).all()}
        for path in files:
            source = f"medical_conditions:{path.stem}"
            if source in existing:
                skipped += 1
                continue
            session.add(RawData(content=json.loads(path.read_text()), source=source))
            inserted += 1
        session.commit()

    print(f"raw_data: {inserted} inserted, {skipped} already present ({len(files)} files)")


if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        sys.exit("DATABASE_URL is required")
    if len(sys.argv) != 2:
        sys.exit("usage: load_raw_from_json.py <scraped_dir>")
    main(Path(sys.argv[1]))
