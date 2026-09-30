"""Level 3: schema-driven decisions. Describe the shape, get typed values back.

Run:  python ejemplos/04_decide_esquema.py
Needs: pip install "laya[structured]"   (pydantic, only for the second half)

enum -> choice, boolean -> noul, bounded integer -> score. Free strings, arrays, nested
objects and $ref are rejected with laya.structured.SchemaError naming the path.
"""
from typing import Literal

from pydantic import BaseModel, Field

from laya import Router

router = Router(default="multilingual")

# 1) Plain JSON schema
schema = {
    "type": "object",
    "properties": {
        "channel": {"type": "string", "enum": ["card", "transfer", "cash", "other"],
                    "description": "Which payment channel is the customer talking about?"},
        "severity": {"type": "integer", "minimum": 0, "maximum": 3,
                     "description": "How severe is the financial impact for the customer?"},
        "fraud_suspected": {"type": "boolean",
                            "description": "Does the customer suspect fraud or an unauthorized charge?"},
    },
}

text = "Aparece una compra de 2.300.000 pesos con mi tarjeta que yo no hice. Bloqueen la tarjeta ya."
print(router.decide(text, schema=schema))


# 2) The same contract as a pydantic model, with per-field confidence
class CardDispute(BaseModel):
    channel: Literal["card", "transfer", "cash", "other"] = Field(
        description="Which payment channel is the customer talking about?")
    severity: Literal[0, 1, 2, 3] = Field(
        description="How severe is the financial impact for the customer?")
    fraud_suspected: bool = Field(
        description="Does the customer suspect fraud or an unauthorized charge?")


details = router.decide(text, schema=CardDispute, return_details=True)
print(details)
