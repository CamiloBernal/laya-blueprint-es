"""Level 3: score a backlog file in shared forward passes and write a CSV.

Run:  python ejemplos/03_lote_tickets.py ejemplos/datos/tickets.txt salida.csv
Needs: pip install laya

`predict_batch` routes every request first, groups them by checkpoint and question schema,
and restores input order. `sort_by_length` reduces padding when lengths vary; it only takes
effect when 1 < batch_size < number of requests.
"""
import csv
import sys
import time
from pathlib import Path

import laya
from laya import Router

src = Path(sys.argv[1] if len(sys.argv) > 1 else "ejemplos/datos/tickets.txt")
dst = Path(sys.argv[2] if len(sys.argv) > 2 else "salida.csv")

lines = [line.strip() for line in src.read_text(encoding="utf-8").splitlines() if line.strip()]
questions = laya.triage_questions()  # preset: its instructions read the `message` field

router = Router(default="multilingual", preload=True)

started = time.perf_counter()
results = router.predict_batch(
    [{"state": {"message": text}, "questions": questions} for text in lines],
    batch_size=8,
    sort_by_length=True,
)
elapsed = time.perf_counter() - started

with dst.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["text", "model", "intent", "intent_p", "is_urgent", "frustration",
                     "refund_requested", "churn_risk"])
    for text, res in zip(lines, results):
        a = res["answers"]
        writer.writerow([
            text,
            res["routing"]["model"],
            a["intent"]["choice"],
            f"{a['intent']['answer_confidence']:.4f}",
            f"{a['is_urgent']['noul']:.4f}",
            f"{a['frustration']['score']:.4f}",
            f"{a['refund_requested']['noul']:.4f}",
            f"{a['churn_risk']['noul']:.4f}",
        ])

print(f"{len(lines)} requests in {elapsed:.2f}s -> {dst}")
