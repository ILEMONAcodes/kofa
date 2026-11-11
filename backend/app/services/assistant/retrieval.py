"""The only retrieval paths: published articles and the existing public property DTO."""

import re
from decimal import Decimal
from typing import Any

from sqlalchemy import literal_column, or_, select

from app.models.knowledge import KnowledgeArticle
from app.services import property_public
from app.services.assistant.safety import safe_output, tokens


def retrieve(db, question, support):
    wanted = tokens(question)
    if not wanted:
        return []
    conditions = [
        literal_column("((title::text || ' '::text) || body)").ilike("%" + word + "%")
        for word in sorted(wanted)[:12]
    ]
    articles = db.scalars(
        select(KnowledgeArticle)
        .where(KnowledgeArticle.status == "published", or_(*conditions))
        .order_by(KnowledgeArticle.updated_at.desc())
        .limit(30)
    )
    ranked = []
    for row in articles:
        text = row.body[:1800]
        overlap = len(wanted & tokens(row.title + " " + text))
        if overlap and safe_output(row.title + " " + text, support):
            ranked.append(
                (
                    overlap,
                    {
                        "key": "article:" + str(row.id),
                        "type": "article",
                        "id": str(row.id),
                        "title": row.title,
                        "url": "/resources/article?slug=" + row.slug,
                        "text": text,
                    },
                )
            )
    if wanted & {
        "property",
        "apartment",
        "house",
        "duplex",
        "bungalow",
        "studio",
        "rent",
        "sale",
        "bedroom",
    }:
        filters: dict[str, Any] = {}
        filters["listing_type"] = (
            "rent"
            if re.search(r"\brent\w*\b", question, re.I)
            else "sale"
            if re.search(r"\b(buy|sale)\b", question, re.I)
            else None
        )
        types = [
            kind
            for kind in ["apartment", "house", "duplex", "bungalow", "terrace", "studio", "room"]
            if kind in wanted
        ]
        if types:
            filters["property_type"] = types
        match = re.search(r"\b([0-9])\s*[- ]?\s*bed", question, re.I)
        if match:
            filters["bedrooms_min"] = filters["bedrooms_max"] = int(match[1])
        for direction, key in [
            (r"under|below|max(?:imum)?|budget(?: of)?|up to", "price_max"),
            (r"over|above|min(?:imum)?", "price_min"),
        ]:
            price = re.search(
                r"(?:"
                + direction
                + r")\s*(?:NGN|₦|naira)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(million|thousand|m\b|k\b)?",
                question,
                re.I,
            )
            if price:
                scale = (
                    1000000
                    if (price[2] or "").lower() in {"million", "m"}
                    else 1000
                    if (price[2] or "").lower() in {"thousand", "k"}
                    else 1
                )
                amount = int(Decimal(price[1].replace(",", "")) * scale * 100)
                if amount > 9000000000000000:
                    return []
                filters[key] = amount
        for furnishing in ["unfurnished", "semi_furnished", "furnished"]:
            if re.search(r"\b" + furnishing.replace("_", "[ -]?") + r"\b", question, re.I):
                filters["furnishing"] = [furnishing]
                break
        # Public taxonomy only, no exact address or landlord lookups.
        for area in property_public.taxonomy(db).data.areas:
            if area.neighbourhood.lower() in question.lower():
                filters["area"] = [area.slug]
                break
        result = property_public.search(db, "", filters, [("published_at", True)], 1, 3)
        for row in result.data:
            text = f"{row.title}. {row.bedrooms} bedrooms; {row.bathrooms} bathrooms. {row.location.neighbourhood}, {row.location.city}. Listing price: NGN {Decimal(row.price.amount) / 100:,.2f} per {row.price.period}. Availability shown: {row.availability_status}; reconfirm with our team."
            if safe_output(text, support):
                ranked.append(
                    (
                        2,
                        {
                            "key": "property:" + str(row.id),
                            "type": "property",
                            "id": str(row.id),
                            "title": row.title,
                            "url": "/properties/" + row.slug,
                            "text": text,
                        },
                    )
                )
    return [source for _, source in sorted(ranked, key=lambda pair: pair[0], reverse=True)[:3]]
