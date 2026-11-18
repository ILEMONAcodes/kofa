"""Explicit starter Help content; published through normal audited admin services."""

from sqlalchemy import select

from app.models.knowledge import KnowledgeArticle
from app.schemas.knowledge import ArticleCreate, ArticleVersion
from app.services import knowledge

ARTICLES = [
    (
        "How verification works",
        "verification",
        "Verification checks identity, location, price and property features. The team records completed checks and the verification date on the listing. Review the checks shown on a property and ask the team if information needs clarification.",
    ),
    (
        "Finding a property",
        "how_it_works",
        "Explore properties and filter by location, neighbourhood, rent or purchase, property type, bedrooms and budget. Open a property card to see its photos, description, features and availability. Adjust your filters if no homes match your search.",
    ),
    (
        "Understanding property details",
        "how_it_works",
        "A property page shows its description, photos, features, asking price and availability information. Bathrooms are listed as property features rather than a separate search preference. Confirm current details with the team before making arrangements.",
    ),
    (
        "Creating a client account",
        "how_it_works",
        "Create a client account using your full name, email, phone number and a password of at least eight characters. Sign in to express interest, send an inquiry and follow your conversations with the team. Keep your account credentials private.",
    ),
    (
        "Sending a property inquiry",
        "how_it_works",
        "Open a property and express interest or request an inspection. Tell the team your preferences, budget and preferred move-in date. You can follow your inquiry and read staff replies from Inquiries after signing in.",
    ),
    (
        "Preparing for an inspection",
        "inspections",
        "Before an inspection, review the property listing and prepare your questions. Check the appointment date and time in your account. Confirm your appointment and follow the meeting instructions provided by the team.",
    ),
    (
        "Rescheduling or cancelling an inspection",
        "inspections",
        "If your plans change, open your inspection appointment and use the available reschedule or cancellation action. Explain the change to the team in your inquiry conversation. Check the appointment status before travelling.",
    ),
    (
        "Submitting a property for review",
        "how_it_works",
        "Use List your property to register your contact details and describe your relationship to the property. Add the property details, photos and supporting files, then submit it for review. The team reviews submissions before publishing listings.",
    ),
    (
        "Adding property photos and video",
        "how_it_works",
        "Use the media section in the property submission flow to add clear photos and a property video where offered. Follow the file type and size guidance shown by the uploader. Remove an incorrect file and replace it before submitting your property.",
    ),
    (
        "Checking listing availability",
        "verification",
        "Check the availability information and confirmation date shown on the listing. Availability may change while you are searching. Ask the team to reconfirm a property before arranging a visit.",
    ),
    (
        "Getting help from the team",
        "contact",
        "Use Help to read published articles or Ask Kof’a for guidance based on available public information. If an answer is unavailable or you need personal assistance, call the support line or sign in to send a message to the team.",
    ),
]


def seed_knowledge(db, actor_id):
    actor = knowledge.current_staff(db, actor_id)
    if actor.role != "admin":
        raise ValueError("An active administrator is required to publish starter content")
    created = 0
    for title, category, body in ARTICLES:
        if db.scalar(select(KnowledgeArticle.id).where(KnowledgeArticle.title == title)):
            continue  # Preserve existing editorial content, including private drafts.
        article = knowledge.create(
            db, actor.id, ArticleCreate(title=title, category=category, body=body, language="en")
        )
        knowledge.change(
            db, actor.id, article.id, ArticleVersion(version=article.version), operation="publish"
        )
        created += 1
    return created
