"""Level 0: the smallest useful Laya program, tuned for Spanish-speaking traffic.

Run:  python ejemplos/01_hola_laya.py
Needs: pip install laya  (first run downloads the checkpoint from the Hugging Face Hub)

Adapted from the upstream README quickstart (https://github.com/NandhaKishorM/laya),
Apache License 2.0, Copyright Convai Innovations. Changes: Spanish states, default route.
"""
from laya import Router

# Short Spanish text ("Quiero cancelar") carries no language signal for the built-in
# detector and would fall back to the English checkpoint. For mostly non-English
# traffic, make the multilingual checkpoint the default.
router = Router(default="multilingual")

state = {
    "subject": "Cobro duplicado",
    "body": "Me cobraron dos veces la cuota de marzo. Devuélvanme el dinero hoy o cancelo el plan.",
}

questions = {
    "department": {
        "type": "choice",
        "instructions": "Which department should handle this request?",
        "criteria": {
            "billing": "invoices, payments, refunds",
            "technical": "bugs, outages, system errors",
            "other": "everything else",
        },
    },
    "urgency": {
        "type": "score",
        "instructions": "How urgent is this request?",
        "criteria": ["not urgent", "soon", "blocking or deadline today"],
    },
    "churn_risk": {
        "type": "noul",
        "instructions": "Does the user threaten to cancel or leave?",
        "criteria": {
            "false": "the user does not mention leaving or cancelling",
            "true": "the user threatens to cancel or leave",
        },
    },
}

result = router.predict(state, questions)
answers = result["answers"]

print("Routing    :", result["routing"]["model"], "-", result["routing"]["reason"])
print("Department :", answers["department"]["choice"],
      f"(answer_confidence={answers['department']['answer_confidence']:.2f})")
print("Urgency    :", round(answers["urgency"]["score"], 2), "on a 0-2 scale")
print("Churn risk :", f"{answers['churn_risk']['noul']:.2f}", "= P(true)")
print("Tokens     :", result["usage"])
