"""Level 2: PQRSD triage for a public-sector front desk, with a human-review gate.

A PQRSD (peticion, queja, reclamo, sugerencia, denuncia) arrives as free text. Laya answers
several typed questions in one forward pass; the application decides what to do with them.

Run:  python ejemplos/02_pqrsd_gobierno.py
Needs: pip install laya

MIN_CONFIDENCE below is a placeholder. Fit and validate your own threshold on held-out,
labelled data (see section 12 of GUIA-LAYA.md) before automating anything.
"""
from laya import Router

MIN_CONFIDENCE = 0.80  # placeholder policy, NOT a property of the model

router = Router(default="multilingual")

questions = {
    "request_type": {
        "type": "choice",
        "instructions": "What kind of citizen request is `body`?",
        "criteria": {
            "petition": "asks for information, documents or a service (derecho de peticion)",
            "complaint": "expresses dissatisfaction with how an official or office behaved",
            "claim": "demands a correction or compensation for a service that failed",
            "suggestion": "proposes an improvement",
            "report": "reports an irregularity, corruption or a possible crime",
        },
    },
    "legal_deadline": {
        "type": "noul",
        "instructions": "Does `body` mention a tutela, a court order or an expired legal deadline?",
        "criteria": {
            "false": "no court action or legal deadline is mentioned",
            "true": "mentions a tutela, a court order or a legal deadline",
        },
    },
    "frustration": {
        "type": "score",
        "instructions": "How frustrated does the citizen sound in `body`?",
        "criteria": ["calm", "annoyed", "angry", "furious"],
    },
}

inbox = [
    "Solicito copia del certificado de estratificación de mi predio, matrícula 050-123456.",
    "Llevo 20 días sin respuesta a mi derecho de petición. Si no responden, interpongo tutela.",
    "El funcionario de la ventanilla 3 me trató de forma grosera y se negó a recibir mis documentos.",
    "Sería bueno habilitar pagos del impuesto predial por PSE los fines de semana.",
]

results = router.predict_batch(
    [{"state": {"body": text}, "questions": questions} for text in inbox],
    min_confidence=MIN_CONFIDENCE,
)

for text, res in zip(inbox, results):
    kind = res["answers"]["request_type"]
    deadline = res["answers"]["legal_deadline"]["noul"]
    needs_human = kind.get("low_confidence", False) or deadline >= 0.5
    print("-" * 78)
    print(text)
    print(f"  type={kind['choice']:<11} p={kind['answer_confidence']:.2f}"
          f"  legal_deadline={deadline:.2f}"
          f"  frustration={res['answers']['frustration']['score']:.2f}")
    print("  ->", "HUMAN REVIEW" if needs_human else "auto-route to " + kind["choice"])
